from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main


def image_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (32, 32), (255, 0, 0)).save(output, format="PNG")
    return output.getvalue()


@pytest.fixture(autouse=True)
def configured_pdq(monkeypatch):
    monkeypatch.setattr(main, "PDQ_INTERNAL_SECRET", "test-secret")
    monkeypatch.setattr(main, "pdq_from_bytes", lambda _content: (bytes.fromhex("AB" * 32), 91))


def test_pdq_requires_server_to_server_secret():
    client = TestClient(main.app)
    response = client.post("/api/pdq", files={"file": ("cake.png", image_bytes(), "image/png")})
    assert response.status_code == 401
    assert response.json()["status"] == "error"
    assert response.json()["error"] == "Unauthorized."


def test_pdq_returns_lowercase_256_bit_hash_and_quality():
    client = TestClient(main.app)
    response = client.post(
        "/api/pdq",
        headers={"x-pdq-internal-secret": "test-secret"},
        files={"file": ("cake.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["pdq_hash"] == "ab" * 32
    assert response.json()["pdq_quality"] == 91
    assert response.json()["status"] == "ready"


def test_pdq_discards_low_quality_hashes(monkeypatch):
    monkeypatch.setattr(main, "pdq_from_bytes", lambda _content: (bytes.fromhex("CD" * 32), 49))
    client = TestClient(main.app)
    response = client.post(
        "/api/pdq",
        headers={"x-pdq-internal-secret": "test-secret"},
        files={"file": ("cake.png", image_bytes(), "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "low_quality"
    assert response.json()["pdq_hash"] is None
    assert "below the minimum" in response.json()["error"]


def test_pdq_rejects_oversized_input(monkeypatch):
    monkeypatch.setattr(main, "MAX_INPUT_BYTES", 8)
    client = TestClient(main.app)
    response = client.post(
        "/api/pdq",
        headers={"x-pdq-internal-secret": "test-secret"},
        files={"file": ("cake.png", b"123456789", "image/png")},
    )
    assert response.status_code == 413
    assert response.json()["status"] == "error"
    assert "too large" in response.json()["error"]


def test_pdq_rejects_undecodable_image():
    client = TestClient(main.app)
    response = client.post(
        "/api/pdq",
        headers={"x-pdq-internal-secret": "test-secret"},
        files={"file": ("cake.png", b"not an image", "image/png")},
    )
    assert response.status_code == 422


def test_image_normalization_is_deterministic():
    first = main.canonicalize_image(image_bytes())
    second = main.canonicalize_image(image_bytes())
    assert first == second
    with Image.open(BytesIO(first)) as normalized:
        assert normalized.mode == "RGB"
        assert normalized.size == (512, 512)


def test_pdq_rejects_non_image_content():
    client = TestClient(main.app)
    response = client.post(
        "/api/pdq",
        headers={"x-pdq-internal-secret": "test-secret"},
        files={"file": ("cake.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 400
