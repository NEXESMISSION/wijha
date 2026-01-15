import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { supabase } from '../lib/supabase'
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
  getAllTeachersWithEarnings,
  getAllStudentsForAdmin,
  getPlatformFinancials,
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
  
  // User search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)

  // New: Users and Financial states
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [financials, setFinancials] = useState(null)
  const [usersTab, setUsersTab] = useState('teachers') // 'teachers' or 'students'

  useEffect(() => {
    if (user?.id) {
      // Always load data when component mounts or user changes
      loadAllData()
      if (activeTab === 'settings') {
        loadSettings()
      }
    }
  }, [user?.id]) // Only depend on user.id, not activeTab to avoid unnecessary reloads

  const loadAllData = async (forceReload = false) => {
    // forceReload parameter kept for backward compatibility but we always reload now
    try {
      setLoading(true)
      setError(null)
      
      // Add longer timeout to prevent hanging (20 seconds)
      const dataPromise = Promise.all([
        getAllCoursesForAdmin().catch((err) => { console.error('Error loading courses:', err); return [] }),
        getAllEnrollments().catch((err) => { console.error('Error loading enrollments:', err); return [] }),
        getAllPayoutRequests().catch((err) => { console.error('Error loading payouts:', err); return [] }),
        getAllReports().catch((err) => { console.error('Error loading reports:', err); return [] }),
        getAllCategories().catch((err) => { console.error('Error loading categories:', err); return [] }),
        getAllTeachersWithEarnings().catch((err) => { console.error('Error loading teachers:', err); return [] }),
        getAllStudentsForAdmin().catch((err) => { console.error('Error loading students:', err); return [] }),
        getPlatformFinancials().catch((err) => { console.error('Error loading financials:', err); return null })
      ])
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data load timeout - try refreshing')), 20000)
      )
      
      const [coursesData, enrollmentsData, payoutsData, reportsData, categoriesData, teachersData, studentsData, financialsData] = await Promise.race([dataPromise, timeoutPromise])
      
      // Debug logging
      console.log('[AdminDashboard] Loaded data:', {
        courses: coursesData?.length || 0,
        enrollments: enrollmentsData?.length || 0,
        payouts: payoutsData?.length || 0,
        reports: reportsData?.length || 0,
        categories: categoriesData?.length || 0,
        teachers: teachersData?.length || 0,
        students: studentsData?.length || 0,
        financials: !!financialsData
      })
      
      // Set main data and clear loading immediately
      setCourses(coursesData || [])
      setEnrollments(enrollmentsData || [])
      setTeachers(teachersData || [])
      setStudents(studentsData || [])
      setFinancials(financialsData)
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

  // Search for user by watermark_code or user ID
  const searchUser = async () => {
    if (!searchQuery.trim()) {
      showWarning('يرجى إدخال كود العلامة المائية أو معرف المستخدم')
      return
    }

    try {
      setSearchLoading(true)
      setError(null)
      
      const query = searchQuery.trim()
      const queryUpper = query.toUpperCase()
      
      // Check if query looks like a UUID (contains dashes and is 36 chars)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
      
      let profileQuery = supabase
        .from('profiles')
        .select('*')
      
      // If it's a UUID, search by exact match on id, otherwise use ilike for text fields
      // Note: email is not in profiles table, it's in auth.users, so we only search watermark_code and name
      if (isUUID) {
        // Search by UUID (exact match) OR text fields (ilike)
        profileQuery = profileQuery.or(`id.eq.${query},watermark_code.ilike.%${queryUpper}%,name.ilike.%${query}%`)
      } else {
        // Search only in text fields (watermark_code, name)
        // Note: watermark_code is usually uppercase, so use queryUpper
        profileQuery = profileQuery.or(`watermark_code.ilike.%${queryUpper}%,name.ilike.%${query}%`)
      }
      
      const { data: profileData, error: profileError } = await profileQuery.limit(10)

      if (profileError) {
        throw profileError
      }

      if (!profileData || profileData.length === 0) {
        showWarning('لم يتم العثور على مستخدم بهذا الكود')
        setSearchResults(null)
        setSearchLoading(false)
        return
      }

      // If multiple results, use the first one (or show list)
      const userProfile = profileData[0]
      const userId = userProfile.id

      // Get email from auth.users using RPC function
      let userEmail = null
      try {
        const { data: emailData, error: emailError } = await supabase
          .rpc('get_user_email', { user_id: userId })
        
        if (!emailError && emailData) {
          userEmail = emailData
        }
      } catch (err) {
        console.warn('Could not fetch email:', err.message)
      }

      // Add email to profile if found
      if (userEmail) {
        userProfile.email = userEmail
      }

      // Get all related data for this user
      const [
        userCourses,
        userEnrollments,
        userPayouts,
        userReports,
        videoEvents
      ] = await Promise.all([
        // Courses created by this user
        supabase
          .from('courses')
          .select('*, categories(id, name, icon)')
          .eq('creator_id', userId)
          .order('created_at', { ascending: false }),
        
        // Enrollments for this user
        supabase
          .from('enrollments')
          .select('*, courses(id, title, price, thumbnail_url), payment_proofs(*)')
          .eq('student_id', userId)
          .order('created_at', { ascending: false }),
        
        // Payout requests
        supabase
          .from('payout_requests')
          .select('*')
          .eq('creator_id', userId)
          .order('submitted_at', { ascending: false }),
        
        // Reports
        supabase
          .from('reports')
          .select('*, courses(id, title)')
          .eq('reporter_id', userId)
          .order('created_at', { ascending: false }),
        
        // Video events (if table exists)
        (async () => {
          try {
            const { data, error } = await supabase
              .from('video_events')
              .select('*')
              .eq('student_id', userId)
              .order('created_at', { ascending: false })
              .limit(100)
            return { data: data || [], error }
          } catch (err) {
            // Ignore if table doesn't exist
            return { data: [], error: null }
          }
        })()
      ])

      const result = {
        profile: userProfile,
        courses: userCourses.data || [],
        enrollments: userEnrollments.data || [],
        payouts: userPayouts.data || [],
        reports: userReports.data || [],
        videoEvents: videoEvents.data || [] // videoEvents is already resolved from Promise.all
      }

      setSearchResults(result)
      setShowUserDetails(true)
      showSuccess(`تم العثور على المستخدم: ${userProfile.name || userProfile.watermark_code || 'مستخدم'}`)
    } catch (err) {
      console.error('Error searching user:', err)
      showError('خطأ في البحث: ' + err.message)
      setSearchResults(null)
    } finally {
      setSearchLoading(false)
    }
  }

  // Send notification/update to user
  const sendNotification = async () => {
    if (!notificationMessage.trim() || !searchResults?.profile) {
      showWarning('يرجى إدخال رسالة الإشعار')
      return
    }

    try {
      setSendingNotification(true)
      
      // Create notification in database
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: searchResults.profile.id,
          title: 'تحديث من الإدارة',
          message: notificationMessage,
          type: 'admin_update',
          read: false
        })

      if (error) {
        // If notifications table doesn't exist, create it first
        if (error.code === '42P01') {
          showWarning('جدول الإشعارات غير موجود. سيتم إنشاؤه...')
          // You can create the table via SQL
        } else {
          throw error
        }
      } else {
        showSuccess('تم إرسال الإشعار بنجاح')
        setNotificationMessage('')
      }
    } catch (err) {
      console.error('Error sending notification:', err)
      showError('خطأ في إرسال الإشعار: ' + err.message)
    } finally {
      setSendingNotification(false)
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
    },
    users: {
      teachers: teachers.length,
      students: students.length,
      total: teachers.length + students.length
    },
    finance: financials || {
      totalRevenue: 0,
      platformEarnings: 0,
      teacherEarnings: 0,
      totalPaidOut: 0,
      pendingPayouts: 0
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
        marginBottom: '3rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
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
        <button
          onClick={() => loadAllData(true)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(124, 52, 217, 0.3)'
          }}
        >
          {loading ? '⏳ جاري التحديث...' : '🔄 تحديث البيانات'}
        </button>
      </div>

      {/* User Search Bar */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '1rem',
          color: '#1f2937'
        }}>
          🔍 البحث عن مستخدم
        </h2>
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#4b5563'
            }}>
              كود العلامة المائية / معرف المستخدم / البريد الإلكتروني
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUser()}
              placeholder="أدخل كود العلامة المائية (مثل: D64A546A) أو معرف المستخدم"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C34D9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <button
            onClick={searchUser}
            disabled={searchLoading || !searchQuery.trim()}
            style={{
              padding: '0.75rem 2rem',
              background: searchLoading || !searchQuery.trim() 
                ? '#e5e7eb' 
                : 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              color: searchLoading || !searchQuery.trim() ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: searchLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: searchLoading || !searchQuery.trim() 
                ? 'none' 
                : '0 4px 12px rgba(124, 52, 217, 0.3)'
            }}
          >
            {searchLoading ? '⏳ جاري البحث...' : '🔍 بحث'}
          </button>
        </div>
      </div>

      {/* User Details Modal */}
      {showUserDetails && searchResults && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
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
              📋 تفاصيل المستخدم
            </h2>
            <button
              onClick={() => {
                setShowUserDetails(false)
                setSearchResults(null)
                setSearchQuery('')
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280'
              }}
            >
              ✕ إغلاق
            </button>
          </div>

          {/* User Profile Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem'
          }}>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>الاسم:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.125rem', fontWeight: 600 }}>
                {searchResults.profile.name || 'غير محدد'}
              </p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>البريد الإلكتروني:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.125rem' }}>
                {searchResults.profile.email || 'غير متاح'}
              </p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>معرف المستخدم:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', fontFamily: 'monospace' }}>
                {searchResults.profile.id}
              </p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>كود العلامة المائية:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.125rem', fontWeight: 700, color: '#7C34D9' }}>
                {searchResults.profile.watermark_code || 'غير محدد'}
              </p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>الدور:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.125rem' }}>
                {searchResults.profile.role === 'admin' ? '👑 مشرف' : 
                 searchResults.profile.role === 'creator' ? '🎓 منشئ محتوى' : 
                 searchResults.profile.role === 'student' ? '📚 طالب' : 
                 searchResults.profile.role || 'غير محدد'}
              </p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>تاريخ التسجيل:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>
                {searchResults.profile.created_at 
                  ? new Date(searchResults.profile.created_at).toLocaleDateString('ar-SA')
                  : 'غير محدد'}
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              color: 'white',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {searchResults.courses.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                الدورات المنشأة
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              color: 'white',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {searchResults.enrollments.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                التسجيلات
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {searchResults.payouts.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                طلبات السحب
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {searchResults.videoEvents.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                أحداث الفيديو
              </div>
            </div>
          </div>

          {/* Send Notification */}
          <div style={{
            background: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1rem',
              color: '#1f2937'
            }}>
              📨 إرسال إشعار/تحديث
            </h3>
            <textarea
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              placeholder="اكتب رسالة الإشعار أو التحديث للمستخدم..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <button
              onClick={sendNotification}
              disabled={sendingNotification || !notificationMessage.trim()}
              style={{
                padding: '0.75rem 2rem',
                background: sendingNotification || !notificationMessage.trim()
                  ? '#e5e7eb'
                  : 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                color: sendingNotification || !notificationMessage.trim() ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: sendingNotification || !notificationMessage.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {sendingNotification ? '⏳ جاري الإرسال...' : '📤 إرسال الإشعار'}
            </button>
          </div>

          {/* User Courses */}
          {searchResults.courses.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#1f2937'
              }}>
                🎓 الدورات المنشأة ({searchResults.courses.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1rem'
              }}>
                {searchResults.courses.map(course => (
                  <div key={course.id} style={{
                    background: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {course.title}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      الحالة: {course.status === 'approved' ? '✅ معتمد' : 
                               course.status === 'pending' ? '⏳ قيد المراجعة' : 
                               course.status === 'rejected' ? '❌ مرفوض' : course.status}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      السعر: {course.price} د.أ
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Enrollments */}
          {searchResults.enrollments.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#1f2937'
              }}>
                📚 التسجيلات ({searchResults.enrollments.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1rem'
              }}>
                {searchResults.enrollments.map(enrollment => (
                  <div key={enrollment.id} style={{
                    background: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {enrollment.courses?.title || 'دورة غير معروفة'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      الحالة: {enrollment.status === 'approved' ? '✅ معتمد' : 
                               enrollment.status === 'pending' ? '⏳ قيد المراجعة' : 
                               enrollment.status === 'rejected' ? '❌ مرفوض' : enrollment.status}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      التاريخ: {enrollment.created_at 
                        ? new Date(enrollment.created_at).toLocaleDateString('ar-SA')
                        : 'غير محدد'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Events */}
          {searchResults.videoEvents.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#1f2937'
              }}>
                🎬 أحداث الفيديو ({searchResults.videoEvents.length})
              </h3>
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '0.75rem'
              }}>
                {searchResults.videoEvents.slice(0, 50).map((event, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: 'white',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ fontWeight: 600 }}>
                      {event.event_type || 'حدث غير معروف'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                      {event.created_at 
                        ? new Date(event.created_at).toLocaleString('ar-SA')
                        : 'تاريخ غير محدد'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

            {/* Users Card */}
            <div
              onClick={() => setActiveTab('users')}
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
                  {stats.users.total}
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
                المستخدمون
              </h3>
              <div style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                <span style={{ color: '#7C34D9' }}>
                  {stats.users.teachers} مدرس
                </span>
                <span style={{ color: '#10b981' }}>
                  {stats.users.students} طالب
                </span>
              </div>
            </div>

            {/* Finance Card */}
            <div
              onClick={() => setActiveTab('finance')}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 10px 30px -5px rgba(16, 185, 129, 0.3)',
                border: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(16, 185, 129, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(16, 185, 129, 0.3)'
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
                  {stats.finance.platformEarnings?.toFixed(2) || '0.00'} د.ت
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
                marginBottom: '0.5rem'
              }}>
                أرباح المنصة
              </h3>
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9
              }}>
                من {stats.finance.totalRevenue?.toFixed(2) || '0.00'} د.ت إجمالي المبيعات
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
              onClick={() => setActiveTab('users')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'users' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'users' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'users' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👥 المستخدمون ({stats.users.total})
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'finance' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                color: activeTab === 'finance' ? 'white' : '#6b7280',
                fontWeight: activeTab === 'finance' ? 700 : 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💰 المالية
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

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="admin-section">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h2 style={{ margin: 0 }}>👥 إدارة المستخدمين</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setUsersTab('teachers')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: usersTab === 'teachers' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#f3f4f6',
                  color: usersTab === 'teachers' ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🎓 المدرسون ({teachers.length})
              </button>
              <button
                onClick={() => setUsersTab('students')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: usersTab === 'students' ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#f3f4f6',
                  color: usersTab === 'students' ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📚 الطلاب ({students.length})
              </button>
            </div>
          </div>

          {/* Teachers List */}
          {usersTab === 'teachers' && (
            <div>
              {teachers.length === 0 ? (
                <div className="empty-state">لا يوجد مدرسون بعد</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gap: '1rem'
                }}>
                  {teachers.map(teacher => (
                    <div key={teacher.id} style={{
                      background: 'white',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: '1.5rem',
                        alignItems: 'center'
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.5rem',
                          fontWeight: 700
                        }}>
                          {teacher.name?.charAt(0)?.toUpperCase() || '👤'}
                        </div>

                        {/* Info */}
                        <div>
                          <h3 style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: '#1f2937',
                            marginBottom: '0.5rem'
                          }}>
                            <Link to={`/creator/${teacher.profile_slug || teacher.id}`} style={{
                              color: '#7C34D9',
                              textDecoration: 'none'
                            }}>
                              {teacher.name || 'مدرس بدون اسم'}
                            </Link>
                          </h3>
                          <div style={{
                            display: 'flex',
                            gap: '1.5rem',
                            flexWrap: 'wrap',
                            fontSize: '0.875rem',
                            color: '#6b7280'
                          }}>
                            <span>📧 {teacher.email || 'لا يوجد بريد'}</span>
                            <span>📚 {teacher.coursesCount || 0} دورة</span>
                            <span>👥 {teacher.studentsCount || 0} طالب</span>
                            <span>📅 انضم {new Date(teacher.created_at).toLocaleDateString('ar-SA')}</span>
                          </div>
                        </div>

                        {/* Earnings */}
                        <div style={{
                          textAlign: 'left',
                          minWidth: '200px'
                        }}>
                          <div style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                              {(teacher.availableBalance || 0).toFixed(2)} د.ت
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                              الرصيد المتاح
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial Details */}
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '1rem'
                      }}>
                        <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937' }}>
                            {(teacher.totalEarnings || 0).toFixed(2)} د.ت
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>إجمالي المبيعات</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#92400e' }}>
                            {(teacher.platformFees || 0).toFixed(2)} د.ت
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#92400e' }}>رسوم المنصة</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '0.75rem', background: '#d1fae5', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#065f46' }}>
                            {(teacher.netEarnings || 0).toFixed(2)} د.ت
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#065f46' }}>صافي الأرباح</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '0.75rem', background: '#dbeafe', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af' }}>
                            {(teacher.paidOut || 0).toFixed(2)} د.ت
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>تم صرفه</div>
                        </div>
                        {teacher.pendingPayout > 0 && (
                          <div style={{ textAlign: 'center', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                              {(teacher.pendingPayout || 0).toFixed(2)} د.ت
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#d97706' }}>قيد السحب</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Students List */}
          {usersTab === 'students' && (
            <div>
              {students.length === 0 ? (
                <div className="empty-state">لا يوجد طلاب بعد</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '1rem'
                }}>
                  {students.map(student => (
                    <div key={student.id} style={{
                      background: 'white',
                      borderRadius: '1rem',
                      padding: '1.25rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.25rem',
                          fontWeight: 700
                        }}>
                          {student.name?.charAt(0)?.toUpperCase() || '📚'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#1f2937',
                            marginBottom: '0.25rem'
                          }}>
                            {student.name || 'طالب بدون اسم'}
                          </h4>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                            {student.email || student.watermark_code || 'لا يوجد بريد'}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          padding: '0.5rem',
                          background: '#f3f4f6',
                          borderRadius: '0.5rem'
                        }}>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#7C34D9' }}>
                            {student.enrollmentsCount || 0}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>تسجيل</div>
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          background: '#d1fae5',
                          borderRadius: '0.5rem'
                        }}>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#065f46' }}>
                            {student.approvedEnrollments || 0}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#065f46' }}>موافق</div>
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          background: '#fef3c7',
                          borderRadius: '0.5rem'
                        }}>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#92400e' }}>
                            {(student.totalSpent || 0).toFixed(0)} د.ت
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#92400e' }}>منفق</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '0.75rem',
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        textAlign: 'center'
                      }}>
                        📅 انضم {new Date(student.created_at).toLocaleDateString('ar-SA')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Finance Tab */}
      {activeTab === 'finance' && (
        <div className="admin-section">
          <h2 style={{ marginBottom: '2rem' }}>💰 نظرة مالية شاملة</h2>
          
          {/* Main Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Total Revenue */}
            <div style={{
              background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
              borderRadius: '1rem',
              padding: '2rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                إجمالي المبيعات
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                {(stats.finance.totalRevenue || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '1rem', opacity: 0.9 }}>دينار تونسي</div>
            </div>

            {/* Platform Earnings */}
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '1rem',
              padding: '2rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                🎉 أرباح المنصة ({stats.finance.platformFeePercent || 10}%)
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                {(stats.finance.platformEarnings || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '1rem', opacity: 0.9 }}>دينار تونسي</div>
            </div>

            {/* Teacher Earnings */}
            <div style={{
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              borderRadius: '1rem',
              padding: '2rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                أرباح المدرسين
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                {(stats.finance.teacherEarnings || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '1rem', opacity: 0.9 }}>دينار تونسي</div>
            </div>

            {/* Paid Out */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '1rem',
              padding: '2rem',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                تم صرفه للمدرسين
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                {(stats.finance.totalPaidOut || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '1rem', opacity: 0.9 }}>دينار تونسي</div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#7C34D9' }}>
                {stats.finance.totalEnrollments || 0}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>إجمالي التسجيلات</div>
            </div>
            <div style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                {stats.finance.publishedCourses || 0}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>دورات منشورة</div>
            </div>
            <div style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                {(stats.finance.pendingPayouts || 0).toFixed(2)} د.ت
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>مدفوعات معلقة</div>
            </div>
            <div style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937' }}>
                {stats.users.teachers || 0}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>مدرسين نشطين</div>
            </div>
          </div>

          {/* Monthly Revenue */}
          {financials?.monthlyRevenue && financials.monthlyRevenue.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#1f2937'
              }}>
                📊 الإيرادات الشهرية
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9375rem'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>الشهر</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>التسجيلات</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>المبيعات</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981' }}>أرباح المنصة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.monthlyRevenue.map(item => (
                      <tr key={item.month} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                          {new Date(item.month + '-01').toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {item.enrollments}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                          {item.revenue.toFixed(2)} د.ت
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                          {item.platformEarnings.toFixed(2)} د.ت
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <span>💳 {paymentProof.payment_method === 'bank' ? 'تحويل بنكي' : paymentProof.payment_method === 'mobile' ? 'دفع محمول' : paymentProof.payment_method === 'cash' ? 'نقدي' : paymentProof.payment_method === 'dodo' ? 'VISA/MASTERCARD (DODO)' : paymentProof.payment_method}</span>
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
