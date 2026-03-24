import { useState, useMemo } from 'react'
import { useAccountStore } from '../stores/account'

interface Instrument {
  label: string
  pipValue: number   // $ per pip per standard lot
  pipSize: number    // price movement = 1 pip
  unit: string
}

const INSTRUMENTS: Instrument[] = [
  { label: 'EURUSD', pipValue: 10,    pipSize: 0.0001, unit: 'pips' },
  { label: 'GBPUSD', pipValue: 10,    pipSize: 0.0001, unit: 'pips' },
  { label: 'AUDUSD', pipValue: 10,    pipSize: 0.0001, unit: 'pips' },
  { label: 'NZDUSD', pipValue: 10,    pipSize: 0.0001, unit: 'pips' },
  { label: 'USDCAD', pipValue: 7.8,   pipSize: 0.0001, unit: 'pips' },
  { label: 'USDCHF', pipValue: 11.2,  pipSize: 0.0001, unit: 'pips' },
  { label: 'USDJPY', pipValue: 9.1,   pipSize: 0.01,   unit: 'pips' },
  { label: 'EURJPY', pipValue: 9.1,   pipSize: 0.01,   unit: 'pips' },
  { label: 'GBPJPY', pipValue: 9.1,   pipSize: 0.01,   unit: 'pips' },
  { label: 'XAUUSD', pipValue: 10,    pipSize: 0.1,    unit: 'pts'  },
  { label: 'XAGUSD', pipValue: 50,    pipSize: 0.01,   unit: 'pts'  },
  { label: 'US30',   pipValue: 1,     pipSize: 1,      unit: 'pts'  },
  { label: 'NAS100', pipValue: 1,     pipSize: 0.25,   unit: 'pts'  },
  { label: 'SPX500', pipValue: 12.5,  pipSize: 0.25,   unit: 'pts'  },
  { label: 'Autre',  pipValue: 10,    pipSize: 0.0001, unit: 'pips' },
]

function InputField({
  label, value, onChange, suffix, min, max, step, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  min?: number
  max?: number
  step?: number | string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step ?? 'any'}
          className="w-full px-4 py-3 bg-subtle rounded-xl text-dark text-base font-medium outline-none focus:ring-2 focus:ring-dark/20 transition-all"
          style={{ fontSize: '16px' /* prevent iOS zoom */ }}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm font-medium pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  )
}

export default function Calculator() {
  const { activeAccountId } = useAccountStore()

  const [instrument, setInstrument] = useState<Instrument>(INSTRUMENTS[0])
  const [capital, setCapital] = useState('10000')
  const [riskPct, setRiskPct] = useState('1')
  const [slPips, setSlPips] = useState('20')

  const result = useMemo(() => {
    const cap = parseFloat(capital) || 0
    const risk = parseFloat(riskPct) || 0
    const sl = parseFloat(slPips) || 0
    if (cap <= 0 || risk <= 0 || sl <= 0) return null

    const riskAmount = cap * risk / 100
    const pipValuePerLot = instrument.pipValue
    const lotSize = riskAmount / (sl * pipValuePerLot)
    const minLot = 0.01
    const rounded = Math.max(minLot, Math.floor(lotSize / minLot) * minLot)

    return {
      riskAmount: riskAmount.toFixed(2),
      lotSize: lotSize.toFixed(4),
      lotRounded: rounded.toFixed(2),
      pipValuePerLot,
      slPrice: (sl * instrument.pipSize).toFixed(instrument.pipSize < 0.01 ? 5 : 2),
    }
  }, [capital, riskPct, slPips, instrument])

  const riskPctNum = parseFloat(riskPct) || 0
  const riskColor =
    riskPctNum > 3 ? 'text-red' :
    riskPctNum > 2 ? 'text-[#f97316]' :
    'text-green'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-extrabold text-dark">Calculateur</h1>
        <p className="text-muted text-sm mt-0.5">Taille de position optimale</p>
      </div>

      {/* Instrument selector */}
      <div>
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
          Instrument
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {INSTRUMENTS.slice(0, -1).map((inst) => (
            <button
              key={inst.label}
              onClick={() => setInstrument(inst)}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                instrument.label === inst.label
                  ? 'bg-dark text-white'
                  : 'bg-subtle text-muted hover:text-dark'
              }`}
            >
              {inst.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <InputField
          label="Capital du compte"
          value={capital}
          onChange={setCapital}
          suffix="$"
          min={0}
          hint={activeAccountId ? undefined : 'Entrez votre capital'}
        />
        <InputField
          label="Risque par trade"
          value={riskPct}
          onChange={setRiskPct}
          suffix="%"
          min={0.1}
          max={10}
          step={0.1}
          hint={`Montant risqué : ${result ? `$${result.riskAmount}` : '—'}`}
        />
        <InputField
          label={`Stop Loss (${instrument.unit})`}
          value={slPips}
          onChange={setSlPips}
          suffix={instrument.unit}
          min={0.1}
          step={instrument.pipSize < 0.01 ? 1 : 0.1}
          hint={`= ${result?.slPrice ?? '—'} pts de prix`}
        />
      </div>

      {/* Result card */}
      {result ? (
        <div className="bg-dark rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-[#666] text-xs font-semibold uppercase tracking-wider mb-1">
              Taille de position
            </p>
            <p className="text-5xl font-black text-white">{result.lotRounded}</p>
            <p className="text-[#555] text-sm mt-1">lots</p>
          </div>

          <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-[#555] text-xs uppercase tracking-wider mb-0.5">Montant risqué</p>
              <p className={`text-xl font-bold ${riskColor}`}>${result.riskAmount}</p>
            </div>
            <div className="text-center">
              <p className="text-[#555] text-xs uppercase tracking-wider mb-0.5">Lots exacts</p>
              <p className="text-xl font-bold text-white">{result.lotSize}</p>
            </div>
          </div>

          {riskPctNum > 2 && (
            <div className={`rounded-xl px-3 py-2 text-xs font-medium text-center ${
              riskPctNum > 3 ? 'bg-red/20 text-red' : 'bg-[#f97316]/20 text-[#f97316]'
            }`}>
              {riskPctNum > 3
                ? '⚠️ Risque élevé — recommandé : ≤ 2%'
                : '⚡ Risque modéré — soyez prudent'}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl p-8 text-center text-muted text-sm">
          Remplissez les champs pour calculer
        </div>
      )}

      {/* Risk guide */}
      <div className="bg-card rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Guide du risque</p>
        <div className="space-y-1.5">
          {[
            { label: '0.5 – 1%', desc: 'Conservateur — idéal en apprentissage', color: 'bg-green' },
            { label: '1 – 2%',   desc: 'Standard — trader intermédiaire',        color: 'bg-green/60' },
            { label: '2 – 3%',   desc: 'Agressif — expérience requise',           color: 'bg-[#f97316]' },
            { label: '> 3%',     desc: 'Très risqué — éviter',                    color: 'bg-red' },
          ].map((g) => (
            <div key={g.label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${g.color}`} />
              <span className="text-xs font-semibold text-dark w-20">{g.label}</span>
              <span className="text-xs text-muted">{g.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
