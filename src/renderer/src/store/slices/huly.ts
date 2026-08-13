import type { StateCreator } from 'zustand'
import type {
  HulyConnectionStatus,
  HulyIssue,
  HulyIssueCreateArgs,
  HulyIssueUpdate,
  HulyListFilter,
  HulyPreflight,
  HulyProjectSummary,
  HulyTeamSummary
} from '../../../../shared/huly'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import type { AppState } from '../types'
import {
  getTaskSourceCacheScope,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import {
  hulyCreateIssue,
  hulyDisable,
  hulyEnable,
  hulyListIssues,
  hulyListProjects,
  hulyListTeams,
  hulyPreflight,
  hulyStatus,
  hulyUpdateIssue
} from '@/runtime/runtime-huly-client'
import type { CacheEntry } from './github'

const CACHE_TTL = 60_000
const MAX_CACHE_ENTRIES = 200

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && entry.data !== null && Date.now() - entry.fetchedAt < CACHE_TTL
}

function evictStaleEntries<T>(cache: Record<string, CacheEntry<T>>): Record<string, CacheEntry<T>> {
  const now = Date.now()
  const byAge: Record<string, CacheEntry<T>> = {}
  for (const [key, entry] of Object.entries(cache)) {
    if (now - entry.fetchedAt < CACHE_TTL) {
      byAge[key] = entry
    }
  }
  const keys = Object.keys(byAge)
  if (keys.length <= MAX_CACHE_ENTRIES) return byAge
  const sorted = keys.sort((a, b) => (byAge[a]?.fetchedAt ?? 0) - (byAge[b]?.fetchedAt ?? 0))
  const pruned: Record<string, CacheEntry<T>> = {}
  for (const key of sorted.slice(sorted.length - MAX_CACHE_ENTRIES)) {
    pruned[key] = byAge[key]
  }
  return pruned
}

export type HulyFetchOptions = {
  sourceContext?: TaskSourceContext | null
  workspace?: string | null
  force?: boolean
}

export type HulyListArgs = { filter?: HulyListFilter; limit?: number }

function hulyCallContext(
  sourceContext?: TaskSourceContext | null
): { activeRuntimeEnvironmentId: string | null } {
  if (!sourceContext) return { activeRuntimeEnvironmentId: null }
  return {
    activeRuntimeEnvironmentId:
      sourceContext.hostId?.startsWith('runtime:') ? sourceContext.hostId.slice('runtime:'.length) : null
  }
}

function hulyCacheScope(sourceContext?: TaskSourceContext | null): string {
  return sourceContext ? getTaskSourceCacheScope(sourceContext) : 'local'
}

function workspacePart(workspace?: string | null): string {
  return workspace ?? '__active__'
}

export type HulySlice = {
  hulyStatus: HulyConnectionStatus | null
  hulyStatusChecked: boolean
  hulyStatusContextKey: string | null
  hulyPreflightStatus: HulyPreflight | null
  hulyListCache: Record<string, CacheEntry<HulyIssue[]>>
  hulyProjectsCache: Record<string, CacheEntry<HulyProjectSummary[]>>
  hulyTeamsCache: Record<string, CacheEntry<HulyTeamSummary[]>>

  checkHulyConnection: (force?: boolean) => Promise<void>
  refreshHulyPreflight: () => Promise<void>
  enableHuly: () => Promise<HulyConnectionStatus | null>
  disableHuly: () => Promise<void>

  listHulyIssues: (args?: HulyListArgs, options?: HulyFetchOptions) => Promise<HulyIssue[]>
  createHulyIssue: (args: HulyIssueCreateArgs, options?: HulyFetchOptions) => Promise<HulyIssue | null>
  updateHulyIssue: (id: string, update: HulyIssueUpdate, options?: HulyFetchOptions) => Promise<HulyIssue | null>

  listHulyProjects: (options?: HulyFetchOptions) => Promise<HulyProjectSummary[]>
  listHulyTeams: (options?: HulyFetchOptions) => Promise<HulyTeamSummary[]>
}

const initialHulyStatus: HulyConnectionStatus = {
  enabled: false,
  available: false,
  viewer: null,
  workspaces: []
}

export const createHulySlice: StateCreator<AppState, [], [], HulySlice> = (set, get) => ({
  hulyStatus: null,
  hulyStatusChecked: false,
  hulyStatusContextKey: null,
  hulyPreflightStatus: null,
  hulyListCache: {},
  hulyProjectsCache: {},
  hulyTeamsCache: {},

  async checkHulyConnection(force = false) {
    const settings = get().settings
    const contextKey = getProviderRuntimeContextKey(settings)
    if (!force && get().hulyStatusChecked && get().hulyStatusContextKey === contextKey) {
      return
    }
    try {
      const status = await hulyStatus(settings)
      set({
        hulyStatus: status,
        hulyStatusChecked: true,
        hulyStatusContextKey: contextKey
      })
    } catch (error) {
      console.warn('[huly] status failed', error)
      set({
        hulyStatus: { ...initialHulyStatus },
        hulyStatusChecked: true,
        hulyStatusContextKey: contextKey
      })
    }
  },

  async refreshHulyPreflight() {
    const settings = get().settings
    try {
      const result = await hulyPreflight(settings)
      set({ hulyPreflightStatus: result })
    } catch (error) {
      console.warn('[huly] preflight failed', error)
      set({
        hulyPreflightStatus: { installed: false, authenticated: false }
      })
    }
  },

  async enableHuly() {
    const settings = get().settings
    const status = await hulyEnable(settings)
    set({
      hulyStatus: status,
      hulyStatusChecked: true,
      hulyStatusContextKey: getProviderRuntimeContextKey(settings)
    })
    return status
  },

  async disableHuly() {
    const settings = get().settings
    try {
      await hulyDisable(settings)
    } catch (error) {
      console.warn('[huly] disable failed', error)
    }
    set({
      hulyStatus: { ...initialHulyStatus },
      hulyStatusChecked: true,
      hulyStatusContextKey: getProviderRuntimeContextKey(settings)
    })
  },

  async listHulyIssues(args = {}, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const filter = args.filter ?? 'assigned'
    const limit = args.limit ?? 50
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${filter}::${limit}`
    const cached = get().hulyListCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const issues = await hulyListIssues(ctx, {
        filter,
        limit,
        workspace: options?.workspace ?? undefined
      })
      set((state) => ({
        hulyListCache: evictStaleEntries({
          ...state.hulyListCache,
          [cacheKey]: { data: issues, fetchedAt: Date.now() }
        })
      }))
      return issues
    } catch (error) {
      console.warn('[huly] listIssues failed', error)
      return []
    }
  },

  async createHulyIssue(args, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    try {
      const issue = await hulyCreateIssue(ctx, args, options?.workspace ?? undefined)
      if (issue) {
        const scope = hulyCacheScope(options?.sourceContext)
        const workspaceKey = workspacePart(options?.workspace)
        set((state) => {
          const next = { ...state.hulyListCache }
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${scope}::${workspaceKey}::`)) {
              delete next[key]
            }
          }
          return { hulyListCache: evictStaleEntries(next) }
        })
      }
      return issue
    } catch (error) {
      console.warn('[huly] createIssue failed', error)
      return null
    }
  },

  async updateHulyIssue(id, update, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    try {
      return await hulyUpdateIssue(ctx, id, update, options?.workspace ?? undefined)
    } catch (error) {
      console.warn('[huly] updateIssue failed', error)
      return null
    }
  },

  async listHulyProjects(options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}`
    const cached = get().hulyProjectsCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const projects = await hulyListProjects(ctx, options?.workspace ?? undefined)
      set((state) => ({
        hulyProjectsCache: evictStaleEntries({
          ...state.hulyProjectsCache,
          [cacheKey]: { data: projects, fetchedAt: Date.now() }
        })
      }))
      return projects
    } catch (error) {
      console.warn('[huly] listProjects failed', error)
      return []
    }
  },

  async listHulyTeams(options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}`
    const cached = get().hulyTeamsCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const teams = await hulyListTeams(ctx, options?.workspace ?? undefined)
      set((state) => ({
        hulyTeamsCache: evictStaleEntries({
          ...state.hulyTeamsCache,
          [cacheKey]: { data: teams, fetchedAt: Date.now() }
        })
      }))
      return teams
    } catch (error) {
      console.warn('[huly] listTeams failed', error)
      return []
    }
  }
})
