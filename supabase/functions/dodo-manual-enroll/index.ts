// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.info('dodo-manual-enroll function started');

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
    const dodoApiUrl = Deno.env.get('DODO_PAYMENTS_API_URL') || 'https://test.dodopayments.com';

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

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { course_id, payment_id } = await req.json();

    if (!course_id) {
      return new Response(
        JSON.stringify({ error: 'Missing course_id' }),
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
    const userId = user.id;

    // Check if enrollment already exists
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', userId)
      .eq('course_id', course_id)
      .maybeSingle();

    if (existingEnrollment) {
      if (existingEnrollment.status === 'approved') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            enrollment_id: existingEnrollment.id, 
            status: 'already_approved',
            message: 'Enrollment already exists and is approved'
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
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

      // Create payment proof if it doesn't exist
      const { data: existingProof } = await supabase
        .from('payment_proofs')
        .select('id')
        .eq('enrollment_id', existingEnrollment.id)
        .maybeSingle();

      if (!existingProof) {
        await supabase
          .from('payment_proofs')
          .insert({
            enrollment_id: existingEnrollment.id,
            payment_method: 'dodo',
            text_proof: payment_id ? `DODO Payment ID: ${payment_id}` : 'DODO Payment (Manual Enrollment)',
            notes: 'Payment confirmed via manual enrollment (webhook may have failed)'
          });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          enrollment_id: existingEnrollment.id, 
          status: 'approved',
          message: 'Enrollment updated to approved'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // CREATE NEW ENROLLMENT
    const { data: newEnrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        student_id: userId,
        course_id: course_id,
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
        text_proof: payment_id ? `DODO Payment ID: ${payment_id}` : 'DODO Payment (Manual Enrollment)',
        notes: 'Payment confirmed via manual enrollment (webhook may have failed)'
      });

    if (proofError) {
      console.error('Error creating payment proof:', proofError);
    }

    // Log the successful enrollment
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'ENROLLMENT_CREATED',
        resource_type: 'enrollment',
        resource_id: newEnrollment.id,
        details: {
          payment_method: 'dodo',
          payment_id: payment_id || 'unknown',
          course_id: course_id,
          manual_enrollment: true,
          reason: 'Webhook may have failed, manual enrollment created'
        }
      });
    } catch (logError) {
      console.error('Error logging enrollment event:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        enrollment_id: newEnrollment.id, 
        status: 'approved',
        message: 'Enrollment created successfully'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in dodo-manual-enroll function:', error);
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

