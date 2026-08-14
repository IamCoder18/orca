// Why: toolbar extracted from TaskPageHulyView so the parent can stay under
// the 400-line .tsx max-lines ratchet while still owning the list state.
import React from 'react'
import { ArrowDownUp, LoaderCircle, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { HulyListFilter } from '../../../shared/huly'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  HULY_ALL_WORKSPACES,
  HULY_DEFAULT_FILTER_KEY,
  HULY_FILTERS,
  HULY_SORTS,
  hulyFilterLabel,
  hulySortLabel,
  type HulySortOrder
} from './task-page-huly-labels'

type Props = {
  workspaces: { id: string; name: string; url: string }[]
  selectedWorkspace: string | null
  onSelectWorkspace: (name: string | null) => void
  filter: HulyListFilter
  defaultFilter: HulyListFilter | null
  onChangeFilter: (filter: HulyListFilter) => void
  onSetDefaultFilter: (filter: HulyListFilter) => void
  sort: HulySortOrder
  onChangeSort: (sort: HulySortOrder) => void
  search: string
  onChangeSearch: (search: string) => void
  loading: boolean
  onRefresh: () => void
  onCreate: () => void
}

export function TaskPageHulyToolbar(props: Props): React.JSX.Element {
  const {
    workspaces,
    selectedWorkspace,
    onSelectWorkspace,
    filter,
    defaultFilter,
    onChangeFilter,
    onSetDefaultFilter,
    sort,
    onChangeSort,
    search,
    onChangeSearch,
    loading,
    onRefresh,
    onCreate
  } = props
  const FILTER_PRESETS: HulyListFilter[] = [...HULY_FILTERS]
  const SORT_PRESETS: HulySortOrder[] = [...HULY_SORTS]
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-md rounded-b-none border border-border/50 px-3 py-2.5',
        '[background:color-mix(in_srgb,var(--muted)_25%,var(--background))]'
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        {workspaces.length > 1 ? (
          <Select
            value={selectedWorkspace ?? HULY_ALL_WORKSPACES}
            onValueChange={(v) => onSelectWorkspace(v === HULY_ALL_WORKSPACES ? null : v)}
          >
            <SelectTrigger className="h-7 w-[160px] rounded-md border-border/50 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={HULY_ALL_WORKSPACES}>
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
        {FILTER_PRESETS.map((preset) => {
          const active = filter === preset
          const isDefault = defaultFilter !== null && defaultFilter === preset
          return (
            <Tooltip key={preset}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChangeFilter(preset)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    window.localStorage.setItem(HULY_DEFAULT_FILTER_KEY, preset)
                    onSetDefaultFilter(preset)
                  }}
                  className={cn(
                    'relative rounded-md border px-2.5 py-1 text-xs font-medium transition',
                    active
                      ? 'border-border/50 bg-foreground/90 text-background shadow-xs'
                      : 'border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60'
                  )}
                >
                  {hulyFilterLabel(preset)}
                  {isDefault ? (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -right-1 -top-1 size-2 rounded-full',
                        active ? 'bg-status-success ring-2 ring-background' : 'bg-status-success'
                      )}
                    />
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {isDefault
                  ? translate(
                      'auto.components.TaskPage.huly.filter.defaultClear',
                      'Default preset — right-click to clear, click to switch'
                    )
                  : translate(
                      'auto.components.TaskPage.huly.filter.defaultSet',
                      'Click to switch, right-click to set as default'
                    )}
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
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={translate('auto.components.TaskPage.huly.searchPlaceholder', 'Search Huly issues…')}
            className="h-8 rounded-md border-border/60 bg-background pl-8 pr-8 text-xs text-foreground shadow-xs"
          />
          {search ? (
            <button
              type="button"
              aria-label={translate('auto.components.TaskPage.huly.clearSearch', 'Clear search')}
              onClick={() => onChangeSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Select value={sort} onValueChange={(v) => onChangeSort(v as HulySortOrder)}>
          <SelectTrigger className="h-8 w-[140px] rounded-md border-border/60 bg-background text-xs">
            <ArrowDownUp className="mr-1 size-3 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_PRESETS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {hulySortLabel(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onCreate}
              aria-label={translate('auto.components.TaskPage.huly.newIssue', 'New Huly issue')}
              className="size-8 border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60"
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPage.huly.newIssue', 'New Huly issue')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={loading}
              aria-busy={loading}
              aria-label={
                loading
                  ? translate('auto.components.TaskPage.huly.refreshing', 'Refreshing Huly work')
                  : translate('auto.components.TaskPage.huly.refresh', 'Refresh Huly work')
              }
              className="size-8 cursor-pointer border-border/60 bg-background text-foreground shadow-xs hover:bg-muted/60 disabled:pointer-events-auto disabled:cursor-wait"
            >
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {loading
              ? translate('auto.components.TaskPage.huly.refreshing', 'Refreshing Huly work…')
              : translate('auto.components.TaskPage.huly.refresh', 'Refresh Huly work')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}