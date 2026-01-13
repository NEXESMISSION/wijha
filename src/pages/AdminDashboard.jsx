import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import '../styles/design-system.css'
import {
  getAllCoursesForAdmin,
  updateCourseStatus,
  deleteCourse,
  getPendingEnrollments,
  getAllEnrollments,
  updateEnrollmentStatus,
  getAllPayoutRequests,
  updatePayoutRequestStatus,
  getPaymentProofByEnrollment,
  getPlatformSettings,
  updatePlatformSettings,
  getAllReports,
  updateReportStatus,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../lib/api'
import './Dashboard.css'

function AdminDashboard() {
  const { user } = useAuth()
  const { showSuccess, showError, showWarning } = useAlert()
  const [activeTab, setActiveTab] = useState('overview')
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [payoutRequests, setPayoutRequests] = useState([])
  const [reports, setReports] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(null)
  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [platformSettings, setPlatformSettings] = useState({
    platform_fee_percent: 10, // Stored as percentage for display (10 = 10%)
    payment_fee_percent: 2, // Stored as percentage for display (2 = 2%)
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (user?.id) {
      // Only show loading if we don't have data yet
      if (courses.length === 0 && enrollments.length === 0 && payoutRequests.length === 0) {
      loadAllData()
      }
      if (activeTab === 'settings') {
        loadSettings()
      }
    }
  }, [user, activeTab])

  const loadAllData = async (forceReload = false) => {
    // Don't reload if we already have data unless forced
    if (!forceReload && courses.length > 0 && enrollments.length > 0) {
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Add timeout to prevent hanging
      const dataPromise = Promise.all([
        getAllCoursesForAdmin().catch(() => []),
        getAllEnrollments().catch(() => []),
        getAllPayoutRequests().catch(() => []),
        getAllReports().catch(() => []),
        getAllCategories().catch(() => [])
      ])
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data load timeout')), 5000)
      )
      
      const [coursesData, enrollmentsData, payoutsData, reportsData, categoriesData] = await Promise.race([dataPromise, timeoutPromise])
      
      // Set main data and clear loading immediately
      setCourses(coursesData || [])
      setEnrollments(enrollmentsData || [])
      setLoading(false) // Clear loading immediately
      
      // Set extra data (non-blocking)
      setPayoutRequests(payoutsData || [])
      setReports(reportsData || [])
      setCategories(categoriesData || [])
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات')
      console.error('Error loading data:', err)
      setLoading(false)
    }
  }

  const loadData = async () => {
    // Keep for backward compatibility if needed
    await loadAllData()
  }

  const loadSettings = async () => {
    try {
      setSettingsLoading(true)
      const settings = await getPlatformSettings()
      // Settings are stored as decimals (0.2 = 20%), but we display as percentages
      // So we need to convert to percentage for display in the form
      setPlatformSettings({
        platform_fee_percent: (parseFloat(settings.platform_fee_percent) || 0.1) * 100,
        payment_fee_percent: (parseFloat(settings.payment_fee_percent) || 0.02) * 100,
      })
    } catch (err) {
      console.error('Error loading settings:', err)
      showError('خطأ في تحميل إعدادات المنصة: ' + err.message)
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    
    const platformFee = parseFloat(platformSettings.platform_fee_percent)
    const paymentFee = parseFloat(platformSettings.payment_fee_percent)
    
    if (isNaN(platformFee) || platformFee < 0 || platformFee > 100) {
      showWarning('رسوم المنصة يجب أن تكون بين 0 و 100')
      return
    }
    
    if (isNaN(paymentFee) || paymentFee < 0 || paymentFee > 100) {
      showWarning('رسوم الدفع يجب أن تكون بين 0 و 100')
      return
    }

    try {
      setSavingSettings(true)
      await updatePlatformSettings({
        platform_fee_percent: platformFee / 100, // Convert percentage to decimal
        payment_fee_percent: paymentFee / 100, // Convert percentage to decimal
      }, user.id)
      showSuccess('تم حفظ الإعدادات بنجاح!', 'تم الحفظ')
    } catch (err) {
      showError('خطأ في حفظ الإعدادات: ' + err.message)
      console.error('Error:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleCourseAction = async (courseId, action) => {
    try {
      setProcessing(courseId)
      const status = action === 'approved' ? 'published' : 'suspended'
      await updateCourseStatus(courseId, status, user.id)
      await loadAllData(true)
      showSuccess(`تم ${action === 'published' ? 'نشر' : action === 'suspended' ? 'تعليق' : 'تحديث'} الدورة بنجاح!`, 'تم التحديث')
    } catch (err) {
      showError('خطأ في تحديث الدورة: ' + err.message)
      console.error('Error:', err)
    } finally {
      setProcessing(null)
    }
  }

  const handleDeleteCourse = async (courseId, courseTitle) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${courseTitle}"?\n\n` +
      `This will permanently delete:\n` +
      `- The course and all its content\n` +
      `- All modules and lessons\n` +
      `- All enrollments\n` +
      `- All payment proofs\n\n` +
      `This action cannot be undone!`
    )
    
    if (!confirmed) return

    try {
      setProcessing(courseId)
      await deleteCourse(courseId)
      await loadAllData(true)
      showSuccess('تم حذف الدورة بنجاح!', 'تم الحذف')
    } catch (err) {
      showError('خطأ في حذف الدورة: ' + err.message)
      console.error('Error:', err)
    } finally {
      setProcessing(null)
    }
  }

  const handleEnrollmentAction = async (enrollmentId, action) => {
    let rejectionNote = null
    let isRestricted = false
    let restrictionReason = null
    
    if (action === 'reject') {
      rejectionNote = prompt('يرجى تقديم سبب الرفض:')
      if (!rejectionNote) return
      
      // Ask if they want to restrict the student from re-enrolling
      const restrict = confirm('هل تريد حظر هذا الطالب من إعادة التسجيل؟\n\nاضغط موافق للحظر، إلغاء للسماح بإعادة التسجيل.')
      if (restrict) {
        isRestricted = true
        restrictionReason = prompt('Please provide a restriction reason (why they cannot enroll again):')
        if (!restrictionReason) {
          // If no restriction reason provided, use rejection note
          restrictionReason = rejectionNote
        }
      }
    }

    try {
      setProcessing(enrollmentId)
      await updateEnrollmentStatus(enrollmentId, action === 'approved' ? 'approved' : 'rejected', user.id, rejectionNote, isRestricted, restrictionReason)
      await loadAllData(true)
      showSuccess(`تم ${action === 'approved' ? 'الموافقة على' : 'رفض'} التسجيل بنجاح!${isRestricted ? ' تم حظر الطالب من إعادة التسجيل.' : ''}`, 'تم التحديث')
    } catch (err) {
      showError('خطأ في تحديث التسجيل: ' + err.message)
      console.error('Error:', err)
    } finally {
      setProcessing(null)
    }
  }

  const handlePayoutAction = async (requestId, action) => {
    let adminNote = null
    
    if (action === 'reject') {
      adminNote = prompt('يرجى تقديم سبب الرفض:')
      if (!adminNote) return
    }

    try {
      setProcessing(requestId)
      await updatePayoutRequestStatus(requestId, action === 'approved' ? 'approved' : 'rejected', user.id, adminNote)
      await loadAllData(true) // Force reload to get updated data
      showSuccess(`تم ${action === 'approved' ? 'الموافقة على' : 'رفض'} طلب السحب بنجاح!`, 'تم التحديث')
    } catch (err) {
      showError('خطأ في تحديث طلب السحب: ' + err.message)
      console.error('Error:', err)
    } finally {
      setProcessing(null)
    }
  }

  const loadPaymentProof = async (enrollmentId) => {
    try {
      const proof = await getPaymentProofByEnrollment(enrollmentId)
      return proof
    } catch (err) {
      console.error('Error loading payment proof:', err)
      return null
    }
  }

  const handleReportAction = async (reportId, action) => {
    let adminNotes = null
    
    if (action === 'resolved' || action === 'dismissed') {
      adminNotes = prompt('أضف ملاحظات المشرف (اختياري):') || null
    }

    try {
      setProcessing(reportId)
      await updateReportStatus(reportId, action, user.id, adminNotes)
      await loadAllData(true)
      showSuccess(`تم ${action === 'reviewed' ? 'تحديث البلاغ كتمت المراجعة' : action === 'resolved' ? 'حل البلاغ' : 'رفض البلاغ'} بنجاح!`, 'تم التحديث')
    } catch (err) {
      showError('خطأ في تحديث البلاغ: ' + err.message)
      console.error('Error:', err)
    } finally {
      setProcessing(null)
    }
  }

  // Calculate stats
  const stats = {
    courses: {
      total: courses.length,
      pending: courses.filter(c => c.status === 'pending').length,
      approved: courses.filter(c => c.status === 'approved').length,
      rejected: courses.filter(c => c.status === 'rejected').length
    },
    enrollments: {
      total: enrollments.length,
      pending: enrollments.filter(e => e.status === 'pending').length,
      approved: enrollments.filter(e => e.status === 'approved').length,
      rejected: enrollments.filter(e => e.status === 'rejected').length
    },
    payouts: {
      total: payoutRequests.length,
      pending: payoutRequests.filter(p => p.status === 'pending').length,
      approved: payoutRequests.filter(p => p.status === 'approved').length,
      rejected: payoutRequests.filter(p => p.status === 'rejected').length
    },
    reports: {
      total: reports.length,
      pending: reports.filter(r => r.status === 'pending').length
    },
    categories: {
      total: categories.length
    }
  }

  if (loading && courses.length === 0 && enrollments.length === 0) {
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
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '3rem'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          لوحة تحكم المشرف
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280'
        }}>
          إدارة شاملة لمنصة الدورات التدريبية
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '2rem',
          color: '#dc2626'
        }}>
          خطأ: {error}
        </div>
      )}

      {/* Stats Overview Cards */}
      {activeTab === 'overview' || !activeTab || activeTab === '' ? (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Courses Card */}
            <div
              onClick={() => setActiveTab('courses')}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.courses.total}
                </div>
                <div style={{
                  fontSize: '2rem'
                }}>
                  📚
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                الدورات
              </h3>
              <div style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                <span style={{ color: stats.courses.pending > 0 ? '#f59e0b' : '#6b7280' }}>
                  {stats.courses.pending} قيد الانتظار
                </span>
                <span style={{ color: '#10b981' }}>
                  {stats.courses.approved} موافق
                </span>
              </div>
            </div>

            {/* Enrollments Card */}
            <div
              onClick={() => setActiveTab('enrollments')}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.enrollments.total}
                </div>
                <div style={{
                  fontSize: '2rem'
                }}>
                  👥
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                التسجيلات
              </h3>
              <div style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                <span style={{ color: stats.enrollments.pending > 0 ? '#f59e0b' : '#6b7280' }}>
                  {stats.enrollments.pending} قيد الانتظار
                </span>
                <span style={{ color: '#10b981' }}>
                  {stats.enrollments.approved} موافق
                </span>
              </div>
            </div>

            {/* Payouts Card */}
            <div
              onClick={() => setActiveTab('payouts')}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.payouts.total}
                </div>
                <div style={{
                  fontSize: '2rem'
                }}>
                  💰
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                طلبات السحب
              </h3>
              <div style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                <span style={{ color: stats.payouts.pending > 0 ? '#f59e0b' : '#6b7280' }}>
                  {stats.payouts.pending} قيد الانتظار
                </span>
                <span style={{ color: '#10b981' }}>
                  {stats.payouts.approved} موافق
                </span>
              </div>
            </div>

            {/* Reports Card */}
            <div
              onClick={() => setActiveTab('reports')}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.reports.total}
                </div>
                <div style={{
                  fontSize: '2rem'
                }}>
                  🚩
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                البلاغات
              </h3>
              <div style={{
                fontSize: '0.875rem',
                color: stats.reports.pending > 0 ? '#f59e0b' : '#6b7280',
                fontWeight: stats.reports.pending > 0 ? 700 : 400
              }}>
                {stats.reports.pending} قيد الانتظار
              </div>
            </div>

            {/* Categories Card */}
            <div
              onClick={() => setActiveTab('categories')}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
                e.currentTarget.style.borderColor = '#7C34D9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.categories.total}
                </div>
                <div style={{
                  fontSize: '2rem'
                }}>
                  📂
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                الفئات
              </h3>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                إجمالي الفئات المتاحة
              </div>
            </div>

            {/* Settings Card */}
            <div
              onClick={() => setActiveTab('settings')}
              style={{
                background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(124, 52, 217, 0.3)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(124, 52, 217, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(124, 52, 217, 0.3)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900
                }}>
                  ⚙️
                </div>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                marginBottom: '0.5rem'
              }}>
                إعدادات الرسوم
              </h3>
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9
              }}>
                إدارة إعدادات المنصة
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '0.5rem'
          }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'overview' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'overview' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'overview' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              نظرة عامة
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'courses' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'courses' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'courses' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              الدورات ({stats.courses.pending})
            </button>
            <button
              onClick={() => setActiveTab('enrollments')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'enrollments' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'enrollments' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'enrollments' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              التسجيلات ({stats.enrollments.pending})
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'payouts' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'payouts' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'payouts' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              طلبات السحب ({stats.payouts.pending})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'reports' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'reports' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'reports' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              البلاغات ({stats.reports.pending})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'categories' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'categories' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'categories' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              الفئات ({stats.categories.total})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'settings' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'settings' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'settings' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              إعدادات الرسوم
            </button>
          </div>

        </>
      )}

      {/* Tab Content */}
      {activeTab === 'courses' && (
        <div className="admin-section">
          <h2>الموافقة على الدورات</h2>
          {courses.length === 0 ? (
            <div className="empty-state">لا توجد دورات</div>
          ) : (
            <div className="admin-list">
              {courses.map((course) => (
                <div key={course.id} className="admin-item">
                  <div className="item-info">
                    <h3>{course.title}</h3>
                    <p>
                      المنشئ: {course.profiles?.name || 'غير معروف'} | 
                      السعر: {parseFloat(course.price).toFixed(2)} د.ت | 
                      تاريخ الإنشاء: {new Date(course.created_at).toLocaleDateString('ar-TN')}
                    </p>
                    <span className={`status-badge status-${course.status}`}>
                      {course.status === 'pending' ? 'قيد الانتظار' : course.status === 'approved' ? 'موافق عليه' : course.status === 'rejected' ? 'مرفوض' : course.status}
                    </span>
                  </div>
                  <div className="item-actions">
                    {course.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleCourseAction(course.id, 'approved')}
                          className="btn-success"
                          disabled={processing === course.id}
                        >
                          {processing === course.id ? 'جاري المعالجة...' : 'موافقة'}
                        </button>
                        <button
                          onClick={() => handleCourseAction(course.id, 'rejected')}
                          className="btn-danger"
                          disabled={processing === course.id}
                        >
                          {processing === course.id ? 'جاري المعالجة...' : 'رفض'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="btn-danger"
                      disabled={processing === course.id}
                      title="حذف الدورة نهائياً"
                    >
                      {processing === course.id ? 'جاري المعالجة...' : 'حذف'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'enrollments' && (
        <div className="admin-section">
          <h2>جميع التسجيلات</h2>
          {enrollments.length === 0 ? (
            <div className="empty-state">لا توجد تسجيلات</div>
          ) : (
            <div className="admin-list">
              {enrollments.map((enrollment) => (
                <EnrollmentItem
                  key={enrollment.id}
                  enrollment={enrollment}
                  onAction={handleEnrollmentAction}
                  processing={processing === enrollment.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="admin-section">
          <h2>طلبات السحب</h2>
          {payoutRequests.length === 0 ? (
            <div className="empty-state">لا توجد طلبات سحب</div>
          ) : (
            <div className="admin-list">
              {payoutRequests.map((request) => {
                const creatorSlug = request.profiles?.profile_slug || request.profiles?.id
                const creatorName = request.profiles?.name || request.profiles?.email || 'منشئ غير معروف'
                
                const getPaymentMethodText = (method) => {
                  switch(method) {
                    case 'bank': return 'تحويل بنكي'
                    case 'mobile': return 'دفع محمول'
                    case 'cash': return 'نقدي'
                    case 'd17': return 'D17'
                    case 'flouci': return 'Flouci'
                    default: return method
                  }
                }
                
                const getStatusText = (status) => {
                  switch(status) {
                    case 'pending': return 'قيد الانتظار'
                    case 'approved': return 'موافق عليه'
                    case 'rejected': return 'مرفوض'
                    case 'canceled': return 'ملغي'
                    case 'done': return 'مكتمل'
                    default: return status
                  }
                }
                
                return (
                <div key={request.id} className="admin-item" style={{
                  background: 'white',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e7eb',
                  marginBottom: '1rem'
                }}>
                  <div className="item-info" style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: '#1f2937',
                          marginBottom: '0.5rem'
                        }}>
                        {request.profiles?.name ? (
                            <Link 
                              to={`/creator/${creatorSlug}`} 
                              className="creator-link"
                              style={{
                                color: '#7C34D9',
                                textDecoration: 'none'
                              }}
                            >
                              {creatorName}
                          </Link>
                        ) : (
                            <span style={{ color: '#6b7280' }}>{creatorName}</span>
                        )}
                      </h3>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.75rem',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          <div>
                            <strong style={{ color: '#374151' }}>المبلغ:</strong> 
                            <span style={{ marginRight: '0.5rem', fontWeight: 700, color: '#1f2937' }}>
                              {parseFloat(request.amount).toFixed(2)} د.ت
                    </span>
                  </div>
                          <div>
                            <strong style={{ color: '#374151' }}>طريقة الدفع:</strong> 
                            <span style={{ marginRight: '0.5rem' }}>
                              {getPaymentMethodText(request.payment_method)}
                            </span>
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>تاريخ الإرسال:</strong> 
                            <span style={{ marginRight: '0.5rem' }}>
                              {new Date(request.submitted_at).toLocaleDateString('ar-TN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        
                        {request.note && (
                          <div style={{
                            background: '#f9fafb',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            marginBottom: '0.75rem',
                            border: '1px solid #e5e7eb'
                          }}>
                            <strong style={{ color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                              ملاحظة:
                            </strong>
                            <div style={{ 
                              color: '#6b7280',
                              fontSize: '0.875rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {request.note}
                            </div>
                          </div>
                        )}
                        
                        {request.admin_note && (
                          <div style={{
                            background: '#fef3c7',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            marginBottom: '0.75rem',
                            border: '1px solid #fbbf24'
                          }}>
                            <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                              ملاحظة المشرف:
                            </strong>
                            <div style={{ 
                              color: '#78350f',
                              fontSize: '0.875rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {request.admin_note}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.5rem'
                      }}>
                        <span className={`status-badge status-${request.status}`} style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}>
                          {getStatusText(request.status)}
                        </span>
                        
                    {request.status === 'pending' && (
                          <div className="item-actions" style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginTop: '0.5rem'
                          }}>
                        <button
                          onClick={() => handlePayoutAction(request.id, 'approved')}
                          className="btn-success"
                          disabled={processing === request.id}
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem'
                              }}
                        >
                              {processing === request.id ? 'جاري...' : 'موافقة'}
                        </button>
                        <button
                          onClick={() => handlePayoutAction(request.id, 'rejected')}
                          className="btn-danger"
                          disabled={processing === request.id}
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem'
                              }}
                        >
                              {processing === request.id ? 'جاري...' : 'رفض'}
                          </button>
                          </div>
                      )}
                      </div>
                    </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="admin-section">
          <h2>إعدادات رسوم المنصة</h2>
          {settingsLoading ? (
            <div className="loading">جاري تحميل الإعدادات...</div>
          ) : (
            <form onSubmit={handleSaveSettings} className="settings-form">
              <div className="form-group">
                <label htmlFor="platform_fee">
                  نسبة رسوم المنصة (%)
                  <small>هذه هي النسبة المأخوذة من مبيعات الدورات</small>
                </label>
                <input
                  type="number"
                  id="platform_fee"
                  min="0"
                  max="100"
                  step="0.01"
                  value={platformSettings.platform_fee_percent}
                  onChange={(e) => setPlatformSettings({
                    ...platformSettings,
                    platform_fee_percent: parseFloat(e.target.value) || 0
                  })}
                  required
                />
                <p className="form-help">
                  الحالي: {platformSettings.platform_fee_percent.toFixed(2)}%
                  {platformSettings.platform_fee_percent > 0 && (
                    <span> (مثال: دورة بقيمة 100 د.ت = {(100 * platformSettings.platform_fee_percent / 100).toFixed(2)} د.ت رسوم منصة)</span>
                  )}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="payment_fee">
                  نسبة رسوم الدفع (%)
                  <small>هذه هي النسبة المأخوذة لمعالجة الدفع</small>
                </label>
                <input
                  type="number"
                  id="payment_fee"
                  min="0"
                  max="100"
                  step="0.01"
                  value={platformSettings.payment_fee_percent}
                  onChange={(e) => setPlatformSettings({
                    ...platformSettings,
                    payment_fee_percent: parseFloat(e.target.value) || 0
                  })}
                  required
                />
                <p className="form-help">
                  الحالي: {platformSettings.payment_fee_percent.toFixed(2)}%
                  {platformSettings.payment_fee_percent > 0 && (
                    <span> (مثال: دفعة بقيمة 100 د.ت = {(100 * platformSettings.payment_fee_percent / 100).toFixed(2)} د.ت رسوم دفع)</span>
                  )}
                </p>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingSettings}
                >
                  {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="admin-section">
          <h2>البلاغات</h2>
          {reports.length === 0 ? (
            <div className="empty-state">لا توجد بلاغات</div>
          ) : (
            <div className="admin-list">
              {reports.map((report) => (
                <div key={report.id} className="admin-item">
                  <div className="item-info">
                    <h3>
                      بلاغ #{report.id.slice(0, 8)} - {report.report_type === 'course' ? 'دورة' : report.report_type === 'course_comment' ? 'تعليق على دورة' : report.report_type === 'creator_profile' ? 'ملف منشئ' : report.report_type}
                      {report.status === 'pending' && (
                        <span className="status-badge status-pending" style={{ marginLeft: '1rem' }}>
                          قيد الانتظار
                        </span>
                      )}
                    </h3>
                    <p>
                      <strong>المبلغ:</strong> {report.profiles?.name || 'غير معروف'} | 
                      <strong> النوع:</strong> {report.report_type === 'course' ? 'دورة' : report.report_type === 'course_comment' ? 'تعليق على دورة' : report.report_type === 'creator_profile' ? 'ملف منشئ' : report.report_type} | 
                      <strong> معرف العنصر:</strong> {report.reported_item_id ? String(report.reported_item_id).slice(0, 8) : 'غير متاح'}...
                    </p>
                    <p><strong>السبب:</strong> {report.reason}</p>
                    {report.description && (
                      <p><strong>الوصف:</strong> {report.description}</p>
                    )}
                    {report.admin_notes && (
                      <p><strong>ملاحظات المشرف:</strong> {report.admin_notes}</p>
                    )}
                    <p>
                      <strong>تاريخ الإرسال:</strong> {new Date(report.created_at).toLocaleDateString('ar-TN')}
                      {report.reviewed_at && (
                        <> | <strong>تاريخ المراجعة:</strong> {new Date(report.reviewed_at).toLocaleDateString('ar-TN')}</>
                      )}
                    </p>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status === 'pending' ? 'قيد الانتظار' : report.status === 'reviewed' ? 'تمت المراجعة' : report.status === 'resolved' ? 'تم الحل' : report.status === 'dismissed' ? 'مرفوض' : report.status}
                    </span>
                  </div>
                  <div className="item-actions">
                    {report.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReportAction(report.id, 'reviewed')}
                          className="btn-success"
                          disabled={processing === report.id}
                        >
                          {processing === report.id ? 'جاري المعالجة...' : 'تمت المراجعة'}
                        </button>
                        <button
                          onClick={() => handleReportAction(report.id, 'resolved')}
                          className="btn-primary"
                          disabled={processing === report.id}
                        >
                          {processing === report.id ? 'جاري المعالجة...' : 'حل'}
                        </button>
                        <button
                          onClick={() => handleReportAction(report.id, 'dismissed')}
                          className="btn-secondary"
                          disabled={processing === report.id}
                        >
                          {processing === report.id ? 'جاري المعالجة...' : 'رفض'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="admin-section">
          <h2>إدارة الفئات</h2>
          
          {/* Create New Category Form */}
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>إضافة فئة جديدة</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 120px', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>اسم الفئة *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="مثال: برمجة"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>الوصف</label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="وصف الفئة"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>الأيقونة</label>
                <input
                  type="text"
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  placeholder="💻"
                  maxLength="2"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    textAlign: 'center'
                  }}
                />
              </div>
              <button
                onClick={async () => {
                  if (!newCategory.name.trim()) {
                    showWarning('يرجى إدخال اسم الفئة')
                    return
                  }
                  try {
                    setProcessing('create-category')
                    await createCategory({
                      ...newCategory,
                      created_by_admin_id: user.id
                    })
                    setNewCategory({ name: '', description: '', icon: '' })
                    await loadAllData(true)
                    showSuccess('تم إنشاء الفئة بنجاح!', 'تم الإنشاء')
                  } catch (err) {
                    showError('خطأ في إنشاء الفئة: ' + err.message)
                  } finally {
                    setProcessing(null)
                  }
                }}
                className="btn-primary"
                disabled={processing === 'create-category'}
                style={{ height: 'fit-content' }}
              >
                {processing === 'create-category' ? 'جاري...' : 'إضافة'}
              </button>
            </div>
          </div>

          {/* Categories List */}
          {loading ? (
            <div className="loading">جاري تحميل الفئات...</div>
          ) : categories.length === 0 ? (
            <p>لا توجد فئات بعد. أضف فئة جديدة أعلاه.</p>
          ) : (
            <div className="admin-list">
              {categories.map((category) => (
                <div key={category.id} className="admin-item">
                  <div className="item-content">
                    {editingCategory?.id === category.id ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '1rem', width: '100%' }}>
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            fontSize: '1rem'
                          }}
                        />
                        <input
                          type="text"
                          value={editingCategory.description || ''}
                          onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            fontSize: '1rem'
                          }}
                        />
                        <input
                          type="text"
                          value={editingCategory.icon || ''}
                          onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                          maxLength="2"
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            textAlign: 'center'
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <h3>
                          {category.icon && <span style={{ marginLeft: '0.5rem' }}>{category.icon}</span>}
                          {category.name}
                        </h3>
                        {category.description && (
                          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>{category.description}</p>
                        )}
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                          تم الإنشاء: {new Date(category.created_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="item-actions">
                    {editingCategory?.id === category.id ? (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              setProcessing(category.id)
                              await updateCategory(category.id, {
                                name: editingCategory.name,
                                description: editingCategory.description,
                                icon: editingCategory.icon
                              })
                              setEditingCategory(null)
                              await loadAllData(true)
                              showSuccess('تم تحديث الفئة بنجاح!', 'تم التحديث')
                            } catch (err) {
                              showError('خطأ في تحديث الفئة: ' + err.message)
                            } finally {
                              setProcessing(null)
                            }
                          }}
                          className="btn-success"
                          disabled={processing === category.id}
                        >
                          {processing === category.id ? 'جاري...' : 'حفظ'}
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="btn-secondary"
                          disabled={processing === category.id}
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingCategory({ ...category })}
                          className="btn-primary"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`هل أنت متأكد من حذف الفئة "${category.name}"؟`)) {
                              return
                            }
                            try {
                              setProcessing(category.id)
                              await deleteCategory(category.id)
                              await loadAllData(true)
                              showSuccess('تم حذف الفئة بنجاح!', 'تم الحذف')
                            } catch (err) {
                              showError('خطأ في حذف الفئة: ' + err.message)
                            } finally {
                              setProcessing(null)
                            }
                          }}
                          className="btn-danger"
                          disabled={processing === category.id}
                        >
                          {processing === category.id ? 'جاري...' : 'حذف'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Separate component for enrollment item to handle async payment proof loading
function EnrollmentItem({ enrollment, onAction, processing }) {
  const [paymentProof, setPaymentProof] = useState(null)
  const [loadingProof, setLoadingProof] = useState(false)

  useEffect(() => {
    loadProof()
  }, [enrollment.id])

  const loadProof = async () => {
    try {
      setLoadingProof(true)
      const proof = await getPaymentProofByEnrollment(enrollment.id)
      setPaymentProof(proof)
    } catch (err) {
      console.error('Error loading proof:', err)
    } finally {
      setLoadingProof(false)
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' }
      case 'approved': return { bg: '#d1fae5', text: '#065f46', border: '#10b981' }
      case 'rejected': return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }
      default: return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' }
    }
  }
  
  const statusStyle = getStatusColor(enrollment.status)

  return (
    <div style={{
      background: 'white',
      borderRadius: '0.75rem',
      padding: '1rem',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: `1px solid ${statusStyle.border}`,
      marginBottom: '0.75rem'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '1rem',
        alignItems: 'center'
      }}>
        {/* Left: Status Badge */}
        <div>
          <span style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: `2px solid ${statusStyle.border}`,
            whiteSpace: 'nowrap'
          }}>
            {enrollment.status === 'pending' ? '⏳ قيد الانتظار' : enrollment.status === 'approved' ? '✅ موافق' : '❌ مرفوض'}
          </span>
        </div>
        
        {/* Center: Info */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.25rem',
            flexWrap: 'wrap'
          }}>
            <strong style={{ color: '#1f2937', fontSize: '0.9375rem' }}>
              {enrollment.profiles?.name || enrollment.profiles?.email || 'طالب غير معروف'}
            </strong>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>•</span>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {enrollment.courses?.title || 'غير معروف'}
            </span>
          </div>
          <div style={{
            display: 'flex',
            gap: '1rem',
            fontSize: '0.8125rem',
            color: '#9ca3af',
            flexWrap: 'wrap'
          }}>
            <span>📅 {new Date(enrollment.created_at).toLocaleDateString('ar-TN')}</span>
            {paymentProof && paymentProof.payment_method && (
              <span>💳 {paymentProof.payment_method === 'bank' ? 'تحويل بنكي' : paymentProof.payment_method === 'mobile' ? 'دفع محمول' : paymentProof.payment_method === 'cash' ? 'نقدي' : paymentProof.payment_method}</span>
            )}
          </div>
          
          {/* Payment Proof - Compact */}
        {loadingProof ? (
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
              جاري تحميل إثبات الدفع...
            </div>
        ) : paymentProof && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#f9fafb',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem'
            }}>
            {paymentProof.file_url ? (
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ color: '#6b7280', fontWeight: 600 }}>
                    📎 إثبات الدفع (صورة)
                  </summary>
                  <img 
                    src={paymentProof.file_url} 
                    alt="إثبات الدفع" 
                    style={{
                      maxWidth: '200px',
                      maxHeight: '200px',
                      marginTop: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb'
                    }}
                  />
                </details>
            ) : paymentProof.text_proof ? (
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ color: '#6b7280', fontWeight: 600 }}>
                    📝 إثبات الدفع (نص)
                  </summary>
                  <p style={{ marginTop: '0.5rem', color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {paymentProof.text_proof}
                  </p>
                </details>
            ) : null}
            {paymentProof.notes && (
                <div style={{ marginTop: '0.25rem', color: '#6b7280', fontSize: '0.75rem' }}>
                  💬 {paymentProof.notes}
                </div>
            )}
          </div>
        )}
        
          {/* Rejection Notice - Compact */}
        {enrollment.status === 'rejected' && (
            <details style={{
              marginTop: '0.5rem',
            background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '0.5rem'
            }}>
              <summary style={{
                cursor: 'pointer',
                color: '#dc2626', 
                fontWeight: 600,
                fontSize: '0.8125rem'
              }}>
                ❌ سبب الرفض
              </summary>
            <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
              background: 'white',
                borderRadius: '0.25rem',
                fontSize: '0.8125rem',
                color: '#991b1b', 
                whiteSpace: 'pre-wrap'
              }}>
                {enrollment.rejection_note || 'لم يتم تحديد سبب محدد للرفض.'}
            </div>
            {enrollment.is_restricted && enrollment.restriction_reason && (
              <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                background: '#fff7ed',
                  borderRadius: '0.25rem',
                  fontSize: '0.8125rem',
                  color: '#9a3412'
                }}>
                  <strong>⚠️ محظور:</strong> {enrollment.restriction_reason}
              </div>
            )}
            </details>
        )}
      </div>
        
        {/* Right: Actions */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexShrink: 0
        }}>
        {enrollment.status === 'pending' && (
          <>
            <button
              onClick={() => onAction(enrollment.id, 'approved')}
              className="btn-success"
              disabled={processing}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap'
                }}
            >
                {processing ? '...' : '✅'}
            </button>
            <button
              onClick={() => onAction(enrollment.id, 'rejected')}
              className="btn-danger"
              disabled={processing}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap'
                }}
            >
                {processing ? '...' : '❌'}
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
