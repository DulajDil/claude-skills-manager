import { useState, useRef } from 'react'
import { Search, Star, Download, ExternalLink, Loader2, CheckCircle2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/Header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface MarketplaceSkill {
  id: string
  name: string
  author: string
  description: string
  githubUrl: string
  skillUrl: string
  stars: number
  updatedAt: string
}

interface SearchResult {
  data: {
    skills: MarketplaceSkill[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

function formatStars(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(ts: string) {
  const ms = Number(ts) * 1000
  if (isNaN(ms)) return ''
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((ms - Date.now()) / 86400000),
    'day'
  )
}

function SkillResultSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-28 ml-auto" />
      </CardFooter>
    </Card>
  )
}

export function MarketplacePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MarketplaceSkill[]>([])
  const [pagination, setPagination] = useState<SearchResult['data']['pagination'] | null>(null)
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(1)
  const [currentQuery, setCurrentQuery] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const search = async (q: string, p = 1) => {
    if (!q.trim()) return
    setSearching(true)
    if (p === 1) setResults([])

    try {
      const params = new URLSearchParams({ q, page: String(p), limit: '12' })
      const res = await fetch(`/api/marketplace/search?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const json: SearchResult = await res.json()
      setResults(p === 1 ? json.data.skills : [...results, ...json.data.skills])
      setPagination(json.data.pagination)
      setCurrentQuery(q)
      setPage(p)
    } catch (err) {
      toast.error(`Search failed: ${err}`)
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search(query)
  }

  const handleDownload = async (skill: MarketplaceSkill) => {
    setDownloading(skill.id)
    try {
      const res = await fetch('/api/marketplace/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl: skill.githubUrl,
          name: skill.name,
          description: skill.description,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`"${json.name}" added to your skills library`)
      setDownloaded((prev) => new Set(prev).add(skill.id))
    } catch (err) {
      const msg = String(err)
      if (msg.includes('already exists')) {
        toast.warning(msg)
        setDownloaded((prev) => new Set(prev).add(skill.id))
      } else {
        toast.error(`Download failed: ${msg}`)
      }
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">skillsmp.com</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Skill Marketplace</h1>
          <p className="mt-1 text-muted-foreground">
            Browse 1.3M+ community skills. One click to add them to your Claude library.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8 flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search skills (e.g. aws, code review, docker...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* Empty state */}
        {!searching && results.length === 0 && !currentQuery && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Globe className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-sm">Search for skills to discover and download them into Claude</p>
          </div>
        )}

        {/* Results count */}
        {pagination && !searching && (
          <p className="mb-4 text-sm text-muted-foreground">
            {pagination.total.toLocaleString()} results for <strong>"{currentQuery}"</strong>
          </p>
        )}

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((skill) => (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader className="pb-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{skill.name}</CardTitle>
                  <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>{formatStars(skill.stars)}</span>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
              </CardHeader>

              <CardContent className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {skill.author}
                  </Badge>
                  {skill.updatedAt && (
                    <span className="text-xs text-muted-foreground">{formatDate(skill.updatedAt)}</span>
                  )}
                </div>
              </CardContent>

              <CardFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(skill.skillUrl, '_blank')}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={downloading === skill.id || downloaded.has(skill.id)}
                  onClick={() => handleDownload(skill)}
                >
                  {downloading === skill.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : downloaded.has(skill.id) ? (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {downloaded.has(skill.id) ? 'Added' : 'Add to Claude'}
                </Button>
              </CardFooter>
            </Card>
          ))}

          {searching &&
            Array.from({ length: 6 }).map((_, i) => <SkillResultSkeleton key={i} />)}
        </div>

        {/* Load more */}
        {pagination?.hasNext && !searching && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={() => search(currentQuery, page + 1)}
            >
              Load more
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
