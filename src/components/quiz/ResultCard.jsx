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
    const text = encodeURIComponent(
      t('SHARE_QUIZ_CAPTION', { title: quizTitle, score: accuracy })
    );
    const shareUrl = `https://t.me/share/url?url=https://t.me/${APP_CONFIG.BOT_USERNAME}?start=quiz_${quizId}&text=${text}`;
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
        gap: '20px',
        padding: '20px 16px',
        maxWidth: '480px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Diploma Header */}
      <Card
        glow={isHighPerformance}
        style={{
          textAlign: 'center',
          padding: '32px 20px',
          background: isHighPerformance
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)'
            : 'var(--surface-card)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            background: isHighPerformance ? 'var(--color-success)' : 'var(--accent-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Icon icon={isHighPerformance ? 'solar:cup-star-bold' : 'solar:medal-star-bold'} width="36" height="36" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '6px' }}>
          {accuracy >= 80 ? t('RESULT_EXCELLENT') : accuracy >= 50 ? t('RESULT_GOOD') : t('RESULT_TRY_AGAIN')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.4', margin: '4px 0 0' }}>
          {quizTitle}
        </p>

        {/* Accuracy Gauge */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '3rem', fontWeight: '900', color: isHighPerformance ? 'var(--color-success)' : 'var(--accent-primary)', fontFamily: 'var(--font-family-display)' }}>
            {accuracy}%
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {t('ACCURACY_LABEL')}
          </div>
        </div>

        {/* Detailed Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--surface-border)',
          }}
        >
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-success)' }}>
              {correctCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('CORRECT_COUNT')}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--color-error)' }}>
              {wrongCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('WRONG_COUNT')}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
              {totalTimeSeconds}s
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('TIME_SPENT')}
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Button variant="primary" fullWidth size="lg" icon="solar:share-bold" onClick={handleShare}>
          {t('BTN_SHARE')}
        </Button>

        <Button variant="secondary" fullWidth icon="solar:restart-bold" onClick={onRetry}>
          {t('BTN_RETRY')}
        </Button>

        <Button variant="glass" fullWidth icon="solar:home-2-bold" onClick={onBackHome}>
          {t('BTN_BACK_HOME')}
        </Button>
      </div>
    </div>
  );
}
