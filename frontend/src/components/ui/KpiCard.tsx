interface KpiCardProps {
  label: string
  value: string
  delta?: string
  deltaPositive?: boolean
  subtext?: string
  progressPct?: number
  progressColor?: 'green' | 'red'
  valuePositive?: boolean
}

export function KpiCard({
  label, value, delta, deltaPositive, subtext, progressPct, progressColor = 'green', valuePositive,
}: KpiCardProps) {
  const valueColor =
    valuePositive != null ? (valuePositive ? 'text-green' : 'text-red') : 'text-dark'

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-[.05em] mb-1.5">{label}</p>
      <p className={`text-[26px] font-extrabold leading-none tracking-tight mb-1.5 ${valueColor}`}>{value}</p>

      {progressPct != null && (
        <div className="h-1 bg-border rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full ${progressColor === 'green' ? 'bg-green' : 'bg-red'}`}
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      )}

      {delta && (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          deltaPositive == null
            ? 'bg-subtle text-muted'
            : deltaPositive
            ? 'bg-green-bg text-green'
            : 'bg-red-bg text-red'
        }`}>
          {deltaPositive != null && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5">
              {deltaPositive
                ? <polyline points="18 15 12 9 6 15" />
                : <polyline points="6 9 12 15 18 9" />
              }
            </svg>
          )}
          {delta}
        </span>
      )}

      {subtext && !delta && (
        <p className="text-[11px] text-muted mt-0.5">{subtext}</p>
      )}
    </div>
  )
}
