import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchUserMistakes } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { calculateLevelProgress } from '../utils/gamification.js';

export function HomeView({
  initialData,
  onStartQuiz,
  onNavigateToTab,
  onOpenCreator,
  onStartMistakesPractice,
  onOpenKiut,
  onOpenMistakes,
}) {
  const { t } = useTranslation();
  const { user, haptic } = useTelegram();
  const [mistakesData, setMistakesData] = useState({ mistakes: [], count: 0 });
  const [expandedQuizId, setExpandedQuizId] = useState(null);

  useEffect(() => {
    fetchUserMistakes()
      .then((res) => {
        if (res && typeof res.count === 'number') {
          setMistakesData(res);
        } else {
          setMistakesData({ mistakes: [], count: 0 });
        }
      })
      .catch(() => {
        setMistakesData({ mistakes: [], count: 0 });
      });
  }, [initialData]);

  const myQuizzes = initialData?.myQuizzes || [];
  const stats = initialData?.stats || { totalSolved: 0, accuracy: 0, globalRank: '-' };
  const userXp = initialData?.user?.xp || 0;
  const progress = calculateLevelProgress(userXp);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
      {/* Hero Welcome Card */}
      <Card
        glow
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid var(--surface-border-glow)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>
              {t('GREETING_HELLO')}, {user?.first_name || 'Bilimdon'}! 👋
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('HERO_SUBTITLE')}
            </p>
          </div>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: 'var(--shadow-accent)',
            }}
          >
            <Icon icon="solar:star-fall-bold-duotone" width="26" height="26" />
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div style={{ marginTop: '16px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>
            <span>{t('LEVEL')} {progress.level} • {t(progress.rankKey)}</span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {progress.currentLevelXp} / {progress.nextLevelXp} XP ({progress.percentage}%)
            </span>
          </div>
          <div style={{ height: '6px', background: 'var(--surface-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
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

        {/* Stats Row */}
        <div
          style={{
            marginTop: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}
        >
          <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent-primary)' }}>
              {stats.totalSolved}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('STATS_TOTAL_SOLVED')}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-success)' }}>
              {stats.accuracy}%
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('STATS_ACCURACY')}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-warning)' }}>
              #{stats.globalRank}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('NAV_LEADERBOARD')}
            </div>
          </div>
        </div>
      </Card>

      {/* Featured Action: KIUT Tests Center */}
      <Card
        interactive
        onClick={() => {
          haptic.selection();
          if (onOpenKiut) onOpenKiut();
        }}
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)',
            }}
          >
            <Icon icon="solar:diploma-verified-bold-duotone" width="24" height="24" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
              {t('KIUT_TEST_TITLE')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {t('KIUT_TEST_SUBTITLE')}
            </div>
          </div>
        </div>
        <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
          <Icon icon="solar:alt-arrow-right-bold" width="20" height="20" />
        </div>
      </Card>

      {/* Quick Action: Create Quiz */}
      <Card
        interactive
        onClick={onOpenCreator}
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
          border: '1px dashed var(--accent-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon="solar:add-circle-bold" width="22" height="22" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{t('CREATE_QUIZ_TITLE')}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('CREATE_QUIZ_SUBTITLE')}</div>
          </div>
        </div>
      </Card>

      {/* Quick Action: Mistakes Practice (if mistakes exist) */}
      {mistakesData.count > 0 && (
        <Card
          interactive
          onClick={() => {
            if (onOpenMistakes) {
              onOpenMistakes();
            } else if (onStartMistakesPractice) {
              onStartMistakesPractice(mistakesData.mistakes);
            }
          }}
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.12) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-warning)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon="solar:target-bold-duotone" width="22" height="22" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--color-warning)' }}>
                {t('MISTAKES_PRACTICE_TITLE')} ({mistakesData.count})
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {t('MISTAKES_PRACTICE_DESC')}
              </div>
            </div>
          </div>
          <Icon icon="solar:alt-arrow-right-bold" width="20" height="20" style={{ color: 'var(--color-warning)' }} />
        </Card>
      )}

      {/* Section: My Quizzes */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {t('SECTION_RECENT_QUIZZES')}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
            {myQuizzes.length}
          </span>
        </div>

        {myQuizzes.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '32px 16px' }}>
            <Icon icon="solar:document-add-bold-duotone" width="48" height="48" style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t('NO_QUIZZES_YET')}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myQuizzes.map((quiz) => {
              const isExpanded = expandedQuizId === quiz.id;
              return (
                <Card
                  key={quiz.id}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div
                      onClick={() => {
                        haptic.selection();
                        setExpandedQuizId(isExpanded ? null : quiz.id);
                      }}
                      style={{
                        fontWeight: '800',
                        fontSize: '0.96rem',
                        color: 'var(--text-primary)',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        lineHeight: '1.35',
                      }}
                      title={quiz.title}
                    >
                      {quiz.title}
                    </div>

                    {quiz.description && (
                      <div
                        onClick={() => {
                          haptic.selection();
                          setExpandedQuizId(isExpanded ? null : quiz.id);
                        }}
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                        }}
                      >
                        {quiz.description}
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Badge size="sm">{quiz.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                    <Badge size="sm" variant="warning">{quiz.timeLimit}s</Badge>
                  </div>

                  {/* Action Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--surface-border)',
                      marginTop: '2px',
                      gap: '8px',
                    }}
                  >
                    <div
                      onClick={() => {
                        haptic.selection();
                        setExpandedQuizId(isExpanded ? null : quiz.id);
                      }}
                      style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {isExpanded ? '▲ ' + t('SECTION_RECENT_QUIZZES') : ''}
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      icon="solar:play-bold"
                      style={{
                        flexShrink: 0,
                        padding: '7px 14px',
                        fontSize: '0.82rem',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => {
                        haptic.impact('medium');
                        onStartQuiz(quiz.id);
                      }}
                    >
                      {t('BTN_START_QUIZ')}
                    </Button>
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
