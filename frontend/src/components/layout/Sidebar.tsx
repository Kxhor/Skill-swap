import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, Users, User, BarChart3, Shield, LogOut,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/swaps', label: 'Swap Requests', icon: ArrowLeftRight },
  { to: '/browse', label: 'Browse Users', icon: Users },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/community', label: 'Community Stats', icon: BarChart3 },
]

export function Sidebar() {
  const { isAdmin, logout } = useAuth()
  const { notificationCount } = useSocket()

  return (
    <aside className="w-64 h-screen bg-white border-r border-border flex flex-col shrink-0">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Skill Swap</h1>
        <p className="text-xs text-text-muted mt-1">Peer-to-Peer Learning</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-surface-alt hover:text-text',
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
            {to === '/swaps' && notificationCount > 0 && (
              <span className="ml-auto bg-danger text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-surface-alt hover:text-text',
              )
            }
          >
            <Shield className="w-5 h-5" />
            Admin Dashboard
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-danger transition-colors w-full cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
