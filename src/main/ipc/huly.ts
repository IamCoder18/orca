import { app, ipcMain } from 'electron'
import type {
  HulyCommentCreateArgs,
  HulyIssueCreateArgs,
  HulyIssueUpdate,
  HulyListFilter,
  HulyProjectCreateArgs
} from '../../shared/huly'
import {
  addComment,
  createIssue,
  createProject,
  disableHuly,
  enableHuly,
  getHulyPreflight,
  getHulyStatus,
  getIssue,
  getProject,
  getTeamLabels,
  getTeamMembers,
  getTeamStates,
  listComments,
  listIssues,
  listProjects,
  listTeams,
  resetHulyPreflightCache,
  updateIssue
} from '../huly'

const getUserDataPath = (): string => app.getPath('userData')

function normalizeWorkspace(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeFilter(value: unknown): HulyListFilter | undefined {
  return value === 'assigned' || value === 'created' || value === 'all' ? value : undefined
}

export function registerHulyHandlers(): void {
  ipcMain.handle('huly:enable', async () => enableHuly({ userDataPath: getUserDataPath() }))

  ipcMain.handle('huly:disable', async () => {
    await disableHuly({ userDataPath: getUserDataPath() })
  })

  ipcMain.handle('huly:status', async () => getHulyStatus({ userDataPath: getUserDataPath() }))

  ipcMain.handle('huly:preflight', async () => {
    resetHulyPreflightCache()
    return getHulyPreflight({ userDataPath: getUserDataPath() })
  })

  ipcMain.handle(
    'huly:listIssues',
    async (_event, args: { filter?: HulyListFilter; limit?: number; workspace?: string; search?: string; projectId?: string; teamId?: string } = {}) => {
      return listIssues({
        filter: normalizeFilter(args.filter),
        limit: typeof args.limit === 'number' ? args.limit : 50,
        workspace: normalizeWorkspace(args.workspace),
        search: typeof args.search === 'string' ? args.search : undefined,
        projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
        teamId: typeof args.teamId === 'string' ? args.teamId : undefined
      })
    }
  )

  ipcMain.handle(
    'huly:getIssue',
    async (_event, args: { id: string; workspace?: string }) => {
      return getIssue(args.id, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:createIssue',
    async (_event, args: HulyIssueCreateArgs & { workspace?: string }) => {
      const { workspace, ...rest } = args
      return createIssue(rest, normalizeWorkspace(workspace))
    }
  )

  ipcMain.handle(
    'huly:updateIssue',
    async (
      _event,
      args: { id: string; update: HulyIssueUpdate; workspace?: string }
    ) => {
      return updateIssue(args.id, args.update, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:addComment',
    async (_event, args: HulyCommentCreateArgs & { workspace?: string }) => {
      const { workspace, ...rest } = args
      return addComment(rest, normalizeWorkspace(workspace))
    }
  )

  ipcMain.handle(
    'huly:listComments',
    async (_event, args: { issueId: string; workspace?: string }) => {
      return listComments(args.issueId, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:listProjects',
    async (_event, args?: { workspace?: string }) => {
      return listProjects(normalizeWorkspace(args?.workspace))
    }
  )

  ipcMain.handle(
    'huly:getProject',
    async (_event, args: { id: string; workspace?: string }) => {
      return getProject(args.id, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:createProject',
    async (_event, args: HulyProjectCreateArgs & { workspace?: string }) => {
      const { workspace, ...rest } = args
      return createProject(rest, normalizeWorkspace(workspace))
    }
  )

  ipcMain.handle(
    'huly:listTeams',
    async (_event, args?: { workspace?: string }) => {
      return listTeams(normalizeWorkspace(args?.workspace))
    }
  )

  ipcMain.handle(
    'huly:getTeamMembers',
    async (_event, args: { teamId: string; workspace?: string }) => {
      return getTeamMembers(args.teamId, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:getTeamStates',
    async (_event, args: { teamId: string; workspace?: string }) => {
      return getTeamStates(args.teamId, normalizeWorkspace(args.workspace))
    }
  )

  ipcMain.handle(
    'huly:getTeamLabels',
    async (_event, args: { teamId: string; workspace?: string }) => {
      return getTeamLabels(args.teamId, normalizeWorkspace(args.workspace))
    }
  )
}