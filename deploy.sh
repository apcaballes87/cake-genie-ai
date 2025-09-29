#!/bin/bash

# Deployment script for Cake Genie app to Vercel

echo "=== Cake Genie Deployment Script ==="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "Vercel CLI is not installed."
    echo "Installing Vercel CLI..."
    npm install -g vercel
    echo ""
fi

echo "Vercel CLI is installed. Proceeding with deployment..."
echo ""

# Make sure we're in the right directory
cd /Users/apcaballes/copy-of-cake-genie

echo "Current directory: $(pwd)"
echo ""

# Build the project
echo "Building the Cake Genie application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    
    echo "Deploying to Vercel..."
    echo "Follow the prompts to set up your project with Vercel."
    echo "When asked, use these settings:"
    echo "  - Set up and deploy? Yes"
    echo "  - Which scope? Your personal account"
    echo "  - Link to existing project? No"
    echo "  - What's your project's name? cake-genie"
    echo "  - In which directory is your code located? ./"
    echo "  - Want to override the settings? No"
    echo ""
    echo "Press Ctrl+C if you need to stop the deployment."
    echo ""
    
    # Deploy using Vercel CLI
    vercel --prod
    
    echo ""
    echo "Deployment completed!"
    echo "Your application is now deployed to Vercel."
else
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi