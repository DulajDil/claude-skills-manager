import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface DayModelStats {
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  total_tokens: number
  requests: number
}

interface UsageRow {
  date: string
  model: string
  stats: DayModelStats
}

interface DayGroup {
  date: string
  models: { model: string; stats: DayModelStats }[]
  totals: DayModelStats
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function modelLabel(model: string): string {
  if (model.includes('opus')) return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku')) return 'Haiku'
  return model
}

function modelColor(model: string): string {
  if (model.includes('opus')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  if (model.includes('sonnet')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (model.includes('haiku')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  return ''
}

function sumStats(rows: DayModelStats[]): DayModelStats {
  return rows.reduce((acc, s) => ({
    input_tokens: acc.input_tokens + s.input_tokens,
    output_tokens: acc.output_tokens + s.output_tokens,
    cache_read_tokens: acc.cache_read_tokens + s.cache_read_tokens,
    cache_creation_tokens: acc.cache_creation_tokens + s.cache_creation_tokens,
    total_tokens: acc.total_tokens + s.total_tokens,
    requests: acc.requests + s.requests,
  }), { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, total_tokens: 0, requests: 0 })
}

export function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  const dayGroups: DayGroup[] = []
  const byDate = new Map<string, { model: string; stats: DayModelStats }[]>()
  for (const row of rows) {
    const list = byDate.get(row.date) ?? []
    list.push({ model: row.model, stats: row.stats })
    byDate.set(row.date, list)
  }
  for (const [date, models] of byDate.entries()) {
    dayGroups.push({ date, models, totals: sumStats(models.map(m => m.stats)) })
  }
  dayGroups.sort((a, b) => b.date.localeCompare(a.date))

  const allTotals = sumStats(dayGroups.map(d => d.totals))

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Token Usage</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Claude Code usage parsed from <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">~/.claude/projects</code>
          </p>
        </div>

        {/* Legend */}
        <Card className="mb-6">
          <CardContent className="px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Legend</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">↑ Input</span>
                <span className="text-muted-foreground text-xs">Tokens you sent to Claude (your messages + context)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">↓ Output</span>
                <span className="text-muted-foreground text-xs">Tokens Claude generated in reply</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">⚡ Cached</span>
                <span className="text-muted-foreground text-xs">Input tokens served from cache — faster &amp; cheaper</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-medium">+ Written</span>
                <span className="text-muted-foreground text-xs">Tokens saved to cache for future reuse</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Tokens</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{formatNum(allTotals.total_tokens)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Input</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{formatNum(allTotals.input_tokens)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Output</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{formatNum(allTotals.output_tokens)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requests</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{formatNum(allTotals.requests)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load usage data: {error}
          </div>
        )}

        {!loading && !error && dayGroups.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No usage data found in <code className="font-mono text-xs">~/.claude/projects</code>
          </div>
        )}

        <div className="space-y-3">
          {dayGroups.map(group => (
            <Card key={group.date}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-[100px]">
                    <p className="font-semibold text-sm">{group.date}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{group.totals.requests} requests</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {group.models.map(({ model, stats }) => (
                      <div key={model} className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${modelColor(model)}`}>
                          {modelLabel(model)}
                        </span>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                          <span title="Input tokens">↑ {formatNum(stats.input_tokens)}</span>
                          <span title="Output tokens">↓ {formatNum(stats.output_tokens)}</span>
                          {stats.cache_read_tokens > 0 && (
                            <span title="Cache read tokens" className="text-emerald-600 dark:text-emerald-400">
                              ⚡ {formatNum(stats.cache_read_tokens)} cached
                            </span>
                          )}
                          {stats.cache_creation_tokens > 0 && (
                            <span title="Cache creation tokens" className="text-amber-600 dark:text-amber-400">
                              + {formatNum(stats.cache_creation_tokens)} written
                            </span>
                          )}
                        </div>
                        <span className="ml-auto text-xs font-medium tabular-nums">
                          {formatNum(stats.total_tokens)} total
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
