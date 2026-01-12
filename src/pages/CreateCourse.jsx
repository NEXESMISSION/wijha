import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createCourse, createModule, createLesson, getAllCategories } from '../lib/api'
import { uploadThumbnail } from '../lib/storage'
import '../styles/design-system.css'
import './CourseForm.css'

function CreateCourse() {
  const navigate = useNavigate()
  const { user } = useAuth()
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

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const data = await getAllCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
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
        alert(
          'يرجى إنشاء دلو التخزين أولاً:\n\n' +
          '1. اذهب إلى Supabase Dashboard\n' +
          '2. اضغط على Storage في القائمة الجانبية\n' +
          '3. اضغط على "New bucket"\n' +
          '4. أدخل اسم الدلو: course-videos\n' +
          '5. اختر Public (عام)\n' +
          '6. اضغط "Create bucket"\n\n' +
          'بعد ذلك، حاول رفع الصورة مرة أخرى.'
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

      alert('تم إنشاء الدورة بنجاح! في انتظار موافقة المشرف.')
      navigate('/')
    } catch (err) {
      setError(err.message)
      console.error('Error creating course:', err)
      console.error('User object:', { id: user?.id, role: user?.role, profile: user })
      console.error('Course data being sent:', {
        creator_id: user?.id,
        title: formData.title,
        status: 'pending'
      })
      alert('Error creating course: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="course-form-page" style={{
      maxWidth: '1000px',
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
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>إنشاء دورة جديدة</h1>
        <p style={{
          color: '#6b7280',
          fontSize: '1.125rem'
        }}>املأ التفاصيل أدناه لإنشاء دورتك</p>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="course-form" style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
      }}>
        <div className="form-section" style={{
          marginBottom: '3rem',
          paddingBottom: '2rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1f2937',
            marginBottom: '1.5rem'
          }}>المعلومات الأساسية</h2>
          <div className="form-group">
            <label className="form-label">عنوان الدورة *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="أدخل عنوان الدورة"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">الوصف *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows="5"
              placeholder="اوصف دورتك..."
              className="form-textarea"
            />
          </div>

          <div className="form-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem'
          }}>
            <div className="form-group">
              <label className="form-label">السعر (د.ت) *</label>
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">الفئة *</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className="form-input"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  background: 'white',
                  cursor: 'pointer'
                }}
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

          <div className="form-group">
            <label className="form-label">العلامات (مفصولة بفواصل)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="react, javascript, web"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">صورة الدورة المصغرة</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem'
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
                    borderRadius: '0.5rem',
                    border: '2px solid #e5e7eb'
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

          <div className="form-group">
            <label className="form-label">رابط المعاينة *</label>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              required
              placeholder="رابط YouTube، PDF، أو صورة"
              className="form-input"
            />
            <small style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginTop: '0.5rem',
              display: 'block'
            }}>أدخل رابط YouTube، PDF، أو صورة لمعاينة الدورة (سيظهر في صفحة تفاصيل الدورة)</small>
          </div>
        </div>

        <div className="form-section" style={{
          marginBottom: '3rem',
          paddingBottom: '2rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <div className="section-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1f2937'
            }}>وحدات و دروس الدورة</h2>
            <button type="button" onClick={addModule} className="btn-secondary">
              إضافة وحدة
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
                  placeholder={`Module ${moduleIndex + 1} Title`}
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
                        placeholder="Lesson title"
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
                        placeholder="YouTube URL, PDF link, or image URL"
                      />
                      <small>Enter a link (YouTube, PDF, or image)</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate('/')} 
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating Course...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateCourse
