# Genie 🎂✨

Welcome to Genie, the AI-powered cake customization platform. Find any cake design, use AI to customize it, and get an instant, rule-based price estimate.

## 🚀 Getting Started

This project is a Vite-based React application that uses Supabase for its backend and the Google Gemini API for AI features.

### 1. Environment Variables

This project requires certain secrets to be configured in your Vercel project's environment variables. Public, non-sensitive keys are already included in the source code.

**Go to your Vercel Project > Settings > Environment Variables and add the following:**

| Name                      | Value                            | Description                                       |
| ------------------------- | -------------------------------- | ------------------------------------------------- |
| `API_KEY`                 | Your Google Gemini API Key       | **Required for all AI features.**                      |
| `XENDIT_SECRET_KEY`       | Your Xendit Secret Key           | **Required for Supabase payment functions.**       |
| `SUPABASE_SERVICE_ROLE_KEY`| Your Supabase Service Role Key | **Required for Supabase server-side functions.** |

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

## 📦 Deployment

This project is optimized for deployment on **Vercel**.

1.  **Import Project**: Import your GitHub repository into Vercel. It will be automatically detected as a Vite project.
2.  **Configure Environment Variables**: As described in the section above, add your secret keys to the Vercel project settings.
3.  **Deploy**: Vercel will automatically build and deploy the application. Subsequent pushes to your main branch will trigger new deployments.
