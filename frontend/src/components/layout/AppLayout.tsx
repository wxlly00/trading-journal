import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useAccountStore } from '../../stores/account'
import { useThemeStore } from '../../stores/theme'
import { Toaster } from '../ui/Toaster'
import { supabase } from '../../lib/supabase'
import { LivePill } from '../ui/LivePill'

// ── Desktop sidebar nav items ──────────────────────────────────────────────

const sidebarNav = [
  {
    to: '/', label: 'Dashboard', exact: true,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
  },
  {
    to: '/journal', label: 'Journal',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  },
  {
    to: '/stats', label: 'Statistiques',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  },
  {
    to: '/performance', label: 'Performance',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  },
  {
    to: '/calendar', label: 'Calendrier',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  },
  {
    to: '/notes', label: 'Notes',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  },
  {
    to: '/playbook', label: 'Playbook',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  },
  {
    to: '/calculator', label: 'Calculateur',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>
  },
]

// ── Mobile bottom tabs (5 main + more) ────────────────────────────────────

const mobileTabs = [
  {
    to: '/', label: 'Accueil', exact: true,
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/journal', label: 'Journal', exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  {
    to: '/notes', label: 'Notes', exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    to: '/stats', label: 'Stats', exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-6 h-6">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

// ── More sheet items ────────────────────────────────────────────────────────

const moreItems = [
  { to: '/performance', label: 'Performance', icon: '📈' },
  { to: '/calendar', label: 'Calendrier', icon: '📅' },
  { to: '/playbook', label: 'Playbook', icon: '📚' },
  { to: '/calculator', label: 'Calculateur', icon: '🧮' },
  { to: '/settings', label: 'Paramètres', icon: '⚙️' },
]

// ── Component ──────────────────────────────────────────────────────────────

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeAccountId } = useAccountStore()
  const { isDark, toggle, init } = useThemeStore()
  const [moreOpen, setMoreOpen] = useState(false)

  // Init dark mode class on mount
  useEffect(() => { init() }, [init])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Close "more" sheet when navigating
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  // Check if any "more" route is active
  const moreActive = moreItems.some((item) =>
    item.to === '/settings'
      ? location.pathname === '/settings'
      : location.pathname.startsWith(item.to)
  )

  return (
    <div className="flex flex-col md:flex-row h-screen md:max-w-[1280px] md:mx-auto md:my-5 md:rounded-2xl md:overflow-hidden md:shadow-[0_8px_40px_rgba(0,0,0,0.10)]">

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside className="hidden md:flex w-52 bg-card flex-col py-6 px-4 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect x="2" y="12" width="4" height="10" rx="1" fill="currentColor" className="text-dark"/>
            <rect x="10" y="7" width="4" height="15" rx="1" fill="currentColor" className="text-dark"/>
            <rect x="18" y="2" width="4" height="20" rx="1" fill="currentColor" className="text-dark"/>
            <path d="M3 10 L11 5 L19 1" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-lg font-extrabold text-dark">TJ</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {sidebarNav.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive ? 'bg-subtle font-semibold text-dark' : 'text-muted hover:text-dark'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="mt-auto flex flex-col gap-1">
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-dark transition-all w-full text-left"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {isDark ? 'Mode clair' : 'Mode sombre'}
          </button>

          <div className="px-3 pb-3">
            <LivePill connected={!!activeAccountId} />
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive ? 'bg-subtle font-semibold text-dark' : 'text-muted hover:text-dark'
              }`
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            Parametres
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-red transition-all w-full text-left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Deconnexion
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ─────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <rect x="2" y="12" width="4" height="10" rx="1" fill="currentColor" className="text-dark"/>
            <rect x="10" y="7" width="4" height="15" rx="1" fill="currentColor" className="text-dark"/>
            <rect x="18" y="2" width="4" height="20" rx="1" fill="currentColor" className="text-dark"/>
            <path d="M3 10 L11 5 L19 1" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-base font-extrabold text-dark">TradingJournal</span>
        </div>
        <div className="flex items-center gap-2">
          <LivePill connected={!!activeAccountId} />
          <button
            onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-subtle text-muted"
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 bg-surface overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-40">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {mobileTabs.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] ${
                  isActive ? 'text-dark' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'tab-pop' : ''}>{icon(isActive)}</span>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-dark font-semibold' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] ${
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

      {/* ── MOBILE MORE SHEET ─────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl safe-bottom">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-subtle" />
            </div>

            <div className="px-4 pb-4 space-y-1">
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
                  <span className="text-xl">{icon}</span>
                  {label}
                </NavLink>
              ))}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-medium text-red w-full text-left mt-2"
              >
                <span className="text-xl">🚪</span>
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── TOASTER ───────────────────────────────────────────────── */}
      <Toaster />
    </div>
  )
}
