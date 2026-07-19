/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ground: 'rgb(var(--ground) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        line2: 'rgb(var(--line2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        dim: 'rgb(var(--dim) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        fire: 'rgb(var(--fire) / <alpha-value>)',
        water: 'rgb(var(--water) / <alpha-value>)',
        wood: 'rgb(var(--wood) / <alpha-value>)',
        light: 'rgb(var(--light) / <alpha-value>)',
        yami: 'rgb(var(--yami) / <alpha-value>)',
        limited: 'rgb(var(--limited) / <alpha-value>)',
        collab: 'rgb(var(--collab) / <alpha-value>)',
        alpha: 'rgb(var(--alpha) / <alpha-value>)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in .5s ease both',
      },
    },
  },
  plugins: [],
}
