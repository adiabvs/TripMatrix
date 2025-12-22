// Quick test to verify Canva routes are accessible
const http = require('http');

const testRoute = (path, method = 'GET') => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail auth, but we're just checking if route exists
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
};

(async () => {
  console.log('Testing Canva routes...\n');

  try {
    // Test /api/canva/token (will fail auth, but should not be 404)
    console.log('Testing GET /api/canva/token...');
    const tokenResult = await testRoute('/api/canva/token');
    console.log(`Status: ${tokenResult.status}`);
    if (tokenResult.status === 404) {
      console.log('❌ Route not found! Check if backend server is running and routes are registered.');
    } else if (tokenResult.status === 401) {
      console.log('✅ Route exists! (401 is expected without auth token)');
    } else {
      console.log(`✅ Route exists! Status: ${tokenResult.status}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running!');
      console.log('   Start it with: cd apps/backend && pnpm dev');
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  try {
    // Test /api/canva/auth
    console.log('\nTesting GET /api/canva/auth...');
    const authResult = await testRoute('/api/canva/auth');
    console.log(`Status: ${authResult.status}`);
    if (authResult.status === 404) {
      console.log('❌ Route not found!');
    } else {
      console.log(`✅ Route exists! Status: ${authResult.status}`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
})();






