#!/bin/bash

# Firebase Storage CORS Configuration Script
# This script configures CORS rules for the Mama AI Firebase Storage bucket

echo "=================================="
echo "Firebase Storage CORS Setup"
echo "=================================="
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if user is logged in
echo "🔐 Checking Firebase login status..."
firebase login

echo ""
echo "📁 Applying CORS configuration..."
echo "   Allowing origins: http://localhost:3000, http://localhost:5173"
echo ""

# Apply CORS configuration
firebase storage:cors:set cors.json --project mama-ai-487817

echo ""
echo "=================================="
if [ $? -eq 0 ]; then
    echo "✅ CORS configuration applied successfully!"
    echo ""
    echo "You can now test chapter loading on localhost:3000"
else
    echo "❌ Failed to apply CORS configuration"
    echo ""
    echo "Try running manually:"
    echo "  firebase storage:cors:set cors.json --project mama-ai-487817"
fi
echo "=================================="
