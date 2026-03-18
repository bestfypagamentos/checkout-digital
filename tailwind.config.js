/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Semantic theme tokens (switch via CSS vars) ──────────────────────
        'th-bg':       'rgb(var(--th-bg)       / <alpha-value>)',
        'th-surface':  'rgb(var(--th-surface)  / <alpha-value>)',
        'th-raised':   'rgb(var(--th-raised)   / <alpha-value>)',
        'th-muted':    'rgb(var(--th-muted)    / <alpha-value>)',
        'th-line':     'rgb(var(--th-line)     / <alpha-value>)',
        'th-line-2':   'rgb(var(--th-line-2)   / <alpha-value>)',
        'th-text':     'rgb(var(--th-text)     / <alpha-value>)',
        'th-text-2':   'rgb(var(--th-text-2)   / <alpha-value>)',
        'th-text-3':   'rgb(var(--th-text-3)   / <alpha-value>)',
        'th-text-4':   'rgb(var(--th-text-4)   / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
