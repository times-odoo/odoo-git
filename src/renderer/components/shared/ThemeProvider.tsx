import React, { useEffect } from 'react';
import { useUIStore } from '../../store/ui';
import { THEME_TEMPLATES } from '../../utils/themes';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeIndex = useUIStore((s) => s.themeIndex);

  useEffect(() => {
    const theme = THEME_TEMPLATES[themeIndex] || THEME_TEMPLATES[0];
    const root = document.documentElement;
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-muted', theme.muted);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-accent-hover', theme.accentHover);
  }, [themeIndex]);

  return <>{children}</>;
};
