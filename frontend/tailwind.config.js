/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"avenue-mono-regular"', '"Space Mono"', '"Courier Prime"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
