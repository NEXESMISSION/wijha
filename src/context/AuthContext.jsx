import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, createProfileIfMissing } from '../lib/api'
import { createSession, validateCurrentSession, invalidateSession, checkSessionReplaced } from '../lib/sessionManager'

// Session timeout: 24 hours of inactivity
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours

// Disable all debug logging - remove console logs completely
const debugLog = () => {} // No-op function - no logging

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoutMessage, setLogoutMessage] = useState(null)
  const [isSessionInvalid, setIsSessionInvalid] = useState(false)
  const isCreatingSessionRef = { current: false } // Use ref to avoid closure issues
  const isInitializingRef = { current: false } // Prevent multiple simultaneous initializations
  const isLoggingInRef = { current: false } // Track if user is currently logging in

  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      debugLog('[AuthContext] Already initializing, skipping duplicate init')
      return
    }
    
    isInitializingRef.current = true
    let isMounted = true
    const profileLoadCache = new Set() // Track which profiles are being loaded
    let sessionValidationInterval = null
    
    // Safety timeout: Force clear loading after 10 seconds to prevent infinite loading
    // Use a ref to track if we've already cleared loading
    let loadingCleared = false
    let loadingTimeout = setTimeout(() => {
      if (isMounted && !loadingCleared) {
        setLoading(false)
        loadingCleared = true
      }
    }, 10000)

    debugLog('[AuthContext] Initializing auth check...')

    // Get initial session and validate it
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      debugLog('[AuthContext] getSession result:', { hasSession: !!session, userId: session?.user?.id })
      
      if (session && isMounted) {
        const userId = session.user.id
        debugLog('[AuthContext] Session found, userId:', userId)
        
        // Set user immediately - don't block on anything
        setIsSessionInvalid(false)
        setLogoutMessage(null)
        setUser(session.user)
        setLoading(false) // Clear loading immediately
        
        // Session management is ONLY to detect if another device logged in
        // Do this in background - don't block the user
        if (session.access_token) {
          // Create session FIRST, then validate AFTER it's created
          isCreatingSessionRef.current = true
          createSession(userId, session.access_token)
            .then(() => {
              // Wait a bit for DB to commit, then validate
              setTimeout(() => {
                isCreatingSessionRef.current = false
                validateCurrentSession().then(validation => {
                  // ONLY act if another device logged in (SESSION_REPLACED)
                  if (!validation.isValid && validation.reason === 'SESSION_REPLACED') {
                    setIsSessionInvalid(true)
                    setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
                    setUser(null)
                    setProfile(null)
                    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                  }
                }).catch(() => {})
              }, 1000) // Wait 1 second for DB commit before validating
            })
            .catch((err) => {
              // Ignore duplicate key errors - session already exists, that's fine
              // Silently handle errors
              isCreatingSessionRef.current = false
            })
        }
        
        // Load profile in background (non-blocking)
        if (!profileLoadCache.has(userId)) {
          profileLoadCache.add(userId)
          loadProfile(userId).finally(() => {
            profileLoadCache.delete(userId)
          }).catch(() => {})
        }
      } else if (isMounted) {
        debugLog('[AuthContext] No session found, clearing loading')
        setLoading(false)
        loadingCleared = true
        clearTimeout(loadingTimeout)
      }
    }).catch((error) => {
      // Silently handle errors
      if (isMounted) {
        setLoading(false)
        loadingCleared = true
        clearTimeout(loadingTimeout)
      }
    })

    // Track last activity time for session timeout
    let lastActivityTime = Date.now()
    
    // Update last activity on user interaction
    const updateActivity = () => {
      lastActivityTime = Date.now()
    }
    
    // Add event listeners for user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true })
    })
    
    // Set up periodic session validation (every 60 seconds - optimized to reduce data usage)
    // Only validate if user is logged in and session is currently valid
    sessionValidationInterval = setInterval(async () => {
      if (!isMounted) return
      
      // Skip validation if:
      // 1. Session is already marked as invalid (save data)
      // 2. We're currently creating a session (avoid race condition)
      if (isSessionInvalid || isCreatingSessionRef.current) return
      
      // Check for session timeout (inactivity)
      // Don't timeout if user is currently logging in
      if (!isLoggingInRef.current) {
        const timeSinceActivity = Date.now() - lastActivityTime
        if (timeSinceActivity > SESSION_TIMEOUT_MS) {
          setIsSessionInvalid(true)
          setLogoutMessage('تم انتهاء الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى.')
          setUser(null)
          setProfile(null)
          try {
            await supabase.auth.signOut({ scope: 'local' })
          } catch (error) {
            // Silently handle errors
          }
          try {
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-') && (key.includes('auth-token') || key.includes('auth'))) {
                localStorage.removeItem(key)
              }
            })
          } catch (clearError) {
            // Ignore clear errors
          }
          return
        }
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session && user) {
        // Lightweight validation - only check if we have a user
        // Don't validate if user is currently logging in
        if (!isLoggingInRef.current) {
          const validation = await validateCurrentSession()
          if (!validation.isValid) {
            // Session is invalid - logout user
            setIsSessionInvalid(true)
            
            // ONLY show logout message if session was REPLACED by another device
            // Don't show message for other reasons (normal logout, expired, etc.)
            if (validation.reason === 'SESSION_REPLACED') {
              setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
            } else {
              // For other reasons, just logout silently (no message)
              setLogoutMessage(null)
            }
            
            // Clear user state first
            setUser(null)
            setProfile(null)
            // Sign out - handle errors gracefully
            try {
              await supabase.auth.signOut({ scope: 'local' })
            } catch (error) {
              // If signOut fails (403), session is already invalid - that's fine
              // Silently handle errors
            }
            // Also manually clear Supabase session storage to prevent auto-login on refresh
            try {
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && (key.includes('auth-token') || key.includes('auth'))) {
                  localStorage.removeItem(key)
                }
              })
            } catch (clearError) {
              // Ignore clear errors
            }
          } else {
            // Session is valid - clear invalid flag
            setIsSessionInvalid(false)
          }
        }
      } else if (!session && user) {
        // Lost session but user state still exists - invalidate
        setIsSessionInvalid(true)
        setUser(null)
        setProfile(null)
      }
    }, 60000) // Check every 60 seconds (reduced frequency to save data)

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      debugLog('[AuthContext] onAuthStateChange:', { event, hasSession: !!session, userId: session?.user?.id })
      if (!isMounted) {
        debugLog('[AuthContext] Component unmounted, ignoring auth state change')
        return
      }
      
      if (session) {
        const userId = session.user.id
        
        // Set user and clear loading IMMEDIATELY - don't wait for anything
        debugLog('[AuthContext] Setting user immediately (non-blocking)')
        setIsSessionInvalid(false)
        setLogoutMessage(null) // Always clear logout message when session exists
        setUser(session.user)
        setLoading(false) // Clear loading immediately - don't wait for anything
        loadingCleared = true
        clearTimeout(loadingTimeout) // Clear the timeout since we're done loading
        
        // Session management is ONLY to detect if another device logged in
        // Do this in background - don't block the user at all
        if (session.access_token) {
          // Create session FIRST, then validate AFTER it's created
          // This prevents race conditions where validation runs before session exists in DB
          isCreatingSessionRef.current = true
          createSession(userId, session.access_token)
            .then(() => {
              // Wait longer for DB to commit, then validate
              // Increase delay to ensure session is fully created before validation
              setTimeout(() => {
                isCreatingSessionRef.current = false
                // Only validate if user is still logged in (not logging in)
                if (!isLoggingInRef.current) {
                  validateCurrentSession().then(validation => {
                    // ONLY act if another device logged in (SESSION_REPLACED)
                    // Don't act on other validation failures (might be temporary network issues)
                    if (!validation.isValid && validation.reason === 'SESSION_REPLACED') {
                      setIsSessionInvalid(true)
                      setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
                      setUser(null)
                      setProfile(null)
                      supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                    } else if (!validation.isValid) {
                      // Other validation failures - don't set logout message during initial login
                      // Only log, don't act (might be temporary)
                      debugLog('[AuthContext] Session validation failed (non-critical):', validation.reason)
                    }
                  }).catch((err) => {
                    // Validation error - don't act, might be temporary network issue
                    debugLog('[AuthContext] Session validation error (non-critical):', err.message)
                  })
                }
              }, 2000) // Wait 2 seconds for DB commit before validating (increased from 1 second)
            })
            .catch((err) => {
              // Ignore duplicate key errors - session already exists, that's fine
              // Silently handle errors
              isCreatingSessionRef.current = false
            })
        }
        
        // Load profile in background (non-blocking)
        if (!profileLoadCache.has(userId)) {
          profileLoadCache.add(userId)
          loadProfile(userId).finally(() => {
            profileLoadCache.delete(userId)
          }).catch(() => {})
        }
      } else {
        // Handle events with no session
        if (event === 'SIGNED_OUT') {
          // Only clear user on explicit SIGNED_OUT events
          debugLog('[AuthContext] SIGNED_OUT event, clearing user')
          setUser(null)
          setProfile(null)
          profileLoadCache.clear()
          setLoading(false)
        } else if (event === 'INITIAL_SESSION') {
          // INITIAL_SESSION with no session is normal on page load - just clear loading
          debugLog('[AuthContext] INITIAL_SESSION with no session (normal on page load)')
          setLoading(false)
          loadingCleared = true
          clearTimeout(loadingTimeout)
        } else if (event === 'TOKEN_REFRESHED') {
          // TOKEN_REFRESHED events can have null session temporarily - don't clear user
          debugLog('[AuthContext] TOKEN_REFRESHED with no session (temporary)')
          setLoading(false)
        }
        // For all other events with no session, do nothing (might be temporary)
      }
    })

    return () => {
      isMounted = false
      isInitializingRef.current = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
      if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval)
      }
      // Remove activity event listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateActivity)
      })
    }
  }, [])

  const loadProfile = async (userId) => {
    debugLog('[AuthContext] loadProfile called for userId:', userId)
    try {
      // Add timeout to profile loading (reduced to 5 seconds)
      const profilePromise = getProfile(userId)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 5000)
      )
      
      debugLog('[AuthContext] Waiting for profile data...')
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      debugLog('[AuthContext] Profile data received:', { hasProfile: !!profileData })
      
      if (profileData) {
        setProfile(profileData)
      } else {
        // Profile doesn't exist yet - might be created by trigger soon
        debugLog('[AuthContext] No profile data, setting to null')
        setProfile(null)
      }
    } catch (error) {
      // Silently handle errors - profile might be created by trigger
      setProfile(null)
    }
    // Note: setLoading(false) is called in the finally block of the caller
  }

  const login = async (email, password) => {
    try {
      // Mark that we're logging in to prevent showing logout messages during login
      isLoggingInRef.current = true
      
      // IMMEDIATELY clear any stale logout messages and invalid session flags
      // This prevents showing "session ended" popup during login
      setIsSessionInvalid(false)
      setLogoutMessage(null)
      
      // Wrap Supabase call with timeout
      const authPromise = supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Authentication request timed out. Please check your internet connection.')), 15000)
      )
      
      const { data, error } = await Promise.race([authPromise, timeoutPromise])

      if (error) {
        isLoggingInRef.current = false // Reset flag on error
        return { success: false, error: error.message }
      }

      if (data?.user && data?.session) {
        // IMMEDIATELY clear any stale logout messages and invalid session flags
        // This prevents showing "session ended" popup after successful login
        setIsSessionInvalid(false)
        setLogoutMessage(null)
        
        // Don't create session here - let onAuthStateChange handle it
        // This prevents race conditions and duplicate session creation
        setUser(data.user)
        
        // Try to load or create profile, but don't block login
        createProfileIfMissing(data.user.id, data.user)
          .then((profileData) => {
            if (profileData) {
              setProfile(profileData)
            }
          })
          .catch(() => {
            // Silent fail - profile will load on next check
          })
        
        // Keep isLoggingInRef.current = true for a bit longer to prevent validation from showing messages
        // Reset after a delay to allow normal session validation
        setTimeout(() => {
          isLoggingInRef.current = false
        }, 3000) // Wait 3 seconds after login before allowing validation messages
        
        return { success: true }
      }

      isLoggingInRef.current = false // Reset flag if no user data
      return { success: false, error: 'Login failed: No user data received' }
    } catch (error) {
      isLoggingInRef.current = false // Reset flag on error
      return { success: false, error: error.message || 'An unexpected error occurred' }
    }
  }

  const signup = async (name, email, password, role) => {
    try {
      // Validate role
      if (!['student', 'creator', 'admin'].includes(role)) {
        return { success: false, error: 'Invalid role selected' }
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Invalid email format' }
      }

      // Enhanced password validation
      if (password.length < 8) {
        return { success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }
      }
      
      // Check for password complexity
      const hasUpperCase = /[A-Z]/.test(password)
      const hasLowerCase = /[a-z]/.test(password)
      const hasNumbers = /\d/.test(password)
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return { 
          success: false, 
          error: 'كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص' 
        }
      }

      // Wrap Supabase call with timeout
      const signupPromise = supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            role: role,
          },
        },
      })
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signup request timed out. Please check your internet connection.')), 15000)
      )
      
      const { data, error } = await Promise.race([signupPromise, timeoutPromise])

      if (error) {
        // Provide more specific error messages
        let errorMessage = error.message
        let redirectToLogin = false
        
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          errorMessage = 'This email is already registered. Please login instead.'
          redirectToLogin = true
        } else if (error.message.includes('invalid')) {
          errorMessage = 'Invalid email or password format.'
        } else if (error.message.includes('Password')) {
          errorMessage = error.message
        } else if (error.message.includes('email')) {
          errorMessage = 'Invalid email address.'
        }
        
        return { 
          success: false, 
          error: errorMessage,
          redirectToLogin 
        }
      }

      if (data?.user) {
        setUser(data.user)
        
        // Load profile in background after a delay (for trigger to create it)
        setTimeout(() => {
          loadProfile(data.user.id).catch(() => {
            // Silent fail - profile will be created by trigger
          })
        }, 1000)
      }

      // Check if email confirmation is required
      if (data?.session === null) {
        return { 
          success: true, 
          message: 'Please check your email to confirm your account before logging in.' 
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message || 'An unexpected error occurred' }
    }
  }

  const logout = async () => {
    // Invalidate session in database
    await invalidateSession()
    setUser(null)
    setProfile(null)
    setLogoutMessage(null)
    setIsSessionInvalid(false)
  }

  // Validate session manually (can be called on route changes)
  const validateSession = async () => {
    // Skip if already invalid or currently creating session or logging in
    if (isSessionInvalid || isCreatingSessionRef.current || isLoggingInRef.current || !user) {
      return { isValid: true } // Return valid to prevent unnecessary checks
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return { isValid: false }
      }

      const validation = await validateCurrentSession()
      if (!validation.isValid) {
        // Session is invalid - logout user
        setIsSessionInvalid(true)
        
        // ONLY show logout message if session was REPLACED by another device
        if (validation.reason === 'SESSION_REPLACED') {
          setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
        } else {
          // For other reasons, just logout silently (no message)
          setLogoutMessage(null)
        }
        
        // Clear user state first
        setUser(null)
        setProfile(null)
        // Sign out - handle errors gracefully
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch (error) {
          // If signOut fails (403), session is already invalid - that's fine
          // Silently handle errors
        }
        // Also manually clear Supabase session storage to prevent auto-login on refresh
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && (key.includes('auth-token') || key.includes('auth'))) {
              localStorage.removeItem(key)
            }
          })
        } catch (clearError) {
          // Ignore clear errors
        }
      } else {
        // Session is valid - clear invalid flag
        setIsSessionInvalid(false)
      }
      
      return validation
    } catch (error) {
      // Ignore validation errors (might be temporary network issues)
      return { isValid: true } // Assume valid on error to prevent false logouts
    }
  }

  // Combine user and profile for convenience
  // If profile doesn't exist yet, still return user with role from metadata
  let userWithProfile = null
  if (user) {
    if (profile) {
      userWithProfile = { ...user, ...profile }
    } else {
      // Profile doesn't exist yet, but use role from user metadata if available
      const roleFromMetadata = user.user_metadata?.role
      userWithProfile = { 
        ...user, 
        role: roleFromMetadata || 'student', // Default to student if no role
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User'
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: userWithProfile,
        profile,
        login,
        signup,
        logout,
        validateSession,
        loading,
        logoutMessage,
        isSessionInvalid,
        clearLogoutMessage: () => {
          setLogoutMessage(null)
          setIsSessionInvalid(false)
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
