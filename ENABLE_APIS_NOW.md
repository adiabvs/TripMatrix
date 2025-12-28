# Enable Google APIs - Step by Step

## The Problem
Your authentication works, but the Google Slides API is not enabled. This is why you're getting "The caller does not have permission" error.

## Solution: Enable the APIs

### Step 1: Enable Google Slides API

1. **Open this link directly:**
   https://console.cloud.google.com/apis/library/slides.googleapis.com?project=tripmatrix-480914

2. **Click the blue "ENABLE" button** (top of the page)

3. **Wait for it to enable** (usually takes 10-30 seconds)

4. **You should see "API enabled" message**

### Step 2: Enable Google Drive API

1. **Open this link directly:**
   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tripmatrix-480914

2. **Click the blue "ENABLE" button** (top of the page)

3. **Wait for it to enable** (usually takes 10-30 seconds)

4. **You should see "API enabled" message**

### Step 3: Verify APIs are Enabled

1. Go to: https://console.cloud.google.com/apis/dashboard?project=tripmatrix-480914
2. You should see both APIs listed:
   - ✅ Google Slides API
   - ✅ Google Drive API

### Step 4: Wait 1-2 Minutes

After enabling, wait 1-2 minutes for the changes to propagate through Google's systems.

### Step 5: Try Again

Go back to your app and try generating the diary again. It should work now!

## Alternative: Enable via Command Line

If you have `gcloud` CLI installed:

```bash
gcloud services enable slides.googleapis.com --project=tripmatrix-480914
gcloud services enable drive.googleapis.com --project=tripmatrix-480914
```

## Still Not Working?

If you still get errors after enabling:

1. **Check billing** - Some APIs require billing to be enabled (though Slides/Drive usually don't)
2. **Check service account permissions** - The service account should have "Editor" or "Owner" role in the project
3. **Wait longer** - Sometimes it takes 5-10 minutes for changes to fully propagate
4. **Try the test script** - Run `node apps/backend/test-google-auth.js` to verify

## Quick Links

- **Google Slides API:** https://console.cloud.google.com/apis/library/slides.googleapis.com?project=tripmatrix-480914
- **Google Drive API:** https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tripmatrix-480914
- **API Dashboard:** https://console.cloud.google.com/apis/dashboard?project=tripmatrix-480914


