import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { getStudentEnrollments } from '../lib/api'
import '../styles/design-system.css'

export default function PaymentStatus() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError } = useAlert()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [enrollmentId, setEnrollmentId] = useState(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const statusParam = searchParams.get('status')
        const enrollmentIdParam = searchParams.get('enrollment_id')

        setEnrollmentId(enrollmentIdParam)
        setStatus(statusParam)

        // If payment succeeded, verify enrollment status
        if (statusParam === 'succeeded' && enrollmentIdParam && user?.id) {
          // Wait a moment for webhook to process
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Check enrollment status
          const enrollments = await getStudentEnrollments(user.id)
          const enrollment = enrollments.find(e => e.id === enrollmentIdParam)
          
          if (enrollment?.status === 'approved') {
            showSuccess('تم تأكيد الدفع بنجاح! يمكنك الآن الوصول إلى محتوى الدورة.')
          } else {
            // Enrollment might still be processing
            showSuccess('تم استلام الدفع بنجاح! جاري تأكيد التسجيل...')
          }
        } else if (statusParam === 'failed') {
          showError('فشل الدفع. يرجى المحاولة مرة أخرى.')
        }
      } catch (err) {
        console.error('Error checking payment status:', err)
        showError('حدث خطأ أثناء التحقق من حالة الدفع')
      } finally {
        setLoading(false)
      }
    }

    // Only run once when component mounts or searchParams change
    if (searchParams && user) {
      checkStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id])

  const handleGoToCourse = () => {
    if (enrollmentId) {
      // Try to find the course ID from enrollment
      navigate('/dashboard')
    } else {
      navigate('/dashboard')
    }
  }

  const handleRetry = () => {
    navigate(-1) // Go back to course page
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #7C34D9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>جاري التحقق من حالة الدفع...</p>
        </div>
      </div>
    )
  }

  const isSuccess = status === 'succeeded'
  const isFailed = status === 'failed'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1.5rem',
        padding: '3rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        {isSuccess ? (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              fontSize: '2.5rem'
            }}>
              ✓
            </div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: '1rem'
            }}>
              تم الدفع بنجاح!
            </h1>
            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              تم تأكيد الدفع بنجاح. يمكنك الآن الوصول إلى محتوى الدورة من لوحة التحكم.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleGoToCourse}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 20px rgba(124, 52, 217, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                الانتقال إلى لوحة التحكم
              </button>
            </div>
          </>
        ) : isFailed ? (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              fontSize: '2.5rem'
            }}>
              ✕
            </div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: '1rem'
            }}>
              فشل الدفع
            </h1>
            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              لم يتم إتمام عملية الدفع. يرجى المحاولة مرة أخرى أو استخدام طريقة دفع أخرى.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleRetry}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 20px rgba(124, 52, 217, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                المحاولة مرة أخرى
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'white',
                  color: '#374151',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                }}
              >
                العودة للوحة التحكم
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              fontSize: '2.5rem'
            }}>
              ?
            </div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: '1rem'
            }}>
              حالة غير معروفة
            </h1>
            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              لا يمكن تحديد حالة الدفع. يرجى التحقق من لوحة التحكم.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              العودة للوحة التحكم
            </button>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

