import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, Clock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Skill } from '@/lib/api'
import { Header } from '@/components/Header'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SkillForm } from '@/components/SkillForm'
import type { SkillInput } from '@/lib/api'

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
]

function getColorIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return hash % AVATAR_COLORS.length
}

function SkillAvatar({ name }: { name: string }) {
  const idx = getColorIndex(name)
  const initials = name.split(/[-_\s]/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || name[0]?.toUpperCase() || '?'
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${AVATAR_COLORS[idx]}`}>
      {initials}
    </div>
  )
}

function formatDate(iso: string) {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((new Date(iso).getTime() - Date.now()) / 86400000),
    'day'
  )
}

function SkillCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2 mb-1.5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-3 w-20" />
      </CardFooter>
    </Card>
  )
}

export function SkillsPage() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null)

  const load = async () => {
    try {
      const data = await api.list()
      setSkills(data)
    } catch (err) {
      toast.error(`Failed to load skills: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (data: SkillInput) => {
    try {
      await api.create(data)
      toast.success('Skill created successfully')
      setNewDialogOpen(false)
      load()
    } catch (err) {
      toast.error(`Failed to create skill: ${err}`)
      throw err
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(deleteTarget.id)
      toast.success('Skill deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(`Failed to delete skill: ${err}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onNewSkill={() => setNewDialogOpen(true)} />

      <main className="container py-8">
        {/* Hero */}
        <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skills Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your Claude AI skills — automatically loaded by Claude Code.
            </p>
          </div>
          {!loading && skills.length > 0 && (
            <Badge variant="secondary" className="self-start sm:self-auto text-xs font-mono px-2.5 py-1">
              {skills.length} skill{skills.length !== 1 ? 's' : ''} installed
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkillCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground/50">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold">
              {search ? 'No skills match your search' : 'No skills yet'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? 'Try a different search term' : 'Create your first skill to get started'}
            </p>
            {!search && (
              <Button
                className="mt-5 bg-brand hover:bg-brand/90 text-brand-foreground"
                onClick={() => setNewDialogOpen(true)}
              >
                + New Skill
              </Button>
            )}
          </div>
        ) : (
          <>
            {search && (
              <p className="mb-4 text-xs text-muted-foreground">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((skill) => {
                return (
                  <Card
                    key={skill.id}
                    className="group cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
                    onClick={() => navigate(`/skills/${skill.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <SkillAvatar name={skill.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-semibold leading-snug truncate">{skill.name}</CardTitle>
                            {skill.version && (
                              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4 font-mono">
                                v{skill.version}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pb-2 pt-0">
                      <div className="line-clamp-1 rounded bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                        {skill.content.split('\n').find(l => l.trim()) ?? '—'}
                      </div>
                    </CardContent>

                    <CardFooter className="justify-between pt-1">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(skill.updatedAt)}</span>
                      </div>

                      <div
                        className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/skills/${skill.id}/edit`)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(skill)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </main>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Skill</DialogTitle>
          </DialogHeader>
          <SkillForm
            onSubmit={handleCreate}
            onCancel={() => setNewDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        skillName={deleteTarget?.name || ''}
        onConfirm={handleDelete}
      />
    </div>
  )
}
