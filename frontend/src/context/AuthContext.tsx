import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  isAdmin: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  adminLogin: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, location?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/csrf-token')
      .then(() => api.get('/auth/me'))
      .then((res) => {
        const data = res.data
        if (data.user) setUser(data.user)
        else if (data.admin) setUser(data.admin as unknown as User)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    setUser(res.data.user)
  }

  const adminLogin = async (email: string, password: string) => {
    const res = await api.post('/auth/admin/login', { email, password })
    setUser(res.data.admin as unknown as User)
  }

  const register = async (name: string, email: string, password: string, location?: string) => {
    const res = await api.post('/auth/register', { name, email, password, location })
    setUser(res.data.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // network error or session already invalid — clear client state
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user !== null && 'role' in user,
        loading,
        login,
        adminLogin,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
