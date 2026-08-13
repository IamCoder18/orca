import React, { useMemo } from 'react'
import { Clipboard, ExternalLink, GitBranch } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { getUsableHulyBranchName } from '../../../shared/new-workspace/workspace-source'
import type { HulyIssue } from '../../../shared/huly'
import { buildHulyBranchName, buildHulyPrompt, copyHulyTextToClipboard } from '@/lib/huly-issue-workspace-helpers'

type Props = { issue: HulyIssue }

export function HulyIssueActionSidebar({ issue }: Props): React.JSX.Element {
  const items = useMemo(
    () => [
      {
        label: translate('auto.components.huly.issueWorkspace.openInHuly', 'Open in Huly'),
        icon: ExternalLink,
        action: () => window.api.shell.openUrl(issue.url)
      },
      {
        label: translate('auto.components.huly.issueWorkspace.copyUrl', 'Copy URL'),
        icon: Clipboard,
        action: () =>
          void copyHulyTextToClipboard(
            issue.url,
            translate('auto.components.huly.issueWorkspace.urlLabel', 'URL')
          )
      },
      {
        label: translate('auto.components.huly.issueWorkspace.copyIdentifier', 'Copy identifier'),
        icon: Clipboard,
        action: () =>
          void copyHulyTextToClipboard(
            issue.identifier,
            translate('auto.components.huly.issueWorkspace.identifierLabel', 'Identifier')
          )
      },
      {
        label: translate('auto.components.huly.issueWorkspace.copyBranchName', 'Copy suggested branch name'),
        icon: GitBranch,
        action: () =>
          void copyHulyTextToClipboard(
            getUsableHulyBranchName(buildHulyBranchName(issue)),
            translate('auto.components.huly.issueWorkspace.branchLabel', 'Branch name')
          )
      },
      {
        label: translate('auto.components.huly.issueWorkspace.copyPrompt', 'Copy prompt'),
        icon: Clipboard,
        action: () =>
          void copyHulyTextToClipboard(
            buildHulyPrompt(issue),
            translate('auto.components.huly.issueWorkspace.promptLabel', 'Prompt')
          )
      }
    ],
    [issue]
  )

  return (
    <div className="grid gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={item.action}
                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}