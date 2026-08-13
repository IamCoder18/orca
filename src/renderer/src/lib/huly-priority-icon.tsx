import React from 'react'

import { cn } from '@/lib/utils'
import { getHulyPriorityLabel } from '@/lib/huly-presentation'

const HULY_PRIORITY_URGENT_FILL = 'lch(66 80 48)'
const HULY_PRIORITY_BAR_FILL = 'lch(39.576 1.25 282)'

function getHulyPriorityBarCount(priority: number): number {
  if (priority === 2) return 3
  if (priority === 3) return 2
  if (priority === 4) return 1
  return 0
}

function getHulyPriorityIconLabel(priority: number): string {
  return getHulyPriorityLabel(priority)
}

export function HulyPriorityIcon({
  priority,
  className
}: {
  priority: number
  className?: string
}): React.JSX.Element | null {
  if (priority <= 0) return null
  const label = getHulyPriorityIconLabel(priority)
  if (priority === 1) {
    return (
      <span
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold leading-none text-white',
          className
        )}
        style={{ backgroundColor: HULY_PRIORITY_URGENT_FILL }}
        title={label}
      >
        <span aria-hidden="true">!</span>
        <span className="sr-only">Priority: {label}</span>
      </span>
    )
  }
  const activeBars = getHulyPriorityBarCount(priority)
  return (
    <span
      className={cn('inline-flex size-4 shrink-0 items-center justify-center', className)}
      title={label}
    >
      <svg aria-hidden="true" className="size-full" viewBox="0 0 16 16" fill="none">
        {[1, 2, 3].map((bar) => {
          const height = bar === 1 ? 5 : bar === 2 ? 8 : 11
          const x = bar === 1 ? 2.25 : bar === 2 ? 6.5 : 10.75
          return (
            <rect
              key={bar}
              x={x}
              y={16 - height}
              width="3.25"
              height={height}
              rx="1"
              fill={bar <= activeBars ? HULY_PRIORITY_BAR_FILL : 'var(--linear-priority-bar-inactive-fill)'}
            />
          )
        })}
      </svg>
      <span className="sr-only">Priority: {label}</span>
    </span>
  )
}