#!/bin/bash
mkdir -p weights

echo "Downloading SAM 3 weights..."
# Using the official Meta SAM 3 weights from Hugging Face
curl -L -o weights/sam3_hiera_large.pt https://huggingface.co/facebook/sam3-hiera-large/resolve/main/sam3_hiera_large.pt
