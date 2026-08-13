import type { HulyIssue } from '../../../shared/huly'
import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import {
  buildHulyWorkspaceSource,
  getUsableHulyBranchName
} from '../../../shared/new-workspace/workspace-source'

export function isHulyLinkedWorkItem(
  item: Pick<LinkedWorkItemSummary, 'provider' | 'hulyIdentifier'> | null | undefined
): boolean {
  return item?.provider === 'huly' || Boolean(item?.hulyIdentifier?.trim())
}

export function getHulyLinkedWorkItemBranchName(
  item:
    | Pick<LinkedWorkItemSummary, 'provider' | 'hulyIdentifier' | 'hulyTitle'>
    | null
    | undefined
): string | null {
  if (!isHulyLinkedWorkItem(item)) return null
  const safeItem = item as Pick<LinkedWorkItemSummary, 'hulyIdentifier' | 'hulyTitle'>
  return getUsableHulyBranchName(buildHulyBranchName(safeItem.hulyIdentifier ?? '', safeItem.hulyTitle ?? '')) || null
}

export function buildHulyIssueLinkedWorkItem(issue: HulyIssue): LinkedWorkItemSummary {
  return buildHulyWorkspaceSource(issue)
}

function buildHulyBranchName(identifier: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
  return `${identifier.toLowerCase()}${slug ? `-${slug}` : ''}`
}