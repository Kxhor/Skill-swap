import { useQuery } from '@tanstack/react-query'
import { SkillSection } from '@/components/SkillSection'
import api from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/skeleton'


export default function MySkills() {
  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/profile').then((r) => r.data.user),
  })

  if (isLoading) {
    return (
      <AppShell hideNavbar={true} mainClassName="flex-1 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    </AppShell>
    )
  }

  return (
    <AppShell hideNavbar={true} mainClassName="flex-1 overflow-y-auto p-8">
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
      </AppShell>
  )
}
