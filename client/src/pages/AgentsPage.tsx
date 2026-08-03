import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, Plus, Trash2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface Agent {
  id: string
  name: string
  description: string
  model: string
  skills: string[]
  updatedAt: string
}

function modelShort(model: string) {
  if (model.includes('opus')) return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku')) return 'Haiku'
  return model
}

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => { setAgents(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteAgent(id: string, name: string, e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete agent "${name}"?`)) return
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAgents(prev => prev.filter(a => a.id !== id))
      toast.success('Agent deleted')
    } else {
      toast.error('Failed to delete agent')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-muted-foreground text-sm mt-1">Build agents from your skills</p>
          </div>
          <Button onClick={() => navigate('/agents/new')}>
            <Plus className="h-4 w-4 mr-1.5" /> New Agent
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No agents yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first agent and assign skills to it</p>
            </div>
            <Button onClick={() => navigate('/agents/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> New Agent
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {agents.map(agent => (
            <Link key={agent.id} to={`/agents/${agent.id}`}>
              <Card className="hover:bg-accent/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{agent.name}</p>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {modelShort(agent.model)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {agent.description || 'No description'}
                      {agent.skills.length > 0 && (
                        <span className="ml-2 text-xs">· {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={e => deleteAgent(agent.id, agent.name, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
