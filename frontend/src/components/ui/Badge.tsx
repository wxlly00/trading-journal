type BadgeVariant = 'buy' | 'sell' | 'win' | 'loss' | 'open' | 'neutral'

export function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const styles: Record<BadgeVariant, string> = {
    buy:     'bg-blue-bg text-blue',
    sell:    'bg-purple-bg text-purple',
    win:     'bg-green-bg text-green',
    loss:    'bg-red-bg text-red',
    open:    'bg-amber-bg text-amber',
    neutral: 'bg-subtle text-muted',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${styles[variant]}`}>
      {label}
    </span>
  )
}
