// src/views/ProfileView.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useTheme } from '../hooks/useTheme.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Avatar } from '../components/common/Avatar.jsx';
import { AchievementGrid } from '../components/profile/AchievementGrid.jsx';
import { calculateLevelProgress } from '../utils/gamification.js';
import { THEME_DARK, THEME_LIGHT, THEME_AUTO } from '../constants/theme.js';

export function ProfileView({ initialData }) {
  const { t, lang, setLang, supportedLangs } = useTranslation();
  const { user, haptic } = useTelegram();
  const { theme, setTheme } = useTheme();

  const stats = initialData?.stats || { totalSolved: 0, accuracy: 0, globalRank: '-' };
  const userXp = initialData?.user?.xp || 0;
  const progress = calculateLevelProgress(userXp);

  const langDetails = {
    UZ: { label: "O'zbek", icon: 'circle-flags:uz' },
    RU: { label: 'Русский', icon: 'circle-flags:ru' },
    EN: { label: 'English', icon: 'circle-flags:gb' },
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('NAV_PROFILE')}</h2>

      {/* User & Level Progression Card */}
      <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Avatar user={user} size={64} showRing={true} level={progress.level} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '800', fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.first_name || 'Foydalanuvchi'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{user?.username || 'user'}</div>
            <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Badge variant="primary" size="sm">{t('LEVEL')} {progress.level}</Badge>
              <Badge variant="success" size="sm">{userXp} {t('XP')}</Badge>
              <Badge size="sm" style={{ backgroundColor: `${progress.rankColor}22`, color: progress.rankColor, border: `1px solid ${progress.rankColor}44` }}>
                {t(progress.rankKey)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            <span>{t('XP_PROGRESS_LABEL')}</span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {progress.currentLevelXp} / {progress.nextLevelXp} XP ({progress.percentage}%)
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--surface-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress.percentage}%`,
                height: '100%',
                background: 'var(--accent-gradient)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Performance Overview Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <Card style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-primary)' }}>
            {stats.totalSolved}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t('STATS_TOTAL_SOLVED')}
          </div>
        </Card>

        <Card style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-success)' }}>
            {stats.accuracy}%
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t('STATS_ACCURACY')}
          </div>
        </Card>

        <Card style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-warning)' }}>
            #{stats.globalRank}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t('NAV_LEADERBOARD')}
          </div>
        </Card>
      </div>

      {/* Achievements & Badges Card */}
      <Card style={{ padding: '16px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:cup-star-bold-duotone" width="22" height="22" style={{ color: 'var(--color-warning)' }} />
          <span>{t('ACHIEVEMENTS_TITLE')}</span>
        </div>
        <AchievementGrid
          stats={stats}
          user={initialData?.user}
          myQuizzes={initialData?.myQuizzes}
        />
      </Card>

      {/* Settings Card: Language */}
      <Card style={{ padding: '16px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:translation-2-bold-duotone" width="22" height="22" style={{ color: 'var(--accent-primary)' }} />
          <span>{t('SETTINGS_LANG')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {supportedLangs.map((l) => {
            const isSelected = lang === l;
            const item = langDetails[l] || { label: l, icon: 'solar:translation-bold' };
            return (
              <button
                key={l}
                onClick={() => {
                  haptic.selection();
                  setLang(l);
                }}
                className="glass-panel-interactive"
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--surface-border)',
                  boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Icon icon={item.icon} width="24" height="24" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Settings Card: Theme */}
      <Card style={{ padding: '16px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:moon-bold-duotone" width="20" height="20" style={{ color: 'var(--accent-primary)' }} />
          <span>{t('SETTINGS_THEME')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            { id: THEME_AUTO, label: t('THEME_AUTO'), icon: 'solar:magic-stick-3-bold-duotone' },
            { id: THEME_DARK, label: t('THEME_DARK'), icon: 'solar:moon-bold-duotone' },
            { id: THEME_LIGHT, label: t('THEME_LIGHT'), icon: 'solar:sun-2-bold-duotone' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                haptic.selection();
                setTheme(item.id);
              }}
              style={{
                padding: '10px 4px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '700',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: theme === item.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: theme === item.id ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--surface-border)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon icon={item.icon} width="18" height="18" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
