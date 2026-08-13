// Why: shared Huly presentation helpers used by the task page list and the
// issue workspace so they cannot drift on label or state-tone semantics.
import { translate } from '@/i18n/i18n'

export function getHulyPriorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return translate('auto.components.TaskPage.huly.priority.noPriority', 'No priority')
    case 1:
      return translate('auto.components.TaskPage.huly.priority.urgent', 'Urgent')
    case 2:
      return translate('auto.components.TaskPage.huly.priority.high', 'High')
    case 3:
      return translate('auto.components.TaskPage.huly.priority.medium', 'Medium')
    case 4:
      return translate('auto.components.TaskPage.huly.priority.low', 'Low')
    default:
      return `Priority ${priority}`
  }
}

export function stateToneClasses(type: string): string {
  const t = type.toLowerCase()
  if (t === 'done' || t === 'completed' || t === 'closed') {
    return 'border-status-success-border/50 bg-status-success-background/60 text-status-success'
  }
  if (t === 'in-progress' || t === 'started') {
    return 'border-status-warning-border/50 bg-status-warning-background/60 text-status-warning'
  }
  return 'border-border bg-muted/60 text-muted-foreground'
}
