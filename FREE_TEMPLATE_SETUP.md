# Free Canva Template Setup Guide

## Template Information

**Template Link**: https://www.canva.com/templates/EAE6Hk0oH7I-minimal-travel-photo-presentation/

**Template Name**: Minimal Travel Photo Presentation

## Setup Steps

### Step 1: Open and Customize the Template

1. **Open the Template**
   - Click the template link above
   - Click "Use template" or "Customize this template"
   - This will create a copy in your Canva account

2. **Adjust Element Positions** (one-time setup)
   - **Time** → Move to top (small text)
   - **Place** → Move below time (bigger, bold text)
   - **Temperature** → Move to bottom-right (small text)
   - **Comments** → Keep on left side (paragraph text)
   - **Cover Image** → Keep in center (large image frame)

3. **Configure Data Autofill App**

   a. Open the "Data autofill" app in Canva:
      - Click **Apps** in the left menu
      - Search for "Data autofill"
      - Click to open it
   
   b. Select **Custom** as your data source
   
   c. Click **Continue**
   
   d. For each element, click it and rename:
      - Select the **time** text box → Click "Data Field" → Enter: `time`
      - Select the **place** text box → Click "Data Field" → Enter: `place`
      - Select the **comments** text box → Click "Data Field" → Enter: `comments`
      - Select the **temperature** text box → Click "Data Field" → Enter: `temperature`
      - Select the **cover_image** image frame → Click "Data Field" → Enter: `cover_image`

   e. Verify you have 5 fields:
      - `time` (text)
      - `place` (text)
      - `comments` (text)
      - `temperature` (text)
      - `cover_image` (image)

### Step 2: Publish as Brand Template

1. **Publish the Design**
   - Click the **Share** button (top right)
   - Select **Publish as Brand Template**
   - Note: This requires Canva Enterprise or development access
   - If you don't have Enterprise, you can request development access when setting up your integration

2. **Get the Brand Template ID**
   - After publishing, you'll get a URL like:
     `https://www.canva.com/brand/brand-templates/XXXXX`
   - The Brand Template ID is the `XXXXX` part at the end
   - Copy this ID

### Step 3: Configure Environment Variable

Add the Brand Template ID to `apps/backend/.env`:

```env
CANVA_BRAND_TEMPLATE_ID=XXXXX
```

Replace `XXXXX` with your actual Brand Template ID.

### Step 4: Restart Backend Server

After adding the environment variable, restart your backend server.

## Field Mapping

The system automatically maps your trip data to the template:

| Template Field | Trip Data Source | Format |
|---------------|------------------|--------|
| `time` | `place.visitedAt` | "2:30 PM" (12-hour format) |
| `place` | `place.name` | Place name |
| `comments` | `place.rewrittenComment` or `place.comment` | Place description |
| `cover_image` | First image from place, or `trip.coverImage` | Image asset |
| `temperature` | (Empty) | Can be extended later |

## How It Works

1. **User creates travel diary** → System collects trip data
2. **Images uploaded** → All trip images uploaded to Canva as assets
3. **Template queried** → System gets available fields from your template
4. **Data mapped** → Trip data mapped to template fields
5. **Autofill job created** → Canva generates the design
6. **Design returned** → User gets fully populated design

## Troubleshooting

### "CANVA_BRAND_TEMPLATE_ID not set"
- Make sure you added the Brand Template ID to `.env`
- Restart your backend server

### "Failed to get brand template dataset"
- Verify the template ID is correct
- Make sure the template is published as a Brand Template
- Check that your integration has `brandtemplate:content:read` scope

### "Field not found" errors
- Verify field names match exactly: `time`, `place`, `comments`, `temperature`, `cover_image`
- Check that all fields are configured in the Data autofill app
- Field names are case-sensitive in the API but we match case-insensitively

### Template not working
- Make sure you published it as a **Brand Template**, not just a regular design
- Verify you have Canva Enterprise or development access
- Check that the Data autofill app is properly configured

## Notes

- **Free Template**: This template works on Canva Free, but Brand Templates require Enterprise
- **Development Access**: You can request development access for Brand Templates even without Enterprise
- **Multiple Places**: Currently creates one design with the first place. You can duplicate slides in Canva for other places
- **Temperature Field**: Currently left empty. Can be extended to include weather data if available

## Next Steps

1. ✅ Open the template
2. ✅ Configure Data autofill fields
3. ✅ Publish as Brand Template
4. ✅ Get Brand Template ID
5. ✅ Add to `.env` file
6. ✅ Restart backend
7. ✅ Test by creating a travel diary!


