1. Prerequisites & Environment
Add your credentials to your .env.local file. You get the Webhook Secret when you create a webhook endpoint in the Dodo Payments Dashboard.

bash


DODO_PAYMENTS_API_KEY=your_api_key
DODO_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
2. Create the Checkout Session (Backend)
Never call Dodo's API directly from the frontend to avoid leaking your API key. Create an API route to generate the checkout URL.

typescript


// app/api/checkout/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { productId, userEmail } = await req.json();

  const res = await fetch('https://test.dodopayments.com/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: userEmail },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/status`,
      metadata: { user_email: userEmail }, // Useful for fulfillment
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
3. Trigger the Payment (Frontend)
Use the checkout_url returned from your backend to redirect the user or open the overlay.

typescript


// components/BuyButton.tsx
'use client';

export function BuyButton({ productId }: { productId: string }) {
  const handleCheckout = async () => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ productId, userEmail: 'user@example.com' }),
    });
    const { checkout_url } = await res.json();
    
    // Simple redirect to Dodo's hosted checkout
    window.location.href = checkout_url;
  };

  return <button onClick={handleCheckout}>Buy Now</button>;
}
4. Handle Webhook & Verify Signature (Crucial)
Dodo sends a x-dodo-signature header. You must verify this using crypto to ensure the request actually came from Dodo.

typescript


// app/api/webhooks/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.text(); // Get raw body for verification
  const signature = req.headers.get('x-dodo-signature');
  const secret = process.env.DODO_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return new Response('Missing signature or secret', { status: 401 });
  }

  // Verify HMAC SHA256 Signature
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(body).digest('hex');

  if (signature !== digest) {
    console.error('Invalid webhook signature');
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  // Handle successful and unsuccessful states
  switch (event.event_type) {
    case 'payment.succeeded':
      const email = event.data.metadata.user_email;
      console.log(`Payment Succeeded! Fulfilling product for ${email}`);
      // TODO: Grant access to digital product in your database
      break;

    case 'payment.failed':
      console.log('Payment failed for:', event.data.payment_id);
      // TODO: Log failure or notify user
      break;
      
    default:
      console.log(`Unhandled event: ${event.event_type}`);
  }

  return NextResponse.json({ received: true });
}
5. Success/Failure UI (The Return URL)
When the user is redirected back to /status, Dodo appends status=succeeded or status=failed.

typescript


// app/status/page.tsx
'use client';
import { useSearchParams } from 'next/navigation';

export default function StatusPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  return (
    <div className="flex flex-col items-center mt-20">
      {status === 'succeeded' ? (
        <div className="text-green-600">
          <h1>Payment Successful!</h1>
          <p>Check your email for the digital product access.</p>
        </div>
      ) : (
        <div className="text-red-600">
          <h1>Payment Unsuccessful</h1>
          <p>Please try again or contact support.</p>
        </div>
      )}
    </div>
  );
}
Summary of Coverage:
Successful Payment: Handled via payment.succeeded webhook (for fulfillment) and status=succeeded URL (for UI).
Unsuccessful Payment: Handled via payment.failed webhook (for logging) and status=failed URL (to allow the user to retry).
Security: Webhook signature is verified using crypto.createHmac('sha256', secret) to prevent spoofing attacks.
Digital Product: Fulfillment is tied to the webhook, which is the most reliable way to ensure the user gets what they paid for even if they close their browser.
