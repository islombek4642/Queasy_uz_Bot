// src/i18n/index.js
import React, { createContext, useState, useEffect } from 'react';
import uz from './locales/uz.js';
import ru from './locales/ru.js';
import en from './locales/en.js';
import { APP_CONFIG } from '../constants/config.js';

export const translations = { UZ: uz, RU: ru, EN: en };

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('queasy_lang');
      if (saved && translations[saved]) return saved;

      const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      if (tgLang) {
        const upper = tgLang.toUpperCase();
        if (upper.includes('RU')) return 'RU';
        if (upper.includes('EN')) return 'EN';
      }
      return APP_CONFIG.DEFAULT_LANG;
    } catch {
      return APP_CONFIG.DEFAULT_LANG;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('queasy_lang', lang);
    } catch {}
  }, [lang]);

  const t = (key, params = {}) => {
    const catalog = translations[lang] || translations.UZ;
    let text = catalog[key] || translations.UZ[key] || key;

    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, supportedLangs: APP_CONFIG.SUPPORTED_LANGS }}>
      {children}
    </LanguageContext.Provider>
  );
}
