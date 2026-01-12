import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/design-system.css'

function LandingPage() {
  const { user } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            منصة وجها للتعلم الإلكتروني
          </h1>
          <p className="hero-subtitle">
            اكتشف مجموعة واسعة من الدورات التدريبية المتخصصة وابدأ رحلتك التعليمية اليوم
          </p>
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '2rem'
          }}>
            {!user ? (
              <>
                <Link to="/signup" className="btn-gradient" style={{
                  padding: '1rem 2rem',
                  fontSize: '1.125rem',
                  textDecoration: 'none'
                }}>
                  ابدأ الآن
                </Link>
                <Link to="/login" className="btn-primary" style={{
                  padding: '1rem 2rem',
                  fontSize: '1.125rem',
                  textDecoration: 'none'
                }}>
                  تسجيل الدخول
                </Link>
              </>
            ) : (
              <Link 
                to={user.role === 'student' ? '/courses' : user.role === 'creator' ? '/creator/dashboard' : '/admin/dashboard'} 
                className="btn-gradient"
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.125rem',
                  textDecoration: 'none'
                }}
              >
                الانتقال إلى لوحة التحكم
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section" style={{
        background: 'linear-gradient(135deg, rgba(124, 52, 217, 0.05) 0%, rgba(244, 132, 52, 0.05) 100%)'
      }}>
        <div className="container">
          <div style={{
            textAlign: 'center',
            marginBottom: '4rem'
          }}>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '1rem'
            }}>
              لماذا تختار وجها؟
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#6b7280',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              منصة شاملة تجمع بين أفضل المدرسين والطلاب المتحمسين
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {/* Feature 1 */}
            <div style={{
              background: 'white',
              borderRadius: '1.5rem',
              padding: '2rem',
              boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
              textAlign: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
            }}
            >
              <div style={{
                fontSize: '4rem',
                marginBottom: '1.5rem'
              }}>
                📚
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '1rem'
              }}>
                دورات متنوعة
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                اكتشف مجموعة واسعة من الدورات التدريبية في مختلف المجالات والتخصصات
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              background: 'white',
              borderRadius: '1.5rem',
              padding: '2rem',
              boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
              textAlign: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
            }}
            >
              <div style={{
                fontSize: '4rem',
                marginBottom: '1.5rem'
              }}>
                👨‍🏫
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '1rem'
              }}>
                مدرسون محترفون
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                تعلم من أفضل المدرسين والمحترفين في مجالاتهم مع محتوى عالي الجودة
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              background: 'white',
              borderRadius: '1.5rem',
              padding: '2rem',
              boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)',
              textAlign: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 20px 40px -5px rgba(22, 22, 22, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
            }}
            >
              <div style={{
                fontSize: '4rem',
                marginBottom: '1.5rem'
              }}>
                🎯
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#1f2937',
                marginBottom: '1rem'
              }}>
                تعلم في أي وقت
              </h3>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                تعلم في الوقت والمكان الذي يناسبك مع إمكانية الوصول للمحتوى في أي وقت
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="section" style={{
          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
          color: 'white'
        }}>
          <div className="container" style={{
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              marginBottom: '1rem'
            }}>
              ابدأ رحلتك التعليمية اليوم
            </h2>
            <p style={{
              fontSize: '1.25rem',
              marginBottom: '2rem',
              opacity: 0.95
            }}>
              انضم إلى آلاف الطلاب والمدرسين في منصة وجها
            </p>
            <Link 
              to="/signup" 
              className="btn-primary"
              style={{
                padding: '1rem 2.5rem',
                fontSize: '1.125rem',
                textDecoration: 'none',
                background: 'white',
                color: '#7C34D9',
                fontWeight: 700
              }}
            >
              سجل الآن مجاناً
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

export default LandingPage

