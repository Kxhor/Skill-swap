import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { ChatPanel } from '@/components/ChatPanel'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { MessageSquare } from 'lucide-react'

export default function Messages() {
  const { user } = useAuth()
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const queryClient = useQueryClient()

  const { data: swaps, isLoading } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then(r => r.data.swaps)
  })

  // We can chat on accepted and completed swaps
  let chatableSwaps = swaps?.filter((s: any) => s.status === 'accepted' || s.status === 'completed') || []
  
  if (showUnreadOnly) {
    chatableSwaps = chatableSwaps.filter((s: any) => s.unread_count > 0)
  }
  
  const selectedSwap = chatableSwaps.find((s: any) => s.id === selectedSwapId)
  const isSender = selectedSwap?.sender_id === user?.id
  const otherUser = isSender ? selectedSwap?.receiver : selectedSwap?.sender

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-hidden flex glass-card mr-6 mt-6 mb-6 rounded-[2.5rem] border border-border/50 shadow-2xl fast-transition gpu-accelerate">
          {/* Sidebar list of chats */}
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border -alt flex items-center justify-between">
              <h2 className="font-semibold text-text">Conversations</h2>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showUnreadOnly} 
                  onChange={(e) => setShowUnreadOnly(e.target.checked)} 
                  className="rounded border-border text-primary focus:ring-primary bg-surface"
                />
                Unread Only
              </label>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading && <p className="p-4 text-sm text-text-muted">Loading...</p>}
              {!isLoading && chatableSwaps.length === 0 && (
                <p className="p-4 text-sm text-text-muted text-center">No active conversations yet.</p>
              )}
              
              {chatableSwaps.map((swap: any) => {
                const isS = swap.sender_id === user?.id
                const other = isS ? swap.receiver : swap.sender
                const active = selectedSwapId === swap.id
                return (
                  <button
                    key={swap.id}
                    onClick={() => {
                      setSelectedSwapId(swap.id)
                      if (swap.unread_count > 0) {
                        api.post(`/api/swaps/${swap.id}/read`).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['swaps'] })
                          queryClient.invalidateQueries({ queryKey: ['unread_chats_count'] })
                        })
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      active ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {other.name.charAt(0)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className={`text-sm truncate flex justify-between items-center ${active ? 'font-semibold text-primary' : 'font-medium text-text'}`}>
                        {other.name}
                        {swap.unread_count > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                            {swap.unread_count}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-text-muted truncate">
                        Swap: {isS ? swap.offered_skill.skill_name : swap.wanted_skill.skill_name}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col -alt/30">
            {selectedSwapId && otherUser ? (
              <ChatPanel 
                swapId={selectedSwapId} 
                otherUserId={otherUser.id} 
                otherUserName={otherUser.name} 
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                <MessageSquare className="w-12 h-12 mb-4 text-border" />
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
