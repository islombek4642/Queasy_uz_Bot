// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { THEME_DARK, THEME_LIGHT, THEME_AUTO } from '../constants/theme.js';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('queasy_theme') || THEME_AUTO;
    } catch {
      return THEME_AUTO;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(THEME_DARK);

  useEffect(() => {
    const updateTheme = () => {
      let active = THEME_DARK;

      if (theme === THEME_AUTO) {
        const tgScheme = window.Telegram?.WebApp?.colorScheme;
        if (tgScheme) {
          active = tgScheme === 'light' ? THEME_LIGHT : THEME_DARK;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          active = THEME_LIGHT;
        } else {
          active = THEME_DARK;
        }
      } else {
        active = theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
      }

      setResolvedTheme(active);
      document.documentElement.setAttribute('data-theme', active);
    };

    updateTheme();

    try {
      localStorage.setItem('queasy_theme', theme);
    } catch {}

    // Listen to Telegram theme change
    if (window.Telegram?.WebApp?.onEvent) {
      window.Telegram.WebApp.onEvent('themeChanged', updateTheme);
      return () => {
        window.Telegram.WebApp.offEvent('themeChanged', updateTheme);
      };
    }
  }, [theme]);

  const toggleTheme = () => {
    if (theme === THEME_DARK) setTheme(THEME_LIGHT);
    else if (theme === THEME_LIGHT) setTheme(THEME_AUTO);
    else setTheme(THEME_DARK);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        isDark: resolvedTheme === THEME_DARK,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
