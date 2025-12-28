# How to Grant IAM "Editor" Role - Step by Step

## Quick Link
**Go directly to IAM page:** https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

## Step-by-Step Instructions

### Step 1: Open IAM Page
1. Click this link: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914
2. You should see a table with "Principals" and "Role" columns

### Step 2: Find Your Service Account
Look in the "Principals" column for:
```
tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com
```

**Two scenarios:**

#### Scenario A: Service Account IS in the list
- You'll see it in the table
- Check the "Role" column:
  - If it shows **"Editor"** or **"Owner"** → ✅ You're done! Skip to Step 4
  - If it shows something else or is blank → Go to Step 3A

#### Scenario B: Service Account is NOT in the list
- You don't see it in the table
- Go to Step 3B

### Step 3A: Add Editor Role to Existing Service Account

1. **Find the service account** in the list:
   - Look for: `tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com`

2. **Click the pencil icon (✏️)** on the right side of that row
   - This opens an edit panel on the right

3. **Click "ADD ANOTHER ROLE"** button
   - It's in the edit panel

4. **Select "Editor" role:**
   - A dropdown will appear
   - Start typing: **"Editor"**
   - Select **"Editor"** from the list
   - (It should show: "Edit access to all resources")

5. **Click "SAVE"** at the bottom of the panel
   - Wait for the confirmation message

### Step 3B: Grant Access to New Service Account

1. **Click "GRANT ACCESS"** button
   - It's at the top of the page (blue button)

2. **Add the service account:**
   - In the "New principals" field, paste:
     ```
     tripmatrixdairygen@tripmatrix-480914.iam.gserviceaccount.com
     ```

3. **Select role:**
   - Click **"SELECT A ROLE"** dropdown
   - Start typing: **"Editor"**
   - Select **"Editor"** from the list
   - (It should show: "Edit access to all resources")

4. **Click "SAVE"**
   - Wait for the confirmation message

### Step 4: Verify the Role

1. **Refresh the IAM page** (press F5 or click refresh)
2. **Find the service account again** in the list
3. **Check the "Role" column**
   - It should now show: **"Editor"**

### Step 5: Wait for Propagation

**IMPORTANT:** IAM changes can take 2-5 minutes to propagate.

1. **Wait at least 3 minutes** after granting the role
2. **Don't test immediately** - wait for changes to take effect

### Step 6: Test

After waiting 3-5 minutes, run:

```bash
cd apps/backend
node verify-iam-roles.js
```

**Expected result:**
```
✅ Google Slides API WORKS!
✅ Drive API WORKS!
✅ Presentation created in folder!
```

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

## Troubleshooting

### "I don't see the service account"
- Make sure you're in the correct project: `tripmatrix-480914`
- Check the URL: `?project=tripmatrix-480914`
- The service account might be in a different project

### "I can't click GRANT ACCESS"
- You need to be a project Owner or have IAM Admin permissions
- Check your own role in the IAM list
- You should have "Owner" or "IAM Admin" role

### "Editor role doesn't appear in dropdown"
- Make sure you're typing "Editor" (capital E)
- It should be the first result
- Full name: "Editor" with description "Edit access to all resources"

### "I granted the role but it still doesn't work"
1. **Wait longer** - IAM changes can take 5-10 minutes
2. **Verify the role appears** in the IAM list
3. **Try "Owner" role instead** (more permissive)
4. **Check if service account key is correct** - make sure `.env` has the right credentials

## Alternative: Create New Service Account

If granting the role doesn't work, create a fresh service account:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click **"CREATE SERVICE ACCOUNT"**
3. Fill in:
   - **Name:** `tripmatrix-slides-generator`
   - Click **"CREATE AND CONTINUE"**
4. **Grant role during creation:**
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
   - Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
8. **Restart backend server**

## Summary

1. ✅ Go to IAM page
2. ✅ Find or add service account
3. ✅ Grant "Editor" role
4. ✅ Wait 3-5 minutes
5. ✅ Test with `node verify-iam-roles.js`

That's it! Once the Editor role is granted, everything should work.

