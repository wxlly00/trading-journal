import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Journal = lazy(() => import('./pages/Journal'))
const TradeDetail = lazy(() => import('./pages/TradeDetail'))
const Stats = lazy(() => import('./pages/Stats'))
const Performance = lazy(() => import('./pages/Performance'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Notes = lazy(() => import('./pages/Notes'))
const Playbook = lazy(() => import('./pages/Playbook'))
const Settings = lazy(() => import('./pages/Settings'))
const Calculator = lazy(() => import('./pages/Calculator'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuthStore()
  if (!initialized) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

const Spinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-6 h-6 border-2 border-dark border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  const { setSession } = useAuthStore()
  const { init: initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [setSession, initTheme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<Spinner />}><Dashboard /></Suspense>} />
          <Route path="journal" element={<Suspense fallback={<Spinner />}><Journal /></Suspense>} />
          <Route path="journal/:id" element={<Suspense fallback={<Spinner />}><TradeDetail /></Suspense>} />
          <Route path="stats" element={<Suspense fallback={<Spinner />}><Stats /></Suspense>} />
          <Route path="performance" element={<Suspense fallback={<Spinner />}><Performance /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<Spinner />}><Calendar /></Suspense>} />
          <Route path="notes" element={<Suspense fallback={<Spinner />}><Notes /></Suspense>} />
          <Route path="playbook" element={<Suspense fallback={<Spinner />}><Playbook /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<Spinner />}><Settings /></Suspense>} />
          <Route path="calculator" element={<Suspense fallback={<Spinner />}><Calculator /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
