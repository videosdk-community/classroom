import { Skeleton } from '../design/ui'

/* Three placeholder rows rather than a spinner, so the list does not jump
   when the real rows land. Shared by both lists so they settle identically. */
export function RowSkeleton() {
  return (
    <ul className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b border-hairline px-2 py-3.5 last:border-b-0"
        >
          <Skeleton circle height={36} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton height={14} width="40%" />
            <Skeleton height={12} width="24%" />
          </span>
        </li>
      ))}
    </ul>
  )
}
