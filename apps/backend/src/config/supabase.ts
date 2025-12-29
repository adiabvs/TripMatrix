import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

export function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.warn('⚠️  SUPABASE_URL is not set. Database operations will not work.');
    return;
  }

  if (!supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set. Some features may not work.');
  }

  try {
    // Service role client (for admin operations)
    if (supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log('✅ Supabase service role client initialized');
    }

    // Anon client (for user operations with RLS)
    if (supabaseAnonKey) {
      supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log('✅ Supabase anon client initialized');
    }
  } catch (error: any) {
    console.error('❌ Supabase initialization error:', error.message);
    console.warn('⚠️  Continuing without Supabase. Some features will not work.');
  }
}

export function getSupabase() {
  if (!supabaseClient) {
    throw new Error(
      'Supabase service role client is not initialized. Check your .env file for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return supabaseClient;
}

export function getSupabaseAnon() {
  if (!supabaseAnonClient) {
    throw new Error(
      'Supabase anon client is not initialized. Check your .env file for SUPABASE_URL and SUPABASE_ANON_KEY.'
    );
  }
  return supabaseAnonClient;
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
      const { error: createError } = await supabaseClient.storage.createBucket('images', {
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

