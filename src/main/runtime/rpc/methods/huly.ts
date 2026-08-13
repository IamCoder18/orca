import { z } from 'zod'
import { defineMethod, type RpcAnyMethod } from '../core'
import { OptionalFiniteNumber, OptionalPlainString, OptionalString, requiredString } from '../schemas'

const VALID_FILTERS = ['assigned', 'created', 'all'] as const

const WorkspaceSelection = z
  .object({ workspace: OptionalString })
  .optional()

const Enable = z.object({}).optional()

const ListIssues = z
  .object({
    filter: z.enum(VALID_FILTERS).optional(),
    limit: OptionalFiniteNumber,
    workspace: OptionalString,
    search: OptionalPlainString,
    projectId: OptionalString,
    teamId: OptionalString,
    viewerEmail: OptionalString,
    viewerUuid: OptionalString
  })
  .optional()

const IssueId = z.object({
  id: requiredString('Issue ID is required'),
  workspace: OptionalString
})

const IssueComment = z.object({
  issueId: requiredString('Issue ID is required'),
  body: requiredString('Comment body is required'),
  workspace: OptionalString
})

const CommentList = z.object({
  issueId: requiredString('Issue ID is required'),
  workspace: OptionalString
})

const UpdateIssue = z.object({
  id: requiredString('Issue ID is required'),
  update: z.object({
    stateId: OptionalString,
    title: OptionalString,
    description: OptionalString,
    assigneeId: z.union([z.string(), z.null()]).optional(),
    priority: z.number().int().min(0).max(4).optional()
  }),
  workspace: OptionalString
})

const CreateIssue = z.object({
  projectId: requiredString('Project ID is required'),
  title: requiredString('Title is required'),
  description: OptionalString,
  priority: z.number().int().min(0).max(4).optional(),
  assigneeId: z.union([z.string(), z.null()]).optional(),
  stateId: OptionalString,
  workspace: OptionalString
})

const TeamId = z.object({
  teamId: requiredString('Team ID is required'),
  workspace: OptionalString
})

const ListProjects = WorkspaceSelection

export const HULY_METHODS: RpcAnyMethod[] = [
  defineMethod({
    name: 'huly.enable',
    params: Enable,
    handler: async (_params, { runtime }) => runtime.hulyEnable()
  }),
  defineMethod({
    name: 'huly.disable',
    params: null,
    handler: async (_params, { runtime }) => runtime.hulyDisable()
  }),
  defineMethod({
    name: 'huly.status',
    params: null,
    handler: async (_params, { runtime }) => runtime.hulyStatus()
  }),
  defineMethod({
    name: 'huly.preflight',
    params: null,
    handler: async (_params, { runtime }) => runtime.hulyPreflight()
  }),
  defineMethod({
    name: 'huly.listIssues',
    params: ListIssues,
    handler: async (params, { runtime }) =>
      runtime.hulyListIssues({
        filter: params?.filter,
        limit: params?.limit ?? 50,
        workspace: params?.workspace,
        search: params?.search,
        projectId: params?.projectId,
        teamId: params?.teamId,
        viewerEmail: params?.viewerEmail,
        viewerUuid: params?.viewerUuid
      })
  }),
  defineMethod({
    name: 'huly.getIssue',
    params: IssueId,
    handler: async (params, { runtime }) => runtime.hulyGetIssue(params.id, params.workspace)
  }),
  defineMethod({
    name: 'huly.createIssue',
    params: CreateIssue,
    handler: async (params, { runtime }) =>
      runtime.hulyCreateIssue(
        {
          projectId: params.projectId,
          title: params.title,
          description: params.description,
          priority: params.priority,
          assigneeId: params.assigneeId,
          stateId: params.stateId
        },
        params.workspace
      )
  }),
  defineMethod({
    name: 'huly.updateIssue',
    params: UpdateIssue,
    handler: async (params, { runtime }) =>
      runtime.hulyUpdateIssue(params.id, params.update, params.workspace)
  }),
  defineMethod({
    name: 'huly.addComment',
    params: IssueComment,
    handler: async (params, { runtime }) =>
      runtime.hulyAddComment(
        { issueId: params.issueId, body: params.body },
        params.workspace
      )
  }),
  defineMethod({
    name: 'huly.listComments',
    params: CommentList,
    handler: async (params, { runtime }) => runtime.hulyListComments(params.issueId, params.workspace)
  }),
  defineMethod({
    name: 'huly.listProjects',
    params: ListProjects,
    handler: async (params, { runtime }) => runtime.hulyListProjects(params?.workspace)
  }),
  defineMethod({
    name: 'huly.getTeamStates',
    params: TeamId,
    handler: async (params, { runtime }) => runtime.hulyGetTeamStates(params.teamId, params.workspace)
  })
]