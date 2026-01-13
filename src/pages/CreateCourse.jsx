import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { createCourse, createModule, createLesson, getAllCategories } from '../lib/api'
import { uploadThumbnail } from '../lib/storage'
import '../styles/design-system.css'
import './CourseForm.css'

function CreateCourse() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError, showWarning } = useAlert()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    tags: '',
    category_id: '',
  })
  const [categories, setCategories] = useState([])
  const [modules, setModules] = useState([
    {
      id: Date.now(),
      title: '',
      lessons: [{ id: Date.now(), title: '', linkUrl: '' }],
    },
  ])
  const [trailerUrl, setTrailerUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('basic') // 'basic', 'media', 'content'

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      // Add timeout to prevent hanging
      const categoriesPromise = getAllCategories()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Categories load timeout')), 5000)
      )
      
      const data = await Promise.race([categoriesPromise, timeoutPromise])
      setCategories(data || [])
    } catch (err) {
      console.error('Error loading categories:', err)
      // Silent fail - don't block UI
      setCategories([])
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const addModule = () => {
    setModules([
      ...modules,
      {
        id: Date.now(),
        title: '',
        lessons: [{ id: Date.now(), title: '', linkUrl: '' }],
      },
    ])
  }

  const updateModule = (moduleId, field, value) => {
    setModules(
      modules.map((module) =>
        module.id === moduleId ? { ...module, [field]: value } : module
      )
    )
  }

  const addLesson = (moduleId) => {
    setModules(
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: [
                ...module.lessons,
                { id: Date.now(), title: '', linkUrl: '' },
              ],
            }
          : module
      )
    )
  }

  const updateLesson = (moduleId, lessonId, field, value) => {
    setModules(
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId
                  ? { ...lesson, [field]: value }
                  : lesson
              ),
            }
          : module
      )
    )
  }

  const handleThumbnailChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('الرجاء اختيار ملف صورة')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة يجب أن يكون أقل من 5 ميجابايت')
      return
    }

    setThumbnailFile(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setThumbnailPreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload thumbnail
    try {
      setUploadingThumbnail(true)
      const uploadedUrl = await uploadThumbnail(file)
      setThumbnailUrl(uploadedUrl)
      setError(null) // Clear any previous errors
    } catch (err) {
      const errorMessage = err.message || 'خطأ غير معروف'
      setError('خطأ في رفع الصورة: ' + errorMessage)
      setThumbnailFile(null)
      setThumbnailPreview(null)
      // Show alert with detailed instructions
      if (errorMessage.includes('course-videos')) {
        showWarning(
          'يرجى إنشاء دلو التخزين أولاً:\n\n' +
          '1. اذهب إلى Supabase Dashboard\n' +
          '2. اضغط على Storage في القائمة الجانبية\n' +
          '3. اضغط على "New bucket"\n' +
          '4. أدخل اسم الدلو: course-videos\n' +
          '5. اختر Public (عام)\n' +
          '6. اضغط "Create bucket"\n\n' +
          'بعد ذلك، حاول رفع الصورة مرة أخرى.',
          'دلو التخزين غير موجود'
        )
      }
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!trailerUrl.trim()) {
      setError('يرجى إدخال رابط للمعاينة (YouTube، PDF، أو صورة)')
      return
    }

    try {
      setSubmitting(true)

      // Parse tags
      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : []

      // Create course
      const course = await createCourse({
        creator_id: user.id,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        tags,
        trailer_video_url: trailerUrl,
        thumbnail_image_url: thumbnailUrl || null,
        category_id: formData.category_id || null,
        status: 'pending',
      })

      // Create modules and lessons
      for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
        const moduleData = modules[moduleIndex]
        
        if (!moduleData.title.trim()) {
          continue // Skip empty modules
        }

        const module = await createModule({
          course_id: course.id,
          title: moduleData.title,
          order_index: moduleIndex,
        })

        // Create lessons for this module
        for (let lessonIndex = 0; lessonIndex < moduleData.lessons.length; lessonIndex++) {
          const lessonData = moduleData.lessons[lessonIndex]
          
          if (!lessonData.title.trim() || !lessonData.linkUrl?.trim()) {
            continue // Skip empty lessons
          }

          await createLesson({
            module_id: module.id,
            title: lessonData.title,
            video_url: lessonData.linkUrl.trim(),
            is_trailer: false,
            order_index: lessonIndex,
          })
        }
      }

      showSuccess('تم إنشاء الدورة بنجاح! في انتظار موافقة المشرف.', 'تم إنشاء الدورة')
      navigate('/')
    } catch (err) {
      setError(err.message)
      console.error('Error creating course:', err)
      showError('خطأ في إنشاء الدورة: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="course-form-page" style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      <div className="form-header" style={{
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>إنشاء دورة جديدة</h1>
        <p style={{
          color: '#6b7280',
          fontSize: '1.125rem'
        }}>املأ التفاصيل أدناه لإنشاء دورتك</p>
      </div>

      {error && (
        <div className="error-message" style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem'
        }}>{error}</div>
      )}

      {/* Section Navigation */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          type="button"
          onClick={() => setActiveSection('basic')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: activeSection === 'basic' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#f3f4f6',
            color: activeSection === 'basic' ? 'white' : '#6b7280',
            fontWeight: activeSection === 'basic' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '1rem'
          }}
        >
          📝 المعلومات الأساسية
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('media')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: activeSection === 'media' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#f3f4f6',
            color: activeSection === 'media' ? 'white' : '#6b7280',
            fontWeight: activeSection === 'media' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '1rem'
          }}
        >
          🎬 الوسائط
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('content')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: activeSection === 'content' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#f3f4f6',
            color: activeSection === 'content' ? 'white' : '#6b7280',
            fontWeight: activeSection === 'content' ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '1rem'
          }}
        >
          📚 الوحدات والدروس
        </button>
      </div>

      <form onSubmit={handleSubmit} className="course-form">
        {/* Basic Information Section */}
        {activeSection === 'basic' && (
        <div className="form-section-card" style={{
        background: 'white',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          marginBottom: '2rem',
          border: '1px solid #e5e7eb'
      }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            paddingBottom: '1.5rem',
            borderBottom: '2px solid #f3f4f6'
          }}>
            <span style={{ fontSize: '2rem' }}>📝</span>
          <h2 style={{
              fontSize: '1.75rem',
            fontWeight: 700,
            color: '#1f2937',
              margin: 0
          }}>المعلومات الأساسية</h2>
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '1rem'
            }}>عنوان الدورة *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="أدخل عنوان الدورة"
              className="form-input"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                background: 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '1rem'
            }}>الوصف *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows="6"
              placeholder="اوصف دورتك..."
              className="form-textarea"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                background: 'white',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div className="form-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div className="form-group">
              <label className="form-label" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '1rem'
              }}>السعر (د.ت) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="form-input"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  background: 'white'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '1rem'
              }}>الفئة *</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className="form-input"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              >
                <option value="">اختر الفئة</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '1rem'
            }}>العلامات (مفصولة بفواصل)</label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="react، javascript، web"
              className="form-input"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                background: 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveSection('media')}
              className="btn-gradient"
              style={{ padding: '0.75rem 2rem' }}
            >
              التالي: الوسائط →
            </button>
          </div>
        </div>
        )}

        {/* Media Section */}
        {activeSection === 'media' && (
        <div className="form-section-card" style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          marginBottom: '2rem',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            paddingBottom: '1.5rem',
            borderBottom: '2px solid #f3f4f6'
          }}>
            <span style={{ fontSize: '2rem' }}>🎬</span>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#1f2937',
              margin: 0
            }}>الوسائط</h2>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '1rem'
            }}>صورة الدورة المصغرة</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            />
            {uploadingThumbnail && (
              <small style={{ color: '#6b7280', display: 'block', marginTop: '0.5rem' }}>
                جاري رفع الصورة...
              </small>
            )}
            {thumbnailPreview && (
              <div style={{ marginTop: '1rem' }}>
                <img 
                  src={thumbnailPreview} 
                  alt="Preview" 
                  style={{
                    maxWidth: '300px',
                    maxHeight: '200px',
                    borderRadius: '0.75rem',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
              />
            </div>
            )}
            <small style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginTop: '0.5rem',
              display: 'block'
            }}>اختر صورة مصغرة للدورة (ستظهر في قوائم الدورات)</small>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '1rem'
            }}>رابط المعاينة *</label>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              required
              placeholder="رابط YouTube، PDF، أو صورة"
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
            <small style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginTop: '0.5rem',
              display: 'block'
            }}>أدخل رابط YouTube، PDF، أو صورة لمعاينة الدورة (سيظهر في صفحة تفاصيل الدورة)</small>
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveSection('basic')}
              className="btn-secondary"
              style={{ padding: '0.75rem 2rem' }}
            >
              ← السابق
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('content')}
              className="btn-gradient"
              style={{ padding: '0.75rem 2rem' }}
            >
              التالي: الوحدات والدروس →
            </button>
          </div>
        </div>
        )}

        {/* Content Section */}
        {activeSection === 'content' && (
        <div className="form-section-card" style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          marginBottom: '2rem',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            paddingBottom: '1.5rem',
            borderBottom: '2px solid #f3f4f6'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '2rem' }}>📚</span>
            <h2 style={{
                fontSize: '1.75rem',
              fontWeight: 700,
                color: '#1f2937',
                margin: 0
            }}>وحدات و دروس الدورة</h2>
            </div>
            <button type="button" onClick={addModule} className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
              + إضافة وحدة
            </button>
          </div>

          {modules.map((module, moduleIndex) => (
            <div key={module.id} className="module-editor">
              <div className="module-header">
                <input
                  type="text"
                  value={module.title}
                  onChange={(e) =>
                    updateModule(module.id, 'title', e.target.value)
                  }
                  placeholder={`عنوان الوحدة ${moduleIndex + 1}`}
                  className="module-title-input"
                />
                <button
                  type="button"
                  onClick={() => addLesson(module.id)}
                  className="btn-secondary btn-sm"
                >
                  Add Lesson
                </button>
              </div>

              <div className="lessons-editor">
                {module.lessons.map((lesson, lessonIndex) => (
                  <div key={lesson.id} className="lesson-editor">
                    <div className="lesson-number">{lessonIndex + 1}</div>
                    <div className="lesson-inputs">
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(
                            module.id,
                            lesson.id,
                            'title',
                            e.target.value
                          )
                        }
                        placeholder="عنوان الدرس"
                      />
                      <input
                        type="url"
                        value={lesson.linkUrl || ''}
                        onChange={(e) =>
                          updateLesson(
                            module.id,
                            lesson.id,
                            'linkUrl',
                            e.target.value
                          )
                        }
                        placeholder="رابط YouTube، PDF، أو صورة"
                      />
                      <small>أدخل رابط (YouTube، PDF، أو صورة)</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {modules.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: '#f9fafb',
              borderRadius: '1rem',
              border: '2px dashed #e5e7eb'
            }}>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem',
                margin: 0
              }}>لا توجد وحدات بعد. اضغط على "إضافة وحدة" لبدء إضافة المحتوى</p>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem'
          }}>
            <button
              type="button"
              onClick={() => setActiveSection('media')}
              className="btn-secondary"
              style={{ padding: '0.75rem 2rem' }}
            >
              ← السابق
            </button>
          </div>
        </div>
        )}

        {/* Form Actions - Always visible */}
        {activeSection === 'content' && (
        <div className="form-actions" style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
          padding: '2rem',
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
          border: '1px solid #e5e7eb'
        }}>
          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="btn-secondary"
            disabled={submitting}
            style={{ padding: '0.75rem 2rem' }}
          >
            إلغاء
          </button>
          <button type="submit" className="btn-gradient" disabled={submitting} style={{ padding: '0.75rem 2rem' }}>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الدورة'}
          </button>
        </div>
        )}
      </form>
    </div>
  )
}

export default CreateCourse
