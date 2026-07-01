import { useQuery } from '@tanstack/react-query'
import { Sidebar } from '@/components/layout/Sidebar'
import { SkillSection } from '@/components/SkillSection'
import api from '@/lib/api'


export default function MySkills() {
  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/profile').then((r) => r.data.user),
  })

  if (isLoading) {
    return (
      <div className="flex h-screen p-4 md:p-6 gap-6 text-text">
      <Sidebar />
        <main className="flex-1 p-8 text-text-muted">Loading...</main>
      </div>
    )
  }

  return (
    <div className="flex h-screen p-4 md:p-6 gap-6">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text">My Skills</h1>
            <p className="text-text-muted">Manage the skills you offer to teach and the skills you want to learn.</p>
          </div>

          <SkillSection
            title="Skills Offered"
            skills={data?.skills_offered || []}
            type="offered"
            isOwn={true}
          />

          <SkillSection
            title="Skills Wanted"
            skills={data?.skills_wanted || []}
            type="wanted"
            isOwn={true}
          />
        </div>
      </main>
    </div>
  )
}
