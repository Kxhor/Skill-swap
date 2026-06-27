import { useState, useEffect } from 'react'
import { useSocket } from '@/context/SocketContext'
import { Bell } from 'lucide-react'

interface Notification {
  type: string
  swap_id: string
  message: string
}

export function NotificationFeed() {
  const { socket, clearNotifications } = useSocket()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!socket) return

    const handler = (n: Notification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 20))
    }
    socket.on('notification', handler)
    return () => { socket.off('notification', handler) }
  }, [socket])

  useEffect(() => {
    clearNotifications()
  }, [clearNotifications])

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-text">Notifications</p>
      </div>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {notifications.length === 0 && (
          <p className="text-xs text-text-muted">No notifications</p>
        )}
        {notifications.map((n, i) => (
          <div key={`${n.type}-${n.swap_id}-${i}`} className="text-xs text-text-muted bg-surface-alt rounded-lg px-2 py-1.5">
            <p className="text-text">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
