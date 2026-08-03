import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { Skill, SkillInput } from '@/lib/api'

interface SkillFormProps {
  initial?: Skill
  onSubmit: (data: SkillInput) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
}

const PLACEHOLDER_CONTENT = `# Skill Title

## Overview
Brief description of what this skill does.

## When This Skill Applies
This skill activates when the user's request involves:
- Use case one
- Use case two

## Instructions
Step-by-step guidance for Claude to follow.

## Examples
Include practical examples here.`

export function SkillForm({ initial, onSubmit, onCancel, isEdit }: SkillFormProps) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [content, setContent] = useState(initial?.content || '')
  const [version, setVersion] = useState(initial?.version || '')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!description.trim()) e.description = 'Description is required'
    if (!content.trim()) e.content = 'Content is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), content: content.trim(), version: version.trim() || undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="skill-name">Name *</Label>
          <Input
            id="skill-name"
            placeholder="e.g. code-reviewer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isEdit}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          <p className="text-xs text-muted-foreground">Kebab-case identifier, used as the skill slug</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="skill-version">Version</Label>
          <Input
            id="skill-version"
            placeholder="1.0.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-description">Description / Trigger Conditions *</Label>
        <Textarea
          id="skill-description"
          placeholder='Describe when Claude should use this skill. E.g. "Use when the user asks to review code, improve code quality, or spot bugs."'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={errors.description ? 'border-destructive' : ''}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
        <p className="text-xs text-muted-foreground">This is the primary trigger — be specific about activation phrases and contexts</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="skill-content">Skill Content (Markdown) *</Label>
        <Textarea
          id="skill-content"
          placeholder={PLACEHOLDER_CONTENT}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className={`font-mono text-sm ${errors.content ? 'border-destructive' : ''}`}
        />
        {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
        <p className="text-xs text-muted-foreground">Write instructions in Markdown. This is the guidance Claude follows when the skill is triggered.</p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Skill'}
        </Button>
      </div>
    </form>
  )
}
