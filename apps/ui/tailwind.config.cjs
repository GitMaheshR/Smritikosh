const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** All values come from src/styles/tokens.css. Components use these names only. */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), border: c('border'),
      text: c('text'), muted: c('text-muted'),
      accent: c('accent'), 'accent-soft': c('accent-soft'), 'on-accent': c('on-accent'),
      overdue: c('overdue'), warning: c('warning'), success: c('success'),
      'm-tasks': c('m-tasks'), 'm-notes': c('m-notes'), 'm-lessons': c('m-lessons'), 'm-wishlists': c('m-wishlists'),
      'm-stocks': c('m-stocks'), 'm-goals': c('m-goals'), 'm-weekend': c('m-weekend'), 'm-vault': c('m-vault'),
    },
    fontFamily: {
      sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)',
    },
    fontSize: {
      display: ['var(--fs-display)', { lineHeight: 'var(--lh-display)', fontWeight: '700' }],
      title: ['var(--fs-title)', { lineHeight: 'var(--lh-title)', fontWeight: '600' }],
      heading: ['var(--fs-heading)', { lineHeight: 'var(--lh-heading)', fontWeight: '600' }],
      body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)', fontWeight: '400' }],
      meta: ['var(--fs-meta)', { lineHeight: 'var(--lh-meta)', fontWeight: '500' }],
      label: ['var(--fs-label)', { lineHeight: 'var(--lh-label)', fontWeight: '600', letterSpacing: '0.04em' }],
      mono: ['var(--fs-mono)', { lineHeight: 'var(--lh-mono)', fontWeight: '400' }],
    },
    borderRadius: { none: '0', card: 'var(--r-card)', control: 'var(--r-control)', full: '9999px' },
    spacing: {
      0: '0', 1: 'var(--s-1)', 2: 'var(--s-2)', 3: 'var(--s-3)', 4: 'var(--s-4)', 5: 'var(--s-5)', 6: 'var(--s-6)',
      7: 'var(--s-7)', 8: 'var(--s-8)', 9: 'var(--s-9)', 10: 'var(--s-10)', 12: 'var(--s-12)', 14: 'var(--s-14)',
      16: 'var(--s-16)', 24: 'var(--s-24)', touch: 'var(--touch)', sidebar: 'var(--sidebar-w)', 'sidebar-sm': 'var(--sidebar-w-sm)',
      content: 'var(--content-w)', 'page-x': 'var(--page-x)',
    },
    boxShadow: { float: 'var(--shadow-float)', none: 'none' },
    extend: {},
  },
  plugins: [],
};
