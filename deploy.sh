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

# Vite bakes VITE_* into the JS bundle at Docker build time. Ensure env is present
# in the build context (.env and/or .env.local on disk when you run this script).
for envfile in .env .env.local; do
  if [ -f "$envfile" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$envfile"
    set +a
  fi
done
if [ -z "${VITE_FIREBASE_PROJECT_ID:-}" ]; then
  echo "ERROR: VITE_FIREBASE_PROJECT_ID is unset."
  echo "Create .env.local (see .env.example) in this directory before deploy, or export VITE_FIREBASE_* variables."
  echo "Cloud Run env vars alone cannot fix this: the browser bundle is built without them if env files are missing."
  exit 1
fi

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
