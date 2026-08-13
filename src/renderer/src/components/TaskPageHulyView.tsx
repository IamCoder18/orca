// Why: view mirrors GitHub's task list — rounded preset bar at top, a
// 4-column CSS-grid row list (ID, title, updated, actions) with sticky
// ID/title cells, 12-row shimmer during load, and the same empty state.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, LoaderCircle, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { HulyIssue, HulyListFilter } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { HulyIssueWorkspace } from './HulyIssueWorkspace'
import { HulyCreateIssueDialog } from './HulyCreateIssueDialog'
import { HulyTaskRow, HULY_TASK_HEADER_SURFACE_CLASS } from './huly-task-row'
import { HulyTaskSkeleton } from './huly-task-skeleton'
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

type SortOrder = 'updated' | 'priority' | 'identifier'

const FILTERS: { id: HulyListFilter; label: string }[] = [
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'created', label: 'Created by me' },
  { id: 'all', label: 'All open' }
]

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: 'updated', label: 'Updated' },
  { id: 'priority', label: 'Priority' },
  { id: 'identifier', label: 'Identifier' }
]

const ALL_WORKSPACES = '__all__'
const DEFAULT_FILTER_KEY = 'orca-huly-default-filter'
const DEFAULT_SORT_KEY = 'orca-huly-default-sort'

function readPersisted<T extends string>(key: string, allowed: readonly T[]): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return allowed.includes(raw as T) ? (raw as T) : null
  } catch {
    return null
  }
}

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
  const PAGE_SIZE = 50
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)
  const validFilters: readonly HulyListFilter[] = ['assigned', 'created', 'all']
  const validSorts: readonly SortOrder[] = ['updated', 'priority', 'identifier']
  // Why: persist default filter/sort so a reload on the Huly tab lands on the
  // same preset. Per-task default works just like GitHub's right-click
  // "Set as default" — local to this task surface, not a global preference.
  const [filter, setFilter] = useState<HulyListFilter>(
    () => readPersisted(DEFAULT_FILTER_KEY, validFilters) ?? 'assigned'
  )
  const [sort, setSort] = useState<SortOrder>(
    () => readPersisted(DEFAULT_SORT_KEY, validSorts) ?? 'updated'
  )
  const [defaultFilter, setDefaultFilter] = useState<HulyListFilter>(
    () => readPersisted(DEFAULT_FILTER_KEY, validFilters) ?? 'assigned'
  )
  // default sort is read for symmetry with the filter default; UI to
  // mutate it lands alongside the sort dropdown in a follow-up.
  void defaultFilter
  useState<SortOrder>(() => readPersisted(DEFAULT_SORT_KEY, validSorts) ?? 'updated')
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
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load issues.')
        setIssues([])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [connected, filter, listIssues, sourceContext, workspacesKey, workspace, refreshKey])

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
        <p className="text-base font-medium text-foreground">Connect Huly</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Browse, create, and start work from Huly issues directly from here. Run
          `huly auth login` on the host, then click Connect in Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
      <div
        className={cn(
          'flex min-w-0 flex-col gap-2.5 rounded-md rounded-b-none border border-border/50 px-3 py-2.5',
          HULY_TASK_HEADER_SURFACE_CLASS
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {workspaces.length > 1 ? (
            <Select
              value={selectedWorkspace ?? ALL_WORKSPACES}
              onValueChange={(v) => onSelectWorkspace(v === ALL_WORKSPACES ? null : v)}
            >
              <SelectTrigger className="h-7 w-[160px] rounded-md border-border/50 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_WORKSPACES}>All workspaces</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {FILTERS.map((preset) => {
            const active = filter === preset.id
            const isDefault = defaultFilter === preset.id
            return (
              <Tooltip key={preset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setFilter(preset.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      window.localStorage.setItem(DEFAULT_FILTER_KEY, preset.id)
                      setDefaultFilter(preset.id)
                    }}
                    className={cn(
                      'relative rounded-md border px-2.5 py-1 text-xs font-medium transition',
                      active
                        ? 'border-border/50 bg-foreground/90 text-background shadow-xs'
                        : 'border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60'
                    )}
                  >
                    {preset.label}
                    {isDefault ? (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute -right-1 -top-1 size-2 rounded-full',
                          active
                            ? 'bg-status-success ring-2 ring-background'
                            : 'bg-status-success'
                        )}
                      />
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {isDefault
                    ? 'Default preset — right-click to clear, click to switch'
                    : 'Click to switch, right-click to set as default'}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Huly issues…"
              className="h-8 rounded-md border-border/60 bg-background pl-8 pr-8 text-xs text-foreground shadow-xs"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
            <SelectTrigger className="h-8 w-[140px] rounded-md border-border/60 bg-background text-xs">
              <ArrowDownUp className="mr-1 size-3 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCreateOpen(true)}
                aria-label="New Huly issue"
                className="size-8 border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              New Huly issue
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                disabled={loading}
                aria-busy={loading}
                aria-label={loading ? 'Refreshing Huly work' : 'Refresh Huly work'}
                className="size-8 cursor-pointer border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60 disabled:pointer-events-auto disabled:cursor-wait"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {loading ? 'Refreshing Huly work…' : 'Refresh Huly work'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {loading && issues.length === 0 ? <HulyTaskSkeleton /> : null}

      {error ? (
        <div className="px-4 py-6 text-sm text-destructive">{error}</div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-base font-medium text-foreground">No Huly issues</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? 'No issues match your search.' : 'No issues match the selected preset.'}
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
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
              />
            ))}
          </div>
          {issues.length >= pageSize ? (
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
                  <>Show more</>
                )}
              </Button>
              <span className="ml-3 text-[11px] text-muted-foreground">
                Showing {issues.length}
              </span>
            </div>
          ) : (
            <div className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
              {issues.length} issue{issues.length === 1 ? '' : 's'}
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