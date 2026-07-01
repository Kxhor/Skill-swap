import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, Users, User, Shield, LogOut,
  BookOpen, MessageSquare, Calendar, Star, Settings, FileText, Activity, Megaphone,
  Compass, ChevronUp
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'

const userNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse Users', icon: Compass },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/skills', label: 'My Skills', icon: BookOpen },
  { to: '/swaps', label: 'Swap Requests', icon: ArrowLeftRight, hasBadge: true },
  { to: '/my-swaps', label: 'My Swaps', icon: ArrowLeftRight },
  { to: '/messages', label: 'Messages', icon: MessageSquare, hasBadge: true },
  { to: '/availability', label: 'Availability', icon: Calendar },
  { to: '/reviews', label: 'My Reviews', icon: Star },
]

const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: User },
  { to: '/admin/skills', label: 'Skills', icon: BookOpen },
  { to: '/admin/swaps', label: 'Swap Requests', icon: ArrowLeftRight, hasBadge: true },
  { to: '/admin/feedback', label: 'Feedback & Ratings', icon: Star },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/logs', label: 'Activity Logs', icon: Activity },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/manage', label: 'Manage Admins', icon: Shield },
]

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth()
  const { notificationCount } = useSocket()
  const location = useLocation()
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggleSidebar', handleToggle)
    return () => window.removeEventListener('toggleSidebar', handleToggle)
  }, [])

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Choose which nav list to render
  const navItems = isAdmin ? adminNavItems : userNavItems

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside className={cn(
        "w-64 glass-panel rounded-[2rem] flex flex-col shrink-0 overflow-hidden shadow-2xl relative z-40 fast-transition",
        "fixed inset-y-4 left-4 md:relative md:inset-auto md:left-auto",
        isOpen ? "translate-x-0" : "-translate-x-[150%] md:translate-x-0"
      )}>
        <div className="p-6 border-b border-border/50 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center">
          <img src="/logo.svg" alt="SkillSwap" className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Skill Swap</h1>
          {isAdmin && <p className="text-[10px] uppercase font-bold text-text-muted">Admin Panel</p>}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, hasBadge }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium fast-transition gpu-accelerate',
                isActive
                  ? 'glass-pill-active text-white'
                  : 'text-text-muted hover:bg-white/5 hover:text-text',
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
              {hasBadge && notificationCount > 0 && (
                <span className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center border-none shadow-[0_2px_8px_rgba(139,92,246,0.3)]">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/10">
        <div className="relative" ref={dropdownRef}>
          {isDropdownOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full glass-card overflow-hidden z-50 gpu-accelerate shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <Link to="/profile" className="block px-4 py-2.5 text-sm text-text hover:bg-white/10 fast-transition" onClick={() => setIsDropdownOpen(false)}>My Profile</Link>
              <Link to="/settings" className="block px-4 py-2.5 text-sm text-text hover:bg-white/10 fast-transition" onClick={() => setIsDropdownOpen(false)}>Settings</Link>
              <div className="h-px bg-border/50 my-1" />
              <button 
                onClick={() => { setIsDropdownOpen(false); logout(); }} 
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 fast-transition"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-full hover:bg-white/5 fast-transition gpu-accelerate focus:outline-none"
          >
            {user?.photo_url ? (
              <img 
                src={user.photo_url} 
                alt={user.name} 
                className="w-10 h-10 rounded-full object-cover border border-border/50 shadow-[0_0_10px_rgba(0,0,0,0.3)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shadow-[0_0_10px_var(--color-glass-accent-light)]">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-text truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-text-muted mt-0.5 leading-none">{(user as any)?.role === 'admin' ? 'Admin Account' : 'Personal account'}</p>
            </div>
            <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}

