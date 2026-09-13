/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/streamdown/**/*.{js,ts,jsx,tsx}',
    './node_modules/@streamdown/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        // Compact Apple ink scale (light values, dark remapped in globals.css)
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
      },
      fontSize: {
        // Compact Apple type scale: 12 / 13 / 14 / 24
        caption: ['var(--fs-caption)', { lineHeight: '1.5' }],
        body: ['var(--fs-body)', { lineHeight: '1.5' }],
        emphasis: ['var(--fs-emphasis)', { lineHeight: '1.5' }],
        title: ['var(--fs-title)', { lineHeight: '1.3' }],
      },
      borderRadius: {
        // Compact Apple radius scale: 8 / 16 / capsule
        nav: 'var(--radius-nav)',
        card: 'var(--radius-card)',
        cta: 'var(--radius-cta)',
      },
      spacing: {
        'icon-nav': 'var(--icon-nav)',
        'icon-card': 'var(--icon-card)',
      },
    },
  },
  plugins: [],
}
