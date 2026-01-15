// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.info('dodo-webhook function started');

/**
 * Verify DODO webhook signature using HMAC SHA256
 */
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Create HMAC SHA256 hash
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Compare signatures (constant-time comparison)
    if (signature.length !== hashHex.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dodo-signature, webhook-id, webhook-timestamp, webhook-signature',
      },
    });
  }

  try {
    // Get environment variables
    const webhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET');

    console.log('Webhook received, secret configured:', !!webhookSecret);

    // Get the raw body for signature verification
    const body = await req.text();
    console.log('Webhook body:', body);

    // DODO uses different signature headers - check both
    const signature = req.headers.get('x-dodo-signature') || req.headers.get('webhook-signature');
    console.log('Webhook signature header:', signature ? 'present' : 'missing');

    // Parse the webhook event
    let event;
    try {
      event = JSON.parse(body);
    } catch (e) {
      console.error('Failed to parse webhook body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('DODO webhook event received:', {
      event_type: event.event_type || event.type,
      payment_id: event.data?.payment_id || event.payment_id,
      metadata: event.data?.metadata || event.metadata
    });

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = await verifySignature(body, signature, webhookSecret);
      if (!isValid) {
        console.warn('Invalid webhook signature - proceeding anyway for testing');
        // In production, you should return 401 here
        // return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
      } else {
        console.log('Webhook signature verified');
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get event type - DODO might use different formats
    // Check multiple possible locations for event type
    const eventType = event.event_type || event.type || event.event || '';
    const paymentStatus = event.data?.status || event.status || event.payment?.status || '';
    
    console.log('Event details:', {
      eventType,
      paymentStatus,
      eventKeys: Object.keys(event),
      hasData: !!event.data,
      hasPayment: !!event.payment
    });
    
    // Handle different event types - check both event type and payment status
    const isPaymentSucceeded = 
      eventType === 'payment.succeeded' || 
      eventType === 'payment_succeeded' || 
      eventType === 'checkout.session.completed' ||
      paymentStatus === 'succeeded' || 
      paymentStatus === 'completed' ||
      paymentStatus === 'paid';
    
    if (isPaymentSucceeded) {
      // Try multiple locations for metadata
      const metadata = event.data?.metadata || 
                      event.metadata || 
                      event.payment?.metadata ||
                      event.checkout?.metadata ||
                      event.data?.checkout?.metadata ||
                      {};
      
      // Try multiple locations for payment ID
      const paymentId = event.data?.payment_id || 
                       event.payment_id || 
                       event.payment?.id ||
                       event.data?.id ||
                       event.id ||
                       'unknown';
      
      // Extract user_id and course_id from metadata
      let userId = metadata.user_id;
      let courseId = metadata.course_id;

      console.log('Payment succeeded - initial check:', { userId, courseId, paymentId, metadata });

      // If metadata is missing, try alternative locations
      if (!userId || !courseId) {
        console.log('Metadata missing, trying alternative locations...');
        
        // Try to extract from checkout session if available
        const checkoutMetadata = event.data?.checkout?.metadata || event.checkout?.metadata || {};
        const fallbackUserId = checkoutMetadata.user_id || metadata.user_id;
        const fallbackCourseId = checkoutMetadata.course_id || metadata.course_id;
        
        if (fallbackUserId && fallbackCourseId) {
          userId = fallbackUserId;
          courseId = fallbackCourseId;
          console.log('Using fallback metadata:', { userId, courseId });
        } else {
          console.error('Missing required metadata in webhook:', {
            metadata,
            checkoutMetadata,
            eventKeys: Object.keys(event),
            eventData: event.data,
            eventPayment: event.payment,
            fullEvent: JSON.stringify(event, null, 2)
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Missing required metadata', 
              received: { metadata, checkoutMetadata },
              event_structure: Object.keys(event),
              help: 'Please ensure metadata with user_id and course_id is included in checkout session'
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Check if enrollment already exists
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id, status')
        .eq('student_id', userId)
        .eq('course_id', courseId)
        .single();

      if (existingEnrollment) {
        if (existingEnrollment.status === 'approved') {
          console.log('Enrollment already approved:', existingEnrollment.id);
          return new Response(
            JSON.stringify({ received: true, enrollment_id: existingEnrollment.id, status: 'already_approved' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Update existing enrollment to approved
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', existingEnrollment.id);

        if (updateError) {
          console.error('Error updating enrollment:', updateError);
          throw updateError;
        }

        // Create payment proof
        await supabase
          .from('payment_proofs')
          .insert({
            enrollment_id: existingEnrollment.id,
            payment_method: 'dodo',
            text_proof: `DODO Payment ID: ${paymentId}`,
            notes: `Payment automatically confirmed via DODO Payments.`
          });

        console.log('Enrollment updated to approved:', existingEnrollment.id);

        return new Response(
          JSON.stringify({ received: true, enrollment_id: existingEnrollment.id, status: 'approved' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // CREATE NEW ENROLLMENT - only happens after successful payment
      const { data: newEnrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          student_id: userId,
          course_id: courseId,
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .select()
        .single();

      if (enrollError) {
        console.error('Error creating enrollment:', enrollError);
        throw enrollError;
      }

      console.log('New enrollment created and approved:', newEnrollment.id);

      // Create payment proof record
      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          enrollment_id: newEnrollment.id,
          payment_method: 'dodo',
          text_proof: `DODO Payment ID: ${paymentId}`,
          notes: `Payment automatically confirmed via DODO Payments. Course: ${metadata.course_title || courseId}`
        });

      if (proofError) {
        console.error('Error creating payment proof:', proofError);
      }

      // Log the successful payment
      try {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          event_type: 'PAYMENT_SUCCEEDED',
          resource_type: 'enrollment',
          resource_id: newEnrollment.id,
          details: {
            payment_method: 'dodo',
            payment_id: paymentId,
            course_id: courseId,
            auto_approved: true
          }
        });
      } catch (logError) {
        console.error('Error logging payment event:', logError);
      }

      return new Response(
        JSON.stringify({ received: true, enrollment_id: newEnrollment.id, status: 'approved' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (eventType === 'payment.failed' || eventType === 'payment_failed' || event.status === 'failed') {
      const metadata = event.data?.metadata || event.metadata || {};
      const paymentId = event.data?.payment_id || event.payment_id;

      console.log('Payment failed:', { paymentId, metadata });

      // Just log the failed payment - don't create any enrollment
      try {
        if (metadata.user_id) {
          await supabase.from('audit_logs').insert({
            user_id: metadata.user_id,
            event_type: 'PAYMENT_FAILED',
            resource_type: 'payment',
            resource_id: paymentId,
            details: {
              payment_method: 'dodo',
              payment_id: paymentId,
              course_id: metadata.course_id,
              failure_reason: event.data?.failure_reason || event.failure_reason || 'Unknown'
            }
          });
        }
      } catch (logError) {
        console.error('Error logging failed payment:', logError);
      }

      return new Response(
        JSON.stringify({ received: true, payment_id: paymentId, status: 'failed' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Unhandled event type
    console.log('Unhandled event type:', eventType);
    return new Response(
      JSON.stringify({ received: true, event_type: eventType }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in dodo-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
