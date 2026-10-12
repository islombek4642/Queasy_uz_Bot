// src/components/navigation/BottomNav.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { useTelegram } from '../../hooks/useTelegram.js';
import { useTranslation } from '../../hooks/useTranslation.js';
import {
  NAV_HOME,
  NAV_MY_QUIZZES,
  NAV_GROUP_HOST,
  NAV_LEADERBOARD,
  NAV_PROFILE,
} from '../../constants/routes.js';

export function BottomNav({ activeTab, onSelectTab }) {
  const { haptic } = useTelegram();
  const { t } = useTranslation();

  const tabs = [
    { id: NAV_HOME, label: t('NAV_HOME'), icon: 'solar:home-2-bold-duotone' },
    { id: NAV_MY_QUIZZES, label: t('NAV_MY_QUIZZES'), icon: 'solar:folder-with-files-bold-duotone' },
    { id: NAV_GROUP_HOST, label: t('NAV_GROUP_HOST'), icon: 'solar:users-group-rounded-bold-duotone' },
    { id: NAV_LEADERBOARD, label: t('NAV_LEADERBOARD'), icon: 'solar:cup-star-bold-duotone' },
    { id: NAV_PROFILE, label: t('NAV_PROFILE'), icon: 'solar:user-circle-bold-duotone' },
  ];

  const handleTabClick = (tabId) => {
    if (tabId === activeTab) return;
    haptic.selection();
    onSelectTab(tabId);
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '580px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 4px calc(8px + var(--safe-bottom))',
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--surface-border)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 2px',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                transition: 'all var(--transition-fast)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <Icon icon={tab.icon} width="22" height="22" />
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: isActive ? '700' : '500',
                letterSpacing: '-0.2px',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
