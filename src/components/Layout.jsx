import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import '../styles/design-system.css'
import './Layout.css'

function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to={user?.role === 'student' ? '/student/dashboard' : user?.role === 'creator' ? '/creator/dashboard' : user?.role === 'admin' ? '/admin/dashboard' : '/'} className="navbar-logo-link">
            <img 
              src="https://i.ibb.co/ccdRN4V4/lg.png" 
              alt="وجهة" 
              className="navbar-logo"
            />
          </Link>
          
          <div className="navbar-menu">
            {user ? (
              <>
                {user?.role === 'student' && (
                  <>
                    <Link to="/student/dashboard" className="navbar-link">لوحة التحكم</Link>
                    <Link to="/courses" className="navbar-link">الدورات</Link>
                  </>
                )}
                {user?.role === 'creator' && (
                  <>
                    <Link to="/creator/dashboard" className="navbar-link">لوحة التحكم</Link>
                    <Link to="/creator/create-course" className="navbar-link">إنشاء دورة</Link>
                  </>
                )}
                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard" className="navbar-link">لوحة التحكم</Link>
                    <Link to="/courses" className="navbar-link">جميع الدورات</Link>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user?.name}</span>
                  <button 
                    onClick={handleLogout} 
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    تسجيل الخروج
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="navbar-link">تسجيل الدخول</Link>
                <Link to="/signup" className="btn-primary">اشترك الآن</Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
      <footer className="footer">
        <div className="footer-container">
          <div style={{ textAlign: 'center' }}>
            <img 
              src="https://i.ibb.co/ccdRN4V4/lg.png" 
              alt="أكاديمية وجهة" 
              className="footer-logo"
            />
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.75rem' }}>
              أكاديمية وجهة - مهارات المستقبل
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>&copy; 2025 Wijha Academy</p>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              جميع الحقوق محفوظة
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/" className="footer-link">الرئيسية</Link>
            <Link to="/courses" className="footer-link">الدورات</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout

