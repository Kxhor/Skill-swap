import { useState, useEffect, useRef, useCallback } from 'react'
import api from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/utils'
import { Send } from 'lucide-react'

interface Props {
  swapId: string
  otherUserId?: string
  otherUserName?: string
}

interface Message {
  id: string
  swap_id: string
  sender_id: string | null
  content: string
  type: 'user' | 'system'
  created_at: string
}

export function ChatPanel({ swapId, otherUserId, otherUserName }: Props) {
  const { user } = useAuth()
  const { socket, isOnline } = useSocket()
  const [text, setText] = useState('')
  const [liveMessages, setLiveMessages] = useState<Message[]>([])
  const [typingUserId, setTypingUserId] = useState<string | null>(null)
  const typingUserIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: initialData, isLoading } = useQuery({
    queryKey: ['chat-messages', swapId],
    queryFn: () => api.get(`/api/swaps/${swapId}/messages`).then((r) => r.data.messages),
    enabled: !!swapId,
  })

  useEffect(() => {
    setLiveMessages([])
    setTypingUserId(null)
    typingUserIdRef.current = null
  }, [swapId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveMessages, initialData])

  useEffect(() => {
    if (!socket || !swapId) return

    const msgHandler = (msg: Message) => {
      if (msg.swap_id === swapId) {
        setLiveMessages((prev) => [...prev, msg])
      }
    }
    const typingHandler = (data: { user_id: string }) => {
      if (data.user_id !== user?.id) {
        typingUserIdRef.current = data.user_id
        setTypingUserId(data.user_id)
      }
    }
    const stoppedHandler = (data: { user_id: string }) => {
      if (data.user_id === typingUserIdRef.current) {
        typingUserIdRef.current = null
        setTypingUserId(null)
      }
    }

    socket.on('new_message', msgHandler)
    socket.on('user_typing', typingHandler)
    socket.on('user_stopped_typing', stoppedHandler)
    return () => {
      socket.off('new_message', msgHandler)
      socket.off('user_typing', typingHandler)
      socket.off('user_stopped_typing', stoppedHandler)
    }
  }, [socket, swapId, user?.id])

  const emitTyping = useCallback(() => {
    if (!socket) return
    socket.emit('typing', { swap_id: swapId })

    if (stoppedRef.current) clearTimeout(stoppedRef.current)
    stoppedRef.current = setTimeout(() => {
      socket.emit('stopped_typing', { swap_id: swapId })
    }, 500)
  }, [socket, swapId])

  const handleTextChange = useCallback((value: string) => {
    setText(value)

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => emitTyping(), 300)
  }, [emitTyping])

  const sendMessage = useCallback(() => {
    const content = text.trim()
    if (!content || !socket) return

    if (stoppedRef.current) clearTimeout(stoppedRef.current)
    socket.emit('stopped_typing', { swap_id: swapId })
    socket.emit('send_message', { swap_id: swapId, content })
    setText('')
  }, [text, socket, swapId])

  const messages: Message[] = [...(initialData || []), ...liveMessages]

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <p className="text-sm font-medium text-text">Chat</p>
        {otherUserId && (
          <span className={`w-2 h-2 rounded-full ${isOnline(otherUserId) ? 'bg-success' : 'bg-text-muted'}`} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && <p className="text-xs text-text-muted text-center">Loading...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-text-muted text-center">No messages yet</p>
        )}
        {messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id || `sys-${i}`} className="flex justify-center">
                <div className="bg-surface-alt/50 text-text-muted text-xs rounded-full px-3 py-1 max-w-[90%] text-center">
                  {msg.content}
                </div>
              </div>
            )
          }
          const mine = msg.sender_id === user?.id
          return (
            <div key={msg.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  mine
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-surface-alt text-text rounded-tl-sm'
                }`}
              >
                <p className="break-words">{msg.content}</p>
                <p className={`text-xs mt-0.5 ${mine ? 'text-white/70' : 'text-text-muted'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        {typingUserId && (
          <div className="flex justify-start">
            <div className="bg-surface-alt text-text-muted text-xs rounded-xl px-3 py-1.5 italic">
              {otherUserName || 'User'} is typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage() }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || !socket}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
