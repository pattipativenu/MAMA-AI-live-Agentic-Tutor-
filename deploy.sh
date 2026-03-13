#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
PROJECT_ID="mama-ai-487817"
SERVICE_NAME="mama-ai-service"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "===================================================="
echo "🚀 Starting Automated Deployment for Mama AI..."
echo "===================================================="

# 1. Build and push the Docker image using Google Cloud Build
echo "Building Docker image and pushing to Container Registry..."
gcloud builds submit --tag $IMAGE_NAME --project $PROJECT_ID

# 2. Deploy the image to Google Cloud Run
echo "Deploying to Google Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --project $PROJECT_ID \
  --port 8080 

echo "===================================================="
echo "✅ Deployment Successful!"
echo "===================================================="
