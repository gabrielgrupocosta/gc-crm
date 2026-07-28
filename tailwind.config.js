/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:               '#F7F7F8',
        surface:          '#FFFFFF',
        border:           '#E8E8E8',
        'border-subtle':  '#F3F3F3',
        'border-hover':   '#DDDDDD',
        'text-primary':   '#111111',
        'text-muted':     '#666666',
        'text-subtle':    '#999999',
        'text-faint':     '#BBBBBB',
        accent:           '#FF4B2E',
        'accent-hover':   '#E63E1F',
        'accent-soft':    '#FFF1ED',
        'accent-soft-alt':'#FFEDE8',
        positive:         '#00C896',
        negative:         '#DC2626',
        warning:          '#CA8A04',
        'warning-soft':   '#FFFBEB',
        'warning-text':   '#B45309',
        'warning-border': '#FDE68A',
        'warning-icon':   '#D97706',
        'blue-soft':      '#EFF6FF',
        'blue-text':      '#1D4ED8',
        'blue-border':    '#BFDBFE',
        'red-soft':       '#FFF0F0',
        'red-border':     '#FECACA',
        // Identidade iHubfood — usar em Sidebar/Header (dark) e como tokens
        // nomeados de marca; accent/positive acima já apontam pros mesmos
        // valores de brand-accent/brand-green pra não exigir troca em massa
        // de classes existentes (bg-accent, text-positive etc já viram a marca).
        'brand-dark':       '#0E1116',
        'brand-dark-hover': '#1C2128',
        'brand-accent':     '#FF4B2E',
        'brand-green':      '#00C896',
        'brand-blue':       '#2563EB',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'kpi':   ['28px', { lineHeight: '1', fontWeight: '700' }],
        'label': ['11px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        'field': ['13px', { lineHeight: '1.5' }],
        'data':  ['13px', { lineHeight: '1.5' }],
        'page':  ['15px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        md:      '8px',
        lg:      '10px',
        xl:      '12px',
      },
      boxShadow: {
        card:      '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        modal:     '0 8px 32px rgba(0,0,0,0.12)',
        dropdown:  '0 1px 3px rgba(0,0,0,0.06)',
      },
      spacing: {
        '18': '4.5rem',
      },
      width: {
        sidebar: '220px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast:    '100ms',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
      animation: {
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
