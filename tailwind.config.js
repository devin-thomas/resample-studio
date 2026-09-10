/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#111622',
          800: '#171e2e',
          700: '#232d42',
          accent: '#00f0ff',
          neonOrange: '#ff6b00',
          neonAmber: '#ffaa00',
          neonPurple: '#a855f7'
        }
      },
      fontFamily: {
        mono: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
