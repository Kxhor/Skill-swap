import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import { ChatPanel } from '@/components/ChatPanel'
import { NotificationFeed } from '@/components/NotificationFeed'
import { SchedulePicker } from '@/components/SchedulePicker'
import { MatchScoreBadge } from '@/components/MatchScoreBadge'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import {
  useSwaps, useAcceptSwap, useRejectSwap, useCancelSwap, useCompleteSwap,
} from '@/hooks/useSwaps'
import { formatDate } from '@/lib/utils'
import { Check, X, RotateCcw, Plus, Star, ArrowLeftRight, MessageSquare, Clock, BookOpen, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const tabs = ['All Requests', 'Sent', 'Received', 'Completed']

export default function SwapRequests() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('All Requests')
  const [selectedSwap, setSelectedSwap] = useState<string | null>(null)
  
  // Map our UI tabs to API statuses if needed, but for now we fetch all and filter in frontend
  const { data, isLoading, isError } = useSwaps('all')
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

  const allSwaps: any[] = data?.swaps || []
  
  // Calculate counts for tabs
  const sentSwaps = allSwaps.filter(s => s.sender_id === user?.id)
  const receivedSwaps = allSwaps.filter(s => s.receiver_id === user?.id)
  const completedSwaps = allSwaps.filter(s => s.status === 'completed')

  const counts: Record<string, number> = {
    'All Requests': allSwaps.length,
    'Sent': sentSwaps.length,
    'Received': receivedSwaps.length,
    'Completed': completedSwaps.length,
  }

  // Filter swaps based on selected tab
  const displaySwaps = allSwaps.filter(s => {
    if (tab === 'All Requests') return true
    if (tab === 'Sent') return s.sender_id === user?.id
    if (tab === 'Received') return s.receiver_id === user?.id
    if (tab === 'Completed') return s.status === 'completed'
    return true
  })

  const selectedSwapData = displaySwaps.find((s) => s.id === selectedSwap)
  const otherUserId = selectedSwapData
    ? (selectedSwapData.sender_id === user?.id ? selectedSwapData.receiver_id : selectedSwapData.sender_id)
    : undefined
  const otherUserName = selectedSwapData
    ? (selectedSwapData.sender_id === user?.id ? selectedSwapData.receiver?.name : selectedSwapData.sender?.name)
    : undefined

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-success bg-success/10 border-success/20'
      case 'pending': return 'text-info bg-info/10 border-info/20'
      case 'in_progress': return 'text-warning bg-warning/10 border-warning/20'
      case 'completed': return 'text-text-muted bg-surface-alt border-border'
      default: return 'text-danger bg-danger/10 border-danger/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <Check className="w-3.5 h-3.5" />
      case 'pending': return <Clock className="w-3.5 h-3.5" />
      case 'in_progress': return <ArrowLeftRight className="w-3.5 h-3.5" />
      case 'completed': return <CheckCircle className="w-3.5 h-3.5" />
      default: return <X className="w-3.5 h-3.5" />
    }
  }
  


  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden p-8 border-r border-border ">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-2xl font-bold text-text">My Swap Requests</h1>
                <p className="text-sm text-text-muted mt-1">Manage your skill swap requests and track their progress</p>
              </div>
              <Button onClick={() => navigate('/browse')} variant="primary">
                <Plus className="w-4 h-4 mr-2" /> New Swap Request
              </Button>
            </div>

            <div className="flex gap-6 mb-6 border-b border-border mt-6">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSelectedSwap(null) }}
                  className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                    tab === t
                      ? 'border-b-2 border-primary text-primary'
                      : 'border-b-2 border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  {t}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${tab === t ? 'bg-primary/10 text-primary' : 'bg-surface-alt text-text-muted'}`}>
                    {counts[t]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {isLoading && <p className="text-text-muted text-center py-8">Loading...</p>}
              {!isLoading && displaySwaps.length === 0 && (
                <p className="text-text-muted text-center py-8">No swap requests found</p>
              )}
              {isError && <p className="text-text-muted text-center py-8">Failed to load data</p>}
              
              {displaySwaps.map((swap: any) => {
                const isSender = swap.sender_id === user?.id
                const other = isSender ? swap.receiver : swap.sender
                const isOnline = Math.random() > 0.5 // Mock online status for UI
                
                return (
                  <div
                    key={swap.id}
                    className={`glass-card rounded-xl p-6 glass-interactive cursor-pointer ${selectedSwap === swap.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedSwap(swap.id)}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left side: User info */}
                      <div className="flex items-center gap-3 w-1/4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {other?.name?.charAt(0)}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-success' : 'bg-text-muted'}`}></div>
                        </div>
                        <div>
                          <p className="font-bold text-text text-sm">{other?.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex items-center gap-1 text-[11px] text-warning font-medium">
                              <Star className="w-3 h-3 fill-warning" /> {other?.average_rating ? Number(other.average_rating).toFixed(1) : '4.5'}
                            </span>
                            <span className="text-[11px] text-text-muted">(14)</span>
                          </div>
                          <div className="mt-1">
                            <MatchScoreBadge userId={other?.id} />
                          </div>
                        </div>
                      </div>

                      {/* Middle: Skills exchange */}
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="flex items-center justify-between w-full max-w-sm relative">
                          <div className="flex flex-col items-start w-2/5">
                            <span className="text-[10px] text-text-muted uppercase font-semibold mb-1.5">Wants to learn</span>
                            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium w-full truncate">
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{swap.wanted_skill?.skill_name}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center w-1/5 absolute left-1/2 -translate-x-1/2 mt-4">
                            <div className="w-8 h-8 rounded-full -alt flex items-center justify-center text-text-muted border border-border">
                              <ArrowLeftRight className="w-4 h-4" />
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-start w-2/5 pl-4">
                            <span className="text-[10px] text-text-muted uppercase font-semibold mb-1.5">Offers</span>
                            <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-medium w-full truncate">
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{swap.offered_skill?.skill_name}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Status and Actions */}
                      <div className="flex flex-col items-end gap-3 w-1/4">
                        <div className="flex flex-col items-end">
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(swap.status)}`}>
                            {getStatusIcon(swap.status)}
                            {swap.status.charAt(0).toUpperCase() + swap.status.slice(1).replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-text-muted mt-1.5">{formatDate(swap.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button className="text-xs font-medium px-3 py-1.5 btn-glass btn-pill">
                            View Details
                          </button>
                          
                          {swap.status === 'pending' && isSender ? (
                            <button 
                              className="text-xs font-medium text-danger border border-danger/20 bg-danger/5 rounded-full px-3 py-1.5 hover:bg-danger hover:text-white fast-transition gpu-accelerate"
                              onClick={(e) => { e.stopPropagation(); cancelSwap.mutate(swap.id) }}
                            >
                              Cancel Request
                            </button>
                          ) : swap.status === 'completed' ? (
                            <button 
                              className="text-xs font-medium px-3 py-1.5 btn-white btn-pill"
                            >
                              Leave Review
                            </button>
                          ) : (
                            <button className="flex items-center gap-1.5 px-4 py-1.5 btn-purple btn-pill text-xs">
                              Message
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable actions if selected and needs action */}
                    {selectedSwap === swap.id && swap.status === 'pending' && !isSender && (
                      <div className="mt-4 pt-4 border-t border-border flex gap-2 justify-end">
                        <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); acceptSwap.mutate(swap.id) }}>
                          <Check className="w-4 h-4 mr-1" /> Accept Swap
                        </Button>
                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); rejectSwap.mutate(swap.id) }}>
                          <X className="w-4 h-4 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                    {selectedSwap === swap.id && swap.status === 'accepted' && (
                      <div className="mt-4 pt-4 border-t border-border flex gap-2 justify-end items-center">
                        <SchedulePicker swap={swap} />
                        <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); completeSwap.mutate(swap.id) }}>
                          <Check className="w-4 h-4 mr-1" /> Mark Complete
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
              
              <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border mt-4">
                <button className="flex items-center gap-1 hover:text-text"><RotateCcw className="w-3 h-3" /> Refresh Requests</button>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div> Real-time updates active</span>
              </div>
            </div>
          </div>

          <div className="w-[400px] flex flex-col shrink-0 ml-6 glass-card rounded-[2.5rem] overflow-hidden shadow-2xl h-[calc(100vh-2rem)] z-10 mt-4 mr-4">
            <div className="h-1/2 flex flex-col border-b border-border/50">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-text text-sm">Real-time Notifications</h2>
                <div className="flex items-center gap-1.5 text-[10px] text-success font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div> Live
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NotificationFeed />
              </div>
              <div className="p-3 border-t border-border">
                <button className="text-xs text-primary font-medium hover:underline flex items-center justify-center w-full">
                  View all notifications →
                </button>
              </div>
            </div>
            
            <div className="h-1/2 flex flex-col bg-transparent">
              {selectedSwap ? (
                <ChatPanel swapId={selectedSwap} otherUserId={otherUserId} otherUserName={otherUserName} />
              ) : (
                <>
                  <div className="p-4 border-b border-border">
                    <h2 className="font-bold text-text text-sm">Active Chat</h2>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-sm text-text-muted p-4 text-center gap-3">
                    <MessageSquare className="w-10 h-10 text-border" />
                    <p>Select a swap request on the left to view the conversation</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
