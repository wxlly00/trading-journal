import { useState, useEffect } from 'react'

type OS = 'ios' | 'samsung' | 'android' | null

function detectOS(): OS {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/SamsungBrowser/i.test(ua)) return 'samsung'
  if (/android/i.test(ua)) return 'android'
  return null
}

function isStandalone(): boolean {
  return (
    ('standalone' in navigator && (navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [os, setOs] = useState<OS>(null)

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem('tj-install-dismissed')) return
    const detected = detectOS()
    if (!detected) return
    setOs(detected)
    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem('tj-install-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[5rem] md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-30">
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 bg-dark rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <rect x="2" y="12" width="4" height="10" rx="1" fill="white"/>
              <rect x="10" y="7" width="4" height="15" rx="1" fill="white"/>
              <rect x="18" y="2" width="4" height="20" rx="1" fill="white"/>
              <path d="M3 10 L11 5 L19 1" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-dark">Installer l'app</p>
            <p className="text-xs text-muted">Accès rapide depuis ton écran d'accueil</p>
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg text-muted hover:text-dark hover:bg-subtle transition-colors flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Instructions */}
        {!expanded ? (
          <div className="px-4 pb-3">
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-2 bg-dark text-white rounded-lg text-xs font-semibold hover:bg-[#333] transition-colors"
            >
              Voir comment faire →
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {os === 'ios' && (
              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">1</span>
                  <div className="text-xs text-dark leading-relaxed">
                    Appuie sur le bouton{' '}
                    <span className="inline-flex items-center gap-0.5 font-semibold">
                      Partager
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 inline">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                      </svg>
                    </span>{' '}
                    en bas de Safari
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">2</span>
                  <p className="text-xs text-dark leading-relaxed">Fais défiler et appuie sur <span className="font-semibold">« Sur l'écran d'accueil »</span></p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">3</span>
                  <p className="text-xs text-dark leading-relaxed">Appuie sur <span className="font-semibold">Ajouter</span> en haut à droite</p>
                </li>
              </ol>
            )}
            {os === 'samsung' && (
              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">1</span>
                  <p className="text-xs text-dark leading-relaxed">
                    Appuie sur le menu <span className="font-semibold">☰</span> en bas de Samsung Internet
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">2</span>
                  <p className="text-xs text-dark leading-relaxed">Appuie sur <span className="font-semibold">« Ajouter page à »</span></p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">3</span>
                  <p className="text-xs text-dark leading-relaxed">Appuie sur <span className="font-semibold">« Écran d'accueil »</span> puis confirme</p>
                </li>
              </ol>
            )}
            {os === 'android' && (
              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">1</span>
                  <div className="text-xs text-dark leading-relaxed">
                    Appuie sur le menu <span className="font-semibold">⋮</span> en haut à droite de Chrome
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">2</span>
                  <p className="text-xs text-dark leading-relaxed">Appuie sur <span className="font-semibold">« Ajouter à l'écran d'accueil »</span></p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">3</span>
                  <p className="text-xs text-dark leading-relaxed">Confirme en appuyant sur <span className="font-semibold">Ajouter</span></p>
                </li>
              </ol>
            )}
            <button
              onClick={dismiss}
              className="w-full mt-3 py-1.5 text-xs text-muted hover:text-dark transition-colors"
            >
              Ne plus afficher
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
