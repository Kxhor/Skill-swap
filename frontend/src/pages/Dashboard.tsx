import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { SwapRequestModal } from '@/components/SwapRequestModal'
import { User as UserIcon, BookOpen, ArrowLeftRight, Star, Plus } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [skillsTab, setSkillsTab] = useState<'offered' | 'wanted'>('offered')
  const [selectedUserForSwap, setSelectedUserForSwap] = useState<any>(null)

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/api/users/profile').then((r) => r.data.user),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users?per_page=4').then((r) => r.data.users),
  })

  const { data: swaps } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then((r) => r.data.swaps),
  })

  const offered = stats?.skills_offered || []
  const wanted = stats?.skills_wanted || []
  const avail = stats?.availability || []
  const activeSwapsCount = swaps?.filter((s: any) => s.status === 'accepted').length ?? 0

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-text flex items-center gap-2">
                  Welcome back, {user?.name}! <span className="text-2xl">👋</span>
                </h1>
                <p className="text-text-muted mt-1">
                  Ready to learn something new today?
                </p>
              </div>
              <Link to="/skills">
                <Button variant="primary">
                  <Plus className="w-4 h-4 mr-2" /> Add New Skill
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Skills Offered', value: offered.length, icon: UserIcon, color: 'text-primary bg-primary/10', link: '/skills' },
                { label: 'Skills Wanted', value: wanted.length, icon: BookOpen, color: 'text-success bg-success/10', link: '/skills' },
                { label: 'Active Swaps', value: activeSwapsCount, icon: ArrowLeftRight, color: 'text-info bg-info/10', link: '/my-swaps' },
                { label: 'Rating', value: `${stats?.average_rating ?? '0'}/5`, icon: Star, color: 'text-warning bg-warning/10', link: '/reviews' },
              ].map(({ label, value, icon: Icon, color, link }) => (
                <div key={label} className="glass-card rounded-xl p-5 flex flex-col glass-interactive">
                  <div className="flex flex-col mb-4">
                    <div className="flex items-start justify-between w-full mb-2">
                      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center bg-white/10`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
                    <p className="text-sm text-text-muted font-medium uppercase tracking-wider mt-1">{label}</p>
                  </div>
                  <Link to={link} className="text-sm text-primary font-medium hover:underline mt-auto">
                    {label === 'Rating' ? 'View reviews →' : 'View all →'}
                  </Link>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="glass-card rounded-xl p-6 col-span-2">
                <h2 className="text-lg font-bold text-text mb-4">My Skills</h2>
                <div className="flex gap-6 border-b border-border mb-6">
                  <button
                    onClick={() => setSkillsTab('offered')}
                    className={`pb-3 text-sm font-medium transition-colors ${
                      skillsTab === 'offered' ? 'border-b-2 border-primary text-primary' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Offered Skills
                  </button>
                  <button
                    onClick={() => setSkillsTab('wanted')}
                    className={`pb-3 text-sm font-medium transition-colors ${
                      skillsTab === 'wanted' ? 'border-b-2 border-primary text-primary' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Wanted Skills
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {(skillsTab === 'offered' ? offered : wanted).map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-alt">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm border border-border">
                        {skillsTab === 'offered' ? <BookOpen className="w-4 h-4" /> : <BookOpen className="w-4 h-4 text-success" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">{s.skill_name}</p>
                        <p className="text-xs text-text-muted capitalize">{s.proficiency}</p>
                      </div>
                    </div>
                  ))}
                  {(skillsTab === 'offered' ? offered : wanted).length === 0 && (
                    <p className="text-sm text-text-muted col-span-3">No skills added yet in this category.</p>
                  )}
                </div>
                <div className="mt-6">
                  <Link to="/skills" className="text-sm text-primary font-medium hover:underline">
                    View all skills →
                  </Link>
                </div>
              </div>

              <div className="glass-card rounded-xl p-6 flex flex-col">
                <h2 className="text-lg font-bold text-text mb-6">Availability This Week</h2>
                {avail.length === 0 ? (
                  <p className="text-sm text-text-muted flex-1">No availability set</p>
                ) : (
                  <div className="space-y-4 flex-1">
                    {['mon', 'tue', 'wed', 'thu', 'fri'].map(day => {
                      const dayAvail = avail.find((a: any) => a.day_of_week === day)
                      if (!dayAvail) return null
                      return (
                        <div key={day} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                            <span className="capitalize font-medium text-text">{day.substring(0, 3)}</span>
                          </div>
                          <span className="text-text-muted font-medium">
                            {parseInt(dayAvail.start_time.split(':')[0]) > 12 
                              ? `${parseInt(dayAvail.start_time.split(':')[0]) - 12}:${dayAvail.start_time.split(':')[1]} PM` 
                              : `${dayAvail.start_time.slice(0, 5)} ${parseInt(dayAvail.start_time.split(':')[0]) >= 12 ? 'PM' : 'AM'}`}
                            {' - '}
                            {parseInt(dayAvail.end_time.split(':')[0]) > 12 
                              ? `${parseInt(dayAvail.end_time.split(':')[0]) - 12}:${dayAvail.end_time.split(':')[1]} PM` 
                              : `${dayAvail.end_time.slice(0, 5)} ${parseInt(dayAvail.end_time.split(':')[0]) >= 12 ? 'PM' : 'AM'}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-6">
                  <Link to="/availability" className="text-sm text-primary font-medium hover:underline">
                    View full calendar →
                  </Link>
                </div>
              </div>
            </div>

            {users && users.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-text">Discover Users</h2>
                    <p className="text-sm text-text-muted">Find people with skills you want to learn</p>
                  </div>
                  <Link to="/browse" className="text-sm text-primary font-medium hover:underline">
                    View all users →
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-6">
                  {users.map((u: any) => (
                    <div key={u.id} className="glass-card p-5 flex flex-col h-full glass-interactive">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-text text-sm leading-tight">{u.name}</p>
                          <div className="flex items-center gap-1 text-xs text-warning mt-1">
                            <Star className="w-3.5 h-3.5 fill-warning" />
                            <span className="font-medium">{u.average_rating ? Number(u.average_rating).toFixed(1) : 'New'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-3 mb-5">
                        <div>
                          <p className="text-[10px] text-text-muted uppercase mb-1.5 font-semibold">Offers:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(u.skills_offered || []).slice(0, 3).map((s: any) => (
                              <span key={s.id} className="px-2 py-1 bg-surface-alt rounded text-[11px] text-text-muted whitespace-nowrap">
                                {s.skill_name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted uppercase mb-1.5 font-semibold">Wants to learn:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(u.skills_wanted || []).slice(0, 3).map((s: any) => (
                              <span key={s.id} className="px-2 py-1 bg-primary/10 text-primary rounded text-[11px] font-medium whitespace-nowrap">
                                {s.skill_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <Link to={`/profile/${u.id}`} className="flex items-center justify-center btn-purple text-white py-2 btn-pill text-xs">
                          View Profile
                        </Link>
                        <button onClick={() => setSelectedUserForSwap(u)} className="flex items-center justify-center btn-glass text-text py-2 btn-pill text-xs">
                          Send Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      {selectedUserForSwap && (
        <SwapRequestModal 
          targetUser={selectedUserForSwap} 
          onClose={() => setSelectedUserForSwap(null)} 
        />
      )}
    </div>
  )
}
