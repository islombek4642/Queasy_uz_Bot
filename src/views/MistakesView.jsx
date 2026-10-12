// src/views/MistakesView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchUserMistakes } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';

export function MistakesView({ onBack, onStartMistakesPractice }) {
  const { t } = useTranslation();
  const { haptic, backButton } = useTelegram();

  const [data, setData] = useState({ mistakes: [], count: 0, grouped: [] });
  const [loading, setLoading] = useState(true);
  const [expandedGroupIndex, setExpandedGroupIndex] = useState(null);

  const loadMistakes = () => {
    setLoading(true);
    fetchUserMistakes()
      .then((res) => {
        if (res) {
          setData(res);
        }
      })
      .catch((err) => {
        console.error('Failed to load user mistakes:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMistakes();
  }, []);

  // Telegram native BackButton integration
  useEffect(() => {
    const handleTgBack = () => {
      haptic.selection();
      if (onBack) onBack();
    };

    backButton.show(handleTgBack);
    return () => {
      backButton.hide(handleTgBack);
    };
  }, [backButton, haptic, onBack]);

  const handleStartAll = () => {
    haptic.impact('medium');
    if (onStartMistakesPractice && data.mistakes?.length > 0) {
      onStartMistakesPractice(
        data.mistakes,
        `${t('MISTAKES_PRACTICE_TITLE')} (${t('MISTAKES_TAG_ALL')})`
      );
    }
  };

  const handleStartGroup = (group) => {
    haptic.impact('medium');
    if (onStartMistakesPractice && group.mistakes?.length > 0) {
      onStartMistakesPractice(
        group.mistakes,
        `${group.title} (${t('MISTAKES_TAG_SUBJECT')})`
      );
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '560px',
        margin: '0 auto',
        width: '100%',
      }}
      className="animate-fade-in"
    >
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            haptic.selection();
            onBack();
          }}
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--surface-border)',
            borderRadius: '12px',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Icon icon="solar:arrow-left-linear" width="18" height="18" />
          <span>{t('BTN_BACK')}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant="danger" size="md">
            {t('STAT_MISTAKES_COUNT', { count: data.count })}
          </Badge>
        </div>
      </div>

      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(244, 63, 94, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger, #ef4444)',
            }}
          >
            <Icon icon="solar:history-bold" width="24" height="24" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {t('MISTAKES_PRACTICE_TITLE')}
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('MISTAKES_SUBTITLE')}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : data.count === 0 ? (
        /* Empty State: All mistakes resolved */
        <Card
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success, #22c55e)',
            }}
          >
            <Icon icon="solar:check-circle-bold" width="40" height="40" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {t('MISTAKES_EMPTY_TITLE')}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto' }}>
              {t('MISTAKES_EMPTY_DESC')}
            </p>
          </div>
          <Button variant="primary" size="md" onClick={onBack} style={{ marginTop: '8px' }}>
            {t('BTN_BACK_HOME')}
          </Button>
        </Card>
      ) : (
        /* Content with Subjects List */
        <>
          {/* Quick Play Card: Mixed Mode */}
          <Card
            glow
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)',
              borderColor: 'rgba(99, 102, 241, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Icon icon="solar:bolt-bold" width="26" height="26" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {t('MISTAKES_ALL_TITLE')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {t('MISTAKES_ALL_DESC', { count: data.count })}
                  </p>
                </div>
              </div>
              <Badge variant="primary" size="md">
                {data.count}
              </Badge>
            </div>

            <Button variant="primary" size="md" fullWidth onClick={handleStartAll}>
              <Icon icon="solar:play-bold" width="18" height="18" />
              <span>{t('MISTAKES_START_ALL')}</span>
            </Button>
          </Card>

          {/* Section: By Subjects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {t('MISTAKES_BY_SUBJECTS', { count: data.grouped?.length || 0 })}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {t('MISTAKES_CHOOSE_SUBJECT_DESC')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.grouped?.map((group, idx) => {
                const isExpanded = expandedGroupIndex === idx;
                return (
                  <Card
                    key={group.quizId || idx}
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header area - click anywhere to expand/collapse */}
                    <div
                      onClick={() => {
                        haptic.selection();
                        setExpandedGroupIndex(isExpanded ? null : idx);
                      }}
                      style={{
                        minWidth: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: '800',
                          fontSize: '0.96rem',
                          color: 'var(--text-primary)',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'clip' : 'ellipsis',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          lineHeight: '1.35',
                        }}
                        title={group.title}
                      >
                        {group.title}
                      </div>

                      {group.category && (
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                            whiteSpace: isExpanded ? 'normal' : 'nowrap',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            textOverflow: isExpanded ? 'clip' : 'ellipsis',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          📍 {group.category}
                        </div>
                      )}
                    </div>

                    {/* Badges */}
                    <div
                      onClick={() => {
                        haptic.selection();
                        setExpandedGroupIndex(isExpanded ? null : idx);
                      }}
                      style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Badge variant="danger" size="sm">
                        {t('STAT_MISTAKES_COUNT', { count: group.count })}
                      </Badge>
                    </div>

                    {/* Action Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--surface-border)',
                        marginTop: '2px',
                        gap: '8px',
                      }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStartGroup(group)}
                        icon="solar:play-bold"
                        style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                      >
                        {t('BTN_PRACTICE')}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default MistakesView;
