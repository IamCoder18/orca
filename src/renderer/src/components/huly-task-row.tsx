// Why: single Huly row mirroring GitHub's task-grid: a sticky ID cell,
// sticky title cell (title + state badge + labels + meta line), a relative
// updated cell, and an actions cell. Background + hover tokens match
// GitHub's GITHUB_TASK_ROW_SURFACE/GITHUB_TASK_ROW_HOVER_SURFACE so the
// two lists sit visually identical in the Tasks surface.
import { ExternalLink, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { HulyIssue } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import type { GlobalSettings } from '../../../shared/types'
import { HulyPriorityIcon } from '@/lib/huly-priority-icon'
import { stateToneClasses } from '@/lib/huly-presentation'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { HulyTaskStateChanger } from './huly-task-state-changer'

export const HULY_TASK_ROW_SURFACE_CLASS = 'bg-background transition-colors'
export const HULY_TASK_ROW_HOVER_SURFACE_CLASS = 'group/huly-task-row:bg-accent'
export const HULY_TASK_HEADER_SURFACE_CLASS =
  '[background:color-mix(in_srgb,var(--muted)_25%,var(--background))]'

export const HULY_TASK_STICKY_ID_CELL_CLASS = cn(
  'sticky left-3 z-20 flex items-center before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:bg-inherit',
  HULY_TASK_ROW_SURFACE_CLASS,
  HULY_TASK_ROW_HOVER_SURFACE_CLASS
)
export const HULY_TASK_STICKY_TITLE_CELL_CLASS = cn(
  'sticky left-[92px] z-20 flex min-w-0 flex-col justify-center border-r border-border/40 pr-2 before:absolute before:-left-2 before:top-0 before:bottom-0 before:w-2 before:bg-inherit',
  HULY_TASK_ROW_SURFACE_CLASS,
  HULY_TASK_ROW_HOVER_SURFACE_CLASS
)

export const HULY_TASK_GRID_CLASS =
  'grid min-h-12 grid-cols-[120px_minmax(0,1fr)_100px_120px] gap-3 px-3 py-2.5'

type Props = {
  issue: HulyIssue
  showTeam?: boolean
  sourceContext?: TaskSourceContext | null
  settings?: GlobalSettings | null
  onOpen: (issue: HulyIssue) => void
  onOpenInHuly: (issue: HulyIssue) => void
}

export function HulyTaskRow({
  issue,
  showTeam = false,
  sourceContext,
  settings,
  onOpen,
  onOpenInHuly
}: Props): React.JSX.Element {
  const handleClick = (): void => onOpen(issue)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(issue)
    }
  }
  const handleOpenExternal = (event: React.MouseEvent): void => {
    event.stopPropagation()
    onOpenInHuly(issue)
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/huly-task-row cursor-pointer text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        HULY_TASK_GRID_CLASS
      )}
    >
      <div className={HULY_TASK_STICKY_ID_CELL_CLASS}>
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border/40 px-1.5 py-0.5 text-muted-foreground"
          aria-label={`Issue ${issue.identifier}`}
        >
          <CircleDot className="size-3" aria-hidden="true" />
          <span className="font-mono text-[11px] font-normal">{issue.identifier}</span>
        </span>
      </div>

      <div className={HULY_TASK_STICKY_TITLE_CELL_CLASS}>
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[13px] font-medium text-foreground">{issue.title}</h3>
          <HulyTaskStateChanger
            issue={issue}
            sourceContext={sourceContext ?? null}
            settings={settings}
            onOpen={onOpen}
          />
          {issue.state.type === 'done' || issue.state.type === 'closed' ? (
            <span
              className={cn(
                'shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-medium',
                stateToneClasses(issue.state.type)
              )}
            >
              {issue.state.name}
            </span>
          ) : null}
          {issue.priority > 0 ? (
            <span className="shrink-0">
              <HulyPriorityIcon priority={issue.priority} />
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted-foreground">
          <span>
            {issue.assignee?.displayName ??
              translate('auto.components.TaskPage.huly.unassigned', 'Unassigned')}
          </span>
          {showTeam ? <span>{issue.team.name}</span> : null}
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/40 bg-muted/30 px-1.5 py-0 text-[10px] text-muted-foreground"
              title={label}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center text-xs text-muted-foreground">
        {formatUiRelativeTimeFromDate(issue.updatedAt)}
      </div>

      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleOpenExternal}
              aria-label={translate(
                'auto.components.TaskPage.huly.openInHuly',
                'Open in Huly'
              )}
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={4}>
            {translate('auto.components.TaskPage.huly.openInHuly', 'Open in Huly')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}