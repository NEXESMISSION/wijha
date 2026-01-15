import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AlertProvider } from './context/AlertContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StudentDashboard from './pages/StudentDashboard'
import CreatorDashboard from './pages/CreatorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CourseBrowse from './pages/CourseBrowse'
import CourseDetail from './pages/CourseDetail'
import CreatorProfile from './pages/CreatorProfile'
import CreateCourse from './pages/CreateCourse'
import EditCourse from './pages/EditCourse'
import LandingPage from './pages/LandingPage'
import PaymentStatus from './pages/PaymentStatus'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import SessionGuard from './components/SessionGuard'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  
  // Show loading while checking auth - don't redirect yet
  if (loading) {
    return <div className="loading">Loading...</div>
  }
  
  // Only redirect to login if user is not logged in AND loading is complete
  if (!user) {
    // Save current path to redirect back after login
    const returnUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
  }
  
  // Check role permissions
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to user's default dashboard instead of landing page
    const getDefaultRoute = () => {
      if (user.role === 'student') return '/courses'
      if (user.role === 'creator') return '/creator/dashboard'
      if (user.role === 'admin') return '/admin/dashboard'
      return '/courses' // Default to courses instead of landing page
    }
    return <Navigate to={getDefaultRoute()} replace />
  }
  
  return children
}

function AppRoutes() {
  // Safely get auth context - handle case where it might not be ready (React StrictMode/hot reload)
  let user, loading
  try {
    const auth = useAuth()
    user = auth.user
    loading = auth.loading
  } catch (err) {
    // Auth context not ready yet - show loading
    console.warn('[AppRoutes] Auth context not ready:', err)
    return <div className="loading">Loading...</div>
  }
  
  // Show loading while checking auth
  if (loading) {
    return <div className="loading">Loading...</div>
  }
  
  // Redirect based on role - but don't redirect if user is already on a valid page
  const getDefaultRoute = () => {
    if (!user) return '/courses' // Default to courses instead of landing page
    if (user.role === 'student') return '/courses' // Students go to courses page
    if (user.role === 'creator') return '/creator/dashboard'
    if (user.role === 'admin') return '/admin/dashboard'
    return '/courses' // Default to courses instead of landing page
  }
  
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to={getDefaultRoute()} replace />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to={getDefaultRoute()} replace />} />
      
      {/* Student Routes */}
      <Route path="/student/dashboard" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout>
            <StudentDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Creator Routes */}
      <Route path="/creator/dashboard" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Layout>
            <CreatorDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/creator/create-course" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Layout>
            <CreateCourse />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/creator/edit-course/:id" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Layout>
            <EditCourse />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Public Course Routes (accessible to everyone) */}
      <Route path="/courses" element={
        <Layout>
          <CourseBrowse />
        </Layout>
      } />
      
      <Route path="/courses/:id" element={
        <Layout>
          <CourseDetail />
        </Layout>
      } />
      
      <Route path="/creator/:slug" element={
        <Layout>
          <CreatorProfile />
        </Layout>
      } />
      
      {/* Payment Status Route */}
      <Route path="/payment-status" element={
        <Layout>
          <PaymentStatus />
        </Layout>
      } />
      
      {/* Legacy routes for backward compatibility */}
      <Route path="/create-course" element={
        user?.role === 'creator' ? <Navigate to="/creator/create-course" replace /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/edit-course/:id" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Layout>
            <EditCourse />
          </Layout>
        </ProtectedRoute>
      } />
      
    </Routes>
    </>
  )
}

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <AlertProvider>
          <SessionGuard>
            <AppRoutes />
          </SessionGuard>
        </AlertProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

