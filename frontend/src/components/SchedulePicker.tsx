import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, ExternalLink, Check } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { SwapRequest } from '@/lib/types'

interface Props {
  swap: SwapRequest
}

export function SchedulePicker({ swap }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['session', swap.id],
    queryFn: () => api.get(`/api/swaps/${swap.id}/schedule`).then((r) => r.data.session),
    enabled: swap.status === 'accepted',
  })

  const propose = useMutation({
    mutationFn: (scheduledAt: string) =>
      api.post(`/api/swaps/${swap.id}/schedule`, { scheduled_at: scheduledAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', swap.id] })
      queryClient.invalidateQueries({ queryKey: ['swap', swap.id] })
      setShowForm(false)
    },
  })

  const confirmSession = useMutation({
    mutationFn: () => api.post(`/api/swaps/${swap.id}/schedule/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', swap.id] })
    },
  })

  const session = data
  const isProposer = session?.proposer_id === user?.id
  const canPropose = swap.status === 'accepted' && !session
  const canConfirm = session?.status === 'proposed' && !isProposer && swap.status === 'accepted'

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time) return
    const iso = new Date(`${date}T${time}`).toISOString()
    propose.mutate(iso)
  }

  if (isLoading) return null

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {session ? (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-text">{formatDate(session.scheduled_at)}</span>
            <Clock className="w-4 h-4 text-primary ml-1" />
            <span className="text-text">{formatTime(session.scheduled_at)}</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
              session.status === 'confirmed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}>
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {session.calendar_link && (
              <a href={session.calendar_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Calendar
              </a>
            )}
            {canConfirm && (
              <Button size="sm" variant="success" onClick={() => confirmSession.mutate()}>
                <Check className="w-3 h-3 mr-1" /> Confirm
              </Button>
            )}
          </div>
        </div>
      ) : canPropose ? (
        showForm ? (
          <form onSubmit={handlePropose} className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input px-2 py-1.5 text-sm"
              required
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="glass-input px-2 py-1.5 text-sm"
              required
            />
            <Button size="sm" type="submit" disabled={!date || !time}>
              Propose
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Calendar className="w-4 h-4 mr-1" /> Schedule Session
          </Button>
        )
      ) : null}
    </div>
  )
}
