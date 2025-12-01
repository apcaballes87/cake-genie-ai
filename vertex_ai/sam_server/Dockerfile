FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install system dependencies
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libfreetype6-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
# Set CUDA_HOME just in case
ENV CUDA_HOME=/usr/local/cuda
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Download weights
RUN chmod +x download_weights.sh && ./download_weights.sh

# Expose port
EXPOSE 8080

# Run app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
