import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCreateSwap } from '@/hooks/useSwaps'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { X, ArrowLeftRight } from 'lucide-react'

export function SwapRequestModal({ targetUser, onClose }: { targetUser: any, onClose: () => void }) {
  const { user: me } = useAuth()
  const createSwap = useCreateSwap()
  
  const { data: myProfile } = useQuery({
    queryKey: ['profile', me?.id],
    queryFn: () => api.get('/api/users/profile').then(r => r.data.user)
  })

  console.log("SwapRequestModal Rendered!", { targetUser, myProfile });

  const [offeredSkillId, setOfferedSkillId] = useState('')
  const [wantedSkillId, setWantedSkillId] = useState('')
  const [error, setError] = useState('')

  const mySkills = myProfile?.skills_offered || []
  const theirSkills = targetUser?.skills_offered || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!offeredSkillId || !wantedSkillId) {
      setError('Please select both skills')
      return
    }
    
    createSwap.mutate({
      receiver_id: targetUser.id,
      offered_skill_id: offeredSkillId,
      wanted_skill_id: wantedSkillId
    }, {
      onSuccess: () => {
        alert('Swap request sent successfully!')
        onClose()
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || 'Failed to send request')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="glass-card max-w-md w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" /> Request Swap
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-text-muted mb-4">
            Propose a skill exchange with <span className="font-semibold text-text">{targetUser.name}</span>.
          </p>

          {theirSkills.length === 0 && (
            <div className="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-lg border border-yellow-200">
              <span className="font-semibold">{targetUser.name}</span> hasn't added any skills to offer yet. You can only request a swap if they offer at least one skill.
            </div>
          )}

          {mySkills.length === 0 && (
            <div className="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-lg border border-yellow-200">
              You haven't added any skills to offer yet! Please go to your Profile to add skills you can teach.
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">What you want to learn</label>
            <select 
              value={wantedSkillId}
              onChange={e => setWantedSkillId(e.target.value)}
              className="w-full glass-input px-3 py-2 text-sm"
            >
              <option value="">Select a skill...</option>
              {theirSkills.map((s: any) => (
                <option key={s.id} value={s.id}>{s.skill_name} ({s.proficiency})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">What you can offer</label>
            <select 
              value={offeredSkillId}
              onChange={e => setOfferedSkillId(e.target.value)}
              className="w-full glass-input px-3 py-2 text-sm"
            >
              <option value="">Select your skill...</option>
              {mySkills.map((s: any) => (
                <option key={s.id} value={s.id}>{s.skill_name} ({s.proficiency})</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-danger bg-red-50 p-2 rounded">{error}</p>}
          
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              type="submit"
              variant="primary"
              disabled={createSwap.isPending || mySkills.length === 0 || theirSkills.length === 0}
            >
              Send Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
