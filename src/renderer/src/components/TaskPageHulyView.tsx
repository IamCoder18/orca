import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, ExternalLink, LoaderCircle, Plus, Search } from 'lucide-react'
import { HulyIcon } from '@/components/icons/HulyIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import type { HulyIssue, HulyListFilter } from '../../../shared/huly'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { HulyIssueWorkspace } from './HulyIssueWorkspace'
import { HulyCreateIssueDialog } from './HulyCreateIssueDialog'
import { stateToneClasses } from '@/lib/huly-presentation'
import { HulyPriorityIcon } from '@/lib/huly-priority-icon'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
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

type SortOrder = 'updated' | 'priority' | 'identifier'

const FILTERS: { id: HulyListFilter; label: string }[] = [
  {
    id: 'assigned',
    label: translate('auto.components.TaskPage.huly.filter.assigned', 'Assigned to me')
  },
  {
    id: 'created',
    label: translate('auto.components.TaskPage.huly.filter.created', 'Created by me')
  },
  {
    id: 'all',
    label: translate('auto.components.TaskPage.huly.filter.allOpen', 'All open')
  }
]

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: 'updated', label: translate('auto.components.TaskPage.huly.sort.updated', 'Updated') },
  { id: 'priority', label: translate('auto.components.TaskPage.huly.sort.priority', 'Priority') },
  { id: 'identifier', label: translate('auto.components.TaskPage.huly.sort.identifier', 'Identifier') }
]

const ALL_WORKSPACES = '__all__'

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
  const [filter, setFilter] = useState<HulyListFilter>('assigned')
  const [sort, setSort] = useState<SortOrder>('updated')
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
      { filter, limit: 50 },
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
        <HulyIcon className="mb-4 size-8 text-muted-foreground/60" />
        <p className="text-base font-medium text-foreground">
          {translate('auto.components.TaskPage.huly.notConnected.title', 'Connect Huly')}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {translate(
            'auto.components.TaskPage.huly.notConnected.body',
            'Browse, create, and start work from Huly issues directly from here. Run `huly auth login` on the host, then click Connect in Settings.'
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
      <div className="flex h-10 flex-none items-center gap-2 border-b border-border/50 bg-muted/35 px-3">
        {workspaces.length > 1 ? (
          <Select
            value={selectedWorkspace ?? ALL_WORKSPACES}
            onValueChange={(value) => onSelectWorkspace(value === ALL_WORKSPACES ? null : value)}
          >
            <SelectTrigger className="h-7 w-[160px] rounded-md border-border/50 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_WORKSPACES}>
                {translate('auto.components.TaskPage.huly.allWorkspaces', 'All workspaces')}
              </SelectItem>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.name}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setFilter(preset.id)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs transition',
                filter === preset.id
                  ? 'border-foreground/40 bg-foreground/90 text-background'
                  : 'border-border/50 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
          <SelectTrigger className="ml-auto h-7 w-[140px] text-xs">
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

        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={translate('auto.components.TaskPage.huly.searchPlaceholder', 'Search…')}
            className="h-7 pl-7 text-xs"
          />
        </div>

        <Button size="xs" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-3" />
          {translate('auto.components.TaskPage.huly.newIssue', 'New issue')}
        </Button>

        <span className="shrink-0 text-[11px] text-muted-foreground">
          {translate('auto.components.TaskPage.huly.shownCount', '{count} shown', {
            values: { count: issues.length }
          })}
        </span>
      </div>

      {loading && issues.length === 0 ? (
        <div className="divide-y divide-border/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-3 py-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70" />
              <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted/60" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="px-4 py-6 text-sm text-destructive">{error}</div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {translate('auto.components.TaskPage.huly.empty.title', 'No Huly issues')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? translate('auto.components.TaskPage.huly.empty.search', 'No issues match your search.')
              : translate('auto.components.TaskPage.huly.empty.preset', 'No issues match the selected preset.')}
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y divide-border/50">
            {filtered.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => setSelectedIssueId(issue.id)}
                className="flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {issue.identifier}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        stateToneClasses(issue.state.type)
                      )}
                    >
                      {issue.state.name}
                    </span>
                    {issue.priority > 0 ? (
                      <HulyPriorityIcon priority={issue.priority} />
                    ) : null}
                    {issue.labels.slice(0, 2).map((label) => (
                      <span
                        key={label}
                        className="shrink-0 truncate rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        title={label}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{issue.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {issue.workspaceName && workspaces.length > 1
                      ? `${issue.workspaceName} / ${issue.team.name}`
                      : issue.team.name}
                    {' · '}
                    {issue.assignee?.displayName ?? 'Unassigned'}
                    {' · '}
                    {formatUiRelativeTimeFromDate(issue.updatedAt)}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={translate('auto.components.TaskPage.huly.openInHuly', 'Open in Huly')}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.api.shell.openUrl(issue.url)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      window.api.shell.openUrl(issue.url)
                    }
                  }}
                  className="mt-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
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