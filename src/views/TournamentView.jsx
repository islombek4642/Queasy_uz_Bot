// src/views/TournamentView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchTournamentDetails } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { QuizModeModal } from '../components/quiz/QuizModeModal.jsx';
import { APP_CONFIG } from '../constants/config.js';

export function TournamentView({ shareCode, onStartTournament, onBack }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);

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

  const handleConfirmMode = (modeConfig) => {
    setShowModeModal(false);
    haptic.impact('heavy');
    if (quiz) {
      onStartTournament(quiz.id, shareCode, modeConfig);
    }
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
        <Spinner size={36} style={{ margin: '0 auto 12px' }} />
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
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="animate-fade-in">
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            haptic.selection();
            onBack();
          }}
          className="glass-pill"
          style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <Icon icon="solar:arrow-left-bold" width="14" height="14" />
          <span>{t('BTN_BACK') || 'Orqaga'}</span>
        </button>

        <Badge variant="accent" size="sm">
          <Icon icon="solar:cup-star-bold" width="13" height="13" style={{ marginRight: '4px' }} />
          {t('TOURNAMENT_TITLE')}
        </Badge>
      </div>

      {/* Tournament Card */}
      <Card glow style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {t('TOURNAMENT_TITLE')}
            </span>
          </div>
          <h2 style={{ fontSize: '1.08rem', fontWeight: '800', lineHeight: '1.3', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {quiz.title}
          </h2>
          {quiz.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px', lineHeight: '1.3', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {quiz.description}
            </p>
          )}
        </div>

        {/* Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Badge variant="primary" size="sm">
            <Icon icon="solar:question-circle-bold" width="13" height="13" style={{ marginRight: '3px' }} />
            {quiz.questionCount} {t('QUESTIONS_COUNT')}
          </Badge>
          <Badge variant="warning" size="sm">
            <Icon icon="solar:clock-circle-bold" width="13" height="13" style={{ marginRight: '3px' }} />
            {quiz.timeLimit}s
          </Badge>
          <Badge variant="glass" size="sm">
            <Icon icon="solar:users-group-two-rounded-bold" width="13" height="13" style={{ marginRight: '3px' }} />
            {leaderboard.length} {t('PARTICIPANTS')}
          </Badge>
        </div>

        {/* User Existing Participation Status */}
        {userParticipation && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid var(--surface-border-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('TOURNAMENT_YOUR_RANK')}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--accent-primary)' }}>
                #{userParticipation.rank}{' '}
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  ({userParticipation.score}/{quiz.questionCount})
                </span>
              </div>
            </div>
            <Badge variant="success" size="sm">
              <Icon icon="solar:check-circle-bold" width="13" height="13" style={{ marginRight: '3px' }} />
              {t('TOURNAMENT_SUBMITTED')}
            </Badge>
          </div>
        )}

        {/* Action Buttons: Full-width vertical stack ensures comfortable fit on all mobile screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <Button
            variant="primary"
            fullWidth
            size="md"
            icon="solar:play-circle-bold"
            style={{ height: '44px', fontSize: '0.94rem', fontWeight: '800' }}
            onClick={() => {
              haptic.impact('medium');
              setShowModeModal(true);
            }}
          >
            {userParticipation ? t('BTN_RETRY') : t('BTN_JOIN_TOURNAMENT')}
          </Button>

          <Button
            variant="secondary"
            fullWidth
            size="md"
            icon="solar:share-bold"
            style={{ height: '40px', fontSize: '0.88rem' }}
            onClick={handleShareToTelegram}
          >
            {t('BTN_SHARE_TO_GROUP')}
          </Button>

          <Button
            variant="glass"
            fullWidth
            size="md"
            icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'}
            style={{ height: '38px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            onClick={handleCopyLink}
          >
            {copied ? t('TOAST_LINK_COPIED') : (t('BTN_COPY_LINK') || 'Havolani nusxalash')}
          </Button>
        </div>
      </Card>


      {/* Leaderboard Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon icon="solar:cup-star-bold" width="16" height="16" style={{ color: '#f59e0b' }} />
            {t('TOURNAMENT_LEADERBOARD_TITLE')} ({leaderboard.length})
          </h3>
          <button
            onClick={() => {
              haptic.selection();
              loadData();
            }}
            className="glass-pill"
            style={{ padding: '3px 7px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <Icon icon="solar:restart-bold" width="13" height="13" />
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <Card style={{ padding: '18px 12px', textAlign: 'center' }}>
            <Icon icon="solar:cup-bold" width="30" height="30" style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {t('TOURNAMENT_NO_PARTICIPANTS')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {leaderboard.map((p) => {
              const rankMedal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`;
              return (
                <Card
                  key={p.id}
                  glow={p.isCurrentUser}
                  style={{
                    padding: '7px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: p.isCurrentUser ? '1px solid var(--accent-glow)' : '1px solid var(--surface-border)',
                    background: p.isCurrentUser ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '24px', textAlign: 'center', fontSize: p.rank <= 3 ? '1.05rem' : '0.82rem', fontWeight: '800', flexShrink: 0 }}>
                      {rankMedal}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: '700',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: p.isCurrentUser ? 'var(--accent-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {p.userName} {p.isCurrentUser && '(Siz)'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.totalTimeSeconds} soniya
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#10b981' }}>
                      {p.score}/{quiz.questionCount}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                      to'g'ri
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quiz Mode Selector Modal for Tournament Participant */}
      <QuizModeModal
        isOpen={showModeModal}
        quizId={quiz?.id}
        onClose={() => setShowModeModal(false)}
        onConfirmMode={handleConfirmMode}
      />
    </div>
  );
}
