# Security Flows Documentation

This document provides a comprehensive overview of all security flows implemented in the Wijha platform.

---

## Table of Contents

1. [Authentication Flows](#authentication-flows)
2. [Session Management](#session-management)
3. [Authorization & Access Control](#authorization--access-control)
4. [Input Validation & Sanitization](#input-validation--sanitization)
5. [Rate Limiting](#rate-limiting)
6. [File Upload Security](#file-upload-security)
7. [Device Fingerprinting](#device-fingerprinting)
8. [Session Guard & Blocking](#session-guard--blocking)
9. [Database Security (RLS)](#database-security-rls)

---

## 1. Authentication Flows

### 1.1 Login Flow

**Location:** `src/pages/Login.jsx`, `src/context/AuthContext.jsx`

**Flow Steps:**

1. **User Input Collection**
   - User enters email and password
   - Email is sanitized using `sanitizeInput()` to prevent XSS
   - Email is trimmed and converted to lowercase

2. **Rate Limiting Check**
   - Rate limiter checks if email has exceeded 5 attempts in 15 minutes
   - If exceeded, login is blocked with error message
   - Rate limit is tracked per email address in localStorage

3. **Input Validation**
   - Validates email and password are not empty
   - Email format validation (handled by Supabase)

4. **Authentication Request**
   - Calls `supabase.auth.signInWithPassword()` with sanitized credentials
   - Request has 15-second timeout to prevent hanging
   - Uses `Promise.race()` to enforce timeout

5. **Session Creation**
   - On successful login, creates session in database via `createSession()`
   - Generates device fingerprint using browser characteristics
   - Stores session token, device ID, and user agent in `user_sessions` table
   - **Critical:** This invalidates all previous sessions for the user (single-device enforcement)

6. **Profile Loading**
   - Attempts to load user profile from `profiles` table
   - If profile doesn't exist, creates it automatically
   - Profile loading is non-blocking (happens in background)

7. **State Update**
   - Updates AuthContext with user and profile data
   - Clears any previous logout messages
   - Resets rate limiter for successful login

8. **Redirect**
   - Redirects user based on role:
     - Student → `/courses`
     - Creator → `/creator/dashboard`
     - Admin → `/admin/dashboard`

**Security Features:**
- Input sanitization prevents XSS attacks
- Rate limiting prevents brute force attacks
- Single-device session enforcement
- Timeout protection prevents hanging requests
- Device fingerprinting for session tracking

---

### 1.2 Signup Flow

**Location:** `src/pages/Signup.jsx`, `src/context/AuthContext.jsx`

**Flow Steps:**

1. **User Input Collection**
   - User enters name, email, password, and role (student/creator)
   - All inputs are sanitized using `sanitizeInput()`
   - Email is trimmed and converted to lowercase

2. **Rate Limiting Check**
   - Rate limiter checks if email has exceeded 5 attempts in 15 minutes
   - Prevents spam account creation

3. **Input Validation**
   - **Email Validation:**
     - Regex pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
     - Must be valid email format
   
   - **Password Validation:**
     - Minimum 8 characters
     - Must contain uppercase letter
     - Must contain lowercase letter
     - Must contain number
     - Must contain special character: `!@#$%^&*(),.?":{}|<>`
   
   - **Role Validation:**
     - Must be one of: `student`, `creator`, `admin`
     - Admin role cannot be selected during signup (must be assigned)

4. **Account Creation**
   - Calls `supabase.auth.signUp()` with validated data
   - User metadata includes name and role
   - Request has 15-second timeout

5. **Profile Creation**
   - Database trigger automatically creates profile in `profiles` table
   - If trigger fails, `createProfileIfMissing()` creates it manually
   - Profile includes: id, name, role, created_at

6. **Email Confirmation**
   - If email confirmation is required, user is redirected to login
   - Success message instructs user to check email
   - If no confirmation required, user is logged in immediately

7. **Session Creation**
   - If user is logged in immediately, session is created
   - Device fingerprint is generated and stored
   - Previous sessions are invalidated

8. **Redirect**
   - Redirects based on role (same as login)

**Security Features:**
- Strong password requirements
- Input sanitization
- Rate limiting
- Role validation
- Automatic profile creation with proper role assignment

---

### 1.3 Logout Flow

**Location:** `src/context/AuthContext.jsx`, `src/lib/sessionManager.js`

**Flow Steps:**

1. **Session Invalidation**
   - Calls `invalidateSession()` function
   - Marks session as invalid in database via `invalidate_session` RPC
   - Sets `is_active = false` in `user_sessions` table

2. **Supabase Sign Out**
   - Calls `supabase.auth.signOut({ scope: 'local' })`
   - Clears Supabase session from localStorage
   - Handles 403 errors gracefully (session may already be invalid)

3. **Local Storage Cleanup**
   - Removes all Supabase auth tokens from localStorage
   - Searches for keys starting with `sb-` containing `auth-token` or `auth`
   - Clears device ID if needed

4. **State Reset**
   - Sets user to `null`
   - Sets profile to `null`
   - Clears logout messages
   - Resets session invalid flag

5. **Redirect**
   - User is redirected to login page or landing page

**Security Features:**
- Complete session invalidation in database
- Local storage cleanup prevents token reuse
- Graceful error handling

---

## 2. Session Management

### 2.1 Single-Device Session Enforcement

**Location:** `src/lib/sessionManager.js`, `database/ADD_SINGLE_DEVICE_SESSIONS.sql`

**How It Works:**

1. **Session Creation**
   - When user logs in, `createSession()` is called
   - Generates unique device ID using browser fingerprinting
   - Stores in `user_sessions` table:
     - `user_id`: User's UUID
     - `device_id`: Browser fingerprint hash
     - `session_token`: Supabase access token
     - `user_agent`: Browser user agent string
     - `is_active`: Boolean flag
     - `created_at`: Timestamp

2. **Previous Session Invalidation**
   - Database function `create_or_update_session` automatically:
     - Marks all existing sessions for the user as inactive
     - Sets `invalidation_reason = 'SESSION_REPLACED'`
     - Creates new session for current device
   - This ensures only one active session per user

3. **Session Validation**
   - `validateCurrentSession()` is called periodically (every 60 seconds)
   - Validates:
     - Session token exists in Supabase
     - Session exists in database
     - Device ID matches current device
     - Session is marked as active
   - Returns validation result with reason if invalid

4. **Device Mismatch Detection**
   - If device ID doesn't match, session is invalidated
   - Reason: `DEVICE_MISMATCH`
   - User is logged out immediately

**Security Features:**
- Prevents concurrent sessions on multiple devices
- Device fingerprinting makes session hijacking difficult
- Automatic invalidation of old sessions

---

### 2.2 Session Validation Flow

**Location:** `src/lib/sessionManager.js`, `src/context/AuthContext.jsx`

**Validation Triggers:**

1. **Initial Load**
   - On app initialization, validates existing session
   - Checks if session is still valid
   - Loads user and profile if valid

2. **Periodic Validation**
   - Runs every 60 seconds via `setInterval`
   - Only validates if user is logged in and session is currently valid
   - Skips validation if session is already marked invalid

3. **Route Changes**
   - `SessionGuard` component validates on route navigation
   - Ensures user is logged out immediately if session was replaced

4. **Page Visibility**
   - Validates when user switches tabs and returns
   - Uses `visibilitychange` event listener
   - Detects if session was invalidated while tab was inactive

**Validation Process:**

1. **Get Current Session**
   - Retrieves session from Supabase: `supabase.auth.getSession()`
   - Checks if session and access_token exist

2. **Database Validation**
   - Calls `validate_session` RPC function
   - Passes session token and current device ID
   - Database checks:
     - Session exists in `user_sessions`
     - Session is active (`is_active = true`)
     - Device ID matches
     - Session hasn't expired

3. **Handle Invalid Session**
   - If invalid, determines reason:
     - `SESSION_REPLACED`: Another device logged in
     - `DEVICE_MISMATCH`: Device ID doesn't match
     - `SESSION_INACTIVE`: Session was manually invalidated
     - `SESSION_NOT_FOUND`: Session doesn't exist
   - Logs out user
   - Shows appropriate message (only for SESSION_REPLACED)

**Security Features:**
- Multiple validation triggers ensure quick detection
- Database-level validation prevents token reuse
- Device matching prevents session hijacking

---

### 2.3 Session Timeout (Inactivity)

**Location:** `src/context/AuthContext.jsx`

**How It Works:**

1. **Activity Tracking**
   - Tracks last activity time using `Date.now()`
   - Updates on user interactions:
     - Mouse events: `mousedown`, `click`
     - Keyboard events: `keydown`
     - Scroll events: `scroll`
     - Touch events: `touchstart`
   - Event listeners are passive for performance

2. **Timeout Check**
   - Session timeout: **24 hours of inactivity**
   - Checked during periodic validation (every 60 seconds)
   - Calculates: `Date.now() - lastActivityTime`

3. **Timeout Action**
   - If inactivity exceeds 24 hours:
     - Marks session as invalid
     - Sets logout message: "تم انتهاء الجلسة بسبب عدم النشاط"
     - Clears user and profile state
     - Signs out from Supabase
     - Clears localStorage auth tokens

**Security Features:**
- Automatic logout after inactivity
- Prevents unauthorized access to abandoned sessions
- Activity tracking is lightweight and efficient

---

## 3. Authorization & Access Control

### 3.1 Role-Based Access Control (RBAC)

**Location:** `src/context/AuthContext.jsx`, Database RLS policies

**Roles:**

1. **Student**
   - Can browse published courses
   - Can enroll in courses
   - Can view their own enrollments
   - Can create payment proofs
   - Can comment and rate courses
   - Cannot create or edit courses

2. **Creator**
   - All student permissions
   - Can create courses
   - Can edit their own courses
   - Can view enrollments for their courses
   - Can create payout requests
   - Can manage their creator profile
   - Cannot approve enrollments or manage other creators' content

3. **Admin**
   - All creator permissions
   - Can view all courses (published and unpublished)
   - Can approve/reject enrollments
   - Can approve/reject courses
   - Can manage all users
   - Can manage categories
   - Can view all reports
   - Can manage platform settings
   - Can view all payout requests

**Role Checking:**

- Frontend: `user.role` or `profile.role`
- Backend: Database functions:
  - `is_user_admin(user_id)`
  - `is_user_creator(user_id)`
  - `is_user_student(user_id)`

**Security Features:**
- Role stored in database (not just frontend)
- RLS policies enforce role-based access
- SECURITY DEFINER functions bypass RLS for role checks

---

### 3.2 Route Protection

**Location:** `src/App.jsx` (implicit), Component-level checks

**How It Works:**

1. **AuthContext Check**
   - Components check `useAuth()` hook
   - If `user` is null, redirect to login
   - If `loading` is true, show loading state

2. **Role-Based Routes**
   - `/creator/dashboard`: Requires `creator` or `admin` role
   - `/admin/dashboard`: Requires `admin` role
   - `/courses`: Accessible to all authenticated users
   - `/course/:id`: Accessible to all (public course details)

3. **Component-Level Protection**
   - Components check user role before rendering sensitive features
   - Example: Only creators see "Create Course" button
   - Example: Only admins see "Approve Enrollment" button

**Security Features:**
- Frontend protection provides UX (not security)
- Real security is enforced by RLS policies
- Multiple layers of protection

---

## 4. Input Validation & Sanitization

### 4.1 Input Sanitization

**Location:** `src/lib/security.js`

**Functions:**

1. **`sanitizeInput(input)`**
   - Removes potentially dangerous characters
   - Removes `<` and `>` to prevent HTML injection
   - Removes `javascript:` protocol
   - Removes event handlers like `onclick=`, `onerror=`, etc.
   - Trims whitespace
   - Used for: Email, name, text inputs

2. **`sanitizeHTML(html)`**
   - Removes `<script>` tags completely
   - Removes event handlers from HTML attributes
   - Removes `javascript:` protocol
   - Used for: Rich text content, course descriptions

**Usage:**
- All user inputs are sanitized before processing
- Email addresses are sanitized before authentication
- Course titles, descriptions are sanitized
- Comments are sanitized

**Security Features:**
- Prevents XSS (Cross-Site Scripting) attacks
- Prevents HTML injection
- Prevents JavaScript execution in user input

---

### 4.2 Password Validation

**Location:** `src/pages/Signup.jsx`, `src/context/AuthContext.jsx`

**Requirements:**

1. **Length**: Minimum 8 characters
2. **Uppercase**: At least one uppercase letter (A-Z)
3. **Lowercase**: At least one lowercase letter (a-z)
4. **Number**: At least one digit (0-9)
5. **Special Character**: At least one from: `!@#$%^&*(),.?":{}|<>`

**Validation Process:**

```javascript
const hasUpperCase = /[A-Z]/.test(password)
const hasLowerCase = /[a-z]/.test(password)
const hasNumbers = /\d/.test(password)
const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
  return error
}
```

**Security Features:**
- Strong password requirements
- Client-side validation for UX
- Supabase also enforces password policies server-side

---

## 5. Rate Limiting

### 5.1 Rate Limiter Implementation

**Location:** `src/lib/security.js`

**Class:** `RateLimiter`

**Configuration:**
- Default: 5 attempts per 15 minutes
- Configurable: `new RateLimiter(maxAttempts, windowMs)`

**How It Works:**

1. **Storage**
   - Uses localStorage with key: `rate_limit_{email}`
   - Stores: `{ attempts: number, firstAttempt: timestamp }`

2. **Check Process**
   - Retrieves stored data for email
   - Calculates time since first attempt
   - If window expired (> 15 minutes), resets counter
   - If attempts >= maxAttempts, blocks request
   - Otherwise, increments counter and allows request

3. **Reset**
   - On successful login/signup, rate limit is reset
   - Can be manually reset via `reset(key)`

**Usage:**

- **Login:** `loginRateLimiter.checkLimit(email)`
- **Signup:** `signupRateLimiter.checkLimit(email)`

**Security Features:**
- Prevents brute force attacks
- Per-email tracking
- Automatic window expiration
- Client-side (can be bypassed, but provides UX)
- Should be complemented with server-side rate limiting

---

## 6. File Upload Security

### 6.1 File Validation

**Location:** `src/lib/security.js`

**Functions:**

1. **`validateFileUpload(file, options)`**
   - Validates file size, type, extension, and name
   - Returns: `{ valid: boolean, error?: string }`

2. **`validateImageUpload(file)`**
   - Specific validation for images
   - Max size: 10MB
   - Allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
   - Allowed extensions: `jpg`, `jpeg`, `png`, `gif`, `webp`

3. **`validateVideoUpload(file)`**
   - Specific validation for videos
   - Max size: 500MB
   - Allowed types: `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime`
   - Allowed extensions: `mp4`, `webm`, `ogg`, `mov`

**Validation Checks:**

1. **File Size**
   - Checks `file.size` against `maxSize`
   - Returns error if exceeded

2. **File Type (MIME)**
   - Checks `file.type` against `allowedTypes`
   - Prevents MIME type spoofing

3. **File Extension**
   - Extracts extension from `file.name`
   - Validates against `allowedExtensions`
   - Prevents double extension attacks (e.g., `file.jpg.exe`)

4. **File Name**
   - Checks for path traversal: `..`, `/`, `\`
   - Prevents directory traversal attacks

**Security Features:**
- Prevents malicious file uploads
- Size limits prevent DoS attacks
- Type validation prevents executable uploads
- Extension validation prevents double extension attacks
- Name validation prevents path traversal

---

## 7. Device Fingerprinting

### 7.1 Device ID Generation

**Location:** `src/lib/deviceFingerprint.js`

**How It Works:**

1. **Storage**
   - Device ID is stored in localStorage: `device_id`
   - Persists across sessions
   - Generated once per browser/device

2. **Fingerprint Components**
   - **User Agent**: Browser and OS information
   - **Screen Properties**: Width, height, color depth
   - **Timezone**: `Intl.DateTimeFormat().resolvedOptions().timeZone`
   - **Language**: `navigator.language` and `navigator.languages`
   - **Platform**: `navigator.platform`
   - **Hardware**: `navigator.hardwareConcurrency`, `navigator.deviceMemory`
   - **Canvas Fingerprint**: Hash of canvas rendering
   - **WebGL Fingerprint**: GPU vendor and renderer

3. **Hash Generation**
   - Combines all components with `|` separator
   - Creates hash using simple hash function
   - Returns 8-character hex string

**Security Features:**
- Unique device identification
- Difficult to spoof (requires multiple browser properties)
- Used for session validation
- Prevents session hijacking

**Limitations:**
- Can change if browser is updated
- Can be similar across similar devices
- Not 100% unique, but sufficient for session management

---

## 8. Session Guard & Blocking

### 8.1 SessionGuard Component

**Location:** `src/components/SessionGuard.jsx`

**Purpose:**
- Monitors session validity
- Validates session on route changes
- Validates session on page visibility changes
- Shows logout messages when session is replaced

**How It Works:**

1. **Route Change Validation**
   - Listens to `location.pathname` changes
   - Validates session when user navigates
   - Skips validation on auth pages (`/login`, `/signup`)

2. **Visibility Change Validation**
   - Listens to `visibilitychange` event
   - Validates when user returns to tab
   - Detects if session was invalidated while tab was inactive

3. **Logout Message Display**
   - Shows alert when `logoutMessage` is set
   - Only shows for `SESSION_REPLACED` reason
   - Alert cannot be auto-closed (user must click OK)
   - Redirects to login on confirm

**Security Features:**
- Immediate session validation on navigation
- Detects session replacement quickly
- User-friendly logout messages

---

### 8.2 SessionBlockingOverlay Component

**Location:** `src/components/SessionBlockingOverlay.jsx`

**Purpose:**
- Blocks all user interactions when session is invalid
- Prevents any actions until user logs in again
- Shows visual overlay with message

**How It Works:**

1. **Blocking Mechanism**
   - Adds `session-blocked` class to `body`
   - Prevents all events with capture phase:
     - `keydown`: Blocks keyboard input
     - `mousedown`: Blocks mouse clicks
     - `click`: Blocks button clicks
     - `touchstart`: Blocks touch events
     - `contextmenu`: Blocks right-click
     - `submit`: Blocks form submissions

2. **Alert Exception**
   - Allows interactions with alert modal
   - Checks for `.alert-overlay` or `.alert-modal` classes
   - Allows alert to be dismissed

3. **Visual Overlay**
   - Shows full-screen overlay with z-index
   - Displays lock icon and message
   - Shows loading spinner
   - Cannot be dismissed by clicking

**Security Features:**
- Complete UI blocking prevents any actions
- Prevents form submissions with invalid session
- Prevents API calls with invalid tokens
- User must log in again to continue

---

## 9. Database Security (RLS)

### 9.1 Row Level Security (RLS) Policies

**Location:** Database SQL files, Supabase

**How It Works:**

1. **RLS Enabled**
   - All tables have RLS enabled
   - Policies control SELECT, INSERT, UPDATE, DELETE operations
   - Policies use `auth.uid()` to get current user ID

2. **Helper Functions**
   - `is_user_admin(user_id)`: Checks if user is admin
   - `is_user_creator(user_id)`: Checks if user is creator
   - `is_user_student(user_id)`: Checks if user is student
   - Functions use `SECURITY DEFINER` to bypass RLS for role checks

3. **Profile Policies**
   - Users can view their own profile
   - Users can update their own profile
   - Users can insert their own profile
   - Service role can insert profiles (for triggers)

4. **Course Policies**
   - Anyone can view published courses
   - Creators can view their own courses (all statuses)
   - Admins can view all courses
   - Creators can create courses
   - Creators can update their own courses
   - Admins can update all courses
   - Creators can delete their own courses
   - Admins can delete all courses

5. **Enrollment Policies**
   - Students can view their own enrollments
   - Creators can view enrollments for their courses
   - Admins can view all enrollments
   - Students can create enrollments
   - Admins can update enrollments (approve/reject)

6. **Payment Proof Policies**
   - Students can view their own payment proofs
   - Students can create payment proofs
   - Admins can view all payment proofs

7. **Payout Request Policies**
   - Creators can view their own payout requests
   - Creators can create payout requests
   - Admins can view all payout requests
   - Admins can update payout requests

**Security Features:**
- Database-level security (cannot be bypassed by frontend)
- Role-based access control enforced at database level
- Prevents unauthorized data access
- Prevents SQL injection (Supabase handles parameterization)

---

### 9.2 Session Management in Database

**Location:** `database/ADD_SINGLE_DEVICE_SESSIONS.sql`

**Tables:**

1. **`user_sessions`**
   - `id`: UUID primary key
   - `user_id`: Foreign key to auth.users
   - `device_id`: Browser fingerprint hash
   - `session_token`: Supabase access token
   - `user_agent`: Browser user agent
   - `ip_address`: User IP (optional)
   - `is_active`: Boolean flag
   - `invalidation_reason`: Reason if invalidated
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

**Functions:**

1. **`create_or_update_session`**
   - Invalidates all existing sessions for user
   - Creates new session for current device
   - Returns session ID and invalidation count

2. **`validate_session`**
   - Validates session token and device ID
   - Returns: `{ is_valid, user_id, session_id, invalidation_reason }`

3. **`invalidate_session`**
   - Marks session as inactive
   - Sets invalidation reason

**Security Features:**
- Database tracks all active sessions
- Automatic invalidation of old sessions
- Device ID matching prevents token reuse
- Session validation at database level

---

## Security Best Practices Summary

### ✅ Implemented

1. **Authentication**
   - Strong password requirements
   - Input sanitization
   - Rate limiting
   - Session management

2. **Authorization**
   - Role-based access control
   - Database-level RLS policies
   - Frontend route protection

3. **Session Security**
   - Single-device enforcement
   - Device fingerprinting
   - Session timeout (inactivity)
   - Periodic validation

4. **Input Security**
   - XSS prevention (sanitization)
   - HTML injection prevention
   - File upload validation

5. **Rate Limiting**
   - Login attempt limiting
   - Signup attempt limiting

### ⚠️ Recommendations

1. **Server-Side Rate Limiting**
   - Current rate limiting is client-side only
   - Should implement server-side rate limiting in Supabase Edge Functions
   
   **Solution:** Client-side rate limiting is implemented in `src/lib/security.js` using localStorage. This provides UX benefits but can be bypassed. For production, server-side rate limiting should be implemented using Supabase Edge Functions or Supabase's built-in rate limiting features. The current implementation serves as a first line of defense and improves user experience.
   
   **Status:** ⚠️ Partially Done - Client-side implemented, server-side needs Supabase Edge Functions (requires backend infrastructure changes)

2. **CSRF Protection**
   - Supabase handles CSRF tokens automatically
   - Ensure proper CORS configuration
   
   **Solution:** Supabase Auth automatically handles CSRF protection through its authentication flow. The Supabase client uses PKCE (Proof Key for Code Exchange) flow (`flowType: 'pkce'` in `src/lib/supabase.js`), which provides CSRF protection. CORS is configured at the Supabase project level and should be verified in the Supabase Dashboard > Settings > API.
   
   **Status:** ✅ Done - Handled by Supabase Auth with PKCE flow

3. **Content Security Policy (CSP)**
   - Should add CSP headers to prevent XSS
   - Configure in deployment settings
   
   **Solution:** CSP headers are implemented in `index.html` via meta tag and added to deployment configurations (`netlify.toml` and `vercel.json`). The CSP allows necessary resources (Supabase, fonts, images) while blocking inline scripts and preventing XSS attacks. Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Strict-Transport-Security) are also configured in deployment configs.
   
   **Status:** ✅ Done - CSP and security headers configured in HTML and deployment configs

4. **HTTPS Only**
   - Ensure all connections use HTTPS
   - Configure in Supabase and deployment platform
   
   **Solution:** HTTPS is automatically enforced by modern deployment platforms (Netlify, Vercel) and Supabase. The `Strict-Transport-Security` header has been added to deployment configurations to enforce HTTPS. Supabase endpoints use HTTPS by default. All API calls to Supabase use HTTPS connections.
   
   **Status:** ✅ Done - HTTPS enforced by deployment platforms and Supabase, HSTS header added

5. **Session Token Rotation**
   - Consider implementing token rotation
   - Currently tokens are valid until logout
   
   **Solution:** Supabase handles token refresh automatically (`autoRefreshToken: true` in `src/lib/supabase.js`). Tokens are refreshed periodically by Supabase client. However, session token rotation (changing the session token itself) is not implemented. This would require additional backend logic to invalidate and regenerate tokens periodically. The current implementation uses Supabase's built-in token refresh mechanism.
   
   **Status:** ⚠️ Partially Done - Token refresh handled by Supabase, but session token rotation not implemented (would require custom backend logic)

6. **Audit Logging**
   - Consider logging security events:
     - Failed login attempts
     - Session invalidations
     - Role changes
     - Admin actions
   
   **Solution:** Audit logging database schema has been created (`database/ADD_AUDIT_LOGGING.sql`). The schema includes: `audit_logs` table with indexes, RLS policies, triggers for role changes, enrollment actions, course actions, and payout actions. A helper function `log_security_event()` is available for manual logging. Application-level integration is needed to log login attempts and session invalidations using Supabase Edge Functions or server-side code.
   
   **Status:** ⚠️ Partially Done - Database schema and triggers created, application-level logging integration needed (see `SECURITY_IMPLEMENTATION_GUIDE.md`)

---

## Security Flow Diagrams

### Login Flow
```
User Input → Sanitize → Rate Limit Check → Validate → 
Supabase Auth → Create Session → Invalidate Old Sessions → 
Load Profile → Update State → Redirect
```

### Session Validation Flow
```
Periodic Check (60s) → Get Session → Validate Device ID → 
Check Database → If Invalid → Logout → Show Message
```

### Authorization Flow
```
User Request → Check Role (Frontend) → API Call → 
RLS Policy Check (Database) → Return Data or Error
```

---

## Conclusion

The Wijha platform implements comprehensive security measures across authentication, authorization, session management, and input validation. The multi-layered approach ensures that security is enforced at both the frontend (UX) and backend (database) levels, providing robust protection against common security threats.

