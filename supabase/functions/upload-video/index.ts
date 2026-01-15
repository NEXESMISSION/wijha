// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UploadPayload {
  file?: File;
}

console.info('upload-video function started');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get environment variables
    const bunnyLibraryId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
    const bunnyApiKey = Deno.env.get('BUNNY_STREAM_API_KEY');
    const bunnyApiHostname = 'video.bunnycdn.com'; // API hostname for uploads
    const bunnyCdnHostname = Deno.env.get('BUNNY_STREAM_HOSTNAME') || `vz-${bunnyLibraryId}.b-cdn.net`; // CDN hostname for playback

    if (!bunnyLibraryId || !bunnyApiKey) {
      return new Response(
        JSON.stringify({ error: 'Bunny Stream credentials not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Create client with anon key to validate user token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    console.log('Verifying token, length:', token.length);
    console.log('Token starts with:', token.substring(0, 20));
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (userError || !user) {
      console.error('Authentication error:', userError?.message || 'No user found');
      console.error('Token length:', token.length);
      console.error('Full error:', JSON.stringify(userError));
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: userError?.message || 'Invalid JWT',
          code: userError?.status || 401
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    console.log('User authenticated:', user.id);

    // Parse FormData from request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return new Response(
        JSON.stringify({ error: 'File must be a video' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate file size (max 2GB)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 2GB limit' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Step 0: Get or create user collection (folder) in Bunny Stream
    console.log('Getting or creating user collection...');
    const userId = user.id;
    const userEmail = user.email || 'unknown';
    const collectionName = `user_${userId.substring(0, 8)}`;
    
    // First, list existing collections to find user's collection
    let collectionId: string | null = null;
    
    const listCollectionsUrl = `https://${bunnyApiHostname}/library/${bunnyLibraryId}/collections`;
    const collectionsResponse = await fetch(listCollectionsUrl, {
      method: 'GET',
      headers: {
        'AccessKey': bunnyApiKey,
        'accept': 'application/json',
      },
    });
    
    if (collectionsResponse.ok) {
      const collectionsData = await collectionsResponse.json();
      const existingCollection = collectionsData.items?.find((c: any) => c.name === collectionName);
      if (existingCollection) {
        collectionId = existingCollection.guid;
        console.log('Found existing collection:', collectionId);
      }
    }
    
    // If no collection exists for user, create one
    if (!collectionId) {
      console.log('Creating new collection for user:', collectionName);
      const createCollectionUrl = `https://${bunnyApiHostname}/library/${bunnyLibraryId}/collections`;
      const createCollectionResponse = await fetch(createCollectionUrl, {
        method: 'POST',
        headers: {
          'AccessKey': bunnyApiKey,
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          name: collectionName,
        }),
      });
      
      if (createCollectionResponse.ok) {
        const collectionData = await createCollectionResponse.json();
        collectionId = collectionData.guid;
        console.log('Created new collection:', collectionId);
      } else {
        console.log('Could not create collection, will upload without collection');
      }
    }

    // Step 1: Create video entry in Bunny Stream
    console.log('Creating video entry in Bunny Stream...');
    console.log('Library ID:', bunnyLibraryId);
    console.log('Collection ID:', collectionId);
    
    const createVideoUrl = `https://${bunnyApiHostname}/library/${bunnyLibraryId}/videos`;
    
    const requestHeaders = {
      'AccessKey': bunnyApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    };
    
    // Create video with collection assignment
    const videoTitle = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension for title
    const createVideoBody: any = {
      title: videoTitle,
    };
    
    // Assign to user's collection if available
    if (collectionId) {
      createVideoBody.collectionId = collectionId;
    }
    
    const createResponse = await fetch(createVideoUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(createVideoBody),
    });

    console.log('Bunny Stream response status:', createResponse.status);
    console.log('Bunny Stream response headers:', Object.fromEntries(createResponse.headers.entries()));

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Bunny Stream create video error:', errorText);
      console.error('Response status:', createResponse.status);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create video in Bunny Stream', 
          details: errorText,
          libraryId: bunnyLibraryId,
          apiKeyLength: bunnyApiKey.length,
          apiKeyPrefix: bunnyApiKey.substring(0, 4)
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const videoData = await createResponse.json();
    const videoId = videoData.guid;
    console.log('Video created with ID:', videoId);

    // Step 2: Upload the video file
    console.log('Uploading video file...');
    const uploadUrl = `https://${bunnyApiHostname}/library/${bunnyLibraryId}/videos/${videoId}`;

    const arrayBuffer = await file.arrayBuffer();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': bunnyApiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Bunny Stream upload error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to upload to Bunny Stream', details: errorText }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('Video uploaded successfully');

    // Generate URLs for playback and preview
    // IMPORTANT: Use embed URL as the primary video_url to avoid 403 errors with token authentication
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
    const thumbnailUrl = `https://${bunnyCdnHostname}/${videoId}/thumbnail.jpg`;
    const hlsUrl = `https://${bunnyCdnHostname}/${videoId}/playlist.m3u8`;
    const directPlayUrl = `https://${bunnyCdnHostname}/${videoId}/play_720p.mp4`;

    const data = {
      video_id: videoId,
      // Use embed URL as the main video_url - this works without token authentication
      video_url: embedUrl,
      thumbnail_url: thumbnailUrl,
      embed_url: embedUrl,
      hls_url: hlsUrl,
      direct_play_url: directPlayUrl,
      collection_id: collectionId,
      library_id: bunnyLibraryId,
      success: true,
    };

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in upload-video function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
