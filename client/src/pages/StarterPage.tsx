import { useEffect, useState } from 'react'
import { Download, Loader2, CheckCircle2, Package, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/Header'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { bundledApi, type BundledSet } from '@/lib/api'

function SkillSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardFooter>
        <Skeleton className="ml-auto h-8 w-28" />
      </CardFooter>
    </Card>
  )
}

export function StarterPage() {
  const [set, setSet] = useState<BundledSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try {
      setSet(await bundledApi.list())
    } catch (err) {
      toast.error(`Could not load the starter set: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const installOne = async (id: string, overwrite = false) => {
    setBusy(id)
    try {
      await bundledApi.install({ id, overwrite })
      toast.success(`"${id}" installed — restart Claude Code to pick it up`)
      await load()
    } catch (err) {
      const msg = String(err)
      if (msg.includes('already exists')) {
        toast.warning(`"${id}" is already in your library`, {
          action: { label: 'Overwrite', onClick: () => installOne(id, true) },
        })
      } else {
        toast.error(`Install failed: ${msg}`)
      }
    } finally {
      setBusy(null)
    }
  }

  const installAll = async () => {
    setBusy('__all__')
    try {
      const res = await bundledApi.install({ all: true })
      const skippedExisting = res.skipped.filter((s) => s.reason === 'already exists')
      if (res.installed.length === 0) {
        toast.info('Everything in this set is already installed')
      } else {
        // Say plainly what was left alone rather than implying a full install.
        toast.success(
          `Installed ${res.installed.length} skill${res.installed.length === 1 ? '' : 's'}` +
            (skippedExisting.length ? ` — skipped ${skippedExisting.length} already present` : '')
        )
      }
      await load()
    } catch (err) {
      toast.error(`Install failed: ${err}`)
    } finally {
      setBusy(null)
    }
  }

  const skills = set?.skills ?? []
  const pending = skills.filter((s) => !s.installed).length
  const allInstalled = skills.length > 0 && pending === 0

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <LogoMark className="h-4 w-4" />
              <span className="text-sm font-medium">Bundled with this repo</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {set?.name ?? 'Starter Set'}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {set?.description ??
                'Skills that ship inside this clone — install them straight into your local Claude library.'}
            </p>
            {set?.author && (
              <p className="mt-2 text-sm text-muted-foreground">
                Curated by <span className="font-medium text-foreground">{set.author}</span>
              </p>
            )}
          </div>

          {skills.length > 0 && (
            <Button
              onClick={installAll}
              disabled={busy !== null || allInstalled}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy === '__all__' ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : allInstalled ? (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {allInstalled ? 'All installed' : `Install all (${pending})`}
            </Button>
          )}
        </div>

        {!loading && skills.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Package className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-sm">
              No bundled skills found. Expected a <code>bundled-skills/</code> folder with a{' '}
              <code>manifest.json</code> at the repo root.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && Array.from({ length: 6 }).map((_, i) => <SkillSkeleton key={i} />)}

          {skills.map((skill) => (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader className="flex-1 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{skill.name}</CardTitle>
                  {skill.installed && (
                    <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      Installed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {skill.tagline || skill.description}
                </p>
              </CardHeader>

              <CardContent className="pb-2">
                {skill.version && (
                  <Badge variant="outline" className="text-xs">
                    v{skill.version}
                  </Badge>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  size="sm"
                  variant={skill.installed ? 'outline' : 'default'}
                  className="w-full"
                  disabled={busy !== null}
                  onClick={() => installOne(skill.id, skill.installed)}
                >
                  {busy === skill.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : skill.installed ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {skill.installed ? 'Reinstall' : 'Install'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {skills.length > 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            Installed skills are written to your local skills directory. Restart Claude Code
            afterwards so it rescans for them.
          </p>
        )}
      </main>
    </div>
  )
}
