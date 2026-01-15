# Security Implementation Guide

This guide provides instructions for implementing the remaining security features that require backend infrastructure changes.

---

## 1. Server-Side Rate Limiting

### Current Status
✅ Client-side rate limiting is implemented in `src/lib/security.js`  
❌ Server-side rate limiting is not implemented

### Implementation Options

#### Option A: Supabase Edge Functions (Recommended)

Create a Supabase Edge Function that wraps authentication endpoints and implements rate limiting.

**Steps:**
1. Create a new Supabase Edge Function
2. Use a rate limiting library (e.g., `@upstash/ratelimit` with Upstash Redis)
3. Apply rate limits before processing authentication requests

**Example Edge Function Structure:**
```typescript
// supabase/functions/auth-with-rate-limit/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Ratelimit } from 'https://deno.land/x/upstash_ratelimit@v0.2.1/mod.ts'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
})

serve(async (req) => {
  const { email } = await req.json()
  
  // Check rate limit
  const { success, limit, reset, remaining } = await ratelimit.limit(email)
  
  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429 }
    )
  }
  
  // Continue with authentication...
})
```

#### Option B: Supabase Auth Rate Limiting (Built-in)

Supabase has built-in rate limiting for authentication endpoints, but it's configured at the project level.

**Configuration:**
1. Go to Supabase Dashboard > Authentication > Settings
2. Configure rate limiting settings (if available)
3. Set limits for signup/login attempts

#### Option C: API Gateway Rate Limiting

If using a proxy/API gateway (Cloudflare, AWS API Gateway, etc.), configure rate limiting at that level.

---

## 2. Session Token Rotation

### Current Status
✅ Token refresh is handled automatically by Supabase (`autoRefreshToken: true`)  
❌ Session token rotation (periodic token change) is not implemented

### Implementation

Session token rotation would require:
1. Periodic token invalidation and regeneration
2. Client-side logic to handle token rotation
3. Backend logic to manage rotated tokens

**Note:** Supabase handles token refresh automatically, which provides similar security benefits. Full token rotation is typically not necessary unless you have specific security requirements.

**Recommendation:** The current implementation using Supabase's automatic token refresh is sufficient for most use cases. Token rotation can be implemented later if needed for compliance requirements.

---

## 3. Audit Logging

### Current Status
✅ Database schema created (`database/ADD_AUDIT_LOGGING.sql`)  
⚠️ Application-level logging not implemented

### Implementation Steps

#### Step 1: Run the Audit Logging SQL Script

1. Go to Supabase Dashboard > SQL Editor
2. Copy and paste the contents of `database/ADD_AUDIT_LOGGING.sql`
3. Run the script to create the audit_logs table and triggers

#### Step 2: Log Login Attempts

Add logging to login/signup functions using Supabase Edge Functions or application code.

**Example: Logging Login Attempts (Edge Function)**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// After login attempt
await supabaseAdmin.rpc('log_security_event', {
  p_user_id: user.id,
  p_event_type: loginSuccess ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
  p_resource_type: 'auth',
  p_details: {
    email: email,
    timestamp: new Date().toISOString()
  },
  p_ip_address: req.headers.get('x-forwarded-for'),
  p_user_agent: req.headers.get('user-agent')
})
```

#### Step 3: Log Session Invalidations

Update session invalidation logic to log events.

**Location:** `src/lib/sessionManager.js`

Add logging when sessions are invalidated:
```javascript
// After invalidating session
await supabase.rpc('log_security_event', {
  p_user_id: userId,
  p_event_type: 'SESSION_INVALIDATED',
  p_resource_type: 'session',
  p_details: {
    reason: invalidationReason,
    device_id: deviceId
  }
})
```

#### Step 4: View Audit Logs

Create admin interface to view audit logs:

```sql
-- View all audit logs (admin only)
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

-- View login attempts for a user
SELECT * FROM audit_logs
WHERE user_id = 'user-id-here'
  AND event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED')
ORDER BY created_at DESC;

-- View admin actions
SELECT * FROM audit_logs
WHERE event_type = 'ADMIN_ACTION'
ORDER BY created_at DESC;
```

---

## 4. Additional Security Recommendations

### Environment Variables Security

- ✅ Never commit `.env` files to version control
- ✅ Use environment variables for all sensitive data
- ✅ Rotate API keys regularly
- ✅ Use different keys for development and production

### CORS Configuration

- ✅ Configure CORS in Supabase Dashboard > Settings > API
- ✅ Only allow trusted domains
- ✅ Avoid using `*` for allowed origins in production

### Database Security

- ✅ RLS policies are enabled on all tables
- ✅ Use parameterized queries (handled by Supabase)
- ✅ Regular security audits of RLS policies
- ✅ Backup database regularly

### Monitoring and Alerts

- ⚠️ Set up monitoring for failed login attempts
- ⚠️ Set up alerts for suspicious activity
- ⚠️ Monitor API usage and rate limits
- ⚠️ Set up log aggregation and analysis

---

## Summary

### Completed ✅
1. Client-side rate limiting
2. CSRF protection (via Supabase PKCE)
3. Content Security Policy (CSP)
4. HTTPS enforcement
5. Security headers
6. Audit logging database schema

### Requires Implementation ⚠️
1. Server-side rate limiting (Supabase Edge Functions)
2. Application-level audit logging (code integration)
3. Session token rotation (optional, if needed)

### Best Practices
- Review security policies regularly
- Keep dependencies updated
- Monitor security logs
- Conduct periodic security audits
- Follow OWASP guidelines





