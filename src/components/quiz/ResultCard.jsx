// src/components/quiz/ResultCard.jsx
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { Card } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { APP_CONFIG } from '../../constants/config.js';

export function ResultCard({
  quizTitle,
  quizId,
  correctCount,
  wrongCount,
  totalTimeSeconds,
  tournamentResult = null,
  tournamentShareCode = null,
  liveRoomResult = null,
  liveRoomCode = null,
  inactivityStopped = false,
  onRetry,
  onBackHome,
}) {
  const { t } = useTranslation();
  const totalQuestions = correctCount + wrongCount;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isHighPerformance = accuracy >= 70;

  useEffect(() => {
    if (isHighPerformance) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  }, [isHighPerformance]);

  const handleShare = () => {
    let shareUrl;
    if (tournamentResult && tournamentShareCode) {
      const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=${tournamentShareCode}`;
      const text = encodeURIComponent(
        t('TOURNAMENT_SHARE_CAPTION', {
          title: quizTitle || 'Viktorina',
          score: correctCount,
          total: totalQuestions,
          rank: tournamentResult.rank || 1,
          link: shareLink,
        })
      );
      shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${text}`;
    } else {
      const text = encodeURIComponent(
        t('SHARE_QUIZ_CAPTION', { title: quizTitle, score: accuracy })
      );
      shareUrl = `https://t.me/share/url?url=https://t.me/${APP_CONFIG.BOT_USERNAME}?start=quiz_${quizId}&text=${text}`;
    }

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };


  return (
    <div
      className="animate-pop-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 14px',
        maxWidth: '440px',
        margin: '0 auto',
        width: '100%',
        minHeight: '100dvh',
        boxSizing: 'border-box',
        gap: '10px',
      }}
    >
      {/* Diploma Header */}
      <Card
        glow={isHighPerformance}
        style={{
          textAlign: 'center',
          padding: '16px 14px',
          background: isHighPerformance
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)'
            : 'var(--surface-card)',
        }}
      >
        {inactivityStopped && (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--color-error, #ef4444)',
              fontSize: '0.78rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '10px',
              lineHeight: 1.3,
            }}
          >
            <Icon icon="solar:clock-circle-bold" width="16" height="16" style={{ flexShrink: 0 }} />
            <span>{t('INACTIVITY_TIMEOUT_BANNER')}</span>
          </div>
        )}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            background: isHighPerformance ? 'var(--color-success)' : 'var(--accent-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Icon icon={isHighPerformance ? 'solar:cup-star-bold' : 'solar:medal-star-bold'} width="26" height="26" />
        </div>

        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '2px', lineHeight: 1.2 }}>
          {accuracy >= 80 ? t('RESULT_EXCELLENT') : accuracy >= 50 ? t('RESULT_GOOD') : t('RESULT_TRY_AGAIN')}
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            lineHeight: '1.3',
            margin: '2px 0 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={quizTitle}
        >
          {quizTitle}
        </p>

        {/* Accuracy Gauge */}
        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: '900',
              lineHeight: 1,
              color: isHighPerformance ? 'var(--color-success)' : 'var(--accent-primary)',
              fontFamily: 'var(--font-family-display)',
            }}
          >
            {accuracy}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
            {t('ACCURACY_LABEL')}
          </div>
        </div>

        {/* Detailed Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--surface-border)',
          }}
        >
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--color-success)' }}>
              {correctCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {t('CORRECT_COUNT')}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--color-error)' }}>
              {wrongCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {t('WRONG_COUNT')}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--accent-primary)' }}>
              {totalTimeSeconds}s
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {t('TIME_SPENT')}
            </div>
          </div>
        </div>

        {tournamentResult && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('TOURNAMENT_YOUR_RANK')}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--accent-primary)' }}>
                #{tournamentResult.rank} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ {tournamentResult.totalParticipants}</span>
              </div>
            </div>
            <div style={{ fontSize: '1.3rem' }}>
              {tournamentResult.rank === 1 ? '🥇' : tournamentResult.rank === 2 ? '🥈' : tournamentResult.rank === 3 ? '🥉' : '🎯'}
            </div>
          </div>
        )}

        {liveRoomResult && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('LIVE_ROOM_RANK_LABEL')}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--color-success)' }}>
                #{liveRoomResult.rank} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ {liveRoomResult.totalPlayers}</span>
              </div>
            </div>
            <div style={{ fontSize: '1.3rem' }}>
              {liveRoomResult.rank === 1 ? '🥇' : liveRoomResult.rank === 2 ? '🥈' : liveRoomResult.rank === 3 ? '🥉' : '⚡'}
            </div>
          </div>
        )}
      </Card>

      {/* Action Buttons: Full-width vertical stack ensures comfortable fit on all mobile screens */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '100%', marginTop: '4px' }}>
        <Button
          variant="primary"
          size="md"
          icon="solar:restart-bold"
          onClick={onRetry}
          fullWidth
          style={{ height: '46px', fontSize: '0.98rem', fontWeight: '800' }}
        >
          {t('BTN_RETRY')}
        </Button>

        <Button
          variant="secondary"
          size="md"
          icon="solar:share-bold"
          onClick={handleShare}
          fullWidth
          style={{ height: '44px', fontSize: '0.92rem' }}
        >
          {t('BTN_SHARE')}
        </Button>

        <Button
          variant="glass"
          fullWidth
          size="md"
          icon={liveRoomCode ? "solar:cup-star-bold" : "solar:home-2-bold"}
          onClick={onBackHome}
          style={{ height: '42px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
        >
          {liveRoomCode ? t('LIVE_ROOM_VIEW_RESULTS') : t('BTN_BACK_HOME')}
        </Button>
      </div>
    </div>
  );
}
