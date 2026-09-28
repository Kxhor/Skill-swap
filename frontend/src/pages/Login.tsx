import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import api, { setCsrfToken } from '@/lib/api'

export default function Login() {
  const { login, adminLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)

  useEffect(() => {
    api.get('/auth/csrf-token')
      .then((res) => {
        if (res.data?.csrf_token) setCsrfToken(res.data.csrf_token)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      try {
        const tokenRes = await api.get('/auth/csrf-token')
        if (tokenRes.data?.csrf_token) {
          setCsrfToken(tokenRes.data.csrf_token)
        }
      } catch {
        // Fallback to existing token
      }

      if (isAdminMode) {
        await adminLogin(email, password)
        navigate('/admin')
      } else {
        try {
          await login(email, password)
          navigate('/dashboard')
        } catch (userErr: any) {
          // If 401 on standard login, automatically attempt adminLogin
          if (userErr.response?.status === 401) {
            try {
              await adminLogin(email, password)
              navigate('/admin')
              return
            } catch {
              throw userErr
            }
          }
          throw userErr
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error
      if (err.response?.status === 429 || (err.response?.status === 500 && errMsg === 'An unexpected error occurred')) {
        setError('Too many sign-in attempts. Please wait a moment and try again.')
      } else {
        setError(errMsg || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Skill Swap</h1>
          <p className="text-text-muted mt-2">Learn together, grow together</p>
        </div>

        <div className="bg-surface-alt border border-border shadow-xl rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{isAdminMode ? 'Admin Sign in' : 'Sign in'}</h2>
            <div className="flex bg-surface rounded-xl p-1 border border-border">
              <button
                type="button"
                onClick={() => { setIsAdminMode(false); setError(''); }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  !isAdminMode ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => { setIsAdminMode(true); setError(''); }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  isAdminMode ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-border text-white px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:border-primary/50"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border text-white px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:border-primary/50"
                required
              />
            </div>

              {error && <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>


          <p className="text-center text-sm text-text-muted mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
