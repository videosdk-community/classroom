import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from './cn'

/* Rebuilt from components/feedback/Skeleton.jsx. Source inlines a <style>
   tag per instance to carry its keyframes; `vsdk-shimmer` lives in index.css
   here instead, beside `vsdk-spin`, so a list of ten skeletons does not mount
   ten identical stylesheets. */

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  width?: number | string
  height?: number | string
  radius?: string
  circle?: boolean
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 'var(--radius-md)',
  circle = false,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const box: CSSProperties = {
    width: circle ? height : width,
    height,
    borderRadius: circle ? 'var(--radius-round)' : radius,
    ...style,
  }
  return <span aria-hidden="true" className={cn('vsdk-skeleton block', className)} style={box} {...rest} />
}

export interface SkeletonTextProps {
  lines?: number
  gap?: number
  className?: string
}

export function SkeletonText({ lines = 3, gap = 8, className }: SkeletonTextProps) {
  return (
    <span className={cn('flex flex-col', className)} style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
}
