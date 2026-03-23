interface Option { label: string; value: string }

interface Props {
  options: Option[]
  value: string
  onChange: (v: string) => void
}

export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-card rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === o.value ? 'bg-dark text-white' : 'text-[#888] hover:text-dark'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
