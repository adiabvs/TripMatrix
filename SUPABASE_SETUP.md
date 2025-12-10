# Supabase Storage Setup Guide

## Quick Setup

### Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**
4. Name the bucket: `images` (exactly as shown, case-sensitive)
5. Choose bucket settings:
   - **Public bucket**: Check this if you want public images
   - **File size limit**: Set to 10MB or higher
   - **Allowed MIME types**: Leave empty or add `image/*`

### Step 2: Configure Bucket Settings

**Important**: For the backend to upload images, you have two options:

#### Option A: Disable RLS (Easier for development)
1. Go to Storage > Policies
2. Click on the `images` bucket
3. **Disable RLS** by toggling it off (or leave it enabled but create policies below)

#### Option B: Create Upload Policies (Recommended for production)
1. Go to Storage > Policies
2. Click on the `images` bucket
3. Create a policy for service role uploads:
   - Policy name: `Service Role Upload`
   - Allowed operation: `INSERT`
   - Target roles: `service_role`
   - Policy definition: `true`
4. Create a policy for service role updates:
   - Policy name: `Service Role Update`
   - Allowed operation: `UPDATE`
   - Target roles: `service_role`
   - Policy definition: `true`

#### For Reading Images:

For **public images**:
1. Create a policy for public read access:
   - Policy name: `Public Read Access`
   - Allowed operation: `SELECT`
   - Target roles: `public`
   - Policy definition: `true` (allows all reads)

For **private images** (trip members only):
1. Create a policy for authenticated users:
   - Policy name: `Authenticated Read Access`
   - Allowed operation: `SELECT`
   - Target roles: `authenticated`
   - Policy definition: `true` (allows authenticated users to read)

### Step 3: Verify Environment Variables

Make sure your `apps/backend/.env` file has:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

To get these values:
1. Go to Supabase Dashboard > Settings > API
2. Copy the **Project URL** → `SUPABASE_URL`
3. Copy the **service_role** key (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Test the Setup

After creating the bucket, restart your backend server:

```bash
cd apps/backend
pnpm dev
```

Try uploading an image. If you still get errors, check:
- Bucket name is exactly `images` (case-sensitive)
- Service role key is correct (not anon key)
- Bucket is created and visible in Storage dashboard

## Troubleshooting

### Error: "Bucket not found"
- **Solution**: Create the bucket named `images` in Supabase Storage dashboard
- Make sure the name matches exactly (case-sensitive)

### Error: "Invalid API key"
- **Solution**: Use the `service_role` key, not the `anon` key
- The service role key has full access needed for uploads

### Error: "new row violates row-level security policy" or "RLS policy violation"
- **Solution**: 
  1. Go to Storage > Policies for the `images` bucket
  2. Either disable RLS for the bucket, OR
  3. Create policies that allow `service_role` to INSERT and UPDATE
  4. Make sure you're using the `service_role` key (not `anon` key) in your `.env`
  5. The service role key should bypass RLS, but bucket-level policies may still apply

### Images not loading
- **Solution**: 
  - For public images: Enable "Public bucket" setting
  - For private images: Configure RLS policies correctly
  - Check that the bucket allows the file types you're uploading

## Bucket Configuration Example

```
Bucket Name: images
Public: Yes (for public images) or No (with RLS policies for private)
File size limit: 10 MB
Allowed MIME types: image/*
```

## Next Steps

Once the bucket is created:
1. Restart your backend server
2. Try uploading an image through the frontend
3. Check the Supabase Storage dashboard to verify files are being uploaded

