import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  Supabase credentials not found. Image uploads will not work.');
    console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env for image uploads.');
    return;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('✅ Supabase client initialized');
  } catch (error: any) {
    console.error('❌ Supabase initialization error:', error.message);
    console.warn('⚠️  Continuing without Supabase. Image uploads will not work.');
  }
}

export function getSupabase() {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client is not initialized. Check your .env file for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return supabaseClient;
}

export function isSupabaseInitialized() {
  return supabaseClient !== null;
}

// Ensure the images bucket exists and is configured correctly
export async function ensureImagesBucket() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseClient.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const imagesBucket = buckets?.find(bucket => bucket.name === 'images');
    
    if (!imagesBucket) {
      console.log('Creating images bucket...');
      // Try to create the bucket
      const { data, error: createError } = await supabaseClient.storage.createBucket('images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/*'],
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        console.warn('⚠️  Please create the bucket manually in Supabase Dashboard > Storage');
        return false;
      }

      console.log('✅ Images bucket created successfully');
      return true;
    }

    // Bucket exists, check if we can access it
    return true;
  } catch (error: any) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
}

