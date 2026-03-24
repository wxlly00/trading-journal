/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        surface: 'var(--c-surface)',
        card: 'var(--c-card)',
        dark: 'var(--c-dark)',
        muted: 'var(--c-muted)',
        subtle: 'var(--c-subtle)',
        border: 'var(--c-border)',
        green: '#22c55e',
        red: '#ef4444',
      },
    },
  },
  plugins: [],
}
