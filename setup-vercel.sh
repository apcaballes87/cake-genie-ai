#!/bin/bash

# Script to help set up Vercel deployment

echo "=== Cake Genie Vercel Setup Script ==="
echo ""

echo "This script will help you set up Vercel deployment for your Cake Genie application."
echo ""

echo "Step 1: Installing Vercel CLI (if not already installed)"
npm install -g vercel

echo ""
echo "Step 2: Logging in to Vercel"
echo "Please follow the prompts to log in to your Vercel account."
vercel login

echo ""
echo "Step 3: Setting up the project"
echo "Navigate to your project directory and run:"
echo "cd /Users/apcaballes/copy-of-cake-genie"
echo ""
echo "Then run:"
echo "vercel"
echo ""
echo "When prompted, use these settings:"
echo "  - Set up and deploy? Yes"
echo "  - Which scope? Your personal account"
echo "  - Link to existing project? No"
echo "  - What's your project's name? cake-genie-ai"
echo "  - In which directory is your code located? ./"
echo "  - Want to override the settings? No"
echo "  - Configure additional settings? Yes"
echo "  - In which directory are the build artifacts? dist"
echo ""
echo "After the initial setup, you'll need to add your environment variables:"
echo "  - Key: GEMINI_API_KEY"
echo "  - Value: Your actual Google Gemini API key"
echo ""
echo "Then deploy to production:"
echo "vercel --prod"
echo ""
echo "For future updates, just run:"
echo "vercel --prod"
echo ""
echo "Setup complete! Follow the instructions above to complete the Vercel setup."