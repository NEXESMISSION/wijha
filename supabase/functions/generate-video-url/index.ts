// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts'

interface GenerateUrlPayload {
  video_id: string;
  lesson_id: string;
  device_id?: string;
}

console.info('generate-video-url function started');

// Token expiration time (in seconds) - 4 hours for better UX
const TOKEN_EXPIRATION = 4 * 3600;

/**
 * Generate a signed URL for Bunny Stream CDN using HMAC-SHA256
 * This provides secure, time-limited access to video content
 */
async function generateSignedUrl(
  videoPath: string, 
  cdnHostname: string,
  tokenKey: string,
  expiresAt: number,
  userId?: string,
  allowedCountries?: string[]
): Promise<string> {
  // Create the base URL
  const baseUrl = `https://${cdnHostname}${videoPath}`;
  
  // Build the token parameters
  const params: string[] = [];
  
  // Add expiration time
  params.push(`token_expires=${expiresAt}`);
  
  // Add user ID for tracking (optional)
  if (userId) {
    const userHash = userId.substring(0, 8);
    params.push(`token_user_id=${userHash}`);
  }
  
  // Add country restriction (optional)
  if (allowedCountries && allowedCountries.length > 0) {
    params.push(`token_countries=${allowedCountries.join(',')}`);
  }
  
  // Create the string to sign
  const signableUrl = `${videoPath}?${params.join('&')}`;
  
  // Generate HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(tokenKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signableUrl)
  );
  
  // Convert signature to base64 and make URL-safe
  const signatureArray = new Uint8Array(signature);
  const base64Signature = base64Encode(signatureArray)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Build final URL with all parameters
  params.push(`token_signature=${base64Signature}`);
  
  return `${baseUrl}?${params.join('&')}`;
}

/**
 * Generate a signed EMBED URL for Bunny Stream Player
 * This is for "Embed view token authentication" feature
 * Format: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token={hash}&expires={timestamp}
 * 
 * IMPORTANT: According to Bunny Stream docs, the token hash is:
 * SHA256(token_authentication_key + video_id + expiration_timestamp)
 */
async function generateSignedEmbedUrl(
  libraryId: string,
  videoId: string,
  tokenKey: string,
  expiresAt: number
): Promise<string> {
  // CORRECT FORMAT: tokenKey + videoId + expiresTimestamp (NO libraryId!)
  const stringToSign = `${tokenKey}${videoId}${expiresAt}`;
  
  console.log('Generating signed embed URL:', { libraryId, videoId, expiresAt, stringToSignLength: stringToSign.length });
  
  // Generate SHA256 hash (NOT HMAC - just regular SHA256)
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex
  const hashArray = new Uint8Array(hashBuffer);
  const hexHash = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Build the signed embed URL
  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${hexHash}&expires=${expiresAt}&autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
  
  console.log('Generated signed embed URL with token:', { token: hexHash, expires: expiresAt });
  
  return embedUrl;
}


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
    const bunnyCdnHostname = Deno.env.get('BUNNY_STREAM_HOSTNAME') || `vz-${bunnyLibraryId}.b-cdn.net`;

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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verify user is authenticated
    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(authToken);

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Parse request body
    const { video_id, lesson_id, device_id }: GenerateUrlPayload = await req.json();

    if (!video_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'video_id and lesson_id are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get lesson to find course_id
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        modules!inner(
          id,
          course_id,
          courses!inner(
            id
          )
        )
      `)
      .eq('id', lesson_id)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const courseId = lesson.modules.course_id;

    // Validate enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('status')
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .eq('status', 'approved')
      .single();

    if (enrollmentError || !enrollment) {
      return new Response(
        JSON.stringify({ error: 'Enrollment not found or not approved' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Generate token expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION;

    // Get Token Authentication Key from Bunny Stream settings
    const bunnyTokenKey = Deno.env.get('BUNNY_STREAM_TOKEN_KEY') || bunnyApiKey;
    
    // Generate signed URLs for different quality levels
    const video720pPath = `/${video_id}/play_720p.mp4`;
    const video480pPath = `/${video_id}/play_480p.mp4`;
    const video360pPath = `/${video_id}/play_360p.mp4`;
    const hlsPlaylistPath = `/${video_id}/playlist.m3u8`;
    
    // Generate signed playback URLs
    const signedHlsUrl = await generateSignedUrl(
      hlsPlaylistPath,
      bunnyCdnHostname,
      bunnyTokenKey,
      expiresAt,
      user.id
    );
    
    const signed720pUrl = await generateSignedUrl(
      video720pPath,
      bunnyCdnHostname,
      bunnyTokenKey,
      expiresAt,
      user.id
    );
    
    const signed480pUrl = await generateSignedUrl(
      video480pPath,
      bunnyCdnHostname,
      bunnyTokenKey,
      expiresAt,
      user.id
    );

    // Generate unique watermark code for this user/session
    const watermarkCode = `UID-${user.id.substring(0, 8).toUpperCase()}-${(device_id || 'UNK').substring(0, 6).toUpperCase()}`;
    
    // Generate a session-specific tracking token
    const sessionToken = crypto.randomUUID().substring(0, 8);
    const trackingCode = `${watermarkCode}-${sessionToken}`;
    
    // Generate SIGNED Embed URL (for "Embed view token authentication")
    const embedUrl = await generateSignedEmbedUrl(
      bunnyLibraryId,
      video_id,
      bunnyTokenKey,
      expiresAt
    );

    // Log video access event with detailed tracking
    try {
      await supabase.rpc('log_video_event', {
        p_student_id: user.id,
        p_lesson_id: lesson_id,
        p_device_id: device_id || 'unknown',
        p_event_type: 'VIDEO_TOKEN_GENERATED',
      });
      
      // Also log to audit_logs for security tracking
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'VIDEO_ACCESS',
        resource_type: 'lesson',
        resource_id: lesson_id,
        details: {
          video_id: video_id,
          device_id: device_id || 'unknown',
          tracking_code: trackingCode,
          expires_at: new Date(expiresAt * 1000).toISOString(),
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
          user_agent: req.headers.get('user-agent'),
        },
      });
    } catch (logError) {
      console.error('Error logging video event:', logError);
      // Don't fail the request if logging fails
    }

    const data = {
      // Signed URLs for secure playback
      playback_url: signedHlsUrl,
      playback_url_720p: signed720pUrl,
      playback_url_480p: signed480pUrl,
      embed_url: embedUrl,
      
      // Security metadata
      expires_at: new Date(expiresAt * 1000).toISOString(),
      watermark_code: watermarkCode,
      tracking_code: trackingCode,
      
      // Token validity (seconds remaining)
      valid_for_seconds: TOKEN_EXPIRATION,
      
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
    console.error('Error in generate-video-url function:', error);
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
