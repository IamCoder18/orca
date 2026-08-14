// Why: HulyIssueActionSidebar shows copy/open actions. The metadata block
// surfaces the issue's structured fields (assignee, priority, workspace,
// team, labels, created/updated) so the user can scan the issue without
// scrolling the description. Mirrors GitHub's right-sidebar metadata.
import React from 'react'
import { HulyPriorityIcon } from '@/lib/huly-priority-icon'
import { getHulyPriorityLabel } from '@/lib/huly-presentation'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'
import type { HulyIssue } from '../../../shared/huly'

type Props = { issue: HulyIssue }

function MetaRow({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{value}</span>
    </div>
  )
}

export function HulyIssueMetadataSidebar({ issue }: Props): React.JSX.Element {
  const unassigned = translate('auto.components.huly.metadata.unassigned', 'Unassigned')
  const noneLabel = translate('auto.components.huly.metadata.none', 'None')
  const assigneeName = issue.assignee?.displayName ?? unassigned
  const priorityLabel = issue.priority > 0 ? getHulyPriorityLabel(issue.priority) : noneLabel
  return (
    <div className="grid gap-2.5 border-b border-border/40 pb-3">
      <MetaRow label={translate('auto.components.huly.metadata.status', 'Status')} value={issue.state.name} />
      <MetaRow
        label={translate('auto.components.huly.metadata.priority', 'Priority')}
        value={issue.priority > 0 ? <span className="inline-flex items-center gap-1.5"><HulyPriorityIcon priority={issue.priority} /><span>{priorityLabel}</span></span> : priorityLabel}
      />
      <MetaRow label={translate('auto.components.huly.metadata.assignee', 'Assignee')} value={assigneeName} />
      <MetaRow label={translate('auto.components.huly.metadata.team', 'Team')} value={issue.team.name} />
      {issue.workspaceName ? <MetaRow label={translate('auto.components.huly.metadata.workspace', 'Workspace')} value={issue.workspaceName} /> : null}
      {issue.labels.length > 0 ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{translate('auto.components.huly.metadata.labels', 'Labels')}</span>
          <div className="flex flex-wrap justify-end gap-1">
            {issue.labels.map((label) => (
              <span
                key={label}
                title={label}
                className="max-w-full truncate rounded-full border border-border/40 bg-muted/30 px-1.5 py-0 text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {issue.createdAt ? (
        <MetaRow
          label={translate('auto.components.huly.metadata.created', 'Created')}
          value={formatUiRelativeTimeFromDate(issue.createdAt)}
        />
      ) : null}
      <MetaRow
        label={translate('auto.components.huly.metadata.updated', 'Updated')}
        value={issue.updatedAt ? formatUiRelativeTimeFromDate(issue.updatedAt) : noneLabel}
      />
    </div>
  )
}