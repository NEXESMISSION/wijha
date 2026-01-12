import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCreatorCourses, getCreatorEarnings, createPayoutRequest, getProfile, updateCreatorProfile } from '../lib/api'
import { supabase } from '../lib/supabase'
import '../styles/design-system.css'
import './Dashboard.css'
import './CreatorDashboard.css'

function CreatorDashboard() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    platformFees: 0,
    netEarnings: 0,
    enrollmentsCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('bank')
  const [payoutNote, setPayoutNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('courses')
  const [profile, setProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({
    profile_slug: '',
    bio: '',
    profile_image_url: '',
    cover_image_url: '',
    website_url: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [courseEarningsMap, setCourseEarningsMap] = useState({})

  useEffect(() => {
    if (user?.id) {
      loadData()
      if (activeTab === 'profile') {
        loadProfile()
      }
    }
  }, [user, activeTab])
  
  const loadProfile = async () => {
    try {
      const profileData = await getProfile(user.id)
      setProfile(profileData)
      setProfileForm({
        profile_slug: profileData?.profile_slug || '',
        bio: profileData?.bio || '',
        profile_image_url: profileData?.profile_image_url || '',
        cover_image_url: profileData?.cover_image_url || '',
        website_url: profileData?.website_url || '',
      })
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }
  
  const handleProfileSave = async (e) => {
    e.preventDefault()
    try {
      setSavingProfile(true)
      
      let slug = profileForm.profile_slug.trim()
      if (!slug && profile?.name) {
        slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      }
      
      await updateCreatorProfile(user.id, {
        profile_slug: slug,
        bio: profileForm.bio || null,
        profile_image_url: profileForm.profile_image_url || null,
        cover_image_url: profileForm.cover_image_url || null,
        website_url: profileForm.website_url || null,
      })
      
      alert('تم تحديث الملف الشخصي بنجاح!')
      await loadProfile()
    } catch (err) {
      alert('خطأ في حفظ الملف الشخصي: ' + err.message)
      console.error('Error:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [coursesData, earningsData] = await Promise.all([
        getCreatorCourses(user.id),
        getCreatorEarnings(user.id),
      ])
      setCourses(coursesData)
      setEarnings(earningsData)
      
      // Load per-course earnings
      await loadCourseEarnings(coursesData)
    } catch (err) {
      setError(err.message)
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCourseEarnings = async (coursesList) => {
    try {
      const courseIds = coursesList.map(c => c.id)
      if (courseIds.length === 0) return

      // Get platform fee
      let platformFeePercent = 0.1
      try {
        const { data: settings } = await supabase
          .from('platform_settings')
          .select('platform_fee_percent')
          .eq('id', 1)
          .single()
        if (settings) {
          platformFeePercent = parseFloat(settings.platform_fee_percent) || 0.1
        }
      } catch (err) {
        console.warn('Failed to fetch platform settings:', err)
      }

      // Get enrollments for all courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          id,
          course_id,
          courses!inner (
            id,
            price
          )
        `)
        .eq('status', 'approved')
        .in('course_id', courseIds)

      // Calculate earnings per course
      const earningsMap = {}
      coursesList.forEach(course => {
        const courseEnrollments = enrollments?.filter(e => e.course_id === course.id) || []
        const totalEarnings = courseEnrollments.reduce((sum, e) => sum + parseFloat(e.courses.price || 0), 0)
        const platformFee = totalEarnings * platformFeePercent
        const netEarnings = totalEarnings - platformFee

        earningsMap[course.id] = {
          totalEarnings,
          platformFee,
          netEarnings,
          enrollments: courseEnrollments.length,
        }
      })

      setCourseEarningsMap(earningsMap)
    } catch (err) {
      console.error('Error loading course earnings:', err)
    }
  }

  const handlePayoutRequest = async (e) => {
    e.preventDefault()
    const amount = parseFloat(payoutAmount)
    
    if (amount > earnings.netEarnings) {
      alert('المبلغ يتجاوز الرصيد المتاح')
      return
    }

    if (amount <= 0) {
      alert('يجب أن يكون المبلغ أكبر من 0')
      return
    }

    try {
      setSubmitting(true)
      await createPayoutRequest({
        creator_id: user.id,
        amount,
        payment_method: payoutMethod,
        note: payoutNote || null,
        status: 'pending',
      })
      
      alert('تم إرسال طلب السحب بنجاح!')
      setShowPayoutModal(false)
      setPayoutAmount('')
      setPayoutNote('')
      const earningsData = await getCreatorEarnings(user.id)
      setEarnings(earningsData)
    } catch (err) {
      alert('خطأ في إرسال طلب السحب: ' + err.message)
      console.error('Error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const getCourseEarnings = (courseId) => {
    return courseEarningsMap[courseId] || {
      totalEarnings: 0,
      platformFee: 0,
      netEarnings: 0,
      enrollments: 0,
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'قيد الانتظار',
      'published': 'منشور',
      'draft': 'مسودة',
      'suspended': 'معلق'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#f59e0b',
      'published': '#10b981',
      'draft': '#6b7280',
      'suspended': '#ef4444'
    }
    return colorMap[status] || '#6b7280'
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontSize: '1.25rem',
        color: '#6b7280'
      }}>
        جاري تحميل لوحة التحكم...
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            لوحة تحكم المنشئ
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '1rem'
          }}>
            إدارة دوراتك وأرباحك
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {profile?.profile_slug && (
            <Link 
              to={`/creator/${profile.profile_slug}`} 
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              عرض ملفي الشخصي
            </Link>
          )}
          <Link 
            to="/creator/create-course" 
            className="btn-gradient"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            + إنشاء دورة جديدة
          </Link>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <button
          onClick={() => setActiveTab('courses')}
          style={{
            padding: '1rem 2rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'courses' ? '3px solid #7C34D9' : '3px solid transparent',
            color: activeTab === 'courses' ? '#7C34D9' : '#6b7280',
            fontWeight: activeTab === 'courses' ? 700 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          دوراتي ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '1rem 2rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #7C34D9' : '3px solid transparent',
            color: activeTab === 'profile' ? '#7C34D9' : '#6b7280',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          إعدادات الملف الشخصي
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '2rem' }}>
          خطأ في تحميل البيانات: {error}
        </div>
      )}

      {activeTab === 'profile' && (
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '0',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          {/* Header Section */}
          <div style={{
            background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
            padding: '2.5rem',
            color: 'white'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 900,
              marginBottom: '0.5rem',
              color: 'white'
            }}>
              إعدادات الملف الشخصي
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1rem',
              margin: 0
            }}>
              إدارة ملفك الشخصي العام. هذا ما يراه الطلاب عند زيارة صفحة ملفك الشخصي.
            </p>
          </div>

          {/* Form Section */}
          {profile && (
            <form onSubmit={handleProfileSave} style={{ padding: '2.5rem' }}>
              {/* Profile Slug Section */}
              <div style={{
                marginBottom: '2.5rem',
                paddingBottom: '2.5rem',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <label htmlFor="profile_slug" style={{
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1f2937',
                  marginBottom: '0.75rem'
                }}>
                  🔗 رابط الملف الشخصي
                </label>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginBottom: '1rem'
                }}>
                  سيكون هذا رابط ملفك الشخصي: <code style={{
                    background: '#f3f4f6',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#7C34D9',
                    fontWeight: 600
                  }}>/creator/[slug]</code>
                </p>
                <input
                  type="text"
                  id="profile_slug"
                  value={profileForm.profile_slug}
                  onChange={(e) => setProfileForm({ ...profileForm, profile_slug: e.target.value })}
                  placeholder={profile.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'your-profile-slug'}
                  pattern="[a-z0-9\-]+"
                  title="أحرف صغيرة وأرقام وشرطات فقط"
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    background: '#f9fafb'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C34D9'
                    e.target.style.background = 'white'
                    e.target.style.outline = 'none'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
                    e.target.style.background = '#f9fafb'
                  }}
                />
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#166534'
                }}>
                  {profileForm.profile_slug ? (
                    <>✅ ملفك الشخصي سيكون على: <strong style={{ color: '#7C34D9' }}>/creator/{profileForm.profile_slug}</strong></>
                  ) : (
                    <>💡 اتركه فارغاً ليتم إنشاؤه تلقائياً من اسمك</>
                  )}
                </div>
              </div>

              {/* Bio Section */}
              <div style={{
                marginBottom: '2.5rem',
                paddingBottom: '2.5rem',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <label htmlFor="bio" style={{
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1f2937',
                  marginBottom: '0.75rem'
                }}>
                  📝 نبذة عنك
                </label>
                <textarea
                  id="bio"
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  rows="5"
                  placeholder="أخبر الطلاب عن نفسك، خبراتك، وأهدافك التعليمية..."
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    transition: 'all 0.2s',
                    background: '#f9fafb',
                    lineHeight: '1.6'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C34D9'
                    e.target.style.background = 'white'
                    e.target.style.outline = 'none'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
                    e.target.style.background = '#f9fafb'
                  }}
                />
              </div>

              {/* Images Section - Two Columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '2rem',
                marginBottom: '2.5rem',
                paddingBottom: '2.5rem',
                borderBottom: '2px solid #e5e7eb'
              }}
              className="profile-images-grid-responsive"
              >
                {/* Profile Image */}
                <div>
                  <label htmlFor="profile_image_url" style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '0.75rem'
                  }}>
                    👤 صورة الملف الشخصي
                  </label>
                  <input
                    type="url"
                    id="profile_image_url"
                    value={profileForm.profile_image_url}
                    onChange={(e) => setProfileForm({ ...profileForm, profile_image_url: e.target.value })}
                    placeholder="https://example.com/profile.jpg"
                    style={{
                      width: '100%',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                      background: '#f9fafb',
                      marginBottom: '1rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#7C34D9'
                      e.target.style.background = 'white'
                      e.target.style.outline = 'none'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.background = '#f9fafb'
                    }}
                  />
                  {profileForm.profile_image_url && (
                    <div style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '0.75rem',
                      border: '2px solid #e5e7eb'
                    }}>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        marginBottom: '0.75rem',
                        fontWeight: 600
                      }}>
                        معاينة الصورة:
                      </p>
                      <img 
                        src={profileForm.profile_image_url} 
                        alt="معاينة الصورة" 
                        style={{ 
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '4px solid white',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Cover Image */}
                <div>
                  <label htmlFor="cover_image_url" style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '0.75rem'
                  }}>
                    🖼️ صورة الغلاف
                  </label>
                  <input
                    type="url"
                    id="cover_image_url"
                    value={profileForm.cover_image_url}
                    onChange={(e) => setProfileForm({ ...profileForm, cover_image_url: e.target.value })}
                    placeholder="https://example.com/cover.jpg"
                    style={{
                      width: '100%',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                      background: '#f9fafb',
                      marginBottom: '1rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#7C34D9'
                      e.target.style.background = 'white'
                      e.target.style.outline = 'none'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.background = '#f9fafb'
                    }}
                  />
                  {profileForm.cover_image_url && (
                    <div style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '0.75rem',
                      border: '2px solid #e5e7eb'
                    }}>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        marginBottom: '0.75rem',
                        fontWeight: 600
                      }}>
                        معاينة الغلاف:
                      </p>
                      <img 
                        src={profileForm.cover_image_url} 
                        alt="معاينة الغلاف" 
                        style={{ 
                          width: '100%',
                          maxHeight: '150px',
                          borderRadius: '0.5rem',
                          objectFit: 'cover',
                          border: '2px solid #e5e7eb',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Website URL */}
              <div style={{
                marginBottom: '2.5rem'
              }}>
                <label htmlFor="website_url" style={{
                  display: 'block',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1f2937',
                  marginBottom: '0.75rem'
                }}>
                  🌐 رابط الموقع
                </label>
                <input
                  type="url"
                  id="website_url"
                  value={profileForm.website_url}
                  onChange={(e) => setProfileForm({ ...profileForm, website_url: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    background: '#f9fafb'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7C34D9'
                    e.target.style.background = 'white'
                    e.target.style.outline = 'none'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb'
                    e.target.style.background = '#f9fafb'
                  }}
                />
              </div>

              {/* Submit Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                paddingTop: '2rem',
                borderTop: '2px solid #e5e7eb'
              }}>
                <button 
                  type="submit" 
                  className="btn-gradient"
                  disabled={savingProfile}
                  style={{
                    padding: '1rem 2.5rem',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    borderRadius: '0.75rem',
                    border: 'none',
                    cursor: savingProfile ? 'not-allowed' : 'pointer',
                    opacity: savingProfile ? 0.7 : 1,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(124, 52, 217, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!savingProfile) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(124, 52, 217, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 52, 217, 0.3)'
                  }}
                >
                  {savingProfile ? '⏳ جاري الحفظ...' : '💾 حفظ الملف الشخصي'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'courses' && (
        <>
          {/* Earnings Summary Cards - Reorganized */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}
          className="earnings-grid-responsive"
          >
            {/* Net Earnings Card - Featured (Full Width on Mobile) */}
            <div style={{
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              borderRadius: '1rem',
              padding: '2rem',
              color: 'white',
              boxShadow: '0 10px 30px -5px rgba(124, 52, 217, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              gridColumn: 'span 1'
            }}>
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: '0.875rem',
                  opacity: 0.9,
                  marginBottom: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  💰 الرصيد المتاح
                </div>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  marginBottom: '1.5rem',
                  lineHeight: 1.2
                }}>
                  {earnings.netEarnings.toFixed(2)} د.ت
                </div>
                <button 
                  onClick={() => setShowPayoutModal(true)} 
                  style={{
                    background: 'white',
                    color: '#7C34D9',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    cursor: earnings.netEarnings <= 0 ? 'not-allowed' : 'pointer',
                    opacity: earnings.netEarnings <= 0 ? 0.5 : 1,
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  disabled={earnings.netEarnings <= 0}
                  onMouseEnter={(e) => {
                    if (earnings.netEarnings > 0) {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  طلب سحب
                </button>
              </div>
            </div>

            {/* Total Courses */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.75rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              border: '2px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: '#6b7280',
                  marginBottom: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📚 إجمالي الدورات
                </div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '0.5rem',
                  lineHeight: 1.2
                }}>
                  {courses.length}
                </div>
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: '#10b981',
                fontWeight: 600,
                background: '#f0fdf4',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                display: 'inline-block',
                width: 'fit-content'
              }}>
                {courses.filter(c => c.status === 'published').length} منشورة
              </div>
            </div>

            {/* Total Enrollments */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.75rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              border: '2px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: '#6b7280',
                  marginBottom: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  👥 إجمالي التسجيلات
                </div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '0.5rem',
                  lineHeight: 1.2
                }}>
                  {earnings.enrollmentsCount}
                </div>
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: '#6b7280',
                fontWeight: 500
              }}>
                طالب مسجل
              </div>
            </div>

            {/* Total Earnings */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.75rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              border: '2px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: '#6b7280',
                  marginBottom: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  💵 إجمالي الأرباح
                </div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '0.5rem',
                  lineHeight: 1.2
                }}>
                  {earnings.totalEarnings.toFixed(2)} د.ت
                </div>
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '0.75rem',
                marginTop: '0.75rem',
                lineHeight: 1.5
              }}>
                <div style={{ marginBottom: '0.25rem' }}>
                  <strong>رسوم المنصة:</strong> {earnings.platformFeePercent?.toFixed(2) || '10.00'}%
                </div>
                <div style={{ color: '#ef4444', fontWeight: 600 }}>
                  {earnings.platformFees.toFixed(2)} د.ت
                </div>
              </div>
            </div>
          </div>

          {/* Courses List */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#1f2937'
              }}>
                دوراتي
              </h2>
            </div>

            {courses.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '4rem 2rem',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{
                  fontSize: '4rem',
                  marginBottom: '1rem'
                }}>📚</div>
                <p style={{
                  fontSize: '1.125rem',
                  color: '#6b7280',
                  marginBottom: '1.5rem'
                }}>
                  لم تقم بإنشاء أي دورات بعد.
                </p>
                <Link 
                  to="/creator/create-course" 
                  className="btn-gradient"
                  style={{ 
                    display: 'inline-block',
                    padding: '0.875rem 2rem',
                    textDecoration: 'none'
                  }}
                >
                  إنشاء أول دورة لك
                </Link>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}>
                {courses.map((course) => {
                  const courseEarnings = getCourseEarnings(course.id)
                  return (
                    <div 
                      key={course.id} 
                      style={{
                        background: 'white',
                        borderRadius: '1rem',
                        padding: '0',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {/* Course Header */}
                      <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        padding: '1.5rem',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        {/* Course Thumbnail */}
                        {course.thumbnail_image_url && (
                          <div style={{
                            flexShrink: 0,
                            width: '120px',
                            height: '80px',
                            borderRadius: '0.75rem',
                            overflow: 'hidden',
                            background: '#f3f4f6'
                          }}>
                            <img 
                              src={course.thumbnail_image_url} 
                              alt={course.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Course Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                            marginBottom: '0.75rem'
                          }}>
                            <h3 style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: '#1f2937',
                              margin: 0,
                              flex: 1
                            }}>
                              {course.title}
                            </h3>
                            <span style={{
                              background: getStatusColor(course.status),
                              color: 'white',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {getStatusText(course.status)}
                            </span>
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            fontSize: '0.875rem',
                            color: '#6b7280'
                          }}>
                            <span>💰 السعر: <strong style={{ color: '#1f2937' }}>{parseFloat(course.price).toFixed(2)} د.ت</strong></span>
                            {courseEarnings.enrollments > 0 && (
                              <>
                                <span>•</span>
                                <span>👥 {courseEarnings.enrollments} تسجيل</span>
                              </>
                            )}
                            {course.categories && (
                              <>
                                <span>•</span>
                                <span>{course.categories.icon} {course.categories.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Earnings Breakdown */}
                      {courseEarnings.enrollments > 0 && (
                        <div style={{
                          background: '#f9fafb',
                          padding: '1.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1rem'
                          }}>
                            <div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.25rem'
                              }}>
                                إجمالي الأرباح
                              </div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                color: '#1f2937'
                              }}>
                                {courseEarnings.totalEarnings.toFixed(2)} د.ت
                              </div>
                            </div>
                            <div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.25rem'
                              }}>
                                رسوم المنصة ({earnings.platformFeePercent?.toFixed(2) || '10.00'}%)
                              </div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: '#ef4444'
                              }}>
                                -{courseEarnings.platformFee.toFixed(2)} د.ت
                              </div>
                            </div>
                            <div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginBottom: '0.25rem'
                              }}>
                                صافي الأرباح
                              </div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {courseEarnings.netEarnings.toFixed(2)} د.ت
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{
                        padding: '1rem 1.5rem',
                        background: 'white',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        <Link 
                          to={`/courses/${course.id}`}
                          className="btn-secondary"
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            textDecoration: 'none'
                          }}
                        >
                          عرض الدورة
                        </Link>
                        <Link 
                          to={`/creator/edit-course/${course.id}`} 
                          className="btn-primary"
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            textDecoration: 'none'
                          }}
                        >
                          تعديل الدورة
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Payout Modal */}
          {showPayoutModal && (
            <div 
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem'
              }}
              onClick={() => !submitting && setShowPayoutModal(false)}
            >
              <div 
                style={{
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '2rem',
                  maxWidth: '500px',
                  width: '100%',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '1.5rem'
                }}>
                  طلب سحب
                </h2>
                <form onSubmit={handlePayoutRequest}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      الرصيد المتاح
                    </label>
                    <input 
                      type="text" 
                      value={`${earnings.netEarnings.toFixed(2)} د.ت`} 
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        background: '#f9fafb',
                        color: '#6b7280'
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      المبلغ
                    </label>
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      max={earnings.netEarnings}
                      step="0.01"
                      required
                      placeholder="أدخل المبلغ"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      طريقة الدفع
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        background: 'white'
                      }}
                    >
                      <option value="bank">تحويل بنكي</option>
                      <option value="mobile">دفع محمول</option>
                      <option value="cash">نقدي</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      ملاحظة (اختياري)
                    </label>
                    <textarea
                      value={payoutNote}
                      onChange={(e) => setPayoutNote(e.target.value)}
                      rows="3"
                      placeholder="أي ملاحظات إضافية..."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                  }}>
                    <button 
                      type="button" 
                      onClick={() => setShowPayoutModal(false)} 
                      className="btn-secondary"
                      disabled={submitting}
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CreatorDashboard
