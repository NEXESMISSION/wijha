/**
 * Session Management Utility
 * Handles single-device session enforcement
 */

import { supabase } from './supabase'
import { generateDeviceId, getUserAgent } from './deviceFingerprint'

/**
 * Create or update a session after login
 * This will invalidate any existing sessions for the user
 */
export async function createSession(userId, sessionToken) {
  try {
    const deviceId = generateDeviceId()
    const userAgent = getUserAgent()
    
    // Call the database function to create/update session
    const { data, error } = await supabase.rpc('create_or_update_session', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_session_token: sessionToken,
      p_user_agent: userAgent,
      p_ip_address: null // IP will be captured server-side if needed
    })

    // Handle duplicate key error gracefully (session already exists)
    if (error) {
      // If it's a duplicate key error, that's okay - session already exists
      if (error.code === '23505' || 
          error.message?.includes('duplicate key') || 
          error.message?.includes('already exists') ||
          error.details?.includes('already exists')) {
        // Silently handle - session already exists, that's fine
        return {
          success: true,
          sessionId: null,
          isNewSession: false,
          previousSessionsInvalidated: 0
        }
      }
      // Only log non-duplicate errors
      console.error('Error creating session:', error)
      // Don't throw - return error instead
      return { success: false, error: error.message }
    }

    if (data && data.length > 0) {
      const result = data[0]
      return {
        success: true,
        sessionId: result.session_id,
        isNewSession: result.is_new_session,
        previousSessionsInvalidated: result.previous_sessions_invalidated || 0
      }
    }

    return { success: false, error: 'No data returned from session creation' }
  } catch (error) {
    // Handle duplicate key error in catch block too
    if (error.code === '23505' || 
        error.message?.includes('duplicate key') || 
        error.message?.includes('already exists') ||
        error.details?.includes('already exists')) {
      // Silently handle - session already exists, that's fine
      return {
        success: true,
        sessionId: null,
        isNewSession: false,
        previousSessionsInvalidated: 0
      }
    }
    console.error('Session creation failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Validate the current session
 * Returns validation result with reason if invalid
 */
export async function validateCurrentSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session || !session.access_token) {
      return {
        isValid: false,
        reason: 'NO_SESSION',
        message: 'No active session found'
      }
    }

    const deviceId = generateDeviceId()
    
    // Validate session with database
    const { data, error } = await supabase.rpc('validate_session', {
      p_session_token: session.access_token,
      p_device_id: deviceId
    })

    if (error) {
      console.error('Error validating session:', error)
      // If validation fails, assume session is invalid
      return {
        isValid: false,
        reason: 'VALIDATION_ERROR',
        message: error.message
      }
    }

    if (data && data.length > 0) {
      const result = data[0]
      
      if (!result.is_valid) {
        return {
          isValid: false,
          reason: result.invalidation_reason || 'SESSION_INVALID',
          message: getInvalidationMessage(result.invalidation_reason),
          userId: result.user_id
        }
      }

      return {
        isValid: true,
        userId: result.user_id,
        sessionId: result.session_id
      }
    }

    return {
      isValid: false,
      reason: 'UNKNOWN',
      message: 'Session validation returned no data'
    }
  } catch (error) {
    console.error('Session validation failed:', error)
    return {
      isValid: false,
      reason: 'VALIDATION_ERROR',
      message: error.message
    }
  }
}

/**
 * Invalidate the current session (logout)
 */
export async function invalidateSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session && session.access_token) {
      try {
        const { error } = await supabase.rpc('invalidate_session', {
          p_session_token: session.access_token
        })

        if (error) {
          // Ignore errors - session might already be invalid
          console.warn('Session invalidation warning:', error.message)
        }
      } catch (rpcError) {
        // Ignore RPC errors - session might already be invalid
        console.warn('RPC call failed (session may already be invalid):', rpcError.message)
      }
    }

    // Sign out from Supabase - handle 403 errors gracefully
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (signOutError) {
      // If signOut fails (e.g., 403), the session is already invalid
      // That's fine - we just need to clear local state
      if (signOutError.message?.includes('403') || signOutError.status === 403) {
        console.warn('Session already invalid (403) - this is expected when session is replaced')
      } else {
        // For other errors, log but don't throw
        console.warn('Sign out warning:', signOutError.message)
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Session invalidation failed:', error)
    // Even if there's an error, try to sign out locally
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (localError) {
      // Ignore local sign out errors
    }
    return { success: false, error: error.message }
  }
}

/**
 * Get user-friendly message for invalidation reason
 */
function getInvalidationMessage(reason) {
  const messages = {
    'SESSION_REPLACED': 'تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.',
    'DEVICE_MISMATCH': 'تم إلغاء جلستك بسبب عدم تطابق الجهاز.',
    'SESSION_INACTIVE': 'انتهت صلاحية جلستك.',
    'SESSION_NOT_FOUND': 'لم يتم العثور على جلستك.',
    'USER_LOGOUT': 'تم تسجيل خروجك.'
  }
  
  return messages[reason] || 'جلستك لم تعد صالحة.'
}

/**
 * Check if session was replaced (for showing logout message)
 */
export function checkSessionReplaced() {
  // Check URL parameters for logout reason
  const urlParams = new URLSearchParams(window.location.search)
  const logoutReason = urlParams.get('logout_reason')
  
  if (logoutReason === 'SESSION_REPLACED') {
    return {
      wasReplaced: true,
      message: 'تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.'
    }
  }
  
  // Check localStorage for session replacement flag
  const sessionReplaced = localStorage.getItem('session_replaced')
  if (sessionReplaced === 'true') {
    localStorage.removeItem('session_replaced')
    return {
      wasReplaced: true,
      message: 'تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.'
    }
  }
  
  return { wasReplaced: false }
}

/**
 * Set session replaced flag (called when we detect session was replaced)
 */
export function setSessionReplacedFlag() {
  localStorage.setItem('session_replaced', 'true')
}

