import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Star, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function Reviews() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()

  const { data: userProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/profile').then(r => r.data.user)
  })

  const { data: swaps } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then((r) => r.data.swaps),
  })

  const { data: feedbackData } = useQuery({
    queryKey: ['feedback', me?.id],
    queryFn: () => api.get(`/api/feedback/${me?.id}`).then((r) => r.data),
    enabled: !!me?.id,
  })

  const submitFeedback = useMutation({
    mutationFn: (data: { swapId: string; rating: number; comment: string }) =>
      api.post(`/api/swaps/${data.swapId}/feedback`, { rating: data.rating, comment: data.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swaps'] })
      queryClient.invalidateQueries({ queryKey: ['feedback', me?.id] })
    },
  })

  const completedSwaps = swaps?.filter((s: any) => s.status === 'completed') || []
  const feedbackSubmitted = new Set(
    feedbackData?.given?.map((f: any) => f.swap_id) || []
  )

  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, number>>({})
  const [feedbackComments, setFeedbackComments] = useState<Record<string, string>>({})

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-text">My Reviews</h1>
              <p className="text-text-muted mt-1">Manage feedback from your completed swaps.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Needs Feedback Section */}
              <div className="glass-card rounded-xl p-6 self-start fast-transition gpu-accelerate">
                <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> Pending Feedback
                </h2>
                
                {completedSwaps.length === 0 || completedSwaps.every((s: any) => feedbackSubmitted.has(s.id)) ? (
                  <p className="text-sm text-text-muted py-4">No pending feedback to give.</p>
                ) : (
                  <div className="space-y-4">
                    {completedSwaps.filter((s:any) => !feedbackSubmitted.has(s.id)).map((swap: any) => (
                      <div key={swap.id} className="glass-card rounded-lg p-4">
                        <p className="text-sm font-medium text-text mb-3">
                          Swap with {swap.sender_id === me?.id ? swap.receiver?.name : swap.sender?.name}
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            const rating = feedbackRatings[swap.id]
                            const comment = feedbackComments[swap.id] || ''
                            if (rating) submitFeedback.mutate({ swapId: swap.id, rating, comment })
                          }}
                          className="flex flex-col gap-3"
                        >
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setFeedbackRatings({ ...feedbackRatings, [swap.id]: star })}
                                className="focus:outline-none"
                              >
                                <Star
                                  className={`w-6 h-6 ${(feedbackRatings[swap.id] || 0) >= star ? 'text-warning fill-warning' : 'text-border'}`}
                                />
                              </button>
                            ))}
                          </div>
                          <textarea
                            placeholder="How was the session?"
                            value={feedbackComments[swap.id] || ''}
                            onChange={(e) => setFeedbackComments({ ...feedbackComments, [swap.id]: e.target.value })}
                            className="w-full text-sm glass-input px-3 py-2 resize-none"
                            rows={3}
                          />
                          <Button size="sm" type="submit" disabled={!feedbackRatings[swap.id] || submitFeedback.isPending}>
                            Submit Feedback
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Received Feedback Section */}
              <div className="glass-card rounded-xl p-6 self-start fast-transition gpu-accelerate">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-text flex items-center gap-2">
                    <Star className="w-5 h-5 text-warning" /> Received Feedback
                  </h2>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-text">{userProfile?.average_rating ?? '—'}</div>
                    <div className="text-xs text-text-muted">{userProfile?.feedback_received_count ?? 0} reviews</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {!feedbackData?.received?.length ? (
                    <p className="text-sm text-text-muted py-4">No reviews received yet.</p>
                  ) : (
                    feedbackData.received.map((f: any) => (
                      <div key={f.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-text">{f.reviewer.name}</span>
                          <span className="text-xs text-text-muted">{formatDate(f.created_at)}</span>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${s <= f.rating ? 'text-warning fill-warning' : 'text-border'}`} />
                          ))}
                        </div>
                        {f.comment && <p className="text-sm text-text-muted">{f.comment}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
