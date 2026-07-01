import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Users, MessageSquare, User, Star, Check, X } from 'lucide-react'

export default function Friends() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: followRequests = [] } = useQuery({
    queryKey: ['follow-requests'],
    queryFn: () => api.get('/api/users/follow-requests').then(r => r.data.requests)
  })

  const acceptRequest = useMutation({
    mutationFn: (userId: string) => api.post(`/api/users/${userId}/accept-follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
  })

  const rejectRequest = useMutation({
    mutationFn: (userId: string) => api.post(`/api/users/${userId}/reject-follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
  })

  const { data: swaps, isLoading: swapsLoading } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then(r => r.data.swaps)
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users?per_page=50').then(r => r.data.users)
  })

  // A "friend" is any user who has an accepted or completed swap with us
  const activeSwapUserIds = new Set<string>()
  const friendsList: any[] = []

  if (swaps && me) {
    swaps.forEach((swap: any) => {
      if (swap.status === 'accepted' || swap.status === 'completed') {
        const other = swap.sender_id === me.id ? swap.receiver : swap.sender
        if (other && !activeSwapUserIds.has(other.id)) {
          activeSwapUserIds.add(other.id)
          // Add swap id so we can link to the chat directly
          friendsList.push({ ...other, swapId: swap.id })
        }
      }
    })
  }

  // Suggestions are users we don't have an active/completed swap with
  const suggestions = (users || []).filter(
    (u: any) => u.id !== me?.id && !activeSwapUserIds.has(u.id)
  )

  const isLoading = swapsLoading || usersLoading

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-10">
            <div>
              <h1 className="text-2xl font-bold">Friends</h1>
              <p className="text-text-muted mt-1">Connect with your skill swap partners and discover new connections.</p>
            </div>

            {isLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* My Friends List */}
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-primary" /> My Swap Friends ({friendsList.length})
                  </h2>

                  {friendsList.length === 0 ? (
                    <div className="text-center py-12 glass-panel rounded-xl fast-transition gpu-accelerate">
                      <Users className="w-12 h-12 text-border mx-auto mb-4" />
                      <p className="text-text-muted">No friends yet. Complete a swap to build your network!</p>
                      <Button onClick={() => navigate('/browse')} className="mt-4" size="sm">
                        Browse Users
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {friendsList.map((friend) => (
                        <div key={friend.id} className="glass-card p-5 rounded-xl flex flex-col justify-between fast-transition gpu-accelerate hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
                          <div className="flex items-center gap-4 mb-4">
                            {friend.photo_url ? (
                              <img src={friend.photo_url} alt={friend.name} className="w-12 h-12 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                {friend.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-text">{friend.name}</h4>
                              <p className="text-xs text-text-muted">@{friend.swap_username || 'username'}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                                <span className="text-xs font-medium">{friend.average_rating ?? '—'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 border-t border-border/40 pt-4 mt-auto">
                            <Button 
                              onClick={() => navigate(`/profile/${friend.id}`)}
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                            >
                              <User className="w-4 h-4 mr-1.5" /> Profile
                            </Button>
                            <Button 
                              onClick={() => navigate('/messages')}
                              variant="primary"
                              size="sm" 
                              className="flex-1"
                            >
                              <MessageSquare className="w-4 h-4 mr-1.5" /> Message
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggestions List & Follow Requests */}
                <div className="space-y-6">
                  
                  {followRequests.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold">Follow Requests</h2>
                      <div className="glass-card rounded-xl p-4 divide-y divide-border/50 fast-transition gpu-accelerate">
                        {followRequests.map((r: any) => (
                          <div key={r.id} className="py-4 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {r.photo_url ? (
                                <img src={r.photo_url} alt={r.name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                  {r.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm text-text truncate">{r.name}</h4>
                                <p className="text-xs text-text-muted truncate">@{r.swap_username}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="default" className="w-8 h-8 rounded-full" onClick={() => acceptRequest.mutate(r.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="outline" className="w-8 h-8 rounded-full text-danger border-danger/20 hover:bg-danger/10" onClick={() => rejectRequest.mutate(r.id)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h2 className="text-lg font-bold">Discover Connections</h2>
                    <div className="glass-card rounded-xl p-4 divide-y divide-border/50 fast-transition gpu-accelerate">
                    {suggestions.slice(0, 5).map((s: any) => (
                      <div key={s.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {s.photo_url ? (
                            <img src={s.photo_url} alt={s.name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-medium text-sm text-text truncate">{s.name}</h4>
                            <p className="text-xs text-text-muted truncate">
                              Offers: {s.skills_offered?.[0]?.skill_name || 'No skills'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => navigate(`/profile/${s.id}`)}
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-primary shrink-0"
                        >
                          View
                        </Button>
                      </div>
                    ))}
                    {suggestions.length === 0 && (
                      <p className="text-xs text-text-muted text-center py-4">No suggestions available.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  </div>
)
}
