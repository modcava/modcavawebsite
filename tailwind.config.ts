import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Admin dark-navy palette
        warm: {
          // Light blue/white admin theme
          // Low numbers = dark text, High numbers = light backgrounds
          50:  '#0f172a',  // darkest text  (h1)
          100: '#0f172a',  // dark headings (h1/h2)
          200: '#1e293b',  // dark text
          300: '#334155',  // table body text
          400: '#475569',  // secondary text
          500: '#64748b',  // labels / table headers
          600: '#94a3b8',  // subtle text + filter borders
          700: '#e2e8f0',  // dividers / thead bg / skeletons / hover
          750: '#f1f5f9',  // near-white content bg
          800: '#ffffff',  // white card surfaces
          900: '#1d4ed8',  // (reserved, sidebar uses explicit classes)
          950: '#1e3a8a',  // (reserved)
        },
        // Blue accent (replaces amber throughout admin)
        amber: {
          DEFAULT: '#3b82f6',
          light:   '#60a5fa',
          dark:    '#1d4ed8',
          hover:   '#2563eb',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        lora:    ['Lora', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        'amber':    '0 0 24px rgba(59,130,246,.20)',
        'amber-lg': '0 0 48px rgba(59,130,246,.28)',
        'card':     '0 4px 24px rgba(0,0,0,.5)',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'slide-in': 'slideIn .28s ease',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        slideIn: {
          from: { transform: 'translateX(110%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [forms],
}

export default config
