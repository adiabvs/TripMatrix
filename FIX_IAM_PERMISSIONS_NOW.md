# Fix IAM Permissions - Quick Fix

## Your Service Account
**Email:** `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

## The Problem
The error "The caller does not have permission" means your service account doesn't have the **Editor** role at the project level.

## Solution: Grant Editor Role (2 minutes)

### Method 1: Via IAM Page (Recommended)

1. **Open this link:**
   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

2. **Find your service account:**
   - Look for: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
   - If you don't see it, click **"GRANT ACCESS"** at the top

3. **Add the service account:**
   - Click **"GRANT ACCESS"** (top of page)
   - In "New principals", paste: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
   - Click **"SELECT A ROLE"**
   - Search for and select: **"Editor"**
   - Click **"SAVE"**

4. **Wait 1-2 minutes** for permissions to propagate

5. **Test again:**
   ```bash
   node apps/backend/test-google-auth.js
   ```

### Method 2: Via Service Account Page

1. **Open this link:**
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. **Click on:** `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

3. **Go to "PERMISSIONS" tab** (top of page)

4. **Click "GRANT ACCESS"**

5. **Add the service account:**
   - In "New principals", paste: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
   - Select role: **"Editor"**
   - Click **"SAVE"**

6. **Wait 1-2 minutes** and test again

## Verify It Worked

After granting the role, run:
```bash
node apps/backend/test-google-auth.js
```

You should see:
```
✅ Google Slides API works!
✅ Google Drive API works!
```

## Still Not Working?

If you still get permission errors after 2 minutes:

1. **Double-check the service account email** matches exactly:
   - `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

2. **Verify the role was added:**
   - Go back to IAM page
   - Find the service account
   - Check that "Editor" appears in the roles column

3. **Try "Owner" role instead** (more permissive):
   - Remove "Editor" role
   - Add "Owner" role
   - Wait 2 minutes and test again

4. **Check if service account key is correct:**
   - The key in your `.env` should match this service account
   - If not, you may need to create a new key or use a different service account

