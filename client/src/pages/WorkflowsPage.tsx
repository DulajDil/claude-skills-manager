import { useEffect, useState } from 'react'
import { Workflow as WorkflowIcon } from 'lucide-react'
import { Header } from '@/components/Header'

/**
 * The agent workflow console (tools/workflow-console) runs as its own local app
 * bound to 127.0.0.1 — it starts agents that edit code, so it never shares this
 * server's port or its LAN exposure. This page embeds it.
 */
const CONSOLE_URL = 'http://127.0.0.1:5280'

export function WorkflowsPage() {
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = () =>
      fetch(CONSOLE_URL, { mode: 'no-cors', cache: 'no-store' })
        .then(() => !cancelled && setReachable(true))
        .catch(() => !cancelled && setReachable(false))
    check()
    const t = setInterval(() => reachable === false && check(), 3000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [reachable])

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      {reachable === false ? (
        <main className="container flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <WorkflowIcon className="h-10 w-10 text-muted-foreground/60" />
          <h1 className="text-lg font-semibold">The workflow console isn't running</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Start it from the repo root with <code className="rounded bg-muted px-1.5 py-0.5">npm run console</code> (or{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">npm run dev</code>, which starts everything). This page connects as soon as it's up.
          </p>
        </main>
      ) : (
        <iframe title="Workflow console" src={CONSOLE_URL} className="w-full flex-1 border-0" />
      )}
    </div>
  )
}
