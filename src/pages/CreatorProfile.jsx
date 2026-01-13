import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import {
  getCreatorProfile,
  getCreatorProfileStats,
  getCreatorProfileComments,
  getCreatorPublicCourses,
  createCreatorProfileComment,
  deleteCourseComment,
  setCreatorProfileRating,
  getAllCategories
} from '../lib/api'
import { supabase } from '../lib/supabase'
import '../styles/design-system.css'
import './CreatorProfile.css'

function CreatorProfile() {
  const { slug } = useParams()
  const { user } = useAuth()
  const { showSuccess, showError, showWarning } = useAlert()
  const [creator, setCreator] = useState(null)
  const [stats, setStats] = useState(null)
  const [courses, setCourses] = useState([])
  const [filteredCourses, setFilteredCourses] = useState([])
  const [comments, setComments] = useState([])
  const [userRating, setUserRating] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false)

  useEffect(() => {
    if (slug) {
      loadProfile()
      loadCategories()
    }
  }, [slug])

  useEffect(() => {
    // Filter courses by selected category
    if (selectedCategory) {
      setFilteredCourses(courses.filter(course => 
        course.category_id === selectedCategory || 
        course.categories?.id === selectedCategory ||
        course.categories?.parent_id === selectedCategory
      ))
    } else {
      setFilteredCourses(courses)
    }
  }, [selectedCategory, courses])

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
      
      const [statsData, coursesData, commentsData, categoriesData] = await Promise.all([
        getCreatorProfileStats(profileData.id).catch(() => null),
        getCreatorPublicCourses(profileData.id).catch(() => []),
        getCreatorProfileComments(profileData.id).catch(() => []),
        getAllCategories().catch(() => [])
      ])
      
      setCreator(profileData)
      setStats(statsData)
      setCourses(coursesData)
      setFilteredCourses(coursesData)
      setComments(commentsData)
      setCategories(categoriesData || [])
      
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
      showWarning('يرجى تسجيل الدخول لتقييم المنشئين')
      return
    }
    if (!creator?.id) return
    
    try {
      await setCreatorProfileRating(creator.id, user.id, rating)
      setUserRating(rating)
      await loadProfile() // Reload to update stats
    } catch (err) {
      showError('خطأ في إرسال التقييم: ' + err.message)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id) {
      showWarning('يرجى تسجيل الدخول لإضافة تعليق')
      return
    }
    if (!creator?.id) return
    if (!newComment.trim()) {
      showWarning('يرجى إدخال تعليق')
      return
    }
    
    try {
      await createCreatorProfileComment(creator.id, user.id, newComment.trim())
      setNewComment('')
      const updatedComments = await getCreatorProfileComments(creator.id)
      setComments(updatedComments)
    } catch (err) {
      showError('خطأ في إرسال التعليق: ' + err.message)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    try {
      await deleteCourseComment(commentId)
      const updatedComments = await getCreatorProfileComments(creator.id)
      setComments(updatedComments)
    } catch (err) {
      showError('خطأ في حذف التعليق: ' + err.message)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await getAllCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  if (loading) {
    return (
      <div className="creator-profile">
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '2rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          fontSize: '1.25rem',
          color: '#6b7280'
        }}>
          جاري تحميل الملف الشخصي...
        </div>
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
    <div className="creator-profile">
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem 1rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
      {/* Creator Header - Matching Course Page Design Exactly */}
      <div style={{
        background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
        borderRadius: '1rem',
        padding: '0',
        margin: '0 0 2rem 0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'block'
      }}>
        {/* Cover Image - Full Width */}
        {creator.cover_image_url && (
          <div 
            className="creator-cover-image"
            style={{
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
          }}>
            <img 
              src={creator.cover_image_url} 
              alt={`${creator.name} cover`}
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
        
        {/* Creator Info - Below Cover Image */}
        <div style={{
          padding: '2rem',
          background: 'white',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '2rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem'
          }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '1rem',
                flexWrap: 'wrap'
              }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  margin: 0,
                  lineHeight: '1.2',
                  flex: 1,
                  minWidth: '200px'
                }}>
                  {creator.name}
                </h1>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: '#374151',
                  fontSize: '0.9375rem',
                  fontWeight: 500
                }}>
                  <img 
                    src={creator.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=7C34D9&color=fff`}
                    alt={creator.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      background: '#e5e7eb',
                      border: '2px solid #e5e7eb'
                    }}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=7C34D9&color=fff`
                      e.target.onerror = null
                    }}
                  />
                  <span>{creator.name}</span>
                </div>
                
                {stats && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    color: '#6b7280',
                    fontSize: '0.9375rem'
                  }}>
                    <span>📚 {stats.coursesCount} دورات</span>
                    <span>👥 {stats.enrollmentsCount} طالب</span>
                    {stats.averageRating > 0 && (
                      <span>⭐ {stats.averageRating.toFixed(1)}</span>
                    )}
                  </div>
                )}
              </div>
              
              {creator.bio && (
                <p style={{
                  color: '#4b5563',
                  fontSize: '1.125rem',
                  lineHeight: '1.7',
                  marginBottom: '2rem'
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
        </div>
      </div>

      {/* Main Content with Sidebar - Wide Screens */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '2rem',
        alignItems: 'start',
        width: '100%',
        maxWidth: '100%',
        margin: '0',
        padding: '0',
        position: 'relative',
        boxSizing: 'border-box'
      }}
      className="creator-layout-responsive"
      >
        {/* Sidebar - Categories Filter */}
        <aside style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          border: '1px solid #e5e7eb'
        }}>
          {/* Categories Section */}
          <div className="categories-section" style={{ marginBottom: '2rem' }}>
            <button
              onClick={() => setCategoriesDropdownOpen(!categoriesDropdownOpen)}
              className="categories-dropdown-toggle"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#1f2937',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📂 الفئات
              </span>
              <span style={{ fontSize: '0.75rem' }}>
                {categoriesDropdownOpen ? '▲' : '▼'}
              </span>
            </button>
            <div 
              className={`categories-list ${categoriesDropdownOpen ? 'categories-list-open' : ''}`}
              style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {/* All Categories Option */}
              <button
                onClick={() => setSelectedCategory('')}
                style={{
                  padding: '0.75rem 1rem',
                  background: !selectedCategory ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                  border: `2px solid ${!selectedCategory ? 'transparent' : '#e5e7eb'}`,
                  borderRadius: '0.5rem',
                  color: !selectedCategory ? 'white' : '#374151',
                  fontSize: '0.9375rem',
                  fontWeight: !selectedCategory ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory) {
                    e.currentTarget.style.background = '#f9fafb'
                    e.currentTarget.style.borderColor = '#7C34D9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                  }
                }}
              >
                <span>جميع الفئات</span>
              </button>

              {/* Categories with Subcategories */}
              {categories.map(category => (
                <div key={category.id}>
                  <button
                    onClick={() => {
                      if (category.subcategories && category.subcategories.length > 0) {
                        toggleCategory(category.id)
                      } else {
                        setSelectedCategory(category.id === selectedCategory ? '' : category.id)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: selectedCategory === category.id ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                      border: `2px solid ${selectedCategory === category.id ? 'transparent' : '#e5e7eb'}`,
                      borderRadius: '0.5rem',
                      color: selectedCategory === category.id ? 'white' : '#374151',
                      fontSize: '0.9375rem',
                      fontWeight: selectedCategory === category.id ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'right',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: category.subcategories && category.subcategories.length > 0 && expandedCategories[category.id] ? '0.5rem' : '0'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCategory !== category.id) {
                        e.currentTarget.style.background = '#f9fafb'
                        e.currentTarget.style.borderColor = '#7C34D9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCategory !== category.id) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {category.icon && <span>{category.icon}</span>}
                      <span>{category.name}</span>
                    </div>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <span style={{ fontSize: '0.75rem' }}>
                        {expandedCategories[category.id] ? '▲' : '▼'}
                      </span>
                    )}
                  </button>

                  {/* Subcategories */}
                  {category.subcategories && category.subcategories.length > 0 && expandedCategories[category.id] && (
                    <div style={{
                      paddingRight: '1rem',
                      marginTop: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem'
                    }}>
                      {category.subcategories.map(subcategory => (
                        <button
                          key={subcategory.id}
                          onClick={() => setSelectedCategory(subcategory.id === selectedCategory ? '' : subcategory.id)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: selectedCategory === subcategory.id ? 'rgba(124, 52, 217, 0.1)' : 'transparent',
                            border: `1px solid ${selectedCategory === subcategory.id ? '#7C34D9' : '#e5e7eb'}`,
                            borderRadius: '0.375rem',
                            color: selectedCategory === subcategory.id ? '#7C34D9' : '#6b7280',
                            fontSize: '0.875rem',
                            fontWeight: selectedCategory === subcategory.id ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'right',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedCategory !== subcategory.id) {
                              e.currentTarget.style.background = '#f9fafb'
                              e.currentTarget.style.borderColor = '#7C34D9'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedCategory !== subcategory.id) {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.borderColor = '#e5e7eb'
                            }
                          }}
                        >
                          {subcategory.icon && <span style={{ marginLeft: '0.25rem' }}>{subcategory.icon}</span>}
                          {subcategory.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ width: '100%' }}>
          <div style={{
            maxWidth: '100%',
            margin: '0 auto'
          }}>
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
              {filteredCourses.map((course) => (
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
        </main>
      </div>
      </div>
    </div>
  )
}

export default CreatorProfile

