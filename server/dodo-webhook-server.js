/**
 * Local DODO Webhook Server
 * 
 * This is a local Express server that handles DODO payment webhooks.
 * Use with ngrok to get a public URL for testing.
 * 
 * Usage:
 * 1. Run: node server/dodo-webhook-server.js
 * 2. Run ngrok: ngrok http 3001
 * 3. Copy the ngrok URL and add to DODO dashboard as webhook
 * 4. The webhook secret from DODO should be set in .env as DODO_WEBHOOK_SECRET
 */

import { createServer } from 'http';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
} catch (err) {
  console.error('Could not load .env file:', err.message);
}

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3001;
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || 'your_webhook_secret_here';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

/**
 * Verify DODO webhook signature using HMAC SHA256
 */
function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = createHmac('sha256', secret);
  const digest = hmac.update(body).digest('hex');
  
  // Constant-time comparison
  if (signature.length !== digest.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ digest.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Handle incoming requests
 */
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-dodo-signature');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only accept POST to /webhook
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  console.log('\n========== WEBHOOK RECEIVED ==========');
  console.log('Time:', new Date().toISOString());
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  // Get signature
  const signature = req.headers['x-dodo-signature'];

  // Verify signature if we have a secret
  if (DODO_WEBHOOK_SECRET && DODO_WEBHOOK_SECRET !== 'your_webhook_secret_here') {
    const isValid = verifySignature(body, signature, DODO_WEBHOOK_SECRET);
    if (!isValid) {
      console.log('❌ Invalid signature!');
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }
    console.log('✅ Signature verified');
  } else {
    console.log('⚠️ No webhook secret configured - skipping signature verification');
  }

  // Parse the event
  let event;
  try {
    event = JSON.parse(body);
    console.log('\nEvent Type:', event.event_type);
    console.log('Event Data:', JSON.stringify(event.data, null, 2));
  } catch (err) {
    console.log('❌ Failed to parse body:', err.message);
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  // Handle different event types
  switch (event.event_type) {
    case 'payment.succeeded': {
      const metadata = event.data?.metadata || {};
      const enrollmentId = metadata.enrollment_id;
      const userId = metadata.user_id;
      const courseId = metadata.course_id;
      const paymentId = event.data?.payment_id;

      console.log('\n💳 PAYMENT SUCCEEDED!');
      console.log('Enrollment ID:', enrollmentId);
      console.log('User ID:', userId);
      console.log('Course ID:', courseId);
      console.log('Payment ID:', paymentId);

      if (!supabase) {
        console.log('⚠️ Supabase not configured - cannot update database');
        break;
      }

      if (!enrollmentId || !userId || !courseId) {
        console.log('❌ Missing required metadata');
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing required metadata' }));
        return;
      }

      try {
        // Find the enrollment
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('id, status, student_id, course_id')
          .eq('id', enrollmentId)
          .single();

        if (enrollmentError || !enrollment) {
          console.log('❌ Enrollment not found:', enrollmentId);
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Enrollment not found' }));
          return;
        }

        // Auto-approve the enrollment
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', enrollmentId);

        if (updateError) {
          console.log('❌ Error updating enrollment:', updateError.message);
          throw updateError;
        }

        console.log('✅ Enrollment auto-approved:', enrollmentId);

        // Create payment proof record
        const { error: proofError } = await supabase
          .from('payment_proofs')
          .insert({
            enrollment_id: enrollmentId,
            payment_method: 'dodo',
            text_proof: `DODO Payment ID: ${paymentId}`,
            notes: `Payment automatically confirmed via DODO Payments. Payment ID: ${paymentId}`
          });

        if (proofError) {
          console.log('⚠️ Error creating payment proof:', proofError.message);
        } else {
          console.log('✅ Payment proof created');
        }

      } catch (err) {
        console.log('❌ Database error:', err.message);
      }
      break;
    }

    case 'payment.failed': {
      const metadata = event.data?.metadata || {};
      console.log('\n❌ PAYMENT FAILED!');
      console.log('Payment ID:', event.data?.payment_id);
      console.log('Failure reason:', event.data?.failure_reason || 'Unknown');
      console.log('Metadata:', metadata);
      break;
    }

    default:
      console.log('\n⚠️ Unhandled event type:', event.event_type);
  }

  console.log('\n========== END WEBHOOK ==========\n');

  res.writeHead(200);
  res.end(JSON.stringify({ received: true }));
});

server.listen(PORT, () => {
  console.log('\n🚀 DODO Webhook Server running!');
  console.log('==========================================');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log('\nNext steps:');
  console.log('1. Open a new terminal and run:');
  console.log(`   ngrok http ${PORT}`);
  console.log('\n2. Copy the ngrok URL (e.g., https://xxxx.ngrok.io)');
  console.log('\n3. Go to DODO Payments dashboard > Webhooks');
  console.log('4. Create a webhook with URL: <ngrok-url>/webhook');
  console.log('5. Select events: payment.succeeded, payment.failed');
  console.log('6. Copy the webhook secret and add to .env as DODO_WEBHOOK_SECRET');
  console.log('==========================================\n');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('⚠️ WARNING: Supabase not configured - webhooks will be logged but database will not be updated');
  }
  
  if (!DODO_WEBHOOK_SECRET || DODO_WEBHOOK_SECRET === 'your_webhook_secret_here') {
    console.log('⚠️ WARNING: DODO_WEBHOOK_SECRET not set - signature verification disabled');
    console.log('   Add DODO_WEBHOOK_SECRET to .env file once you create the webhook\n');
  }
});

