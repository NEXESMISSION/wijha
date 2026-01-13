import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, createProfileIfMissing } from '../lib/api'
import { createSession, validateCurrentSession, invalidateSession, checkSessionReplaced } from '../lib/sessionManager'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoutMessage, setLogoutMessage] = useState(null)
  const [isSessionInvalid, setIsSessionInvalid] = useState(false)

  useEffect(() => {
    let isMounted = true
    const profileLoadCache = new Set() // Track which profiles are being loaded
    let sessionValidationInterval = null

    // Check for session replacement message
    const sessionCheck = checkSessionReplaced()
    if (sessionCheck.wasReplaced) {
      setLogoutMessage(sessionCheck.message)
    }

    // Get initial session and validate it
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && isMounted) {
        // Validate session before proceeding
        const validation = await validateCurrentSession()
        
        if (!validation.isValid) {
          // Session is invalid - logout user
          if (validation.reason === 'SESSION_REPLACED') {
            setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
          }
          // Clear user state first to prevent auto-login
          setUser(null)
          setProfile(null)
          setLoading(false)
          // Sign out - handle errors gracefully (session might already be invalid)
          try {
            await supabase.auth.signOut({ scope: 'local' })
          } catch (error) {
            // If signOut fails (403), session is already invalid - that's fine
            console.warn('Sign out warning (session may already be invalid):', error.message)
          }
          // Also manually clear Supabase session storage to prevent auto-login on refresh
          try {
            // Clear all Supabase-related keys
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

        // Session is valid - proceed with normal flow
        setUser(session.user)
        const userId = session.user.id
        
        // Create/update session in database
        if (session.access_token) {
          createSession(userId, session.access_token).catch(err => {
            console.warn('Failed to create session:', err)
            // Don't block login if session creation fails
          })
        }
        
        if (!profileLoadCache.has(userId)) {
          profileLoadCache.add(userId)
          loadProfile(userId).finally(() => {
            profileLoadCache.delete(userId)
          })
        }
      } else if (isMounted) {
        setLoading(false)
      }
    }).catch(() => {
      if (isMounted) setLoading(false)
    })

    // Set up periodic session validation (every 60 seconds - optimized to reduce data usage)
    // Only validate if user is logged in and session is currently valid
    sessionValidationInterval = setInterval(async () => {
      if (!isMounted) return
      
      // Skip validation if session is already marked as invalid (save data)
      if (isSessionInvalid) return
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session && user) {
        // Lightweight validation - only check if we have a user
        const validation = await validateCurrentSession()
        if (!validation.isValid) {
          // Session is invalid - logout user
          setIsSessionInvalid(true)
          if (validation.reason === 'SESSION_REPLACED') {
            setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
          } else {
            setLogoutMessage('جلستك لم تعد صالحة. سيتم توجيهك إلى صفحة تسجيل الدخول.')
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
      if (!isMounted) return
      
      if (session) {
        // Validate session before accepting it (prevent auto-login with invalid session)
        const validation = await validateCurrentSession()
        if (!validation.isValid) {
          // Session is invalid - don't set user, clear session
          setIsSessionInvalid(true)
          if (validation.reason === 'SESSION_REPLACED') {
            setLogoutMessage('تم تسجيل خروجك لأن حسابك تم الوصول إليه من جهاز آخر.')
          } else {
            setLogoutMessage('جلستك لم تعد صالحة. سيتم توجيهك إلى صفحة تسجيل الدخول.')
          }
          setUser(null)
          setProfile(null)
          try {
            await supabase.auth.signOut({ scope: 'local' })
            // Clear localStorage
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-') && (key.includes('auth-token') || key.includes('auth'))) {
                localStorage.removeItem(key)
              }
            })
          } catch (error) {
            // Ignore errors
          }
          setLoading(false)
          return
        }
        
        // Session is valid - clear invalid flag
        setIsSessionInvalid(false)
        setUser(session.user)
        const userId = session.user.id
        // Load profile in background, don't block - but prevent duplicates
        if (!profileLoadCache.has(userId)) {
          profileLoadCache.add(userId)
          loadProfile(userId).catch(err => {
            console.warn('Auth state change profile load failed:', err)
          }).finally(() => {
            profileLoadCache.delete(userId)
          })
        }
      } else {
        setUser(null)
        setProfile(null)
        profileLoadCache.clear()
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
      if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval)
      }
    }
  }, [])

  const loadProfile = async (userId) => {
    try {
      // Add timeout to profile loading (reduced to 5 seconds)
      const profilePromise = getProfile(userId)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 5000)
      )
      
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      
      if (profileData) {
        setProfile(profileData)
      } else {
        // Profile doesn't exist yet - might be created by trigger soon
        setProfile(null)
      }
    } catch (error) {
      // Don't fail if profile doesn't exist - it might be created by trigger
      if (error.code === 'PGRST116' || error.message === 'Profile load timeout') {
        // Silent fail for expected errors
      }
      setProfile(null)
    } finally {
      setLoading(false)
    }
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
          const sessionResult = await createSession(data.user.id, data.session.access_token)
          
          if (sessionResult.success && sessionResult.previousSessionsInvalidated > 0) {
            // Other sessions were invalidated - this is expected behavior
            console.log(`Previous ${sessionResult.previousSessionsInvalidated} session(s) invalidated`)
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
