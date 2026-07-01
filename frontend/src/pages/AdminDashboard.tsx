import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { 
  Users, BookOpen, ArrowLeftRight, Star, 
  CheckCircle, ArrowUpRight, ArrowDownRight, 
  Calendar as CalendarIcon, Check, X, Megaphone,
  FileText, Download, UserCog
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const mockLineData = [
  { name: 'May 21', newUsers: 80, swapRequests: 130, completedSwaps: 50 },
  { name: 'May 22', newUsers: 120, swapRequests: 150, completedSwaps: 100 },
  { name: 'May 23', newUsers: 130, swapRequests: 140, completedSwaps: 90 },
  { name: 'May 24', newUsers: 150, swapRequests: 180, completedSwaps: 110 },
  { name: 'May 25', newUsers: 140, swapRequests: 190, completedSwaps: 100 },
  { name: 'May 26', newUsers: 170, swapRequests: 210, completedSwaps: 130 },
  { name: 'May 27', newUsers: 180, swapRequests: 220, completedSwaps: 120 },
]

const mockPieData = [
  { name: 'Pending', value: 45, color: '#3b82f6' },
  { name: 'Accepted', value: 38, color: '#10b981' },
  { name: 'In Progress', value: 42, color: '#f59e0b' },
  { name: 'Completed', value: 31, color: '#8b5cf6' },
]

const mockTopSkills = [
  { name: 'Python Programming', users: 156, width: '100%', icon: BookOpen },
  { name: 'Web Development', users: 142, width: '90%', icon: BookOpen },
  { name: 'Data Structures', users: 98, width: '65%', icon: BookOpen },
  { name: 'UI/UX Design', users: 87, width: '55%', icon: BookOpen },
  { name: 'Machine Learning', users: 76, width: '45%', icon: BookOpen },
]

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const [usersPage, setUsersPage] = useState(1)
  const [swapsPage, setSwapsPage] = useState(1)

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ['adminUsers', usersPage],
    queryFn: () => api.get(`/api/admin/users?page=${usersPage}`).then(res => res.data),
  })

  const { data: swapsData, isLoading: swapsLoading, isError: swapsError } = useQuery({
    queryKey: ['adminSwaps', swapsPage],
    queryFn: () => api.get(`/api/admin/swaps?page=${swapsPage}`).then(res => res.data),
  })

  const { data: pendingSkillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['adminPendingSkills'],
    queryFn: () => api.get('/api/admin/skills?status=pending').then(res => res.data),
  })

  const approveSkill = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/skills/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPendingSkills'] })
    }
  })

  const rejectSkill = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/skills/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPendingSkills'] })
    }
  })

  const pendingApprovals = pendingSkillsData?.skills?.map((s: any) => ({
    id: s.id,
    item: s.name,
    type: 'Skill',
    by: 'User', // The API doesn't currently return who submitted it easily, we mock 'User'
    date: 'Recent',
  })) || []
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats').then((r) => r.data),
  })

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-primary bg-primary/10', trend: '+12.5%', isUp: true },
        { label: 'Active Users', value: Math.max(0, stats.total_users - 2), icon: UserCog, color: 'text-success bg-success/10', trend: '+8.3%', isUp: true },
        { label: 'Total Skills', value: 2341, icon: BookOpen, color: 'text-warning bg-warning/10', trend: '+15.7%', isUp: true },
        { label: 'Swap Requests', value: stats.total_swaps, icon: ArrowLeftRight, color: 'text-info bg-info/10', trend: '+18.6%', isUp: true },
        { label: 'Completed Swaps', value: stats.completed_swaps, icon: CheckCircle, color: 'text-primary bg-primary/10', trend: '+20.4%', isUp: true },
        { label: 'Average Rating', value: stats.average_rating, icon: Star, color: 'text-warning bg-warning/10', trend: '+2.1%', isUp: true },
      ]
    : []

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-text flex items-center gap-2">
                  Welcome back, Admin! <span className="text-2xl">👋</span>
                </h1>
                <p className="text-text-muted mt-1">
                  Here's what's happening on your platform today.
                </p>
              </div>
              <button className="flex items-center gap-2 glass-panel rounded-lg px-4 py-2 text-sm font-medium text-text hover:bg-surface-alt fast-transition gpu-accelerate">
                <CalendarIcon className="w-4 h-4 text-text-muted" />
                May 21, 2024 - May 27, 2024
              </button>
            </div>

            <div className="grid grid-cols-6 gap-4 mb-6">
              {cards.map(({ label, value, icon: Icon, color, trend, isUp }) => (
                <div key={label} className="glass-card rounded-xl p-6 glass-interactive relative overflow-hidden group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted font-medium mb-0.5">{label}</p>
                      <p className="text-xl font-bold text-text leading-none">{value}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-auto">
                    {isUp ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-danger" />}
                    <span className={`text-[10px] font-medium ${isUp ? 'text-success' : 'text-danger'}`}>{trend} from last week</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="glass-card rounded-xl overflow-hidden col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-text">Platform Overview</h2>
                  <select className="bg-surface border border-border rounded-lg text-sm px-3 py-1.5 focus:outline-none">
                    <option>Last 7 Days</option>
                  </select>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockLineData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Line type="monotone" name="New Users" dataKey="newUsers" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Swap Requests" dataKey="swapRequests" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Completed Swaps" dataKey="completedSwaps" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-5">
                <h2 className="font-bold text-text mb-6">Swap Requests Status</h2>
                <div className="h-[200px] flex justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mockPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {mockPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {mockPieData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <div>
                        <p className="text-xs font-medium text-text">{item.name}</p>
                        <p className="text-[10px] text-text-muted">{item.value} ({((item.value / 156) * 100).toFixed(1)}%)</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-bold text-text">Total: 156</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <h2 className="font-bold text-text text-sm">Pending Approvals</h2>
                  <div className="flex gap-4">
                    <button className="text-primary text-xs font-medium border-b-2 border-primary pb-2">Skills ({pendingApprovals.length})</button>
                    <button className="text-text-muted text-xs font-medium pb-2">Users (0)</button>
                  </div>
                </div>
                
                <table className="w-full text-left text-xs">
                  <thead className="text-text-muted border-b border-border">
                    <tr>
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Submitted By</th>
                      <th className="pb-2 font-medium">Submitted On</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillsLoading ? (
                      <tr><td colSpan={5} className="py-4 text-center text-text-muted">Loading...</td></tr>
                    ) : pendingApprovals.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-text-muted">No pending approvals</td></tr>
                    ) : (
                      pendingApprovals.map((app: any) => (
                        <tr key={app.id} className="border-b border-border last:border-0">
                          <td className="py-3 font-medium text-text">{app.item}</td>
                          <td className="py-3 text-info bg-info/10 px-2 rounded font-medium inline-block mt-2 mb-2 mr-2">{app.type}</td>
                          <td className="py-3 text-text-muted">{app.by}</td>
                          <td className="py-3 text-text-muted">{app.date}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => approveSkill.mutate(app.id)}
                                disabled={approveSkill.isPending}
                                className="w-6 h-6 rounded bg-success/10 flex items-center justify-center text-success hover:bg-success hover:text-white transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => rejectSkill.mutate(app.id)}
                                disabled={rejectSkill.isPending}
                                className="w-6 h-6 rounded bg-danger/10 flex items-center justify-center text-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="mt-4 text-center">
                  <button className="text-xs text-primary font-medium hover:underline">View all pending approvals →</button>
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-text text-sm">Top Skills</h2>
                  <button className="text-xs text-primary font-medium hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                  {mockTopSkills.map((skill, i) => (
                    <div key={skill.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted font-medium">{i + 1}.</span>
                          <span className="font-medium text-text">{skill.name}</span>
                        </div>
                        <span className="text-text-muted">{skill.users} users</span>
                      </div>
                      <div className="w-full -alt rounded-full h-1.5 ml-5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: skill.width }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <h2 className="font-bold text-text text-sm mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex flex-col items-center justify-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10 hover:bg-primary/10 transition-colors">
                    <Megaphone className="w-5 h-5 text-primary" />
                    <span className="text-xs font-medium text-primary">Add Announcement</span>
                  </button>
                  <button className="flex flex-col items-center justify-center gap-3 p-4 bg-success/5 rounded-lg border border-success/10 hover:bg-success/10 transition-colors">
                    <FileText className="w-5 h-5 text-success" />
                    <span className="text-xs font-medium text-success">Generate Report</span>
                  </button>
                  <button className="flex flex-col items-center justify-center gap-3 p-4 bg-info/5 rounded-lg border border-info/10 hover:bg-info/10 transition-colors">
                    <Download className="w-5 h-5 text-info" />
                    <span className="text-xs font-medium text-info">Export Data</span>
                  </button>
                  <button className="flex flex-col items-center justify-center gap-3 p-4 bg-warning/5 rounded-lg border border-warning/10 hover:bg-warning/10 transition-colors">
                    <UserCog className="w-5 h-5 text-warning" />
                    <span className="text-xs font-medium text-warning">Manage Users</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pagination Data Tables */}
            <div className="mt-6 flex flex-col gap-6">
              {/* Users Table */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <h2 className="font-bold text-text text-sm">All Users</h2>
                </div>
                {usersLoading ? (
                  <p className="text-text-muted text-sm py-4 text-center">Loading users...</p>
                ) : usersError ? (
                  <p className="text-danger text-sm py-4 text-center">Error loading users.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-text-muted border-b border-border">
                          <tr>
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2 font-medium">Email</th>
                            <th className="pb-2 font-medium">Joined</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersData?.users?.map((u: any) => (
                            <tr key={u.id} className="border-b border-border last:border-0">
                              <td className="py-3 font-medium text-text">{u.name}</td>
                              <td className="py-3 text-text-muted">{u.email}</td>
                              <td className="py-3 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                              <td className="py-3">
                                {u.is_banned ? (
                                  <span className="text-danger bg-danger/10 px-2 py-0.5 rounded font-medium">Banned</span>
                                ) : (
                                  <span className="text-success bg-success/10 px-2 py-0.5 rounded font-medium">Active</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {usersData?.pages > 1 && (
                      <div className="flex justify-between items-center mt-4 border-t border-border pt-4">
                        <span className="text-xs text-text-muted">Page {usersData.page} of {usersData.pages} (Total: {usersData.total})</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={usersData.page <= 1} onClick={() => setUsersPage(p => p - 1)}>Prev</Button>
                          <Button variant="outline" size="sm" disabled={usersData.page >= usersData.pages} onClick={() => setUsersPage(p => p + 1)}>Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Swaps Table */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                  <h2 className="font-bold text-text text-sm">Swap Requests</h2>
                </div>
                {swapsLoading ? (
                  <p className="text-text-muted text-sm py-4 text-center">Loading swaps...</p>
                ) : swapsError ? (
                  <p className="text-danger text-sm py-4 text-center">Error loading swaps.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-text-muted border-b border-border">
                          <tr>
                            <th className="pb-2 font-medium">ID</th>
                            <th className="pb-2 font-medium">Created</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {swapsData?.swaps?.map((s: any) => (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="py-3 font-medium text-text truncate max-w-[150px]">{s.id}</td>
                              <td className="py-3 text-text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded font-medium ${
                                  s.status === 'completed' ? 'text-success bg-success/10' :
                                  s.status === 'accepted' ? 'text-info bg-info/10' :
                                  'text-warning bg-warning/10'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {swapsData?.pages > 1 && (
                      <div className="flex justify-between items-center mt-4 border-t border-border pt-4">
                        <span className="text-xs text-text-muted">Page {swapsData.page} of {swapsData.pages} (Total: {swapsData.total})</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={swapsData.page <= 1} onClick={() => setSwapsPage(p => p - 1)}>Prev</Button>
                          <Button variant="outline" size="sm" disabled={swapsData.page >= swapsData.pages} onClick={() => setSwapsPage(p => p + 1)}>Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
