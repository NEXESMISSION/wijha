import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { getCreatorCourses, getCreatorEarnings, createPayoutRequest, getProfile, updateCreatorProfile, getPendingPayoutRequests, getAllCreatorPayoutRequests } from '../lib/api'
import { supabase } from '../lib/supabase'
import '../styles/design-system.css'
import './Dashboard.css'
import './CreatorDashboard.css'

function CreatorDashboard() {
  const { user } = useAuth()
  const { showSuccess, showError, showWarning } = useAlert()
  const [courses, setCourses] = useState([])
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    platformFees: 0,
    netEarnings: 0,
    enrollmentsCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('d17')
  const [payoutNote, setPayoutNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [payoutPhone, setPayoutPhone] = useState('')
  const [payoutRIB, setPayoutRIB] = useState('')
  const [payoutBankName, setPayoutBankName] = useState('')
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
  const [payoutHistory, setPayoutHistory] = useState([])
  const [loadingPayoutHistory, setLoadingPayoutHistory] = useState(false)

  useEffect(() => {
    if (user?.id) {
      // Only show loading if we don't have data yet
      if (courses.length === 0 && earnings.totalEarnings === 0) {
        loadData()
      }
      loadProfile() // Always load profile to show profile button
      if (activeTab === 'payouts') {
        loadPayoutHistory() // Always reload to get latest payout statuses
      }
      if (activeTab === 'profile') {
        // Profile already loaded above
      }
    }
  }, [user, activeTab])
  
  // Recalculate earnings when payout history changes (e.g., status updates)
  useEffect(() => {
    if (user?.id && earnings.totalEarnings > 0) {
      // Calculate from base net earnings (totalEarnings - platformFees), not from modified netEarnings
      const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
      const availableEarnings = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
      
      // Only update if different to avoid infinite loops
      if (Math.abs(earnings.netEarnings - availableEarnings) > 0.01) {
        setEarnings(prev => ({
          ...prev,
          netEarnings: availableEarnings
        }))
      }
    }
  }, [payoutHistory.map(p => `${p.id}-${p.status}-${p.amount}`).join(','), earnings.totalEarnings, earnings.platformFees])
  
  const calculateAvailableEarnings = (baseNetEarnings, payouts) => {
    if (!payouts || payouts.length === 0) {
      return baseNetEarnings
    }
    
    // Only subtract approved and pending payouts
    // Rejected/canceled payouts don't affect earnings (money stays in account)
    const approvedPayouts = payouts.filter(p => p.status === 'approved' || p.status === 'done')
    const pendingPayouts = payouts.filter(p => p.status === 'pending')
    
    const totalApproved = approvedPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    const totalPending = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    
    // Available = Base Net earnings - approved (already paid) - pending (reserved)
    return Math.max(0, baseNetEarnings - totalApproved - totalPending)
  }
  
  const loadPayoutHistory = async () => {
    try {
      setLoadingPayoutHistory(true)
      const payouts = await getAllCreatorPayoutRequests(user.id)
      setPayoutHistory(payouts || [])
      
      // Recalculate available earnings based on payout statuses
      if (earnings.totalEarnings > 0) {
        const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
        const availableEarnings = calculateAvailableEarnings(baseNetEarnings, payouts)
        setEarnings(prev => ({
          ...prev,
          netEarnings: availableEarnings
        }))
      }
    } catch (err) {
      console.error('Error loading payout history:', err)
      showError('خطأ في تحميل سجل السحوبات: ' + err.message)
    } finally {
      setLoadingPayoutHistory(false)
    }
  }
  
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
      
      showSuccess('تم تحديث الملف الشخصي بنجاح!')
      await loadProfile()
    } catch (err) {
      showError('خطأ في حفظ الملف الشخصي: ' + err.message)
      console.error('Error:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const loadData = async (forceReload = false) => {
    // Don't reload if we already have data unless forced
    if (!forceReload && courses.length > 0 && earnings.totalEarnings > 0) {
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      const [coursesData, earningsData] = await Promise.all([
        getCreatorCourses(user.id),
        getCreatorEarnings(user.id),
      ])
      setCourses(coursesData || [])
      
      // Load payout history to calculate correct available earnings
      const payouts = await getAllCreatorPayoutRequests(user.id).catch(() => [])
      setPayoutHistory(payouts)
      
      const baseEarnings = earningsData || {
        totalEarnings: 0,
        platformFees: 0,
        netEarnings: 0,
        enrollmentsCount: 0,
      }
      
      // Calculate available earnings (subtract approved and pending payouts)
      // Use base net earnings (totalEarnings - platformFees) for calculation
      const baseNetEarnings = baseEarnings.totalEarnings - baseEarnings.platformFees
      const availableEarnings = calculateAvailableEarnings(baseNetEarnings, payouts)
      
      setEarnings({
        ...baseEarnings,
        netEarnings: availableEarnings
      })
      
      // Load per-course earnings
      if (coursesData && coursesData.length > 0) {
        await loadCourseEarnings(coursesData)
      }
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
    const MIN_PAYOUT = 100
    
    // Check for pending payouts first (before any validation)
    try {
      const pendingPayouts = await getPendingPayoutRequests(user.id)
      if (pendingPayouts && pendingPayouts.length > 0) {
        const totalPending = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
        showWarning(
          `لديك طلب سحب قيد الانتظار بمبلغ ${totalPending.toFixed(2)} د.ت. يرجى انتظار معالجة الطلب الحالي قبل إرسال طلب جديد.`,
          'طلب سحب قيد الانتظار'
        )
        return
      }
    } catch (err) {
      console.error('Error checking pending payouts:', err)
      // Continue with validation if check fails
    }
    
    if (amount < MIN_PAYOUT) {
      showWarning(`الحد الأدنى للسحب هو ${MIN_PAYOUT} د.ت`)
      return
    }
    
    // Calculate available earnings including payout deductions
    const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
    const availableEarnings = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
    
    if (amount > availableEarnings) {
      showWarning(`المبلغ يتجاوز الرصيد المتاح (${availableEarnings.toFixed(2)} د.ت)`)
      return
    }

    if (amount <= 0) {
      showWarning('يجب أن يكون المبلغ أكبر من 0')
      return
    }

    // Validate payment method specific fields
    if (payoutMethod === 'd17' || payoutMethod === 'flouci') {
      if (!payoutPhone || payoutPhone.trim() === '') {
        showWarning('الرجاء إدخال رقم الهاتف')
        return
      }
    }

    if (payoutMethod === 'bank') {
      if (!payoutRIB || payoutRIB.trim() === '') {
        showWarning('الرجاء إدخال رقم RIB')
        return
      }
      if (!payoutBankName || payoutBankName.trim() === '') {
        showWarning('الرجاء إدخال اسم صاحب الحساب البنكي')
        return
      }
    }

    try {
      setSubmitting(true)
      
      // Build payment details note
      let paymentDetails = ''
      if (payoutMethod === 'd17' || payoutMethod === 'flouci') {
        paymentDetails = `رقم الهاتف: ${payoutPhone}`
      } else if (payoutMethod === 'bank') {
        paymentDetails = `RIB: ${payoutRIB}, اسم صاحب الحساب: ${payoutBankName}`
      }
      
      const fullNote = paymentDetails + (payoutNote ? `\nملاحظة: ${payoutNote}` : '')
      
      await createPayoutRequest({
        creator_id: user.id,
        amount,
        payment_method: payoutMethod,
        note: fullNote || null,
        status: 'pending',
      })
      
      showSuccess('تم بدء عملية السحب بنجاح! سيتم تحويل المبلغ خلال 1-3 أيام عمل.', 'تم بدء عملية السحب')
      setShowPayoutModal(false)
      setPayoutAmount('')
      setPayoutNote('')
      setPayoutPhone('')
      setPayoutRIB('')
      setPayoutBankName('')
      
      // Reload earnings and payout history to update available balance
      const [earningsData, payouts] = await Promise.all([
        getCreatorEarnings(user.id),
        getAllCreatorPayoutRequests(user.id).catch(() => [])
      ])
      
      setPayoutHistory(payouts)
      
      // Calculate available earnings (subtract approved and pending payouts)
      const availableEarnings = calculateAvailableEarnings(earningsData, payouts)
      
      setEarnings({
        ...earningsData,
        netEarnings: availableEarnings
      })
    } catch (err) {
      showError('خطأ في إرسال طلب السحب: ' + err.message)
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
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {profile?.profile_slug ? (
            <Link 
              to={`/creator/${profile.profile_slug}`} 
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              عرض ملفي الشخصي
            </Link>
          ) : (
            <button
              onClick={() => setActiveTab('profile')}
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
              title="قم بإعداد ملفك الشخصي أولاً"
            >
              عرض ملفي الشخصي
            </button>
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
          onClick={() => setActiveTab('payouts')}
          style={{
            padding: '1rem 2rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'payouts' ? '3px solid #7C34D9' : '3px solid transparent',
            color: activeTab === 'payouts' ? '#7C34D9' : '#6b7280',
            fontWeight: activeTab === 'payouts' ? 700 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          💰 سجل السحوبات ({payoutHistory.filter(p => p.status === 'pending').length > 0 ? payoutHistory.filter(p => p.status === 'pending').length : ''})
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

      {activeTab === 'payouts' && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#1f2937',
            marginBottom: '2rem'
          }}>
            💰 سجل السحوبات
          </h2>
          
          {loadingPayoutHistory ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280'
            }}>
              جاري تحميل سجل السحوبات...
            </div>
          ) : payoutHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
              <p>لا توجد سحوبات حتى الآن</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {payoutHistory.map((payout) => {
                const getStatusColor = (status) => {
                  switch(status) {
                    case 'pending': return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' }
                    case 'approved': return { bg: '#d1fae5', text: '#065f46', border: '#10b981' }
                    case 'rejected': return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }
                    case 'canceled': return { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
                    case 'done': return { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' }
                    default: return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' }
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
                
                const statusStyle = getStatusColor(payout.status)
                
                const isPending = payout.status === 'pending'
                
                return (
                  <div key={payout.id} style={{
                    border: `2px solid ${statusStyle.border}`,
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    background: statusStyle.bg,
                    boxShadow: isPending ? '0 4px 12px rgba(251, 191, 36, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    borderWidth: isPending ? '3px' : '2px',
                    position: 'relative',
                    ...(isPending && {
                      animation: 'pulse 2s infinite'
                    })
                  }}>
                    {isPending && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '1rem',
                        background: '#fbbf24',
                        color: '#92400e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}>
                        ⏳ قيد الانتظار
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#1f2937',
                          marginBottom: '0.5rem'
                        }}>
                          {parseFloat(payout.amount).toFixed(2)} د.ت
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#6b7280',
                          marginBottom: '0.25rem'
                        }}>
                          طريقة الدفع: {getPaymentMethodText(payout.payment_method)}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          تاريخ الإرسال: {new Date(payout.submitted_at).toLocaleDateString('ar-TN', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {payout.approved_at && (
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            تاريخ المعالجة: {new Date(payout.approved_at).toLocaleDateString('ar-TN', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{
                        background: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        border: `2px solid ${statusStyle.border}`
                      }}>
                        <span style={{
                          color: statusStyle.text,
                          fontWeight: 700,
                          fontSize: '0.875rem'
                        }}>
                          {getStatusText(payout.status)}
                        </span>
                      </div>
                    </div>
                    
                    {payout.note && (
                      <div style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        marginTop: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        <strong>تفاصيل الدفع:</strong>
                        <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                          {payout.note}
                        </div>
                      </div>
                    )}
                    
                    {payout.admin_note && (
                      <div style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        marginTop: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#374151',
                        border: '1px solid #e5e7eb'
                      }}>
                        <strong>ملاحظة المشرف:</strong>
                        <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                          {payout.admin_note}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
          {/* Earnings Summary Cards - Simplified */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}
          className="earnings-grid-responsive"
          >
            {/* Earnings Card - Single Combined Card */}
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
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  💰 أرباحي الصافية
                </div>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  marginBottom: '1rem',
                  lineHeight: 1.2
                }}>
                  {(() => {
                    const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                    return calculateAvailableEarnings(baseNetEarnings, payoutHistory).toFixed(2)
                  })()} د.ت
                </div>
                
                {/* Breakdown */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    opacity: 0.95
                  }}>
                    <span>إجمالي الأرباح:</span>
                    <span style={{ fontWeight: 700 }}>{earnings.totalEarnings.toFixed(2)} د.ت</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    opacity: 0.85,
                    paddingTop: '0.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <span>رسوم المنصة ({earnings.platformFeePercent?.toFixed(2) || '10.00'}%):</span>
                    <span style={{ fontWeight: 600, color: '#fecaca' }}>-{earnings.platformFees.toFixed(2)} د.ت</span>
                  </div>
                  {(() => {
                    const approvedPayouts = payoutHistory.filter(p => p.status === 'approved' || p.status === 'done')
                    const pendingPayouts = payoutHistory.filter(p => p.status === 'pending')
                    const totalApproved = approvedPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                    const totalPending = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                    
                    if (totalApproved > 0 || totalPending > 0) {
                      return (
                        <>
                          {totalApproved > 0 && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              opacity: 0.85,
                              paddingTop: '0.5rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
                            }}>
                              <span>السحوبات المدفوعة:</span>
                              <span style={{ fontWeight: 600, color: '#fecaca' }}>-{totalApproved.toFixed(2)} د.ت</span>
                            </div>
                          )}
                          {totalPending > 0 && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              opacity: 0.85,
                              paddingTop: '0.5rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
                            }}>
                              <span>السحوبات قيد الانتظار:</span>
                              <span style={{ fontWeight: 600, color: '#fbbf24' }}>-{totalPending.toFixed(2)} د.ت</span>
                            </div>
                          )}
                        </>
                      )
                    }
                    return null
                  })()}
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
                    cursor: (() => {
                      const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                      const available = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
                      return available <= 0 ? 'not-allowed' : 'pointer'
                    })(),
                    opacity: (() => {
                      const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                      const available = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
                      return available <= 0 ? 0.5 : 1
                    })(),
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  disabled={(() => {
                    const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                    const available = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
                    return available <= 0
                  })()}
                  onMouseEnter={(e) => {
                    const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                    const available = calculateAvailableEarnings(baseNetEarnings, payoutHistory)
                    if (available > 0) {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  سحب الأرباح
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
                  marginBottom: '0.5rem'
                }}>
                  سحب الأرباح
                </h2>
                <p style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  marginBottom: '1.5rem'
                }}>
                  سيتم تحويل المبلغ خلال 1-3 أيام عمل
                </p>
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
                      value={`${(() => {
                        const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                        return calculateAvailableEarnings(baseNetEarnings, payoutHistory).toFixed(2)
                      })()} د.ت`} 
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
                  max={(() => {
                    const baseNetEarnings = earnings.totalEarnings - earnings.platformFees
                    return calculateAvailableEarnings(baseNetEarnings, payoutHistory)
                  })()}
                  min="100"
                  step="0.01"
                  required
                      placeholder="الحد الأدنى: 100 د.ت"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                />
                <small style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem',
                  display: 'block'
                }}>
                  الحد الأدنى للسحب: 100 د.ت
                </small>
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
                  onChange={(e) => {
                    setPayoutMethod(e.target.value)
                    // Clear fields when changing method
                    setPayoutPhone('')
                    setPayoutRIB('')
                    setPayoutBankName('')
                  }}
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
                      <option value="d17">D17</option>
                      <option value="bank">تحويل بنكي</option>
                      <option value="flouci">Flouci</option>
                </select>
              </div>

              {/* Payment Method Specific Fields */}
              {(payoutMethod === 'd17' || payoutMethod === 'flouci') && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151'
                  }}>
                    {payoutMethod === 'd17' && (
                      <img 
                        src="https://play-lh.googleusercontent.com/lOgvUGpz6YUSXJG48kbzGrTEohIC8FDr_WkP6rwgaELR0g5o6OQu5-VPGexKoB8F0C-_" 
                        alt="D17"
                        style={{ width: '60px', height: 'auto' }}
                      />
                    )}
                    {payoutMethod === 'flouci' && (
                      <img 
                        src="https://flouci.com/static/img/gallery/Logos_flouci-horizontal-gradient.12157bd2c525.png" 
                        alt="Flouci"
                        style={{ width: '80px', height: 'auto' }}
                      />
                    )}
                    <span>رقم الهاتف *</span>
                  </label>
                  <input
                    type="tel"
                    value={payoutPhone}
                    onChange={(e) => setPayoutPhone(e.target.value)}
                    required
                    placeholder="مثال: 12345678"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              )}

              {payoutMethod === 'bank' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600,
                      color: '#374151'
                    }}>
                      رقم RIB *
                    </label>
                    <input
                      type="text"
                      value={payoutRIB}
                      onChange={(e) => setPayoutRIB(e.target.value)}
                      required
                      placeholder="مثال: 1234567890123456789012"
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
                      اسم صاحب الحساب البنكي *
                    </label>
                    <input
                      type="text"
                      value={payoutBankName}
                      onChange={(e) => setPayoutBankName(e.target.value)}
                      required
                      placeholder="الاسم الكامل كما هو في الحساب البنكي"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </>
              )}
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
                      className="btn-gradient"
                      disabled={submitting}
                      style={{ padding: '0.75rem 2rem' }}
                    >
                      {submitting ? 'جاري المعالجة...' : 'تأكيد السحب'}
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
