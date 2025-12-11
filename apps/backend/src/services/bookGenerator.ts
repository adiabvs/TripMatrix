import PDFDocument from 'pdfkit';
import type { Trip, TripPlace, ModeOfTravel } from '@tripmatrix/types';
import { format } from 'date-fns';
import { getSupabase } from '../config/supabase.js';
import { toDateSafe } from '../utils/dateUtils.js';

const modeIcons: Record<ModeOfTravel, string> = {
  walk: '🚶',
  bike: '🚴',
  car: '🚗',
  train: '🚂',
  bus: '🚌',
  flight: '✈️',
};

const modeLabels: Record<ModeOfTravel, string> = {
  walk: 'Walking',
  bike: 'Biking',
  car: 'Driving',
  train: 'Train',
  bus: 'Bus',
  flight: 'Flight',
};

interface BookGenerationOptions {
  trip: Trip;
  places: TripPlace[];
  userId: string;
}

export async function generateTravelDiary({
  trip,
  places,
  userId,
}: BookGenerationOptions): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Helper to add page break
      const addPageBreak = () => {
        doc.addPage();
      };

      // Helper to add centered text
      const addCenteredText = (text: string, fontSize: number, y?: number) => {
        const pageWidth = doc.page.width;
        doc.fontSize(fontSize);
        const textWidth = doc.widthOfString(text);
        const x = (pageWidth - textWidth) / 2;
        const finalY = y !== undefined ? y : doc.y;
        doc.text(text, x, finalY);
      };

      // Helper to load and add image
      const addImage = async (imageUrl: string, options?: { width?: number; height?: number; x?: number; y?: number }) => {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) return false;
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          const width = options?.width || 500;
          const height = options?.height || undefined;
          const x = options?.x || (doc.page.width - width) / 2;
          const y = options?.y !== undefined ? options.y : doc.y;
          
          doc.image(imageBuffer, x, y, { width, height });
          return true;
        } catch (error) {
          console.error('Failed to load image:', error);
          return false;
        }
      };

      // FRONT PAGE - Cover
      if (trip.coverImage) {
        const imageAdded = await addImage(trip.coverImage, { width: doc.page.width - 100, height: doc.page.height - 200, x: 50, y: 50 });
        if (!imageAdded) {
          // If image fails, add a colored background
          doc.rect(50, 50, doc.page.width - 100, doc.page.height - 200).fill('#6750A4');
        }
      } else {
        // Add colored background if no cover image
        doc.rect(50, 50, doc.page.width - 100, doc.page.height - 200).fill('#6750A4');
      }

      // Title on cover
      doc.fillColor('#FFFFFF');
      addCenteredText(trip.title, 36, doc.page.height / 2 - 50);
      
      if (trip.description) {
        doc.fontSize(16);
        doc.text(trip.description, 50, doc.page.height / 2 + 20, {
          width: doc.page.width - 100,
          align: 'center',
        });
      }

      // Date range on cover
      const startDateObj = toDateSafe(trip.startTime);
      const endDateObj = trip.endTime ? toDateSafe(trip.endTime) : null;
      
      if (!startDateObj) {
        throw new Error('Invalid start time for trip');
      }
      
      const startDate = format(startDateObj, 'MMMM yyyy');
      const endDate = endDateObj ? format(endDateObj, 'MMMM yyyy') : 'Present';
      doc.fontSize(14);
      const dateText = `${startDate} - ${endDate}`;
      const dateWidth = doc.widthOfString(dateText);
      const dateX = (doc.page.width - dateWidth) / 2;
      doc.text(dateText, dateX, doc.page.height - 100);

      addPageBreak();

      // CHAPTER PAGES - Each place is a chapter
      const sortedPlaces = [...places].sort((a, b) => {
        const dateA = toDateSafe(a.visitedAt);
        const dateB = toDateSafe(b.visitedAt);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });

      for (let i = 0; i < sortedPlaces.length; i++) {
        const place = sortedPlaces[i];
        const previousPlace = i > 0 ? sortedPlaces[i - 1] : null;

        // Chapter title page
        doc.fillColor('#000000');
        addCenteredText(`Chapter ${i + 1}`, 24, 100);
        addCenteredText(place.name, 32, 150);
        
        const visitedDateObj = toDateSafe(place.visitedAt);
        if (!visitedDateObj) {
          throw new Error(`Invalid visited date for place: ${place.name}`);
        }
        const visitedDate = format(visitedDateObj, 'MMMM d, yyyy');
        doc.fontSize(16);
        const dateWidth2 = doc.widthOfString(visitedDate);
        const dateX2 = (doc.page.width - dateWidth2) / 2;
        doc.text(visitedDate, dateX2, 200);

        // Mode of travel illustration between chapters
        if (previousPlace && place.modeOfTravel) {
          doc.fontSize(48);
          const iconText = modeIcons[place.modeOfTravel];
          const iconWidth = doc.widthOfString(iconText);
          const iconX = (doc.page.width - iconWidth) / 2;
          doc.text(iconText, iconX, 250);
          
          doc.fontSize(14);
          let modeText = `${modeLabels[place.modeOfTravel]} from ${previousPlace.name}`;
          if (place.distanceFromPrevious) {
            const distanceKm = (place.distanceFromPrevious / 1000).toFixed(1);
            modeText = `${modeText} (${distanceKm} km)`;
          }
          const modeWidth = doc.widthOfString(modeText);
          const modeX = (doc.page.width - modeWidth) / 2;
          doc.text(modeText, modeX, 320);
        }

        addPageBreak();

        // Chapter content page
        // Add photos
        const images = place.imageMetadata || place.images?.map(url => ({ url, isPublic: false })) || [];
        
        if (images.length > 0) {
          // Add first image large
          await addImage(images[0].url, { 
            width: doc.page.width - 100, 
            height: 300,
            x: 50,
            y: 50
          });
          
          if (images.length > 1) {
            // Add remaining images in grid
            const imagesPerRow = 2;
            const imageWidth = (doc.page.width - 150) / imagesPerRow;
            const imageHeight = 150;
            
            for (let j = 1; j < Math.min(images.length, 5); j++) {
              const row = Math.floor((j - 1) / imagesPerRow);
              const col = (j - 1) % imagesPerRow;
              const x = 50 + col * (imageWidth + 50);
              const y = 370 + row * (imageHeight + 20);
              
              await addImage(images[j].url, { width: imageWidth, height: imageHeight, x, y });
            }
          }
        }

        // Add comment/description
        if (place.rewrittenComment || place.comment) {
          doc.fillColor('#333333');
          doc.fontSize(12);
          const commentY = images.length > 0 ? doc.page.height - 150 : 100;
          doc.text(place.rewrittenComment || place.comment || '', 50, commentY, {
            width: doc.page.width - 100,
            align: 'left',
          });
        }

        // Add rating if available
        if (place.rating) {
          doc.fontSize(14);
          const ratingText = '⭐'.repeat(place.rating);
          const ratingWidth = doc.widthOfString(ratingText);
          const ratingX = (doc.page.width - ratingWidth) / 2;
          doc.text(ratingText, ratingX, doc.page.height - 100);
        }

        addPageBreak();
      }

      // LAST PAGE - TripMatrix Logo
      doc.fillColor('#6750A4');
      addCenteredText('TripMatrix', 48, doc.page.height / 2 - 50);
      doc.fontSize(16);
      addCenteredText('Your Travel Stories, Preserved Forever', 16, doc.page.height / 2 + 20);
      
      const logoText = 'Created with TripMatrix';
      const logoWidth = doc.widthOfString(logoText);
      const logoX = (doc.page.width - logoWidth) / 2;
      doc.text(logoText, logoX, doc.page.height - 100);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function uploadDiaryToStorage(
  pdfBuffer: Buffer,
  tripId: string,
  userId: string
): Promise<string> {
  const supabase = getSupabase();
  
  // Generate unique filename
  const timestamp = Date.now();
  const fileName = `${timestamp}.pdf`;
  const filePath = `diaries/${userId}/${tripId}/${fileName}`;
  
  // Upload PDF to Supabase Storage (using the same 'images' bucket)
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Supabase upload error:', error);
    
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

  return urlData.publicUrl;
}
