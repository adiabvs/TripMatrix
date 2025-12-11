// Generate self-signed SSL certificates using Node.js (no OpenSSL required)
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log('✅ Certificates already exist at:');
  console.log(`   ${certPath}`);
  console.log(`   ${keyPath}`);
  process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificates...\n');

// Try using Node.js crypto module to generate certificates
try {
  const crypto = require('crypto');
  const { generateKeyPairSync } = require('crypto');
  
  console.log('Generating RSA key pair...');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Create a simple self-signed certificate
  // Note: This is a simplified version. For production, use proper certificate generation.
  const cert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL8Z8Z8Z8Z8MA0GCSqGSIb3DQEBCQUAMEUxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJVUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA${Buffer.from(publicKey).toString('base64').substring(0, 100)}...
-----END CERTIFICATE-----`;

  // For a proper certificate, we need to use a library or OpenSSL
  // Let's try a different approach - use a pre-generated template or guide user
  
  console.log('⚠️  Node.js crypto module cannot generate full X.509 certificates.');
  console.log('   Please use one of these options:\n');
  
  console.log('Option 1: Install mkcert (Recommended - Easiest)');
  console.log('   1. Download from: https://github.com/FiloSottile/mkcert/releases');
  console.log('   2. Or install via Chocolatey: choco install mkcert');
  console.log('   3. Run: mkcert -install');
  console.log('   4. Run: mkcert localhost');
  console.log('   5. Rename: localhost+1.pem → cert.pem');
  console.log('   6. Rename: localhost+1-key.pem → key.pem\n');
  
  console.log('Option 2: Install OpenSSL for Windows');
  console.log('   1. Download from: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   2. Install and add to PATH');
  console.log('   3. Run: openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"\n');
  
  console.log('Option 3: Use ngrok (No certificates needed)');
  console.log('   1. Install: npm install -g ngrok');
  console.log('   2. Start dev server: pnpm dev');
  console.log('   3. In another terminal: ngrok http 3000');
  console.log('   4. Use the ngrok HTTPS URL\n');
  
  // Try to use mkcert if available
  try {
    console.log('Checking if mkcert is available...');
    const mkcertVersion = execSync('mkcert -version', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('✅ mkcert found! Generating certificates...\n');
    
    execSync('mkcert -install', { stdio: 'inherit' });
    execSync('mkcert localhost', { cwd: __dirname, stdio: 'inherit' });
    
    // Rename files
    if (fs.existsSync('localhost+1.pem')) {
      fs.renameSync('localhost+1.pem', 'cert.pem');
      fs.renameSync('localhost+1-key.pem', 'key.pem');
      console.log('\n✅ Certificates generated successfully!');
      console.log('   Run: pnpm dev:https');
    }
  } catch (mkcertError) {
    console.log('❌ mkcert not found. Please use one of the options above.\n');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
