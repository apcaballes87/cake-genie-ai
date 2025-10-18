# 🎂 Cake Genie - Production Build

This is the production-ready version of the Cake Genie application. It uses Vite for building, bundling, and serving the application.

## Description

Cake Genie allows users to find any cake design through web search, then use generative AI to customize its decorations (toppers, colors, icing, etc.) and get an instant, rule-based price estimate for the final design.

## Project Setup

Follow these steps to run the project locally.

### 1. Install Dependencies
You need to have Node.js and npm installed.

```bash
npm install
```

### 2. Configure Environment Variables
Create a new file named `.env` in the root of the project by copying the example file:

```bash
cp .env.example .env
```

Now, open the `.env` file and add your credentials:
- `VITE_GEMINI_API_KEY`: Your API key from Google AI Studio.
- `VITE_SUPABASE_URL`: Your project URL from the Supabase dashboard.
- `VITE_SUPABASE_ANON_KEY`: Your `anon` (public) key from the Supabase dashboard.

### 3. Run the Development Server
This command starts the Vite development server, usually on `http://localhost:5173`.

```bash
npm run dev
```

## Building for Production

To create an optimized production build:

```bash
npm run build
```

The output files will be generated in the `/dist` directory. You can preview the production build locally with:

```bash
npm run preview
```

## Deployment

This project is a static site and can be deployed to any modern hosting provider like Vercel, Netlify, or Cloudflare Pages.

### Example: Deploying to Vercel

1.  **Push to GitHub:** Make sure your project is in a GitHub repository.
2.  **Import Project in Vercel:** Log in to Vercel and import your GitHub repository.
3.  **Configure Build Settings:** Vercel will likely detect this as a Vite project automatically. If not, use these settings:
    - **Framework Preset:** `Vite`
    - **Build Command:** `npm run build`
    - **Output Directory:** `dist`
4.  **Add Environment Variables:** In your Vercel project's settings, go to "Environment Variables" and add the same keys and values from your `.env` file (`VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5.  **Deploy:** Click the "Deploy" button.
After completing all these steps, the project will be fully configured for a professional development workflow and easy deployment. You can now install dependencies, create a local .env file with your keys, and run npm run dev to test it. Once confirmed, the project is ready to be pushed to GitHub.