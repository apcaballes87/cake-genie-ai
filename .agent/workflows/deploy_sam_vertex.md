---
description: How to deploy SAM 3 (Grounded SAM) to Google Vertex AI
---

# Deploy SAM 3 to Vertex AI

This workflow guides you through deploying the SAM 3 model to Google Vertex AI using the provided script.

## Prerequisites

- Google Cloud Project with billing enabled.
- `gcloud` CLI installed and authenticated.

## Steps

1. **Login to Google Cloud**
    Ensure you are authenticated with the correct account.

    ```bash
    gcloud auth login
    ```

2. **Set your Project ID**
    Replace `YOUR_PROJECT_ID` with your actual Google Cloud Project ID.

    ```bash
    gcloud config set project YOUR_PROJECT_ID
    ```

3. **Update Deployment Script**
    Open `vertex_ai/deploy_sam.sh` and update the `PROJECT_ID` variable at the top of the file to match your project ID.

    ```bash
    # Example:
    # PROJECT_ID="my-genie-project-123"
    ```

4. **Make Script Executable**

    ```bash
    chmod +x vertex_ai/deploy_sam.sh
    ```

5. **Run Deployment Script**
    This script will:
    - Enable necessary APIs.
    - Build the Docker image (with Grounding DINO and SAM 2).
    - Push the image to Artifact Registry.
    - Upload the model to Vertex AI.
    - Create an Endpoint.
    - Deploy the model to the Endpoint with **Scale-to-Zero** (0 min replicas) to save costs.

    *Note: This process can take 15-20 minutes.*

    ```bash
    ./vertex_ai/deploy_sam.sh
    ```

6. **Save Output Information**
    The script will output an **Endpoint ID** at the end. Save this!

7. **Configure Supabase Secrets**
    You need to add the following secrets to your Supabase project so the Edge Function can access Vertex AI.

    - `VERTEX_PROJECT_ID`: Your Google Cloud Project ID.
    - `VERTEX_ENDPOINT_ID`: The Endpoint ID from step 6.
    - `GCP_SERVICE_ACCOUNT`: A JSON string of a Service Account Key.

    **To get the Service Account Key:**
    1. Go to IAM & Admin > Service Accounts in GCP Console.
    2. Create a new service account (e.g., `vertex-ai-invoker`).
    3. Grant it the **Vertex AI User** role.
    4. Create a JSON key for this account and download it.
    5. Paste the content of the JSON file as the value for `GCP_SERVICE_ACCOUNT`.

    ```bash
    supabase secrets set VERTEX_PROJECT_ID=your-project-id
    supabase secrets set VERTEX_ENDPOINT_ID=your-endpoint-id
    supabase secrets set GCP_SERVICE_ACCOUNT='{...json_content...}'
    ```

8. **Deploy Edge Function**
    Finally, deploy the updated Edge Function.

    ```bash
    supabase functions deploy analyze-cake-v2
    ```
