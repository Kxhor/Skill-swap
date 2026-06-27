import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Shield, AlertTriangle, Ban, Trash2, Megaphone } from 'lucide-react'

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const [announcement, setAnnouncement] = useState('')

  const { data: stats, isError: statsError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats').then((r) => r.data),
  })

  const { data: users, isError: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/admin/users').then((r) => r.data.users),
  })

  const { data: swaps, isError: swapsError } = useQuery({
    queryKey: ['admin-swaps'],
    queryFn: () => api.get('/api/admin/swaps').then((r) => r.data.swaps),
  })

  const { data: feedback, isError: feedbackError } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () =>       api.get('/api/admin/feedback?per_page=20').then((r) => r.data.feedback),
  })

  const toggleBan = useMutation({
    mutationFn: ({ userId, isBanned }: { userId: string; isBanned: boolean }) =>
      isBanned
        ? api.post(`/api/admin/users/${userId}/unban`)
        : api.post(`/api/admin/users/${userId}/ban`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    },
  })

  const deleteSwap = useMutation({
    mutationFn: (swapId: string) => api.delete(`/api/admin/swaps/${swapId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-swaps'] }),
  })

  const deleteFeedback = useMutation({
    mutationFn: (fbId: string) => api.delete(`/api/admin/feedback/${fbId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })

  const sendAnnouncement = useMutation({
    mutationFn: (content: string) =>
      api.post('/api/admin/announcements', { title: 'Announcement', message: content }),
    onSuccess: () => {
      setAnnouncement('')
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
    },
  })

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.total_users, icon: Shield },
        { label: 'Total Swaps', value: stats.total_swaps, icon: Shield },
        { label: 'Active Swaps', value: stats.active_swaps, icon: Shield },
        { label: 'Pending Swaps', value: stats.pending_swaps, icon: Shield },
        { label: 'Completed Swaps', value: stats.completed_swaps, icon: Shield },
        { label: 'Avg Rating', value: stats.average_rating, icon: Shield },
      ]
    : []

  {statsError && <p className="text-text-muted text-center py-8">Failed to load data</p>}
  {usersError && <p className="text-text-muted text-center py-8">Failed to load data</p>}
  {swapsError && <p className="text-text-muted text-center py-8">Failed to load data</p>}
  {feedbackError && <p className="text-text-muted text-center py-8">Failed to load data</p>}

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-text">Admin Dashboard</h1>
          </div>

          <div className="grid grid-cols-6 gap-4 mb-8">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-4">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-xl font-bold text-text">{value}</p>
                <p className="text-xs text-text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-border p-5 mb-6">
            <h2 className="font-semibold text-text flex items-center gap-2 mb-4">
              <Megaphone className="w-4 h-4 text-primary" /> Announcement
            </h2>
            <form
              onSubmit={(e) => { e.preventDefault(); if (announcement.trim()) sendAnnouncement.mutate(announcement) }}
              className="flex gap-2"
            >
              <input
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Write an announcement..."
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button type="submit" disabled={!announcement.trim()}>Send</Button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
                <Ban className="w-4 h-4 text-danger" /> Users
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(users || []).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium text-text">{u.name}</span>
                      <span className="text-text-muted ml-2">({u.email})</span>
                      {u.is_banned && <AlertTriangle className="w-3.5 h-3.5 text-danger inline ml-1" />}
                    </div>
                    <Button size="sm" variant={u.is_banned ? 'success' : 'danger'} onClick={() => toggleBan.mutate({ userId: u.id, isBanned: u.is_banned })}>
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-danger" /> All Swaps
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(swaps || []).length === 0 && <p className="text-sm text-text-muted">No swaps found</p>}
                {(swaps || []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium text-text">{s.offered_skill?.skill_name} ↔ {s.wanted_skill?.skill_name}</span>
                      <span className="text-text-muted ml-2">{s.status}</span>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => deleteSwap.mutate(s.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> All Feedback
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(feedback || []).length === 0 && <p className="text-sm text-text-muted">No feedback found</p>}
                {(feedback || []).map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium text-text">{f.sender_name || 'Unknown'}</span>
                      <span className="text-text-muted ml-2">— "{f.content?.slice(0, 60)}"</span>
                      <span className="text-text-muted ml-2 text-xs">{formatDate(f.created_at)}</span>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => deleteFeedback.mutate(f.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
