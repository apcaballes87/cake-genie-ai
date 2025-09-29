<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/11s6kTnh4EdzZcxKVqu-AB7IhjzYlFbgc

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

1. Sign up for a [Vercel account](https://vercel.com/signup)
2. Install Vercel CLI (optional but recommended):
   `npm install -g vercel`
3. Deploy using Vercel CLI:
   `vercel --prod`
   
   OR
   
   Deploy using the Vercel dashboard:
   1. Push your code to GitHub
   2. Connect your GitHub repository to Vercel
   3. Configure environment variables in Vercel project settings
   4. Add your domain in the Vercel dashboard

## Environment Variables

For deployment, you'll need to set the following environment variables in your deployment platform:

- `GEMINI_API_KEY` - Your Google Gemini API key

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/).