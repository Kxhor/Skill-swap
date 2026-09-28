import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { Users, ArrowLeftRight, Star, BookOpen } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/StatCard'
import { Skeleton } from '@/components/ui/skeleton'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']

export default function CommunityStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['community-stats'],
    queryFn: () => api.get('/api/users/stats/community').then((r) => r.data),
  })

  if (isError) return (
    <AppShell hideNavbar={true} mainClassName="flex-1 p-8"><p className="text-text-muted text-center py-8">Failed to load data</p></AppShell>
  )

  if (isLoading) return (
    <AppShell hideNavbar={true} mainClassName="flex-1 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="w-48 h-8 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </AppShell>
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
    <AppShell hideNavbar={true} mainClassName="flex-1 overflow-y-auto p-8 bg-surface rounded-3xl">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-text mb-6">Community Stats</h1>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {cards.map(({ label, value, icon: Icon, color }) => (
                <StatCard key={label} label={label} value={value} icon={Icon} colorClass={color} />
              ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface-alt border border-border rounded-xl p-5 shadow-sm">
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

            <div className="bg-surface-alt border border-border rounded-xl p-5 shadow-sm fast-transition gpu-accelerate hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)]">
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
      </AppShell>
  )
}

