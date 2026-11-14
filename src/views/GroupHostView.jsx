// src/views/GroupHostView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchGroupSessions, createLiveRoom } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { ProgressBar } from '../components/quiz/ProgressBar.jsx';
import { QuizModeModal } from '../components/quiz/QuizModeModal.jsx';

export function GroupHostView({ onOpenLiveRoom, onOpenCreator, onOpenKiut }) {
  const { t } = useTranslation();
  const { tg, haptic } = useTelegram();
  const [data, setData] = useState({ activeSessions: [], launchableQuizzes: [] });
  const [loading, setLoading] = useState(true);
  const [creatingLiveId, setCreatingLiveId] = useState(null);
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [modeModalQuizId, setModeModalQuizId] = useState(null);

  const showAlert = (msg) => {
    if (tg?.showAlert) {
      tg.showAlert(msg);
    } else {
      window.alert(msg);
    }
  };

  const loadSessions = () => {
    setLoading(true);
    fetchGroupSessions()
      .then((res) => {
        if (res) setData(res);
      })
      .catch((err) => {
        console.error('Failed to load group sessions:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000); // 10s poll for live sessions
    return () => clearInterval(interval);
  }, []);

  const handleLaunchGroupBattle = (quizId) => {
    haptic.impact('medium');
    setModeModalQuizId(quizId);
  };

  const handleConfirmBattleMode = async (modeConfig) => {
    const quizId = modeConfig?.quizId || modeModalQuizId;
    setModeModalQuizId(null);
    if (!quizId) return;

    haptic.impact('heavy');
    setCreatingLiveId(quizId);
    try {
      const res = await createLiveRoom(quizId, modeConfig);
      if (res && res.success) {
        if (onOpenLiveRoom && res.roomCode) {
          onOpenLiveRoom(res.roomCode);
        }
      } else {
        showAlert(res?.error || t('ERROR_CREATE_ROOM'));
      }
    } catch (err) {
      console.error('Failed to create live battle room:', err);
      showAlert(t('ERROR_PREFIX') + (err.message || t('NETWORK_ERROR')));
    } finally {
      setCreatingLiveId(null);
    }
  };

  const activeSessions = data.activeSessions || [];
  const launchableQuizzes = data.launchableQuizzes || [];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('GROUP_BATTLE_TITLE')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
            {t('GROUP_BATTLE_SUBTITLE')}
          </p>
        </div>
        <button
          onClick={() => {
            haptic.selection();
            loadSessions();
          }}
          className="glass-pill"
          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          title={t('REFRESH')}
        >
          <Icon icon="solar:restart-bold" width="16" height="16" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 1. Live Active Sessions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
            {t('ACTIVE_SESSIONS_COUNT', { count: activeSessions.length })}
          </h3>
        </div>

        {activeSessions.length === 0 ? (
          <Card style={{ padding: '20px 16px', textAlign: 'center' }}>
            <Icon icon="solar:gamepad-minimalistic-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('NO_ACTIVE_BATTLES')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeSessions.map((s) => (
              <Card key={s.sessionId || s.roomCode} glow style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.quizTitle}>
                    {s.quizTitle}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {s.isHost && (
                      <Badge variant="accent" size="sm">
                        {t('YOUR_ROOM_TAG')}
                      </Badge>
                    )}
                    <Badge variant={s.status === 'active' ? 'success' : 'warning'} size="sm">
                      {s.status === 'active' ? `⚡ ${t('STATUS_BATTLE_ACTIVE')}` : `⏳ ${t('STATUS_IN_LOBBY')}`}
                    </Badge>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon icon="solar:users-group-two-rounded-bold" width="14" height="14" />
                    <span>{s.participantCount} / {s.maxPlayers || 10} {t('PARTICIPANTS')}</span>
                  </span>
                  <span>PIN: <b>{s.roomCode}</b></span>
                </div>

                {s.status === 'active' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>{t('QUESTION_PROGRESS', { current: s.currentIndex + 1, total: s.totalQuestions })}</span>
                      <span>{s.currentIndex + 1} / {s.totalQuestions}</span>
                    </div>
                    <ProgressBar current={s.currentIndex + 1} total={s.totalQuestions} />
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('LIVE_ROOM_WAITING_HOST')}
                  </div>
                )}

                <div style={{ marginTop: '2px' }}>
                  {s.isHost ? (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => onOpenLiveRoom(s.roomCode)}
                    >
                      {t('BTN_MANAGE_ENTER')}
                    </Button>
                  ) : s.isJoined ? (
                    <Button
                      variant="success"
                      size="sm"
                      fullWidth
                      onClick={() => onOpenLiveRoom(s.roomCode)}
                    >
                      {t('BTN_REENTER')}
                    </Button>
                  ) : s.participantCount >= (s.maxPlayers || 10) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled
                    >
                      🚫 {t('ROOM_FULL')}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => onOpenLiveRoom(s.roomCode)}
                    >
                      {t('BTN_JOIN')}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 2. Launch in Group Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
            {t('SELECT_QUIZ_FOR_BATTLE')}
          </h3>
          {onOpenKiut && (
            <button
              onClick={onOpenKiut}
              className="glass-pill"
              style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Icon icon="solar:library-bold" width="14" height="14" />
              <span>{t('KIUT_CATALOG_BTN')}</span>
            </button>
          )}
        </div>

        {launchableQuizzes.length === 0 ? (
          <Card style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Icon icon="solar:folder-error-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {t('NO_LAUNCHABLE_QUIZZES')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '280px', margin: '0 auto', width: '100%' }}>
              {onOpenCreator && (
                <Button variant="primary" size="sm" icon="solar:add-circle-bold" onClick={onOpenCreator}>
                  {t('GROUP_CREATE_NEW_QUIZ')}
                </Button>
              )}
              {onOpenKiut && (
                <Button variant="secondary" size="sm" icon="solar:library-bold" onClick={onOpenKiut}>
                  {t('GROUP_CHOOSE_CATALOG')}
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {launchableQuizzes.map((q) => {
              const isExpanded = expandedQuizId === q.id;
              return (
                <Card
                  key={q.id}
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
                      setExpandedQuizId(isExpanded ? null : q.id);
                    }}
                    style={{ minWidth: 0, cursor: 'pointer' }}
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
                      title={q.title}
                    >
                      {q.title}
                    </div>

                    {isExpanded && q.description && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '4px' }}>
                        {q.description}
                      </p>
                    )}
                  </div>

                  {/* Action Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--surface-border)',
                      marginTop: '2px',
                      gap: '8px',
                    }}
                  >
                    {/* Row 1: Badges */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge size="sm">{q.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                      <Badge size="sm" variant="warning">{q.timeLimit}s</Badge>
                      <Badge size="sm" variant={q.isPublic ? 'accent' : 'glass'}>
                        {q.isPublic ? t('BADGE_PUBLIC_QUIZ') : t('BADGE_MY_QUIZ')}
                      </Badge>
                    </div>

                    {/* Single Unified Primary Launch Button */}
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      loading={creatingLiveId === q.id}
                      onClick={() => handleLaunchGroupBattle(q.id)}
                      icon="solar:users-group-two-rounded-bold"
                      style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: '800' }}
                    >
                      {t('BTN_PLAY_WITH_GROUP')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. How to play guide card */}
      <Card style={{ padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: '700', fontSize: '0.92rem' }}>
          <Icon icon="solar:info-circle-bold-duotone" width="20" height="20" style={{ color: 'var(--accent-primary)' }} />
          <span>{t('HOW_TO_PLAY_BATTLE_TITLE')}</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>{t('BATTLE_GUIDE_STEP_1')}</div>
          <div>{t('BATTLE_GUIDE_STEP_2')}</div>
          <div>{t('BATTLE_GUIDE_STEP_3')}</div>
        </div>
      </Card>

      {/* 2-Step Quiz Mode Selector Modal for Host to configure questions count & time limit */}
      <QuizModeModal
        isOpen={Boolean(modeModalQuizId)}
        quizId={modeModalQuizId}
        onClose={() => setModeModalQuizId(null)}
        onConfirmMode={handleConfirmBattleMode}
      />
    </div>
  );
}

export default GroupHostView;
