# Fix Service Account Permissions

Since the APIs are enabled but you're still getting permission errors, the service account needs proper IAM roles.

## Step 1: Grant Service Account IAM Roles

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=tripmatrix-480914

2. Find your service account: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`

3. Click the **pencil icon** (Edit) next to it

4. Click **"ADD ANOTHER ROLE"**

5. Add these roles (one at a time):
   - **Editor** (or **Owner** for full access)
   - **Service Account User** (if not already there)

6. Click **"SAVE"**

## Step 2: Alternative - Grant via Service Account Page

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. Click on: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`

3. Go to **"PERMISSIONS"** tab

4. Click **"GRANT ACCESS"**

5. In "New principals", enter: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`

6. Select role: **"Editor"** or **"Owner"**

7. Click **"SAVE"**

## Step 3: Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=tripmatrix-480914

2. Make sure OAuth consent screen is configured (even for service accounts, this sometimes matters)

3. If not configured, set it up as "Internal" (for testing)

## Step 4: Verify Service Account Key

The service account key might be from a different project or expired:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914

2. Click on your service account

3. Go to **"KEYS"** tab

4. Check if you have an active key

5. If needed, create a new key:
   - Click **"ADD KEY"** > **"Create new key"**
   - Choose **JSON**
   - Download and extract the `private_key` and `client_email`
   - Update your `.env` file
   - **Restart your backend server**

## Step 5: Test Again

After granting permissions, wait 1-2 minutes, then:

1. Try generating the diary again, OR
2. Run the test script: `node apps/backend/test-google-auth.js`

## Still Not Working?

If it still fails, try creating a new service account:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Click **"CREATE SERVICE ACCOUNT"**
3. Name: `tripmatrix-slides` (or any name)
4. Grant role: **Editor**
5. Create a key (JSON)
6. Update your `.env` with the new credentials
7. Restart backend


