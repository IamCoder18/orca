// Why: simple monogram placeholder for the Huly task source. The upstream
// brand has not published a square mark; a bold 'H' keeps Orca's source
// picker consistent in line weight and color with Jira/Linear icons.
export function HulyIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M3 4h4v6.5h10V4h4v16h-4v-6.5H7V20H3z" />
    </svg>
  )
}