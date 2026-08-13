// Why: GitHub renders 12 shimmer rows while the tasks list loads so the
// table doesn't visibly grow when results land. Same density for Huly so
// both task lists share the same loading height.
import { HULY_TASK_GRID_CLASS, HULY_TASK_STICKY_ID_CELL_CLASS, HULY_TASK_STICKY_TITLE_CELL_CLASS } from './huly-task-row'

export function HulyTaskSkeleton(): React.JSX.Element {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={HULY_TASK_GRID_CLASS}>
          <div className={HULY_TASK_STICKY_ID_CELL_CLASS}>
            <div className="h-6 w-16 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className={HULY_TASK_STICKY_TITLE_CELL_CLASS}>
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted/70" />
            <div className="mt-1.5 h-3 w-2/5 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="flex items-center">
            <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="flex items-center justify-end">
            <div className="h-7 w-7 animate-pulse rounded-md bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  )
}