import typography from '@tailwindcss/typography';
import daisyui from 'daisyui';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['src/renderer/**/*.{html,tsx,ts}'],
  darkMode: 'class',
  theme: {
    extend: {}
  },
  plugins: [typography, daisyui],
  daisyui: {
    themes: ['dark'],
    darkTheme: 'dark'
  }
};

export default config;
