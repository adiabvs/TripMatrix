# Google Drive Folder Setup for Travel Diaries

## Step 1: Create a Folder in Google Drive

1. **Go to Google Drive:** https://drive.google.com/

2. **Create a new folder:**
   - Click "New" → "Folder"
   - Name it: `TripMatrix Travel Diaries` (or any name you prefer)
   - Click "Create"

## Step 2: Get the Folder ID

1. **Open the folder** you just created

2. **Look at the URL** in your browser:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
   ```
   
   The **Folder ID** is the part after `/folders/`: `1a2b3c4d5e6f7g8h9i0j`

3. **Copy this Folder ID** - you'll need it for your `.env` file

## Step 3: Share Folder with Service Account

**Important:** The service account needs access to this folder!

1. **In the folder**, click the **"Share"** button (top right)

2. **Add the service account email:**
   - Enter: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`
   - Set permission: **"Editor"** (so it can create files)
   - Click **"Send"** (you can uncheck "Notify people" if you want)

3. **Verify sharing:**
   - The service account should now appear in the "Shared with" list
   - Make sure it has "Editor" access

## Step 4: Add Folder ID to Your Backend .env

Add this line to your backend `.env` file:

```env
GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
```

Replace `1a2b3c4d5e6f7g8h9i0j` with your actual folder ID.

## Step 5: Restart Backend Server

After adding the folder ID, restart your backend server to load the new environment variable.

## What Happens Next?

When you generate a travel diary:
1. ✅ Google Slides presentation is created
2. ✅ It's automatically moved to your specified folder
3. ✅ All travel diaries will be organized in one place

## Optional: Organize by Date

You can create subfolders if you want:
- `TripMatrix Travel Diaries/2024/`
- `TripMatrix Travel Diaries/2025/`

But the main folder is sufficient - all slides will go there automatically.

## Troubleshooting

**If slides don't appear in the folder:**
- Check that the folder ID is correct
- Verify the service account has "Editor" access
- Check backend logs for any errors

**If you get permission errors:**
- Make sure you shared the folder with the service account email
- Verify the service account email is exactly: `slides-generator@tripmatrix-480914.iam.gserviceaccount.com`

## Quick Checklist

- [ ] Created folder in Google Drive
- [ ] Got the folder ID from the URL
- [ ] Shared folder with service account (Editor access)
- [ ] Added `GOOGLE_DRIVE_FOLDER_ID` to backend `.env`
- [ ] Restarted backend server


