import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  HulyComment,
  HulyCommentCreateArgs,
  HulyConnectionStatus,
  HulyIssue,
  HulyIssueCreateArgs,
  HulyIssueState,
  HulyIssueUpdate,
  HulyLabel,
  HulyListFilter,
  HulyPreflight,
  HulyProjectCreateArgs,
  HulyProjectSummary,
  HulyTeamMember,
  HulyTeamSummary,
  HulyViewer,
  HulyWorkspace
} from '../../shared/huly'
import {
  HulyCliAuthError,
  HulyCliMissingError,
  parseWhoamiJson,
  preflightHulyCli,
  runHulyCli
} from './cli'

// ── enabled flag ────────────────────────────────────────────────────────
// Why: Orca stores only one boolean for Huly. The CLI owns auth + URLs +
// workspaces. Toggling this flag is the entire surface area for "connect".

const STATE_DIR = 'huly'
const STATE_FILE = 'enabled.json'

function enabledPath(userDataPath: string): string {
  return path.join(userDataPath, STATE_DIR, STATE_FILE)
}

async function readEnabled(userDataPath: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(enabledPath(userDataPath), 'utf8')
    const parsed = JSON.parse(raw) as { enabled?: boolean }
    return parsed.enabled === true
  } catch {
    return false
  }
}

async function writeEnabled(userDataPath: string, enabled: boolean): Promise<void> {
  const file = enabledPath(userDataPath)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ enabled }, null, 2), 'utf8')
}

export type HulyStateEnv = { userDataPath: string }

// ── status ──────────────────────────────────────────────────────────────

let preflightCache: { status: HulyPreflight; at: number } | null = null
const PREFLIGHT_TTL_MS = 30_000

export function resetHulyPreflightCache(): void {
  preflightCache = null
}

export async function getHulyPreflight(_env: HulyStateEnv): Promise<HulyPreflight> {
  if (preflightCache && Date.now() - preflightCache.at < PREFLIGHT_TTL_MS) {
    return preflightCache.status
  }
  const status = await preflightHulyCli()
  preflightCache = { status, at: Date.now() }
  return status
}

export async function getHulyStatus(env: HulyStateEnv): Promise<HulyConnectionStatus> {
  const [enabled, preflight, workspaces, viewer] = await Promise.all([
    readEnabled(env.userDataPath),
    getHulyPreflight(env),
    safeListWorkspaces(),
    safeFetchViewer()
  ])
  const available = preflight.installed && preflight.authenticated
  return {
    enabled,
    available,
    viewer,
    workspaces,
    cliVersion: preflight.version
  }
}

export async function enableHuly(env: HulyStateEnv): Promise<HulyConnectionStatus> {
  const preflight = await getHulyPreflight(env)
  if (!preflight.installed) {
    throw new Error(
      "The `huly` CLI is not installed. Install it with `npm i -g @iamcoder18/huly-cli`."
    )
  }
  if (!preflight.authenticated) {
    throw new Error('Run `huly auth login` in your terminal, then try again.')
  }
  await writeEnabled(env.userDataPath, true)
  return await getHulyStatus(env)
}

export async function disableHuly(env: HulyStateEnv): Promise<void> {
  await writeEnabled(env.userDataPath, false)
}

async function safeListWorkspaces(): Promise<HulyWorkspace[]> {
  try {
    return await listWorkspaces()
  } catch (error) {
    if (error instanceof HulyCliAuthError || error instanceof HulyCliMissingError) return []
    throw error
  }
}

async function safeFetchViewer(): Promise<HulyViewer | null> {
  try {
    return await fetchViewer()
  } catch (error) {
    if (error instanceof HulyCliAuthError || error instanceof HulyCliMissingError) return null
    throw error
  }
}

// ── CLI passthrough helpers ─────────────────────────────────────────────

async function fetchViewer(): Promise<HulyViewer | null> {
  type RawViewer = { displayName?: string; email?: string | null; account?: string; active_workspace?: string; url?: string }
  const raw = await runHulyCli<RawViewer>(['whoami'])
  const viewer = parseWhoamiJson(JSON.stringify(raw))
  if (!viewer) return null
  return {
    displayName: viewer.displayName,
    email: viewer.email,
    workspaceName: viewer.workspaceName ?? raw.active_workspace,
    workspaceUrl: viewer.workspaceUrl ?? raw.url
  }
}

async function listWorkspaces(): Promise<HulyWorkspace[]> {
  type Raw = { name?: string; url?: string; uuid?: string; mode?: string }
  const raw = await runHulyCli<Raw[]>('workspace list'.split(' '))
  return raw
    .filter((entry): entry is Raw & { name: string; url: string } =>
      typeof entry.name === 'string' && typeof entry.url === 'string'
    )
    .map((entry) => ({
      id: entry.uuid ?? entry.name,
      name: entry.name,
      url: entry.url,
      mode: entry.mode ?? 'active'
    }))
}

export async function listProjects(workspace?: string): Promise<HulyProjectSummary[]> {
  type Raw = {
    id?: string
    name?: string
    description?: string
    url?: string
    workspace?: { name?: string; url?: string }
  }
  const args = workspace ? ['project', 'list', '--workspace', workspace] : ['project', 'list']
  const raw = await runHulyCli<Raw[]>(args)
  return raw
    .filter((entry): entry is Raw & { id: string; name: string } =>
      typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      workspaceName: entry.workspace?.name ?? workspace,
      workspaceUrl: entry.workspace?.url,
      url: entry.url
    }))
}

export async function getProject(id: string, workspace?: string): Promise<HulyProjectSummary | null> {
  type Raw = {
    id?: string
    name?: string
    description?: string
    url?: string
    workspace?: { name?: string; url?: string }
  }
  try {
    const raw = await runHulyCli<Raw>(['project', 'get', id], { workspace })
    if (!raw.id || !raw.name) return null
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      workspaceName: raw.workspace?.name,
      workspaceUrl: raw.workspace?.url,
      url: raw.url
    }
  } catch (error) {
    if (error instanceof HulyCliMissingError) return null
    throw error
  }
}

export async function createProject(args: HulyProjectCreateArgs, workspace?: string): Promise<HulyProjectSummary | null> {
  type Raw = { id?: string; name?: string; url?: string; description?: string }
  const cliArgs = ['project', 'create', '--name', args.name]
  if (args.description) cliArgs.push('--description', args.description)
  if (workspace) cliArgs.push('--workspace', workspace)
  else if (args.workspaceName) cliArgs.push('--workspace', args.workspaceName)
  const raw = await runHulyCli<Raw>(cliArgs, { workspace })
  if (!raw.id || !raw.name) return null
  return { id: raw.id, name: raw.name, description: raw.description, url: raw.url }
}

export type ListHulyIssuesArgs = {
  filter?: HulyListFilter
  limit?: number
  workspace?: string
  search?: string
  teamId?: string
  projectId?: string
  /** Viewer email for `--assignee` server-side filter (CLI accepts email). */
  viewerEmail?: string
  /** Viewer UUID for client-side "created by me" filter. */
  viewerUuid?: string
}

export async function listIssues(args: ListHulyIssuesArgs = {}): Promise<HulyIssue[]> {
  const cliArgs: string[] = ['issue', 'list']
  if (args.projectId) cliArgs.push('--project', args.projectId)
  if (args.teamId) cliArgs.push('--team', args.teamId)
  if (args.search) cliArgs.push('--description-search', args.search)
  // Why: `--mine` is not a flag in the huly CLI. Use `--assignee <email>` so
  // the CLI resolves email → user UUID server-side; we always pass the
  // viewer email (resolved from `whoami`) for the assigned filter.
  if (args.filter === 'assigned' && args.viewerEmail) {
    cliArgs.push('--assignee', args.viewerEmail)
  }
  if (args.limit) cliArgs.push('--limit', String(args.limit))
  type Raw = Record<string, unknown>
  const raw = await runHulyCli<Raw[]>(cliArgs, { workspace: args.workspace })
  const issues = raw.map(toIssue).filter((issue): issue is HulyIssue => issue !== null)
  // Why: the huly CLI has no --created-by flag. Filter "created by me"
  // client-side once we know the viewer's UUID; cache the UUID after the
  // first assignee lookup so subsequent calls skip the email→UUID step.
  if (args.filter === 'created' && args.viewerUuid) {
    return issues.filter((issue) => issue.createdBy === args.viewerUuid)
  }
  return issues
}

export async function getIssue(id: string, workspace?: string): Promise<HulyIssue | null> {
  type Raw = Record<string, unknown>
  try {
    const raw = await runHulyCli<Raw>(['issue', 'get', id], { workspace })
    return toIssue(raw)
  } catch (error) {
    if (error instanceof HulyCliMissingError) return null
    throw error
  }
}

export async function createIssue(
  args: HulyIssueCreateArgs,
  workspace?: string
): Promise<HulyIssue | null> {
  const cliArgs = [
    'issue',
    'create',
    '--project',
    args.projectId,
    '--title',
    args.title
  ]
  if (args.description) cliArgs.push('--description', args.description)
  if (args.priority !== undefined) cliArgs.push('--priority', String(args.priority))
  if (args.assigneeId) cliArgs.push('--assignee', args.assigneeId)
  if (args.stateId) cliArgs.push('--state', args.stateId)
  type Raw = Record<string, unknown>
  const raw = await runHulyCli<Raw>(cliArgs, { workspace })
  return toIssue(raw)
}

export async function updateIssue(
  id: string,
  update: HulyIssueUpdate,
  workspace?: string
): Promise<HulyIssue | null> {
  const cliArgs = ['issue', 'update', id]
  if (update.stateId) cliArgs.push('--state', update.stateId)
  if (update.title) cliArgs.push('--title', update.title)
  if (update.description !== undefined) cliArgs.push('--description', update.description)
  if (update.assigneeId !== undefined) {
    if (update.assigneeId === null) cliArgs.push('--unassign')
    else cliArgs.push('--assignee', update.assigneeId)
  }
  if (update.priority !== undefined) cliArgs.push('--priority', String(update.priority))
  type Raw = Record<string, unknown>
  const raw = await runHulyCli<Raw>(cliArgs, { workspace })
  return toIssue(raw)
}

export async function listComments(issueId: string, workspace?: string): Promise<HulyComment[]> {
  type Raw = { id?: string; body?: string; createdAt?: string; created_at?: string; user?: { displayName?: string; email?: string | null } }
  const raw = await runHulyCli<Raw[]>(['comment', 'list', '--issue', issueId], { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string; body: string } =>
      typeof entry.id === 'string' && typeof entry.body === 'string'
    )
    .map((entry) => ({
      id: entry.id,
      body: entry.body,
      createdAt: entry.createdAt ?? entry.created_at ?? new Date().toISOString(),
      user: entry.user
    }))
}

export async function addComment(
  args: HulyCommentCreateArgs,
  workspace?: string
): Promise<HulyComment | null> {
  type Raw = { id?: string; body?: string; createdAt?: string; user?: { displayName?: string; email?: string | null } }
  const raw = await runHulyCli<Raw>(
    ['comment', 'add', '--issue', args.issueId, '--body', args.body],
    { workspace }
  )
  if (!raw.id || !raw.body) return null
  return { id: raw.id, body: raw.body, createdAt: raw.createdAt ?? new Date().toISOString(), user: raw.user }
}

export async function listTeams(workspace?: string): Promise<HulyTeamSummary[]> {
  type Raw = { id?: string; name?: string; key?: string }
  const raw = await runHulyCli<Raw[]>('team list'.split(' '), { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string; name: string } =>
      typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name, key: entry.key }))
}

export async function getTeamMembers(teamId: string, workspace?: string): Promise<HulyTeamMember[]> {
  type Raw = { id?: string; displayName?: string; name?: string; email?: string | null }
  const raw = await runHulyCli<Raw[]>(['team', 'members', '--team', teamId], { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string } => typeof entry.id === 'string')
    .map((entry) => ({
      id: entry.id,
      displayName: entry.displayName ?? entry.name ?? entry.id,
      email: entry.email ?? null
    }))
}

export async function getTeamStates(teamId: string, workspace?: string): Promise<HulyIssueState[]> {
  type Raw = { id?: string; name?: string; type?: string; color?: string }
  const raw = await runHulyCli<Raw[]>(['team', 'states', '--team', teamId], { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string; name: string } =>
      typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name, type: entry.type ?? '', color: entry.color }))
}

export async function getTeamLabels(teamId: string, workspace?: string): Promise<HulyLabel[]> {
  type Raw = { id?: string; name?: string; color?: string }
  const raw = await runHulyCli<Raw[]>(['team', 'labels', '--team', teamId], { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string; name: string } =>
      typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name, color: entry.color }))
}

// ── normalization ───────────────────────────────────────────────────────

type RawIssue = Record<string, unknown>

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toIssue(raw: RawIssue): HulyIssue | null {
  const id = asString(raw.id) ?? asString(raw._id)
  const identifier = asString(raw.identifier) ?? asString(raw.key)
  const title = asString(raw.title) ?? asString(raw.name)
  const url = asString(raw.url) ?? asString(raw.link)
  const stateRaw = raw.state as Record<string, unknown> | undefined
  const teamRaw = raw.team as Record<string, unknown> | undefined
  if (!id || !identifier || !title || !url || !stateRaw || !teamRaw) return null
  const assigneeRaw = raw.assignee as Record<string, unknown> | undefined
  const projectRaw = raw.project as Record<string, unknown> | undefined
  return {
    id,
    identifier,
    title,
    description: asString(raw.description),
    url,
    workspaceName: asString(raw.workspaceName) ?? asString(raw.workspace_name),
    workspaceUrl: asString(raw.workspaceUrl) ?? asString(raw.workspace_url),
    state: {
      id: asString(stateRaw.id) ?? '',
      name: asString(stateRaw.name) ?? '',
      type: asString(stateRaw.type) ?? '',
      color: asString(stateRaw.color)
    },
    team: {
      id: asString(teamRaw.id) ?? '',
      name: asString(teamRaw.name) ?? '',
      key: asString(teamRaw.key)
    },
    project: projectRaw && asString(projectRaw.id) && asString(projectRaw.name)
      ? {
          id: projectRaw.id as string,
          name: projectRaw.name as string,
          description: asString(projectRaw.description),
          workspaceName: asString(projectRaw.workspaceName),
          workspaceUrl: asString(projectRaw.workspaceUrl),
          url: asString(projectRaw.url)
        }
      : undefined,
    assignee: assigneeRaw && asString(assigneeRaw.id)
      ? {
          id: assigneeRaw.id as string,
          displayName: asString(assigneeRaw.displayName) ?? asString(assigneeRaw.name) ?? '',
          email: asString(assigneeRaw.email) ?? null
        }
      : undefined,
    labels: asStringArray(raw.labels),
    priority: asNumber(raw.priority),
    dueDate: asString(raw.dueDate) ?? null,
    updatedAt: asString(raw.updatedAt) ?? asString(raw.updated_at) ?? new Date().toISOString(),
    ...(asString(raw.createdBy) ? { createdBy: asString(raw.createdBy)! } : {})
  }
}