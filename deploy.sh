#!/bin/bash

# Deployment script for Cake Genie app to Vercel

echo "Building the Cake Genie application..."
npm run build

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Deploying to Vercel..."
    echo "Make sure you have Vercel CLI installed (npm install -g vercel)"
    echo "If this is your first time deploying, run 'vercel' to set up the project"
    echo "For subsequent deployments, run 'vercel --prod'"
else
    echo "Build failed. Please check the error messages above."
    exit 1
fi