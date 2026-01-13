# Single-Device Session Enforcement Implementation

## Overview

This implementation enforces single-device session management, ensuring that each user can only have one active session at a time. When a user logs in from a new device, all previous sessions are automatically invalidated.

## Features

1. **Device Identification**: Unique device fingerprinting using browser characteristics
2. **Session Management**: Database-backed session tracking with automatic invalidation
3. **Auto Logout**: Previous sessions are automatically logged out when a new device logs in
4. **User Notification**: Clear messages explaining why logout occurred
5. **Session Validation**: Periodic validation of active sessions

## Database Setup

Run the SQL migration file to set up the session management system:

```sql
-- Run this file in your Supabase SQL editor
database/ADD_SINGLE_DEVICE_SESSIONS.sql
```

This creates:
- `user_sessions` table to track active sessions
- Database functions for session management
- RLS policies for security
- Indexes for performance

## How It Works

### 1. Device Identification

When a user logs in, the system generates a unique device fingerprint using:
- User Agent
- Screen resolution and color depth
- Timezone
- Language settings
- Platform information
- Hardware concurrency
- Canvas fingerprinting
- WebGL information

The device ID is stored in `localStorage` and persists across browser sessions.

### 2. Login Flow

1. User enters credentials and submits login form
2. Supabase authenticates the user
3. System generates/retrieves device ID
4. `createSession()` is called, which:
   - Invalidates all other active sessions for the user
   - Creates a new session record in the database
   - Associates the session with the device ID

### 3. Session Validation

Sessions are validated:
- On initial page load
- Every 30 seconds (periodic check)
- Before critical API operations (optional)

If a session is invalid, the user is automatically logged out.

### 4. Logout Flow

When a user logs out:
1. Session is marked as inactive in the database
2. Supabase session is cleared
3. User state is reset

When a session is replaced by another device:
1. Previous session is invalidated with reason `SESSION_REPLACED`
2. User sees a warning message explaining the logout
3. User is redirected to login page

## API Functions

### Database Functions

#### `create_or_update_session(user_id, device_id, session_token, user_agent, ip_address)`
Creates a new session or updates an existing one. Automatically invalidates other sessions.

**Returns:**
- `session_id`: UUID of the session
- `is_new_session`: Boolean indicating if this is a new session
- `previous_sessions_invalidated`: Number of sessions that were invalidated

#### `validate_session(session_token, device_id)`
Validates a session token and device ID combination.

**Returns:**
- `is_valid`: Boolean indicating if session is valid
- `user_id`: User ID if valid
- `session_id`: Session ID
- `invalidation_reason`: Reason if invalid

#### `invalidate_session(session_token)`
Marks a session as inactive (for logout).

**Returns:** Boolean indicating success

#### `get_active_session(user_id)`
Gets the currently active session for a user.

**Returns:** Session details or null

#### `invalidate_other_sessions(user_id, current_device_id, current_session_token)`
Invalidates all other sessions for a user except the current one.

**Returns:** Count of invalidated sessions

## Frontend Components

### SessionManager (`src/lib/sessionManager.js`)

Utility functions for session management:
- `createSession()`: Create/update session after login
- `validateCurrentSession()`: Validate the current session
- `invalidateSession()`: Logout and invalidate session
- `checkSessionReplaced()`: Check if session was replaced
- `setSessionReplacedFlag()`: Set flag for session replacement

### DeviceFingerprint (`src/lib/deviceFingerprint.js`)

Device identification utilities:
- `generateDeviceId()`: Generate or retrieve device ID
- `getUserAgent()`: Get user agent string
- `getDeviceInfo()`: Get device information for debugging

### SessionGuard (`src/components/SessionGuard.jsx`)

Component that:
- Monitors session validity
- Displays logout messages when sessions are replaced
- Handles session replacement notifications

## Integration Points

### AuthContext Updates

The `AuthContext` has been updated to:
- Create sessions after successful login
- Validate sessions on initial load
- Periodically validate sessions (every 30 seconds)
- Handle session invalidation
- Display logout messages

### API Request Validation

Session validation is integrated into:
- Initial page load
- Periodic background checks
- Auth state changes

## Error Handling

### Session Invalidation Reasons

- `SESSION_REPLACED`: User logged in from another device
- `DEVICE_MISMATCH`: Device ID doesn't match session
- `SESSION_INACTIVE`: Session was manually invalidated
- `SESSION_NOT_FOUND`: Session doesn't exist in database
- `USER_LOGOUT`: User manually logged out

### User Messages

Users see clear messages explaining why they were logged out:
- "You were logged out because your account was accessed from another device."

## Edge Cases Handled

1. **Closing browser without logging out**: Session remains active until new login
2. **Logging in again on same device**: Previous session is invalidated, new one created
3. **Refreshing the same device**: No logout triggered (same device ID)
4. **Different browser on same computer**: Treated as separate device
5. **Multiple tabs**: All tabs share the same session (same device ID)

## Security Considerations

1. **Device Fingerprinting**: Uses multiple browser characteristics for uniqueness
2. **Session Tokens**: Uses Supabase access tokens for session validation
3. **RLS Policies**: Database sessions are protected by Row Level Security
4. **Automatic Cleanup**: Old inactive sessions can be cleaned up periodically

## Testing

To test the implementation:

1. **Login from Device A**: Login normally
2. **Login from Device B** (or different browser): 
   - Device A should be automatically logged out
   - Device A should see logout message
3. **Refresh Device B**: Should remain logged in (same device)
4. **Logout from Device B**: Session is invalidated in database

## Maintenance

### Cleanup Old Sessions

Run periodically to remove old inactive sessions:

```sql
SELECT cleanup_old_sessions(30); -- Remove sessions older than 30 days
```

### Monitor Active Sessions

Check active sessions for a user:

```sql
SELECT * FROM get_active_session('user-uuid-here');
```

## Troubleshooting

### Session not being invalidated

- Check that `create_or_update_session` is being called after login
- Verify device ID is being generated correctly
- Check database logs for errors

### Device ID changes on refresh

- Device ID is stored in localStorage
- Check browser settings (private mode, cookies disabled)
- Verify localStorage is accessible

### Session validation failing

- Check that `validate_session` function exists in database
- Verify RLS policies allow user to access their sessions
- Check network connectivity

## Future Enhancements

Potential improvements:
1. IP address tracking for additional security
2. Session timeout (auto-logout after inactivity)
3. Device management page (view/revoke devices)
4. Email notifications when new device logs in
5. Two-factor authentication integration

