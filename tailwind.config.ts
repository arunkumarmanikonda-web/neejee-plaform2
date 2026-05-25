import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NEEJEE Brand Palette
        kohl: '#1A1613',
        ivory: '#F4EFE6',
        madder: '#8B2E2A',
        mitti: '#6B4423',
        banarasi: '#A47E3B',
        ajrakh: '#1F3A5F',
        haldi: '#D4A02A',
        phulkari: '#C44569',
        neem: '#5A6F3F',
        sandalwood: '#C9A87C',
        beige: '#E8DFCF',
        monsoon: '#6B6862',
        stoneware: '#9C8B7A',
      },
      fontFamily: {
        display: ['Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Cormorant Garamond', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        italic: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      letterSpacing: {
        widest: '0.25em',
        brand: '0.4em',
      },
      maxWidth: {
        '8xl': '1440px',
        prose: '72ch',
      },
    },
  },
  plugins: [],
};
export default config;
