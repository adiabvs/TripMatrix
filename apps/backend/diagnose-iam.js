/**
 * Diagnostic script to check IAM permissions and project configuration
 * This helps identify why the service account doesn't have permission
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

console.log('=== IAM Diagnostic Tool ===\n');
console.log('Service Account:', serviceAccountEmail);
console.log('Project ID: tripmatrix-480914\n');

if (!serviceAccountEmail || !serviceAccountPrivateKey) {
  console.error('❌ Missing credentials!');
  process.exit(1);
}

const auth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
});

try {
  await auth.authorize();
  console.log('✅ Authentication successful\n');
} catch (error) {
  console.error('❌ Authentication failed:', error.message);
  process.exit(1);
}

// Try to get project info
console.log('Checking project access...');
try {
  const cloudResourceManager = google.cloudresourcemanager({ version: 'v1', auth });
  const project = await cloudResourceManager.projects.get({
    projectId: 'tripmatrix-480914',
  });
  console.log('✅ Can access project:', project.data.name);
  console.log('   Project Number:', project.data.projectNumber);
} catch (error) {
  console.error('❌ Cannot access project:', error.message);
  console.error('   This might indicate IAM permission issues\n');
}

// Check if APIs are enabled
console.log('\nChecking if APIs are enabled...');
try {
  const serviceUsage = google.serviceusage({ version: 'v1', auth });
  
  const slidesApi = await serviceUsage.services.get({
    name: 'projects/tripmatrix-480914/services/slides.googleapis.com',
  });
  console.log('Google Slides API:', slidesApi.data.state === 'ENABLED' ? '✅ Enabled' : '❌ Disabled');
  
  const driveApi = await serviceUsage.services.get({
    name: 'projects/tripmatrix-480914/services/drive.googleapis.com',
  });
  console.log('Google Drive API:', driveApi.data.state === 'ENABLED' ? '✅ Enabled' : '❌ Disabled');
} catch (error) {
  console.error('❌ Cannot check API status:', error.message);
  console.error('   This might indicate the service account lacks "Service Usage Viewer" role');
}

// Try to test Slides API with more detailed error
console.log('\nTesting Google Slides API...');
try {
  const slides = google.slides({ version: 'v1', auth });
  const result = await slides.presentations.create({
    requestBody: {
      title: 'Diagnostic Test - ' + new Date().toISOString(),
    },
  });
  console.log('✅ Google Slides API works!');
  console.log('   Presentation ID:', result.data.presentationId);
  
  // Clean up
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId: result.data.presentationId });
  console.log('   Test presentation deleted');
} catch (error) {
  console.error('❌ Google Slides API failed!');
  console.error('Error Code:', error.code);
  console.error('Error Message:', error.message);
  
  if (error.response?.data) {
    const errorData = error.response.data;
    console.error('\nDetailed Error:');
    console.error(JSON.stringify(errorData, null, 2));
    
    if (errorData.error?.errors) {
      errorData.error.errors.forEach((err, i) => {
        console.error(`\nError ${i + 1}:`);
        console.error('  Domain:', err.domain);
        console.error('  Reason:', err.reason);
        console.error('  Message:', err.message);
      });
    }
  }
  
  console.error('\n🔍 Troubleshooting Steps:');
  console.error('1. Verify service account has "Editor" role:');
  console.error('   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
  console.error(`   Look for: ${serviceAccountEmail}`);
  console.error('   Should have role: "Editor" or "Owner"');
  console.error('\n2. If service account is NOT in the list:');
  console.error('   Click "GRANT ACCESS"');
  console.error(`   Add principal: ${serviceAccountEmail}`);
  console.error('   Select role: "Editor"');
  console.error('   Click "SAVE"');
  console.error('\n3. Verify APIs are enabled:');
  console.error('   Slides: https://console.cloud.google.com/apis/library/slides.googleapis.com?project=tripmatrix-480914');
  console.error('   Drive: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tripmatrix-480914');
  console.error('\n4. Wait 2-3 minutes after making changes');
  console.error('\n5. If still failing, try granting "Owner" role instead of "Editor"');
}

console.log('\n=== Diagnostic Complete ===');

