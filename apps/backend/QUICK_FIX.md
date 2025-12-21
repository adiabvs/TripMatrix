# Quick Fix for Google Slides Permission Error

## Immediate Steps

### Step 1: Verify APIs are Enabled

1. **Google Slides API:**
   - Go to: https://console.cloud.google.com/apis/library/slides.googleapis.com
   - Make sure you're in project: `tripmatrix-480914`
   - Click **"Enable"** if it's not enabled
   - Wait 1-2 minutes for it to propagate

2. **Google Drive API:**
   - Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com
   - Make sure you're in project: `tripmatrix-480914`
   - Click **"Enable"** if it's not enabled
   - Wait 1-2 minutes for it to propagate

### Step 2: Verify Service Account

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripmatrix-480914
2. Find service account: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`
3. Click on it
4. Go to **"Keys"** tab
5. Verify you have a key, or create a new one if needed

### Step 3: Run Test Script

From your backend directory:

```bash
cd apps/backend
node test-google-auth.js
```

This will tell you exactly what's wrong.

### Step 4: Check Backend Logs

When you try to generate a diary, check your backend console. You should see:

```
Starting Google Slides generation...
Trip: [trip name]
Places count: [number]
Initializing Google Auth...
Service Account Email: slides-generator@tripmatrix-480914.iam.gserviceaccount.com
Testing authentication...
```

If you see an error after "Testing authentication...", that's where the problem is.

## Common Issues

### Issue: "API not enabled"
**Solution:** Enable both APIs (see Step 1)

### Issue: "Invalid credentials"
**Solution:** 
1. Go to service account in Google Cloud Console
2. Create a new key (JSON)
3. Extract `private_key` and `client_email` from JSON
4. Update your `.env` file
5. Restart backend server

### Issue: "Permission denied" even after enabling APIs
**Solution:**
1. Wait 2-3 minutes after enabling APIs (they need time to propagate)
2. Try again
3. If still failing, regenerate service account key

## Verify Your .env File

Your backend `.env` should have:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=slides-generator@tripmatrix-480914.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Important:**
- Private key must be in quotes
- Private key must include `\n` (not actual newlines)
- Private key must be the full key from the JSON file

## Still Not Working?

1. **Check backend console logs** - they now have detailed error messages
2. **Run the test script** - `node apps/backend/test-google-auth.js`
3. **Verify project ID** - Make sure you're using the correct Google Cloud project
4. **Check billing** - Some APIs require billing to be enabled (though Slides/Drive usually don't)

## Quick Test

Try this in your backend console (Node.js REPL):

```javascript
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/presentations'],
});

await auth.authorize();
console.log('Auth works!');
```

If this fails, the credentials are wrong. If it works, the APIs might not be enabled.


