/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ff: {
          blau:        '#7291a0',
          'blau-hell': '#d0dde3',
          'blau-mid':  '#a8bec9',
          dunkel:      '#454451',
          'dunkel-mid':'#8a8897',
          orange:      '#d88d5b',
          'orange-hell':'#f2d9c5',
          senfgelb:    '#ccb854',
          'gelb-hell': '#ede9cc',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
