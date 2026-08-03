import { useEffect, useState, useCallback, Component, type ReactNode } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, Position,
  Handle, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Bot, Sparkles, ArrowLeft, User, MessageSquare, Download, X, Save, Plus, Link2 } from 'lucide-react'
import { toast } from 'sonner'

interface Agent {
  id: string; name: string; description: string
  model: string; systemPrompt: string; skills: string[]; subAgents: string[]
}
interface Skill { id: string; name: string; description: string; content: string }

// ── Custom nodes ──────────────────────────────────────────────────────────────

function UserNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 border-2 border-slate-300 dark:bg-slate-800 dark:border-slate-600">
        <User className="h-6 w-6 text-slate-500" />
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{String(data.label)}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  )
}

function AgentNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border-2 border-primary bg-primary/5 shadow-md px-5 py-4 min-w-[220px] select-none">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <Handle type="target" position={Position.Left} id="left-in" className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{String(data.label)}</p>
          <p className="text-[11px] text-muted-foreground">{String(data.model)}</p>
        </div>
      </div>
      {Boolean(data.systemPrompt) && (
        <p className="text-[11px] text-muted-foreground border-t pt-2 mt-1 line-clamp-2">
          {String(data.systemPrompt)}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      <Handle type="source" position={Position.Right} id="right-out" className="!bg-primary" />
    </div>
  )
}

function SubAgentNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border-2 border-violet-400 bg-violet-50 dark:bg-violet-950/30 shadow-md px-5 py-4 min-w-[200px] select-none cursor-pointer hover:border-violet-500 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />
      <Handle type="target" position={Position.Left} id="left-in" className="!bg-violet-400" />
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-violet-900 dark:text-violet-200">{String(data.label)}</p>
          <p className="text-[11px] text-violet-600 dark:text-violet-400">{String(data.model)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-violet-500 font-medium mt-1">
        <Link2 className="h-2.5 w-2.5" /> sub-agent · click to open
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400" />
      <Handle type="source" position={Position.Right} id="right-out" className="!bg-violet-400" />
    </div>
  )
}

function SkillNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-border bg-background shadow-sm px-4 py-3 min-w-[160px] select-none cursor-pointer hover:border-primary hover:shadow-md transition-all">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium leading-tight">{String(data.label)}</p>
          {Boolean(data.description) && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{String(data.description)}</p>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-primary/70 font-medium">
        <Pencil className="h-2.5 w-2.5" /> click to edit
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  )
}

function OutputNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <Handle type="target" position={Position.Top} className="!bg-emerald-500" />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700">
        <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{String(data.label)}</span>
    </div>
  )
}

const nodeTypes = { userNode: UserNode, agentNode: AgentNode, subAgentNode: SubAgentNode, skillNode: SkillNode, outputNode: OutputNode }

class FlowErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-8 text-center">
        Flow diagram error: {this.state.error}
      </div>
    )
    return this.props.children
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function positionsKey(agentId: string) { return `agent-flow-positions:${agentId}` }

function loadSavedPositions(agentId: string): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(positionsKey(agentId)) || '{}') } catch { return {} }
}

function savePositions(agentId: string, nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach(n => { positions[n.id] = n.position })
  localStorage.setItem(positionsKey(agentId), JSON.stringify(positions))
}

function buildGraph(agent: Agent, skills: Skill[], allAgents: Agent[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const assignedSkills = skills.filter(s => agent.skills.includes(s.id))
  const subAgents = allAgents.filter(a => (agent.subAgents ?? []).includes(a.id))

  const totalSkills = assignedSkills.length
  const skillSpacing = 210
  const centerX = totalSkills > 1 ? ((totalSkills - 1) * skillSpacing) / 2 : 0

  nodes.push({ id: 'user', type: 'userNode', position: { x: centerX + 10, y: 0 }, data: { label: 'You' } })
  nodes.push({
    id: 'agent', type: 'agentNode',
    position: { x: centerX - 90, y: 110 },
    data: { label: agent.name, model: modelShort(agent.model), systemPrompt: agent.systemPrompt },
  })
  edges.push({ id: 'user-agent', source: 'user', target: 'agent', animated: true, style: { stroke: 'hsl(var(--primary))' } })

  if (totalSkills > 0) {
    assignedSkills.forEach((skill, i) => {
      const skillId = `skill-${skill.id}`
      nodes.push({
        id: skillId, type: 'skillNode',
        position: { x: i * skillSpacing - 60, y: 300 },
        data: { label: skill.name, description: skill.description, skillId: skill.id },
      })
      edges.push({ id: `agent-${skillId}`, source: 'agent', target: skillId, animated: true, style: { stroke: 'hsl(var(--muted-foreground) / 0.4)' } })
      edges.push({ id: `${skillId}-output`, source: skillId, target: 'output', style: { stroke: 'hsl(142 76% 36% / 0.4)' } })
    })
  } else {
    edges.push({ id: 'agent-output', source: 'agent', target: 'output', animated: true, style: { stroke: 'hsl(142 76% 36% / 0.5)' } })
  }

  const outputY = totalSkills > 0 ? 480 : 290
  nodes.push({ id: 'output', type: 'outputNode', position: { x: centerX + 10, y: outputY }, data: { label: 'Response' } })

  // Sub-agent nodes — placed to the right of the main flow
  subAgents.forEach((sub, i) => {
    const subId = `subagent-${sub.id}`
    nodes.push({
      id: subId, type: 'subAgentNode',
      position: { x: centerX + 360, y: 110 + i * 200 },
      data: { label: sub.name, model: modelShort(sub.model), agentId: sub.id },
    })
    edges.push({
      id: `agent-${subId}`, source: 'agent', target: subId,
      sourceHandle: 'right-out',
      animated: true,
      style: { stroke: 'hsl(262 83% 58% / 0.6)' },
      label: 'delegates to',
      labelStyle: { fontSize: 10, fill: 'hsl(262 83% 58%)' },
      labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.8 },
    })
  })

  return { nodes, edges }
}

function modelShort(model: string) {
  if (model.includes('opus')) return 'Opus 4.7'
  if (model.includes('sonnet')) return 'Sonnet 4.6'
  if (model.includes('haiku')) return 'Haiku 4.5'
  return model
}

// ── Skill edit panel ──────────────────────────────────────────────────────────

function SkillEditPanel({ skill, onClose, onSaved }: { skill: Skill; onClose: () => void; onSaved: (s: Skill) => void }) {
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [content, setContent] = useState(skill.content)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, content }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Skill saved')
      onSaved(await res.json())
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-background border-l shadow-xl flex flex-col z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="font-semibold text-sm">Edit Skill</span></div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Instructions</Label>
          <Textarea value={content} onChange={e => setContent(e.target.value)} className="font-mono text-xs min-h-[300px] resize-none" />
        </div>
      </div>
      <div className="p-4 border-t shrink-0 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1"><Save className="h-3.5 w-3.5 mr-1.5" />{saving ? 'Saving…' : 'Save'}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Add sub-agent picker ──────────────────────────────────────────────────────

function AddAgentPicker({ allAgents, currentId, subAgents, onAdd, onClose }: {
  allAgents: Agent[]; currentId: string; subAgents: string[]
  onAdd: (agentId: string) => void; onClose: () => void
}) {
  const available = allAgents.filter(a => a.id !== currentId && !subAgents.includes(a.id))
  return (
    <div className="absolute top-0 right-0 h-full w-[320px] bg-background border-l shadow-xl flex flex-col z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-violet-500" /><span className="font-semibold text-sm">Add Sub-Agent</span></div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {available.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No other agents available.<br />Create more agents first.</p>
        )}
        {available.map(a => (
          <button key={a.id} onClick={() => onAdd(a.id)}
            className="w-full text-left rounded-lg border border-border p-3 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900">
                <Bot className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{modelShort(a.model)} · {a.skills.length} skills</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentFlowPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${id}`).then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
    ]).then(([agentData, skillsData, agentsData]) => {
      setAgent(agentData)
      setSkills(skillsData)
      setAllAgents(agentsData)
      const { nodes: n, edges: e } = buildGraph(agentData, skillsData, agentsData)
      const saved = loadSavedPositions(agentData.id)
      setNodes(n.map(node => saved[node.id] ? { ...node, position: saved[node.id] } : node))
      setEdges(e)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    if (agent) savePositions(agent.id, allNodes)
  }, [agent])

  const handleConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, animated: true, style: { stroke: 'hsl(262 83% 58% / 0.6)' } }, eds))
  }, [])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'skillNode') {
      const skill = skills.find(s => s.id === node.data.skillId as string)
      if (skill) { setEditingSkill(skill); setShowAgentPicker(false) }
    }
    if (node.type === 'subAgentNode') {
      navigate(`/agents/${node.data.agentId}`)
    }
  }, [skills, navigate])

  const handleSkillSaved = useCallback((updated: Skill) => {
    setSkills(prev => prev.map(s => s.id === updated.id ? updated : s))
    setNodes(prev => prev.map(n =>
      n.id === `skill-${updated.id}`
        ? { ...n, data: { ...n.data, label: updated.name, description: updated.description } }
        : n
    ))
    setEditingSkill(null)
  }, [])

  const handleAddSubAgent = useCallback(async (subAgentId: string) => {
    if (!agent) return
    const newSubAgents = [...(agent.subAgents ?? []), subAgentId]
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subAgents: newSubAgents }),
    })
    if (!res.ok) { toast.error('Failed to add sub-agent'); return }
    const updated: Agent = await res.json()
    setAgent(updated)
    const sub = allAgents.find(a => a.id === subAgentId)!
    const subNodeId = `subagent-${subAgentId}`
    setNodes(prev => [...prev, {
      id: subNodeId, type: 'subAgentNode',
      position: { x: 500, y: 110 + newSubAgents.length * 200 },
      data: { label: sub.name, model: modelShort(sub.model), agentId: sub.id },
    }])
    setEdges(prev => [...prev, {
      id: `agent-${subNodeId}`, source: 'agent', target: subNodeId,
      sourceHandle: 'right-out', animated: true,
      style: { stroke: 'hsl(262 83% 58% / 0.6)' },
      label: 'delegates to',
      labelStyle: { fontSize: 10, fill: 'hsl(262 83% 58%)' },
      labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.8 },
    }])
    setShowAgentPicker(false)
    toast.success(`Added ${sub.name} as sub-agent`)
  }, [agent, id, allAgents])

  const handleRemoveSubAgent = useCallback(async (subAgentId: string) => {
    if (!agent) return
    const newSubAgents = agent.subAgents.filter(a => a !== subAgentId)
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subAgents: newSubAgents }),
    })
    if (!res.ok) { toast.error('Failed to remove sub-agent'); return }
    setAgent(await res.json())
    setNodes(prev => prev.filter(n => n.id !== `subagent-${subAgentId}`))
    setEdges(prev => prev.filter(e => e.id !== `agent-subagent-${subAgentId}`))
    toast.success('Sub-agent removed')
  }, [agent, id])

  const handleExport = useCallback(async () => {
    if (!agent) return
    const res = await fetch(`/api/agents/${id}/export`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) toast.success(`Exported to ~/Nano/ClaudeAi/Agents/${agent.name}.md`)
    else toast.error(data.error || 'Export failed')
  }, [agent, id])

  const handleDelete = useCallback(async () => {
    if (!agent || !confirm(`Delete agent "${agent.name}"?`)) return
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Agent deleted'); navigate('/agents') }
    else toast.error('Failed to delete')
  }, [agent, id, navigate])

  if (loading) return <div className="h-screen bg-background flex flex-col"><Header /></div>
  if (!agent) return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="container py-16 text-center text-muted-foreground">Agent not found</div>
    </div>
  )

  const activePanel = editingSkill ? 'skill' : showAgentPicker ? 'picker' : null

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />

      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/agents" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-tight">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">
              {modelShort(agent.model)} · {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}
              {agent.subAgents?.length ? ` · ${agent.subAgents.length} sub-agent${agent.subAgents.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowAgentPicker(true); setEditingSkill(null) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Agent
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Sub-agent chips (if any) */}
      {agent.subAgents?.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2 flex-wrap bg-violet-50/50 dark:bg-violet-950/10">
          <span className="text-xs text-muted-foreground">Sub-agents:</span>
          {agent.subAgents.map(subId => {
            const sub = allAgents.find(a => a.id === subId)
            if (!sub) return null
            return (
              <span key={subId} className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-200">
                <Bot className="h-3 w-3" />{sub.name}
                <button onClick={() => handleRemoveSubAgent(subId)} className="ml-0.5 hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
              </span>
            )
          })}
        </div>
      )}

      {/* Flow canvas */}
      <div className="flex-1 relative overflow-hidden">
        <FlowErrorBoundary>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
          >
            <Background gap={20} size={1} color="hsl(var(--border))" />
            <Controls />
            <MiniMap
              nodeColor={n => {
                if (n.type === 'agentNode') return 'hsl(var(--primary))'
                if (n.type === 'subAgentNode') return 'hsl(262 83% 58%)'
                if (n.type === 'skillNode') return 'hsl(var(--muted-foreground))'
                return '#ccc'
              }}
              className="!bg-background !border-border"
            />
          </ReactFlow>
        </FlowErrorBoundary>

        {activePanel === 'skill' && editingSkill && (
          <SkillEditPanel skill={editingSkill} onClose={() => setEditingSkill(null)} onSaved={handleSkillSaved} />
        )}
        {activePanel === 'picker' && (
          <AddAgentPicker
            allAgents={allAgents}
            currentId={id!}
            subAgents={agent.subAgents ?? []}
            onAdd={handleAddSubAgent}
            onClose={() => setShowAgentPicker(false)}
          />
        )}
      </div>
    </div>
  )
}
