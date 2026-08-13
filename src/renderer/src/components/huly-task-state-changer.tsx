// Why: GitHub's row hover surfaces inline status mutation. Mirror that for
// Huly — click the row's state badge to change state without opening the
// detail workspace. Falls back to opening the detail workspace if team
// states aren't loaded yet.
import React, { useEffect, useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { hulyGetTeamStates, hulyUpdateIssue } from '@/runtime/runtime-huly-client'
import { cn } from '@/lib/utils'
import type { HulyIssue, HulyIssueState } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import type { GlobalSettings } from '../../../shared/types'
import { stateToneClasses } from '@/lib/huly-presentation'
import { toast } from 'sonner'

type Props = {
  issue: HulyIssue
  sourceContext: TaskSourceContext | null
  settings: GlobalSettings | null | undefined
  onOpen: (issue: HulyIssue) => void
}

export function HulyTaskStateChanger({
  issue,
  sourceContext,
  settings,
  onOpen
}: Props): React.JSX.Element | null {
  const ctx = sourceContext ?? settings
  const [open, setOpen] = useState(false)
  const [states, setStates] = useState<HulyIssueState[]>([])
  const [saving, setSaving] = useState(false)
  const workspace = issue.workspaceName ?? undefined

  useEffect(() => {
    if (!open || !ctx || states.length > 0 || !issue.team.id) return
    let cancelled = false
    void hulyGetTeamStates(ctx, issue.team.id, workspace).then((result) => {
      if (!cancelled) setStates(result)
    })
    return () => {
      cancelled = true
    }
  }, [open, ctx, states.length, issue.team.id, workspace])

  const orderedStates = useMemo(() => states, [states])

  const handleSelect = async (stateId: string): Promise<void> => {
    if (!ctx || stateId === issue.state.id) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await hulyUpdateIssue(ctx, issue.id, { stateId }, workspace)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update state.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setOpen((current) => !current)
            if (states.length === 0) {
              onOpen(issue)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation()
            }
          }}
          className={cn(
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition',
            stateToneClasses(issue.state.type),
            'opacity-0 group-hover/huly-task-row:opacity-100 focus-visible:opacity-100'
          )}
          aria-label="Change state"
        >
          {saving ? <LoaderCircle className="size-3 animate-spin" /> : issue.state.name}
        </button>
      </PopoverTrigger>
      {orderedStates.length > 0 ? (
        <PopoverContent
          className="popover-scroll-content scrollbar-sleek w-52 p-1"
          align="start"
          onClick={(event) => event.stopPropagation()}
        >
          {orderedStates.map((state) => (
            <button
              key={state.id}
              type="button"
              disabled={state.id === issue.state.id || saving}
              onClick={() => void handleSelect(state.id)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-accent disabled:opacity-50"
            >
              <span>{state.name}</span>
              {state.id === issue.state.id ? (
                <span className="text-[10px] text-muted-foreground">current</span>
              ) : null}
            </button>
          ))}
        </PopoverContent>
      ) : null}
    </Popover>
  )
}