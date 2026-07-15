function withOpacity(variableName: string) {
  return ({ opacityValue }: { opacityValue?: number }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: withOpacity('--color-bg'),
        surface: withOpacity('--color-surface'),
        border: withOpacity('--color-border'),
        muted: withOpacity('--color-muted'),
        primary: withOpacity('--color-primary'),
        accent: withOpacity('--color-accent'),
        'accent-hover': withOpacity('--color-accent-hover'),
        success: '#238636',
        warning: '#D29922',
        danger: '#DA3633',
        'diff-add-bg': '#0D1F0D',
        'diff-remove-bg': '#1F0D0D',
        'diff-add-text': '#3FB950',
        'diff-remove-text': '#F85149',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'ui': ['13px', { lineHeight: '20px' }],
        'section': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
        'code': ['12px', { lineHeight: '18px' }],
        'branch': ['13px', { lineHeight: '20px' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
      },
    },
  },
  plugins: [],
};
