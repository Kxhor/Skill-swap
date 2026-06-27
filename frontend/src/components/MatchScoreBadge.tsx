import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Zap, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  showReason?: boolean
}

export function MatchScoreBadge({ userId, showReason = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['match-score', userId],
    queryFn: () => api.get(`/api/users/match/${userId}`).then((r) => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-text-muted" />

  const score = data?.score ?? 0

  const color =
    score >= 80 ? 'text-success bg-success/10'
      : score >= 50 ? 'text-primary bg-primary/10'
        : score >= 20 ? 'text-warning bg-warning/10'
          : 'text-text-muted bg-surface-alt'

  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color}`} title={showReason && data?.reason ? data.reason : undefined}>
      <Zap className="w-3 h-3" />
      Match {score}%
    </div>
  )
}
