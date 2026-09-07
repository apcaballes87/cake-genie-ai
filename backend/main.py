"""Authenticated Facebook ThreatExchange PDQ hashing service.

The Next.js application is the public upload boundary. This service is only
called server-to-server and never performs cache matching or database writes.
"""

from __future__ import annotations

import os
import secrets
from io import BytesIO
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from PIL import Image, ImageOps
from pydantic import BaseModel
from fastapi.responses import JSONResponse

try:
    from threatexchange.signal_type.pdq.signal import pdq_from_bytes
except ImportError as exc:  # pragma: no cover - exercised by deployment smoke tests
    pdq_from_bytes = None
    _PDQ_IMPORT_ERROR = exc
else:
    _PDQ_IMPORT_ERROR = None


load_dotenv()
load_dotenv(dotenv_path="../.env.local")

PDQ_INTERNAL_SECRET = os.getenv("PDQ_INTERNAL_SECRET", "").strip()
MAX_INPUT_BYTES = 10 * 1024 * 1024
PDQ_MIN_QUALITY = 50
PDQ_PIPELINE = "pdq-v1-threatexchange-1.2.16-pillow-exif-rgb-white-512-contain-lanczos3"


class PDQResponse(BaseModel):
    status: str
    pdq_hash: Optional[str] = None
    pdq_quality: Optional[int] = None
    pdq_pipeline: str = PDQ_PIPELINE
    error: Optional[str] = None


app = FastAPI(title="Genie Facebook PDQ Fingerprint Service", version="1.0.0")


@app.exception_handler(HTTPException)
async def pdq_http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=PDQResponse(status="error", error=str(exc.detail)).model_dump(),
    )


def require_internal_secret(provided_secret: Optional[str]) -> None:
    if not PDQ_INTERNAL_SECRET:
        raise HTTPException(status_code=503, detail="PDQ internal secret is not configured.")
    if not provided_secret or not secrets.compare_digest(provided_secret, PDQ_INTERNAL_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def canonicalize_image(image_bytes: bytes) -> bytes:
    """Decode with EXIF orientation, flatten alpha, and serialize deterministically."""
    with Image.open(BytesIO(image_bytes)) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        rgb = background.convert("RGB")
        rgb.thumbnail((512, 512), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (512, 512), (255, 255, 255))
        left = (512 - rgb.width) // 2
        top = (512 - rgb.height) // 2
        canvas.paste(rgb, (left, top))

        output = BytesIO()
        canvas.save(output, format="PNG", optimize=False, compress_level=9)
        return output.getvalue()


def _hash_to_hex(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower().removeprefix("0x")
        if len(normalized) == 64 and all(char in "0123456789abcdef" for char in normalized):
            return normalized

    if hasattr(value, "tobytes"):
        value = value.tobytes()

    if isinstance(value, (bytes, bytearray, memoryview)):
        normalized = bytes(value).hex()
        if len(normalized) == 64:
            return normalized

    if isinstance(value, (list, tuple)) and len(value) == 32:
        normalized = bytes(value).hex()
        if len(normalized) == 64:
            return normalized

    raise ValueError("PDQ implementation returned an unexpected hash shape.")


def compute_pdq(image_bytes: bytes) -> PDQResponse:
    if pdq_from_bytes is None:
        raise RuntimeError(f"PDQ dependency unavailable: {_PDQ_IMPORT_ERROR}")

    canonical_bytes = canonicalize_image(image_bytes)
    raw_hash, raw_quality = pdq_from_bytes(canonical_bytes)
    quality = int(round(float(raw_quality)))
    if quality < 0 or quality > 100:
        raise ValueError(f"PDQ implementation returned invalid quality: {quality}")

    if quality < PDQ_MIN_QUALITY:
        return PDQResponse(
            status="low_quality",
            pdq_quality=quality,
            error=f"PDQ quality {quality} is below the minimum {PDQ_MIN_QUALITY}.",
        )

    return PDQResponse(
        status="ready",
        pdq_hash=_hash_to_hex(raw_hash),
        pdq_quality=quality,
    )


@app.get("/api/status")
def get_status() -> dict[str, Any]:
    return {
        "status": "online",
        "pdq_configured": bool(PDQ_INTERNAL_SECRET),
        "pdq_dependency_loaded": pdq_from_bytes is not None,
        "pdq_pipeline": PDQ_PIPELINE,
    }


@app.post("/api/pdq", response_model=PDQResponse)
async def hash_image(
    file: UploadFile = File(...),
    x_pdq_internal_secret: Optional[str] = Header(default=None),
) -> PDQResponse:
    require_internal_secret(x_pdq_internal_secret)

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    content = await file.read(MAX_INPUT_BYTES + 1)
    if len(content) > MAX_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="Image too large.")

    try:
        return compute_pdq(content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to compute PDQ fingerprint: {exc}") from exc
