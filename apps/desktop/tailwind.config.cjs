/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['src/renderer/**/*.{html,tsx,ts}'],
  darkMode: 'class',
  theme: {
    extend: {}
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
  daisyui: {
    themes: [
      {
        dark: {
          ...require('daisyui/src/theming/themes')['dark']
        }
      }
    ],
    darkTheme: 'dark'
  }
};
