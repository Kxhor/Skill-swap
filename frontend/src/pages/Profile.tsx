import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useAuth } from '@/context/AuthContext'
import { Plus, X, BookOpen, GraduationCap, Clock, Star } from 'lucide-react'

function SkillSection({
  title,
  skills,
  type,
  icon: Icon,
  color,
  isOwn,
}: {
  title: string
  skills: any[]
  type: 'offered' | 'wanted'
  icon: any
  color: string
  isOwn: boolean
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('beginner')

  const addSkill = useMutation({
    mutationFn: (data: { skill_name: string; proficiency_level: string }) =>
      api.post('/api/users/skills', { ...data, skill_type: type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setAdding(false)
      setName('')
    },
  })

  const removeSkill = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/skills/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} /> {title}
        </h2>
        {isOwn && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => { e.preventDefault(); addSkill.mutate({ skill_name: name, proficiency_level: level }) }}
          className="flex gap-2 mb-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Skill name"
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <Button size="sm" type="submit">Add</Button>
        </form>
      )}

      <div className="space-y-2">
        {skills.length === 0 && <p className="text-sm text-text-muted">None added</p>}
        {skills.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text">{s.skill_name}</span>
              <VerifiedBadge verifiedAt={s.verified_badge?.verified_at} verificationCount={s.verified_badge?.verification_count} />
              <span className={`px-1.5 py-0.5 rounded text-xs ${color}/10 ${color}`}>
                {s.proficiency_level}
              </span>
            </div>
            {isOwn && (
              <button onClick={() => removeSkill.mutate(s.id)} className="text-text-muted hover:text-danger cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Profile() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const isOwn = !id || id === me?.id
  const queryClient = useQueryClient()

  const profileId = isOwn ? '' : id

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: () =>
      api.get(profileId ? `/api/users/${profileId}` : '/api/users/profile').then((r) => r.data.user || r.data),
  })

  const [showAvailability, setShowAvailability] = useState(false)
  const [availDay, setAvailDay] = useState('monday')
  const [availStart, setAvailStart] = useState('09:00')
  const [availEnd, setAvailEnd] = useState('17:00')

  const addAvailability = useMutation({
    mutationFn: () =>
      api.post('/api/users/availability', {
        day_of_week: availDay,
        start_time: availStart,
        end_time: availEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setShowAvailability(false)
    },
  })

  const removeAvailability = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/availability/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  const [newMsgText, setNewMsgText] = useState('')
  const sendMessage = useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: string; content: string }) =>
      api.post('/api/feedback/message', { receiver_id: receiverId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      setNewMsgText('')
    },
  })

  const { data: completedSwaps } = useQuery({
    queryKey: ['completed-swaps-feedback'],
    queryFn: () => api.get('/api/swaps?tab=completed&per_page=50').then((r) => r.data.swaps || []),
    enabled: isOwn,
  })

  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set())
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, number>>({})
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({})

  const submitFeedback = useMutation({
    mutationFn: ({ swapId, rating, comment }: { swapId: string; rating: number; comment: string }) =>
      api.post('/api/feedback', { swap_id: swapId, rating, comment }),
    onSuccess: (_data, variables) => {
      setFeedbackSubmitted((prev) => new Set(prev).add(variables.swapId))
    },
    onError: (err: any, variables) => {
      if (err?.response?.status === 409) {
        setFeedbackSubmitted((prev) => new Set(prev).add(variables.swapId))
      }
    },
  })

  if (isLoading) return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted">Loading...</p></main>
    </div>
  )

  if (isError) return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted text-center py-8">Failed to load data</p></main>
    </div>
  )

  const p = data

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-border p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {p?.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-text">{p?.name}</h1>
                <p className="text-sm text-text-muted">{p?.location || 'No location'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 text-warning fill-warning" />
                  <span className="text-sm font-medium">{p?.average_rating ?? '—'}</span>
                  <span className="text-xs text-text-muted">({p?.feedback_received_count ?? 0} reviews)</span>
                </div>
                {p?.bio && <p className="text-sm text-text mt-2">{p.bio}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <SkillSection
              title="Skills Offered"
              skills={p?.skills_offered || []}
              type="offered"
              icon={BookOpen}
              color="text-primary"
              isOwn={isOwn}
            />
            <SkillSection
              title="Skills Wanted"
              skills={p?.skills_wanted || []}
              type="wanted"
              icon={GraduationCap}
              color="text-secondary"
              isOwn={isOwn}
            />
          </div>

          <div className="bg-white rounded-xl border border-border p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" /> Availability
              </h2>
              {isOwn && (
                <Button size="sm" variant="ghost" onClick={() => setShowAvailability(!showAvailability)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>

            {showAvailability && (
              <form
                onSubmit={(e) => { e.preventDefault(); addAvailability.mutate() }}
                className="flex gap-2 mb-3"
              >
                <select value={availDay} onChange={(e) => setAvailDay(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm">
                  {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((d) => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
                <input type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm" />
                <input type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm" />
                <Button size="sm" type="submit">Add</Button>
              </form>
            )}

            <div className="space-y-2">
              {(p?.availability || []).length === 0 && <p className="text-sm text-text-muted">No availability set</p>}
              {(p?.availability || []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize font-medium text-text">{a.day_of_week}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">{a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}</span>
                    {isOwn && (
                      <button onClick={() => removeAvailability.mutate(a.id)} className="text-text-muted hover:text-danger cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isOwn && completedSwaps && (completedSwaps as any[]).length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5 mb-6">
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
                            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                            rows={2}
                          />
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

          {!isOwn && (
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-text mb-4">Send a Message</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newMsgText.trim()) {
                    sendMessage.mutate({ receiverId: profileId!, content: newMsgText })
                  }
                }}
                className="flex gap-2"
              >
                <input
                  value={newMsgText}
                  onChange={(e) => setNewMsgText(e.target.value)}
                  placeholder="Write a message..."
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={500}
                />
                <Button type="submit" disabled={!newMsgText.trim()}>Send</Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
