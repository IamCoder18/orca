import React, { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { hulyGetTeamStates } from '@/runtime/runtime-huly-client'
import { getHulyPriorityLabel } from '@/lib/huly-presentation'
import { getScreenSubmitShortcutLabel, isScreenSubmitShortcut } from '@/lib/screen-submit-shortcut'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { HulyProjectSummary } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (issueId: string) => void
  sourceContext: TaskSourceContext | null
  workspace: string | null
}

const PRIORITY_VALUES = [0, 1, 2, 3, 4] as const
const NO_STATE = 'no-state'

export function HulyCreateIssueDialog({
  open,
  onOpenChange,
  onCreated,
  sourceContext,
  workspace
}: Props): React.JSX.Element {
  const listProjects = useAppStore((s) => s.listHulyProjects)
  const createHulyIssue = useAppStore((s) => s.createHulyIssue)

  const [projects, setProjects] = useState<HulyProjectSummary[]>([])
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<number>(0)
  const [stateId, setStateId] = useState<string>(NO_STATE)
  const [states, setStates] = useState<{ id: string; name: string }[]>([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitShortcutLabel = getScreenSubmitShortcutLabel()

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listProjects({ sourceContext, workspace: workspace ?? undefined })
      .then((result) => {
        if (cancelled) return
        setProjects(result)
        setProjectId((current) => current || result[0]?.id || '')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.components.huly.createDialog.loadProjectsFailed', 'Failed to load projects.')
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, listProjects, sourceContext, workspace])

  useEffect(() => {
    const team = selectedProject?.team
    if (!team?.id) {
      setStates([])
      setStateId(NO_STATE)
      return
    }
    let cancelled = false
    setStatesLoading(true)
    void hulyGetTeamStates(sourceContext, team.id, workspace ?? undefined)
      .then((result) => {
        if (cancelled) return
        setStates(result.map((s) => ({ id: s.id, name: s.name })))
      })
      .catch(() => {
        if (!cancelled) setStates([])
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedProject?.team, sourceContext, workspace])

  const reset = (): void => {
    setTitle('')
    setDescription('')
    setPriority(0)
    setStateId(NO_STATE)
  }

  const handleCreate = async (): Promise<void> => {
    if (!title.trim() || !projectId) return
    setSubmitting(true)
    try {
      const created = await createHulyIssue(
        {
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority: priority > 0 ? priority : undefined,
          stateId: stateId === NO_STATE ? undefined : stateId
        },
        { sourceContext, workspace: workspace ?? undefined }
      )
      if (!created) {
        toast.error(translate('auto.components.huly.createDialog.createFailed', 'Failed to create Huly issue.'))
        return
      }
      toast.success(translate('auto.components.huly.createDialog.created', 'Issue created.'))
      reset()
      onCreated?.(created.id)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate('auto.components.huly.createDialog.createFailed', 'Failed to create Huly issue.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden"
        onKeyDown={(event) => {
          if (isScreenSubmitShortcut(event)) {
            event.preventDefault()
            void handleCreate()
          }
        }}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/10 px-5 py-3 space-y-0">
          <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {translate('auto.components.huly.createDialog.title', 'New Huly issue')}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label={translate('auto.components.huly.createDialog.close', 'Close')}
          >
            <X className="size-4" />
          </button>
        </DialogHeader>
        <DialogDescription className="sr-only">
          {translate('auto.components.huly.createDialog.description', 'Create a new Huly issue.')}
        </DialogDescription>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">
              {translate('auto.components.huly.createDialog.project', 'Project')}
            </span>
            <Select
              value={projectId || undefined}
              onValueChange={setProjectId}
              disabled={projects.length === 0}
            >
              <SelectTrigger className="mt-1 h-9 w-full text-xs">
                <SelectValue
                  placeholder={translate(
                    'auto.components.huly.createDialog.projectPlaceholder',
                    'Select a project…'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">
              {translate('auto.components.huly.createDialog.titleLabel', 'Title')}
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="mt-1"
              placeholder={translate(
                'auto.components.huly.createDialog.titlePlaceholder',
                'What needs to be done?'
              )}
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground">
              {translate('auto.components.huly.createDialog.descriptionLabel', 'Description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 h-28 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder={translate('auto.components.huly.createDialog.descriptionPlaceholder', 'Optional')}
              disabled={submitting}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
            <label className="block">
              <span className="sr-only">
                {translate('auto.components.huly.createDialog.priority', 'Priority')}
              </span>
              <Select
                value={String(priority)}
                onValueChange={(v) => setPriority(Number(v))}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_VALUES.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {getHulyPriorityLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {selectedProject?.team ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={submitting || statesLoading || states.length === 0}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-muted/15 px-2 text-xs transition',
                      'hover:bg-muted/50 disabled:opacity-50'
                    )}
                  >
                    {statesLoading ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : null}
                    <span>
                      {translate('auto.components.huly.createDialog.state', 'State: ')}
                      {states.find((s) => s.id === stateId)?.name ??
                        translate('auto.components.huly.createDialog.stateDefault', 'Default')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1">
                  <button
                    type="button"
                    onClick={() => setStateId(NO_STATE)}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    {translate('auto.components.huly.createDialog.stateDefault', 'Default')}
                  </button>
                  {states.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStateId(s.id)}
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      {s.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            ) : null}

            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-transparent px-2 text-xs text-muted-foreground"
              title={translate(
                'auto.components.huly.createDialog.assigneeTodo',
                'Assignee selector coming soon'
              )}
            >
              {translate('auto.components.huly.createDialog.assigneeUnassigned', 'Assignee: Unassigned')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-muted/5 px-5 py-3">
          <span className="text-[10px] font-medium text-muted-foreground/60">
            {translate(
              'auto.components.huly.createDialog.submitShortcut',
              '{shortcut} to submit.',
              { values: { shortcut: submitShortcutLabel } }
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              {translate('auto.components.huly.createDialog.cancel', 'Cancel')}
            </Button>
            <Button size="sm" onClick={() => void handleCreate()} disabled={!title.trim() || !projectId || submitting}>
              {submitting ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                translate('auto.components.huly.createDialog.create', 'Create')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}