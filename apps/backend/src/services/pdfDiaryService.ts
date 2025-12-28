/**
 * PDF Diary Service
 * Generates travel diary PDFs from trip data using HTML styling
 * Stores PDFs in Supabase Storage
 */

import puppeteer from 'puppeteer';
import type { Trip, TripPlace } from '@tripmatrix/types';
import { getSupabase } from '../config/supabase.js';

export interface PDFDiaryResult {
  pdfUrl?: string; // Supabase URL if uploaded successfully
  fileName: string;
  downloadUrl?: string; // Download endpoint URL if Supabase upload failed
  pdfBuffer?: Buffer; // PDF buffer if Supabase upload failed (for download endpoint)
}

/**
 * Generate HTML content for the travel diary
 */
function generateDiaryHTML(trip: Trip, places: TripPlace[]): string {
  // Sort places by visitedAt
  const sortedPlaces = [...places].sort((a, b) => {
    const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
    const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
    return aTime - bTime;
  });

  // Format date
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get all images for a place
  const getPlaceImages = (place: TripPlace): string[] => {
    const images: string[] = [];
    if (place.imageMetadata) {
      images.push(...place.imageMetadata.map(img => img.url));
    }
    if (place.images) {
      images.push(...place.images);
    }
    return images.slice(0, 6); // Limit to 6 images per place
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.title} - Travel Diary</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .page {
      width: 8.5in;
      min-height: 11in;
      background: white;
      margin: 0 auto;
      padding: 0;
      page-break-after: always;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* Cover Page */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 11in;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 2in;
      position: relative;
      overflow: hidden;
    }
    
    .cover-page::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('${trip.coverImage || ''}') center/cover no-repeat;
      opacity: 0.2;
      z-index: 0;
    }
    
    .cover-content {
      position: relative;
      z-index: 1;
      width: 100%;
    }
    
    .cover-image {
      width: 100%;
      max-width: 500px;
      height: 350px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 2rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      ${trip.coverImage ? '' : 'display: none;'}
    }
    
    .cover-title {
      font-size: 3.5rem;
      font-weight: bold;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      line-height: 1.2;
    }
    
    .cover-subtitle {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      opacity: 0.95;
      font-style: italic;
    }
    
    .cover-dates {
      font-size: 1.2rem;
      margin-top: 2rem;
      opacity: 0.9;
    }
    
    /* Content Pages */
    .content-page {
      padding: 1in;
    }
    
    .place-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 3px solid #667eea;
    }
    
    .place-name {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    
    .place-date {
      font-size: 1rem;
      color: #666;
      font-style: italic;
    }
    
    .place-description {
      font-size: 1.1rem;
      line-height: 1.8;
      margin: 1.5rem 0;
      color: #444;
      text-align: justify;
    }
    
    .place-rating {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 1rem 0;
      font-size: 1.2rem;
    }
    
    .stars {
      color: #ffd700;
      font-size: 1.5rem;
    }
    
    .images-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .image-item {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.3s;
    }
    
    .images-grid.single {
      grid-template-columns: 1fr;
    }
    
    .images-grid.single .image-item {
      height: 400px;
    }
    
    .images-grid.double {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .images-grid.double .image-item {
      height: 300px;
    }
    
    .place-meta {
      display: flex;
      gap: 2rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.95rem;
      color: #666;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .meta-label {
      font-weight: 600;
      color: #667eea;
    }
    
    /* Footer */
    .page-footer {
      position: absolute;
      bottom: 0.5in;
      left: 1in;
      right: 1in;
      text-align: center;
      font-size: 0.85rem;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 0.5rem;
    }
    
    @media print {
      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="page cover-page">
    <div class="cover-content">
      ${trip.coverImage ? `<img src="${trip.coverImage}" alt="Cover" class="cover-image" />` : ''}
      <h1 class="cover-title">${trip.title}</h1>
      ${trip.description ? `<p class="cover-subtitle">${trip.description}</p>` : ''}
      <div class="cover-dates">
        ${trip.startTime ? `From ${formatDate(trip.startTime)}` : ''}
        ${trip.endTime ? ` to ${formatDate(trip.endTime)}` : ''}
      </div>
    </div>
  </div>
  
  <!-- Place Pages -->
  ${sortedPlaces.map((place, index) => {
    const images = getPlaceImages(place);
    const imageCount = images.length;
    let gridClass = '';
    if (imageCount === 1) gridClass = 'single';
    else if (imageCount === 2) gridClass = 'double';
    
    return `
  <div class="page content-page">
    <div class="place-header">
      <h2 class="place-name">${place.name}</h2>
      ${place.visitedAt ? `<div class="place-date">${formatDate(place.visitedAt)}</div>` : ''}
    </div>
    
    ${place.rewrittenComment || place.comment ? `
    <div class="place-description">
      ${place.rewrittenComment || place.comment}
    </div>
    ` : ''}
    
    ${place.rating ? `
    <div class="place-rating">
      <span class="stars">${'⭐'.repeat(place.rating)}</span>
      <span>${place.rating}/5</span>
    </div>
    ` : ''}
    
    ${images.length > 0 ? `
    <div class="images-grid ${gridClass}">
      ${images.map(img => `
        <img src="${img}" alt="${place.name}" class="image-item" />
      `).join('')}
    </div>
    ` : ''}
    
    <div class="place-meta">
      ${place.modeOfTravel ? `
      <div class="meta-item">
        <span class="meta-label">Travel Mode:</span>
        <span>${place.modeOfTravel}</span>
      </div>
      ` : ''}
      ${place.distanceFromPrevious ? `
      <div class="meta-item">
        <span class="meta-label">Distance:</span>
        <span>${(place.distanceFromPrevious / 1000).toFixed(2)} km</span>
      </div>
      ` : ''}
      ${place.country ? `
      <div class="meta-item">
        <span class="meta-label">Country:</span>
        <span>${place.country}</span>
      </div>
      ` : ''}
    </div>
    
    <div class="page-footer">
      Page ${index + 2} • ${trip.title}
    </div>
  </div>
    `;
  }).join('')}
</body>
</html>
  `;

  return html;
}

/**
 * Generate a travel diary PDF from trip data and upload to Supabase Storage
 */
export async function generatePDFDiary(
  trip: Trip,
  places: TripPlace[],
  userId: string
): Promise<PDFDiaryResult> {
  try {
    console.log('Generating PDF diary...');
    
    // Generate HTML content
    const html = generateDiaryHTML(trip, places);
    
    // Generate filename
    const timestamp = Date.now();
    const safeTitle = trip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `diary_${safeTitle}_${timestamp}.pdf`;
    
    // Launch puppeteer
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    let pdfBuffer: Buffer;
    
    try {
      const page = await browser.newPage();
      
      // Set content and wait for images to load
      // networkidle0 waits for network to be idle, which includes image loading
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });
      
      // Generate PDF as buffer
      console.log('Generating PDF file...');
      pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
      }) as Buffer;
      
      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    } finally {
      await browser.close();
    }
    
    // Upload to Supabase Storage
    console.log('Uploading PDF to Supabase Storage...');
    const supabase = getSupabase();
    const filePath = `diaries/${userId}/${trip.tripId}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('images')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      
      // Check if error is due to file size limit
      const isSizeError = error.message?.includes('exceeded the maximum allowed size') || 
                         error.message?.includes('maximum allowed size') ||
                         error.message?.includes('file too large') ||
                         (error as any).statusCode === '413';
      
      if (isSizeError) {
        console.warn('PDF too large for Supabase Storage, will use download endpoint instead');
        // Return download URL instead of Supabase URL
        return {
          fileName,
          downloadUrl: `/api/diary/download-pdf/${trip.tripId}`,
          pdfBuffer, // Keep buffer for download endpoint
        };
      }
      
      // Provide helpful error message for bucket not found
      if (error.message?.includes('Bucket not found') || (error as any).statusCode === '404') {
        throw new Error('Storage bucket "images" not found. Please create a bucket named "images" in your Supabase Storage dashboard.');
      }
      
      // Provide helpful error message for RLS policy violation
      if (error.message?.includes('row-level security policy') || error.message?.includes('RLS')) {
        throw new Error('RLS policy violation. Please ensure: 1) The bucket exists, 2) RLS is disabled for the bucket OR policies allow service role access, 3) You are using the service_role key (not anon key).');
      }
      
      throw new Error(error.message || 'Failed to upload diary PDF');
    }

    // Get public URL for the PDF
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get diary PDF URL');
    }

    console.log('PDF uploaded successfully:', urlData.publicUrl);
    
    return {
      pdfUrl: urlData.publicUrl,
      fileName,
    };
  } catch (error: any) {
    console.error('Failed to generate PDF diary:', error);
    throw new Error(`Failed to generate PDF diary: ${error.message}`);
  }
}

