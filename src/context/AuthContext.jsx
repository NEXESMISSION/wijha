import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, createProfileIfMissing } from '../lib/api'
import { createSession, validateCurrentSession, invalidateSession, checkSessionReplaced } from '../lib/sessionManager'

// Only log in development mode
const isDev = import.meta.env.DEV
const debugLog = (...args) => {
  if (isDev) console.log(...args)
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoutMessage, setLogoutMessage] = useState(null)
  const [isSessionInvalid, setIsSessionInvalid] = useState(false)
  const isCreatingSessionRef = { current: false } // Use ref to avoid closure issues
  const isInitializingRef = { current: false } // Prevent multiple simultaneous initializations

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
        console.warn('[AuthContext] Loading timeout - forcing loading to false after 10 seconds')
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
          // Quick check in background - only to detect device conflicts
          Promise.all([
            createSession(userId, session.access_token).catch(() => {}),
            validateCurrentSession().then(validation => {
              // ONLY act if another device logged in (SESSION_REPLACED)
              if (!validation.isValid && validation.reason === 'SESSION_REPLACED') {
                console.warn('[AuthContext] Another device logged in!')
                setIsSessionInvalid(true)
                setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
                setUser(null)
                setProfile(null)
                supabase.auth.signOut({ scope: 'local' }).catch(() => {})
              }
            }).catch(() => {})
          ]).finally(() => {
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
      console.error('[AuthContext] Error in getSession:', error)
      if (isMounted) {
        setLoading(false)
        loadingCleared = true
        clearTimeout(loadingTimeout)
      }
    })

    // Set up periodic session validation (every 60 seconds - optimized to reduce data usage)
    // Only validate if user is logged in and session is currently valid
    sessionValidationInterval = setInterval(async () => {
      if (!isMounted) return
      
      // Skip validation if:
      // 1. Session is already marked as invalid (save data)
      // 2. We're currently creating a session (avoid race condition)
      if (isSessionInvalid || isCreatingSessionRef.current) return
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session && user) {
        // Lightweight validation - only check if we have a user
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
            console.warn('Sign out warning (session may already be invalid):', error.message)
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
        setLogoutMessage(null)
        setUser(session.user)
        setLoading(false) // Clear loading immediately - don't wait for anything
        loadingCleared = true
        clearTimeout(loadingTimeout) // Clear the timeout since we're done loading
        
        // Session management is ONLY to detect if another device logged in
        // Do this in background - don't block the user at all
        if (session.access_token) {
          // Quick check in background - only to detect device conflicts
          // Ignore duplicate session errors - that's fine
          // Delay validation slightly to avoid false positives right after login
          setTimeout(() => {
            Promise.all([
              createSession(userId, session.access_token).catch((err) => {
                // Ignore duplicate key errors - session already exists, that's fine
                if (err.code !== '23505' && !err.message?.includes('duplicate key') && !err.message?.includes('already exists')) {
                  console.warn('[AuthContext] Session creation warning:', err.message)
                }
              }),
              validateCurrentSession().then(validation => {
                // ONLY act if another device logged in (SESSION_REPLACED)
                // Don't act on other validation failures (might be temporary network issues)
                if (!validation.isValid && validation.reason === 'SESSION_REPLACED') {
                  console.warn('[AuthContext] Another device logged in!')
                  setIsSessionInvalid(true)
                  setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
                  setUser(null)
                  setProfile(null)
                  supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                } else if (!validation.isValid) {
                  // Other validation failures - log but don't act (might be temporary)
                  debugLog('[AuthContext] Session validation failed (non-critical):', validation.reason)
                }
              }).catch((err) => {
                // Validation error - don't act, might be temporary network issue
                debugLog('[AuthContext] Session validation error (non-critical):', err.message)
              })
            ]).finally(() => {
              isCreatingSessionRef.current = false
            })
          }, 2000) // Wait 2 seconds before validating to avoid false positives after login
        }
        
        // Load profile in background (non-blocking)
        if (!profileLoadCache.has(userId)) {
          profileLoadCache.add(userId)
          loadProfile(userId).finally(() => {
            profileLoadCache.delete(userId)
          }).catch(() => {})
        }
      } else {
        debugLog('[AuthContext] No session in auth state change, clearing user')
        setUser(null)
        setProfile(null)
        profileLoadCache.clear()
        setLoading(false)
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
      console.error('[AuthContext] Error loading profile:', error)
      // Don't fail if profile doesn't exist - it might be created by trigger
      if (error.code === 'PGRST116' || error.message === 'Profile load timeout') {
        console.warn('[AuthContext] Profile load timeout or not found (expected)')
        // Silent fail for expected errors
      }
      setProfile(null)
    }
    // Note: setLoading(false) is called in the finally block of the caller
  }

  const login = async (email, password) => {
    try {
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
        return { success: false, error: error.message }
      }

      if (data?.user && data?.session) {
        setUser(data.user)
        
        // Create session in database (this will invalidate other sessions)
        if (data.session.access_token) {
          isCreatingSessionRef.current = true // Mark that we're creating a session
          setIsSessionInvalid(false) // Clear invalid flag before creating
          
          try {
            const sessionResult = await createSession(data.user.id, data.session.access_token)
            
            if (sessionResult.success) {
              // Session created successfully - clear invalid flag
              setIsSessionInvalid(false)
              setLogoutMessage(null)
              
              // Wait a bit before allowing validation (let session commit to DB)
              setTimeout(() => {
                isCreatingSessionRef.current = false
              }, 1500) // 1.5 second grace period for DB commit
            } else {
              console.error('Failed to create session:', sessionResult.error)
              isCreatingSessionRef.current = false
            }
          } catch (error) {
            console.error('Error creating session:', error)
            isCreatingSessionRef.current = false
          }
        }
        
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
        
        return { success: true }
      }

      return { success: false, error: 'Login failed: No user data received' }
    } catch (error) {
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

      // Validate password length
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' }
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
