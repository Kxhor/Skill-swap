import { useState } from 'react'
import { Plus, X, Star, BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAddSkill, useDeleteSkill } from '@/hooks/useSwaps'
import { SKILL_OPTIONS } from '@/lib/constants'

export function SkillSection({
  title,
  skills,
  type,
  isOwn,
}: {
  title: string
  skills: any[]
  type: 'offered' | 'wanted'
  isOwn: boolean
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [proficiency, setProficiency] = useState('beginner')
  const addSkill = useAddSkill()
  const deleteSkill = useDeleteSkill()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkill.trim()) return
    addSkill.mutate(
      { skill_name: newSkill, type, proficiency },
      {
        onSuccess: () => {
          setNewSkill('')
          setProficiency('beginner')
          setIsAdding(false)
        },
      }
    )
  }

  return (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-text">{title}</h3>
        {isOwn && !isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Skill
          </Button>
        )}
      </div>

      {isOwn && isAdding && (
        <form onSubmit={handleAdd} className="mb-4 p-4 glass-card flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="text"
              placeholder="e.g. React, Python, UI Design"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              list="skill-options"
              className="w-full glass-input px-3 py-2 text-sm"
              required
            />
            <datalist id="skill-options">
              {SKILL_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
          <select
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
            className="w-32 glass-input px-3 py-2 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <Button type="submit" disabled={addSkill.isPending}>Add</Button>
          <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </form>
      )}

      {skills.length === 0 ? (
        <p className="text-text-muted text-sm py-4">No skills added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 glass-pill px-3 py-1.5 rounded-full text-sm"
            >
              <Star className="w-3 h-3 text-accent" />
              <span className="font-medium">{s.skill_name}</span>
              {s.is_verified && <BadgeCheck className="w-4 h-4 text-primary ml-1" />}
              <span className="text-text-muted text-xs">• {s.proficiency}</span>
              {isOwn && (
                <button
                  onClick={() => deleteSkill.mutate(s.id)}
                  className="ml-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove skill"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
