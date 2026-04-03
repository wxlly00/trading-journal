interface Option { label: string; value: string }

interface Props {
  options: Option[]
  value: string
  onChange: (v: string) => void
}

export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <div className="flex gap-0.5 bg-subtle border border-border rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all ${
            value === o.value
              ? 'bg-card text-dark font-semibold shadow-sm'
              : 'text-muted hover:text-dark'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
