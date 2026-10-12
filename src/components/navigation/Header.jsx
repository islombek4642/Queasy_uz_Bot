// src/components/navigation/Header.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { Avatar } from '../common/Avatar.jsx';
import { useTelegram } from '../../hooks/useTelegram.js';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTheme } from '../../hooks/useTheme.js';
import { THEME_DARK, THEME_LIGHT, THEME_AUTO } from '../../constants/theme.js';

export function Header({ userStats }) {
  const { user, haptic } = useTelegram();
  const { t, lang, setLang } = useTranslation();
  const { theme, toggleTheme, isDark } = useTheme();

  const cycleLang = () => {
    haptic.selection();
    if (lang === 'UZ') setLang('RU');
    else if (lang === 'RU') setLang('EN');
    else setLang('UZ');
  };

  const getThemeIcon = () => {
    if (theme === THEME_AUTO) return 'solar:magic-stick-3-bold-duotone';
    return isDark ? 'solar:moon-bold-duotone' : 'solar:sun-2-bold-duotone';
  };

  return (
    <header
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--surface-border)',
        boxShadow: '0 2px 15px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Left: User profile brief */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Avatar user={user} size={38} showRing={true} />
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            {user?.first_name || t('APP_TITLE')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{t('LEVEL')} {userStats?.level || 1}</span>
            <span>•</span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{userStats?.xp || 0} {t('XP')}</span>
          </div>
        </div>
      </div>

      {/* Right: Quick toggles (Language & Theme) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Language Switcher */}
        <button
          onClick={cycleLang}
          className="glass-pill glass-panel-interactive"
          style={{
            padding: '6px 11px',
            fontWeight: '700',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid var(--surface-border)',
          }}
          title={t('SETTINGS_LANG')}
        >
          <Icon icon="solar:translation-2-bold-duotone" width="18" height="18" style={{ color: 'var(--accent-primary)' }} />
          <span>{lang}</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={() => {
            haptic.selection();
            toggleTheme();
          }}
          className="glass-pill glass-panel-interactive"
          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          title={t('SETTINGS_THEME')}
        >
          <Icon icon={getThemeIcon()} width="16" height="16" style={{ color: 'var(--accent-primary)' }} />
          <span>{theme === THEME_AUTO ? t('THEME_AUTO') : isDark ? t('THEME_DARK') : t('THEME_LIGHT')}</span>
        </button>
      </div>
    </header>
  );
}
