const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** Every value comes from src/styles/tokens.css. Spacing keeps Tailwind's standard 4px scale (extended, never replaced). */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), border: c('border'),
      text: c('text'), muted: c('text-muted'), faint: c('text-faint'),
      primary: c('primary'), 'primary-soft': c('primary-soft'), 'on-primary': c('on-primary'),
      secondary: c('secondary'), 'secondary-soft': c('secondary-soft'), 'on-secondary': c('on-secondary'),
      high: c('high'), 'high-soft': c('high-soft'), medium: c('medium'), 'medium-soft': c('medium-soft'),
      low: c('low'), 'low-soft': c('low-soft'), overdue: c('overdue'), focus: c('focus'),
    },
    fontFamily: { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' },
    fontSize: {
      display: ['var(--fs-display)', { lineHeight: 'var(--lh-display)', fontWeight: '800', letterSpacing: '-0.03em' }],
      title: ['var(--fs-title)', { lineHeight: 'var(--lh-title)', fontWeight: '800', letterSpacing: '-0.025em' }],
      heading: ['var(--fs-heading)', { lineHeight: 'var(--lh-heading)', fontWeight: '700', letterSpacing: '-0.01em' }],
      body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)', fontWeight: '400' }],
      meta: ['var(--fs-meta)', { lineHeight: 'var(--lh-meta)', fontWeight: '500' }],
      label: ['var(--fs-label)', { lineHeight: 'var(--lh-label)', fontWeight: '800', letterSpacing: '0.1em' }],
      stat: ['var(--fs-stat)', { lineHeight: 'var(--lh-stat)', fontWeight: '800', letterSpacing: '-0.03em' }],
      mono: ['var(--fs-mono)', { lineHeight: 'var(--lh-mono)', fontWeight: '400' }],
    },
    borderRadius: { none: '0', card: 'var(--r-card)', tile: 'var(--r-tile)', control: 'var(--r-control)', full: '9999px' },
    boxShadow: { float: 'var(--shadow-float)', mark: 'var(--shadow-mark)', none: 'none' },
    extend: {
      spacing: { touch: 'var(--touch)', sidebar: 'var(--sidebar-w)', 'page-x': 'var(--page-x)' },
      maxWidth: { shell: '1200px' },
    },
  },
  plugins: [],
};
