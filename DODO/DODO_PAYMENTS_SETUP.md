# DODO Payments Integration Setup Guide

This guide explains how to set up and configure DODO Payments for international VISA/MASTERCARD payments in your course marketplace.

## Overview

The DODO Payments integration allows students to pay for courses using international credit/debit cards (VISA/MASTERCARD) through DODO's secure payment gateway. Payments are automatically confirmed via webhooks, eliminating the need for manual admin approval.

## Features

- ✅ Secure payment processing via DODO Payments
- ✅ Automatic enrollment approval on successful payment
- ✅ Webhook signature verification for security
- ✅ Support for both successful and failed payment handling
- ✅ Payment status page for user feedback

## Prerequisites

1. DODO Payments account with API credentials
2. Supabase project with Edge Functions enabled
3. Webhook endpoint configured in DODO Payments dashboard

## Step 1: Get DODO Payments Credentials

1. Log in to your DODO Payments dashboard
2. Navigate to API Settings
3. Copy your:
   - **API Key** (for creating checkout sessions)
   - **Webhook Secret** (for verifying webhook signatures)

## Step 2: Configure Environment Variables

### Supabase Edge Functions Environment Variables

Add these to your Supabase project's Edge Functions secrets:

```bash
# DODO Payments API Configuration
DODO_PAYMENTS_API_KEY=zYLwbu5myoPtLHFx.AMoFDdn57mXiGzBJSwSkp5gyjWf1cAz8gWVlZl_USY8Yh0qa
DODO_WEBHOOK_SECRET=whsec_iocQ675C3ng2rydCqIo+lW7qKOUMupkX
DODO_PAYMENTS_API_URL=https://test.dodopayments.com  # Use https://api.dodopayments.com for production

# Your application URL (for return URLs)
NEXT_PUBLIC_APP_URL=https://yourdomain.com  # or VITE_APP_URL for Vite
```

### How to Set Supabase Secrets

✅ **All secrets are already configured for this project!**

The following secrets have been set:
- `DODO_PAYMENTS_API_KEY` ✅
- `DODO_WEBHOOK_SECRET` ✅
- `DODO_PAYMENTS_API_URL` ✅
- `DODO_PRODUCT_ID` = `pdt_0NWJOiCkDHp0N6rNFFxkG` ✅
- `VITE_APP_URL` ✅

If you need to update secrets, use the Supabase CLI:

```bash
supabase secrets set DODO_PAYMENTS_API_KEY=your_api_key_here
supabase secrets set DODO_WEBHOOK_SECRET=your_webhook_secret_here
supabase secrets set DODO_PAYMENTS_API_URL=https://test.dodopayments.com
supabase secrets set DODO_PRODUCT_ID=pdt_0NWJOiCkDHp0N6rNFFxkG
supabase secrets set VITE_APP_URL=https://yourdomain.com
```

## Step 3: Deploy Edge Functions

Deploy the DODO checkout and webhook functions to Supabase:

```bash
# Deploy checkout function
supabase functions deploy dodo-checkout

# Deploy webhook function
supabase functions deploy dodo-webhook
```

## Step 4: Configure Webhook in DODO Dashboard

1. Log in to DODO Payments dashboard
2. Go to **Webhooks** section
3. Click **Add Webhook** or **Create Webhook**
4. Set the webhook URL to:
   ```
   https://mxsydpljfseanvwxsrgj.supabase.co/functions/v1/dodo-webhook
   ```
   (This is your actual Supabase project webhook URL)
5. Select the events to listen for:
   - `payment.succeeded`
   - `payment.failed`
6. Copy the **Webhook Secret** and add it to your Supabase secrets (as shown in Step 2)
7. Save the webhook configuration

## Step 5: Test the Integration

### Test Checkout Flow

1. Navigate to a course page
2. Click "Enroll" button
3. Select "VISA/MASTERCARD" payment method
4. Click "الانتقال إلى الدفع" (Go to Payment)
5. You should be redirected to DODO's checkout page

### Test Webhook (Using DODO Dashboard)

1. In DODO Payments dashboard, go to **Webhooks**
2. Find your webhook and click **Test** or **Send Test Event**
3. Select `payment.succeeded` event
4. Check your Supabase logs to verify the webhook was received and processed

### Test with Real Payment (Test Mode)

1. Use DODO's test card numbers (check DODO documentation)
2. Complete a test payment
3. Verify:
   - Enrollment is automatically approved
   - Payment proof is created in database
   - User is redirected to success page

## Step 6: Verify Database Updates

After a successful payment, verify:

1. **Enrollments table**: Status should be `approved` and `approved_at` should be set
2. **Payment Proofs table**: A record should exist with:
   - `payment_method: 'dodo'`
   - `text_proof: 'DODO Payment ID: [payment_id]'`
3. **Audit Logs table**: An entry should exist with `event_type: 'PAYMENT_SUCCEEDED'`

## Security Considerations

### Webhook Signature Verification

The webhook handler verifies the `x-dodo-signature` header using HMAC SHA256 to ensure requests are actually from DODO Payments. This prevents unauthorized access and payment fraud.

### Environment Variables

- Never commit API keys or secrets to version control
- Use Supabase secrets for all sensitive data
- Rotate keys regularly
- Use different keys for test and production environments

### Payment Flow Security

1. All checkout sessions are created server-side (edge function)
2. User authentication is verified before creating checkout
3. Enrollment IDs are validated in webhook handler
4. Payment metadata is verified to match enrollment

## Troubleshooting

### Checkout Not Working

1. **Check API Key**: Verify `DODO_PAYMENTS_API_KEY` is set correctly
2. **Check API URL**: Ensure `DODO_PAYMENTS_API_URL` points to correct environment (test/production)
3. **Check Logs**: View Supabase Edge Function logs for errors
4. **Verify User Auth**: Ensure user is logged in before creating checkout

### Webhook Not Receiving Events

1. **Check Webhook URL**: Verify the URL in DODO dashboard matches your Supabase function URL
2. **Check Webhook Secret**: Ensure `DODO_WEBHOOK_SECRET` matches the secret in DODO dashboard
3. **Check Function Logs**: View Supabase logs to see if webhook is being called
4. **Test Webhook**: Use DODO dashboard's test feature to send a test event

### Enrollment Not Auto-Approving

1. **Check Webhook Signature**: Verify signature verification is working (check logs)
2. **Check Metadata**: Ensure enrollment_id is included in checkout metadata
3. **Check Database**: Verify enrollment exists and is in 'pending' status
4. **Check Function Logs**: Look for errors in webhook function execution

### Payment Status Page Not Showing

1. **Check Return URL**: Verify `return_url` in checkout creation includes correct domain
2. **Check Route**: Ensure `/payment-status` route is added to App.jsx
3. **Check Query Params**: Verify `status` and `enrollment_id` are in URL

## Production Checklist

Before going live:

- [ ] Switch to production DODO API URL
- [ ] Update webhook URL to production domain
- [ ] Test with real payment (small amount)
- [ ] Verify webhook signature verification works
- [ ] Test failed payment flow
- [ ] Verify enrollment auto-approval works
- [ ] Check payment status page works correctly
- [ ] Monitor logs for first few real payments
- [ ] Set up error alerts/notifications

## API Reference

### Edge Function: `dodo-checkout`

**Endpoint**: `POST /functions/v1/dodo-checkout`

**Headers**:
- `Authorization: Bearer [user_token]`
- `Content-Type: application/json`

**Body**:
```json
{
  "course_id": "uuid",
  "course_title": "Course Title",
  "course_price": 100.00,
  "user_email": "user@example.com",
  "user_id": "uuid"
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.dodopayments.com/...",
  "checkout_id": "checkout_xxx",
  "enrollment_id": "uuid"
}
```

### Edge Function: `dodo-webhook`

**Endpoint**: `POST /functions/v1/dodo-webhook`

**Headers**:
- `x-dodo-signature: [hmac_sha256_signature]`
- `Content-Type: application/json`

**Body**: DODO webhook event payload

**Response**:
```json
{
  "received": true,
  "enrollment_id": "uuid",
  "status": "approved"
}
```

## Support

For issues or questions:
1. Check DODO Payments documentation: https://docs.dodopayments.com
2. Review Supabase Edge Functions logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

