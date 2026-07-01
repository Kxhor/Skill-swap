import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Sidebar } from '@/components/layout/Sidebar'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { Users, ArrowLeftRight, Star, BookOpen } from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']

export default function CommunityStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['community-stats'],
    queryFn: () => api.get('/api/users/stats/community').then((r) => r.data),
  })

  if (isError) return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted text-center py-8">Failed to load data</p></main>
    </div>
  )

  if (isLoading) return (
    <div className="flex h-screen p-4 md:p-6 gap-6 ">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-text-muted">Loading...</p></main>
    </div>
  )

  const stats = data

  const skillSummary = stats?.skill_summary || []
  const topSkills = [...skillSummary].sort((a: any, b: any) => b.count - a.count).slice(0, 8)

  const swapStatusData = [
    { name: 'Pending', value: stats?.pending_swaps || 0 },
    { name: 'Active', value: stats?.active_swaps || 0 },
    { name: 'Completed', value: stats?.completed_swaps || 0 },
  ].filter((d) => d.value > 0)

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? '—', icon: Users, color: 'text-primary bg-primary/10' },
    { label: 'Total Swaps', value: stats?.total_swaps ?? '—', icon: ArrowLeftRight, color: 'text-secondary bg-secondary/10' },
    { label: 'Avg Rating', value: stats?.average_rating ?? '—', icon: Star, color: 'text-warning bg-warning/10' },
    { label: 'Unique Skills', value: new Set(skillSummary.map((s: any) => s.skill)).size, icon: BookOpen, color: 'text-accent bg-accent/10' },
  ]

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 glass-panel rounded-3xl">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-text mb-6">Community Stats</h1>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card rounded-xl p-5 glass-interactive">
                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3 bg-white/10`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
                <p className="text-sm text-text-muted font-medium uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-text mb-4">Top Skills</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSkills} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-panel rounded-xl p-5 fast-transition gpu-accelerate hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
              <h2 className="font-semibold text-text mb-4">Swap Status Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={swapStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {swapStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
