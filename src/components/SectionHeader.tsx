import type { ReactNode } from 'react'
import { Badge } from '../design/ui'

/* A section heading with an optional count and one trailing action.

   Two sections on home now share this shape, and a third page reuses it as a
   page title with no action, so the spacing lives in one place rather than
   being retyped per section. */

export interface SectionHeaderProps {
  title: string
  count?: number
  action?: ReactNode
}

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      {count != null && count > 0 && (
        <Badge tone="neutral" outline>
          {count}
        </Badge>
      )}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  )
}
