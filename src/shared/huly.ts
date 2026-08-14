// Why: Huly owns everything in the huly CLI; Orca is a thin shell. The CLI
// returns JSON shapes that we normalize once here so every downstream layer
// (IPC, RPC, store, UI) sees a stable type contract.

export type HulyViewer = {
  displayName: string
  email: string | null
  workspaceName?: string
  workspaceUrl?: string
}

export type HulyWorkspace = {
  id: string
  name: string
  url: string
  mode: string
}

export type HulyIssueState = {
  id: string
  name: string
  type: string
  color?: string
}

export type HulyTeamMember = {
  id: string
  displayName?: string
  email?: string | null
}

export type HulyTeamSummary = {
  id: string
  name: string
  key?: string
}

export type HulyProjectSummary = {
  id: string
  name: string
  description?: string
  workspaceName?: string
  workspaceUrl?: string
  url?: string
  team?: { id: string; name: string; key?: string }
}

export type HulyIssue = {
  id: string
  identifier: string
  title: string
  description?: string
  url: string
  workspaceName?: string
  workspaceUrl?: string
  state: HulyIssueState
  team: HulyTeamSummary
  project?: HulyProjectSummary
  assignee?: HulyTeamMember
  labels: string[]
  priority: number
  dueDate?: string | null
  updatedAt: string
  createdAt?: string
  /** Why: server-side `createdBy` UUID powers client-side "created by me" filter. */
  createdBy?: string
}

export type HulyComment = {
  id: string
  body: string
  createdAt: string
  user?: { displayName?: string; email?: string | null }
}

export type HulyListFilter = 'assigned' | 'created' | 'all'

export type HulyIssueUpdate = {
  stateId?: string
  title?: string
  description?: string
  assigneeId?: string | null
  priority?: number
}

export type HulyIssueCreateArgs = {
  projectId: string
  title: string
  description?: string
  priority?: number
  assigneeId?: string | null
  stateId?: string
}

export type HulyCommentCreateArgs = {
  issueId: string
  body: string
}

export type HulyCliCallOptions = {
  workspace?: string
  timeoutMs?: number
}

export type HulyPreflight = {
  installed: boolean
  authenticated: boolean
  version?: string
  accountEmail?: string
  error?: string
}

export type HulyConnectionStatus = {
  enabled: boolean
  available: boolean
  viewer: HulyViewer | null
  workspaces: HulyWorkspace[]
  cliVersion?: string
}
