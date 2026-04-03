/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'] },
      colors: {
        surface:   'var(--c-surface)',
        card:      'var(--c-card)',
        dark:      'var(--c-dark)',
        text2:     'var(--c-text2)',
        muted:     'var(--c-muted)',
        subtle:    'var(--c-subtle)',
        border:    'var(--c-border)',
        green:     'var(--c-green)',
        'green-bg':'var(--c-green-bg)',
        red:       'var(--c-red)',
        'red-bg':  'var(--c-red-bg)',
        blue:      'var(--c-blue)',
        'blue-bg': 'var(--c-blue-bg)',
        amber:     'var(--c-amber)',
        'amber-bg':'var(--c-amber-bg)',
        purple:    'var(--c-purple)',
        'purple-bg':'var(--c-purple-bg)',
      },
    },
  },
  plugins: [],
}
