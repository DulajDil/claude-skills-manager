import { Globe, FolderOpen, BarChart2, Bot, Package } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onNewSkill?: () => void
}

export function Header({ onNewSkill }: HeaderProps) {
  const { pathname } = useLocation()

  const navLink = (to: string, label: string, icon?: React.ReactNode, match?: (p: string) => boolean) => {
    const active = match ? match(pathname) : pathname === to
    return (
      <Link
        to={to}
        className={cn(
          'flex items-center gap-1.5 px-1 py-1 text-sm font-medium transition-colors border-b-2',
          active
            ? 'text-foreground border-brand'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
        )}
      >
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <Logo />
            <span className="font-semibold hidden sm:block tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Claude Skills
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            {navLink('/', 'My Skills')}
            {navLink('/starter', 'Starter Set', <Package className="h-3.5 w-3.5" />)}
            {navLink('/agents', 'Agents', <Bot className="h-3.5 w-3.5" />, (p) => p === '/agents' || p.startsWith('/agents/'))}
            {navLink('/usage', 'Usage', <BarChart2 className="h-3.5 w-3.5" />)}
            {navLink('/marketplace', 'Marketplace', <Globe className="h-3.5 w-3.5" />)}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => fetch('/api/open-skills-folder', { method: 'POST' })}
            title="Open skills folder in Finder"
          >
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Open Folder</span>
          </Button>
          {onNewSkill && (
            <Button size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground" onClick={onNewSkill}>
              + New Skill
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
