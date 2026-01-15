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
    let course_id, payment_id;
    try {
      const body = await req.json();
      course_id = body.course_id;
      payment_id = body.payment_id;
      console.log('Request body:', { course_id, payment_id, userId: user.id });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parseError.message }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

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

      // Create payment proof if it doesn't exist (optional - don't fail if this errors)
      try {
        const { data: existingProof } = await supabase
          .from('payment_proofs')
          .select('id')
          .eq('enrollment_id', existingEnrollment.id)
          .maybeSingle();

        if (!existingProof) {
          const { error: proofInsertError } = await supabase
            .from('payment_proofs')
            .insert({
              enrollment_id: existingEnrollment.id,
              payment_method: 'dodo',
              text_proof: payment_id ? `DODO Payment ID: ${payment_id}` : 'DODO Payment (Manual Enrollment)',
              notes: 'Payment confirmed via manual enrollment (webhook may have failed)'
            });
          
          if (proofInsertError) {
            console.error('Error creating payment proof (non-critical):', proofInsertError);
          }
        }
      } catch (proofErr) {
        console.error('Exception creating payment proof (non-critical):', proofErr);
        // Don't throw - payment proof is optional
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
    console.log('Creating new enrollment:', { student_id: userId, course_id: course_id });
    
    // Double-check enrollment doesn't exist (race condition protection)
    const { data: doubleCheckEnrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', userId)
      .eq('course_id', course_id)
      .maybeSingle();
    
    if (doubleCheckEnrollment) {
      console.log('Enrollment found on double-check, updating instead');
      // Update existing enrollment
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', doubleCheckEnrollment.id);

      if (updateError) {
        console.error('Error updating enrollment:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update enrollment',
            details: updateError.message,
            code: updateError.code
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
      
      // Return success with existing enrollment
      return new Response(
        JSON.stringify({ 
          success: true, 
          enrollment_id: doubleCheckEnrollment.id, 
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
      console.error('Error creating enrollment:', {
        error: enrollError,
        code: enrollError.code,
        message: enrollError.message,
        details: enrollError.details,
        hint: enrollError.hint
      });
      
      // If it's a unique constraint violation, try to get the existing enrollment
      if (enrollError.code === '23505' || enrollError.message?.includes('duplicate key') || enrollError.message?.includes('unique constraint')) {
        console.log('Unique constraint violation detected, fetching existing enrollment');
        const { data: existingEnroll } = await supabase
          .from('enrollments')
          .select('id, status')
          .eq('student_id', userId)
          .eq('course_id', course_id)
          .maybeSingle();
        
        if (existingEnroll) {
          // Update it to approved
          const { error: updateErr } = await supabase
            .from('enrollments')
            .update({
              status: 'approved',
              approved_at: new Date().toISOString()
            })
            .eq('id', existingEnroll.id);
          
          if (!updateErr) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                enrollment_id: existingEnroll.id, 
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
        }
      }
      
      // Return detailed error for debugging
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create enrollment',
          details: enrollError.message,
          code: enrollError.code,
          hint: enrollError.hint
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

    console.log('New enrollment created and approved:', newEnrollment.id);

    // Create payment proof record (optional - don't fail if this errors)
    try {
      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          enrollment_id: newEnrollment.id,
          payment_method: 'dodo',
          text_proof: payment_id ? `DODO Payment ID: ${payment_id}` : 'DODO Payment (Manual Enrollment)',
          notes: 'Payment confirmed via manual enrollment (webhook may have failed)'
        });

      if (proofError) {
        console.error('Error creating payment proof (non-critical):', proofError);
        // Don't throw - payment proof is optional
      } else {
        console.log('Payment proof created successfully');
      }
    } catch (proofErr) {
      console.error('Exception creating payment proof (non-critical):', proofErr);
      // Don't throw - continue even if payment proof fails
    }

    // Log the successful enrollment (optional - don't fail if this errors)
    try {
      const { error: logError } = await supabase.from('audit_logs').insert({
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
      
      if (logError) {
        console.error('Error logging enrollment event (non-critical):', logError);
      } else {
        console.log('Audit log created successfully');
      }
    } catch (logErr) {
      console.error('Exception logging enrollment event (non-critical):', logErr);
      // Don't throw - audit logging is optional
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
    console.error('Error in dodo-manual-enroll function:', {
      error: error,
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        type: error.name || 'UnknownError',
        details: error.stack || 'No stack trace available'
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
});

