# Setting Up Google Service Account with Regular Gmail Account

## Good News! ✅
**Service accounts work perfectly with regular Gmail accounts!** You don't need Google Workspace. The setup is the same.

## The Issue
The "permission denied" error is still an **IAM role issue**, not a Gmail vs Workspace issue.

## Step-by-Step Fix

### Step 1: Verify You're the Project Owner

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914
2. Check if your Gmail account is listed with "Owner" role
3. If not, you might not have permission to grant IAM roles

### Step 2: Grant IAM Role to Service Account

**This is the critical step that's still needed:**

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914
2. Click **"GRANT ACCESS"** (top button)
3. In "New principals", paste:
   ```
   tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com
   ```
4. Click **"SELECT A ROLE"**
5. Search for and select: **"Editor"**
6. Click **"SAVE"**

### Step 3: Verify OAuth Consent Screen (Optional but Recommended)

Even with service accounts, sometimes the OAuth consent screen needs to be configured:

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=tripmatrix-480914

2. **If not configured:**
   - Click **"CONFIGURE CONSENT SCREEN"**
   - Choose **"External"** (for regular Gmail accounts)
   - Fill in:
     - App name: `TripMatrix`
     - User support email: Your Gmail address
     - Developer contact: Your Gmail address
   - Click **"SAVE AND CONTINUE"**
   - Skip scopes (click "SAVE AND CONTINUE")
   - Skip test users (click "SAVE AND CONTINUE")
   - Click **"BACK TO DASHBOARD"**

3. **If already configured:**
   - Make sure it's set to "External" or "Internal"
   - This should be fine as-is

### Step 4: Wait and Test

1. **Wait 3-5 minutes** after granting the IAM role
2. Run test:
   ```bash
   cd apps/backend
   node test-google-auth.js
   ```

## Why This Still Works with Regular Gmail

- ✅ Service accounts are independent of your account type
- ✅ IAM roles work the same way
- ✅ APIs work the same way
- ✅ The only difference is OAuth consent screen (which we configured above)

## Common Confusion

**Myth:** "I need Google Workspace to use service accounts"  
**Reality:** Service accounts work with regular Gmail accounts too!

**Myth:** "Service accounts need domain-wide delegation"  
**Reality:** Only needed if you want to impersonate users. For API access, IAM roles are enough.

## Still Not Working?

If you've granted the "Editor" role and it's still not working:

1. **Try "Owner" role instead:**
   - Remove "Editor"
   - Add "Owner"
   - Wait 5 minutes

2. **Check if you have permission to grant roles:**
   - Your Gmail account needs "Owner" or "IAM Admin" role
   - Go to IAM page and check your own account's role

3. **Verify service account exists:**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
   - You should see `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`
   - If not, the service account might be in a different project

4. **Create a new service account:**
   - Sometimes starting fresh helps
   - See "Create New Service Account" section below

## Create New Service Account (If Needed)

If the current service account isn't working:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click **"CREATE SERVICE ACCOUNT"**
3. Fill in:
   - **Name:** `tripmatrix-slides-generator`
   - Click **"CREATE AND CONTINUE"**
4. **Grant access:**
   - Click **"SELECT A ROLE"**
   - Search for **"Editor"**
   - Select it
   - Click **"CONTINUE"**
5. Click **"DONE"**
6. **Create key:**
   - Click on the new service account
   - Go to **"KEYS"** tab
   - Click **"ADD KEY"** > **"Create new key"**
   - Choose **JSON**
   - Download the file
7. **Update `.env`:**
   - Open the JSON file
   - Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep `\n` characters)
8. **Restart backend**

## Summary

**You don't need Google Workspace!** The issue is simply that the service account needs the "Editor" IAM role. Follow Step 2 above to grant it.

