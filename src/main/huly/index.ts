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
  HulyListFilter,
  HulyPreflight,
  HulyProjectSummary,
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

type HulyStateEnv = { userDataPath: string }

// ── status ──────────────────────────────────────────────────────────────

let preflightCache: { status: HulyPreflight; at: number } | null = null
let viewerCache: { viewer: HulyViewer | null; at: number } | null = null
let workspacesCache: { workspaces: HulyWorkspace[]; at: number } | null = null
const STATUS_TTL_MS = 30_000

export function resetHulyPreflightCache(): void {
  preflightCache = null
  viewerCache = null
  workspacesCache = null
}

export async function getHulyPreflight(_env: HulyStateEnv): Promise<HulyPreflight> {
  if (preflightCache && Date.now() - preflightCache.at < STATUS_TTL_MS) {
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
    cachedListWorkspaces(),
    cachedFetchViewer()
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

async function cachedListWorkspaces(): Promise<HulyWorkspace[]> {
  if (workspacesCache && Date.now() - workspacesCache.at < STATUS_TTL_MS) {
    return workspacesCache.workspaces
  }
  const workspaces = await safeListWorkspaces()
  workspacesCache = { workspaces, at: Date.now() }
  return workspaces
}

async function cachedFetchViewer(): Promise<HulyViewer | null> {
  if (viewerCache && Date.now() - viewerCache.at < STATUS_TTL_MS) {
    return viewerCache.viewer
  }
  const viewer = await safeFetchViewer()
  viewerCache = { viewer, at: Date.now() }
  return viewer
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
  resetHulyPreflightCache()
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
    team?: { id?: string; name?: string; key?: string }
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
      url: entry.url,
      ...(entry.team?.id && entry.team?.name
        ? { team: { id: entry.team.id, name: entry.team.name, key: entry.team.key } }
        : {})
    }))
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

export class HulyViewerIdentityRequiredError extends Error {
  constructor(filter: HulyListFilter) {
    super(
      `Cannot resolve "${filter}" filter: Huly viewer identity is not available yet. Try re-checking the connection.`
    )
    this.name = 'HulyViewerIdentityRequiredError'
  }
}

export async function listIssues(args: ListHulyIssuesArgs = {}): Promise<HulyIssue[]> {
  // Why: filters that need viewer identity must surface a clear error when
  // the viewer email/UUID is not yet known — otherwise the CLI returns the
  // full unfiltered list under an "Assigned to me" / "Created by me" label.
  if (args.filter === 'assigned' && !args.viewerEmail) {
    throw new HulyViewerIdentityRequiredError('assigned')
  }
  if (args.filter === 'created' && !args.viewerUuid) {
    throw new HulyViewerIdentityRequiredError('created')
  }
  const cliArgs: string[] = ['issue', 'list']
  if (args.projectId) cliArgs.push('--project', args.projectId)
  if (args.teamId) cliArgs.push('--team', args.teamId)
  if (args.search) cliArgs.push('--description-search', args.search)
  // Why: `--mine` is not a flag in the huly CLI. Use `--assignee <email>` so
  // the CLI resolves email → user UUID server-side.
  if (args.filter === 'assigned' && args.viewerEmail) {
    cliArgs.push('--assignee', args.viewerEmail)
  }
  // Why: the huly CLI has no `--status open` flag; pass `--is-open` to scope
  // the "All open" preset to open tickets instead of every status.
  if (args.filter === 'all') {
    cliArgs.push('--is-open')
  }
  if (args.limit) cliArgs.push('--limit', String(args.limit))
  type Raw = Record<string, unknown>
  const raw = await runHulyCli<Raw[]>(cliArgs, { workspace: args.workspace })
  const issues = raw.map(toIssue).filter((issue): issue is HulyIssue => issue !== null)
  // Why: the huly CLI has no --created-by flag. Filter "created by me"
  // client-side once we know the viewer's UUID.
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

export async function getTeamStates(teamId: string, workspace?: string): Promise<HulyIssueState[]> {
  type Raw = { id?: string; name?: string; type?: string; color?: string }
  const raw = await runHulyCli<Raw[]>(['team', 'states', '--team', teamId], { workspace })
  return raw
    .filter((entry): entry is Raw & { id: string; name: string } =>
      typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name, type: entry.type ?? '', color: entry.color }))
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
  // Why: the CLI returns the issue list with ID-only references (state and
  // team are string IDs, not nested objects). Build a synthetic URL so the
  // card stays tappable; the detail workspace hydrates full names via
  // `huly issue get`. URL falls back to huly.app when the workspace URL is
  // unknown (the cli whoami exposes it but isn't passed here).
  const workspaceUrl = asString(raw.workspaceUrl) ?? asString(raw.workspace_url)
  const safeIdentifier = identifier ?? id ?? ''
  const url =
    asString(raw.url) ??
    asString(raw.link) ??
    (workspaceUrl
      ? `https://huly.app/workspace/${encodeURIComponent(workspaceUrl)}/issue/${encodeURIComponent(safeIdentifier)}`
      : `https://huly.app/issue/${encodeURIComponent(safeIdentifier)}`)
  if (!id || !identifier || !title || !url) return null

  const stateRaw = raw.state as Record<string, unknown> | undefined
  const stateString = asString(raw.state)
  const stateId = stateRaw?.id ? asString(stateRaw.id) : stateString ?? ''
  // Why: CLI returns status as an ID-only string ("tracker:status:InProgress")
  // without a nested object. Split on the last colon and humanize so the row
  // shows "InProgress" instead of the full tracker ID.
  const stateName =
    (stateRaw?.name ? asString(stateRaw.name) : null) ??
    stateString?.split(':').pop()?.replace(/[-_]+/g, ' ').trim() ??
    ''
  const isDone = raw.isDone === true || stateRaw?.type === 'done'

  const teamRaw = raw.team as Record<string, unknown> | undefined
  const teamString = asString(raw.team)
  const teamId = teamRaw?.id ? asString(teamRaw.id) : teamString ?? ''
  function readableNameFromId(value: string | undefined): string {
  if (!value) return ''
  const tail = value.split(':').pop()
  return (tail && tail !== value ? tail : value).replace(/[-_]+/g, ' ').trim()
}

const teamName: string = readableNameFromId(
  asString(teamRaw?.name) ?? asString(teamRaw?.key) ?? teamString
)

  const assigneeRaw = raw.assignee as Record<string, unknown> | undefined
  const projectRaw = raw.project as Record<string, unknown> | undefined
  const projectStringId = asString(raw.project)

  return {
    id,
    identifier,
    title,
    description: asString(raw.description),
    url,
    workspaceName: asString(raw.workspaceName) ?? asString(raw.workspace_name),
    workspaceUrl: asString(raw.workspaceUrl) ?? asString(raw.workspace_url),
    state: {
      id: stateId ?? '',
      name: stateName ?? (isDone ? 'Done' : 'Open'),
      type: (stateRaw?.type ? asString(stateRaw.type) : isDone ? 'done' : 'unstarted') ?? 'unstarted',
      color: stateRaw?.color ? asString(stateRaw.color) : undefined
    },
    team: {
      id: teamId ?? '',
      name: teamName ?? '',
      key: teamRaw?.key ? asString(teamRaw.key) : undefined
    },
    project:
      projectRaw && asString(projectRaw.id) && asString(projectRaw.name)
        ? {
            id: projectRaw.id as string,
            name: projectRaw.name as string,
            description: asString(projectRaw.description),
            workspaceName: asString(projectRaw.workspaceName),
            workspaceUrl: asString(projectRaw.workspaceUrl),
            url: asString(projectRaw.url)
          }
        : projectStringId
          ? { id: projectStringId, name: projectStringId }
          : undefined,
    assignee:
      assigneeRaw && asString(assigneeRaw.id)
        ? {
            id: assigneeRaw.id as string,
            displayName:
              asString(assigneeRaw.displayName) ?? asString(assigneeRaw.name) ?? undefined,
            email: asString(assigneeRaw.email) ?? null
          }
        : undefined,
    labels: asStringArray(raw.labels),
    priority: asNumber(raw.priority),
    dueDate: asString(raw.dueDate) ?? null,
    updatedAt: asString(raw.updatedAt) ?? asString(raw.updated_at) ?? '',
    createdAt: asString(raw.createdAt) ?? asString(raw.created_at) ?? '',
    ...(asString(raw.createdBy) ? { createdBy: asString(raw.createdBy)! } : {})
  }
}