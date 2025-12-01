#!/bin/bash
set -e

# Configuration
# TODO: Replace with your actual GCP Project ID
PROJECT_ID="unique-sentinel-471416-v8" 
REGION="us-central1"
REPO_NAME="genie-ai-repo"
IMAGE_NAME="sam-server"
TAG="latest"
MODEL_DISPLAY_NAME="sam-3-model"
ENDPOINT_DISPLAY_NAME="sam-3-endpoint"

echo "🚀 Starting SAM 2 Deployment to Vertex AI..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# 1. Enable APIs
echo "Enabling APIs..."
gcloud services enable artifactregistry.googleapis.com aiplatform.googleapis.com cloudbuild.googleapis.com --project=$PROJECT_ID

# 2. Create Artifact Registry Repository
echo "Creating Artifact Registry repository..."
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID &>/dev/null; then
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker repository for Genie AI models" \
        --project=$PROJECT_ID
else
    echo "Repository $REPO_NAME already exists."
fi

# 3. Build and Push Image
echo "Building and pushing Docker image..."
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG"
# Note: Running from root directory, so context is vertex_ai/sam_server
gcloud builds submit --tag $IMAGE_URI vertex_ai/sam_server --project=$PROJECT_ID

# 4. Upload Model to Vertex AI
echo "Uploading model to Vertex AI..."
# Check if model already exists to avoid duplicates
EXISTING_MODEL_ID=$(gcloud ai models list --region=$REGION --filter="display_name=$MODEL_DISPLAY_NAME" --sort-by="~createTime" --limit=1 --format="value(name)" --project=$PROJECT_ID)

if [ -z "$EXISTING_MODEL_ID" ]; then
    gcloud ai models upload \
        --region=$REGION \
        --display-name=$MODEL_DISPLAY_NAME \
        --container-image-uri=$IMAGE_URI \
        --container-predict-route="/predict" \
        --container-health-route="/health" \
        --container-ports=8080 \
        --project=$PROJECT_ID
else
    echo "Model $MODEL_DISPLAY_NAME already exists. Using existing model."
fi

# Get the Model ID
MODEL_ID=$(gcloud ai models list --region=$REGION --filter="display_name=$MODEL_DISPLAY_NAME" --sort-by="~createTime" --limit=1 --format="value(name)" --project=$PROJECT_ID)
echo "Model ID: $MODEL_ID"

# 5. Create Endpoint
echo "Creating Endpoint..."
EXISTING_ENDPOINT_ID=$(gcloud ai endpoints list --region=$REGION --filter="display_name=$ENDPOINT_DISPLAY_NAME" --sort-by="~createTime" --limit=1 --format="value(name)" --project=$PROJECT_ID)

if [ -z "$EXISTING_ENDPOINT_ID" ]; then
    gcloud ai endpoints create \
        --region=$REGION \
        --display-name=$ENDPOINT_DISPLAY_NAME \
        --project=$PROJECT_ID
else
    echo "Endpoint $ENDPOINT_DISPLAY_NAME already exists. Using existing endpoint."
fi

# Get Endpoint ID
ENDPOINT_ID=$(gcloud ai endpoints list --region=$REGION --filter="display_name=$ENDPOINT_DISPLAY_NAME" --sort-by="~createTime" --limit=1 --format="value(name)" --project=$PROJECT_ID)
echo "Endpoint ID: $ENDPOINT_ID"

# 6. Deploy Model to Endpoint (Scale to Zero)
echo "Deploying model to endpoint with Scale-to-Zero..."
# Using g2-standard-4 (L4 GPU) which is cost effective and supports SAM 2
# Note: min-replica-count=0 requires beta?
gcloud beta ai endpoints deploy-model $ENDPOINT_ID \
    --region=$REGION \
    --model=$MODEL_ID \
    --display-name="sam-2-deployment" \
    --machine-type="g2-standard-4" \
    --accelerator-type="NVIDIA_L4" \
    --accelerator-count=1 \
    --min-replica-count=0 \
    --max-replica-count=1 \
    --traffic-split=0=100 \
    --project=$PROJECT_ID

echo "✅ Deployment complete!"
echo "Endpoint ID: $ENDPOINT_ID"
