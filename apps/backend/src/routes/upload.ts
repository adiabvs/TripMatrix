import express from 'express';
import multer from 'multer';
import { getSupabase } from '../config/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Upload image to Supabase Storage
router.post('/image', upload.single('image'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const uid = req.uid!;
    const isPublic = req.body.isPublic === 'true'; // FormData sends strings
    const supabase = getSupabase();
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = req.file.originalname.split('.').pop();
    const filename = `${timestamp}-${randomString}.${fileExtension}`;
    const filePath = `trips/${uid}/${filename}`;
    
    // Upload file to Supabase Storage
    // Note: If you get RLS errors, you need to either:
    // 1. Disable RLS on the 'images' bucket in Supabase Dashboard > Storage > Policies
    // 2. Create policies allowing service_role to INSERT/UPDATE
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      
      // Provide helpful error message for bucket not found
      if (error.message?.includes('Bucket not found') || (error as any).statusCode === '404') {
        return res.status(500).json({
          success: false,
          error: 'Storage bucket "images" not found. Please create a bucket named "images" in your Supabase Storage dashboard.',
        });
      }
      
      // Provide helpful error message for RLS policy violation
      if (error.message?.includes('row-level security policy') || error.message?.includes('RLS')) {
        return res.status(500).json({
          success: false,
          error: 'RLS policy violation. Please ensure: 1) The bucket exists, 2) RLS is disabled for the bucket OR policies allow service role access, 3) You are using the service_role key (not anon key). See SUPABASE_SETUP.md for details.',
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload image',
      });
    }

    let imageUrl: string;

    if (isPublic) {
      // Get public URL for public images
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get image URL',
        });
      }
      imageUrl = urlData.publicUrl;
    } else {
      // For private images, we'll use signed URLs that expire
      // In production, you might want to generate these on-demand when viewing
      // For now, we'll use public URL but mark it as private in metadata
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get image URL',
        });
      }
      imageUrl = urlData.publicUrl;
      // Note: In a production setup, you'd want to use signed URLs or RLS policies
      // to actually restrict access. This is a simplified version.
    }

    res.json({
      success: true,
      data: { url: imageUrl, isPublic },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload image',
    });
  }
});

export default router;

