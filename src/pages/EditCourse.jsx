import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCourseWithModules, updateCourse, updateModule, updateLesson, createModule, createLesson, deleteModule, deleteLesson, getAllCategories } from '../lib/api'
import { uploadThumbnail } from '../lib/storage'
import '../styles/design-system.css'
import './CourseForm.css'

function EditCourse() {
  const { id } = useParams()
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
  const [modules, setModules] = useState([])
  const [trailerUrl, setTrailerUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCategories()
    if (id) {
      loadCourse()
    }
  }, [id])

  const loadCategories = async () => {
    try {
      const data = await getAllCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  useEffect(() => {
    if (id) {
      loadCourse()
    }
  }, [id])

  const loadCourse = async () => {
    try {
      setLoading(true)
      const data = await getCourseWithModules(id)
      
      setFormData({
        title: data.title,
        description: data.description,
        price: data.price.toString(),
        tags: data.tags ? data.tags.join(', ') : '',
        category_id: data.category_id || '',
      })
      
      setTrailerUrl(data.trailer_video_url || '')
      setThumbnailUrl(data.thumbnail_image_url || '')
      if (data.thumbnail_image_url) {
        setThumbnailPreview(data.thumbnail_image_url)
      }

      // Transform modules and lessons for editing
      const transformedModules = (data.modules || []).map(module => ({
        id: module.id,
        title: module.title,
        order_index: module.order_index,
        lessons: (module.lessons || []).map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          video_url: lesson.video_url,
          order_index: lesson.order_index,
          linkUrl: lesson.video_url || '', // Use existing URL
        })),
      }))

      setModules(transformedModules)
    } catch (err) {
      setError(err.message)
      console.error('Error loading course:', err)
    } finally {
      setLoading(false)
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
        id: Date.now(), // Temporary ID for new modules
        title: '',
        order_index: modules.length,
        lessons: [],
      },
    ])
  }

  const updateModuleTitle = (moduleId, title) => {
    setModules(
      modules.map((module) =>
        module.id === moduleId ? { ...module, title } : module
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
                { id: Date.now(), title: '', linkUrl: '', order_index: module.lessons.length },
              ],
            }
          : module
      )
    )
  }

  const updateLessonData = (moduleId, lessonId, field, value) => {
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

    try {
      setSubmitting(true)

      // Update course basic info
      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : []

      const courseUpdates = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        tags,
        category_id: formData.category_id || null,
      }

      // Update trailer URL if provided
      if (trailerUrl) {
        courseUpdates.trailer_video_url = trailerUrl
      }

      // Update thumbnail if provided
      if (thumbnailUrl) {
        courseUpdates.thumbnail_image_url = thumbnailUrl
      }

      await updateCourse(id, courseUpdates)

      // Update modules and lessons
      for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
        const moduleData = modules[moduleIndex]
        
        if (moduleData.id > 1000000000000) {
          // New module (temporary ID)
          if (moduleData.title.trim()) {
            const newModule = await createModule({
              course_id: id,
              title: moduleData.title,
              order_index: moduleIndex,
            })
            
            // Update the temporary ID
            moduleData.id = newModule.id
          }
        } else {
          // Existing module - update if changed
          if (moduleData.title.trim()) {
            await updateModule(moduleData.id, {
              title: moduleData.title,
              order_index: moduleIndex,
            })
          }
        }

        // Handle lessons
        for (let lessonIndex = 0; lessonIndex < moduleData.lessons.length; lessonIndex++) {
          const lessonData = moduleData.lessons[lessonIndex]
          
          if (lessonData.id > 1000000000000) {
            // New lesson
            if (lessonData.title.trim() && lessonData.linkUrl?.trim()) {
              await createLesson({
                module_id: moduleData.id,
                title: lessonData.title,
                video_url: lessonData.linkUrl.trim(),
                is_trailer: false,
                order_index: lessonIndex,
              })
            }
          } else {
            // Existing lesson - update if changed
            if (lessonData.title.trim()) {
              const updates = {
                title: lessonData.title,
                order_index: lessonIndex,
              }
              
              if (lessonData.linkUrl?.trim()) {
                updates.video_url = lessonData.linkUrl.trim()
              }
              
              await updateLesson(lessonData.id, updates)
            }
          }
        }
      }

      alert('تم تحديث الدورة بنجاح!')
      navigate('/creator/dashboard')
    } catch (err) {
      setError(err.message)
      console.error('Error updating course:', err)
      alert('خطأ في تحديث الدورة: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="loading">جاري تحميل الدورة...</div>
  }

  return (
    <div className="course-form-page">
      <div className="form-header">
        <h1>تعديل الدورة</h1>
        <p>قم بتحديث تفاصيل دورتك</p>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="course-form">
        <div className="form-section">
          <h2>المعلومات الأساسية</h2>
          <div className="form-group">
            <label>عنوان الدورة *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>الوصف *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows="5"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>السعر (د.ت) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label>الفئة *</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
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
            <label>العلامات (مفصولة بفواصل)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>صورة الدورة المصغرة</label>
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
            }}>اختر صورة مصغرة جديدة للدورة (اتركه فارغاً للاحتفاظ بالصورة الحالية)</small>
          </div>

          <div className="form-group">
            <label>رابط المعاينة</label>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              placeholder="رابط YouTube، PDF، أو صورة"
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
            }}>رابط المعاينة (YouTube، PDF، أو صورة) - سيظهر في صفحة تفاصيل الدورة</small>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2>وحدات الدورة والدروس</h2>
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
                  onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                  placeholder={`عنوان الوحدة ${moduleIndex + 1}`}
                  className="module-title-input"
                />
                <button
                  type="button"
                  onClick={() => addLesson(module.id)}
                  className="btn-secondary btn-sm"
                >
                  إضافة درس
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
                          updateLessonData(module.id, lesson.id, 'title', e.target.value)
                        }
                        placeholder="عنوان الدرس"
                      />
                      <input
                        type="url"
                        value={lesson.linkUrl || ''}
                        onChange={(e) =>
                          updateLessonData(module.id, lesson.id, 'linkUrl', e.target.value)
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
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate('/creator/dashboard')} 
            className="btn-secondary"
            disabled={submitting}
          >
            إلغاء
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditCourse
