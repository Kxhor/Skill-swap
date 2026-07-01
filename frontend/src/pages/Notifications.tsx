import { useQuery } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Bell, ArrowLeftRight, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function Notifications() {
  const { user } = useAuth()
  
  const { data: swaps, isLoading } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then(r => r.data.swaps)
  })

  // Aggregate pending requests directed at me, and recent status changes
  const notifications = (swaps || [])
    .filter((s: any) => {
      // Pending requests where I am the receiver
      if (s.status === 'pending' && s.receiver_id === user?.id) return true;
      // Requests I sent that were accepted/rejected
      if ((s.status === 'accepted' || s.status === 'rejected') && s.sender_id === user?.id) return true;
      return false;
    })
    .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text">Notifications</h1>
                <p className="text-text-muted mt-1">Stay updated on your swap requests and activity.</p>
              </div>
            </div>

            {isLoading && <p className="text-text-muted">Loading...</p>}
            
            {!isLoading && notifications.length === 0 && (
              <div className="text-center py-12 glass-panel rounded-xl fast-transition gpu-accelerate">
                <Bell className="w-12 h-12 text-border mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text">All caught up!</h3>
                <p className="text-text-muted max-w-sm mx-auto mt-2">
                  You have no new notifications right now.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {notifications.map((notif: any) => {

                let icon = <ArrowLeftRight className="w-5 h-5 text-info" />
                let title = ''
                let bg = 'bg-info/10 border-info/20 text-info'
                
                if (notif.status === 'pending') {
                  title = `${notif.sender.name} requested a swap`
                } else if (notif.status === 'accepted') {
                  title = `${notif.receiver.name} accepted your swap request`
                  icon = <CheckCircle className="w-5 h-5 text-success" />
                  bg = 'bg-success/10 border-success/20 text-success'
                } else if (notif.status === 'rejected') {
                  title = `${notif.receiver.name} declined your swap request`
                  icon = <XCircle className="w-5 h-5 text-danger" />
                  bg = 'bg-danger/10 border-danger/20 text-danger'
                }

                return (
                  <div key={`${notif.id}-${notif.status}`} className={`p-4 rounded-xl border flex items-start gap-4 glass-interactive ${bg}`}>
                    <div className="mt-0.5 glass-panel border border-border/50 p-2 rounded-full shadow-[0_0_10px_var(--color-glass-accent-light)]">
                      {icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text">{title}</h4>
                      <p className="text-sm text-text-muted mt-1">
                        They want to learn <strong>{notif.wanted_skill.skill_name}</strong> and can teach <strong>{notif.offered_skill.skill_name}</strong>.
                      </p>
                      <p className="text-xs text-text-muted mt-2">{formatDate(notif.updated_at)}</p>
                    </div>
                  </div>
                )
})}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
