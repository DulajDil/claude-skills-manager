import { cn } from '@/lib/utils'

/**
 * Wordmark glyph: a reticle. Four ticks closing in on a centre dot — precision,
 * which is the whole pitch of a curated skill set. Drawn on a 24-unit grid with
 * `currentColor` strokes so it inherits text colour and stays legible at 14px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={cn('h-4 w-4', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7.5" strokeWidth={1.75} />
      {/* Ticks stop short of the ring so the centre reads as a target, not a plus. */}
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The mark in its brand-coloured tile, as used in the header and empty states. */
export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground',
        className
      )}
    >
      <LogoMark className="h-4 w-4" />
    </div>
  )
}
