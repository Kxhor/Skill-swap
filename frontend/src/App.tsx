import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import SwapRequests from '@/pages/SwapRequests'
import BrowseUsers from '@/pages/BrowseUsers'
import Profile from '@/pages/Profile'
import CommunityStats from '@/pages/CommunityStats'
import AdminDashboard from '@/pages/AdminDashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
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
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/swaps" element={<ProtectedRoute><SwapRequests /></ProtectedRoute>} />
      <Route path="/browse" element={<ProtectedRoute><BrowseUsers /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/community" element={<ProtectedRoute><CommunityStats /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
