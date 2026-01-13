import { useNavigate } from 'react-router-dom'

function BackButton({ to = '/', label = '← العودة للرئيسية', style = {} }) {
  const navigate = useNavigate()

  const handleGoBack = () => {
    // Check if there's browser history to go back to
    // If referrer exists and is from the same origin, go back
    // Otherwise, go to landing page
    const referrer = document.referrer
    const currentOrigin = window.location.origin
    
    if (referrer && referrer.startsWith(currentOrigin) && referrer !== window.location.href) {
      // We have a referrer from the same origin, go back
      navigate(-1)
    } else {
      // No valid referrer or direct access, go to landing page
      navigate(to, { replace: false })
    }
  }

  return (
    <button
      onClick={handleGoBack}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: '#6b7280',
        textDecoration: 'none',
        marginBottom: '1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'color 0.3s',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'inherit',
        ...style
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#F48434'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
    >
      {label}
    </button>
  )
}

export default BackButton

