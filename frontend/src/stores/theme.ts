import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  isDark: boolean
  toggle: () => void
  init: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggle: () => {
        const isDark = !get().isDark
        document.documentElement.classList.toggle('dark', isDark)
        set({ isDark })
      },
      init: () => {
        document.documentElement.classList.toggle('dark', get().isDark)
      },
    }),
    { name: 'tj-theme' }
  )
)
