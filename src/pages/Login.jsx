import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/design-system.css'
import './Auth.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setLoading(true)
    
    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }
    
    try {
      console.log('Attempting login...')
      // Add timeout to prevent hanging
      const loginPromise = login(email, password)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out')), 30000)
      )
      
      const result = await Promise.race([loginPromise, timeoutPromise])
      if (result.success) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 100)
      } else {
        setError(result.error || 'Login failed')
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

