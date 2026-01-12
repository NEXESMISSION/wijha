import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, createProfileIfMissing } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const profileLoadCache = new Set() // Track which profiles are being loaded

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isMounted) {
        setUser(session.user)
        const userId = session.user.id
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      if (session) {
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

      if (data?.user) {
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
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
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
