import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Skill, type SkillInput } from '@/lib/api'
import { Header } from '@/components/Header'
import { SkillForm } from '@/components/SkillForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function EditSkillPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.get(id)
      .then(setSkill)
      .catch(() => {
        toast.error('Skill not found')
        navigate('/')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSubmit = async (data: SkillInput) => {
    if (!skill) return
    try {
      await api.update(skill.id, data)
      toast.success('Skill updated successfully')
      navigate(`/skills/${skill.id}`)
    } catch (err) {
      toast.error(`Failed to update: ${err}`)
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <h1 className="mb-6 text-2xl font-bold">Edit Skill</h1>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : skill ? (
          <SkillForm
            initial={skill}
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            isEdit
          />
        ) : null}
      </main>
    </div>
  )
}
