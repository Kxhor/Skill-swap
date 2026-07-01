import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { Button } from '@/components/ui/button'
import { MatchScoreBadge } from '@/components/MatchScoreBadge'
import { SkillHeatmap } from '@/components/SkillHeatmap'
import { Search, BadgeCheck } from 'lucide-react'

export default function BrowseUsers() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [page, setPage] = useState(1)

  const { user: me } = useAuth()
  const { isOnline } = useSocket()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['browse-users', page, search, skillFilter],
    queryFn: () =>
      api
        .get('/api/users', {
          // Fixed: backend reads 'search', not 'q'
          params: { search: search || undefined, skill: skillFilter || undefined, page, per_page: 12 },
        })
        .then((r) => r.data),
  })

  const users: any[] = data?.users || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 12)

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-text mb-6">Browse Users</h1>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search by name or location..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full glass-input pl-10 pr-4 py-2.5 text-sm fast-transition gpu-accelerate"
              />
            </div>
            <input
              type="text"
              placeholder="Filter by skill..."
              value={skillFilter}
              onChange={(e) => { setSkillFilter(e.target.value); setPage(1) }}
              className="glass-input px-4 py-2.5 text-sm w-48 fast-transition gpu-accelerate"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {isLoading && <p className="col-span-3 text-text-muted text-center py-8">Loading...</p>}
            {!isLoading && users.length === 0 && (
              <p className="col-span-3 text-text-muted text-center py-8">No users found</p>
            )}
            {isError && <p className="col-span-3 text-text-muted text-center py-8">Failed to load data</p>}
            {users.map((u: any) => (
              <div key={u.id} className="glass-card rounded-xl p-6 glass-interactive relative group cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-12 h-12 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {u.name?.charAt(0)}
                    </div>
                    {me && u.id !== me.id && (
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline(u.id) ? 'bg-success' : 'bg-text-muted'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-text text-sm truncate">{u.name}</p>
                    <p className="text-xs text-text-muted truncate">{u.location || '—'}</p>
                    {me && u.id !== me.id && (
                      <div className="mt-1"><MatchScoreBadge userId={u.id} /></div>
                    )}
                  </div>
                </div>
                {u.skills_offered?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Offers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {u.skills_offered.slice(0, 3).map((s: any) => (
                        <span key={s.id} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs flex items-center gap-1">
                          {s.skill_name}
                          {s.is_verified && <BadgeCheck className="w-3 h-3 text-primary" />}
                        </span>
                      ))}
                      {u.skills_offered.length > 3 && (
                        <span className="px-2 py-0.5 bg-surface-alt text-text-muted rounded-full text-xs">
                          +{u.skills_offered.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {u.skills_wanted?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Wants</p>
                    <div className="flex flex-wrap gap-1.5">
                      {u.skills_wanted.slice(0, 3).map((s: any) => (
                        <span key={s.id} className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-full text-xs flex items-center gap-1">
                          {s.skill_name}
                          {s.is_verified && <BadgeCheck className="w-3 h-3 text-secondary" />}
                        </span>
                      ))}
                      {u.skills_wanted.length > 3 && (
                        <span className="px-2 py-0.5 bg-surface-alt text-text-muted rounded-full text-xs">
                          +{u.skills_wanted.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="font-semibold text-text mb-4">Skill Distribution</h2>
            <SkillHeatmap />
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  variant={n === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
