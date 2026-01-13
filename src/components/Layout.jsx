import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { getProfile } from '../lib/api'
import BackButton from './BackButton'
import '../styles/design-system.css'
import './Layout.css'

function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileImage, setProfileImage] = useState(null)
  const [profileSlug, setProfileSlug] = useState(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Load user profile image and slug
    if (user?.id) {
      loadProfileImage()
    }
  }, [user])

  const loadProfileImage = async () => {
    try {
      const profile = await getProfile(user.id)
      const imageUrl = profile?.profile_image_url || user?.user_metadata?.avatar_url
      // Only set if we have a valid URL (not empty string)
      setProfileImage(imageUrl && imageUrl.trim() ? imageUrl : null)
      // For creators, also load the profile slug
      if (user?.role === 'creator' && profile?.profile_slug) {
        setProfileSlug(profile.profile_slug)
      }
    } catch (err) {
      console.error('Error loading profile image:', err)
      setProfileImage(null)
    }
  }

  useEffect(() => {
    // Close mobile menu when clicking outside
    const handleClickOutside = (e) => {
      if (mobileMenuOpen && !e.target.closest('.navbar-container') && !e.target.closest('.mobile-menu')) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [mobileMenuOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
    setMobileMenuOpen(false)
  }

  const handleProfileClick = () => {
    if (user?.role === 'student') {
      navigate('/student/dashboard')
    } else if (user?.role === 'creator') {
      // Navigate to creator profile page if slug exists, otherwise to dashboard
      if (profileSlug) {
        navigate(`/creator/${profileSlug}`)
      } else {
        navigate('/creator/dashboard')
      }
    } else if (user?.role === 'admin') {
      navigate('/admin/dashboard')
    }
    setMobileMenuOpen(false)
  }

  return (
    <div className="layout">
      <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to="/" className="navbar-logo-link">
            <img 
              src="https://i.ibb.co/ccdRN4V4/lg.png" 
              alt="وجهة" 
              className="navbar-logo"
            />
          </Link>
          
          {/* Desktop Menu */}
          <div className="navbar-menu desktop-menu">
            {user ? (
              <>
                <Link to="/courses" className="navbar-link">جميع الدورات</Link>
                {user?.role === 'student' && (
                  <>
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
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                  {/* Profile Button */}
                  <button
                    onClick={handleProfileClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: '2px solid #e5e7eb',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      padding: 0,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#7C34D9'
                      e.currentTarget.style.transform = 'scale(1.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    title={user?.role === 'creator' ? 'عرض ملفي الشخصي' : user?.role === 'student' ? 'عرض ملفي الشخصي' : 'الملف الشخصي'}
                  >
                    <img
                      src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email || 'User')}&background=7C34D9&color=fff&size=40`}
                      alt={user?.name || 'User'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                        display: 'block',
                        minWidth: '40px',
                        minHeight: '40px'
                      }}
                      onError={(e) => {
                        // Fallback to generated avatar if image fails
                        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email || 'User')}&background=7C34D9&color=fff&size=40`
                        if (e.target.src !== fallbackUrl) {
                          e.target.src = fallbackUrl
                        }
                      }}
                    />
                  </button>
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
                <Link to="/courses" className="navbar-link">جميع الدورات</Link>
                <Link to="/login" className="navbar-link">تسجيل الدخول</Link>
                <Link to="/signup" className="btn-primary">اشترك الآن</Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=40`}
                  alt={user?.name || 'User'}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(255, 255, 255, 0.3)'
                  }}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=40`
                  }}
                />
                <span style={{ color: 'white', fontSize: '0.9375rem', fontWeight: 700 }}>
                  {user?.name || 'زائر'}
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="mobile-menu-close"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <div className="mobile-menu-links">
              {user ? (
                <>
                  <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                    جميع الدورات
                  </Link>
                  {/* Profile Button */}
                  <button
                    onClick={handleProfileClick}
                    className="mobile-menu-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      textAlign: 'right',
                      background: 'none',
                      border: 'none',
                      padding: '1rem 1.5rem',
                      color: '#374151',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer'
                    }}
                  >
                    <img
                      src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=40`}
                      alt={user?.name || 'User'}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e5e7eb',
                        flexShrink: 0
                      }}
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=40`
                      }}
                    />
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#1f2937' }}>
                        {user?.name || 'الملف الشخصي'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {user?.role === 'student' ? 'طالب' : user?.role === 'creator' ? 'منشئ محتوى' : 'مدير'}
                      </div>
                    </div>
                  </button>
                  
                  {user?.role === 'student' && (
                    <>
                      <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        الدورات
                      </Link>
                    </>
                  )}
                  {user?.role === 'creator' && (
                    <>
                      <Link to="/creator/dashboard" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        لوحة التحكم
                      </Link>
                      <Link to="/creator/create-course" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        إنشاء دورة
                      </Link>
                    </>
                  )}
                  {user?.role === 'admin' && (
                    <>
                      <Link to="/admin/dashboard" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        لوحة التحكم
                      </Link>
                      <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        جميع الدورات
                      </Link>
                    </>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className="mobile-menu-link mobile-menu-button-logout"
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                    تسجيل الدخول
                  </Link>
                  <Link to="/signup" className="mobile-menu-link mobile-menu-button-primary" onClick={() => setMobileMenuOpen(false)}>
                    اشترك الآن
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div style={{ paddingTop: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          <BackButton label="← العودة" />
        </div>
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

