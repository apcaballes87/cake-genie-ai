// Script to test if the Google Maps API key is valid
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

console.log('=== Checking Google Maps API Key ===');

// Check Google Maps API Key
const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
console.log('\nGoogle Maps API Key Check:');

if (!googleMapsApiKey) {
  console.error('❌ Error: VITE_GOOGLE_MAPS_API_KEY is not set in environment variables');
  console.log('Please add your actual Google Maps API key to .env.local');
  process.exit(1);
} else if (googleMapsApiKey === 'your_actual_google_maps_api_key_here') {
  console.error('❌ Error: VITE_GOOGLE_MAPS_API_KEY is still set to the placeholder value');
  console.log('Please replace "your_actual_google_maps_api_key_here" with your actual API key in .env.local');
  process.exit(1);
} else {
  console.log('✅ Google Maps API key found in environment variables');
  console.log('Key: ' + googleMapsApiKey.substring(0, 10) + '...' + googleMapsApiKey.substring(googleMapsApiKey.length - 5));
  
  // Test the API key with a simple geocoding request to a known location in Cebu
  console.log('Testing Google Maps API key with geocoding request...');
  
  const testAddress = 'Cebu City, Philippines';
  const encodedAddress = encodeURIComponent(testAddress);
  
  fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`
  )
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error(`HTTP Error: ${response.status}`);
    }
  })
  .then(data => {
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log('✅ Google Maps API key is valid!');
      console.log('Test geocoding successful');
      console.log(`Found location: ${data.results[0].formatted_address}`);
    } else {
      console.error('❌ Google Maps API key test failed:');
      console.error('Status:', data.status);
      console.error('Message:', data.error_message || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('❌ Error testing Google Maps API key:', error.message);
  });
}

console.log('\n=== Google Maps API Key Check Complete ===');