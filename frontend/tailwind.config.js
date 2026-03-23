/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        surface: '#f5f5f5',
        card: '#ffffff',
        dark: '#111111',
        muted: '#888888',
        subtle: '#f0f0f0',
        green: '#22c55e',
        red: '#ef4444',
      },
    },
  },
  plugins: [],
}
