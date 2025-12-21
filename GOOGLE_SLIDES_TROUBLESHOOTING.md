# Google Slides Permission Error Troubleshooting

## Error: "The caller does not have permission"

This error means your Google service account doesn't have the necessary permissions. Follow these steps:

### Step 1: Verify APIs are Enabled

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **Library**
4. Search for and enable:
   - ✅ **Google Slides API**
   - ✅ **Google Drive API**

### Step 2: Verify Service Account Credentials

Check your backend `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:**
- The email must end with `.iam.gserviceaccount.com`
- The private key must be in quotes
- The private key must include `\n` characters (not actual newlines)
- The private key must include `BEGIN PRIVATE KEY` and `END PRIVATE KEY` markers

### Step 3: Verify Service Account Exists

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **IAM & Admin** > **Service Accounts**
3. Verify your service account exists
4. Click on it to see details
5. Note the email address (must match your `.env` file)

### Step 4: Check Service Account Permissions

The service account needs these scopes (already included in code):
- `https://www.googleapis.com/auth/presentations`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.file`

### Step 5: Test Credentials Manually

Create a test file `test-google-auth.js`:

```javascript
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
});

async function test() {
  try {
    const slides = google.slides({ version: 'v1', auth });
    const result = await slides.presentations.create({
      requestBody: {
        title: 'Test Presentation',
      },
    });
    console.log('Success! Presentation ID:', result.data.presentationId);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Details:', error.response?.data);
  }
}

test();
```

Run it:
```bash
node test-google-auth.js
```

### Step 6: Common Issues and Solutions

#### Issue: "Invalid credentials"
- **Solution**: Regenerate the service account key in Google Cloud Console
- Download the new JSON file
- Extract the `private_key` and `client_email` values

#### Issue: "API not enabled"
- **Solution**: Enable Google Slides API and Google Drive API in Google Cloud Console

#### Issue: "Permission denied"
- **Solution**: 
  1. Verify APIs are enabled
  2. Check service account email matches
  3. Ensure private key is correctly formatted
  4. Try regenerating the service account key

#### Issue: "Quota exceeded"
- **Solution**: Check your Google Cloud quota limits
- Wait and try again later
- Consider upgrading your Google Cloud plan

### Step 7: Verify Environment Variables

In your backend, add temporary logging to verify:

```javascript
console.log('Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log('Private Key Length:', process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.length);
console.log('Private Key Starts:', process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.substring(0, 30));
```

**Expected output:**
- Email: `something@project-id.iam.gserviceaccount.com`
- Key length: ~1700-2000 characters
- Key starts: `-----BEGIN PRIVATE KEY-----\n`

### Step 8: Restart Backend Server

After making changes to `.env`:
1. Stop the backend server
2. Restart it to load new environment variables
3. Try generating the diary again

### Still Not Working?

1. **Check backend logs** for detailed error messages
2. **Verify the service account JSON file** - ensure it's valid JSON
3. **Try creating a new service account** with a fresh key
4. **Check Google Cloud Console** for any error messages or warnings
5. **Verify your Google Cloud project** has billing enabled (if required)

### Quick Checklist

- [ ] Google Slides API enabled
- [ ] Google Drive API enabled
- [ ] Service account exists in Google Cloud Console
- [ ] Service account email matches `.env` file
- [ ] Private key is properly formatted (with `\n` characters)
- [ ] Private key is in quotes in `.env` file
- [ ] Backend server restarted after `.env` changes
- [ ] No typos in environment variable names


