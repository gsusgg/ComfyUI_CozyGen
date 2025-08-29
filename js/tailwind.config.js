/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'base-100': '#1a202c', // Very Dark Grey (almost black)
        'base-200': '#2d3748', // Dark Grey
        'base-300': '#4a5568', // Medium Grey
        'accent': '#008080',   // Teal/Dark Green
        'accent-focus': '#006666',
      }
    },
  },
  plugins: [],
}