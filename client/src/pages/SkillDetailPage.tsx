import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Copy, Check, Clock, FileText } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { api, type Skill } from '@/lib/api'
import { Header } from '@/components/Header'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function SkillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(id)
      .then(setSkill)
      .catch(() => toast.error('Skill not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleCopy = () => {
    if (!skill) return
    navigator.clipboard.writeText(skill.content)
    setCopied(true)
    toast.success('Content copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!skill) return
    await api.delete(skill.id)
    toast.success('Skill deleted')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 max-w-3xl">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-6" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 text-center">
          <p className="text-muted-foreground">Skill not found.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Back to Skills</Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-3xl">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          All Skills
        </Button>

        {/* Title row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">{skill.name}</h1>
              {skill.version && (
                <Badge variant="secondary" className="font-mono text-xs">v{skill.version}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{skill.description}</p>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-brand" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate(`/skills/${skill.id}/edit`)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated {formatDate(skill.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-mono truncate max-w-[300px]">{skill.filePath}</span>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Content */}
        <div className="markdown-content rounded-lg border bg-card p-6">
          <ReactMarkdown>{skill.content}</ReactMarkdown>
        </div>
      </main>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        skillName={skill.name}
        onConfirm={handleDelete}
      />
    </div>
  )
}
