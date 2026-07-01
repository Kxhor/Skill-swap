import { useQuery } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeftRight, CheckCircle, Clock } from 'lucide-react'


export default function MySwaps() {
  const { user } = useAuth()
  const { data: swaps, isLoading } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => api.get('/api/swaps').then(r => r.data.swaps)
  })

  const activeSwaps = swaps?.filter((s: any) => s.status === 'accepted' || s.status === 'completed') || []

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text">My Swaps</h1>
                <p className="text-text-muted mt-1">Your active and completed skill exchanges.</p>
              </div>
            </div>

            {isLoading && <p className="text-text-muted">Loading...</p>}
            {!isLoading && activeSwaps.length === 0 && (
              <div className="text-center py-12 glass-panel rounded-xl fast-transition gpu-accelerate">
                <ArrowLeftRight className="w-12 h-12 text-border mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text">No active swaps</h3>
                <p className="text-text-muted max-w-sm mx-auto mt-2">
                  When a swap request is accepted, it will appear here for you to schedule and complete.
                </p>
              </div>
            )}

            <div className="grid gap-4">
              {activeSwaps.map((swap: any) => {
                const isSender = swap.sender_id === user?.id
                const other = isSender ? swap.receiver : swap.sender
                const mySkill = isSender ? swap.offered_skill : swap.wanted_skill
                const theirSkill = isSender ? swap.wanted_skill : swap.offered_skill

                return (
                  <div key={swap.id} className="glass-card rounded-xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center fast-transition gpu-accelerate hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {other.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-text text-lg">Swap with {other.name}</h3>
                        <p className="text-sm text-text-muted flex items-center gap-2 mt-1">
                          <span>You teach: <strong className="text-text">{mySkill.skill_name}</strong></span>
                          <span className="text-border">•</span>
                          <span>They teach: <strong className="text-text">{theirSkill.skill_name}</strong></span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                        swap.status === 'completed' ? 'bg-success/20 text-success' : 'bg-info/20 text-info'
                      }`}>
                        {swap.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                      </div>
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
