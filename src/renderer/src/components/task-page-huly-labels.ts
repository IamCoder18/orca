import type { HulyListFilter } from '../../../shared/huly'
import { translate } from '@/i18n/i18n'

export type HulySortOrder = 'updated' | 'priority' | 'identifier'

export const HULY_FILTERS: readonly HulyListFilter[] = ['assigned', 'created', 'all']
export const HULY_SORTS: readonly HulySortOrder[] = ['updated', 'priority', 'identifier']
export const HULY_DEFAULT_FILTER_KEY = 'orca-huly-default-filter'
export const HULY_ALL_WORKSPACES = '__all__'

export function hulyFilterLabel(id: HulyListFilter): string {
  switch (id) {
    case 'assigned':
      return translate('auto.components.TaskPage.huly.filter.assigned', 'Assigned to me')
    case 'created':
      return translate('auto.components.TaskPage.huly.filter.created', 'Created by me')
    case 'all':
    default:
      return translate('auto.components.TaskPage.huly.filter.all', 'All open')
  }
}

export function hulySortLabel(id: HulySortOrder): string {
  switch (id) {
    case 'updated':
      return translate('auto.components.TaskPage.huly.sort.updated', 'Updated')
    case 'priority':
      return translate('auto.components.TaskPage.huly.sort.priority', 'Priority')
    case 'identifier':
    default:
      return translate('auto.components.TaskPage.huly.sort.identifier', 'Identifier')
  }
}

export function readPersistedHulyPreference<T extends string>(
  key: string,
  allowed: readonly T[]
): T | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    return allowed.includes(raw as T) ? (raw as T) : null
  } catch {
    return null
  }
}