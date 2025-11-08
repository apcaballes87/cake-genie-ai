# Genie 🎂✨

Welcome to Genie, the AI-powered cake customization platform. Find any cake design, use AI to customize it, and get an instant, rule-based price estimate.

## 🚀 Getting Started

This project is a Vite-based React application that uses Supabase for its backend and the Google Gemini API for AI features.

### 1. Environment Variables

To run this project, you need to set up your API keys and service URLs. These variables should be configured in your deployment environment (e.g., Vercel project settings or a `.env` file for local development if your setup supports it).

```
# Environment Variables

# Supabase Credentials (from your Supabase project settings > API)
SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_PUBLIC_KEY"

# Google Gemini API Key (from Google AI Studio)
API_KEY="YOUR_GEMINI_API_KEY"

# Google Maps API Key (from Google Cloud Console)
GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
```

**IMPORTANT:** Do not commit files containing secrets to your GitHub repository.

### 2. Local Development

To run the application on your local machine, follow these steps:

1.  **Install Dependencies**:
    If you don't have `pnpm` or `yarn`, you can use `npm`.
    ```bash
    npm install
    ```

2.  **Run the Development Server**:
    This will start the Vite development server, usually on `http://localhost:5173`.
    ```bash
    npm run dev
    ```

### 3. Building for Production

To create a production-ready build of your application:

```bash
npm run build
```

This will create a `dist` folder containing the optimized, static files for your application. You can preview the production build locally with `npm run preview`.

## 📦 Deployment to Vercel

This project is configured for seamless, automated deployments to Vercel from your GitHub repository.

### Setup Instructions:

1.  **Push to GitHub**: Make sure your project is uploaded to a GitHub repository.

2.  **Import Project in Vercel**:
    *   In your Vercel dashboard, click "Add New... > Project".
    *   Select your GitHub repository. Vercel will automatically detect that it is a Vite project.

3.  **Configure Project Settings**:
    *   **Framework Preset**: Should be automatically set to **Vite**. If not, select it.
    *   **Build Command**: Should be `npm run build` or `vite build`.
    *   **Output Directory**: Should be `dist`.

4.  **Add Environment Variables**:
    *   In your Vercel project's settings, go to the "Environment Variables" section.
    *   Add the same variables you defined for your environment. Make sure the names match exactly.

    | Name                      | Value                            |
    | ------------------------- | -------------------------------- |
    | `SUPABASE_URL`            | Your Supabase Project URL        |
    | `SUPABASE_ANON_KEY`       | Your Supabase Anon Public Key    |
    | `API_KEY`                 | Your Google Gemini API Key       |
    | `GOOGLE_MAPS_API_KEY`     | Your Google Maps API Key         |
    
    You also need to add your Xendit and other backend secrets that your Supabase Edge Functions use here.

5.  **Deploy**:
    *   Click the "Deploy" button. Vercel will build your project and deploy it.
    *   Future pushes to your main branch on GitHub will automatically trigger a new deployment on Vercel.The Problem: process.env in the Browser
process.env is a global variable provided by the Node.js runtime environment. It's the standard way to access environment variables on a server. Frontend build tools like Vite or Webpack can be configured to replace process.env.VAR_NAME with actual string values at build time, effectively injecting them into the client-side code before it's ever sent to the browser.
However, this application is designed to run directly in the browser without a build step, using ES modules and import maps to load dependencies from a CDN. In this "buildless" environment, there's no process to replace those variables, so process.env is simply undefined. When the code in your version tries to access process.env.SUPABASE_URL, it gets undefined, leading to the configuration errors you're seeing.
The Solution: Direct Configuration in config.ts
The version of the app you've provided me solves this by defining the configuration variables as hardcoded constants directly within the config.ts file.
Instead of this (your version):
code
TypeScript
// config.ts in your app
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
It uses this (the working version):
code
TypeScript
// config.ts in the working app
export const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co
";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks
";
export const GOOGLE_MAPS_API_KEY = "AIzaSyDThtN_G7khUxdZy6rVPgI0zpsyPS30ryE";
This approach is secure and appropriate for this specific application because the keys being stored (SUPABASE_ANON_KEY and GOOGLE_MAPS_API_KEY) are publicly accessible "anonymous" keys. They are designed to be used in client-side code and are protected by Supabase's Row Level Security (RLS) and Google Cloud's domain/API restrictions, respectively. You should never hardcode sensitive secret keys (like a database service role key) in this manner.
A Special Note on the Gemini API Key
You'll notice the Gemini API key is still handled via process.env.API_KEY in the working code. This is a special case. The execution environment (like Google's AI Studio, where this app is designed to run) securely injects just this one specific environment variable at runtime, making it available to the browser's JavaScript context. This is a platform-specific feature, not a general browser capability. For all other services like Supabase and Google Maps, we must use the direct configuration method.