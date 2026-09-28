import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'

export interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  colorClass?: string // e.g. 'text-primary bg-primary/10'
  trend?: string
  isUp?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  colorClass = 'text-primary bg-primary/10',
  trend,
  isUp = true
}: StatCardProps) {
  return (
    <div className="glass-card rounded-xl p-6 glass-interactive relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-text-muted font-medium mb-0.5">{label}</p>
          <p className="text-xl font-bold text-text leading-none">{value}</p>
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-auto">
          {isUp ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-danger" />}
          <span className={`text-[10px] font-medium ${isUp ? 'text-success' : 'text-danger'}`}>
            {trend} from last week
          </span>
        </div>
      )}
    </div>
  )
}
