# Check for Limited Roles - Manual Verification

## The Problem
If your service account only has permission to "create presentation" but not other operations, it will fail when trying to:
- Access Drive API
- Move files to folders
- Update presentations
- Perform other necessary operations

## How to Check

### Step 1: Open IAM Page
Go to: **https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914**

### Step 2: Find Your Service Account
Look for: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

### Step 3: Check the Role Column

**What you're looking for:**

#### ✅ GOOD Roles (Full Permissions):
- **Editor** - Full edit access to all resources
- **Owner** - Full access including billing and IAM management
- **Service Account User** - Can use service accounts (but needs Editor too)

#### ❌ BAD Roles (Limited Permissions):
- **Viewer** - Read-only access
- **Slides Viewer** - Can only view presentations
- **Custom roles** with names like:
  - "Presentation Creator"
  - "Slides Editor" (limited)
  - Any role with "viewer" or "reader" in the name

### Step 4: Check for Multiple Roles

**If you see multiple roles:**
- Look at ALL of them
- If ANY role is limited (like "Viewer"), it might be causing issues
- You need at least "Editor" role

### Step 5: Check Custom Roles

**If you see a custom role:**
1. Click on the role name (it will be a link)
2. Check what permissions it has
3. Look for permissions like:
   - `slides.presentations.create` ✅ (good)
   - `slides.presentations.get` ✅ (good)
   - `slides.presentations.update` ✅ (good)
   - `drive.files.create` ✅ (needed!)
   - `drive.files.update` ✅ (needed!)
   - `drive.files.get` ✅ (needed!)

**If the custom role is missing Drive permissions, that's the problem!**

## Solution: Grant Editor Role

### Option 1: Add Editor Role (Recommended)

1. On the IAM page, find your service account
2. Click the **pencil icon (✏️)** next to it
3. Click **"ADD ANOTHER ROLE"**
4. Search for and select **"Editor"**
5. Click **"SAVE"**

### Option 2: Replace Limited Role with Editor

1. On the IAM page, find your service account
2. Click the **pencil icon (✏️)** next to it
3. **Remove** any limited roles (click X next to them)
4. Click **"ADD ANOTHER ROLE"**
5. Select **"Editor"**
6. Click **"SAVE"**

### Option 3: Create New Service Account

If fixing roles doesn't work, create a fresh service account:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click **"CREATE SERVICE ACCOUNT"**
3. Name: `tripmatrix-slides-generator`
4. **During creation**, grant **"Editor"** role
5. Create key (JSON)
6. Update `.env` with new credentials

## Common Limited Roles to Watch For

- `roles/viewer` - Read-only
- `roles/slides.viewer` - Can only view
- Custom roles with limited permissions
- Roles that only have `slides.presentations.create` but not Drive permissions

## What You Need

Your service account needs:
- ✅ **Editor** role (or Owner)
- ✅ Access to Google Slides API
- ✅ Access to Google Drive API
- ✅ Permission to create files in your Drive folder

## After Fixing

1. **Wait 3-5 minutes** for changes to propagate
2. **Run test:**
   ```bash
   cd apps/backend
   node test-google-auth.js
   ```

3. **Expected output:**
   ```
   ✅ Google Slides API works!
   ✅ Google Drive API works!
   ```

## Still Not Working?

If you've granted "Editor" role and it's still failing:

1. **Verify the role appears** in the IAM list
2. **Check if there are multiple projects** - make sure you're in `tripmatrix-480914`
3. **Try "Owner" role** instead of "Editor"
4. **Create a completely new service account** with Editor role from the start

