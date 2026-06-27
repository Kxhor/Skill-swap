import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@/context/AuthContext'

const SOCKET_URL = ''

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
  notificationCount: number
  clearNotifications: () => void
  onlineUsers: Set<string>
  isOnline: (userId: string) => boolean
}

const SocketContext = createContext<SocketContextValue>({
  socket: null, connected: false, notificationCount: 0, clearNotifications: () => {},
  onlineUsers: new Set(), isOnline: () => false,
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setConnected(false)
      setNotificationCount(0)
      setOnlineUsers(new Set())
      return
    }

    const socket = io(SOCKET_URL, { withCredentials: true })
    socketRef.current = socket

    const onConnect = () => {
      setConnected(true)
      socket.emit('join', { room: `user_${user.id}` })
    }
    const onDisconnect = () => setConnected(false)
    const onReconnect = () => {
      setConnected(true)
      socket.emit('join', { room: `user_${user.id}` })
    }
    const onNotification = () => setNotificationCount((c) => c + 1)
    const onUserOnline = (data: { user_id: string }) => {
      if (data.user_id !== user.id) {
        setOnlineUsers((prev) => new Set(prev).add(data.user_id))
      }
    }
    const onUserOffline = (data: { user_id: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        next.delete(data.user_id)
        return next
      })
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('reconnect', onReconnect)
    socket.on('notification', onNotification)
    socket.on('user_online', onUserOnline)
    socket.on('user_offline', onUserOffline)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('reconnect', onReconnect)
      socket.off('notification', onNotification)
      socket.off('user_online', onUserOnline)
      socket.off('user_offline', onUserOffline)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
      setNotificationCount(0)
      setOnlineUsers(new Set())
    }
  }, [user?.id])

  const clearNotifications = useCallback(() => setNotificationCount(0), [])
  const isOnline = (userId: string) => onlineUsers.has(userId)

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, notificationCount, clearNotifications, onlineUsers, isOnline }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
