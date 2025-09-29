// Simple test script to verify environment variables
console.log('Testing environment variables...');

// Check if API_KEY is set
if (process.env.API_KEY) {
  console.log('✅ API_KEY is set');
  console.log('API_KEY length:', process.env.API_KEY.length);
} else {
  console.log('❌ API_KEY is not set');
}

// Check if GEMINI_API_KEY is set
if (process.env.GEMINI_API_KEY) {
  console.log('✅ GEMINI_API_KEY is set');
  console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY.length);
} else {
  console.log('❌ GEMINI_API_KEY is not set');
}

console.log('Environment test complete.');