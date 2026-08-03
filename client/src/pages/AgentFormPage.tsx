import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Sparkles, Check } from 'lucide-react'

const MODELS = [
  { id: 'claude-opus-4-7',   label: 'Claude Opus 4.7',   desc: 'Most capable' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Balanced'      },
  { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5',  desc: 'Fastest'       },
]

interface Skill { id: string; name: string; description: string }

export function AgentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(setAvailableSkills)
      .catch(() => {})

    if (isEdit && id) {
      fetch(`/api/agents/${id}`)
        .then(r => r.json())
        .then(agent => {
          setName(agent.name)
          setDescription(agent.description)
          setModel(agent.model)
          setSystemPrompt(agent.systemPrompt)
          setSelectedSkills(agent.skills)
        })
        .catch(() => toast.error('Failed to load agent'))
    }
  }, [id, isEdit])

  function toggleSkill(skillId: string) {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const skillsYaml = selectedSkills.length
        ? `\n  - ${selectedSkills.join('\n  - ')}`
        : ' []'
      const raw = `---\nname: ${name}\ndescription: ${description}\nversion: 1.0.0\nmodel: ${model}\nskills:${skillsYaml}\nsubAgents: []\n---\n\n${systemPrompt}`
      const res = await fetch(
        isEdit ? `/api/agents/${id}` : '/api/agents',
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) }
      )
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const agent = await res.json()
      toast.success(isEdit ? 'Agent updated' : 'Agent created')
      navigate(`/agents/${agent.id}`)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Agent' : 'New Agent'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Deploy Agent" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" />
              </div>
            </CardContent>
          </Card>

          {/* Model */}
          <div className="space-y-2">
            <Label>Model</Label>
            <div className="grid grid-cols-3 gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id} type="button"
                  onClick={() => setModel(m.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    model === m.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <Card>
            <CardContent className="p-5 space-y-1.5">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Describe the agent's personality, role, and rules..."
                className="min-h-[120px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills <span className="text-muted-foreground font-normal">({selectedSkills.length} selected)</span></Label>
            {availableSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No skills available — create some first.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availableSkills.map(skill => {
                  const selected = selectedSkills.includes(skill.id)
                  return (
                    <button
                      key={skill.id} type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
                      }`}>
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{skill.name}</span>
                        {skill.description && (
                          <span className="text-xs text-muted-foreground truncate">— {skill.description}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Agent'}</Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </main>
    </div>
  )
}
