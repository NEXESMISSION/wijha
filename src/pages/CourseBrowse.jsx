import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getPublishedCoursesFiltered, getAllCategories } from '../lib/api'
import '../styles/design-system.css'
import './Course.css'

function CourseBrowse() {
  const [courses, setCourses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false) // Mobile dropdown state
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    loadCategories()
    loadCourses()
  }, [])

  useEffect(() => {
    // Debounce search for better performance
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadCourses()
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [selectedCategory, searchQuery, selectedLevel])

  const loadCategories = async () => {
    try {
      const data = await getAllCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadCourses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const filters = {
        categoryId: selectedCategory || null,
        search: searchQuery || null,
        level: selectedLevel || null
      }
      
      // Remove null/undefined filters
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined) {
          delete filters[key]
        }
      })
      
      const data = await getPublishedCoursesFiltered(filters)
      setCourses(data)
    } catch (err) {
      setError(err.message)
      console.error('Error loading courses:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedLevel('')
  }

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const hasActiveFilters = searchQuery || selectedCategory || selectedLevel

  if (loading && courses.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontSize: '1.25rem',
        color: '#6b7280'
      }}>
        جاري تحميل الدورات...
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}
    className="course-browse-container"
    >
      {/* Header Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem'
        }}>
          استكشف دوراتنا التدريبية
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: '#6b7280',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          اختر من بين مجموعة متنوعة من الدورات التدريبية المتخصصة
        </p>
      </div>

      {/* Search Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 52, 217, 0.05) 0%, rgba(244, 132, 52, 0.05) 100%)',
        borderRadius: '1.5rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 10px 40px -10px rgba(124, 52, 217, 0.1)',
        border: '1px solid rgba(124, 52, 217, 0.1)'
      }}>
        <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '1.25rem',
            color: isSearchFocused ? '#7C34D9' : '#9ca3af',
            transition: 'color 0.2s',
            pointerEvents: 'none',
            zIndex: 1
          }}>
            🔍
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="ابحث عن دورة..."
            style={{
              width: '100%',
              padding: '1rem 1rem 1rem 3rem',
              border: `2px solid ${isSearchFocused ? '#7C34D9' : '#e5e7eb'}`,
              borderRadius: '0.75rem',
              fontSize: '1rem',
              background: 'white',
              transition: 'all 0.3s ease',
              boxShadow: isSearchFocused ? '0 4px 12px rgba(124, 52, 217, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                zIndex: 1
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}
      className="courses-layout-responsive"
      >
        {/* Sidebar - Categories & Filters */}
        <aside style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          border: '1px solid #e5e7eb',
          position: 'sticky',
          top: '2rem',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto'
        }}>
          {/* Categories Section */}
          <div style={{ marginBottom: '2rem' }} className="categories-section-mobile">
            <button
              onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
              className="categories-dropdown-toggle"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                color: '#1f2937',
                fontSize: '1.125rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                marginBottom: '1rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7C34D9'
                e.currentTarget.style.background = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📂 الفئات
              </div>
              <span style={{
                fontSize: '1rem',
                transition: 'transform 0.2s',
                transform: isCategoriesOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
            </button>
            <div 
              className={`categories-dropdown-content ${isCategoriesOpen ? 'open' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease, opacity 0.3s ease'
              }}
            >
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

          {/* Level Filter */}
          <div style={{
            paddingTop: '2rem',
            borderTop: '2px solid #e5e7eb'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🎯 المستوى
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {[
                { value: '', label: 'جميع المستويات' },
                { value: 'beginner', label: 'مبتدئ' },
                { value: 'intermediate', label: 'متوسط' },
                { value: 'advanced', label: 'متقدم' }
              ].map(level => (
                <button
                  key={level.value}
                  onClick={() => setSelectedLevel(level.value === selectedLevel ? '' : level.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: selectedLevel === level.value ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                    border: `2px solid ${selectedLevel === level.value ? 'transparent' : '#e5e7eb'}`,
                    borderRadius: '0.5rem',
                    color: selectedLevel === level.value ? 'white' : '#374151',
                    fontSize: '0.9375rem',
                    fontWeight: selectedLevel === level.value ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLevel !== level.value) {
                      e.currentTarget.style.background = '#f9fafb'
                      e.currentTarget.style.borderColor = '#7C34D9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedLevel !== level.value) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e5e7eb'
                    }
                  }}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div style={{
              marginTop: '2rem',
              paddingTop: '2rem',
              borderTop: '2px solid #e5e7eb'
            }}>
              <button
                onClick={handleResetFilters}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'white',
                  border: '2px solid #ef4444',
                  borderRadius: '0.5rem',
                  color: '#ef4444',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                🔄 إعادة تعيين الفلاتر
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main>

      {/* Results Count - Modern */}
      {!loading && (
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(124, 52, 217, 0.2)'
            }}>
              {courses.length}
            </div>
            <span style={{
              color: '#6b7280',
              fontSize: '1rem',
              fontWeight: 600
            }}>
              {courses.length === 0 ? 'لا توجد دورات' : courses.length === 1 ? 'دورة واحدة' : `دورة متاحة`}
            </span>
          </div>
          {hasActiveFilters && (
            <div style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              fontStyle: 'italic'
            }}>
              نتائج البحث المفلترة
            </div>
          )}
        </div>
      )}

          {/* Error Message */}
          {error && (
            <div className="error-message" style={{ marginBottom: '2rem' }}>
              خطأ في تحميل الدورات: {error}
            </div>
          )}

          {/* Courses Grid */}
          {courses.length === 0 && !loading ? (
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
            لا توجد دورات متاحة
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="btn-gradient"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)', // Exactly 2 columns
          gap: '0.875rem' // Reduced gap on mobile, larger on desktop
        }}
        className="courses-grid-mobile"
        >
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
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                border: '1px solid #e5e7eb'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
              >
                {/* Thumbnail Image */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '180px',
                  overflow: 'hidden',
                  background: '#f3f4f6'
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
                      if (e.target.src.includes('placeholder')) {
                        e.target.parentElement.style.background = 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
                        e.target.style.display = 'none'
                      } else {
                        e.target.src = 'https://via.placeholder.com/400x250?text=' + encodeURIComponent(course.title)
                      }
                    }}
                  />
                  
                  {/* Category Badge */}
                  {course.categories && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'white',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}>
                      {course.categories.icon && <span>{course.categories.icon}</span>}
                      <span>{course.categories.name}</span>
                    </div>
                  )}
                </div>

                {/* Course Content */}
                <div style={{ 
                  padding: '1.5rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '0.875rem',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: '3.6em'
                  }}>
                    {course.title}
                  </h3>
                  
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '1rem',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    flex: 1
                  }}>
                    {course.description}
                  </p>

                  {/* Creator Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.875rem'
                  }}>
                    {course.profiles?.profile_image_url && (
                      <img
                        src={course.profiles.profile_image_url}
                        alt={course.profiles.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          background: '#e5e7eb'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                    <span style={{
                      fontSize: '0.9375rem',
                      color: '#6b7280'
                    }}>
                      {course.profiles?.name || 'غير معروف'}
                    </span>
                  </div>

                  {/* Price */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid #f3f4f6',
                    gap: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '1.375rem',
                      fontWeight: 700,
                      color: '#7C34D9'
                    }}>
                      {course.price === 0 ? 'مجاني' : `${parseFloat(course.price).toFixed(2)} د.ت`}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      عرض الدورة →
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
        </main>
      </div>
    </div>
  )
}

export default CourseBrowse
