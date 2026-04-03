import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useAccountStore } from '../../stores/account'
import { useThemeStore } from '../../stores/theme'
import { Toaster } from '../ui/Toaster'
import { GlobalSearch } from '../ui/GlobalSearch'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'

// ── Page title map ─────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/':              'Dashboard',
  '/journal':       'Journal',
  '/stats':         'Statistiques',
  '/performance':   'Performance',
  '/calendar':      'Calendrier',
  '/notes':         'Notes',
  '/playbook':      'Playbook',
  '/calculator':    'Calculateur',
  '/ai':            'Analyse IA',
  '/eco-calendar':  'Calendrier Éco.',
  '/import':        'Import CSV',
  '/rules':         'Mes règles',
  '/settings':      'Paramètres',
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/journal/')) return 'Détail du trade'
  return PAGE_TITLES[pathname] ?? 'TradingJournal'
}

// ── Nav items ──────────────────────────────────────────────────────────────────

const mainNav = [
  {
    to: '/', label: 'Dashboard', exact: true,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    to: '/journal', label: 'Journal', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  {
    to: '/performance', label: 'Performance', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    to: '/stats', label: 'Statistiques', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
]

const toolsNav = [
  {
    to: '/calendar', label: 'Calendrier', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    to: '/rules', label: 'Mes règles', exact: false, badge: 'rules',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    to: '/calculator', label: 'Calculateur', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>,
  },
  {
    to: '/ai', label: 'Analyse IA', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  },
  {
    to: '/eco-calendar', label: 'Éco. Calendrier', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/></svg>,
  },
  {
    to: '/import', label: 'Import CSV', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  },
  {
    to: '/notes', label: 'Notes', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  {
    to: '/playbook', label: 'Playbook', exact: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  },
]

const mobileTabs = [
  {
    to: '/', label: 'Accueil', exact: true,
    icon: (a: boolean) => <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    to: '/journal', label: 'Journal', exact: false,
    icon: (a: boolean) => <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  {
    to: '/stats', label: 'Stats', exact: false,
    icon: (a: boolean) => <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    to: '/calendar', label: 'Calendrier', exact: false,
    icon: (a: boolean) => <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
]

const moreItems = [
  { to: '/performance', label: 'Performance', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { to: '/notes', label: 'Notes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { to: '/playbook', label: 'Playbook', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { to: '/rules', label: 'Mes règles', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { to: '/calculator', label: 'Calculateur', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/></svg> },
  { to: '/ai', label: 'Analyse IA', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  { to: '/eco-calendar', label: 'Éco. Calendrier', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { to: '/import', label: 'Import CSV', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { to: '/settings', label: 'Paramètres', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeAccountId } = useAccountStore()
  const { isDark, toggle, init } = useThemeStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [accountInfo, setAccountInfo] = useState<{ name: string; broker?: string } | null>(null)

  useEffect(() => { init() }, [init])

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close more sheet on nav
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  // Fetch violation count + account info
  useEffect(() => {
    if (!activeAccountId) return
    api.get<{ total_violations: number }>('/api/rules/stats')
      .then(d => setViolationCount(d.total_violations ?? 0))
      .catch(() => {})
    api.get<{ id: string; name: string; broker?: string }[]>('/api/accounts')
      .then(accounts => {
        const acc = accounts.find(a => a.id === activeAccountId)
        if (acc) setAccountInfo({ name: acc.name, broker: acc.broker })
      })
      .catch(() => {})
  }, [activeAccountId])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const moreActive = moreItems.some(item =>
    item.to === '/settings'
      ? location.pathname === '/settings'
      : location.pathname.startsWith(item.to)
  )

  const pageTitle = getPageTitle(location.pathname)

  // ── Sidebar NavItem helper ─────────────────────────────────────────────────

  function SideNavItem({
    to, label, icon, exact, badge,
  }: { to: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: string }) {
    return (
      <NavLink
        to={to}
        end={exact}
        className={({ isActive }) =>
          `flex items-center gap-[9px] px-2 py-[7px] rounded-lg text-[13.5px] transition-all w-full ${
            isActive
              ? 'bg-subtle font-semibold text-dark'
              : 'text-text2 hover:bg-subtle hover:text-dark font-medium'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span className={`flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{icon}</span>
            <span className="flex-1 min-w-0 truncate">{label}</span>
            {badge === 'rules' && violationCount > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-red-bg text-red px-1.5 py-0.5 rounded-full">
                {violationCount}
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  // ── Icon buttons ──────────────────────────────────────────────────────────

  const DarkModeIcon = () => isDark
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">

      {/* ══════════ DESKTOP SIDEBAR ══════════ */}
      <aside className="hidden md:flex flex-col w-[220px] bg-card border-r border-border flex-shrink-0 py-5 px-3">

        {/* Logo */}
        <div className="flex items-center gap-2 px-2 pb-5 mb-3 border-b border-border">
          <div className="w-7 h-7 bg-dark rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <rect x="1" y="8" width="3" height="7" rx=".5" fill="white"/>
              <rect x="6.5" y="5" width="3" height="9.5" rx=".5" fill="white"/>
              <rect x="12" y="1" width="3" height="14" rx=".5" fill="white"/>
              <path d="M2.5 7L8 3.5L13.5 1" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-[14px] font-bold tracking-tight text-dark">TradingJournal</span>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5 mb-2">
          {mainNav.map(item => <SideNavItem key={item.to} {...item} />)}
        </nav>

        {/* Tools section */}
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-[.08em] px-2 mb-1.5">
            Outils
          </p>
          <nav className="flex flex-col gap-0.5">
            {toolsNav.map(item => <SideNavItem key={item.to} {...item} />)}
          </nav>
        </div>

        {/* Bottom */}
        <div className="mt-auto pt-3 border-t border-border space-y-0.5">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-[9px] px-2 py-[7px] rounded-lg text-[13.5px] transition-all ${
                isActive ? 'bg-subtle font-semibold text-dark' : 'text-text2 hover:bg-subtle hover:text-dark font-medium'
              }`
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px] opacity-70"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Paramètres
          </NavLink>
          <button
            onClick={toggle}
            className="flex items-center gap-[9px] px-2 py-[7px] rounded-lg text-[13.5px] text-text2 hover:bg-subtle hover:text-dark transition-all w-full font-medium"
          >
            <span className="opacity-70"><DarkModeIcon /></span>
            {isDark ? 'Mode clair' : 'Mode sombre'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-[9px] px-2 py-[7px] rounded-lg text-[13.5px] text-text2 hover:bg-subtle hover:text-red transition-all w-full font-medium"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px] opacity-70"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Déconnexion
          </button>

          {/* Account badge */}
          {activeAccountId && (
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-subtle transition-all mt-1">
              <div className="w-2 h-2 rounded-full bg-green animate-pulse-dot flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-dark truncate">
                  {accountInfo?.name ?? 'Compte actif'}
                </p>
                {accountInfo?.broker && (
                  <p className="text-[11px] text-muted truncate">{accountInfo.broker}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════ MAIN AREA ══════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Desktop topbar ── */}
        <header className="hidden md:flex h-[52px] bg-card border-b border-border items-center justify-between px-7 flex-shrink-0 sticky top-0 z-10">
          <span className="text-[15px] font-bold text-dark">{pageTitle}</span>
          <div className="flex items-center gap-2.5">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] text-muted w-48 hover:border-dark/20 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Rechercher…</span>
              <span className="ml-auto text-[10px] bg-border px-1.5 py-0.5 rounded font-semibold">⌘K</span>
            </button>

            {/* Notifications */}
            <button className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-text2 hover:bg-subtle transition-colors relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {violationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {Math.min(violationCount, 9)}
                </span>
              )}
            </button>

            {/* Dark mode */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-text2 hover:bg-subtle transition-colors"
            >
              <DarkModeIcon />
            </button>
          </div>
        </header>

        {/* ── Mobile topbar ── */}
        <header className="md:hidden bg-card border-b border-border flex-shrink-0 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-dark rounded-md flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <rect x="1" y="8" width="3" height="7" rx=".5" fill="white"/>
                  <rect x="6.5" y="5" width="3" height="9.5" rx=".5" fill="white"/>
                  <rect x="12" y="1" width="3" height="14" rx=".5" fill="white"/>
                  <path d="M2.5 7L8 3.5L13.5 1" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-[15px] font-bold text-dark">TradingJournal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-subtle text-muted"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button
                onClick={toggle}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-subtle text-muted"
              >
                <DarkModeIcon />
              </button>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto pb-safe-nav md:pb-0 bg-surface">
          <div key={location.pathname} className="animate-page-in min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ══════════ MOBILE BOTTOM TAB BAR ══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border safe-bottom z-40">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {mobileTabs.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px] transition-all ${
                  isActive ? 'text-dark' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'tab-pop' : ''}>{icon(isActive)}</span>
                  <span className={`text-[10px] font-medium ${isActive ? 'font-semibold text-dark' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px] transition-all ${
              moreActive ? 'text-dark' : 'text-muted'
            }`}
          >
            <svg viewBox="0 0 24 24" fill={moreActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
            </svg>
            <span className="text-[10px] font-medium">Plus</span>
          </button>
        </div>
      </nav>

      {/* ══════════ MOBILE MORE SHEET ══════════ */}
      {moreOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl safe-bottom">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-subtle" />
            </div>
            <div className="px-4 pb-4 space-y-0.5">
              {moreItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                      isActive ? 'bg-subtle text-dark font-semibold' : 'text-dark'
                    }`
                  }
                >
                  <span className="w-5 h-5 flex items-center justify-center text-text2">{icon}</span>
                  {label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-medium text-red w-full text-left mt-2"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      <Toaster />
    </div>
  )
}
