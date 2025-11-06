# Genie.ph API Key Setup Guide

## Step-by-Step Instructions

### 1. Get Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API key" or copy an existing one
4. Save the API key in a secure location

### 2. Configure Your Environment

1. Open the `.env.local` file in your project directory
2. Replace `your_actual_gemini_api_key_here` with your actual API key
3. Save the file

Example of a properly configured `.env.local`:
```
# Google Gemini API Key
VITE_GEMINI_API_KEY=AIzaSyB5V2Ojf3R4u8abcdefg1234567890XYZ

# Other configurations...
```

### 3. Restart Development Server

1. Stop the current server (Ctrl+C)
2. Run `npm run dev` to start the server again

### 4. Test the Application

1. Open your browser to http://localhost:5178
2. Try uploading a cake image
3. The AI validation should now work properly

## Troubleshooting

If you still see API key errors:

1. **Check the API key format**: It should start with "AIzaSy" and be about 39 characters long
2. **Verify no extra spaces**: Make sure there are no spaces before or after the key
3. **Restart the server**: Changes to .env files require a server restart
4. **Check browser cache**: Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)

## Security Best Practices

- Never commit `.env.local` to Git (it's already in `.gitignore`)
- Keep API keys private and never share them
- Rotate API keys periodically for security
- Monitor API usage in the Google AI Studio dashboard