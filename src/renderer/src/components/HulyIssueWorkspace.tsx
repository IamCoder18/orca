import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  Send,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { VisuallyHidden } from 'radix-ui'
import { HulyIcon } from '@/components/icons/HulyIcon'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { hulyAddComment, hulyGetIssue, hulyGetTeamStates, hulyListComments, hulyUpdateIssue } from '@/runtime/runtime-huly-client'
import type { HulyComment, HulyIssue, HulyIssueState } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { getHulyPriorityLabel, stateToneClasses } from '@/lib/huly-presentation'
import { buildHulyPrompt } from '@/lib/huly-issue-workspace-helpers'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { HulyIssueActionSidebar } from './HulyIssueActionSidebar'
import { HulyIssueMetadataSidebar } from './HulyIssueMetadataSidebar'

type Props = {
  issue: HulyIssue
  onUse: (issue: HulyIssue) => void
  onClose: () => void
  sourceContext?: TaskSourceContext | null
}

export function HulyIssueWorkspace({ issue, onUse, onClose, sourceContext }: Props): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const providerSettings = sourceContext ?? settings
  const workspace = issue.workspaceName
  const teamId = issue.team.id

  const [fullIssue, setFullIssue] = useState<HulyIssue>(issue)
  const [comments, setComments] = useState<HulyComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [states, setStates] = useState<HulyIssueState[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [savingState, setSavingState] = useState(false)
  const requestIdRef = useRef(0)

  const loadComments = useCallback(async (requestId: number): Promise<void> => {
    setCommentsLoading(true)
    setCommentsError(null)
    try {
      const fetched = await hulyListComments(providerSettings, issue.id, workspace ?? undefined)
      if (requestId !== requestIdRef.current) return
      setComments(fetched)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setCommentsError(error instanceof Error ? error.message : 'Failed to load comments.')
    } finally {
      if (requestId === requestIdRef.current) {
        setCommentsLoading(false)
      }
    }
  }, [providerSettings, issue.id, workspace])

  const loadTeamStates = useCallback(async (): Promise<void> => {
    if (!teamId) {
      setStates([])
      return
    }
    try {
      const statesResult = await hulyGetTeamStates(providerSettings, teamId, workspace ?? undefined)
      setStates(statesResult)
    } catch (error) {
      console.warn('[huly] loadTeamStates failed', error)
      setStates([])
    }
  }, [providerSettings, teamId, workspace])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Why: the parent already supplies a fully-populated HulyIssue; only refetch
      // when description is missing so the user always sees a complete sheet.
      if (!fullIssue.description) {
        try {
          const fresh = await hulyGetIssue(providerSettings, issue.id, workspace ?? undefined)
          if (!cancelled && fresh) setFullIssue(fresh)
        } catch {
          // Why: silent — the cached prop is still rendered.
        }
      }
      if (cancelled) return
      requestIdRef.current += 1
      await Promise.all([loadComments(requestIdRef.current), loadTeamStates()])
    })()
    return () => {
      cancelled = true
    }
  }, [providerSettings, issue.id, workspace, fullIssue.description, loadComments, loadTeamStates])

  const handleChangeState = async (stateId: string): Promise<void> => {
    setSavingState(true)
    try {
      const updated = await hulyUpdateIssue(
        providerSettings,
        issue.id,
        { stateId },
        workspace ?? undefined
      )
      if (updated) {
        setFullIssue(updated)
        toast.success(translate('auto.components.huly.issueWorkspace.stateUpdated', 'State updated.'))
      } else {
        toast.error(translate('auto.components.huly.issueWorkspace.stateUpdateFailed', 'State update returned no result.'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate('auto.components.huly.issueWorkspace.stateUpdateError', 'Failed to update state.')
      )
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
      } else {
        toast.error(translate('auto.components.huly.issueWorkspace.commentPostFailed', 'Failed to post comment.'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate('auto.components.huly.issueWorkspace.commentPostError', 'Failed to post comment.')
      )
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleUse = (): void => {
    onUse({
      ...fullIssue,
      description: fullIssue.description ?? buildHulyPrompt(fullIssue)
    })
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 sm:max-w-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden.Root asChild>
          <SheetTitle>{fullIssue.title}</SheetTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <SheetDescription>
            {translate('auto.components.huly.issueWorkspace.description', 'Preview, edit, and start work from the selected Huly issue.')}
          </SheetDescription>
        </VisuallyHidden.Root>

        <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
          <HulyIcon className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{fullIssue.identifier}</span>
              {fullIssue.workspaceName ? <span>{fullIssue.workspaceName}</span> : null}
              <span>{fullIssue.team.name}</span>
              <span>{formatUiRelativeTimeFromDate(fullIssue.updatedAt)}</span>
            </div>
            <h2 className="mt-1 truncate text-base font-semibold">{fullIssue.title}</h2>
          </div>
          <Button
            size="sm"
            onClick={handleUse}
            className="hidden shrink-0 gap-2 sm:inline-flex"
          >
            {translate('auto.components.huly.issueWorkspace.useInWorktree', 'Use in Worktree')}
            <ArrowRight className="size-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.components.huly.issueWorkspace.close', 'Close')}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="scrollbar-sleek flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  stateToneClasses(fullIssue.state.type)
                )}
              >
                {fullIssue.state.name}
              </span>
              {fullIssue.priority > 0 ? (
                <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {getHulyPriorityLabel(fullIssue.priority)}
                </span>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {fullIssue.assignee?.displayName ??
                  translate('auto.components.huly.issueWorkspace.unassigned', 'Unassigned')}
              </span>

              {states.length > 0 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={savingState}
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted/40 disabled:opacity-50"
                    >
                      <span>{translate('auto.components.huly.issueWorkspace.stateLabel', 'State:')}</span>
                      <span className="font-medium text-foreground/80">{fullIssue.state.name}</span>
                      {savingState ? <LoaderCircle className="size-3 animate-spin" /> : null}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="popover-scroll-content scrollbar-sleek w-52 p-1"
                    align="start"
                  >
                    {states.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.id === fullIssue.state.id || savingState}
                        onClick={() => void handleChangeState(s.id)}
                        className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-accent disabled:opacity-50"
                      >
                        <span>{s.name}</span>
                        {s.id === fullIssue.state.id ? (
                          <span className="text-[10px] text-muted-foreground">
                            {translate('auto.components.huly.issueWorkspace.currentState', 'current')}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>

            {fullIssue.description ? (
              <div className="mt-4">
                <CommentMarkdown
                  content={fullIssue.description}
                  variant="document"
                  className="text-[13px] leading-relaxed"
                />
              </div>
            ) : null}

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  {translate('auto.components.huly.issueWorkspace.commentsTitle', 'Comments ({count})', {
                    values: { count: comments.length }
                  })}
                </p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    requestIdRef.current += 1
                    void loadComments(requestIdRef.current)
                  }}
                  disabled={commentsLoading}
                >
                  <RefreshCw className={`size-3 ${commentsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {commentsError ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <span>{commentsError}</span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      requestIdRef.current += 1
                      void loadComments(requestIdRef.current)
                    }}
                    disabled={commentsLoading}
                    className="gap-1"
                  >
                    {commentsLoading ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    {translate('auto.components.huly.issueWorkspace.retry', 'Retry')}
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      void handleAddComment()
                    }
                  }}
                  placeholder={translate('auto.components.huly.issueWorkspace.commentPlaceholder', 'Add a comment…')}
                  rows={2}
                  disabled={submittingComment}
                  className="min-h-10 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <div className="flex justify-end">
                  <Button
                    size="xs"
                    onClick={() => void handleAddComment()}
                    disabled={!commentDraft.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      <Send className="size-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground">
                      {comment.user?.displayName ??
                        translate('auto.components.huly.issueWorkspace.you', 'You')}
                    </span>
                      <span>{formatUiRelativeTimeFromDate(comment.createdAt)}</span>
                    </div>
                    <div className="mt-1">
                      <CommentMarkdown
                        content={comment.body}
                        className="text-[12px] leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
                {comments.length === 0 && !commentsLoading && !commentsError ? (
                  <p className="text-xs text-muted-foreground/70">
                    {translate('auto.components.huly.issueWorkspace.noComments', 'No comments yet.')}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="hidden w-56 shrink-0 overflow-y-auto border-t border-border/50 bg-muted/20 px-3 py-3 xl:flex xl:flex-col xl:border-l xl:border-t-0">
            <Button onClick={handleUse} className="mb-3 w-full gap-2">
              {translate('auto.components.huly.issueWorkspace.useInWorktree', 'Use in Worktree')}
              <ArrowRight className="size-3.5" />
            </Button>
            <HulyIssueMetadataSidebar issue={fullIssue} />
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </p>
              <HulyIssueActionSidebar issue={fullIssue} />
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  )
}