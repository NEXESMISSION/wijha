import { useEffect } from 'react'
import '../styles/design-system.css'
import './Alert.css'

function Alert({ 
  show, 
  type = 'info', 
  title, 
  message, 
  onClose, 
  onConfirm,
  confirmText = 'موافق',
  cancelText = 'إلغاء',
  showCancel = false,
  autoClose = false,
  autoCloseDelay = 5000
}) {
  useEffect(() => {
    if (show && autoClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [show, autoClose, autoCloseDelay, onClose])

  if (!show) return null

  const typeConfig = {
    success: {
      icon: '✓',
      bgGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      iconBg: '#10b981',
      borderColor: '#10b981'
    },
    error: {
      icon: '✕',
      bgGradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      iconBg: '#ef4444',
      borderColor: '#ef4444'
    },
    warning: {
      icon: '⚠',
      bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      iconBg: '#f59e0b',
      borderColor: '#f59e0b'
    },
    info: {
      icon: 'ℹ',
      bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      iconBg: '#3b82f6',
      borderColor: '#3b82f6'
    }
  }

  const config = typeConfig[type] || typeConfig.info

  return (
    <div 
      className="alert-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="alert-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: 0,
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: `2px solid ${config.borderColor}`,
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
      >
        {/* Header with gradient */}
        <div style={{
          background: config.bgGradient,
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          position: 'relative'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            flexShrink: 0,
            fontWeight: 700
          }}>
            {config.icon}
          </div>
          <div style={{ flex: 1 }}>
            {title && (
              <h3 style={{
                margin: 0,
                color: 'white',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '0.25rem'
              }}>
                {title}
              </h3>
            )}
            <p style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.95)',
              fontSize: '0.9375rem',
              lineHeight: 1.5
            }}>
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '1.25rem',
              fontWeight: 700,
              transition: 'all 0.2s',
              padding: 0,
              lineHeight: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        {/* Actions */}
        {(onConfirm || showCancel) && (
          <div style={{
            padding: '1.5rem 2rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb'
          }}>
            {showCancel && (
              <button
                onClick={onClose}
                className="btn-secondary"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 600
                }}
              >
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className="btn-gradient"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700
                }}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Alert

