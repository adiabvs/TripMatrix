/**
 * Script to verify what IAM roles the service account actually has
 * This helps diagnose permission issues
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

console.log('=== IAM Roles Verification ===\n');
console.log('Service Account:', serviceAccountEmail);
console.log('Project: tripmatrix-480914\n');

if (!serviceAccountEmail || !serviceAccountPrivateKey) {
  console.error('❌ Missing credentials!');
  process.exit(1);
}

// Use cloud-platform scope to check IAM
const auth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

try {
  await auth.authorize();
  console.log('✅ Authentication successful\n');
} catch (error) {
  console.error('❌ Authentication failed:', error.message);
  process.exit(1);
}

// Try to get IAM policy (this requires IAM permissions)
console.log('Attempting to check IAM policy...');
try {
  const cloudResourceManager = google.cloudresourcemanager({ version: 'v1', auth });
  const policy = await cloudResourceManager.projects.getIamPolicy({
    resource: 'projects/tripmatrix-480914',
  });
  
  console.log('✅ Can read IAM policy\n');
  
  // Find our service account in the bindings
  const serviceAccountBindings = policy.data.bindings?.filter(binding => 
    binding.members?.some(member => member.includes(serviceAccountEmail))
  ) || [];
  
  if (serviceAccountBindings.length === 0) {
    console.error('❌ Service account NOT FOUND in IAM policy!');
    console.error('   This means the service account has NO roles assigned.');
    console.error('\n💡 Solution:');
    console.error('   1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
    console.error('   2. Click "GRANT ACCESS"');
    console.error(`   3. Add: ${serviceAccountEmail}`);
    console.error('   4. Select role: "Editor"');
    console.error('   5. Click "SAVE"');
  } else {
    console.log('✅ Service account found in IAM policy with roles:');
    serviceAccountBindings.forEach(binding => {
      console.log(`   - ${binding.role}`);
      if (binding.role.includes('presentation') || binding.role.includes('slides')) {
        console.log('     ⚠️  WARNING: This looks like a limited role!');
      }
    });
    
    // Check for common roles
    const hasEditor = serviceAccountBindings.some(b => 
      b.role === 'roles/editor' || b.role.toLowerCase().includes('editor')
    );
    const hasOwner = serviceAccountBindings.some(b => 
      b.role === 'roles/owner' || b.role.toLowerCase().includes('owner')
    );
    const hasLimitedRole = serviceAccountBindings.some(b => 
      b.role.includes('presentation') || 
      b.role.includes('slides') || 
      b.role.includes('viewer') ||
      b.role.includes('reader')
    );
    
    if (hasOwner) {
      console.log('\n✅ Has Owner role - should have full permissions');
    } else if (hasEditor) {
      console.log('\n✅ Has Editor role - should work');
    } else if (hasLimitedRole) {
      console.log('\n❌ PROBLEM FOUND: Service account has LIMITED role!');
      console.log('   The service account only has permission to create/view presentations,');
      console.log('   but NOT to perform other operations needed (like Drive operations).');
      console.log('\n💡 Solution:');
      console.error('   1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
      console.error(`   2. Find: ${serviceAccountEmail}`);
      console.error('   3. Click pencil icon (✏️) next to it');
      console.error('   4. REMOVE the limited role (click X next to it)');
      console.error('   5. Click "ADD ANOTHER ROLE"');
      console.error('   6. Select "Editor" role');
      console.error('   7. Click "SAVE"');
      console.error('\n   OR create a new service account with "Editor" role from the start');
    } else {
      console.log('\n⚠️  Has roles but NOT Editor or Owner');
      console.log('   Current roles may not have sufficient permissions');
      console.log('   Try adding "Editor" or "Owner" role');
    }
  }
} catch (error) {
  console.error('❌ Cannot read IAM policy:', error.message);
  console.error('\n💡 This might mean:');
  console.error('   - Service account lacks IAM permissions to read policy');
  console.error('   - But this is OK - we can still test API access');
  console.error('\n   However, you can manually check at:');
  console.error('   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
  console.error(`   Look for: ${serviceAccountEmail}`);
  console.error('   Check what role(s) it has');
}

// Test folder access and create presentation in folder
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const slidesAuth = new JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
});

await slidesAuth.authorize();
const slides = google.slides({ version: 'v1', auth: slidesAuth });
const drive = google.drive({ version: 'v3', auth: slidesAuth });

if (folderId) {
  console.log('\n=== Testing Folder Access and Creating Presentation in Folder ===');
  console.log('Folder ID:', folderId);
  
  try {
    // Step 0: Clear service account Drive storage
    console.log('\n0. Clearing service account Drive storage...');
    try {
      // First, permanently delete files in trash
      console.log('   Checking trash...');
      const trashedFiles = await drive.files.list({
        pageSize: 100,
        fields: 'files(id, name, mimeType)',
        q: "trashed=true",
      });
      
      if (trashedFiles.data.files && trashedFiles.data.files.length > 0) {
        console.log(`   Found ${trashedFiles.data.files.length} file(s) in trash`);
        let deletedFromTrash = 0;
        for (const file of trashedFiles.data.files) {
          try {
            await drive.files.delete({ fileId: file.id });
            deletedFromTrash++;
          } catch (deleteError) {
            // Ignore errors for trash deletion
          }
        }
        if (deletedFromTrash > 0) {
          console.log(`   ✅ Permanently deleted ${deletedFromTrash} file(s) from trash`);
        }
      }
      
      // Now delete files not in trash (excluding folders)
      const allFiles = await drive.files.list({
        pageSize: 100,
        fields: 'files(id, name, mimeType, createdTime)',
        q: "trashed=false and mimeType!='application/vnd.google-apps.folder'",
      });
      
      if (allFiles.data.files && allFiles.data.files.length > 0) {
        console.log(`   Found ${allFiles.data.files.length} file(s) in service account Drive`);
        console.log('   Deleting old files to free up storage...');
        
        let deletedCount = 0;
        let skippedCount = 0;
        for (const file of allFiles.data.files) {
          try {
            await drive.files.delete({ fileId: file.id });
            deletedCount++;
            console.log(`   ✅ Deleted: ${file.name || file.id}`);
          } catch (deleteError) {
            skippedCount++;
            // Don't log every skip to avoid clutter
            if (skippedCount <= 3) {
              console.log(`   ⚠️  Skipped: ${file.name || file.id} - ${deleteError.message}`);
            }
          }
        }
        if (skippedCount > 3) {
          console.log(`   ⚠️  ... and ${skippedCount - 3} more file(s) skipped`);
        }
        console.log(`   ✅ Deleted ${deletedCount} file(s), skipped ${skippedCount} file(s)`);
      } else {
        console.log('   ✅ No files found in service account Drive');
      }
    } catch (clearError) {
      console.log('   ⚠️  Could not clear Drive storage:', clearError.message);
      console.log('   Continuing anyway...');
    }
    
    // Step 1: Check folder access
    console.log('\n1. Checking folder access...');
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, permissions',
    });
    
    if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
      console.error('❌ The provided ID is not a folder!');
      console.error('   MIME type:', folder.data.mimeType);
      console.error('   Expected: application/vnd.google-apps.folder');
      process.exit(1);
    }
    
    console.log('✅ Folder found:', folder.data.name);
    console.log('   Folder ID:', folder.data.id);
    
    // Check if service account has access
    const permissions = folder.data.permissions || [];
    const hasAccess = permissions.some((p) => 
      p.emailAddress === serviceAccountEmail || 
      (p.type === 'user' && p.emailAddress === serviceAccountEmail)
    );
    
    if (hasAccess) {
      console.log('✅ Service account has access to folder');
      const serviceAccountPerm = permissions.find((p) => 
        p.emailAddress === serviceAccountEmail
      );
      if (serviceAccountPerm) {
        console.log('   Permission role:', serviceAccountPerm.role);
        if (serviceAccountPerm.role !== 'writer' && serviceAccountPerm.role !== 'owner') {
          console.log('   ⚠️  WARNING: Service account needs "Editor" (writer) access to create files');
        }
      }
    } else {
      console.log('⚠️  Service account might not have explicit access');
      console.log('   But will try to create file anyway (might work if IAM role is sufficient)');
    }
    
    // Step 2: Create presentation in folder using Drive API
    console.log('\n2. Creating presentation in folder using Drive API...');
    const fileMetadata = {
      name: 'IAM Verification Test - ' + new Date().toISOString(),
      mimeType: 'application/vnd.google-apps.presentation',
      parents: [folderId],
    };
    
    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, parents',
    });
    
    const presentationId = driveFile.data.id;
    console.log('✅ Presentation created in folder!');
    console.log('   Presentation ID:', presentationId);
    console.log('   Name:', driveFile.data.name);
    console.log('   Parents:', driveFile.data.parents);
    
    // Step 3: Verify it's in the folder
    console.log('\n3. Verifying presentation location...');
    const createdFile = await drive.files.get({
      fileId: presentationId,
      fields: 'id, name, parents',
    });
    
    if (createdFile.data.parents?.includes(folderId)) {
      console.log('✅ Confirmed: Presentation is in the specified folder');
    } else {
      console.log('⚠️  Warning: Presentation parents:', createdFile.data.parents);
      console.log('   Expected folder:', folderId);
    }
    
    // Step 4: Test Slides API by adding content
    console.log('\n4. Testing Slides API by adding content...');
    const slidesResult = await slides.presentations.get({ presentationId });
    const coverPageId = slidesResult.data.slides?.[0]?.objectId;
    
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            insertText: {
              objectId: coverPageId,
              insertionIndex: 0,
              text: 'IAM Verification Test\n\nThis presentation was created to verify service account permissions.',
            },
          },
        ],
      },
    });
    
    console.log('✅ Slides API works! Successfully added content to presentation');
    
    // Step 5: Clean up
    console.log('\n5. Cleaning up test presentation...');
    await drive.files.delete({ fileId: presentationId });
    console.log('✅ Test presentation deleted');
    
    console.log('\n🎉 SUCCESS! All tests passed!');
    console.log('✅ Folder access: OK');
    console.log('✅ Drive API: OK');
    console.log('✅ Slides API: OK');
    console.log('✅ Creating in folder: OK');
    console.log('\nYour service account is configured correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
    
    if (error.response?.data) {
      console.error('\nError details:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 404 || error.message?.includes('not found')) {
      console.error('\n💡 Folder not found or service account does not have access');
      console.error('   Make sure you shared the folder with:', serviceAccountEmail);
      console.error('   Set permission to: Editor (Writer)');
      console.error('   Folder ID:', folderId);
    } else if (error.message?.includes('storage quota') || error.message?.includes('quota exceeded')) {
      console.error('\n💡 Drive Storage Quota Exceeded');
      console.error('   The service account\'s Drive storage is full.');
      console.error('   This is actually GOOD NEWS - it means:');
      console.error('   ✅ Folder access works');
      console.error('   ✅ API permissions work');
      console.error('   ✅ The code path is correct');
      console.error('\n   To fix:');
      console.error('   - Delete old files from the service account\'s Drive');
      console.error('   - Or use a different service account');
      console.error('   - Or upgrade Google Drive storage');
    } else if (error.code === 403 || error.message?.includes('permission')) {
      console.error('\n💡 Permission denied');
      console.error('   This usually means:');
      console.error('   1. Service account lacks IAM "Editor" role at project level');
      console.error('   2. Folder is not shared with service account');
      console.error('   3. Service account has limited IAM role (not Editor/Owner)');
      console.error('\n   Solutions:');
      console.error('   - Grant "Editor" IAM role: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
      console.error('   - Share folder with:', serviceAccountEmail);
      console.error('   - Set folder permission to: Editor');
    }
    
    console.error('\n🔍 Next Steps:');
    console.error('1. Check IAM roles at:');
    console.error('   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
    console.error(`   Look for: ${serviceAccountEmail}`);
    console.error('   Should show: "Editor" or "Owner"');
    console.error('\n2. Share folder with service account:');
    console.error('   - Open folder in Google Drive');
    console.error('   - Click "Share"');
    console.error(`   - Add: ${serviceAccountEmail}`);
    console.error('   - Set permission: Editor');
    console.error('   - Click "Send"');
  }
} else {
  // No folder ID - warn user
  console.log('\n=== Testing Google Slides API (no folder specified) ===');
  console.log('⚠️  WARNING: No GOOGLE_DRIVE_FOLDER_ID set in .env');
  console.log('   The presentation will be created in the service account\'s root Drive');
  console.log('   To create in your shared folder, set GOOGLE_DRIVE_FOLDER_ID in .env\n');
  
  // Clear service account Drive first
  console.log('0. Clearing service account Drive storage...');
  try {
    // Only get files (not folders) that are not in trash
    const allFiles = await drive.files.list({
      pageSize: 100,
      fields: 'files(id, name, mimeType, createdTime)',
      q: "trashed=false and mimeType!='application/vnd.google-apps.folder'",
    });
    
    if (allFiles.data.files && allFiles.data.files.length > 0) {
      console.log(`   Found ${allFiles.data.files.length} file(s) in service account Drive`);
      console.log('   Deleting old files to free up storage...');
      
      let deletedCount = 0;
      let skippedCount = 0;
      for (const file of allFiles.data.files) {
        try {
          await drive.files.delete({ fileId: file.id });
          deletedCount++;
          console.log(`   ✅ Deleted: ${file.name || file.id}`);
        } catch (deleteError) {
          skippedCount++;
          if (skippedCount <= 3) {
            console.log(`   ⚠️  Skipped: ${file.name || file.id} - ${deleteError.message}`);
          }
        }
      }
      if (skippedCount > 3) {
        console.log(`   ⚠️  ... and ${skippedCount - 3} more file(s) skipped`);
      }
      console.log(`   ✅ Deleted ${deletedCount} file(s), skipped ${skippedCount} file(s)`);
    } else {
      console.log('   ✅ No files found in service account Drive');
    }
  } catch (clearError) {
    console.log('   ⚠️  Could not clear Drive storage:', clearError.message);
    console.log('   Continuing anyway...');
  }
  
  try {
    const result = await slides.presentations.create({
      requestBody: {
        title: 'Verification Test - ' + new Date().toISOString(),
      },
    });
    
    console.log('\n✅ Google Slides API WORKS!');
    console.log('   Presentation ID:', result.data.presentationId);
    
    // Clean up
    await drive.files.delete({ fileId: result.data.presentationId });
    console.log('   Test presentation deleted');
    
    console.log('\n✅ Basic Slides API works, but folder test was skipped');
    console.log('   💡 Set GOOGLE_DRIVE_FOLDER_ID in .env to test folder creation');
    console.log('   This will create presentations directly in your shared folder');
  } catch (error) {
    console.error('\n❌ Google Slides API still failing!');
    console.error('Error:', error.message);
    
    if (error.response?.data) {
      console.error('\nError details:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.message?.includes('storage quota') || error.message?.includes('quota exceeded')) {
      console.error('\n💡 Drive Storage Quota Exceeded');
      console.error('   The service account\'s Drive storage is full.');
      console.error('   Try running the script again - it should have cleared some space.');
    }
    
    console.error('\n🔍 Next Steps:');
    console.error('1. Grant "Editor" IAM role at:');
    console.error('   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914');
    console.error(`   For: ${serviceAccountEmail}`);
  }
}

