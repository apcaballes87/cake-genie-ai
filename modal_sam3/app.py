"""
FastSAM Deployment on Modal.com
Fast, lightweight alternative to SAM - 50x faster, no auth required
"""
import modal
import base64
import io
from typing import List

# Create Modal app
app = modal.App("fastsam-segmentation")

# Define the container image with FastSAM
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "ultralytics",  # Includes FastSAM
        "opencv-python",
        "pycocotools",
        "Pillow",
        "numpy",
        "fastapi",
    )
)

# GPU configuration
@app.cls(
    image=image,
    gpu="T4",  # NVIDIA T4 GPU
    timeout=600,
)
@modal.concurrent(max_inputs=10)
class FastSAMModel:
    @modal.enter()
    def load_model(self):
        """Load FastSAM model on container startup"""
        from ultralytics import FastSAM

        print("Loading FastSAM model...")

        # Use FastSAM-x (extra large) for better accuracy
        # FastSAM-s is faster but less accurate
        self.model = FastSAM('FastSAM-x.pt')

        print("✅ FastSAM loaded successfully!")

    @modal.method()
    def predict(self, image_b64: str, prompts: List[str]) -> dict:
        """
        Run FastSAM segmentation with text prompts

        Args:
            image_b64: Base64 encoded image
            prompts: List of text prompts (e.g., ["red rose", "gold candle"])

        Returns:
            dict with masks, scores, and labels
        """
        import numpy as np
        from PIL import Image
        from pycocotools import mask as mask_utils
        import tempfile
        import os

        # Decode image and save to temp file (FastSAM needs file path)
        img_data = base64.b64decode(image_b64)
        image_pil = Image.open(io.BytesIO(img_data)).convert("RGB")

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            image_pil.save(tmp.name, format='JPEG')
            temp_path = tmp.name

        try:
            results = {
                "masks": [],
                "scores": [],
                "labels": []
            }

            # Process each text prompt
            for prompt in prompts:
                try:
                    print(f"🔍 Processing prompt: '{prompt}'")
                    
                    # SPECIAL HANDLING: "everything_prompt" returns ALL masks without text filtering
                    if prompt == "everything_prompt":
                        print("🌟 EVERYTHING MODE: Running FastSAM without text filter")
                        # Run without texts parameter to get ALL detected masks
                        inference_results = self.model(
                            temp_path,
                            device='cuda',
                            retina_masks=True,
                            imgsz=1024,
                            conf=0.25,
                            iou=0.9
                            # NO texts parameter - returns all detected objects
                        )
                    else:
                        # Normal text-prompted mode
                        print(f"📝 TEXT MODE: Running FastSAM with text prompt: '{prompt}'")
                        inference_results = self.model(
                            temp_path,
                            device='cuda',
                            retina_masks=True,
                            imgsz=1024,
                            conf=0.25,
                            iou=0.9,
                            texts=prompt  # Direct text prompt
                        )

                    # Extract masks from results
                    if inference_results and len(inference_results) > 0:
                        result = inference_results[0]  # Get first result
                        
                        print(f"📊 Inference result type: {type(result)}")
                        print(f"📊 Has masks attribute: {hasattr(result, 'masks')}")

                        if hasattr(result, 'masks') and result.masks is not None:
                            # Get the mask data
                            mask_data = result.masks.data
                            print(f"🎭 Total masks detected: {len(mask_data)}")
                            
                            if prompt == "everything_prompt":
                                # In everything mode, return ALL masks
                                print(f"✨ EVERYTHING MODE: Returning all {len(mask_data)} masks")
                                for idx, mask in enumerate(mask_data):
                                    mask_np = mask.cpu().numpy().astype(np.uint8)
                                    print(f"  Mask {idx}: shape={mask_np.shape}, unique_values={np.unique(mask_np)}")
                                    
                                    # Encode mask to RLE
                                    rle = mask_utils.encode(np.asfortranarray(mask_np))
                                    rle['counts'] = base64.b64encode(rle['counts']).decode('utf-8')
                                    
                                    results["masks"].append(rle)
                                    results["scores"].append(1.0)
                                    results["labels"].append(f"object_{idx}")
                            else:
                                # Text-prompted mode: take the first/best mask
                                if len(mask_data) > 0:
                                    best_mask = mask_data[0].cpu().numpy().astype(np.uint8)
                                    print(f"  Best mask: shape={best_mask.shape}")

                                    # Encode mask to RLE
                                    rle = mask_utils.encode(np.asfortranarray(best_mask))
                                    rle['counts'] = base64.b64encode(rle['counts']).decode('utf-8')

                                    results["masks"].append(rle)
                                    results["scores"].append(1.0)
                                    results["labels"].append(prompt)
                                else:
                                    print(f"⚠️ No masks in result for prompt '{prompt}'")
                                    results["masks"].append(None)
                                    results["scores"].append(0.0)
                                    results["labels"].append(prompt)
                        else:
                            print(f"❌ No masks found for prompt '{prompt}'")
                            results["masks"].append(None)
                            results["scores"].append(0.0)
                            results["labels"].append(prompt)
                    else:
                        print(f"❌ No results for prompt '{prompt}'")
                        results["masks"].append(None)
                        results["scores"].append(0.0)
                        results["labels"].append(prompt)

                except Exception as e:
                    print(f"🔥 Error processing prompt '{prompt}': {e}")
                    import traceback
                    traceback.print_exc()
                    results["masks"].append(None)
                    results["scores"].append(0.0)
                    results["labels"].append(prompt)

            print(f"✅ Finished processing. Total results: {len(results['masks'])}")
            print(f"✅ Non-null masks: {sum(1 for m in results['masks'] if m is not None)}")
            return results

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)


# Web endpoint for easy testing/calling
@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def segment(request: dict):
    """
    HTTP endpoint for segmentation
    POST body: {"image": "base64...", "prompts": ["text1", "text2"]}
    """
    image_b64 = request.get("image")
    prompts = request.get("prompts", [])

    if not image_b64 or not prompts:
        return {"error": "Missing image or prompts"}, 400

    # Call the class method remotely from the web endpoint
    model = FastSAMModel()
    result = model.predict.remote(image_b64, prompts)

    return {"predictions": [result]}


# Local testing endpoint
@app.local_entrypoint()
def main():
    """Test the deployment locally"""
    from PIL import Image

    print("🧪 Testing FastSAM deployment...")

    # Create a small test image
    test_img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    test_img.save(buffer, format='PNG')
    test_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    # Test prediction
    model = FastSAMModel()
    result = model.predict.remote(test_b64, ["red square"])

    print(f"✅ Test result: {len(result['masks'])} masks generated")
    print(f"Scores: {result['scores']}")
