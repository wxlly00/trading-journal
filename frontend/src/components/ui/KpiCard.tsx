interface KpiCardProps {
  label: string
  value: string
  change?: string
  changePositive?: boolean
  dark?: boolean
}

export function KpiCard({ label, value, change, changePositive, dark }: KpiCardProps) {
  return (
    <div className={`rounded-2xl p-5 ${dark ? 'bg-dark' : 'bg-card'}`}>
      <p className={`text-xs font-medium mb-2 ${dark ? 'text-[#666]' : 'text-[#999]'}`}>{label}</p>
      <p className={`text-3xl font-extrabold ${dark ? 'text-white' : 'text-dark'}`}>{value}</p>
      {change && (
        <p className={`text-xs mt-1.5 ${changePositive == null ? 'text-[#888]' : changePositive ? 'text-green' : 'text-red'}`}>
          {change}
        </p>
      )}
    </div>
  )
}
