import type { HulyTeamSummary, HulyTeamMember, HulyIssueState, HulyLabel } from '../../shared/types'
import { runHulyCli } from './huly-cli'
import { acquire, getConnection, getSecret, release } from './client'

type RawTeam = {
  id?: string
  name?: string
  key?: string
  description?: string
}

type RawMember = {
  id?: string
  displayName?: string
  email?: string
  avatarUrl?: string
}

type RawState = {
  id?: string
  name?: string
  type?: string
  color?: string
}

type RawLabel = {
  id?: string
  name?: string
  color?: string
}

export async function listTeams(connectionId: string | null): Promise<HulyTeamSummary[]> {
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
    const raw = await runHulyCli<RawTeam[]>(connection, secret, null, ['team', 'list'])
    return raw
      .filter(
        (entry): entry is { id: string; name: string; key: string } =>
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.key === 'string'
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        key: entry.key,
        description: undefined
      }))
  } finally {
    release()
  }
}

export async function getTeamMembers(
  teamId: string,
  connectionId: string | null
): Promise<HulyTeamMember[]> {
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
    const raw = await runHulyCli<RawMember[]>(connection, secret, null, ['team', 'members', teamId])
    return raw
      .filter(
        (entry): entry is { id: string; displayName: string } =>
          typeof entry.id === 'string' && typeof entry.displayName === 'string'
      )
      .map((entry) => ({
        id: entry.id,
        displayName: entry.displayName
      }))
  } finally {
    release()
  }
}

export async function getTeamStates(
  teamId: string,
  connectionId: string | null
): Promise<HulyIssueState[]> {
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
    const raw = await runHulyCli<RawState[]>(connection, secret, null, ['team', 'states', teamId])
    return raw
      .filter(
        (entry): entry is { id: string; name: string; type: string } =>
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.type === 'string'
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        color: undefined
      }))
  } finally {
    release()
  }
}

export async function getTeamLabels(
  teamId: string,
  connectionId: string | null
): Promise<HulyLabel[]> {
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
    const raw = await runHulyCli<RawLabel[]>(connection, secret, null, ['team', 'labels', teamId])
    return raw
      .filter(
        (entry): entry is { id: string; name: string } =>
          typeof entry.id === 'string' && typeof entry.name === 'string'
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        color: undefined
      }))
  } finally {
    release()
  }
}
