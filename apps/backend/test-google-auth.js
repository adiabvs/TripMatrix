/**
 * Test script to verify Google Service Account credentials
 * Run with: node test-google-auth.js
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend .env file
dotenv.config({ path: join(__dirname, '.env') });

// Also try loading from root .env if backend .env doesn't exist
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

console.log('=== Google Service Account Test ===\n');

// Check if credentials are set
if (!serviceAccountEmail || !serviceAccountPrivateKey) {
  console.error('❌ Missing credentials!');
  console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL:', serviceAccountEmail ? '✅ Set' : '❌ Missing');
  console.error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:', serviceAccountPrivateKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

console.log('✅ Credentials found');
console.log('Email:', serviceAccountEmail);
console.log('Private Key Length:', serviceAccountPrivateKey.length);
console.log('Private Key Starts:', serviceAccountPrivateKey.substring(0, 30) + '...');
console.log('Private Key Has Newlines:', serviceAccountPrivateKey.includes('\\n') ? 'Yes (escaped)' : 'No');

// Clean up private key
let cleanedKey = serviceAccountPrivateKey;
cleanedKey = cleanedKey.replace(/\\n/g, '\n');

if (!cleanedKey.includes('BEGIN PRIVATE KEY')) {
  console.error('❌ Invalid private key format!');
  console.error('Key should start with: -----BEGIN PRIVATE KEY-----');
  process.exit(1);
}

console.log('\n✅ Private key format looks correct\n');

// Initialize auth
console.log('Initializing Google Auth...');
const auth = new JWT({
  email: serviceAccountEmail,
  key: cleanedKey,
  scopes: [
    'https://www.googleapis.com/auth/presentations', // Required for Slides API
    'https://www.googleapis.com/auth/drive.file',    // Allows read/write access to files created by the app
    'https://www.googleapis.com/auth/drive',         // Required for moving files to shared folders
  ],
});

// Test 1: Check if we can authenticate
console.log('Test 1: Authentication...');
try {
  await auth.authorize();
  console.log('✅ Authentication successful!\n');
} catch (error) {
  console.error('❌ Authentication failed!');
  console.error('Error:', error.message);
  if (error.message.includes('invalid_grant')) {
    console.error('\n💡 This usually means:');
    console.error('   - Private key is incorrect or expired');
    console.error('   - Service account was deleted');
    console.error('   - Key was regenerated and old key is invalid');
  }
  process.exit(1);
}

// Test 2: Check if Google Slides API is accessible
console.log('Test 2: Google Slides API...');
try {
  const slides = google.slides({ version: 'v1', auth });
  const result = await slides.presentations.create({
    requestBody: {
      title: 'Test Presentation - ' + new Date().toISOString(),
    },
  });
  console.log('✅ Google Slides API works!');
  console.log('   Presentation ID:', result.data.presentationId);
  
  // Clean up - delete test presentation
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId: result.data.presentationId });
  console.log('   Test presentation deleted\n');
} catch (error) {
  console.error('❌ Google Slides API failed!');
  console.error('Error:', error.message);
  if (error.response?.data) {
    console.error('Details:', JSON.stringify(error.response.data, null, 2));
  }
  
  if (error.message.includes('permission') || error.message.includes('Permission')) {
    console.error('\n💡 This usually means:');
    console.error('   - Google Slides API might not be enabled, OR');
    console.error('   - Service account lacks IAM permissions');
    console.error('\n   Try these steps:');
    console.error('   1. Enable API: https://console.cloud.google.com/apis/library/slides.googleapis.com?project=tripmatrix-480914');
    console.error('   2. Grant IAM role: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
    console.error(`      - Find service account: ${serviceAccountEmail}`);
    console.error('      - Click "GRANT ACCESS" or "ADD ANOTHER ROLE"');
    console.error('      - Grant "Editor" or "Owner" role');
    console.error('   3. Wait 1-2 minutes and try again');
    console.error('\n   📖 See FIX_IAM_PERMISSIONS_NOW.md for detailed step-by-step instructions');
  }
  process.exit(1);
}

// Test 3: Check if Google Drive API is accessible
console.log('Test 3: Google Drive API...');
try {
  const drive = google.drive({ version: 'v3', auth });
  const result = await drive.files.list({
    pageSize: 1,
    fields: 'files(id, name)',
  });
  console.log('✅ Google Drive API works!');
  console.log('   Can access Drive files\n');
} catch (error) {
  console.error('❌ Google Drive API failed!');
  console.error('Error:', error.message);
  if (error.response?.data) {
    console.error('Details:', JSON.stringify(error.response.data, null, 2));
  }
  
  if (error.message.includes('permission') || error.message.includes('Permission')) {
    console.error('\n💡 This usually means:');
    console.error('   - Google Drive API is not enabled');
    console.error('   - Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tripmatrix-480914');
    console.error('   - Click "Enable"');
    console.error('   - Wait 1-2 minutes and try again');
  }
  process.exit(1);
}

// Test 4: Check folder access (if folder ID is provided)
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
if (folderId) {
  console.log('Test 4: Google Drive Folder Access...');
  try {
    const drive = google.drive({ version: 'v3', auth });
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, permissions',
    });
    console.log('✅ Folder access works!');
    console.log('   Folder Name:', folder.data.name);
    console.log('   Folder ID:', folder.data.id);
    
    // Check if service account has access
    const permissions = folder.data.permissions || [];
    const hasAccess = permissions.some((p) => 
      p.emailAddress === serviceAccountEmail || 
      p.type === 'user' && p.emailAddress === serviceAccountEmail
    );
    
    if (hasAccess) {
      console.log('   ✅ Service account has access to folder');
    } else {
      console.log('   ⚠️  Service account might not have explicit access');
      console.log('   💡 Share the folder with:', serviceAccountEmail);
    }
    console.log();
  } catch (error) {
    console.error('❌ Folder access failed!');
    console.error('Error:', error.message);
    if (error.message.includes('not found')) {
      console.error('\n💡 Folder not found or service account does not have access');
      console.error('   Share the folder with:', serviceAccountEmail);
    }
    // Don't exit - folder is optional
  }
}

console.log('=== All Tests Passed! ===');
console.log('\n✅ Your Google Service Account is configured correctly!');
console.log('✅ You can now generate travel diaries.');

