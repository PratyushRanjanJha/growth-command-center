/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA', card: '#FFFFFF', line: '#E4E4E7', ink: '#18181B', mute: '#71717A', faint: '#F4F4F5',
        brand: { DEFAULT: '#1D4ED8', ink: '#0F172A', soft: '#EFF4FF' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'] },
      borderRadius: { md: '6px' },
    },
  },
  plugins: [],
};
