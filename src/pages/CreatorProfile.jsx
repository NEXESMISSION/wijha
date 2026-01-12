import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getCreatorProfile,
  getCreatorProfileStats,
  getCreatorProfileComments,
  getCreatorPublicCourses,
  createCreatorProfileComment,
  deleteCourseComment,
  setCreatorProfileRating
} from '../lib/api'
import { supabase } from '../lib/supabase'
import '../styles/design-system.css'
import './CreatorProfile.css'

function CreatorProfile() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [creator, setCreator] = useState(null)
  const [stats, setStats] = useState(null)
  const [courses, setCourses] = useState([])
  const [comments, setComments] = useState([])
  const [userRating, setUserRating] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (slug) {
      loadProfile()
    }
  }, [slug])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const profileData = await getCreatorProfile(slug)
      
      if (!profileData) {
        setError('المنشئ غير موجود')
        setLoading(false)
        return
      }
      
      const [statsData, coursesData, commentsData] = await Promise.all([
        getCreatorProfileStats(profileData.id).catch(() => null),
        getCreatorPublicCourses(profileData.id).catch(() => []),
        getCreatorProfileComments(profileData.id).catch(() => [])
      ])
      
      setCreator(profileData)
      setStats(statsData)
      setCourses(coursesData)
      setComments(commentsData)
      
      // Check user's rating if logged in
      if (user?.id && profileData.id) {
        try {
          const { data } = await supabase
            .from('creator_profile_ratings')
            .select('rating')
            .eq('creator_id', profileData.id)
            .eq('user_id', user.id)
            .maybeSingle()
          setUserRating(data?.rating || null)
        } catch (err) {
          // Rating might not exist, that's okay
        }
      }
    } catch (err) {
      setError(err.message)
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRate = async (rating) => {
    if (!user?.id) {
      alert('Please login to rate creators')
      return
    }
    if (!creator?.id) return
    
    try {
      await setCreatorProfileRating(creator.id, user.id, rating)
      setUserRating(rating)
      await loadProfile() // Reload to update stats
    } catch (err) {
      alert('Error submitting rating: ' + err.message)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id) {
      alert('Please login to comment')
      return
    }
    if (!creator?.id) return
    if (!newComment.trim()) {
      alert('Please enter a comment')
      return
    }
    
    try {
      await createCreatorProfileComment(creator.id, user.id, newComment.trim())
      setNewComment('')
      const updatedComments = await getCreatorProfileComments(creator.id)
      setComments(updatedComments)
    } catch (err) {
      alert('Error submitting comment: ' + err.message)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    try {
      await deleteCourseComment(commentId)
      const updatedComments = await getCreatorProfileComments(creator.id)
      setComments(updatedComments)
    } catch (err) {
      alert('Error deleting comment: ' + err.message)
    }
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
        جاري تحميل الملف الشخصي...
      </div>
    )
  }

  if (error || !creator) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '2rem auto',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div className="error-message">
          خطأ: {error || 'المنشئ غير موجود'}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f6f7fb 0%, #ffffff 100%)',
      paddingTop: '2rem'
    }}>
      {/* Cover Image Section - Full Width Container */}
      <div style={{
        width: '100%',
        padding: '0 2rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          height: '500px',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
          borderRadius: '1.5rem',
          boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {creator.cover_image_url ? (
            <img 
              src={creator.cover_image_url} 
              alt={`${creator.name} cover`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2.5rem',
              fontWeight: 700
            }}>
              {creator.name}
            </div>
          )}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '120px',
            background: 'linear-gradient(to top, rgba(246, 247, 251, 1), transparent)',
            borderRadius: '0 0 1.5rem 1.5rem'
          }} />
        </div>
      </div>
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px 48px 24px'
      }}>
        {/* Profile Header Card */}
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2rem',
          marginTop: '-80px',
          position: 'relative',
          boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          marginBottom: '2rem',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {/* Avatar and Basic Info */}
            <div style={{
              display: 'flex',
              gap: '2rem',
              alignItems: 'flex-start',
              flexWrap: 'wrap'
            }}>
              <div style={{
                position: 'relative'
              }}>
                <div style={{
                  width: '160px',
                  height: '160px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '6px solid white',
                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  flexShrink: 0
                }}>
                  <img 
                    src={creator.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=7C34D9&color=fff&size=300`}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=7C34D9&color=fff&size=300`
                      e.target.onerror = null
                    }} 
                    alt={creator.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  marginBottom: '0.75rem',
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.2
                }}>
                  {creator.name}
                </h1>
                {creator.bio && (
                  <p style={{
                    color: '#4b5563',
                    fontSize: '1.125rem',
                    lineHeight: 1.7,
                    marginBottom: '1rem'
                  }}>
                    {creator.bio}
                  </p>
                )}
                {creator.website_url && (
                  <a 
                    href={creator.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#7C34D9',
                      textDecoration: 'none',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      background: '#f3f4f6',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e5e7eb'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f3f4f6'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    🌐 الموقع الإلكتروني
                  </a>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                paddingTop: '1.5rem',
                borderTop: '2px solid #e5e7eb'
              }}>
                <div style={{
                  textAlign: 'center',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    color: '#1f2937',
                    marginBottom: '0.25rem'
                  }}>
                    {stats.coursesCount}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    fontWeight: 600
                  }}>
                    دورات
                  </div>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    color: '#1f2937',
                    marginBottom: '0.25rem'
                  }}>
                    {stats.enrollmentsCount}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    fontWeight: 600
                  }}>
                    طالب
                  </div>
                </div>
                {stats.averageRating > 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
                    borderRadius: '0.75rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 900,
                      color: '#1f2937',
                      marginBottom: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem'
                    }}>
                      ⭐ {stats.averageRating.toFixed(1)}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: 600
                    }}>
                      ({stats.ratingsCount} تقييم)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rating Section */}
        {user?.role === 'student' && user?.id !== creator.id && (
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            padding: '2rem',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              ⭐ قيم هذا المنشئ
            </h3>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  style={{
                    background: userRating && userRating >= star 
                      ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' 
                      : '#f3f4f6',
                    border: 'none',
                    fontSize: '2rem',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s',
                    filter: userRating && userRating >= star ? 'grayscale(0%)' : 'grayscale(100%)',
                    opacity: userRating && userRating >= star ? 1 : 0.6,
                    width: '56px',
                    height: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: userRating && userRating >= star 
                      ? '0 4px 12px rgba(124, 52, 217, 0.3)' 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!userRating || userRating < star) {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!userRating || userRating < star) {
                      e.currentTarget.style.opacity = '0.6'
                      e.currentTarget.style.transform = 'scale(1)'
                    }
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
            {userRating && (
              <p style={{
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.9375rem',
                margin: 0
              }}>
                ✓ قيمت هذا المنشئ بـ {userRating} نجوم
              </p>
            )}
          </div>
        )}

        {/* Courses Section */}
        {courses.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            padding: '2rem',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                📚 دورات {creator.name}
              </span>
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem'
            }}>
              {courses.map((course) => (
                <Link 
                  key={course.id} 
                  to={`/courses/${course.id}`} 
                  style={{ 
                    textDecoration: 'none',
                    display: 'block',
                    height: '100%'
                  }}
                >
                  <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)'
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)'
                    e.currentTarget.style.borderColor = '#7C34D9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                  }}
                  >
                    <div style={{
                      position: 'relative',
                      height: '180px',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
                    }}>
                      <img 
                        src={course.thumbnail_image_url || course.trailer_video_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(course.title)}&background=7C34D9&color=fff&size=400`} 
                        alt={course.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease'
                        }}
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(course.title)}&background=7C34D9&color=fff&size=400`
                          e.target.onerror = null
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'scale(1.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)'
                        }}
                      />
                    </div>
                    <div style={{ 
                      padding: '1.5rem',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: '#1f2937',
                        marginBottom: '1rem',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {course.title}
                      </h3>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        <span style={{
                          fontSize: '1.5rem',
                          fontWeight: 900,
                          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}>
                          {parseFloat(course.price).toFixed(2)} د.ت
                        </span>
                        <span style={{
                          fontSize: '0.875rem',
                          color: '#6b7280',
                          fontWeight: 500
                        }}>
                          عرض الدورة →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2rem',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 900,
            color: '#1f2937',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              💬 التعليقات ({stats?.commentsCount || 0})
            </span>
          </h2>
          {user?.role === 'student' && user?.id !== creator.id && (
            <form onSubmit={handleCommentSubmit} style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              background: '#f9fafb',
              borderRadius: '1rem',
              border: '2px solid #e5e7eb'
            }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقاً عن هذا المنشئ..."
                rows="4"
                required
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: '1rem',
                  background: 'white',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7C34D9'
                  e.target.style.outline = 'none'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                }}
              />
              <button 
                type="submit" 
                className="btn-gradient"
                style={{ 
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 700
                }}
              >
                نشر التعليق
              </button>
            </form>
          )}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {comments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                background: '#f9fafb',
                borderRadius: '1rem',
                border: '2px dashed #e5e7eb'
              }}>
                <p style={{
                  color: '#9ca3af',
                  fontSize: '1rem',
                  fontStyle: 'italic',
                  margin: 0
                }}>
                  لا توجد تعليقات بعد. كن أول من يعلق!
                </p>
              </div>
            ) : (
              comments.map((comment) => (
                <div 
                  key={comment.id} 
                  style={{
                    padding: '1.5rem',
                    background: '#f9fafb',
                    borderRadius: '1rem',
                    border: '1px solid #e5e7eb',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ffffff'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f9fafb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <img 
                      src={comment.profiles?.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.name || 'User')}&background=random&color=fff&size=48`}
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.name || 'User')}&background=random&color=fff&size=48`
                        e.target.onerror = null
                      }} 
                      alt={comment.profiles?.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e5e7eb',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.5rem'
                      }}>
                        <div>
                          <strong style={{
                            display: 'block',
                            color: '#1f2937',
                            fontSize: '1rem',
                            fontWeight: 700,
                            marginBottom: '0.25rem'
                          }}>
                            {comment.profiles?.name || 'مجهول'}
                          </strong>
                          <span style={{
                            fontSize: '0.8125rem',
                            color: '#9ca3af'
                          }}>
                            {new Date(comment.created_at).toLocaleDateString('ar-TN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {user?.id === comment.user_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            title="حذف التعليق"
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              cursor: 'pointer',
                              fontSize: '1.25rem',
                              lineHeight: 1,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.1)'
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <p style={{
                        margin: 0,
                        color: '#4b5563',
                        lineHeight: 1.7,
                        fontSize: '0.9375rem'
                      }}>
                        {comment.comment}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatorProfile

