import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { SwapRequestModal } from '@/components/SwapRequestModal'
import { MatchScoreBadge } from '@/components/MatchScoreBadge'
import { SkillSection } from '@/components/SkillSection'
import { useAuth } from '@/context/AuthContext'
import { Clock, Star, ArrowLeftRight, Linkedin, Github, Instagram, Mail } from 'lucide-react'
export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const isOwn = !id || id === me?.id
  const queryClient = useQueryClient()
  const [showSwapModal, setShowSwapModal] = useState(false)

  const profileId = isOwn ? '' : id

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: () =>
      api.get(profileId ? `/api/users/${profileId}` : '/api/users/profile').then((r) => r.data.user || r.data),
  })

  const toggleFollow = useMutation({
    mutationFn: () => 
      data?.is_following 
        ? api.delete(`/api/users/${profileId}/follow`)
        : api.post(`/api/users/${profileId}/follow`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['profile', profileId] })
      const previousProfile = queryClient.getQueryData(['profile', profileId])
      queryClient.setQueryData(['profile', profileId], (old: any) => {
        if (!old) return old
        const newStatus = old.is_following ? false : 'pending'
        return {
          ...old,
          is_following: newStatus,
          followers_count: old.followers_count + (old.is_following ? -1 : 1)
        }
      })
      return { previousProfile }
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['profile', profileId], context?.previousProfile)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile', profileId] })
  })

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      return api.post('/api/users/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', profileId] }),
  })

  const deletePhoto = useMutation({
    mutationFn: () => api.delete('/api/users/photo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', profileId] }),
  })

  const { data: completedSwaps } = useQuery({
    queryKey: ['completed-swaps-feedback'],
    queryFn: () => api.get('/api/swaps?tab=completed&per_page=50').then((r) => r.data.swaps || []),
    enabled: isOwn,
  })

  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set())
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, number>>({})
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({})

  const [feedbackError, setFeedbackError] = useState<Record<string, string>>({})

  const submitFeedback = useMutation({
    mutationFn: ({ swapId, rating, comment }: { swapId: string; rating: number; comment: string }) =>
      api.post('/api/feedback', { swap_id: swapId, rating, comment }),
    onSuccess: (_data, variables) => {
      setFeedbackSubmitted((prev) => new Set(prev).add(variables.swapId))
      setFeedbackError((prev) => { const n = { ...prev }; delete n[variables.swapId]; return n })
    },
    onError: (err: any, variables) => {
      if (err?.response?.status === 409) {
        // Already submitted — mark as done silently
        setFeedbackSubmitted((prev) => new Set(prev).add(variables.swapId))
      } else {
        setFeedbackError((prev) => ({
          ...prev,
          [variables.swapId]: err.response?.data?.error || 'Failed to submit feedback',
        }))
      }
    },
  })

  if (isLoading) return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted">Loading...</p></main>
    </div>
  )

  if (isError) return (
    <div className="flex h-screen p-4 md:p-6 gap-6 ">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted text-center py-8">Failed to load data</p></main>
    </div>
  )

  const p = data

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadPhoto.mutate(e.target.files[0])
    }
  }

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 p-6">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 glass-panel rounded-3xl">
        <div className="max-w-4xl mx-auto">
          {/* Profile Card */}
          <div className="glass-card rounded-2xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-primary opacity-10"></div>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="flex flex-col items-center gap-3">
                {p?.photo_url ? (
                  <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
                    <img 
                      src={p.photo_url} 
                      alt={p.name} 
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary shadow-md pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-transparent z-10"></div>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-2 border-primary/20 shadow-inner">
                    {p?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                
                {isOwn && (
                  <div className="flex flex-col gap-1.5 items-center w-full">
                    <label className="cursor-pointer text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
                      Change Photo
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </label>
                    {p?.photo_url && (
                      <button 
                        onClick={() => deletePhoto.mutate()}
                        className="text-[10px] font-medium text-danger hover:underline"
                      >
                        Delete Photo
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-text flex items-center gap-2 justify-center md:justify-start">
                      {p?.name}
                    </h1>
                    <p className="text-sm text-text-muted mt-0.5">{p?.location || 'No location set'}</p>
                  </div>
                  {isOwn ? (
                    <Button onClick={() => navigate('/settings')} variant="outline" size="sm">
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => toggleFollow.mutate()} 
                        variant={p?.is_following ? "outline" : "secondary"} 
                        disabled={toggleFollow.isPending}
                      >
                        {p?.is_following === 'accepted' ? 'Unfollow' : p?.is_following === 'pending' ? 'Requested' : 'Follow'}
                      </Button>
                      <Button onClick={() => setShowSwapModal(true)} variant="primary">
                        <ArrowLeftRight className="w-4 h-4 mr-2" /> Request Swap
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2 justify-center md:justify-start">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-warning fill-warning" />
                    <span className="text-sm font-medium">{p?.average_rating ?? '—'}</span>
                    <span className="text-xs text-text-muted">({p?.feedback_received_count ?? 0} reviews)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <span><strong className="text-text">{p?.followers_count || 0}</strong> Followers</span>
                    <span><strong className="text-text">{p?.following_count || 0}</strong> Following</span>
                  </div>
                </div>

                {!isOwn && (
                  <div className="mt-3 flex justify-center md:justify-start">
                    <MatchScoreBadge userId={p?.id} showReason={true} />
                  </div>
                )}

                {p?.bio && (
                  <div className="mt-4 p-4 -alt rounded-xl border border-border/60 text-sm text-text">
                    <p className="font-semibold text-xs text-text-muted uppercase tracking-wider mb-1">About Me</p>
                    {p.bio}
                  </div>
                )}

                {/* Profile Details Grid */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/60 pt-6 text-sm text-left">
                  <div>
                    <span className="text-text-muted block text-xs font-semibold uppercase tracking-wider">Swap Username</span>
                    <span className="font-medium text-text">@{p?.swap_username || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-xs font-semibold uppercase tracking-wider">Unique Swap ID</span>
                    <span className="font-medium text-text select-all">{p?.swap_id || 'Not set'}</span>
                  </div>
                  
                  {!isOwn && !p?.email && !p?.dob && (
                    <div className="sm:col-span-2 text-center py-2 px-4 bg-primary/5 rounded-lg border border-primary/10 mt-2">
                      <p className="text-xs font-medium text-primary">Private details hidden. Follow this user to see more.</p>
                    </div>
                  )}
                  {p?.email && (
                    <div>
                      <span className="text-text-muted block text-xs font-semibold uppercase tracking-wider mb-2">Email Address</span>
                      {isOwn ? (
                        <span className="font-medium text-text">{p.email}</span>
                      ) : (
                        <a href={`mailto:${p.email}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary font-medium rounded-lg hover:bg-primary/20 transition-colors text-sm">
                          <Mail className="w-4 h-4" /> Drop a mail
                        </a>
                      )}
                    </div>
                  )}
                  {p?.dob && (
                    <div>
                      <span className="text-text-muted block text-xs font-semibold uppercase tracking-wider mb-1">Date of Birth</span>
                      <span className="font-medium text-text">{p?.dob}</span>
                    </div>
                  )}
                </div>
                  
                {/* Socials */}
                <div className="flex gap-4 border-t border-border/40 pt-4 mt-4">
                  {p?.linkedin_id && (
                    <a href={`https://linkedin.com/in/${p.linkedin_id}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors shadow-sm" title="LinkedIn">
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                  {p?.github_id && (
                    <a href={`https://github.com/${p.github_id}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-text hover:bg-text hover:text-surface transition-colors shadow-sm" title="GitHub">
                      <Github className="w-5 h-5" />
                    </a>
                  )}
                  {p?.instagram_id && (
                    <a href={`https://instagram.com/${p.instagram_id}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-pink-500 hover:bg-pink-500 hover:text-white transition-colors shadow-sm" title="Instagram">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Skills (Read-Only on Profile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <SkillSection
              title="Skills Offered"
              skills={p?.skills_offered || []}
              type="offered"
              isOwn={false}
            />
            <SkillSection
              title="Skills Wanted"
              skills={p?.skills_wanted || []}
              type="wanted"
              isOwn={false}
            />
          </div>

          {/* Availability (Read-Only on Profile) */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Availability Schedule
              </h2>
              {isOwn && (
                <Button size="sm" variant="outline" onClick={() => navigate('/availability')}>
                  Manage Schedule
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {(p?.availability || []).length === 0 && (
                <p className="text-sm text-text-muted py-2">No availability set.</p>
              )}
              {(p?.availability || []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="capitalize font-medium text-text">{a.day_of_week}</span>
                  <span className="text-text-muted font-mono">{a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          </div>

          {isOwn && completedSwaps && (completedSwaps as any[]).length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-warning" /> Leave Feedback
              </h2>
              <div className="space-y-4">
                {(completedSwaps as any[]).map((swap: any) => {
                  const alreadyDone = feedbackSubmitted.has(swap.id)
                  return (
                    <div key={swap.id} className="border border-border rounded-lg p-3">
                      <p className="text-sm font-medium text-text mb-2">
                        Swap with {swap.sender_id === me?.id ? swap.receiver?.name : swap.sender?.name}
                      </p>
                      {alreadyDone ? (
                        <p className="text-xs text-text-muted">Feedback submitted</p>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            const rating = feedbackRatings[swap.id]
                            const comment = feedbackComments[swap.id] || ''
                            if (rating) {
                              submitFeedback.mutate({ swapId: swap.id, rating, comment })
                            }
                          }}
                          className="flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setFeedbackRatings((r) => ({ ...r, [swap.id]: star }))}
                                className="cursor-pointer"
                              >
                                <Star
                                  className={`w-5 h-5 ${
                                    (feedbackRatings[swap.id] || 0) >= star
                                      ? 'text-warning fill-warning'
                                      : 'text-text-muted'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <textarea
                            placeholder="Comment (optional)"
                            value={feedbackComments[swap.id] || ''}
                            onChange={(e) => setFeedbackComments((c) => ({ ...c, [swap.id]: e.target.value }))}
                            maxLength={2000}
                            className="glass-input px-3 py-2 text-sm w-full resize-none"
                            rows={2}
                          />
                          {feedbackError[swap.id] && (
                            <p className="text-xs text-danger bg-red-50 rounded px-2 py-1">
                              {feedbackError[swap.id]}
                            </p>
                          )}
                          <Button
                            size="sm"
                            type="submit"
                            disabled={!feedbackRatings[swap.id] || submitFeedback.isPending}
                          >
                            Submit Feedback
                          </Button>
                        </form>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      {showSwapModal && (
        <SwapRequestModal 
          targetUser={p} 
          onClose={() => setShowSwapModal(false)} 
        />
      )}
    </div>
  )
}
