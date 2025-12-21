# Create New Service Account - Step by Step

If granting IAM roles isn't working, creating a fresh service account with roles granted during creation often fixes the issue.

## Step 1: Create Service Account

1. **Go to Service Accounts page:**
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. **Click "CREATE SERVICE ACCOUNT"** (top button)

3. **Fill in details:**
   - **Service account name:** `tripmatrix-slides-generator`
   - **Service account ID:** (auto-filled, leave as is)
   - Click **"CREATE AND CONTINUE"**

## Step 2: Grant Role During Creation

1. **Grant access to users and service accounts:**
   - Click **"SELECT A ROLE"** dropdown
   - Start typing: **"Editor"**
   - Select **"Editor"** (it should show "Edit access to all resources")
   - Click **"CONTINUE"**

2. **Skip optional steps:**
   - Click **"DONE"** (you can skip granting users access to this service account)

## Step 3: Create Key

1. **Click on the new service account** you just created
   - It should be: `tripmatrix-slides-generator@tripmatrix-480914.iam.gserviceaccount.com`

2. **Go to "KEYS" tab** (top of page)

3. **Click "ADD KEY"** > **"Create new key"**

4. **Choose "JSON"** format

5. **Click "CREATE"**
   - A JSON file will download automatically

## Step 4: Update Your .env File

1. **Open the downloaded JSON file** (it will look like this):
   ```json
   {
     "type": "service_account",
     "project_id": "tripmatrix-480914",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "tripmatrix-slides-generator@tripmatrix-480914.iam.gserviceaccount.com",
     "client_id": "...",
     ...
   }
   ```

2. **Open your backend `.env` file:**
   - Location: `apps/backend/.env`

3. **Update these lines:**
   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=tripmatrix-slides-generator@tripmatrix-480914.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   
   **Important:**
   - Copy the `client_email` value → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy the `private_key` value → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - Keep the `\n` characters in the private key (they should already be there)
   - Wrap the private key in quotes if it's not already

4. **Save the `.env` file**

## Step 5: Verify IAM Role

1. **Go to IAM page:**
   https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

2. **Find your new service account:**
   - Look for: `tripmatrix-slides-generator@tripmatrix-480914.iam.gserviceaccount.com`
   - Check the "Role" column - it should show **"Editor"**

3. **If it doesn't show "Editor":**
   - Click the pencil icon (✏️) next to it
   - Click "ADD ANOTHER ROLE"
   - Select "Editor"
   - Click "SAVE"

## Step 6: Test

1. **Restart your backend server** (if it's running)

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

## Why This Works

Creating a service account with the role granted during creation ensures:
- ✅ The IAM role is properly assigned from the start
- ✅ No permission propagation delays
- ✅ Clean setup without conflicts

## Troubleshooting

**If the new service account still doesn't work:**

1. **Verify the role:**
   - Go to IAM page
   - Make sure "Editor" role is listed

2. **Try "Owner" role instead:**
   - Remove "Editor"
   - Add "Owner"
   - Wait 5 minutes

3. **Check the JSON key:**
   - Make sure you copied the entire private key
   - Make sure `\n` characters are preserved
   - Make sure the email matches exactly

4. **Verify project:**
   - Make sure you're in project `tripmatrix-480914`
   - The service account email should end with `@tripmatrix-480914.iam.gserviceaccount.com`

