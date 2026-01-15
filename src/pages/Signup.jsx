import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import BackButton from '../components/BackButton'
import { sanitizeInput, RateLimiter } from '../lib/security'
import '../styles/design-system.css'
import './Auth.css'

const signupRateLimiter = new RateLimiter(5, 15 * 60 * 1000) // 5 attempts per 15 minutes

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [justSignedUp, setJustSignedUp] = useState(false)
  const { signup, user } = useAuth()
  const { showSuccess } = useAlert()
  const navigate = useNavigate()

  const getRedirectRoute = (userRole) => {
    if (userRole === 'student') return '/courses'
    if (userRole === 'creator') return '/creator/dashboard'
    if (userRole === 'admin') return '/admin/dashboard'
    return '/'
  }

  // Redirect after signup when user state updates
  useEffect(() => {
    if (justSignedUp && user?.role) {
      const route = getRedirectRoute(user.role)
      navigate(route, { replace: true })
      setJustSignedUp(false)
    }
  }, [user, justSignedUp, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setLoading(true)
    
    // Sanitize inputs
    const sanitizedName = sanitizeInput(name)
    const sanitizedEmail = sanitizeInput(email.trim().toLowerCase())
    
    if (!sanitizedName || !sanitizedEmail || !password) {
      setError('يرجى ملء جميع الحقول')
      setLoading(false)
      return
    }
    
    // Check rate limit
    const rateLimitCheck = signupRateLimiter.checkLimit(sanitizedEmail)
    if (!rateLimitCheck.allowed) {
      setError(rateLimitCheck.message || 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً')
      setLoading(false)
      return
    }
    
    // Enhanced password validation
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      setLoading(false)
      return
    }
    
    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setError('كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص')
      setLoading(false)
      return
    }
    
    try {
      // Add timeout to prevent hanging
      const signupPromise = signup(sanitizedName, sanitizedEmail, password, role)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signup request timed out')), 30000)
      )
      
      const result = await Promise.race([signupPromise, timeoutPromise])
      
      if (result.success) {
        // Reset rate limit on success
        signupRateLimiter.reset(sanitizedEmail)
        if (result.message) {
          // Email confirmation required
          showSuccess(result.message, 'تم التسجيل')
          navigate('/login', { replace: true })
        } else {
          // Signed up successfully, redirect based on role
          setJustSignedUp(true)
          // Redirect will happen in useEffect when user state updates
        }
      } else {
        const errorMsg = result.error || 'فشل التسجيل. يرجى التحقق من المعلومات والمحاولة مرة أخرى.'
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
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
        maxWidth: '32rem',
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
            إنشاء حساب جديد
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            ابدأ رحلتك التعليمية معنا اليوم
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
            {error.includes('already registered') && (
              <div style={{ marginTop: '0.75rem' }}>
                <Link to="/login" style={{ 
                  color: '#F48434', 
                  fontWeight: 600,
                  textDecoration: 'none'
                }}>
                  الانتقال إلى صفحة تسجيل الدخول →
                </Link>
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">الاسم الكامل</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="أدخل اسمك الكامل"
              className="form-input"
            />
          </div>
          
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
              placeholder="أنشئ كلمة مرور (8 أحرف على الأقل: حرف كبير، صغير، رقم، رمز)"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">أريد أن أكون:</label>
            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              marginTop: '0.5rem'
            }}>
              <label style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${role === 'student' ? '#F48434' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                cursor: 'pointer',
                background: role === 'student' ? '#fdf2e8' : 'white',
                transition: 'all 0.3s',
                textAlign: 'center',
                fontWeight: 600,
                color: role === 'student' ? '#F48434' : '#6b7280'
              }}>
                <input
                  type="radio"
                  value="student"
                  checked={role === 'student'}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ display: 'none' }}
                />
                طالب
              </label>
              <label style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${role === 'creator' ? '#F48434' : '#e5e7eb'}`,
                borderRadius: '0.75rem',
                cursor: 'pointer',
                background: role === 'creator' ? '#fdf2e8' : 'white',
                transition: 'all 0.3s',
                textAlign: 'center',
                fontWeight: 600,
                color: role === 'creator' ? '#F48434' : '#6b7280'
              }}>
                <input
                  type="radio"
                  value="creator"
                  checked={role === 'creator'}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ display: 'none' }}
                />
                منشئ محتوى
              </label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn-gradient"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
          </button>
        </form>
        
        <p style={{ 
          textAlign: 'center', 
          marginTop: '1.5rem', 
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" style={{ 
            color: '#F48434', 
            fontWeight: 600,
            textDecoration: 'none'
          }}>
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Signup

