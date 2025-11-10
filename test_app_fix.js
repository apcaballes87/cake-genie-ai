// Test script to verify the app fix
const http = require('http');

console.log('Testing if the app fix worked...');

// Test accessing the local development server
http.get('http://localhost:5173', (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} characters`);
    
    // Check if we're getting the main app content instead of the test component
    if (data.includes('Genie') && data.includes('id="root"')) {
      console.log('✅ App appears to be loading correctly');
      
      // Check if we're not seeing the test component
      if (!data.includes('Gemini API Test')) {
        console.log('✅ Test component is not visible (this is good)');
      } else {
        console.log('❌ Test component is still visible');
      }
    } else {
      console.log('❌ App may not be loading correctly');
    }
  });
}).on('error', (err) => {
  console.error('❌ Error accessing local server:', err.message);
});

console.log('Please also check http://localhost:5173 in your browser to verify the fix.');