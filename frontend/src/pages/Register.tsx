import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import api, { setCsrfToken } from '@/lib/api'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        // Fallback
      }

      await register(name, email, password, location || undefined)
      navigate('/dashboard')
    } catch (err: any) {
      const details = err.response?.data?.details
      setError(details ? details.join(', ') : err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Skill Swap</h1>
          <p className="text-text-muted mt-2">Join the learning community</p>
        </div>

        <div className="bg-surface-alt border border-border shadow-xl rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-6">Create account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border text-white px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:border-primary/50"
                required
              />
            </div>
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
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-text mb-1">
                Location <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-surface border border-border text-white px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:border-primary/50"
              />
            </div>

              {error && <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
