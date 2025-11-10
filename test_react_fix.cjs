// Test script to verify the React fix
const http = require('http');

console.log('Testing if the React fix worked...');

// Test accessing the local development server
http.get('http://localhost:5173', (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} characters`);
    
    // Check if we're getting the main app content
    if (data.includes('Genie') && data.includes('id="root"')) {
      console.log('✅ App appears to be loading correctly');
      
      // Check if we're not seeing the test component
      if (!data.includes('Gemini API Test')) {
        console.log('✅ Test component is not visible (this is good)');
      } else {
        console.log('⚠️  Test component is still visible');
      }
      
      // Check if React is properly loaded
      if (data.includes('react') && data.includes('react-dom')) {
        console.log('✅ React libraries are being loaded');
      } else {
        console.log('❌ React libraries may not be loading correctly');
      }
    } else {
      console.log('❌ App may not be loading correctly');
    }
  });
}).on('error', (err) => {
  console.error('❌ Error accessing local server:', err.message);
});

console.log('Please also check http://localhost:5173 in your browser to verify the fix.');