import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import { sanitizeInput, RateLimiter } from '../lib/security'
import '../styles/design-system.css'
import './Auth.css'

const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000) // 5 attempts per 15 minutes

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [justLoggedIn, setJustLoggedIn] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const getRedirectRoute = (userRole) => {
    if (userRole === 'student') return '/courses'
    if (userRole === 'creator') return '/creator/dashboard'
    if (userRole === 'admin') return '/admin/dashboard'
    return '/'
  }

  // Redirect after login when user state updates
  useEffect(() => {
    if (justLoggedIn && user?.role) {
      const route = getRedirectRoute(user.role)
      navigate(route, { replace: true })
      setJustLoggedIn(false)
    }
  }, [user, justLoggedIn, navigate])

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setLoading(true)
    
    // Sanitize email
    const sanitizedEmail = sanitizeInput(email.trim().toLowerCase())
    
    if (!sanitizedEmail || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور')
      setLoading(false)
      return
    }
    
    // Check rate limit
    const rateLimitCheck = loginRateLimiter.checkLimit(sanitizedEmail)
    if (!rateLimitCheck.allowed) {
      setError(rateLimitCheck.message || 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً')
      setLoading(false)
      return
    }
    
    try {
      // Add timeout to prevent hanging
      const loginPromise = login(sanitizedEmail, password)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out')), 30000)
      )
      
      const result = await Promise.race([loginPromise, timeoutPromise])
      if (result.success) {
        // Reset rate limit on success
        loginRateLimiter.reset(sanitizedEmail)
        setJustLoggedIn(true)
        // Redirect will happen in useEffect when user state updates
      } else {
        setError(result.error || 'فشل تسجيل الدخول')
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(-45deg, #ffffff, #ffffff, #fef3c7, #F48434, #ffffff, #ffffff, #fed7aa, #ffffff)',
      backgroundSize: '600% 600%',
      animation: 'gradientShift 3s linear infinite',
      position: 'relative',
      padding: '2rem 1rem'
    }}>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.75)',
        zIndex: 0
      }}></div>
      
      <div className="card" style={{
        maxWidth: '28rem',
        width: '100%',
        position: 'relative',
        zIndex: 10,
        padding: '3rem',
        background: 'white',
        borderRadius: '1.5rem',
        boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.15)'
      }}>
        <BackButton />
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="https://i.ibb.co/ccdRN4V4/lg.png" 
            alt="وجهة" 
            style={{ height: '3.5rem', marginBottom: '1rem' }}
          />
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 900, 
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            تسجيل الدخول
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            مرحباً بعودتك! يرجى تسجيل الدخول إلى حسابك
          </p>
        </div>
        
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="أدخل بريدك الإلكتروني"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="أدخل كلمة المرور"
              className="form-input"
            />
          </div>
          
          <button 
            type="submit" 
            className="btn-gradient"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
        
        <p style={{ 
          textAlign: 'center', 
          marginTop: '1.5rem', 
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          ليس لديك حساب؟{' '}
          <Link to="/signup" style={{ 
            color: '#F48434', 
            fontWeight: 600,
            textDecoration: 'none'
          }}>
            سجل الآن
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login

