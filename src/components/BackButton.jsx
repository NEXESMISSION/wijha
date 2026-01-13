import { useNavigate } from 'react-router-dom'

function BackButton({ to = '/', label = '← العودة', style = {} }) {
  const navigate = useNavigate()

  const handleGoBack = () => {
    // Always go back to previous page in browser history
    // If no history exists, fall back to the specified route
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // No history, go to fallback route
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

