import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { BookOpen, GraduationCap, ArrowLeftRight, Star, Plus } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/api/users/profile').then((r) => r.data.user),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users?per_page=4').then((r) => r.data.users),
  })

  const offered = stats?.skills_offered || []
  const wanted = stats?.skills_wanted || []
  const avail = stats?.availability || []

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text">
                Welcome back, {user?.name}
              </h1>
              <p className="text-text-muted text-sm mt-1">
                Here's your learning overview
              </p>
            </div>
            <Button asChild>
              <Link to="/browse"><Plus className="w-4 h-4 mr-2" /> Find a Swap</Link>
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Skills Offered', value: offered.length, icon: BookOpen, color: 'text-primary bg-primary/10' },
              { label: 'Skills Wanted', value: wanted.length, icon: GraduationCap, color: 'text-secondary bg-secondary/10' },
              { label: 'Active Swaps', value: '—', icon: ArrowLeftRight, color: 'text-accent bg-accent/10' },
              { label: 'Rating', value: stats?.average_rating ?? '—', icon: Star, color: 'text-warning bg-warning/10' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-5">
                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-text">{value}</p>
                <p className="text-sm text-text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-border p-5 col-span-2">
              <h2 className="font-semibold text-text mb-4">My Skills</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Offered</p>
                  <div className="flex flex-wrap gap-2">
                    {offered.length === 0 && <p className="text-sm text-text-muted">No skills added yet</p>}
                    {offered.map((s: any) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        <BookOpen className="w-3 h-3" /> {s.skill_name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Wanted</p>
                  <div className="flex flex-wrap gap-2">
                    {wanted.length === 0 && <p className="text-sm text-text-muted">No skills added yet</p>}
                    {wanted.map((s: any) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 text-secondary rounded-full text-xs font-medium">
                        <GraduationCap className="w-3 h-3" /> {s.skill_name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-text mb-4">Availability</h2>
              {avail.length === 0 ? (
                <p className="text-sm text-text-muted">No availability set</p>
              ) : (
                <div className="space-y-2">
                  {avail.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium text-text">{a.day_of_week}</span>
                      <span className="text-text-muted">{a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {users && users.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold text-text mb-4">Discover Users</h2>
              <div className="grid grid-cols-4 gap-4">
                {users.map((u: any) => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.id}`}
                    className="bg-white rounded-xl border border-border p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mb-3">
                      {u.name.charAt(0)}
                    </div>
                    <p className="font-medium text-text text-sm">{u.name}</p>
                    <p className="text-xs text-text-muted">{u.location || '—'}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
