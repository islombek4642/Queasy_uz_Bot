// src/views/GroupHostView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchGroupSessions, createLiveRoom, finishLiveRoom } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { ProgressBar } from '../components/quiz/ProgressBar.jsx';
import { QuizModeModal } from '../components/quiz/QuizModeModal.jsx';

export function GroupHostView({ onOpenLiveRoom, onOpenCreator, onOpenKiut }) {
  const { t } = useTranslation();
  const { tg, haptic } = useTelegram();
  const [data, setData] = useState({ activeSessions: [], userQuizzes: [], launchableQuizzes: [] });
  const [loading, setLoading] = useState(true);
  const [creatingLive, setCreatingLive] = useState(false);
  const [cancellingCode, setCancellingCode] = useState(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
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

  const handleCancelRoom = async (roomCode) => {
    if (!window.confirm(t('CONFIRM_CANCEL_ROOM'))) return;
    haptic.impact('medium');
    setCancellingCode(roomCode);
    try {
      await finishLiveRoom(roomCode, 'cancelled');
      loadSessions();
    } catch (err) {
      console.error('Failed to cancel room:', err);
    } finally {
      setCancellingCode(null);
    }
  };

  const handleConfirmBattleMode = async (modeConfig) => {
    setShowCreateWizard(false);
    const quizId = modeConfig?.quizId || modeModalQuizId;
    if (!quizId) {
      console.warn('Cannot create group battle room: missing quizId');
      return;
    }

    haptic.impact('heavy');
    setCreatingLive(true);
    try {
      const res = await createLiveRoom(quizId, modeConfig);
      if (res && res.success && res.roomCode) {
        if (onOpenLiveRoom) {
          onOpenLiveRoom(res.roomCode);
        }
      } else {
        showAlert(res?.error || t('ERROR_CREATE_ROOM'));
      }
    } catch (err) {
      console.error('Failed to create live battle room:', err);
      showAlert(t('ERROR_PREFIX') + (err?.message || t('NETWORK_ERROR')));
    } finally {
      setCreatingLive(false);
    }
  };

  const activeSessions = data.activeSessions || [];
  const myQuizzes = data.userQuizzes || data.launchableQuizzes || [];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }} className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('GROUP_BATTLE_TITLE')}</h2>
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
          <Card style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {t('NO_ACTIVE_BATTLES')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeSessions.map((s) => (
              <Card key={s.sessionId || s.roomCode} glow style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
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

                <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                  {s.isHost ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        style={{ flex: 1 }}
                        onClick={() => onOpenLiveRoom(s.roomCode)}
                      >
                        {t('BTN_MANAGE_ENTER')}
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        loading={cancellingCode === s.roomCode}
                        onClick={() => handleCancelRoom(s.roomCode)}
                        style={{ color: 'var(--color-error)', minWidth: '40px' }}
                        title={t('BTN_CANCEL_ROOM')}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width="16" height="16" />
                      </Button>
                    </>
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

      {/* 2. Hero Action Card: Create Group Battle Wizard Launcher (Clean, uncluttered layout) */}
      <Card
        glow
        style={{
          padding: '24px 18px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.18) 100%)',
          border: '1.5px solid var(--accent-glow)',
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
          }}
        >
          <Icon icon="solar:users-group-two-rounded-bold" width="28" height="28" />
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
          {t('CREATE_GROUP_BATTLE_HERO_TITLE')}
        </h3>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={creatingLive}
          icon="solar:add-circle-bold"
          onClick={() => {
            haptic.impact('medium');
            setShowCreateWizard(true);
          }}
          style={{ padding: '14px 20px', fontSize: '0.98rem', fontWeight: '800' }}
        >
          {t('CREATE_GROUP_BATTLE_BTN')}
        </Button>
      </Card>

      {/* 3-Step Modal Wizard (Step 1: User Quiz Selection -> Step 2: Mode Selection -> Step 3: Time Limit) */}
      <QuizModeModal
        isOpen={showCreateWizard}
        quizId={null}
        userQuizzes={myQuizzes}
        onOpenCreator={onOpenCreator}
        onClose={() => setShowCreateWizard(false)}
        onConfirmMode={handleConfirmBattleMode}
      />
    </div>
  );
}

export default GroupHostView;
