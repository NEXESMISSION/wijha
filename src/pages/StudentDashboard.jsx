import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { getStudentEnrollments, getProfile, updateProfile } from '../lib/api'
import '../styles/design-system.css'
import './Dashboard.css'

function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all') // all, approved, pending, rejected
  const [showEditModal, setShowEditModal] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    profile_image_url: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (user?.id) {
      // Load enrollments first (main data)
      loadEnrollments()
      // Load profile in background (non-blocking)
      loadProfile().catch(() => {})
    }
  }, [user])

  const loadProfile = async () => {
    try {
      // Add timeout to prevent hanging
      const profilePromise = getProfile(user.id)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 5000)
      )
      
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      setProfile(profileData)
      setProfileForm({
        name: profileData?.name || user?.name || '',
        profile_image_url: profileData?.profile_image_url || ''
      })
    } catch (err) {
      console.error('Error loading profile:', err)
      // Silent fail - don't block UI
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    try {
      setSavingProfile(true)
      await updateProfile(user.id, {
        name: profileForm.name.trim(),
        profile_image_url: profileForm.profile_image_url.trim() || null
      })
      showSuccess('تم تحديث الملف الشخصي بنجاح!')
      setShowEditModal(false)
      await loadProfile()
      // Update auth context if needed
      if (user && user.name !== profileForm.name) {
        // The auth context will update on next login/refresh
      }
    } catch (err) {
      showError('خطأ في حفظ الملف الشخصي: ' + err.message)
      console.error('Error saving profile:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const loadEnrollments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Add timeout to prevent hanging
      const enrollmentPromise = getStudentEnrollments(user.id)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Enrollment load timeout')), 5000)
      )
      
      const data = await Promise.race([enrollmentPromise, timeoutPromise])
      
      // Set enrollments and clear loading immediately
      setEnrollments(data || [])
      setLoading(false) // Clear loading immediately
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل التسجيلات')
      console.error('Error loading enrollments:', err)
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      approved: { text: 'موافق عليه', class: 'status-approved', color: '#10b981' },
      pending: { text: 'قيد الانتظار', class: 'status-pending', color: '#f59e0b' },
      rejected: { text: 'مرفوض', class: 'status-rejected', color: '#ef4444' },
    }
    return badges[status] || badges.pending
  }

  // Group enrollments by course and keep only the most recent one per course
  // If there's a rejected enrollment, prioritize it over others
  const getLatestEnrollmentPerCourse = (enrollments) => {
    const courseMap = new Map()
    
    enrollments.forEach(enrollment => {
      const courseId = enrollment.courses?.id
      if (!courseId) return
      
      const existing = courseMap.get(courseId)
      
      // If no existing enrollment, add this one
      if (!existing) {
        courseMap.set(courseId, enrollment)
        return
      }
      
      // If current is rejected, always use it (rejected takes priority)
      if (enrollment.status === 'rejected') {
        courseMap.set(courseId, enrollment)
        return
      }
      
      // If existing is rejected, keep it
      if (existing.status === 'rejected') {
        return
      }
      
      // Otherwise, use the most recent one
      const currentDate = new Date(enrollment.created_at)
      const existingDate = new Date(existing.created_at)
      if (currentDate > existingDate) {
        courseMap.set(courseId, enrollment)
      }
    })
    
    return Array.from(courseMap.values())
  }

  const uniqueEnrollments = getLatestEnrollmentPerCourse(enrollments)
  
  const filteredEnrollments = uniqueEnrollments.filter(enrollment => {
    if (activeFilter === 'all') return true
    return enrollment.status === activeFilter
  })

  const stats = {
    total: uniqueEnrollments.length,
    approved: uniqueEnrollments.filter(e => e.status === 'approved').length,
    pending: uniqueEnrollments.filter(e => e.status === 'pending').length,
    rejected: uniqueEnrollments.filter(e => e.status === 'rejected').length,
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
        جاري تحميل دوراتك...
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Header Section */}
      <div style={{
        marginBottom: '3rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}>
          {/* Profile Image */}
          <div style={{
            position: 'relative'
          }}>
            <img 
              src={profile?.profile_image_url || user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=120`} 
              alt={user?.name || 'User'}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=7C34D9&color=fff&size=120`
                e.target.onerror = null
              }}
            />
          </div>
          
          {/* Name and Edit Button */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.5rem',
              lineHeight: '1.2'
            }}>
              مرحباً، {profile?.name || user?.name || 'طالب'}
            </h1>
            <button
              onClick={() => setShowEditModal(true)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '2px solid #7C34D9',
                background: 'white',
                color: '#7C34D9',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#7C34D9'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.color = '#7C34D9'
              }}
            >
              ✏️ تعديل الملف الشخصي
            </button>
          </div>
        </div>
        <p style={{
          fontSize: '1.25rem',
          color: '#6b7280',
          marginBottom: '2rem'
        }}>
          هذه هي جميع الدورات التي سجلت فيها
        </p>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
            border: '2px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats.total}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>إجمالي الدورات</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
            border: '2px solid #10b981'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', marginBottom: '0.5rem' }}>
              {stats.approved}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>موافق عليها</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
            border: '2px solid #f59e0b'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', marginBottom: '0.5rem' }}>
              {stats.pending}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>قيد الانتظار</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
            border: '2px solid #ef4444'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', marginBottom: '0.5rem' }}>
              {stats.rejected}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>مرفوضة</div>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          to="/courses" 
          className="btn-gradient"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          تصفح جميع الدورات
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message" style={{ marginBottom: '2rem' }}>
          خطأ في تحميل التسجيلات: {error}
        </div>
      )}

      {/* Filters */}
      {enrollments.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'all', label: 'الكل', count: stats.total },
            { key: 'approved', label: 'موافق عليها', count: stats.approved },
            { key: 'pending', label: 'قيد الانتظار', count: stats.pending },
            { key: 'rejected', label: 'مرفوضة', count: stats.rejected }
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: activeFilter === filter.key ? '#7C34D9' : '#e5e7eb',
                background: activeFilter === filter.key ? '#7C34D9' : 'white',
                color: activeFilter === filter.key ? 'white' : '#6b7280',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      )}

      {/* Courses Grid */}
      {!loading && filteredEnrollments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
        }}>
          <p style={{
            fontSize: '1.25rem',
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            {enrollments.length === 0 
              ? 'لم تسجل في أي دورة بعد.' 
              : 'لا توجد دورات في هذه الفئة.'}
          </p>
          {enrollments.length === 0 && (
            <Link to="/courses" className="btn-gradient">
              تصفح الدورات
            </Link>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '2rem'
        }}>
          {filteredEnrollments.map((enrollment) => {
            const statusBadge = getStatusBadge(enrollment.status)
            const course = enrollment.courses
            return (
              <div 
                key={enrollment.id} 
                style={{
                  background: 'white',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                }}
              >
                {/* Course Image */}
                <div style={{
                  position: 'relative',
                  height: '200px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
                }}>
                  <img 
                    src={course.thumbnail_image_url || course.trailer_video_url || 'https://via.placeholder.com/400x250?text=' + encodeURIComponent(course.title)} 
                    alt={course.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      if (!e.target.src.includes('placeholder')) {
                        e.target.src = 'https://via.placeholder.com/400x250?text=' + encodeURIComponent(course.title)
                      } else {
                        e.target.parentElement.style.background = 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
                        e.target.style.display = 'none'
                      }
                    }}
                  />
                  {/* Status Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    background: statusBadge.color,
                    color: 'white',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}>
                    {statusBadge.text}
                  </span>
                </div>

                {/* Course Content */}
                <div style={{ 
                  padding: '1.5rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {course.title}
                  </h3>
                  
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    marginBottom: '1rem'
                  }}>
                    تاريخ التسجيل: {new Date(enrollment.created_at).toLocaleDateString('ar-TN')}
                  </p>
                  
                  {/* Rejection Notice */}
                  {enrollment.status === 'rejected' && (
                    <div style={{
                      background: '#fef2f2',
                      border: '2px solid #fecaca',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.75rem'
                      }}>
                        <span style={{ fontSize: '1.25rem' }}>❌</span>
                        <strong style={{ 
                          color: '#dc2626', 
                          fontSize: '1rem',
                          fontWeight: 700
                        }}>
                          تم رفض التسجيل
                        </strong>
                      </div>
                      
                      {/* Rejection Reason - Always show if rejected */}
                      <div style={{
                        background: 'white',
                        border: '1px solid #fecaca',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        marginTop: '0.5rem'
                      }}>
                        <strong style={{ 
                          color: '#991b1b', 
                          display: 'block', 
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem'
                        }}>
                          سبب الرفض:
                        </strong>
                        <p style={{ 
                          color: '#991b1b', 
                          fontSize: '0.875rem', 
                          lineHeight: '1.6',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {enrollment.rejection_note || 'لم يتم تحديد سبب محدد للرفض.'}
                        </p>
                      </div>
                      
                      {/* Restriction Notice */}
                      {enrollment.is_restricted && enrollment.restriction_reason && (
                        <div style={{
                          background: '#fff7ed',
                          border: '1px solid #fed7aa',
                          borderRadius: '0.5rem',
                          padding: '0.75rem',
                          marginTop: '0.75rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem'
                          }}>
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <strong style={{ 
                              color: '#c2410c', 
                              fontSize: '0.875rem',
                              fontWeight: 700
                            }}>
                              محظور من التسجيل:
                            </strong>
                          </div>
                          <p style={{ 
                            color: '#9a3412', 
                            fontSize: '0.875rem',
                            lineHeight: '1.6',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {enrollment.restriction_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Action Button */}
                  <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    {enrollment.status === 'approved' ? (
                      <Link 
                        to={`/courses/${course.id}`} 
                        className="btn-gradient"
                        style={{ 
                          width: '100%', 
                          textAlign: 'center', 
                          display: 'block',
                          padding: '0.75rem',
                          textDecoration: 'none'
                        }}
                      >
                        متابعة التعلم
                      </Link>
                    ) : enrollment.status === 'pending' ? (
                      <div style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        textAlign: 'center',
                        color: '#92400e',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}>
                        في انتظار الموافقة...
                      </div>
                    ) : (
                      <Link 
                        to={`/courses/${course.id}`} 
                        className="btn-secondary"
                        style={{ 
                          width: '100%', 
                          textAlign: 'center', 
                          display: 'block',
                          padding: '0.75rem',
                          textDecoration: 'none'
                        }}
                      >
                        {enrollment.is_restricted ? 'عرض الدورة' : 'حاول مرة أخرى'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
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
          onClick={() => !savingProfile && setShowEditModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                تعديل الملف الشخصي
              </h2>
              <button
                onClick={() => !savingProfile && setShowEditModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  fontWeight: 'bold'
                }}
                disabled={savingProfile}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleProfileSave}>
              {/* Profile Image Preview */}
              <div style={{
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                <img 
                  src={profileForm.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || 'User')}&background=7C34D9&color=fff&size=150`} 
                  alt="Profile preview"
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid #e5e7eb',
                    marginBottom: '1rem'
                  }}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || 'User')}&background=7C34D9&color=fff&size=150`
                    e.target.onerror = null
                  }}
                />
              </div>

              {/* Name Field */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.9375rem'
                }}>
                  الاسم *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.9375rem',
                    fontFamily: 'inherit'
                  }}
                  placeholder="أدخل اسمك"
                />
              </div>

              {/* Profile Image URL Field */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.9375rem'
                }}>
                  رابط صورة الملف الشخصي
                </label>
                <input
                  type="url"
                  value={profileForm.profile_image_url}
                  onChange={(e) => setProfileForm({ ...profileForm, profile_image_url: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.9375rem',
                    fontFamily: 'inherit'
                  }}
                  placeholder="https://example.com/image.jpg"
                />
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.5rem'
                }}>
                  اتركه فارغاً لاستخدام الصورة الافتراضية
                </p>
              </div>

              {/* Form Actions */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="btn-secondary"
                  disabled={savingProfile}
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="btn-gradient"
                  disabled={savingProfile}
                  style={{ padding: '0.75rem 2rem' }}
                >
                  {savingProfile ? 'جاري الحفظ... ⏳' : 'حفظ التغييرات 💾'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentDashboard
