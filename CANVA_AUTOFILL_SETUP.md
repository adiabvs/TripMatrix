# Canva Design Generation Setup Guide

This guide explains how to set up automatic design generation in Canva. You can use either:

1. **Without Brand Templates** (Simpler): Creates empty design and uploads images to media library
2. **With Brand Templates** (Automatic): Uses Autofill API to automatically populate designs with content

## Overview

### Option 1: Without Brand Templates (Default)

- Creates an empty presentation design
- Uploads all trip images to user's Canva media library
- Optionally adds cover image to the design
- User opens design in Canva editor and adds images/text manually
- **No setup required** - works immediately

### Option 2: With Brand Templates (Automatic)

- Uses Autofill API to automatically populate designs
- Creates fully populated design with trip data (title, description, images, place info)
- Requires Canva Enterprise subscription
- Requires creating and configuring a Brand Template

**Official Documentation**: 
- [Canva Connect API](https://www.canva.dev/docs/connect/)
- [Autofill Guide](https://www.canva.dev/docs/connect/autofill-guide/)
- [API Reference](https://www.canva.dev/docs/connect/api-reference/)

## API Endpoints Used

The implementation uses the official Canva Connect API endpoints:

- **Base URL**: `https://api.canva.com/rest/v1`
- **Create Design**: `POST /designs`
- **Get Brand Template Dataset**: `GET /brand-templates/{TEMPLATE-ID}/dataset`
- **Create Autofill Job**: `POST /autofills`
- **Get Autofill Job Status**: `GET /autofills/{JOB-ID}`

## Prerequisites

### For Option 1 (Without Templates)
- **No special requirements** - works with any Canva account
- Only needs basic scopes: `design:meta:read`, `asset:read`, `asset:write`

### For Option 2 (With Brand Templates)
1. **Canva Enterprise Subscription** (or development access)
   - Autofill and Brand Templates require Canva Enterprise
   - You can request development access when setting up your integration
   - Users of your integration must have Canva Enterprise

2. **Integration with Required Scopes**
   - `design:content:read`, `design:content:write`
   - `design:meta:read`
   - `brandtemplate:content:read`, `brandtemplate:meta:read`
   - `asset:read`, `asset:write` (for image uploads)

## Step 1: Create a Brand Template

### 1.1 Create the Template Design

1. Log in to Canva with an Enterprise account
2. Create a **Presentation (16:9)** design
3. Add text blocks and image frames that you want to be autofillable
4. Style your template however you want

**Example template structure:**
- Cover page with:
  - Trip title text block
  - Trip description text block
  - Cover image frame
- Place pages with:
  - Place name text block
  - Place description text block
  - Place image frame

### 1.2 Configure Data Autofill App

1. Open your template design in Canva
2. Click **Apps** in the left menu
3. Search for **"Data autofill"** app and open it
4. Select **Custom** as your data source
5. Click **Continue**

6. For each text block you want to autofill:
   - Select the text block
   - Click **Data Field** button
   - Enter a field name (e.g., `TRIP_TITLE`, `PLACE_NAME`)
   - Use uppercase with underscores (recommended)

7. For each image frame you want to autofill:
   - Select the image frame
   - Click **Data Field** button
   - Enter a field name (e.g., `COVER_IMAGE`, `PLACE_IMAGE`)

**Field naming recommendations:**
- `TRIP_TITLE` - Trip title
- `TRIP_DESCRIPTION` - Trip description
- `COVER_IMAGE` - Cover image
- `PLACE_NAME` - Place name
- `PLACE_DESCRIPTION` - Place description/comment
- `PLACE_IMAGE` - Place image

### 1.3 Publish as Brand Template

1. Publish your design as a **Brand Template**
2. Note the **Brand Template ID** from the URL
   - Example: `https://www.canva.com/brand/brand-templates/AEN3TrQftXo`
   - Template ID: `AEN3TrQftXo`

## Step 2: Configure Environment Variable

Add the brand template ID to your backend `.env` file:

```env
CANVA_BRAND_TEMPLATE_ID=AEN3TrQftXo
```

Replace `AEN3TrQftXo` with your actual brand template ID.

### Step 2: Test the Integration

1. Complete a trip with images and places
2. Click "Create Travel Diary"
3. The system will:
   - Upload images to Canva
   - Query your brand template's dataset
   - Create an autofill job with trip data
   - Generate a fully populated design
   - Open it in the Canva editor

## How It Works

1. **Get Template Dataset**: Queries the brand template to see available fields
2. **Upload Images**: Uploads trip images as Canva assets
3. **Map Data**: Maps trip data to template fields:
   - Text fields: Trip title, description, place names, comments
   - Image fields: Cover image, place images
4. **Create Autofill Job**: Creates an async job to generate the design
5. **Wait for Completion**: Polls job status until design is ready
6. **Return Design**: Returns the generated design URL

## Field Mapping

The system automatically maps common field names:

**Text Fields:**
- Fields containing "TITLE" → Trip title
- Fields containing "DESCRIPTION" → Trip description
- Fields containing "PLACE" and "NAME" → Place name
- Fields containing "PLACE" and "DESCRIPTION" → Place description/comment

**Image Fields:**
- Fields containing "COVER" → Cover image
- Fields containing "PLACE" and "IMAGE" → Place images

## Customizing Field Mapping

To customize how trip data maps to your template fields, edit:
`apps/backend/src/services/canvaDesignGenerator.ts`

In the `generateTravelDiaryDesign` function, modify the field mapping logic in Step 4.

## Troubleshooting

### Error: "CANVA_BRAND_TEMPLATE_ID environment variable is not set"
- Add `CANVA_BRAND_TEMPLATE_ID` to your `.env` file
- Restart your backend server

### Error: "Failed to get brand template dataset"
- Verify the template ID is correct
- Ensure your integration has `brandtemplate:content:read` scope
- Check that the template is published as a brand template

### Error: "Autofill job failed"
- Check that all required fields in your template are filled
- Verify image assets were uploaded successfully
- Check Canva API status page for service issues

### Design is empty or missing content
- Verify your template fields match the expected names
- Check that trip data exists (title, description, images)
- Review the autofill data in backend logs

## Notes

- **Canva Enterprise Required**: Users must have Canva Enterprise to use autofill
- **Template Updates**: If you update your template, republish it and update the template ID
- **Multiple Pages**: The current implementation uses the first place for single-page templates. For multi-page templates, you may need to create multiple autofill jobs or use a different approach.

