# EXACT Steps to Fix IAM Permission Issue

## Current Status
✅ Service account can authenticate  
✅ APIs are enabled  
✅ Project access works  
❌ **BUT** service account lacks permission to use Slides API

## The Fix: Grant IAM Role

### Step 1: Open IAM Page
Click this link: **https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914**

### Step 2: Check Current Status
Look in the table for: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

**What you'll see:**
- **If you see it listed:**
  - Check the "Role" column
  - If it shows "Editor" or "Owner" → Go to Step 4
  - If it shows something else or is blank → Go to Step 3A
  
- **If you DON'T see it:**
  - Go to Step 3B

### Step 3A: Add Role to Existing Service Account

1. Find `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com` in the list
2. Click the **pencil icon (✏️)** on the right side of that row
3. A sidebar will open on the right
4. Click **"ADD ANOTHER ROLE"** button
5. In the dropdown, search for: **"Editor"**
6. Select **"Editor"** from the list
7. Click **"SAVE"** at the bottom
8. Wait for confirmation message

### Step 3B: Grant Access to New Service Account

1. Click the **"GRANT ACCESS"** button at the top of the page
2. A dialog will open
3. In the "New principals" field, paste exactly:
   ```
   tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com
   ```
4. Click the **"SELECT A ROLE"** dropdown
5. Start typing: **"Editor"**
6. Select **"Editor"** from the list (it should show "Editor" with description "Edit access to all resources")
7. Click **"SAVE"**
8. Wait for confirmation

### Step 4: Verify the Role

1. Refresh the IAM page
2. Find `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com` again
3. Check the "Role" column
4. **It should now show: "Editor"**

### Step 5: If "Editor" Doesn't Work, Try "Owner"

1. Go back to IAM page
2. Click the pencil icon next to the service account
3. Remove "Editor" role (click X next to it)
4. Click "ADD ANOTHER ROLE"
5. Search for and select **"Owner"**
6. Click "SAVE"
7. Wait 3-5 minutes

### Step 6: Wait and Test

**IMPORTANT:** IAM changes can take 2-5 minutes to propagate.

1. **Wait at least 3 minutes** after granting the role
2. Run the test:
   ```bash
   cd apps/backend
   node test-google-auth.js
   ```

## Still Not Working?

### Check 1: Verify Service Account Email
Make sure the email in your `.env` file matches exactly:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com
```

### Check 2: Verify Service Account Exists
Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

You should see `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com` in the list.

If you DON'T see it:
- The service account might be in a different project
- You might need to create a new service account

### Check 3: Try Creating New Service Account

If nothing works, create a fresh service account:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click **"CREATE SERVICE ACCOUNT"**
3. Fill in:
   - **Service account name:** `tripmatrix-slides`
   - **Service account ID:** (auto-filled)
   - Click **"CREATE AND CONTINUE"**
4. **Grant access to users and service accounts:**
   - Click **"SELECT A ROLE"**
   - Search for and select **"Editor"**
   - Click **"CONTINUE"**
5. Click **"DONE"**
6. **Create a key:**
   - Click on the new service account
   - Go to **"KEYS"** tab
   - Click **"ADD KEY"** > **"Create new key"**
   - Choose **JSON**
   - Download the JSON file
7. **Update your `.env`:**
   - Open the downloaded JSON
   - Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep the `\n` characters)
8. **Restart your backend server**

## Visual Guide

When you're on the IAM page, you should see something like this:

```
┌─────────────────────────────────────────────────────────────┐
│ Principals                    │ Role                         │
├─────────────────────────────────────────────────────────────┤
│ your-email@gmail.com          │ Owner                        │
│ tripmatrixdairygen@...        │ Editor  ← Should show this  │
└─────────────────────────────────────────────────────────────┘
```

If the service account row shows **no role** or a different role, that's the problem!

