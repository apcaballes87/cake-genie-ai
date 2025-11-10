// Test script to check if the application loads properly
const http = require('http');

// Test accessing the local development server
console.log('Testing local development server at http://localhost:5173');

// Make a request to the local server
http.get('http://localhost:5173', (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} characters`);
    if (data.includes('<title>Genie</title>')) {
      console.log('✅ Application title found');
    } else {
      console.log('❌ Application title not found');
    }
    
    if (data.includes('id="root"')) {
      console.log('✅ Root element found');
    } else {
      console.log('❌ Root element not found');
    }
    
    // Check for common React errors
    if (data.includes('Error') || data.includes('Failed')) {
      console.log('⚠️  Possible errors found in response');
    }
  });
}).on('error', (err) => {
  console.error('❌ Error accessing local server:', err.message);
});

// Test accessing the production site
console.log('\nTesting production site at https://www.genie.ph');

// Note: For HTTPS requests, we would need to use the 'https' module
// This is just a placeholder for the concept
console.log('To test the production site, open https://www.genie.ph in your browser and check the console for errors.');