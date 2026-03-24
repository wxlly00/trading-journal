import { useEffect, useRef } from 'react'
import { useThemeStore } from '../../stores/theme'

interface Props {
  symbol: string
}

// Normalize symbol for TradingView (e.g. "EURUSD" → "FX:EURUSD", "BTCUSD" stays as is)
function toTvSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Common FX pairs
  const fxCurrencies = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']
  const base = s.slice(0, 3)
  const quote = s.slice(3, 6)
  if (fxCurrencies.includes(base) && fxCurrencies.includes(quote)) {
    return `FX:${s}`
  }
  // US indices
  if (['US30', 'US500', 'NAS100', 'SPX500'].includes(s)) return `TVC:${s}`
  if (s === 'XAUUSD') return 'TVC:GOLD'
  if (s === 'XAGUSD') return 'TVC:SILVER'
  if (s === 'WTI' || s === 'USOIL') return 'TVC:USOIL'
  return s
}

export function TradingViewWidget({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDark } = useThemeStore()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget
    container.innerHTML = ''

    const inner = document.createElement('div')
    inner.className = 'tradingview-widget-container__widget'
    inner.style.height = '100%'
    container.appendChild(inner)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: toTvSymbol(symbol),
      interval: 'H1',
      timezone: 'Europe/Paris',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'fr',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [symbol, isDark])

  return (
    <div
      className="tradingview-widget-container rounded-xl overflow-hidden"
      ref={containerRef}
      style={{ height: 440, width: '100%' }}
    />
  )
}
