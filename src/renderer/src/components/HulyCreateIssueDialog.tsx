import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import { PRIORITY_LABEL } from '@/lib/huly-presentation'
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
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void listProjects({ sourceContext, workspace: workspace ?? undefined })
      .then((result) => {
        setProjects(result)
        if (!projectId && result.length > 0) {
          setProjectId(result[0]?.id ?? '')
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load projects.')
      })
  }, [open, listProjects, sourceContext, workspace, projectId])

  const reset = (): void => {
    setTitle('')
    setDescription('')
    setPriority(0)
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
          priority: priority > 0 ? priority : undefined
        },
        { sourceContext, workspace: workspace ?? undefined }
      )
      if (!created) {
        toast.error('Failed to create Huly issue.')
        return
      }
      toast.success('Issue created.')
      reset()
      onCreated?.(created.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create Huly issue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetTitle className="px-4 pt-3 text-sm font-medium">New Huly issue</SheetTitle>
        <div className="flex-1 space-y-3 px-4 py-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Title</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              placeholder="What needs to be done?"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 h-32 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Priority</span>
            <select
              value={String(priority)}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {PRIORITY_VALUES.map((value) => (
                <option key={value} value={String(value)}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!title.trim() || !projectId || submitting}
          >
            Create
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export type { Props as HulyCreateIssueDialogProps }
