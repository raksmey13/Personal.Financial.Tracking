/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 🟢 Enables class-based dark mode toggle (document.documentElement.classList.add('dark'))
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}