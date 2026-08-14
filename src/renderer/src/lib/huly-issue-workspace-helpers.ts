import type { HulyIssue } from '../../../shared/huly'
import { translate } from '@/i18n/i18n'
import { toast } from 'sonner'

export function buildHulyBranchName(issue: HulyIssue): string {
  const slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
  return `${issue.identifier.toLowerCase()}${slug ? `-${slug}` : ''}`
}

export function buildHulyPrompt(issue: HulyIssue): string {
  return `Complete Huly issue ${issue.identifier}: ${issue.title}\n\n${issue.url}`
}

export async function copyHulyTextToClipboard(text: string, label: string): Promise<void> {
  try {
    await window.api.ui.writeClipboardText(text)
    toast.success(translate('auto.components.huly.issueWorkspace.copied', '{label} copied', { label }))
  } catch {
    toast.error(
      translate('auto.components.huly.issueWorkspace.copyFailed', 'Failed to copy {label}', {
        label: label.toLowerCase()
      })
    )
  }
}