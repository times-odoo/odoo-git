import React, { useEffect } from 'react';
import { useUIStore } from '../../store/ui';
import { THEME_TEMPLATES } from '../../utils/themes';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeIndex = useUIStore((s) => s.themeIndex);
  const customThemeColor = useUIStore((s) => s.customThemeColor);
  const appBackgroundImage = useUIStore((s) => s.appBackgroundImage);
  const appBackgroundOpacity = useUIStore((s) => s.appBackgroundOpacity);

  useEffect(() => {
    const isCustom = themeIndex === -1;
    const theme = THEME_TEMPLATES[isCustom ? 0 : themeIndex] || THEME_TEMPLATES[0];
    const root = document.documentElement;
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-muted', theme.muted);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-accent', isCustom ? customThemeColor : theme.accent);
    root.style.setProperty('--color-accent-hover', isCustom ? customThemeColor : theme.accentHover);
  }, [themeIndex, customThemeColor]);

  return (
    <>
      {appBackgroundImage && (
        <div
          style={{
            backgroundImage: `url(${appBackgroundImage.replace(/\\/g, '/')})`,
            opacity: appBackgroundOpacity / 100,
          }}
          className="fixed inset-0 z-[9999] pointer-events-none bg-cover bg-center bg-no-repeat"
        />
      )}
      {children}
    </>
  );
};
