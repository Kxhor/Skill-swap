import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { Calendar, Plus, X } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function Availability() {
  const queryClient = useQueryClient()
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/profile').then(r => r.data.user)
  })

  const [showAvailability, setShowAvailability] = useState(false)
  const [availDay, setAvailDay] = useState('monday')
  const [availStart, setAvailStart] = useState('09:00')
  const [availEnd, setAvailEnd] = useState('17:00')
  const [availError, setAvailError] = useState('')

  const addAvailability = useMutation({
    mutationFn: () =>
      api.post('/api/users/availability', {
        slots: [{ day_of_week: availDay, start_time: availStart, end_time: availEnd }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setShowAvailability(false)
      setAvailError('')
    },
    onError: (err: any) => {
      setAvailError(err.response?.data?.error || 'Failed to add availability slot')
    },
  })

  const removeAvailability = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/availability/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text">Availability</h1>
              <p className="text-text-muted mt-1">Set the times you are available for skill swapping sessions.</p>
            </div>

            <div className="glass-card rounded-xl p-6 fast-transition gpu-accelerate">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-text flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Weekly Schedule
                </h2>
                {!showAvailability && (
                  <Button size="sm" onClick={() => setShowAvailability(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Add Slot
                  </Button>
                )}
              </div>

              {showAvailability && (
                <form
                  onSubmit={(e) => { e.preventDefault(); addAvailability.mutate() }}
                  className="flex gap-2 mb-4 p-4 glass-card"
                >
                  <select
                    value={availDay}
                    onChange={(e) => setAvailDay(e.target.value)}
                    className="flex-1 glass-input px-3 py-2 text-sm"
                  >
                    {DAYS.map(d => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                  <input type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)} className="glass-input px-3 py-2 text-sm" required />
                  <input type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} className="glass-input px-3 py-2 text-sm" required />
                  <Button type="submit" disabled={addAvailability.isPending}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAvailability(false)}>Cancel</Button>
                </form>
              )}
              {availError && (
                <p className="text-xs text-danger mb-4 bg-red-50 rounded p-2">{availError}</p>
              )}

              {isLoading ? (
                <p className="text-text-muted">Loading...</p>
              ) : (
                <div className="space-y-3">
                  {(userProfile?.availability || []).length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-text-muted">No availability slots set.</p>
                    </div>
                  )}
                  {(userProfile?.availability || []).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 glass-interactive rounded-lg">
                      <span className="capitalize font-medium text-text w-32">{a.day_of_week}</span>
                      <div className="flex-1 text-text-muted">
                        {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                      </div>
                      <button 
                        onClick={() => removeAvailability.mutate(a.id)} 
                        className="text-text-muted hover:text-danger p-2 rounded-md hover:bg-danger/10 transition-colors"
                        title="Remove slot"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
