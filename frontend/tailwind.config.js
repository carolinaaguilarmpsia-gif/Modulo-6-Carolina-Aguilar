/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        institucional: {
          700: '#1e3a5f',
          800: '#152a45',
          600: '#2d5a87',
        },
      },
    },
  },
  plugins: [],
};
