import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { ChatPanel } from '@/components/ChatPanel'
import { NotificationFeed } from '@/components/NotificationFeed'
import { SchedulePicker } from '@/components/SchedulePicker'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import {
  useSwaps, useAcceptSwap, useRejectSwap, useCancelSwap, useCompleteSwap,
} from '@/hooks/useSwaps'
import { formatDate } from '@/lib/utils'
import { Check, X, RotateCcw, ChevronRight } from 'lucide-react'

const tabs = ['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected']

export default function SwapRequests() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('all')
  const [selectedSwap, setSelectedSwap] = useState<string | null>(null)
  const { data, isLoading, isError } = useSwaps(tab)
  const acceptSwap = useAcceptSwap()
  const rejectSwap = useRejectSwap()
  const cancelSwap = useCancelSwap()
  const completeSwap = useCompleteSwap()

  useEffect(() => {
    if (!socket) return
    const handler = (ev: { swap_id: string; status: string; previous_status: string | null }) => {
      queryClient.setQueriesData({ queryKey: ['swaps'] }, (old: any) => {
        if (!old?.swaps) return old
        return {
          ...old,
          swaps: old.swaps.map((s: any) =>
            s.id === ev.swap_id ? { ...s, status: ev.status } : s,
          ),
        }
      })
    }
    socket.on('swap_status_changed', handler)
    return () => { socket.off('swap_status_changed', handler) }
  }, [socket, queryClient])

  const swaps: any[] = data?.swaps || []
  const selectedSwapData = swaps.find((s) => s.id === selectedSwap)
  const otherUserId = selectedSwapData
    ? (selectedSwapData.sender_id === user?.id ? selectedSwapData.receiver_id : selectedSwapData.sender_id)
    : undefined
  const otherUserName = selectedSwapData
    ? (selectedSwapData.sender_id === user?.id ? selectedSwapData.receiver?.name : selectedSwapData.sender?.name)
    : undefined

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      accepted: 'bg-primary/10 text-primary',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-surface-alt text-text-muted',
      rejected: 'bg-danger/10 text-danger',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-8">
          <h1 className="text-2xl font-bold text-text mb-6">Swap Requests</h1>

          <div className="flex gap-1 mb-6 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedSwap(null) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {isLoading && <p className="text-text-muted text-center py-8">Loading...</p>}
            {!isLoading && swaps.length === 0 && (
              <p className="text-text-muted text-center py-8">No swap requests found</p>
            )}
            {isError && <p className="text-text-muted text-center py-8">Failed to load data</p>}
            {swaps.map((swap: any) => {
              const isSender = swap.sender_id === user?.id
              const other = isSender ? swap.receiver : swap.sender
              return (
                <div
                  key={swap.id}
                  className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow cursor-pointer ${
                    selectedSwap === swap.id ? 'ring-2 ring-primary' : 'border-border'
                  }`}
                  onClick={() => setSelectedSwap(swap.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {other?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-text text-sm">
                          {isSender ? 'To: ' : 'From: '}{other?.name}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {swap.offered_skill?.skill_name} ↔ {swap.wanted_skill?.skill_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(swap.status)}
                      <span className="text-xs text-text-muted">{formatDate(swap.created_at)}</span>
                    </div>
                  </div>

                  {selectedSwap === swap.id && (
                    <div className="mt-4 pt-4 border-t border-border flex gap-2">
                      {swap.status === 'pending' && !isSender && (
                        <>
                          <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); acceptSwap.mutate(swap.id) }}>
                            <Check className="w-4 h-4 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); rejectSwap.mutate(swap.id) }}>
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {swap.status === 'pending' && isSender && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); cancelSwap.mutate(swap.id) }}>
                          <RotateCcw className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                      )}
                      {swap.status === 'accepted' && (
                        <>
                          <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); completeSwap.mutate(swap.id) }}>
                            <Check className="w-4 h-4 mr-1" /> Mark Complete
                          </Button>
                          <SchedulePicker swap={swap} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="w-96 border-l border-border bg-white flex flex-col">
          <NotificationFeed />
          <div className="flex-1 border-t border-border">
            {selectedSwap ? (
              <ChatPanel swapId={selectedSwap} otherUserId={otherUserId} otherUserName={otherUserName} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-text-muted p-4 text-center">
                <ChevronRight className="w-5 h-5 mr-1" /> Select a swap to view chat
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
