// src/components/profile/AchievementGrid.jsx
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { ACHIEVEMENTS } from '../../constants/achievements.js';
import { Modal } from '../common/Modal.jsx';

export function AchievementGrid({ stats, user, myQuizzes }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [selectedAch, setSelectedAch] = useState(null);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}
      >
        {ACHIEVEMENTS.map((ach) => {
          const isUnlocked = ach.checkUnlocked(stats, user, myQuizzes);
          return (
            <button
              key={ach.id}
              onClick={() => {
                haptic.selection();
                setSelectedAch({ ...ach, isUnlocked });
              }}
              className="glass-panel-interactive"
              style={{
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '8px',
                position: 'relative',
                background: isUnlocked
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)'
                  : 'var(--bg-secondary)',
                border: isUnlocked
                  ? '1px solid rgba(168, 85, 247, 0.4)'
                  : '1px solid var(--surface-border)',
                opacity: isUnlocked ? 1 : 0.65,
                transition: 'all var(--transition-fast)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isUnlocked ? ach.color : 'rgba(255, 255, 255, 0.05)',
                  color: isUnlocked ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: isUnlocked ? `0 0 16px ${ach.color}66` : 'none',
                }}
              >
                <Icon
                  icon={isUnlocked ? ach.icon : 'solar:lock-keyhole-bold'}
                  width="22"
                  height="22"
                />
              </div>

              <div
                style={{
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  color: isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)',
                  lineHeight: '1.2',
                }}
              >
                {t(ach.titleKey)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Achievement Detail Modal */}
      <Modal
        isOpen={Boolean(selectedAch)}
        onClose={() => setSelectedAch(null)}
        title={selectedAch ? t(selectedAch.titleKey) : ''}
        icon={selectedAch?.icon || 'solar:cup-star-bold'}
        confirmText="OK"
        onConfirm={() => setSelectedAch(null)}
      >
        {selectedAch && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedAch.isUnlocked ? selectedAch.color : 'rgba(255, 255, 255, 0.08)',
                color: selectedAch.isUnlocked ? '#ffffff' : 'var(--text-muted)',
                boxShadow: selectedAch.isUnlocked ? `0 0 24px ${selectedAch.color}88` : 'none',
              }}
            >
              <Icon
                icon={selectedAch.isUnlocked ? selectedAch.icon : 'solar:lock-keyhole-bold'}
                width="32"
                height="32"
              />
            </div>

            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: '700',
                marginBottom: '12px',
                backgroundColor: selectedAch.isUnlocked ? 'var(--color-success-bg)' : 'rgba(255, 255, 255, 0.08)',
                color: selectedAch.isUnlocked ? 'var(--color-success)' : 'var(--text-muted)',
              }}
            >
              {selectedAch.isUnlocked ? `✓ ${t('ACH_UNLOCKED')}` : `🔒 ${t('ACH_LOCKED')}`}
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t(selectedAch.descKey)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
