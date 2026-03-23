type BadgeVariant = 'buy' | 'sell' | 'win' | 'loss' | 'neutral'

export function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const styles: Record<BadgeVariant, string> = {
    buy: 'bg-green/10 text-green',
    sell: 'bg-red/10 text-red',
    win: 'bg-dark text-white',
    loss: 'bg-subtle text-[#999]',
    neutral: 'bg-subtle text-[#666]',
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${styles[variant]}`}>
      {label}
    </span>
  )
}
