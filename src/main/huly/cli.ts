import { execFile as defaultExec } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { promisify } from 'node:util'
import type {
  HulyCliCallOptions,
  HulyPreflight,
  HulyViewer
} from '../../shared/huly'

const execFileAsync = promisify(defaultExec)

const DEFAULT_TIMEOUT_MS = 30_000
const HULY_CLI = 'huly'

export class HulyCliError extends Error {
  readonly exitCode: number
  readonly stderr: string
  constructor(message: string, exitCode: number, stderr: string) {
    super(message)
    this.name = 'HulyCliError'
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

export class HulyCliAuthError extends HulyCliError {
  constructor(stderr: string) {
    super('huly CLI is not authenticated', 1, stderr)
    this.name = 'HulyCliAuthError'
  }
}

export class HulyCliMissingError extends Error {
  constructor() {
    super('huly CLI not found on PATH')
    this.name = 'HulyCliMissingError'
  }
}

// Why: GUI / Electron / systemd-launched processes don't inherit the user's
// shell env, so NVM/fnm/asdf/volta installs of `huly` are not on PATH. Walk
// the well-known node manager bin locations and prepend any that exist.
// Why: cached per (HOME,PATH) for the lifetime of the main process so we do
// not block the event loop with readdirSync/statSync on every Huly RPC.
let cachedEnv: { env: Record<string, string | undefined>; key: string } | null = null

function envCacheKey(env: Record<string, string | undefined>): string {
  return `${env.HOME ?? ''}::${env.PATH ?? process.env.PATH ?? ''}`
}

function walkHulyBinDirs(home: string): string[] {
  const candidates = [
    `${home}/.nvm/versions/node/*/bin`,
    `${home}/.fnm/node-versions/*/installation/bin`,
    `${home}/.asdf/shims`,
    `${home}/.volta/bin`,
    `${home}/.local/share/pnpm`,
    `${home}/.npm-global/bin`,
    `${home}/.local/bin`
  ]
  const extra: string[] = []
  for (const pattern of candidates) {
    if (!pattern.includes('*')) {
      if (tryStat(pattern)) {
        extra.push(pattern)
      }
      continue
    }
    const [head, tail] = pattern.split('/*', 2)
    const prefix = head.endsWith('/') ? head.slice(0, -1) : head
    const suffix = tail ?? ''
    let entries: string[]
    try {
      entries = readdirSync(prefix)
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = `${prefix}/${entry}${suffix}`
      if (tryStat(full)) {
        extra.push(full)
      }
    }
  }
  return extra
}

export function expandHulyEnv(
  env: Record<string, string | undefined>
): Record<string, string | undefined> {
  const home = env.HOME ?? process.env.HOME
  if (!home) {
    return env
  }
  const key = envCacheKey(env)
  if (cachedEnv && cachedEnv.key === key) {
    return cachedEnv.env
  }
  const extra = walkHulyBinDirs(home)
  const merged: Record<string, string | undefined> = { ...env }
  if (extra.length > 0) {
    merged.PATH = [...extra, env.PATH ?? process.env.PATH ?? ''].filter(Boolean).join(':')
  }
  cachedEnv = { env: merged, key }
  return merged
}

function tryStat(path: string): boolean {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

export async function runHulyCli<T = unknown>(
  args: string[],
  options: HulyCliCallOptions = {}
): Promise<T> {
  const env = expandHulyEnv(process.env as Record<string, string | undefined>)
  if (options.workspace) {
    env.HULY_WORKSPACE = options.workspace
  }
  env.HULY_NONINTERACTIVE = '1'
  try {
    const { stdout } = await execFileAsync(HULY_CLI, ['--json', '--ci', ...args], {
      env,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    })
    if (!stdout.trim()) {
      throw new HulyCliError('huly CLI returned empty output', 1, '')
    }
    return JSON.parse(stdout) as T
  } catch (error) {
    if (error instanceof HulyCliError) {
      throw error
    }
    const e = error as NodeJS.ErrnoException & { stderr?: string; code?: string; stdout?: string }
    if (e.code === 'ENOENT') {
      throw new HulyCliMissingError()
    }
    const stderr = e.stderr ?? e.message ?? 'huly CLI failed'
    if (/auth|unauthor/i.test(stderr)) {
      throw new HulyCliAuthError(stderr)
    }
    throw new HulyCliError(stderr, e.code === 'ENOENT' ? 127 : 1, stderr)
  }
}

export function parseWhoamiJson(stdout: string): HulyViewer | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const account = typeof parsed.account === 'string' ? parsed.account : null
    const emailFromAccount = account?.startsWith('email:') ? account.slice('email:'.length) : account
    const email =
      (typeof parsed.email === 'string' ? parsed.email : null) ?? emailFromAccount ?? null
    return {
      displayName:
        typeof parsed.displayName === 'string'
          ? parsed.displayName
          : email ?? (typeof parsed.active_workspace === 'string' ? parsed.active_workspace : '') ?? 'Huly user',
      email,
      workspaceName: typeof parsed.active_workspace === 'string' ? parsed.active_workspace : undefined,
      workspaceUrl: typeof parsed.url === 'string' ? parsed.url : undefined
    }
  } catch {
    return null
  }
}

export async function preflightHulyCli(_options: HulyCliCallOptions = {}): Promise<HulyPreflight> {
  const env = expandHulyEnv(process.env as Record<string, string | undefined>)
  try {
    const { stdout } = await execFileAsync(HULY_CLI, ['--version'], {
      env,
      timeout: 5000
    })
    const version = stdout.trim().split('\n')[0] ?? ''
    try {
      const whoami = await execFileAsync(HULY_CLI, ['--json', '--ci', 'whoami'], {
        env,
        timeout: 5000
      })
      const identity = parseWhoamiJson(whoami.stdout)
      return {
        installed: true,
        authenticated: Boolean(identity?.email),
        version,
        accountEmail: identity?.email ?? undefined
      }
    } catch {
      return { installed: true, authenticated: false, version }
    }
  } catch (error) {
    const e = error as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return { installed: false, authenticated: false }
    }
    return {
      installed: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
