// Script to test if the API keys are valid
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

console.log('=== Checking API Keys ===');

// Check Gemini API Key
const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
console.log('\n1. Gemini API Key Check:');

if (!geminiApiKey) {
  console.error('❌ Error: VITE_GEMINI_API_KEY is not set in environment variables');
  console.log('Please add your actual Gemini API key to .env.local');
} else if (geminiApiKey === 'your_actual_gemini_api_key_here') {
  console.error('❌ Error: VITE_GEMINI_API_KEY is still set to the placeholder value');
  console.log('Please replace "your_actual_gemini_api_key_here" with your actual API key in .env.local');
} else {
  console.log('✅ Gemini API key found in environment variables');
  console.log('Testing Gemini API key validity...');
  
  // Test the API key with a simple request
  fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
  )
  .then(response => {
    if (response.ok) {
      console.log('✅ Gemini API key is valid!');
      console.log('Test response received successfully');
    } else {
      return response.json().then(data => {
        console.error('❌ Gemini API key is invalid or there was an error:');
        console.error('Status:', response.status);
        console.error('Message:', data.error?.message || 'Unknown error');
      });
    }
  })
  .catch(error => {
    console.error('❌ Error testing Gemini API key:', error.message);
  });
}

// Check Google Maps API Key
const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
console.log('\n2. Google Maps API Key Check:');

if (!googleMapsApiKey) {
  console.error('❌ Error: VITE_GOOGLE_MAPS_API_KEY is not set in environment variables');
  console.log('Please add your actual Google Maps API key to .env.local');
} else if (googleMapsApiKey === 'your_actual_google_maps_api_key_here') {
  console.error('❌ Error: VITE_GOOGLE_MAPS_API_KEY is still set to the placeholder value');
  console.log('Please replace "your_actual_google_maps_api_key_here" with your actual API key in .env.local');
} else {
  console.log('✅ Google Maps API key found in environment variables');
  console.log('Note: Google Maps API key validation requires a browser environment');
  console.log('You can test it by opening the app and checking for map functionality');
}

console.log('\n=== API Key Check Complete ===');