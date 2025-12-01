import os
import base64
import io
import json
import numpy as np
import torch
import cv2
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image

# Import SAM 3
try:
    from sam3.build_sam import build_sam3
    from sam3.sam3_predictor import SAM3Predictor
except ImportError:
    print("Warning: SAM 3 not found. Please install it.")

app = FastAPI()

# Global model
predictor = None

# Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SAM3_CONFIG = "sam3_hiera_l.yaml" # Assuming config name
SAM3_CHECKPOINT = "weights/sam3_hiera_large.pt"

def load_models():
    global predictor
    
    print(f"Loading SAM 3 on {DEVICE}...")
    
    if os.path.exists(SAM3_CHECKPOINT):
        # Build and load SAM 3
        # Note: API might vary slightly, adapting to standard Meta pattern
        sam3_model = build_sam3(SAM3_CONFIG, SAM3_CHECKPOINT, device=DEVICE)
        predictor = SAM3Predictor(sam3_model)
        print("SAM 3 loaded successfully.")
    else:
        print(f"SAM 3 checkpoint not found at {SAM3_CHECKPOINT}")

@app.on_event("startup")
async def startup_event():
    load_models()

@app.get("/health")
def health_check():
    status = "healthy" if predictor is not None else "unhealthy"
    return {"status": status, "device": DEVICE, "model": "SAM 3"}

class SegmentationRequest(BaseModel):
    image: str # Base64 encoded image
    prompts: List[str] # List of text prompts
    box_threshold: float = 0.35
    text_threshold: float = 0.25

class SegmentationResponse(BaseModel):
    masks: List[dict] # RLE masks
    scores: List[float]
    labels: List[str]

def base64_to_image(base64_string):
    img_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(img_data)).convert("RGB")
    return image

def encode_mask_rle(mask):
    """
    Encodes a binary mask to RLE format compatible with COCO/Supabase.
    """
    from pycocotools import mask as mask_utils
    # Ensure mask is binary uint8
    mask = mask.astype(np.uint8)
    rle = mask_utils.encode(np.asfortranarray(mask))
    # Encode bytes to base64 string for JSON safety
    rle['counts'] = base64.b64encode(rle['counts']).decode('utf-8')
    return rle

@app.post("/predict", response_model=SegmentationResponse)
async def predict_segmentation(request: SegmentationRequest):
    if not predictor:
        raise HTTPException(status_code=500, detail="SAM 3 model not loaded.")

    try:
        # 1. Decode image
        image_pil = base64_to_image(request.image)
        image_np = np.array(image_pil)
        
        # 2. Run SAM 3 with Text Prompts
        # SAM 3 supports text prompts directly!
        predictor.set_image(image_np)
        
        final_masks = []
        final_scores = []
        final_labels = []

        # Process each prompt
        # SAM 3 can likely handle batch prompts, but let's loop for safety/clarity first
        for prompt in request.prompts:
            # Predict using text
            masks, scores, _ = predictor.predict(
                point_coords=None,
                point_labels=None,
                box=None,
                multimask_output=False,
                text_prompt=prompt # New SAM 3 feature
            )
            
            # Take the best mask
            best_idx = np.argmax(scores)
            best_mask = masks[best_idx]
            best_score = scores[best_idx]
            
            rle = encode_mask_rle(best_mask)
            final_masks.append(rle)
            final_scores.append(float(best_score))
            final_labels.append(prompt)
            
        return {
            "masks": final_masks,
            "scores": final_scores,
            "labels": final_labels
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
