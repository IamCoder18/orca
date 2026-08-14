// Why: view mirrors GitHub's task list — toolbar at top (filter chips,
// search, sort, refresh, new), a 4-column CSS-grid row list (ID, title,
// updated, actions) with sticky ID/title cells, 12-row shimmer during load,
// and the same empty state.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import type { HulyIssue, HulyListFilter } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { HulyIssueWorkspace } from './HulyIssueWorkspace'
import { HulyCreateIssueDialog } from './HulyCreateIssueDialog'
import {
  HulyTaskRow,
  HULY_TASK_GRID_CLASS,
  HULY_TASK_HEADER_SURFACE_CLASS,
  HULY_TASK_STICKY_ID_CELL_CLASS,
  HULY_TASK_STICKY_TITLE_CELL_CLASS
} from './huly-task-row'
import { HulyTaskSkeleton } from './huly-task-skeleton'
import { TaskPageHulyToolbar } from './TaskPageHulyToolbar'
import {
  HULY_DEFAULT_FILTER_KEY,
  HULY_FILTERS,
  readPersistedHulyPreference,
  type HulySortOrder
} from './task-page-huly-labels'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

type Props = {
  sourceContext: TaskSourceContext | null
  connected: boolean
  statusReady: boolean
  workspaces: { id: string; name: string; url: string }[]
  selectedWorkspace: string | null
  onSelectWorkspace: (name: string | null) => void
  onUseIssue: (issue: HulyIssue) => void
}

const PAGE_SIZE = 50

export function TaskPageHulyView({
  sourceContext,
  connected,
  statusReady,
  workspaces,
  selectedWorkspace,
  onSelectWorkspace,
  onUseIssue
}: Props): React.JSX.Element {
  const listIssues = useAppStore((s) => s.listHulyIssues)
  const settings = useAppStore((s) => s.settings)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)
  // Why: persist default filter so a reload on the Huly tab lands on the
  // same preset. Per-task default works just like GitHub's right-click
  // "Set as default" — local to this task surface, not a global preference.
  const [filter, setFilter] = useState<HulyListFilter>(
    () => readPersistedHulyPreference(HULY_DEFAULT_FILTER_KEY, HULY_FILTERS) ?? 'assigned'
  )
  const [sort, setSort] = useState<HulySortOrder>('updated')
  const [defaultFilter, setDefaultFilter] = useState<HulyListFilter | null>(() =>
    readPersistedHulyPreference(HULY_DEFAULT_FILTER_KEY, HULY_FILTERS)
  )
  const [search, setSearch] = useState('')
  const [issues, setIssues] = useState<HulyIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const workspacesKey = workspaces.map((w) => w.id).join(',')
  const workspace = selectedWorkspace

  const handleCreated = useCallback((): void => {
    setCreateOpen(false)
    setRefreshKey((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!connected) {
      setIssues([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void listIssues(
      { filter, limit: pageSize },
      { sourceContext, workspace: workspace ?? undefined }
    )
      .then((result) => {
        if (cancelled) return
        setIssues(result)
        setLoading(false)
        setLoadMoreLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load issues.')
        setIssues([])
        setLoading(false)
        setLoadMoreLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [connected, filter, listIssues, sourceContext, workspacesKey, workspace, refreshKey, pageSize])

  const sorted = useMemo(() => {
    const list = [...issues]
    if (sort === 'priority') {
      list.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    } else if (sort === 'identifier') {
      list.sort((a, b) => a.identifier.localeCompare(b.identifier))
    } else {
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    }
    return list
  }, [issues, sort])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (issue) =>
        issue.title.toLowerCase().includes(q) ||
        issue.identifier.toLowerCase().includes(q) ||
        issue.team.name.toLowerCase().includes(q)
    )
  }, [sorted, search])

  const selectedIssue = filtered.find((i) => i.id === selectedIssueId) ?? null
  const showTeam = workspaces.length > 1
  const refresh = useCallback(() => setRefreshKey((n) => n + 1), [])

  const handleRowUpdate = useCallback((updated: HulyIssue): void => {
    setIssues((prev) => prev.map((issue) => (issue.id === updated.id ? updated : issue)))
  }, [])

  if (!statusReady) {
    return (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
        <p className="text-base font-medium text-foreground">
          {translate('auto.components.TaskPage.huly.connect.heading', 'Connect Huly')}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {translate(
            'auto.components.TaskPage.huly.connect.body',
            'Browse, create, and start work from Huly issues directly from here. Run `huly auth login` on the host, then click Connect in Settings.'
          )}
        </p>
      </div>
    )
  }

  const showingMore = issues.length >= pageSize

  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
      <TaskPageHulyToolbar
        workspaces={workspaces}
        selectedWorkspace={selectedWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        filter={filter}
        defaultFilter={defaultFilter}
        onChangeFilter={setFilter}
        onSetDefaultFilter={setDefaultFilter}
        sort={sort}
        onChangeSort={setSort}
        search={search}
        onChangeSearch={setSearch}
        loading={loading}
        onRefresh={refresh}
        onCreate={() => setCreateOpen(true)}
      />

      {loading && issues.length === 0 ? <HulyTaskSkeleton /> : null}

      {error ? (
        <div className="px-4 py-6 text-sm text-destructive">{error}</div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-base font-medium text-foreground">
            {translate('auto.components.TaskPage.huly.empty.heading', 'No Huly issues')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? translate('auto.components.TaskPage.huly.empty.searchNone', 'No issues match your search.')
              : translate('auto.components.TaskPage.huly.empty.presetNone', 'No issues match the selected preset.')}
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              'sticky top-0 z-40 h-8 border-b border-border/50 px-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground [&>div]:flex [&>div]:items-center',
              HULY_TASK_HEADER_SURFACE_CLASS,
              HULY_TASK_GRID_CLASS
            )}
          >
            <div className={HULY_TASK_STICKY_ID_CELL_CLASS}>
              {translate('auto.components.TaskPage.huly.column.id', 'ID')}
            </div>
            <div className={HULY_TASK_STICKY_TITLE_CELL_CLASS}>
              {translate('auto.components.TaskPage.huly.column.title', 'Title / Context')}
            </div>
            <div>{translate('auto.components.TaskPage.huly.column.updated', 'Updated')}</div>
            <div />
          </div>
          <div className="divide-y divide-border/40">
            {filtered.map((issue) => (
              <HulyTaskRow
                key={issue.id}
                issue={issue}
                showTeam={showTeam}
                sourceContext={sourceContext}
                settings={settings}
                onOpen={(i) => setSelectedIssueId(i.id)}
                onOpenInHuly={(i) => void window.api.shell.openUrl(i.url)}
                onUse={onUseIssue}
                onIssueUpdate={handleRowUpdate}
              />
            ))}
          </div>
          {showingMore ? (
            <div className="flex items-center justify-center border-t border-border/40 bg-muted/20 px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={loadMoreLoading}
                onClick={() => {
                  setLoadMoreLoading(true)
                  setPageSize((s) => s + PAGE_SIZE)
                }}
              >
                {loadMoreLoading ? (
                  <LoaderCircle className="size-3 animate-spin" />
                ) : (
                  translate('auto.components.TaskPage.huly.showMore', 'Show more')
                )}
              </Button>
              <span className="ml-3 text-[11px] text-muted-foreground">
                {translate('auto.components.TaskPage.huly.showingCount', 'Showing {count}', {
                  count: issues.length
                })}
              </span>
            </div>
          ) : (
            <div className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
              {translate('auto.components.TaskPage.huly.issueCount', '{count} issue | {count} issues', {
                count: issues.length
              })}
            </div>
          )}
        </div>
      ) : null}

      {selectedIssue ? (
        <HulyIssueWorkspace
          issue={selectedIssue}
          onUse={onUseIssue}
          onClose={() => setSelectedIssueId(null)}
          sourceContext={sourceContext}
        />
      ) : null}

      {createOpen ? (
        <HulyCreateIssueDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleCreated}
          sourceContext={sourceContext}
          workspace={workspace ?? null}
        />
      ) : null}
    </div>
  )
}