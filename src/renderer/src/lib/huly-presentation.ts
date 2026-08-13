// Why: shared Huly presentation helpers used by the task page list and the
// issue workspace so they cannot drift on label or state-tone semantics.
export const PRIORITY_LABEL: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low'
}

export function stateToneClasses(type: string): string {
  const t = type.toLowerCase()
  if (t === 'done' || t === 'completed' || t === 'closed') {
    return 'border-status-success-border/50 bg-status-success-background/60 text-status-success'
  }
  if (t === 'in-progress' || t === 'started') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }
  return 'border-border bg-muted/60 text-muted-foreground'
}
