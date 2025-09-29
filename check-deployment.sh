#!/bin/bash

# Script to verify deployment readiness

echo "=== Cake Genie Deployment Verification ==="
echo ""

echo "1. Checking current directory..."
cd /Users/apcaballes/copy-of-cake-genie
pwd
echo ""

echo "2. Checking Git status..."
git status
echo ""

echo "3. Verifying build..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

echo "4. Checking for required files..."
REQUIRED_FILES=(
    "package.json"
    "vite.config.ts"
    "index.html"
    "App.tsx"
    "vercel.json"
    "README.md"
    "LICENSE"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file found"
    else
        echo "❌ $file missing"
    fi
done
echo ""

echo "5. Checking for required directories..."
REQUIRED_DIRS=(
    "components"
    "services"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir directory found"
    else
        echo "❌ $dir directory missing"
    fi
done
echo ""

echo "=== Deployment Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Upload to GitHub (follow DEPLOYMENT-GUIDE.md)"
echo "2. Connect to Vercel"
echo "3. Add your custom domain genie.ph"
echo "4. Configure environment variables"