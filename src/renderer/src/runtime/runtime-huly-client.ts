import type {
  HulyComment,
  HulyConnectionStatus,
  HulyIssue,
  HulyIssueCreateArgs,
  HulyIssueUpdate,
  HulyLabel,
  HulyListFilter,
  HulyPreflight,
  HulyProjectCreateArgs,
  HulyProjectSummary,
  HulyTeamMember,
  HulyTeamSummary,
  HulyIssueState
} from '../../../shared/huly'
import type { GlobalSettings } from '../../../shared/types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { getTaskSourceRuntimeSettings } from '../../../shared/task-source-context'
import { callRuntimeRpc, getActiveRuntimeTarget } from './runtime-rpc-client'

export type RuntimeHulySettings =
  | Pick<GlobalSettings, 'activeRuntimeEnvironmentId'>
  | TaskSourceContext
  | null
  | undefined

function isTaskSourceRuntimeSettings(
  settings: RuntimeHulySettings
): settings is TaskSourceContext {
  return settings !== null && settings !== undefined && 'kind' in settings
}

function getHulyRuntimeTarget(
  settings: RuntimeHulySettings
): ReturnType<typeof getActiveRuntimeTarget> {
  return getActiveRuntimeTarget(
    isTaskSourceRuntimeSettings(settings) ? getTaskSourceRuntimeSettings(settings) : settings
  )
}

const env = <T>(target: ReturnType<typeof getActiveRuntimeTarget>, method: string, args: unknown, timeoutMs = 15_000) =>
  target.kind === 'environment'
    ? callRuntimeRpc<T>(target, method, args, { timeoutMs })
    : callLocal<T>(method, args)

async function callLocal<T>(method: string, args: unknown): Promise<T> {
  const localApi = (window.api.huly as unknown as Record<string, (arg: unknown) => Promise<T>>)
  const fn = localApi[method.split('.').at(1) ?? '']
  if (!fn) {
    throw new Error(`huly IPC method not available locally: ${method}`)
  }
  return fn(args)
}

export function hulyStatus(settings: RuntimeHulySettings): Promise<HulyConnectionStatus> {
  return env<HulyConnectionStatus>(getHulyRuntimeTarget(settings), 'huly.status', undefined)
}

export function hulyEnable(settings: RuntimeHulySettings): Promise<HulyConnectionStatus> {
  return env<HulyConnectionStatus>(getHulyRuntimeTarget(settings), 'huly.enable', {})
}

export function hulyDisable(settings: RuntimeHulySettings): Promise<void> {
  return env<void>(getHulyRuntimeTarget(settings), 'huly.disable', undefined)
}

export function hulyPreflight(settings: RuntimeHulySettings): Promise<HulyPreflight> {
  return env<HulyPreflight>(getHulyRuntimeTarget(settings), 'huly.preflight', undefined, 10_000)
}

export type HulyListArgs = {
  filter?: HulyListFilter
  limit?: number
  workspace?: string
  search?: string
  projectId?: string
  teamId?: string
}

export function hulyListIssues(
  settings: RuntimeHulySettings,
  args: HulyListArgs = {}
): Promise<HulyIssue[]> {
  return env<HulyIssue[]>(getHulyRuntimeTarget(settings), 'huly.listIssues', args, 30_000)
}

export function hulyGetIssue(
  settings: RuntimeHulySettings,
  id: string,
  workspace?: string
): Promise<HulyIssue | null> {
  return env<HulyIssue | null>(getHulyRuntimeTarget(settings), 'huly.getIssue', { id, workspace })
}

export function hulyCreateIssue(
  settings: RuntimeHulySettings,
  args: HulyIssueCreateArgs,
  workspace?: string
): Promise<HulyIssue | null> {
  return env<HulyIssue | null>(
    getHulyRuntimeTarget(settings),
    'huly.createIssue',
    { ...args, workspace },
    30_000
  )
}

export function hulyUpdateIssue(
  settings: RuntimeHulySettings,
  id: string,
  update: HulyIssueUpdate,
  workspace?: string
): Promise<HulyIssue | null> {
  return env<HulyIssue | null>(
    getHulyRuntimeTarget(settings),
    'huly.updateIssue',
    { id, update, workspace }
  )
}

export function hulyListComments(
  settings: RuntimeHulySettings,
  issueId: string,
  workspace?: string
): Promise<HulyComment[]> {
  return env<HulyComment[]>(getHulyRuntimeTarget(settings), 'huly.listComments', { issueId, workspace })
}

export function hulyAddComment(
  settings: RuntimeHulySettings,
  args: { issueId: string; body: string },
  workspace?: string
): Promise<HulyComment | null> {
  return env<HulyComment | null>(
    getHulyRuntimeTarget(settings),
    'huly.addComment',
    { ...args, workspace }
  )
}

export function hulyListProjects(
  settings: RuntimeHulySettings,
  workspace?: string
): Promise<HulyProjectSummary[]> {
  return env<HulyProjectSummary[]>(
    getHulyRuntimeTarget(settings),
    'huly.listProjects',
    { workspace }
  )
}

export function hulyGetProject(
  settings: RuntimeHulySettings,
  id: string,
  workspace?: string
): Promise<HulyProjectSummary | null> {
  return env<HulyProjectSummary | null>(
    getHulyRuntimeTarget(settings),
    'huly.getProject',
    { id, workspace }
  )
}

export function hulyCreateProject(
  settings: RuntimeHulySettings,
  args: HulyProjectCreateArgs,
  workspace?: string
): Promise<HulyProjectSummary | null> {
  return env<HulyProjectSummary | null>(
    getHulyRuntimeTarget(settings),
    'huly.createProject',
    { ...args, workspace }
  )
}

export function hulyListTeams(
  settings: RuntimeHulySettings,
  workspace?: string
): Promise<HulyTeamSummary[]> {
  return env<HulyTeamSummary[]>(
    getHulyRuntimeTarget(settings),
    'huly.listTeams',
    { workspace }
  )
}

export function hulyGetTeamMembers(
  settings: RuntimeHulySettings,
  teamId: string,
  workspace?: string
): Promise<HulyTeamMember[]> {
  return env<HulyTeamMember[]>(
    getHulyRuntimeTarget(settings),
    'huly.getTeamMembers',
    { teamId, workspace }
  )
}

export function hulyGetTeamStates(
  settings: RuntimeHulySettings,
  teamId: string,
  workspace?: string
): Promise<HulyIssueState[]> {
  return env<HulyIssueState[]>(
    getHulyRuntimeTarget(settings),
    'huly.getTeamStates',
    { teamId, workspace }
  )
}

export function hulyGetTeamLabels(
  settings: RuntimeHulySettings,
  teamId: string,
  workspace?: string
): Promise<HulyLabel[]> {
  return env<HulyLabel[]>(
    getHulyRuntimeTarget(settings),
    'huly.getTeamLabels',
    { teamId, workspace }
  )
}