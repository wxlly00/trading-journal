import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  initialized: boolean
  setSession: (s: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => set({ session, initialized: true }),
}))
