#!/bin/bash

# Script to upload Cake Genie project to GitHub

echo "=== Cake Genie GitHub Upload Script ==="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null
then
    echo "Git is not installed. Please install Git first."
    exit 1
fi

echo "Git is installed. Proceeding..."
echo ""

# Make sure we're in the right directory
cd /Users/apcaballes/copy-of-cake-genie

echo "Current directory: $(pwd)"
echo ""

# Check if repository is already initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    echo ""
fi

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit."
else
    echo "Adding all files to Git..."
    git add .
    echo ""
    
    echo "Committing changes..."
    git commit -m "Initial commit: Cake Genie AI application"
    echo ""
fi

echo "=== GitHub Setup Instructions ==="
echo ""
echo "1. Go to https://github.com and log in to your account"
echo "2. Click the '+' icon in the top right corner and select 'New repository'"
echo "3. Name your repository (e.g., 'cake-genie')"
echo "4. Choose Public or Private"
echo "5. IMPORTANT: Do NOT initialize with README, .gitignore, or license"
echo "6. Click 'Create repository'"
echo ""
echo "After creating the repository, you'll get a URL like:"
echo "https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo ""
echo "Then run these commands in your terminal:"
echo "----------------------------------------"
echo "cd /Users/apcaballes/copy-of-cake-genie"
echo "git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo "git branch -M main"
echo "git push -u origin main"
echo "----------------------------------------"
echo ""
echo "If you prefer SSH (more secure):"
echo "git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git"
echo ""
echo "Done! Your repository is ready to be pushed to GitHub."