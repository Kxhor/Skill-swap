import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import { lazy, Suspense } from 'react'
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const SwapRequests = lazy(() => import('@/pages/SwapRequests'))
const BrowseUsers = lazy(() => import('@/pages/BrowseUsers'))
const Profile = lazy(() => import('@/pages/Profile'))
const CommunityStats = lazy(() => import('@/pages/CommunityStats'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))
const MySkills = lazy(() => import('@/pages/MySkills'))
const MySwaps = lazy(() => import('@/pages/MySwaps'))
const Messages = lazy(() => import('@/pages/Messages'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Availability = lazy(() => import('@/pages/Availability'))
const Reviews = lazy(() => import('@/pages/Reviews'))
const Settings = lazy(() => import('@/pages/Settings'))
const Friends = lazy(() => import('@/pages/Friends'))
import { ErrorBoundary } from '@/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { 
      retry: 1, 
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-text-muted">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-text-muted">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-text-muted">Loading...</div>
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-text-muted">Loading page...</div>}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/swaps" element={<ProtectedRoute><SwapRequests /></ProtectedRoute>} />
        <Route path="/my-swaps" element={<ProtectedRoute><MySwaps /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><MySkills /></ProtectedRoute>} />
        <Route path="/availability" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><BrowseUsers /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityStats /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <AppRoutes />
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
