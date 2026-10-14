// src/views/TournamentView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchTournamentDetails } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { APP_CONFIG } from '../constants/config.js';

export function TournamentView({ shareCode, onStartTournament, onBack }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchTournamentDetails(shareCode)
      .then((res) => {
        if (res && res.success) {
          setData(res);
        } else {
          setError(res?.error || 'TOURNAMENT_NOT_FOUND');
        }
      })
      .catch((err) => {
        console.error('Failed to load tournament:', err);
        setError('NETWORK_ERROR');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [shareCode]);

  const handleShareToTelegram = () => {
    haptic.impact('medium');
    const quizTitle = data?.quiz?.title || t('DEFAULT_QUIZ_FALLBACK');
    const qCount = data?.quiz?.questionCount || 0;
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=${shareCode}`;
    const text = t('TOURNAMENT_INVITE_TEXT', { title: quizTitle, count: qCount });
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    haptic.selection();
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=${shareCode}`;
    navigator.clipboard?.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }} className="animate-fade-in">
        <Icon icon="solar:restart-bold" width="36" height="36" className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('LOADING') || 'Yuklanmoqda...'}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }} className="animate-fade-in">
        <Card style={{ padding: '28px 20px' }}>
          <Icon icon="solar:danger-triangle-bold" width="48" height="48" style={{ color: 'var(--color-error)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '8px' }}>
            {t('TOURNAMENT_NOT_FOUND_TITLE')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            {t('TOURNAMENT_NOT_FOUND_DESC')}
          </p>
          <Button variant="primary" fullWidth onClick={onBack}>
            {t('BTN_BACK_HOME') || 'Bosh sahifaga qaytish'}
          </Button>
        </Card>
      </div>
    );
  }

  const { tournament, quiz, leaderboard, userParticipation } = data;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            haptic.selection();
            onBack();
          }}
          className="glass-pill"
          style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon icon="solar:arrow-left-bold" width="16" height="16" />
          <span>{t('BTN_BACK') || 'Orqaga'}</span>
        </button>

        <Badge variant="accent" size="sm">
          <Icon icon="solar:cup-star-bold" width="14" height="14" style={{ marginRight: '4px' }} />
          {t('TOURNAMENT_TITLE')}
        </Badge>
      </div>

      {/* Tournament Card */}
      <Card glow style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('TOURNAMENT_TITLE')}
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: '1.35', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {quiz.title}
          </h2>
          {quiz.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '4px', lineHeight: '1.4', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {quiz.description}
            </p>
          )}
        </div>

        {/* Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Badge variant="primary" size="sm">
            <Icon icon="solar:question-circle-bold" width="14" height="14" style={{ marginRight: '4px' }} />
            {quiz.questionCount} {t('QUESTIONS_COUNT')}
          </Badge>
          <Badge variant="warning" size="sm">
            <Icon icon="solar:clock-circle-bold" width="14" height="14" style={{ marginRight: '4px' }} />
            {quiz.timeLimit}s
          </Badge>
          <Badge variant="glass" size="sm">
            <Icon icon="solar:users-group-two-rounded-bold" width="14" height="14" style={{ marginRight: '4px' }} />
            {leaderboard.length} {t('PARTICIPANTS')}
          </Badge>
        </div>

        {/* User Existing Participation Status */}
        {userParticipation && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid var(--surface-border-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{t('TOURNAMENT_YOUR_RANK')}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--accent-primary)' }}>
                #{userParticipation.rank}{' '}
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  ({userParticipation.score}/{quiz.questionCount})
                </span>
              </div>
            </div>
            <Badge variant="success" size="sm">
              <Icon icon="solar:check-circle-bold" width="14" height="14" style={{ marginRight: '4px' }} />
              {t('TOURNAMENT_SUBMITTED')}
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            icon="solar:play-circle-bold"
            onClick={() => {
              haptic.impact('heavy');
              onStartTournament(quiz.id, shareCode);
            }}
          >
            {userParticipation ? t('BTN_RETRY') : t('BTN_JOIN_TOURNAMENT')}
          </Button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              variant="secondary"
              fullWidth
              size="md"
              icon="solar:share-bold"
              onClick={handleShareToTelegram}
            >
              {t('BTN_SHARE_TO_GROUP')}
            </Button>
            <Button
              variant="glass"
              fullWidth
              size="sm"
              icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'}
              onClick={handleCopyLink}
            >
              {copied ? t('TOAST_LINK_COPIED') : t('LIVE_ROOM_COPY_LINK')}
            </Button>
          </div>
        </div>
      </Card>


      {/* Leaderboard Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon icon="solar:cup-star-bold" width="18" height="18" style={{ color: '#f59e0b' }} />
            {t('TOURNAMENT_LEADERBOARD_TITLE')} ({leaderboard.length})
          </h3>
          <button
            onClick={() => {
              haptic.selection();
              loadData();
            }}
            className="glass-pill"
            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Icon icon="solar:restart-bold" width="14" height="14" />
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <Card style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Icon icon="solar:cup-bold" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('TOURNAMENT_NO_PARTICIPANTS')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((p) => {
              const rankMedal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`;
              return (
                <Card
                  key={p.id}
                  glow={p.isCurrentUser}
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: p.isCurrentUser ? '1px solid var(--accent-glow)' : '1px solid var(--surface-border)',
                    background: p.isCurrentUser ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '28px', textAlign: 'center', fontSize: p.rank <= 3 ? '1.2rem' : '0.9rem', fontWeight: '800', flexShrink: 0 }}>
                      {rankMedal}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: '700',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: p.isCurrentUser ? 'var(--accent-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {p.userName} {p.isCurrentUser && '(Siz)'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.totalTimeSeconds} soniya
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '1rem', fontWeight: '900', color: '#10b981' }}>
                      {p.score}/{quiz.questionCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      to'g'ri
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
