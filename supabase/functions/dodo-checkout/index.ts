// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CheckoutPayload {
  course_id: string;
  course_title: string;
  course_price: number;
  user_email: string;
  user_id: string;
}

console.info('dodo-checkout function started');

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
    const dodoApiKey = Deno.env.get('DODO_PAYMENTS_API_KEY');
    const dodoProductId = Deno.env.get('DODO_PRODUCT_ID');
    
    // Get app URL from environment or request origin
    // Priority: 1. Environment variable, 2. Request origin header, 3. Fallback (should not happen in production)
    const origin = req.headers.get('Origin') || req.headers.get('Referer');
    let appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || Deno.env.get('VITE_APP_URL');
    
    if (!appUrl && origin) {
      // Extract base URL from origin/referer (remove path)
      try {
        const url = new URL(origin);
        appUrl = `${url.protocol}//${url.host}`;
      } catch (e) {
        // If parsing fails, use origin as-is
        appUrl = origin.split('/').slice(0, 3).join('/');
      }
    }
    
    // Only use localhost as fallback if we're in development
    // In production, this should be set via environment variable
    if (!appUrl) {
      console.warn('WARNING: No app URL configured. Using localhost fallback. Set NEXT_PUBLIC_APP_URL or VITE_APP_URL in Supabase secrets.');
      appUrl = 'http://localhost:3000';
    }
    
    const dodoApiUrl = Deno.env.get('DODO_PAYMENTS_API_URL') || 'https://test.dodopayments.com';

    console.log('Environment check:', {
      hasDodoApiKey: !!dodoApiKey,
      hasDodoProductId: !!dodoProductId,
      dodoProductId: dodoProductId,
      appUrl: appUrl,
      dodoApiUrl: dodoApiUrl
    });

    if (!dodoApiKey) {
      console.error('DODO_PAYMENTS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DODO Payments API key not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!dodoProductId) {
      console.error('DODO_PRODUCT_ID not configured');
      return new Response(
        JSON.stringify({ error: 'DODO Product ID not configured. Please set DODO_PRODUCT_ID secret.' }),
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
    const { course_id, course_title, course_price, user_email, user_id }: CheckoutPayload = await req.json();

    console.log('Request body:', { course_id, course_title, course_price, user_email, user_id });

    if (!course_id || !course_title || course_price === undefined || !user_email || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', received: { course_id, course_title, course_price, user_email, user_id } }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Verify user_id matches authenticated user
    if (user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Check if course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, price, status')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      console.error('Course not found:', courseError);
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Check if user already has an approved enrollment
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', user_id)
      .eq('course_id', course_id)
      .eq('status', 'approved')
      .single();

    if (existingEnrollment) {
      return new Response(
        JSON.stringify({ error: 'You are already enrolled in this course' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Convert TND price to USD
    // TND is not supported by DODO, so we convert to USD
    // Exchange rate: 1 USD = 3.3 TND
    const TND_TO_USD_RATE = parseFloat(Deno.env.get('TND_TO_USD_RATE') || '3.3');
    const priceInUSD = course_price / TND_TO_USD_RATE;
    const priceInCents = Math.round(priceInUSD * 100);
    
    console.log('Price conversion:', {
      original_tnd: course_price,
      exchange_rate: TND_TO_USD_RATE,
      converted_usd: priceInUSD,
      cents: priceInCents
    });

    // Get user's full name from metadata or profile
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user_email.split('@')[0];
    
    const checkoutBody = {
      product_cart: [{
        product_id: dodoProductId,
        quantity: 1,
        amount: priceInCents  // Price in USD cents (converted from TND)
      }],
      customer: {
        email: user_email,
        name: userName
      },
      // Don't pre-fill billing address - let user enter manually
      // Feature flags to minimize form fields
      feature_flags: {
        allow_phone_number_collection: false,  // Don't ask for phone
        allow_tax_id: false,  // Don't ask for tax ID
        allow_discount_code: false,  // Don't show discount code
        allow_currency_selection: false,  // Don't allow changing currency
        always_create_new_customer: false  // Use existing customer if any
      },
      // Note: TND is not supported by DODO Payments
      // Price is converted from TND to USD using exchange rate (1 USD = 3.3 TND)
      // Return to course page - actual status will be checked via enrollment lookup
      // Don't assume success - the frontend will check if enrollment exists
      return_url: `${appUrl}/courses/${course_id}?payment_method=dodo&check_enrollment=true`,
      metadata: {
        user_id: user_id,
        user_email: user_email,
        course_id: course_id,
        course_title: course_title,
        course_price: course_price.toString(),
        currency: 'TND',
        exchange_rate: TND_TO_USD_RATE.toString(),
        payment_method: 'dodo'
      }
    };

    console.log('DODO API request:', {
      url: `${dodoApiUrl}/checkouts`,
      body: JSON.stringify(checkoutBody, null, 2)
    });

    const checkoutResponse = await fetch(`${dodoApiUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutBody),
    });

    const responseText = await checkoutResponse.text();
    console.log('DODO API request body:', JSON.stringify(checkoutBody, null, 2));
    console.log('DODO API response status:', checkoutResponse.status);
    console.log('DODO API response:', responseText);

    if (!checkoutResponse.ok) {
      let errorData = {};
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { raw: responseText, parse_error: e.message };
      }
      console.error('DODO API error details:', {
        status: checkoutResponse.status,
        statusText: checkoutResponse.statusText,
        error: errorData,
        request_body: checkoutBody
      });
      
      // Return detailed error for debugging
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout session',
          message: errorData.message || errorData.error || 'Unknown error from DODO API',
          dodo_error: errorData,
          dodo_status: checkoutResponse.status,
          product_id_used: dodoProductId,
          request_body: checkoutBody
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

    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse DODO response:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid response from DODO Payments', raw: responseText }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // DODO returns checkout_url for the checkout URL
    const checkoutUrl = checkoutData.checkout_url;

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', checkoutData);
      return new Response(
        JSON.stringify({ error: 'Invalid response from DODO Payments - no checkout URL', data: checkoutData }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('Checkout created successfully:', { checkoutUrl, sessionId: checkoutData.session_id });

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        session_id: checkoutData.session_id,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in dodo-checkout function:', error);
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
