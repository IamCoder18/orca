import type { HulyIssue } from '../../../shared/huly'
import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { buildHulyWorkspaceSource } from '../../../shared/new-workspace/workspace-source'

export function isHulyLinkedWorkItem(
  item: Pick<LinkedWorkItemSummary, 'provider' | 'hulyIdentifier'> | null | undefined
): boolean {
  return item?.provider === 'huly' || Boolean(item?.hulyIdentifier?.trim())
}

export function buildHulyIssueLinkedWorkItem(issue: HulyIssue): LinkedWorkItemSummary {
  return buildHulyWorkspaceSource(issue)
}