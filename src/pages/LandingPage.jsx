import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPublishedCourses, getProfile, getAllCategories, getProfileStats } from '../lib/api'
import { supabase } from '../lib/supabase'
import '../styles/design-system.css'
import './LandingPage.css'

function LandingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [stats, setStats] = useState({
    totalCourses: 0,
    freeCourses: 0,
    premiumCourses: 0,
    totalEnrollments: 0,
    activeLearners: 0,
    totalStudents: 0,
    totalCreators: 0
  })
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileImage, setProfileImage] = useState(null)
  const [profileSlug, setProfileSlug] = useState(null)
  const [categories, setCategories] = useState([])
  const [coursesByCategory, setCoursesByCategory] = useState({})

  useEffect(() => {
    loadData()
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadProfileImage()
    }
  }, [user])

  const loadProfileImage = async () => {
    try {
      const profile = await getProfile(user.id)
      const imageUrl = profile?.profile_image_url || user?.user_metadata?.avatar_url
      setProfileImage(imageUrl && imageUrl.trim() ? imageUrl : null)
      if (user?.role === 'creator' && profile?.profile_slug) {
        setProfileSlug(profile.profile_slug)
      }
    } catch (err) {
      console.error('Error loading profile image:', err)
      setProfileImage(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
    setMobileMenuOpen(false)
  }

  const handleProfileClick = () => {
    if (user?.role === 'student') {
      navigate('/student/dashboard')
    } else if (user?.role === 'creator') {
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

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load critical data first (categories and courses) - show immediately
      const [categoriesData, coursesData] = await Promise.all([
        getAllCategories().catch(() => []),
        getPublishedCourses().catch(() => [])
      ])
      
      // Set categories and courses immediately for faster initial render
      setCategories(categoriesData || [])
      setCourses(coursesData || [])
      
      // Group courses by category
      const grouped = {}
      if (coursesData) {
        coursesData.forEach(course => {
          const categoryId = course.category_id
          if (!grouped[categoryId]) {
            grouped[categoryId] = []
          }
          grouped[categoryId].push(course)
        })
      }
      setCoursesByCategory(grouped)
      
      // Calculate basic stats immediately
      const freeCourses = coursesData?.filter(c => parseFloat(c.price || 0) === 0) || []
      const premiumCourses = coursesData?.filter(c => parseFloat(c.price || 0) > 0) || []
      
      // Set initial stats (without enrollment data)
      setStats({
        totalCourses: coursesData?.length || 0,
        freeCourses: freeCourses.length,
        premiumCourses: premiumCourses.length,
        totalEnrollments: 0,
        activeLearners: 0,
        totalStudents: 0,
        totalCreators: 0
      })
      
      // Mark loading as false early so page renders
      setLoading(false)
      
      // Load stats in background (non-blocking)
      Promise.all([
        supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
          .then(({ count, error }) => ({ count: count || 0, error }))
          .catch(() => ({ count: 0, error: null })),
        supabase
        .from('enrollments')
        .select('student_id')
        .eq('status', 'approved')
          .then(({ data, error }) => ({ data: data || [], error }))
          .catch(() => ({ data: [], error: null })),
        getProfileStats()
      ]).then(([enrollmentsCountResult, uniqueStudentsResult, profileStats]) => {
        const uniqueStudentIds = new Set(uniqueStudentsResult.data?.map(e => e.student_id) || [])
      
        // Update stats with real data
        setStats(prev => ({
          ...prev,
          totalEnrollments: enrollmentsCountResult.count || 0,
          activeLearners: uniqueStudentIds.size || 0,
          totalStudents: profileStats.studentCount || 0,
          totalCreators: profileStats.creatorCount || 0
        }))
      }).catch(() => {
        // Silently fail - stats already set to 0
      })
    } catch (err) {
      console.error('Error loading landing page data:', err)
      setLoading(false)
    }
  }

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 80 // Account for fixed navbar
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  const scrollCategory = (categoryId, direction) => {
    const container = document.getElementById(`category-${categoryId}`)
    if (container) {
      const scrollAmount = 400
      container.scrollBy({
        left: direction === 'next' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const getCoursePlan = (course) => {
    const price = parseFloat(course.price || 0)
    if (price === 0) return 'free'
    if (price <= 100) return 'premium'
    return 'pro'
  }

  const getPlanLabel = (plan) => {
    switch(plan) {
      case 'free': return { text: '🆓 مجانية', bg: 'from-green-500 to-emerald-600' }
      case 'premium': return { text: '🚀 Premium', bg: 'from-primary-orange to-orange-600' }
      case 'pro': return { text: '👑 Pro', bg: 'from-primary-purple to-purple-700' }
      default: return { text: '', bg: '' }
    }
  }

  // Get top 2-3 categories with courses
  const featuredCategories = categories
    .filter(cat => coursesByCategory[cat.id] && coursesByCategory[cat.id].length > 0)
    .slice(0, 3)

  return (
    <div className="landing-page" dir="rtl">
      {/* Navigation - Matching Layout */}
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
                {user?.role === 'student' && (
                  <>
                    <Link to="/courses" className="navbar-link">جميع الدورات</Link>
                  </>
                )}
                {user?.role === 'creator' && (
                  <>
                    <Link to="/courses" className="navbar-link">جميع الدورات</Link>
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
                  <Link
                    to={user?.role === 'student' ? '/student/dashboard' : user?.role === 'creator' ? '/creator/dashboard' : '/admin/dashboard'}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}
                  >
                    لوحة التحكم
                </Link>
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
                <a href="#about" className="navbar-link" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>من نحن</a>
                <a href="#courses" className="navbar-link" onClick={(e) => { e.preventDefault(); scrollToSection('courses'); }}>الدورات</a>
                <a href="#testimonials" className="navbar-link" onClick={(e) => { e.preventDefault(); scrollToSection('testimonials'); }}>آراء الطلاب</a>
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
                {user && (
                  <>
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
                  </>
                )}
                {!user && (
                  <span style={{ color: 'white', fontSize: '0.9375rem', fontWeight: 700 }}>
                    زائر
                  </span>
                )}
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
                      <div style={{ fontWeight: 700, color: '#1f2937' }}>عرض ملفي الشخصي</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {user?.role === 'student' ? 'عرض ملفك الشخصي' : user?.role === 'creator' ? 'عرض ملفك الشخصي' : 'لوحة التحكم'}
                      </div>
                    </div>
                  </button>
                  
                  {user?.role === 'student' && (
                    <>
                      <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        جميع الدورات
                      </Link>
                    </>
                  )}
                  {user?.role === 'creator' && (
                    <>
                      <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                        جميع الدورات
                      </Link>
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
                  <Link to="/courses" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                    جميع الدورات
                  </Link>
                  <a href="#about" className="mobile-menu-link" onClick={(e) => { e.preventDefault(); scrollToSection('about'); setMobileMenuOpen(false); }}>من نحن</a>
                  <a href="#courses" className="mobile-menu-link" onClick={(e) => { e.preventDefault(); scrollToSection('courses'); setMobileMenuOpen(false); }}>الدورات</a>
                  <a href="#testimonials" className="mobile-menu-link" onClick={(e) => { e.preventDefault(); scrollToSection('testimonials'); setMobileMenuOpen(false); }}>آراء الطلاب</a>
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

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-visual">
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80" 
              alt="التعلم والتعليم"
            />
            <img 
              src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80" 
              alt="التعلم والتعليم"
            />
            <img 
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80" 
              alt="التعلم والتعليم"
            />
          </div>

          <div className="hero-content">
            <div className="hero-badge">
              🚀 أكاديمية وجهة لمهارات المستقبل
            </div>
            <h1 className="hero-title">
              <span className="hero-title-accent">اصنع مستقبلك بمهارات اليوم</span>
            </h1>
            
            <p className="hero-description">
              منصة تجمع بين المنشئين والطلاب لاكتساب مهارات المستقبل. سواء كنت تريد تعلم مهارات جديدة أو مشاركة خبرتك مع الآخرين، نحن هنا لمساعدتك.
            </p>
            
            <div className="hero-actions">
              {!user ? (
                <a 
                  href="#about" 
                  className="hero-btn-primary"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection('about')
                  }}
                >
                  اكتشف المزيد عنا
                </a>
              ) : (
              <Link 
                  to={user.role === 'student' ? '/courses' : user.role === 'creator' ? '/creator/dashboard' : '/admin/dashboard'} 
                className="hero-btn-primary"
              >
                  ابدأ التعلم الآن
              </Link>
              )}
            </div>

            <div className="hero-stats">
              <div className="hero-stat-item">
                <span className="hero-stat-icon">✅</span>
                <span className="hero-stat-text">{stats.totalStudents}+ متعلم نشط</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-icon">👨‍🏫</span>
                <span className="hero-stat-text">{stats.totalCreators}+ منشئ محتوى</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-icon">⭐</span>
                <span className="hero-stat-text">4.9/5 تقييم</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="section-container">
          <h2 className="section-title">من نحن؟ 👋</h2>
          <div className="section-divider"></div>
          
          <p className="about-intro">
            <strong className="text-primary-purple">أكاديمية وجهة</strong> - منصة تعليمية متخصصة في تعليم مهارات المستقبل الرقمي
          </p>
          
          <div className="about-highlight">
            <p className="about-description">
              منصة وجهة تجمع بين المنشئين الموهوبين والطلاب المتحمسين لاكتساب مهارات المستقبل. سواء كنت منشئاً تريد مشاركة معرفتك أو طالباً تبحث عن التعلم، نحن هنا لمساعدتك في رحلتك نحو النجاح في العصر الرقمي.
            </p>
          </div>
        </div>
      </section>

      {/* Courses Section by Category */}
      <section id="courses" className="courses-section">
        <div className="courses-bg-decoration bg-1"></div>
        <div className="courses-bg-decoration bg-2"></div>
        
        <div className="section-container">
          <div className="courses-header">
            <div className="courses-badge">
              🎓 مكتبة الدورات
            </div>
            <h2 className="section-title-large">
              اكتشف مهارات المستقبل
            </h2>
            <p className="courses-subtitle">
              منصة تجمع بين <span className="text-primary-orange font-bold">المنشئين</span> و<span className="text-primary-purple font-bold">الطلاب</span> لاكتساب المهارات التي يحتاجها المستقبل الرقمي
            </p>
            
            {/* Recommended Topics Section - Integrated */}
            <div className="topics-section-integrated">
              <h3 className="topics-section-title">مواضيع موصى بها لك</h3>
              <div className="topics-container">
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <button 
                      key={category.id} 
                      className="topic-tag"
                      onClick={() => {
                        // Scroll to courses if needed, or filter by category
                        const categorySection = document.getElementById(`category-${category.id}`)
                        if (categorySection) {
                          categorySection.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      {category.icon || '📚'} {category.name}
                    </button>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem', width: '100%' }}>
                    لا توجد فئات متاحة حالياً
                  </p>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-courses">
              <div className="loading-spinner"></div>
              <p>جاري تحميل الدورات...</p>
            </div>
          ) : featuredCategories.length === 0 ? (
            <div className="no-courses">
              <div className="no-courses-icon">📚</div>
              <p>لا توجد دورات متاحة حالياً</p>
            </div>
          ) : (
            <div className="categories-container">
              {featuredCategories.map((category) => {
                const categoryCourses = coursesByCategory[category.id] || []
                if (categoryCourses.length === 0) return null
                
                return (
                  <div key={category.id} className="category-section">
                    {/* Category Header Image */}
                    <div className="category-header-image">
                      <img 
                        src={`https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80`}
                        alt={category.name}
                        className="category-image"
                        onError={(e) => {
                          e.target.src = `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80`
                        }}
                      />
                      <div className="category-header-overlay">
                        <h3 className="category-title">{category.icon || '📚'} {category.name}</h3>
                      </div>
                    </div>
                    
                    {/* Courses Horizontal Scroll */}
                    <div className="category-courses-wrapper">
                      <button 
                        className="category-scroll-btn category-scroll-prev"
                        onClick={() => scrollCategory(category.id, 'prev')}
                        aria-label="السابق"
                      >
                        ‹
                      </button>
                      
                      <div 
                        id={`category-${category.id}`}
                        className="category-courses-scroll"
                      >
                        {categoryCourses.map((course) => {
                          const plan = getCoursePlan(course)
                          const planLabel = getPlanLabel(plan)
                          const coursePrice = parseFloat(course.price || 0)
                          
                          return (
                            <div 
                              key={course.id} 
                              className={`category-course-card course-${plan}`}
                              onClick={() => navigate(`/courses/${course.id}`)}
                            >
                              <div className="category-course-thumbnail">
                                <img 
                                  src={course.thumbnail_image_url || course.trailer_video_url || `https://via.placeholder.com/300x200?text=${encodeURIComponent(course.title)}`}
                                  alt={course.title}
                                  className="category-course-image"
                                  onError={(e) => {
                                    e.target.src = `https://via.placeholder.com/300x200?text=${encodeURIComponent(course.title)}`
                                  }}
                                />
                                <div className={`category-course-badge bg-gradient-to-r ${planLabel.bg}`}>
                                  {planLabel.text}
                                </div>
                              </div>
                              <div className="category-course-content">
                                <h4 className="category-course-title">{course.title}</h4>
                                <div className="category-course-meta">
                                  {coursePrice > 0 ? (
                                    <span className="category-course-price">{coursePrice} د.ت</span>
                                  ) : (
                                    <span className="category-course-free">مجاني</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                      <button 
                        className="category-scroll-btn category-scroll-next"
                        onClick={() => scrollCategory(category.id, 'next')}
                        aria-label="التالي"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* See All Courses Button */}
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link 
              to="/courses" 
              className="btn-gradient"
              style={{
                display: 'inline-block',
                padding: '1rem 2.5rem',
                fontSize: '1.125rem',
                fontWeight: 700,
                textDecoration: 'none',
                borderRadius: '0.75rem',
                transition: 'all 0.3s'
              }}
            >
              عرض جميع الدورات
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials-section">
        <div className="section-container">
          <div className="testimonials-header">
            <h2 className="section-title">ماذا يقول طلابنا؟ 🌟</h2>
            <p className="testimonials-subtitle">نتائج حقيقية وقصص نجاح ملهمة من متعلمين حققوا أهدافهم معنا</p>
          </div>

          {/* Testimonials Grid */}
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar bg-gradient-to-br from-primary-orange to-primary-purple">
                  س
                </div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">سارة م.</h4>
                  <p className="testimonial-role">مطورة مواقع</p>
                </div>
              </div>
              <div className="testimonial-rating">
                <span className="stars">⭐⭐⭐⭐⭐</span>
              </div>
              <p className="testimonial-text">"من صفر معرفة بالبرمجة إلى موقعي الأول في 90 دقيقة! دورة عملية ومباشرة."</p>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar bg-gradient-to-br from-primary-purple to-primary-orange">
                  أ
                </div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">أحمد ك.</h4>
                  <p className="testimonial-role">مستقل</p>
                </div>
              </div>
              <div className="testimonial-rating">
                <span className="stars">⭐⭐⭐⭐⭐</span>
              </div>
              <p className="testimonial-text">"بفضل دورة AI حصلت على أول 3 عملاء في أسبوعين. استثمار يستحق كل قرش!"</p>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar bg-gradient-to-br from-primary-orange to-primary-purple">
                  ل
                </div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">ليلى ر.</h4>
                  <p className="testimonial-role">رائدة أعمال</p>
                </div>
              </div>
              <div className="testimonial-rating">
                <span className="stars">⭐⭐⭐⭐⭐</span>
              </div>
              <p className="testimonial-text">"أطلقت موقع متجري الإلكتروني بنفسي. وفّرت آلاف الدنانير على المطورين!"</p>
            </div>
          </div>

          {/* Leave Opinion Button */}
          <div className="testimonials-cta">
            <button 
              className="testimonials-cta-btn"
              onClick={() => {
                // Placeholder for future functionality
                if (user) {
                  navigate('/courses')
                } else {
                  navigate('/signup')
                }
              }}
            >
              اترك رأيك
            </button>
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="contact-section">
        <div className="section-container">
          <div className="contact-header">
            <h2 className="contact-title">لديك أسئلة؟ تواصل معنا 💬</h2>
            <p className="contact-subtitle">
              فريقنا جاهز للإجابة على جميع استفساراتك ومساعدتك في اختيار الدورة المناسبة
            </p>
          </div>
          
          <div className="contact-card">
            <div className="contact-grid">
              <a href="tel:+21612345678" className="contact-item contact-phone">
                <div className="contact-icon">📞</div>
                <div>
                  <h3 className="contact-item-title">اتصل بنا</h3>
                  <p className="contact-item-value">+216 12 345 678</p>
                </div>
              </a>

              <a href="https://wa.me/21612345678" target="_blank" rel="noopener noreferrer" className="contact-item contact-whatsapp">
                <div className="contact-icon">💬</div>
                <div>
                  <h3 className="contact-item-title">واتساب</h3>
                  <p className="contact-item-value">+216 12 345 678</p>
                </div>
              </a>

              <a href="mailto:info@wijha-academy.com" className="contact-item contact-email">
                <div className="contact-icon">📧</div>
                <div>
                  <h3 className="contact-item-title">البريد الإلكتروني</h3>
                  <p className="contact-item-value">info@wijha-academy.com</p>
                </div>
              </a>

              <a href="https://instagram.com/wijha.academy" target="_blank" rel="noopener noreferrer" className="contact-item contact-instagram">
                <div className="contact-icon">📸</div>
                <div>
                  <h3 className="contact-item-title">إنستغرام</h3>
                  <p className="contact-item-value">@wijha.academy</p>
                </div>
              </a>

              <a href="https://facebook.com/wijha.academy" target="_blank" rel="noopener noreferrer" className="contact-item contact-facebook">
                <div className="contact-icon">📘</div>
                <div>
                  <h3 className="contact-item-title">فيسبوك</h3>
                  <p className="contact-item-value">Wijha Academy</p>
                </div>
              </a>

              <a href="https://linkedin.com/company/wijha-academy" target="_blank" rel="noopener noreferrer" className="contact-item contact-linkedin">
                <div className="contact-icon">💼</div>
                <div>
                  <h3 className="contact-item-title">لينكد إن</h3>
                  <p className="contact-item-value">Wijha Academy</p>
                </div>
              </a>
            </div>

            {/* CTA Button */}
            <div className="contact-cta">
            <Link 
                to={!user ? '/signup' : '/courses'} 
                className="contact-cta-btn"
            >
                ✅ سجّل الآن وابدأ التعلم
            </Link>
            </div>
          </div>
          </div>
        </section>

      {/* Footer - Matching Layout */}
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
            <Link to={user ? '/courses' : '/login'} className="footer-link">الدورات</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
