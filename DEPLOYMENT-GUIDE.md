# Complete Deployment Guide: GitHub + Vercel + Custom Domain

This guide will walk you through deploying your Cake Genie application to GitHub, then to Vercel, and finally connecting your custom domain genie.ph.

## Prerequisites

Before starting, you'll need:
1. A GitHub account
2. A Vercel account
3. Access to your domain registrar (where you purchased genie.ph)
4. Your Google Gemini API key

## Step 1: Upload to GitHub

### 1.1 Create a GitHub Repository

1. Go to [github.com](https://github.com) and log in
2. Click the "+" icon in the top right corner and select "New repository"
3. Fill in the details:
   - Repository name: `cake-genie`
   - Description: "AI-powered cake design application"
   - Public or Private: Your choice
   - **IMPORTANT**: Leave all checkboxes unchecked (no README, .gitignore, or license)
4. Click "Create repository"

### 1.2 Connect Your Local Repository

After creating the repository, you'll see a page with setup instructions. Note the repository URL, which will look like:
`https://github.com/YOUR_USERNAME/cake-genie.git`

In your terminal, run these commands:
```bash
cd /Users/apcaballes/copy-of-cake-genie
git remote set-url origin https://github.com/YOUR_USERNAME/cake-genie.git
git branch -M main
git push -u origin main
```

If you prefer SSH (more secure):
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/cake-genie.git
git push -u origin main
```

## Step 2: Deploy to Vercel

### 2.1 Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and log in
2. Click "New Project"
3. Find your `cake-genie` repository and click "Import"
4. Vercel will automatically detect this is a Vite project
5. Click "Deploy"

### 2.2 Configure Environment Variables

1. After deployment starts, click "Environment Variables" in the deployment settings
2. Add your Gemini API key:
   - Key: `GEMINI_API_KEY`
   - Value: Your actual API key from Google AI Studio
3. Click "Add"

If you missed this step during initial deployment:
1. Go to your project dashboard in Vercel
2. Click "Settings" → "Environment Variables"
3. Add the variable as described above
4. Redeploy your project

## Step 3: Add Custom Domain (genie.ph)

### 3.1 Add Domain in Vercel

1. In your Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Click "Add Domain"
4. Enter `genie.ph` and click "Add"

### 3.2 Configure DNS Records

Vercel will provide DNS configuration instructions. It will typically be one of two options:

**Option A: Using A Records (most common)**
- Add A records pointing to Vercel's IP addresses:
  - Name: @ (or leave blank)
  - Type: A
  - Value: 76.76.21.21
- Add another A record:
  - Name: @ (or leave blank)
  - Type: A
  - Value: 76.76.21.22

**Option B: Using CNAME Record**
- Add a CNAME record:
  - Name: @ (or leave blank)
  - Type: CNAME
  - Value: cname.vercel-dns.com

### 3.3 Configure DNS with Your Domain Registrar

1. Log in to your domain registrar's control panel (where you purchased genie.ph)
2. Find the DNS management section
3. Add the DNS records as provided by Vercel
4. Save the changes

DNS propagation typically takes a few minutes to several hours.

## Step 4: Verify Deployment

1. Once DNS propagates, visit `https://genie.ph`
2. Your Cake Genie application should be live!
3. Test all functionality:
   - Image uploads
   - AI features
   - Pricing calculations

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Ensure `GEMINI_API_KEY` is correctly set in Vercel environment variables
   - Check that your API key has the necessary permissions

2. **Domain Not Resolving**
   - Wait for DNS propagation (can take up to 48 hours)
   - Verify DNS records are correctly set
   - Use `nslookup genie.ph` to check DNS resolution

3. **Build Failures**
   - Check Vercel logs for specific error messages
   - Ensure all dependencies are in package.json

### Getting Help

- Check Vercel documentation: [https://vercel.com/docs](https://vercel.com/docs)
- GitHub repository issues
- Contact your domain registrar's support if DNS issues persist

## Future Updates

To update your deployed application:

1. Make changes to your local code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```
3. Vercel will automatically deploy the new version

## Additional Resources

- [Google AI Studio](https://aistudio.google.com/) - For managing your Gemini API key
- [Vercel Documentation](https://vercel.com/docs) - For advanced configuration
- [GitHub Documentation](https://docs.github.com/) - For repository management