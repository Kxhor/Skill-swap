import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setEmail('alice@test.com')
    setPassword('password123')
    setError('')
    setLoading(true)
    try {
      await login('alice@test.com', 'password123')
      navigate('/dashboard')
    } catch {
      setError('Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Skill Swap</h1>
          <p className="text-text-muted mt-2">Learn together, grow together</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in</h2>

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
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={handleDemoLogin}>
              Demo Login (Alice)
            </Button>
          </div>

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
