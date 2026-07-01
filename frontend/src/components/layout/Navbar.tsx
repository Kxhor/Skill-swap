import { useNavigate } from 'react-router-dom'
import { Bell, MessageSquare, Menu } from 'lucide-react'
import { useSocket } from '@/context/SocketContext'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function Navbar() {
  const { notificationCount } = useSocket()
  const navigate = useNavigate()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread_chats_count'],
    queryFn: () => api.get('/api/swaps/unread-count').then(r => r.data.unread_chats_count)
  })

  const handleToggleSidebar = () => {
    window.dispatchEvent(new Event('toggleSidebar'))
  }

  return (
    <header className="h-16 border-b border-border/10 flex items-center justify-between px-6 shrink-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggleSidebar}
          className="md:hidden p-2 text-text-muted hover:text-text hover:bg-white/5 rounded-full fast-transition gpu-accelerate"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1" />

      <div className="flex items-center gap-4 ml-4">
        <button 
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-text-muted hover:text-text hover:bg-white/5 rounded-full fast-transition gpu-accelerate"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-transparent shadow-[0_0_8px_var(--color-primary)]" />
          )}
        </button>

        <button 
          onClick={() => navigate('/messages')}
          className="relative p-2 text-text-muted hover:text-text hover:bg-white/5 rounded-full fast-transition gpu-accelerate"
        >
          <MessageSquare className="w-5 h-5" />
          {/* Message badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-[0_2px_8px_rgba(139,92,246,0.4)] border-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
