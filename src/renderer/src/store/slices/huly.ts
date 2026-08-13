import type { StateCreator } from 'zustand'
import type {
  HulyComment,
  HulyConnectionStatus,
  HulyIssue,
  HulyIssueCreateArgs,
  HulyIssueUpdate,
  HulyLabel,
  HulyListFilter,
  HulyPreflight,
  HulyProjectSummary,
  HulyTeamSummary,
  HulyIssueState
} from '../../../../shared/huly'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import type { AppState } from '../types'
import {
  getTaskSourceCacheScope,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import {
  hulyAddComment,
  hulyCreateIssue,
  hulyCreateProject,
  hulyDisable,
  hulyEnable,
  hulyGetIssue,
  hulyGetTeamLabels,
  hulyGetTeamMembers,
  hulyGetTeamStates,
  hulyListComments,
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
  const keys = Object.keys(cache)
  if (keys.length <= MAX_CACHE_ENTRIES) return cache
  const sorted = keys.sort((a, b) => (cache[a]?.fetchedAt ?? 0) - (cache[b]?.fetchedAt ?? 0))
  const pruned: Record<string, CacheEntry<T>> = {}
  for (const key of sorted.slice(sorted.length - MAX_CACHE_ENTRIES)) {
    pruned[key] = cache[key]
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
  hulyPreflightContextKey: string | null
  hulyIssueCache: Record<string, CacheEntry<HulyIssue | null>>
  hulyListCache: Record<string, CacheEntry<HulyIssue[]>>
  hulyCommentsCache: Record<string, CacheEntry<HulyComment[]>>
  hulyProjectsCache: Record<string, CacheEntry<HulyProjectSummary[]>>
  hulyTeamsCache: Record<string, CacheEntry<HulyTeamSummary[]>>
  hulyTeamMembersCache: Record<string, CacheEntry<HulyTeamMemberSummary[]>>
  hulyTeamStatesCache: Record<string, CacheEntry<HulyIssueState[]>>
  hulyTeamLabelsCache: Record<string, CacheEntry<HulyLabel[]>>

  checkHulyConnection: (force?: boolean) => Promise<void>
  refreshHulyPreflight: () => Promise<void>
  enableHuly: () => Promise<HulyConnectionStatus | null>
  disableHuly: () => Promise<void>

  fetchHulyIssue: (id: string, options?: HulyFetchOptions) => Promise<HulyIssue | null>
  listHulyIssues: (args?: HulyListArgs, options?: HulyFetchOptions) => Promise<HulyIssue[]>
  createHulyIssue: (args: HulyIssueCreateArgs, options?: HulyFetchOptions) => Promise<HulyIssue | null>
  updateHulyIssue: (id: string, update: HulyIssueUpdate, options?: HulyFetchOptions) => Promise<HulyIssue | null>

  listHulyComments: (issueId: string, options?: HulyFetchOptions) => Promise<HulyComment[]>
  addHulyComment: (issueId: string, body: string, options?: HulyFetchOptions) => Promise<HulyComment | null>

  listHulyProjects: (options?: HulyFetchOptions) => Promise<HulyProjectSummary[]>
  createHulyProject: (name: string, description?: string, options?: HulyFetchOptions) => Promise<HulyProjectSummary | null>

  listHulyTeams: (options?: HulyFetchOptions) => Promise<HulyTeamSummary[]>
  getHulyTeamMembers: (teamId: string, options?: HulyFetchOptions) => Promise<HulyTeamMemberSummary[]>
  getHulyTeamStates: (teamId: string, options?: HulyFetchOptions) => Promise<HulyIssueState[]>
  getHulyTeamLabels: (teamId: string, options?: HulyFetchOptions) => Promise<HulyLabel[]>
}

type HulyTeamMemberSummary = { id: string; displayName: string; email?: string | null }

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
  hulyPreflightContextKey: null,
  hulyIssueCache: {},
  hulyListCache: {},
  hulyCommentsCache: {},
  hulyProjectsCache: {},
  hulyTeamsCache: {},
  hulyTeamMembersCache: {},
  hulyTeamStatesCache: {},
  hulyTeamLabelsCache: {},

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
    const contextKey = getProviderRuntimeContextKey(settings)
    try {
      const result = await hulyPreflight(settings)
      set({ hulyPreflightStatus: result, hulyPreflightContextKey: contextKey })
    } catch (error) {
      console.warn('[huly] preflight failed', error)
      set({
        hulyPreflightStatus: { installed: false, authenticated: false },
        hulyPreflightContextKey: contextKey
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
    await hulyDisable(settings)
    set({
      hulyStatus: { ...initialHulyStatus },
      hulyStatusChecked: true,
      hulyStatusContextKey: getProviderRuntimeContextKey(settings)
    })
  },

  async fetchHulyIssue(id, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${id}`
    const cached = get().hulyIssueCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data
    }
    try {
      const issue = await hulyGetIssue(ctx, id, options?.workspace ?? undefined)
      set((state) => ({
        hulyIssueCache: {
          ...state.hulyIssueCache,
          [cacheKey]: { data: issue, fetchedAt: Date.now() }
        }
      }))
      return issue
    } catch (error) {
      console.warn('[huly] getIssue failed', error)
      return null
    }
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
        set((state) => ({
          hulyListCache: evictStaleEntries({
            ...state.hulyListCache,
            __created__: { data: [issue, ...Object.values(state.hulyListCache)[0]?.data ?? []].slice(0, 50), fetchedAt: Date.now() }
          })
        }))
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

  async listHulyComments(issueId, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${issueId}`
    const cached = get().hulyCommentsCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const comments = await hulyListComments(ctx, issueId, options?.workspace ?? undefined)
      set((state) => ({
        hulyCommentsCache: evictStaleEntries({
          ...state.hulyCommentsCache,
          [cacheKey]: { data: comments, fetchedAt: Date.now() }
        })
      }))
      return comments
    } catch (error) {
      console.warn('[huly] listComments failed', error)
      return []
    }
  },

  async addHulyComment(issueId, body, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    try {
      const comment = await hulyAddComment(
        ctx,
        { issueId, body },
        options?.workspace ?? undefined
      )
      if (comment) {
        const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${issueId}`
        set((state) => {
          const existing = state.hulyCommentsCache[cacheKey]?.data ?? []
          return {
            hulyCommentsCache: {
              ...state.hulyCommentsCache,
              [cacheKey]: { data: [comment, ...existing], fetchedAt: Date.now() }
            }
          }
        })
      }
      return comment
    } catch (error) {
      console.warn('[huly] addComment failed', error)
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

  async createHulyProject(name, description, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    try {
      return await hulyCreateProject(
        ctx,
        { name, description, workspaceName: options?.workspace ?? undefined },
        options?.workspace ?? undefined
      )
    } catch (error) {
      console.warn('[huly] createProject failed', error)
      return null
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
  },

  async getHulyTeamMembers(teamId, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${teamId}`
    const cached = get().hulyTeamMembersCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const members = await hulyGetTeamMembers(ctx, teamId, options?.workspace ?? undefined)
      const summaries: HulyTeamMemberSummary[] = members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        email: m.email
      }))
      set((state) => ({
        hulyTeamMembersCache: evictStaleEntries({
          ...state.hulyTeamMembersCache,
          [cacheKey]: { data: summaries, fetchedAt: Date.now() }
        })
      }))
      return summaries
    } catch (error) {
      console.warn('[huly] getTeamMembers failed', error)
      return []
    }
  },

  async getHulyTeamStates(teamId, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${teamId}::states`
    const cached = get().hulyTeamStatesCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const states = await hulyGetTeamStates(ctx, teamId, options?.workspace ?? undefined)
      set((state) => ({
        hulyTeamStatesCache: evictStaleEntries({
          ...state.hulyTeamStatesCache,
          [cacheKey]: { data: states, fetchedAt: Date.now() }
        })
      }))
      return states
    } catch (error) {
      console.warn('[huly] getTeamStates failed', error)
      return []
    }
  },

  async getHulyTeamLabels(teamId, options) {
    const ctx = hulyCallContext(options?.sourceContext)
    const cacheKey = `${hulyCacheScope(options?.sourceContext)}::${workspacePart(options?.workspace)}::${teamId}::labels`
    const cached = get().hulyTeamLabelsCache[cacheKey]
    if (!options?.force && isFresh(cached)) {
      return cached.data ?? []
    }
    try {
      const labels = await hulyGetTeamLabels(ctx, teamId, options?.workspace ?? undefined)
      set((state) => ({
        hulyTeamLabelsCache: evictStaleEntries({
          ...state.hulyTeamLabelsCache,
          [cacheKey]: { data: labels, fetchedAt: Date.now() }
        })
      }))
      return labels
    } catch (error) {
      console.warn('[huly] getTeamLabels failed', error)
      return []
    }
  }
})