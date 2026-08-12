import type { HulyConnection, HulyProjectDetail, HulyProjectSummary } from '../../shared/types'
import { runHulyCli } from './huly-cli'
import { acquire, getConnection, getSecret, release } from './client'
import { listIssues } from './issues'

type RawHulyProject = {
  id?: string
  name?: string
  description?: string
  color?: string
  url?: string
  status?: { id?: string; name?: string; color?: string }
  startDate?: string | null
  targetDate?: string | null
  createdAt?: string
  updatedAt?: string
}

function toSummary(raw: RawHulyProject): HulyProjectSummary | null {
  if (!raw.id || !raw.name) {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    color: raw.color,
    url: raw.url,
    status: raw.status
      ? {
          id: raw.status.id ?? '',
          name: raw.status.name ?? '',
          color: raw.status.color
        }
      : undefined,
    startDate: raw.startDate,
    targetDate: raw.targetDate,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  }
}

async function run<T>(connection: HulyConnection, secret: string, args: string[]): Promise<T> {
  return runHulyCli<T>(connection, secret, null, args)
}

export async function listProjects(
  query: string | undefined,
  limit: number,
  connectionId: string | null
): Promise<HulyProjectSummary[]> {
  const connection = getConnection(connectionId)
  if (!connection) {
    return []
  }
  const secret = getSecret(connection.id)
  if (!secret) {
    return []
  }
  await acquire()
  try {
    const args = ['project', 'list', '--limit', String(limit)]
    if (query) {
      args.push('--query', query)
    }
    const raw = await run<RawHulyProject[]>(connection, secret, args)
    return raw.map(toSummary).filter((project): project is HulyProjectSummary => project !== null)
  } finally {
    release()
  }
}

export async function getProject(
  id: string,
  connectionId: string | null
): Promise<HulyProjectDetail | null> {
  const connection = getConnection(connectionId)
  if (!connection) {
    return null
  }
  const secret = getSecret(connection.id)
  if (!secret) {
    return null
  }
  await acquire()
  try {
    const raw = await run<RawHulyProject>(connection, secret, ['project', 'get', id])
    const summary = toSummary(raw)
    if (!summary) {
      return null
    }
    return summary
  } finally {
    release()
  }
}

export async function createProject(
  input: { name: string; description?: string },
  connectionId: string | null
): Promise<{ ok: true; project: HulyProjectSummary } | { ok: false; error: string }> {
  try {
    const connection = getConnection(connectionId)
    if (!connection) {
      throw new Error('No Huly connection.')
    }
    const secret = getSecret(connection.id)
    if (!secret) {
      throw new Error('No Huly credentials.')
    }
    await acquire()
    try {
      const args = ['project', 'create', '--name', input.name]
      if (input.description) {
        args.push('--description', input.description)
      }
      const raw = await run<RawHulyProject>(connection, secret, args)
      const summary = toSummary(raw)
      if (!summary) {
        throw new Error('Invalid project payload')
      }
      return { ok: true, project: summary }
    } finally {
      release()
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Project create failed' }
  }
}

export async function listProjectIssues(
  projectId: string,
  limit: number,
  connectionId: string | null
) {
  // Why: huly CLI exposes issues by team, not by project. Filter the user's
  // accessible issues by projectId after the fact.
  const issues = await listIssues('all', Math.max(limit, 50), connectionId)
  return issues.filter((issue) => issue.project?.id === projectId).slice(0, limit)
}
