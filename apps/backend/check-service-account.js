/**
 * Check service account IAM permissions
 * This helps verify if the service account has the right roles
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

console.log('=== Service Account Permission Check ===\n');
console.log('Service Account:', serviceAccountEmail);
console.log('\nTo grant permissions:');
console.log('1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
console.log('2. Find:', serviceAccountEmail);
console.log('3. Click Edit (pencil icon)');
console.log('4. Add role: "Editor" or "Owner"');
console.log('5. Save');
console.log('\n---\n');

// Test with a simpler scope first
console.log('Testing with minimal permissions...');
const auth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

try {
  await auth.authorize();
  console.log('✅ Can authenticate with cloud-platform scope');
  
  // Try to get project info
  const cloudResourceManager = google.cloudresourcemanager({ version: 'v1', auth });
  try {
    const project = await cloudResourceManager.projects.get({
      projectId: 'tripmatrix-480914',
    });
    console.log('✅ Can access project:', project.data.name);
  } catch (error) {
    console.log('❌ Cannot access project:', error.message);
    console.log('   This confirms IAM permissions are missing');
  }
} catch (error) {
  console.log('❌ Authentication failed:', error.message);
}

console.log('\n---\n');
console.log('Now testing Google Slides API...');

const slidesAuth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/presentations', // Required for Slides API
    'https://www.googleapis.com/auth/drive.file',    // Allows read/write access to files created by the app
    'https://www.googleapis.com/auth/drive',         // Required for moving files to shared folders
  ],
});

try {
  await slidesAuth.authorize();
  const slides = google.slides({ version: 'v1', auth: slidesAuth });
  
  // Try a simple read operation first
  console.log('Testing API access...');
  const result = await slides.presentations.create({
    requestBody: {
      title: 'Test - ' + Date.now(),
    },
  });
  
  console.log('✅ SUCCESS! Google Slides API works!');
  console.log('   Presentation ID:', result.data.presentationId);
  
  // Clean up
  const drive = google.drive({ version: 'v3', auth: slidesAuth });
  await drive.files.delete({ fileId: result.data.presentationId });
  console.log('   Test presentation deleted');
  
} catch (error) {
  console.log('❌ Google Slides API failed');
  console.log('   Error:', error.message);
  
  if (error.response?.data) {
    console.log('   Details:', JSON.stringify(error.response.data, null, 2));
  }
  
  console.log('\n💡 Solution:');
  console.log('   The service account needs IAM role "Editor" or "Owner"');
  console.log('   Grant it at: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
}

