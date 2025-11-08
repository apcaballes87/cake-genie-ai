// Script to test if the Gemini API key is valid
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLocalPath = join(__dirname, '..', '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
}

// Get the API key
const apiKey = process.env.VITE_GEMINI_API_KEY;

console.log('Checking Gemini API key...');

if (!apiKey) {
  console.error('❌ Error: VITE_GEMINI_API_KEY is not set in environment variables');
  console.log('Please add your actual Gemini API key to .env.local');
  process.exit(1);
}

if (apiKey === 'your_actual_gemini_api_key_here') {
  console.error('❌ Error: VITE_GEMINI_API_KEY is still set to the placeholder value');
  console.log('Please replace "your_actual_gemini_api_key_here" with your actual API key in .env.local');
  process.exit(1);
}

console.log('✅ API key found in environment variables');
console.log('Testing API key validity...');

// Test the API key with a simple request
const testApiKey = async () => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hello, this is a test message to verify the API key.'
            }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API key is valid!');
      console.log('Test response received successfully');
    } else {
      console.error('❌ API key is invalid or there was an error:');
      console.error('Status:', response.status);
      console.error('Message:', data.error?.message || 'Unknown error');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error testing API key:', error.message);
    process.exit(1);
  }
};

testApiKey();