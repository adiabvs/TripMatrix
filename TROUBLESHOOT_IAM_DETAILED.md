# Detailed IAM Troubleshooting Guide

## Current Issue
Service account `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com` is getting "The caller does not have permission" error.

## Step-by-Step Fix

### Step 1: Verify Service Account Exists

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. **Check if you see:** `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
   - ✅ If YES → Go to Step 2
   - ❌ If NO → The service account doesn't exist or is in a different project

### Step 2: Grant IAM Role (CRITICAL)

**Option A: Via IAM Page (Recommended)**

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

2. **Look for the service account in the list:**
   - If you see `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`:
     - Click the **pencil icon (✏️)** next to it
     - Click **"ADD ANOTHER ROLE"**
     - Search for and select **"Editor"**
     - Click **"SAVE"**
   
   - If you DON'T see it:
     - Click **"GRANT ACCESS"** button at the top
     - In "New principals", paste: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
     - Click **"SELECT A ROLE"**
     - Search for **"Editor"** and select it
     - Click **"SAVE"**

**Option B: Via Service Account Page**

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. Click on: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

3. Go to **"PERMISSIONS"** tab

4. Click **"GRANT ACCESS"**

5. In "New principals", paste: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

6. Select role: **"Editor"**

7. Click **"SAVE"**

### Step 3: Verify the Role Was Added

1. Go back to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

2. Find `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

3. **Check the "Role" column** - it should show **"Editor"**

4. If it doesn't show "Editor", repeat Step 2

### Step 4: Enable APIs (If Not Already Done)

1. **Google Slides API:**
   - https://console.cloud.google.com/apis/library/slides.googleapis.com?project=tripmatrix-480914
   - Click **"ENABLE"** if not already enabled

2. **Google Drive API:**
   - https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tripmatrix-480914
   - Click **"ENABLE"** if not already enabled

### Step 5: Wait and Test

1. **Wait 2-3 minutes** for IAM changes to propagate

2. **Run diagnostic script:**
   ```bash
   cd apps/backend
   node diagnose-iam.js
   ```

3. **Or run test script:**
   ```bash
   node test-google-auth.js
   ```

## Common Issues

### Issue 1: Service Account Not in IAM List

**Symptom:** Service account doesn't appear in IAM page

**Solution:**
- The service account might be in a different project
- Check which project the service account key was created in
- Make sure you're looking at project `tripmatrix-480914`

### Issue 2: Role Added But Still Failing

**Symptom:** Added "Editor" role but still getting permission errors

**Solutions:**
1. **Try "Owner" role instead** (more permissive)
2. **Wait longer** - IAM changes can take 5-10 minutes
3. **Check if service account key is correct:**
   - The key in `.env` should match the service account
   - If you regenerated the key, make sure you updated `.env`

### Issue 3: Wrong Project

**Symptom:** Service account exists but in different project

**Solution:**
- Check the service account email format: `@tripmatrix-480914.iam.gserviceaccount.com`
- If it's from a different project, you need to either:
  - Use the correct service account for project `tripmatrix-480914`, OR
  - Update your `.env` to use a service account from the correct project

### Issue 4: Service Account Key Expired or Invalid

**Symptom:** Authentication fails or key doesn't work

**Solution:**
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click on your service account
3. Go to **"KEYS"** tab
4. Click **"ADD KEY"** > **"Create new key"**
5. Choose **JSON** format
6. Download and extract `private_key` and `client_email`
7. Update your `.env` file:
   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=client_email_from_json
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="private_key_from_json_with_\n"
   ```
8. Restart backend server

## Still Not Working?

If none of the above works:

1. **Create a new service account:**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
   - Click **"CREATE SERVICE ACCOUNT"**
   - Name: `tripmatrix-slides-generator`
   - Grant role: **"Editor"** during creation
   - Create a key (JSON)
   - Update `.env` with new credentials

2. **Check project billing:**
   - Some APIs require billing to be enabled
   - Go to: https://console.cloud.google.com/billing?project=tripmatrix-480914

3. **Contact support:**
   - Share the full error output from `diagnose-iam.js`
   - Include screenshots of IAM page showing the service account and its roles

