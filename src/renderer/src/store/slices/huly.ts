/* eslint-disable max-lines -- Why: the Huly slice owns status, connection
   selection, issue caches, and SWR mutators as one store boundary so cache
   invalidation stays coherent. */
import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { CacheEntry } from './github'
import type {
  HulyComment,
  HulyConnection,
  HulyConnectionStatus,
  HulyIssue,
  HulyIssueState,
  HulyProjectDetail,
  HulyProjectSummary,
  HulyTeamMember,
  HulyTeamSummary
} from '../../../../shared/types'
import {
  hulyAddComment,
  hulyConnect,
  hulyCreateIssue,
  hulyCreateProject,
  hulyDisconnect,
  hulyGetIssue,
  hulyGetProject,
  hulyListComments,
  hulyListIssues,
  hulyListProjectIssues,
  hulyListProjects,
  hulyListTeams,
  hulyPreflight,
  hulySearchIssues,
  hulySelectConnection,
  hulyStatus,
  hulyTeamLabels,
  hulyTeamMembers,
  hulyTeamStates,
  hulyUpdateIssue
} from '@/runtime/runtime-huly-client'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { translate } from '@/i18n/i18n'
import {
  getTaskSourceCacheScope,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'

const CACHE_TTL = 60_000
const MAX_CACHE_ENTRIES = 500

function isFresh<T>(entry: CacheEntry<T> | undefined, ttl = CACHE_TTL): entry is CacheEntry<T> {
  return entry !== undefined && Date.now() - entry.fetchedAt < ttl
}

function evictStaleEntries<T>(
  cache: Record<string, CacheEntry<T>>,
  maxEntries = MAX_CACHE_ENTRIES
): Record<string, CacheEntry<T>> {
  const keys = Object.keys(cache)
  if (keys.length <= maxEntries) {
    return cache
  }
  const sorted = keys.sort((a, b) => (cache[a]?.fetchedAt ?? 0) - (cache[b]?.fetchedAt ?? 0))
  const pruned: Record<string, CacheEntry<T>> = {}
  for (const key of sorted.slice(sorted.length - maxEntries)) {
    pruned[key] = cache[key]
  }
  return pruned
}

export type HulyFetchOptions = {
  sourceContext?: TaskSourceContext | null
  force?: boolean
}

export type HulyIssueReadArgs = {
  filter?: 'assigned' | 'created' | 'all'
  limit?: number
  connectionId?: string | null
}

export type HulyConnectArgs = {
  name: string
  url: string
  workspace: string
  email: string | null
  secret: string
}

export type HulyCreateIssueArgs = {
  teamId: string
  title: string
  description?: string
  priority?: number
  stateId?: string
  assigneeId?: string | null
  labelIds?: string[]
  projectId?: string | null
  connectionId?: string | null
}

export type HulySlice = {
  hulyStatus: HulyConnectionStatus
  hulyStatusChecked: boolean
  hulyPreflightStatus: { installed: boolean; authenticated: boolean; cliVersion?: string }
  hulyStatusContextKey: string | null
  hulyIssueCache: Record<string, CacheEntry<HulyIssue>>
  hulyListCache: Record<string, CacheEntry<HulyIssue[]>>
  hulyTeamCache: Record<string, CacheEntry<HulyTeamSummary[]>>
  hulyProjectCache: Record<string, CacheEntry<HulyProjectSummary[]>>
  hulyProjectDetailCache: Record<string, CacheEntry<HulyProjectDetail | null>>
  hulyCommentCache: Record<string, CacheEntry<HulyComment[]>>
  hulyTeamMembersCache: Record<string, CacheEntry<HulyTeamMember[]>>
  hulyTeamStatesCache: Record<string, CacheEntry<HulyIssueState[]>>
  hulyTeamLabelsCache: Record<string, CacheEntry<{ id: string; name: string; color?: string }[]>>
  hulyListInvalidationToken: { scope: string; version: number }

  checkHulyConnection: (force?: boolean) => Promise<void>
  refreshHulyPreflight: () => Promise<void>
  connectHuly: (
    args: HulyConnectArgs
  ) => Promise<{ ok: true; viewer: HulyConnection } | { ok: false; error: string }>
  disconnectHuly: (connectionId?: string | null) => Promise<void>
  selectHulyConnection: (connectionId: string) => Promise<void>
  fetchHulyIssue: (
    id: string,
    connectionId?: string | null,
    options?: HulyFetchOptions
  ) => Promise<HulyIssue | null>
  listHulyIssues: (args: HulyIssueReadArgs, options?: HulyFetchOptions) => Promise<HulyIssue[]>
  searchHulyIssues: (
    query: string,
    limit?: number,
    options?: HulyFetchOptions
  ) => Promise<HulyIssue[]>
  createHulyIssue: (
    args: HulyCreateIssueArgs,
    options?: HulyFetchOptions
  ) => Promise<{ ok: true; issue: HulyIssue } | { ok: false; error: string }>
  updateHulyIssue: (
    id: string,
    updates: Parameters<typeof hulyUpdateIssue>[2],
    options?: HulyFetchOptions
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  addHulyComment: (
    issueId: string,
    body: string,
    options?: HulyFetchOptions
  ) => Promise<{ ok: true; comment: HulyComment } | { ok: false; error: string }>
  listHulyComments: (issueId: string, options?: HulyFetchOptions) => Promise<HulyComment[]>
  listHulyTeams: (
    connectionId?: string | null,
    options?: HulyFetchOptions
  ) => Promise<HulyTeamSummary[]>
  listHulyTeamMembers: (teamId: string, options?: HulyFetchOptions) => Promise<HulyTeamMember[]>
  listHulyTeamStates: (teamId: string, options?: HulyFetchOptions) => Promise<HulyIssueState[]>
  listHulyTeamLabels: (
    teamId: string,
    options?: HulyFetchOptions
  ) => Promise<{ id: string; name: string; color?: string }[]>
  listHulyProjects: (
    query?: string,
    limit?: number,
    options?: HulyFetchOptions
  ) => Promise<HulyProjectSummary[]>
  fetchHulyProject: (id: string, options?: HulyFetchOptions) => Promise<HulyProjectDetail | null>
  createHulyProject: (
    args: { name: string; description?: string; connectionId?: string | null },
    options?: HulyFetchOptions
  ) => Promise<{ ok: true; project: HulyProjectSummary } | { ok: false; error: string }>
  listHulyProjectIssues: (projectId: string, options?: HulyFetchOptions) => Promise<HulyIssue[]>
  invalidateHulyIssueLists: (options?: Pick<HulyFetchOptions, 'sourceContext'>) => void
}

function runtimeSettings(sourceContext?: TaskSourceContext | null) {
  return sourceContext ?? undefined
}

export const createHulySlice: StateCreator<AppState, [], [], HulySlice> = (set, get) => ({
  hulyStatus: {
    connected: false,
    viewer: null,
    connections: [],
    activeConnectionId: null,
    selectedConnectionId: null,
    cliInstalled: false,
    cliAuthenticated: false
  },
  hulyStatusChecked: false,
  hulyPreflightStatus: { installed: false, authenticated: false },
  hulyStatusContextKey: null,
  hulyIssueCache: {},
  hulyListCache: {},
  hulyTeamCache: {},
  hulyProjectCache: {},
  hulyProjectDetailCache: {},
  hulyCommentCache: {},
  hulyTeamMembersCache: {},
  hulyTeamStatesCache: {},
  hulyTeamLabelsCache: {},
  hulyListInvalidationToken: { scope: '', version: 0 },

  async checkHulyConnection(force = false) {
    const settings = get().settings
    const contextKey = getProviderRuntimeContextKey(settings)
    if (!force && get().hulyStatusChecked && get().hulyStatusContextKey === contextKey) {
      return
    }
    try {
      const status = await hulyStatus(runtimeSettings())
      set({
        hulyStatus: status,
        hulyStatusChecked: true,
        hulyStatusContextKey: contextKey
      })
    } catch (error) {
      console.warn('[huly] status check failed', error)
      set({ hulyStatusChecked: true, hulyStatusContextKey: contextKey })
    }
  },

  async refreshHulyPreflight() {
    try {
      const result = await hulyPreflight(runtimeSettings())
      set({ hulyPreflightStatus: result })
    } catch (error) {
      console.warn('[huly] preflight failed', error)
    }
  },

  async connectHuly(args) {
    try {
      const result = await hulyConnect(runtimeSettings(), args)
      if (result.ok) {
        await get().checkHulyConnection(true)
        await get().refreshHulyPreflight()
        return {
          ok: true,
          viewer:
            get().hulyStatus.connections.find((c) => c.name === args.name) ??
            (args as unknown as HulyConnection)
        }
      }
      return result
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connect failed' }
    }
  },

  async disconnectHuly(connectionId) {
    await hulyDisconnect(runtimeSettings(), connectionId)
    await get().checkHulyConnection(true)
  },

  async selectHulyConnection(connectionId) {
    await hulySelectConnection(runtimeSettings(), connectionId)
    await get().checkHulyConnection(true)
  },

  async fetchHulyIssue(id, connectionId, options) {
    const ctxKey = getTaskSourceCacheScope({
      provider: 'huly',
      projectId: options?.sourceContext?.projectId ?? '',
      hostId: options?.sourceContext?.hostId ?? LOCAL_EXECUTION_HOST_ID,
      projectHostSetupId: options?.sourceContext?.projectHostSetupId ?? null,
      repoId: options?.sourceContext?.repoId ?? null,
      providerIdentity: options?.sourceContext?.providerIdentity ?? null
    })
    const cacheKey = `${ctxKey}::${id}`
    const cached = get().hulyIssueCache[cacheKey]
    if (!options?.force && isFresh(cached) && cached.data !== null) {
      return cached.data
    }
    try {
      const issue = await hulyGetIssue(runtimeSettings(options?.sourceContext), id, connectionId)
      if (issue) {
        set((state) => ({
          hulyIssueCache: evictStaleEntries({
            ...state.hulyIssueCache,
            [cacheKey]: { data: issue, fetchedAt: Date.now() }
          })
        }))
      }
      return issue
    } catch (error) {
      console.warn('[huly] getIssue failed', error)
      return null
    }
  },

  async listHulyIssues(args, options) {
    const ctxKey = getTaskSourceCacheScope({
      provider: 'huly',
      projectId: options?.sourceContext?.projectId ?? '',
      hostId: options?.sourceContext?.hostId ?? LOCAL_EXECUTION_HOST_ID,
      projectHostSetupId: options?.sourceContext?.projectHostSetupId ?? null,
      repoId: options?.sourceContext?.repoId ?? null,
      providerIdentity: options?.sourceContext?.providerIdentity ?? null
    })
    const cacheKey = `${ctxKey}::${args.filter ?? 'all'}::${args.limit ?? 50}::${args.connectionId ?? ''}`
    const cached = get().hulyListCache[cacheKey]
    if (!options?.force && isFresh(cached) && cached.data !== null) {
      return cached.data
    }
    try {
      const issues = await hulyListIssues(
        runtimeSettings(options?.sourceContext),
        args.filter,
        args.limit,
        args.connectionId
      )
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

  async searchHulyIssues(query, limit, options) {
    try {
      return await hulySearchIssues(
        runtimeSettings(options?.sourceContext),
        query,
        limit,
        undefined
      )
    } catch (error) {
      console.warn('[huly] searchIssues failed', error)
      return []
    }
  },

  async createHulyIssue(args, options) {
    const result = await hulyCreateIssue(runtimeSettings(options?.sourceContext), {
      ...args,
      connectionId: args.connectionId ?? undefined
    })
    if (result.ok) {
      get().invalidateHulyIssueLists({ sourceContext: options?.sourceContext })
    }
    return result
  },

  async updateHulyIssue(id, updates, options) {
    const result = await hulyUpdateIssue(
      runtimeSettings(options?.sourceContext),
      id,
      updates,
      undefined
    )
    if (result.ok) {
      get().invalidateHulyIssueLists({ sourceContext: options?.sourceContext })
    }
    return result
  },

  async addHulyComment(issueId, body, options) {
    return hulyAddComment(runtimeSettings(options?.sourceContext), issueId, body, undefined)
  },

  async listHulyComments(issueId, options) {
    const ctxKey = getTaskSourceCacheScope({
      provider: 'huly',
      projectId: options?.sourceContext?.projectId ?? '',
      hostId: options?.sourceContext?.hostId ?? LOCAL_EXECUTION_HOST_ID,
      projectHostSetupId: options?.sourceContext?.projectHostSetupId ?? null,
      repoId: options?.sourceContext?.repoId ?? null,
      providerIdentity: options?.sourceContext?.providerIdentity ?? null
    })
    const cacheKey = `${ctxKey}::${issueId}`
    const cached = get().hulyCommentCache[cacheKey]
    if (!options?.force && isFresh(cached) && cached.data !== null) {
      return cached.data
    }
    try {
      const comments = await hulyListComments(
        runtimeSettings(options?.sourceContext),
        issueId,
        undefined
      )
      set((state) => ({
        hulyCommentCache: evictStaleEntries({
          ...state.hulyCommentCache,
          [cacheKey]: { data: comments, fetchedAt: Date.now() }
        })
      }))
      return comments
    } catch (error) {
      console.warn('[huly] listComments failed', error)
      return []
    }
  },

  async listHulyTeams(connectionId, options) {
    try {
      return await hulyListTeams(runtimeSettings(options?.sourceContext), connectionId)
    } catch (error) {
      console.warn('[huly] listTeams failed', error)
      return []
    }
  },

  async listHulyTeamMembers(teamId, options) {
    try {
      return await hulyTeamMembers(runtimeSettings(options?.sourceContext), teamId, undefined)
    } catch (error) {
      console.warn('[huly] teamMembers failed', error)
      return []
    }
  },

  async listHulyTeamStates(teamId, options) {
    try {
      return await hulyTeamStates(runtimeSettings(options?.sourceContext), teamId, undefined)
    } catch (error) {
      console.warn('[huly] teamStates failed', error)
      return []
    }
  },

  async listHulyTeamLabels(teamId, options) {
    try {
      return await hulyTeamLabels(runtimeSettings(options?.sourceContext), teamId, undefined)
    } catch (error) {
      console.warn('[huly] teamLabels failed', error)
      return []
    }
  },

  async listHulyProjects(query, limit, options) {
    try {
      return await hulyListProjects(runtimeSettings(options?.sourceContext), query, limit)
    } catch (error) {
      console.warn('[huly] listProjects failed', error)
      return []
    }
  },

  async fetchHulyProject(id, options) {
    try {
      return await hulyGetProject(runtimeSettings(options?.sourceContext), id, undefined)
    } catch (error) {
      console.warn('[huly] getProject failed', error)
      return null
    }
  },

  async createHulyProject(args, options) {
    return hulyCreateProject(runtimeSettings(options?.sourceContext), {
      ...args,
      connectionId: args.connectionId ?? undefined
    })
  },

  async listHulyProjectIssues(projectId, options) {
    try {
      return await hulyListProjectIssues(
        runtimeSettings(options?.sourceContext),
        projectId,
        undefined,
        undefined
      )
    } catch (error) {
      console.warn('[huly] listProjectIssues failed', error)
      return []
    }
  },

  invalidateHulyIssueLists(options) {
    const scope = options?.sourceContext
      ? getTaskSourceCacheScope({ ...options.sourceContext, provider: 'huly' })
      : ''
    set({ hulyListInvalidationToken: { scope, version: Date.now() } })
  }
})

// i18n noop to keep the translate symbol referenced (mirrors Linear slice)
void translate
