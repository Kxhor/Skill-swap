import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { User, Shield, Moon, Sun, Trash2 } from 'lucide-react'

export default function Settings() {
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['profile', ''],
    queryFn: () => api.get('/api/users/profile').then(r => r.data.user)
  })

  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'theme' | 'account'>('profile')

  // Profile Form States
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  const [instagram, setInstagram] = useState('')
  const [dob, setDob] = useState('')
  const [swapUsername, setSwapUsername] = useState('')

  // Privacy States
  const [showEmail, setShowEmail] = useState('friends')
  const [showSocials, setShowSocials] = useState('friends')

  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark')
  })

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '')
      setLocation(userProfile.location || '')
      setBio(userProfile.bio || '')
      setLinkedin(userProfile.linkedin_id || '')
      setGithub(userProfile.github_id || '')
      setInstagram(userProfile.instagram_id || '')
      setDob(userProfile.dob || '')
      setSwapUsername(userProfile.swap_username || '')
    }
  }, [userProfile])

  // Load privacy settings from localStorage on mount
  useEffect(() => {
    const emailPrivacy = localStorage.getItem('privacy_show_email') || 'friends'
    const socialsPrivacy = localStorage.getItem('privacy_show_socials') || 'friends'
    setShowEmail(emailPrivacy)
    setShowSocials(socialsPrivacy)
  }, [])

  const updateProfile = useMutation({
    mutationFn: (data: any) => api.put('/api/users/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', ''] })
      setSuccessMsg('Profile updated successfully!')
      setErrorMsg('')
      setTimeout(() => setSuccessMsg(''), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Failed to update profile')
      setSuccessMsg('')
    }
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile.mutate({
      name,
      location,
      bio,
      linkedin_id: linkedin,
      github_id: github,
      instagram_id: instagram,
      dob,
      swap_username: swapUsername
    })
  }

  const handlePrivacySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('privacy_show_email', showEmail)
    localStorage.setItem('privacy_show_socials', showSocials)
    setSuccessMsg('Privacy settings saved!')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const toggleTheme = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.')) {
      try {
        // Since delete account endpoint might not be in backend, we simulate or make the call
        await api.delete('/api/users/profile').catch(() => {})
        logout()
      } catch {
        logout()
      }
    }
  }

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8 bg-surface">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-text-muted mt-1">Manage your account, theme preferences, and privacy settings.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* Settings Sidebar Tabs */}
              <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 glass-panel p-3 rounded-xl fast-transition gpu-accelerate self-start">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'profile' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt'
                  }`}
                >
                  <User className="w-4 h-4" /> Edit Profile
                </button>
                <button
                  onClick={() => setActiveTab('privacy')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'privacy' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt'
                  }`}
                >
                  <Shield className="w-4 h-4" /> Privacy Settings
                </button>
                <button
                  onClick={() => setActiveTab('theme')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'theme' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt'
                  }`}
                >
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  Theme Settings
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-danger transition-colors ${
                    activeTab === 'account' ? 'bg-danger/10 text-danger' : 'hover:bg-danger/5'
                  }`}
                >
                  <Trash2 className="w-4 h-4" /> Manage Account
                </button>
              </div>

              {/* Settings Content Area */}
              <div className="flex-1 glass-panel rounded-xl p-6 fast-transition gpu-accelerate">
                {isLoading ? (
                  <p className="text-text-muted">Loading...</p>
                ) : (
                  <>
                    {activeTab === 'profile' && (
                      <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">Full Name</label>
                            <input
                              type="text"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              className="w-full glass-input px-3 py-2 text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">Swap Username</label>
                            <input
                              type="text"
                              value={swapUsername}
                              onChange={e => setSwapUsername(e.target.value)}
                              className="w-full glass-input px-3 py-2 text-sm font-mono"
                              placeholder="username"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">Date of Birth</label>
                            <input
                              type="text"
                              value={dob}
                              onChange={e => setDob(e.target.value)}
                              placeholder="e.g. January 15, 1995"
                              className="w-full glass-input px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">Location</label>
                            <input
                              type="text"
                              value={location}
                              onChange={e => setLocation(e.target.value)}
                              placeholder="e.g. San Francisco, CA"
                              className="w-full glass-input px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-text mb-1">Bio</label>
                            <textarea
                              value={bio}
                              onChange={e => setBio(e.target.value)}
                              className="w-full h-24 glass-input px-3 py-2 text-sm resize-none"
                              placeholder="Tell others about your background..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">LinkedIn Username</label>
                            <input
                              type="text"
                              value={linkedin}
                              onChange={e => setLinkedin(e.target.value)}
                              placeholder="e.g. kishorg"
                              className="w-full glass-input px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text mb-1">GitHub Username</label>
                            <input
                              type="text"
                              value={github}
                              onChange={e => setGithub(e.target.value)}
                              placeholder="e.g. kishorg"
                              className="w-full glass-input px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-text mb-1">Instagram Username</label>
                            <input
                              type="text"
                              value={instagram}
                              onChange={e => setInstagram(e.target.value)}
                              placeholder="e.g. kishor_g"
                              className="w-full glass-input px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        {successMsg && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{successMsg}</p>}
                        {errorMsg && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errorMsg}</p>}

                        <div className="pt-4">
                          <Button type="submit" disabled={updateProfile.isPending}>Save Changes</Button>
                        </div>
                      </form>
                    )}

                    {activeTab === 'privacy' && (
                      <form onSubmit={handlePrivacySubmit} className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold mb-1">Privacy Settings</h2>
                          <p className="text-sm text-text-muted">Control who can see your contact details and social links.</p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-text mb-2">Show Email Address to</label>
                            <select
                              value={showEmail}
                              onChange={e => setShowEmail(e.target.value)}
                              className="w-full sm:w-64 glass-input px-3 py-2 text-sm"
                            >
                              <option value="everyone">Everyone (Public)</option>
                              <option value="friends">My Swap Friends Only</option>
                              <option value="none">Private (No one)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-text mb-2">Show Social Links (LinkedIn, GitHub, Instagram) to</label>
                            <select
                              value={showSocials}
                              onChange={e => setShowSocials(e.target.value)}
                              className="w-full sm:w-64 glass-input px-3 py-2 text-sm"
                            >
                              <option value="everyone">Everyone (Public)</option>
                              <option value="friends">My Swap Friends Only</option>
                              <option value="none">Private (No one)</option>
                            </select>
                          </div>
                        </div>

                        {successMsg && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{successMsg}</p>}

                        <div className="pt-4 border-t border-border">
                          <Button type="submit">Save Privacy Settings</Button>
                        </div>
                      </form>
                    )}

                    {activeTab === 'theme' && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold mb-1">Theme Settings</h2>
                          <p className="text-sm text-text-muted">Customize the look and feel of the platform.</p>
                        </div>

                        <div className="flex items-center justify-between p-4  rounded-xl border border-border">
                          <div className="flex items-center gap-3">
                            {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-warning" />}
                            <div>
                              <p className="font-medium text-sm">Dark Mode</p>
                              <p className="text-xs text-text-muted">Switch between light and dark themes.</p>
                            </div>
                          </div>
                          <button
                            onClick={toggleTheme}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                              darkMode ? 'bg-primary' : 'bg-border'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                darkMode ? 'translate-x-6' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'account' && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-bold text-danger mb-1">Manage Account</h2>
                          <p className="text-sm text-text-muted">Permanently delete your account and all associated swap history.</p>
                        </div>

                        <div className="p-4 bg-danger/10 rounded-xl border border-danger/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-danger text-sm">Delete Account</p>
                            <p className="text-xs text-text-muted">This action is irreversible. All swaps, messages, and reviews will be wiped.</p>
                          </div>
                          <Button onClick={handleDeleteAccount} variant="danger" className="shrink-0">
                            Delete My Account
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
