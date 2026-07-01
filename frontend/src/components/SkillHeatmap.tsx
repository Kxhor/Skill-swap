import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface SkillStat {
  skill: string
  count: number
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0c3fc']

export function SkillHeatmap() {
  const { data, isLoading } = useQuery({
    queryKey: ['skill-heatmap'],
    queryFn: () => api.get('/api/users/stats/community').then((r) => r.data.skill_summary),
    staleTime: 120_000,
  })

  if (isLoading) return <div className="h-48 bg-surface-alt rounded-xl animate-pulse" />

  const skills: SkillStat[] = (data || []).slice(0, 15)

  if (skills.length === 0) return <p className="text-sm text-text-muted">No skill data yet</p>

  const chartData = skills.map((s, i) => ({
    x: i,
    y: s.count,
    z: s.count * 2,
    name: s.skill,
    count: s.count,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis dataKey="count" tick={{ fontSize: 11 }} allowDecimals={false} />
          <ZAxis dataKey="z" range={[60, 400]} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="glass-panel rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.2)] px-3 py-2 text-xs">
                <p className="font-medium text-text">{d.name}</p>
                <p className="text-text-muted">{d.count} people offer this skill</p>
              </div>
            )
          }} />
          <Scatter data={chartData} shape="circle">
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
