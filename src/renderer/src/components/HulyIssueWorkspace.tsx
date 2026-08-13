import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, LoaderCircle, RefreshCw, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { HulyIcon } from '@/components/icons/HulyIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import { hulyAddComment, hulyGetIssue, hulyListComments, hulyListTeams, hulyGetTeamStates, hulyUpdateIssue } from '@/runtime/runtime-huly-client'
import type { HulyComment, HulyIssue, HulyIssueState } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'

type Props = {
  issue: HulyIssue
  onUse: (issue: HulyIssue) => void
  onClose: () => void
  sourceContext?: TaskSourceContext | null
}

const PRIORITY_LABEL: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low'
}

function stateToneClasses(type: string): string {
  const t = type.toLowerCase()
  if (t === 'done' || t === 'completed' || t === 'closed') {
    return 'border-status-success-border/50 bg-status-success-background/60 text-status-success'
  }
  if (t === 'in-progress' || t === 'started') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }
  return 'border-border bg-muted/60 text-muted-foreground'
}

function buildBranchName(issue: HulyIssue): string {
  const slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
  return `${issue.identifier.toLowerCase()}${slug ? `-${slug}` : ''}`
}

function buildPrompt(issue: HulyIssue): string {
  return `Complete Huly issue ${issue.identifier}: ${issue.title}\n\n${issue.url}`
}

export function HulyIssueWorkspace({ issue, onUse, onClose, sourceContext }: Props): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const providerSettings = sourceContext ?? settings
  const workspace = issue.workspaceName

  const [fullIssue, setFullIssue] = useState<HulyIssue>(issue)
  const [comments, setComments] = useState<HulyComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [states, setStates] = useState<HulyIssueState[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [savingState, setSavingState] = useState(false)

  const loadIssue = useCallback(async (): Promise<void> => {
    const fresh = await hulyGetIssue(providerSettings, issue.id, workspace ?? undefined)
    if (fresh) setFullIssue(fresh)
  }, [providerSettings, issue.id, workspace])

  const loadComments = useCallback(async (): Promise<void> => {
    setCommentsLoading(true)
    try {
      const fetched = await hulyListComments(providerSettings, issue.id, workspace ?? undefined)
      setComments(fetched)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load comments.')
    } finally {
      setCommentsLoading(false)
    }
  }, [providerSettings, issue.id, workspace])

  const loadTeamsAndStates = useCallback(async (): Promise<void> => {
    try {
      const teamsResult = await hulyListTeams(providerSettings, workspace ?? undefined)
      if (teamsResult.length > 0) {
        const statesResult = await hulyGetTeamStates(providerSettings, teamsResult[0].id, workspace ?? undefined)
        setStates(statesResult)
      }
    } catch (error) {
      console.warn('[huly] loadTeamsAndStates failed', error)
    }
  }, [providerSettings, workspace])

  useEffect(() => {
    void loadIssue()
    void loadComments()
    void loadTeamsAndStates()
  }, [loadIssue, loadComments, loadTeamsAndStates])

  const handleChangeState = async (stateId: string): Promise<void> => {
    setSavingState(true)
    try {
      const updated = await hulyUpdateIssue(
        providerSettings,
        issue.id,
        { stateId },
        workspace ?? undefined
      )
      if (updated) setFullIssue(updated)
      toast.success('State updated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update state.')
    } finally {
      setSavingState(false)
    }
  }

  const handleAddComment = async (): Promise<void> => {
    const body = commentDraft.trim()
    if (!body) return
    setSubmittingComment(true)
    try {
      const created = await hulyAddComment(
        providerSettings,
        { issueId: issue.id, body },
        workspace ?? undefined
      )
      if (created) {
        setComments((prev) => [created, ...prev])
        setCommentDraft('')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post comment.')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleUse = (): void => {
    onUse({
      ...fullIssue,
      branchName: buildBranchName(fullIssue),
      description: fullIssue.description ?? buildPrompt(fullIssue)
    })
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetTitle className="sr-only">Huly issue {fullIssue.identifier}</SheetTitle>
        <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
          <HulyIcon className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">{fullIssue.identifier}</p>
            <h2 className="truncate text-base font-semibold">{fullIssue.title}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {fullIssue.workspaceName ? `${fullIssue.workspaceName} / ${fullIssue.team.name}` : fullIssue.team.name}
            </p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${stateToneClasses(fullIssue.state.type)}`}
            >
              {fullIssue.state.name}
            </span>
            {fullIssue.priority > 0 ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {PRIORITY_LABEL[fullIssue.priority] ?? `Priority ${fullIssue.priority}`}
              </span>
            ) : null}
            {fullIssue.assignee ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {fullIssue.assignee.displayName}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/70">Unassigned</span>
            )}
          </div>

          {states.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">State:</span>
              <select
                value={fullIssue.state.id}
                disabled={savingState}
                onChange={(e) => void handleChangeState(e.target.value)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {savingState ? <LoaderCircle className="size-3 animate-spin text-muted-foreground" /> : null}
            </div>
          ) : null}

          {fullIssue.description ? (
            <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3">
              <pre className="scrollbar-sleek whitespace-pre-wrap text-xs text-foreground">
                {fullIssue.description}
              </pre>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                Comments ({comments.length})
              </p>
              <Button variant="ghost" size="xs" onClick={() => void loadComments()} disabled={commentsLoading}>
                <RefreshCw className={`size-3 ${commentsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <Input
                placeholder="Add a comment…"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleAddComment()
                  }
                }}
                disabled={submittingComment}
              />
              <div className="flex justify-end">
                <Button size="xs" onClick={() => void handleAddComment()} disabled={!commentDraft.trim() || submittingComment}>
                  {submittingComment ? <LoaderCircle className="size-3 animate-spin" /> : <Send className="size-3" />}
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">{comment.user?.displayName ?? 'You'}</span>
                    <span>{formatUiRelativeTimeFromDate(comment.createdAt)}</span>
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</pre>
                </div>
              ))}
              {comments.length === 0 && !commentsLoading ? (
                <p className="text-xs text-muted-foreground/70">No comments yet.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
          <Button size="sm" onClick={handleUse} className="flex-1">
            <ArrowRight className="mr-1.5 size-3.5" />
            Use in Worktree
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}