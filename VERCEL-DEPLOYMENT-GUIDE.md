# Vercel Deployment Guide for Cake Genie

This guide will walk you through deploying your Cake Genie application to Vercel and setting up your custom domain.

## Prerequisites

1. Your code is already on GitHub at: https://github.com/apcaballes87/cake-genie-ai
2. You have a Vercel account (free available at [vercel.com](https://vercel.com))
3. You have your Google Gemini API key

## Deployment Steps

### Step 1: Connect GitHub Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and log in to your account
2. Click "New Project"
3. Find your "cake-genie-ai" repository and click "Import"
4. Vercel will automatically detect this is a Vite project
5. In the configuration section:
   - Leave the Project Name as "cake-genie-ai" (or change if desired)
   - Ensure the Framework Preset is set to "Vite"
   - Root Directory should be "."
   - Build and Output Settings should be automatically detected
6. Click "Deploy"

### Step 2: Configure Environment Variables

During the deployment process or after deployment:

1. Go to your project dashboard in Vercel
2. Click "Settings" → "Environment Variables"
3. Add your Gemini API key:
   - Key: `GEMINI_API_KEY`
   - Value: Your actual API key from Google AI Studio
4. Click "Add"
5. Redeploy your project for the changes to take effect

### Step 3: Add Custom Domain (genie.ph)

1. In your Vercel project dashboard, go to "Settings" → "Domains"
2. Click "Add Domain"
3. Enter `genie.ph` and click "Add"
4. Vercel will provide DNS configuration instructions
5. Log in to your domain registrar (where you purchased genie.ph)
6. Add the DNS records as provided by Vercel:
   - Usually A records pointing to Vercel's IP addresses
   - Or a CNAME record if using a subdomain

### Step 4: Using the Deployment Script

You can also deploy using the command line with the provided script:

1. Make sure you have Vercel CLI installed:
   ```bash
   npm install -g vercel
   ```

2. Run the deployment script:
   ```bash
   cd /Users/apcaballes/copy-of-cake-genie
   ./deploy.sh
   ```

3. Follow the prompts to configure your project with Vercel

## Environment Variables Required

For your application to work properly, you must set the following environment variable in Vercel:

- `GEMINI_API_KEY`: Your Google Gemini API key for AI features

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Ensure `GEMINI_API_KEY` is correctly set in Vercel environment variables
   - Check that your API key has the necessary permissions
   - Redeploy after adding environment variables

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
3. Vercel will automatically deploy the new version (if auto-deploy is enabled)
4. Or manually trigger a deployment from the Vercel dashboard

## Additional Resources

- [Google AI Studio](https://aistudio.google.com/) - For managing your Gemini API key
- [Vercel Documentation](https://vercel.com/docs) - For advanced configuration
- [GitHub Repository](https://github.com/apcaballes87/cake-genie-ai) - Your code repository