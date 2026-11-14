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
    const interval = setInterval(loadSessions, 15000); // 15s poll
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
        showAlert(res?.error || 'Guruh jangi xonasini ochishda xatolik yuz berdi');
      }
    } catch (err) {
      console.error('Failed to create live battle room:', err);
      showAlert('Xatolik: ' + (err.message || 'Tarmoq xatosi'));
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Guruh Jangi (Live Battle)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
            Do'stlaringiz bilan birgalikda sinxron jonli test musobaqasi o'tkazing
          </p>
        </div>
        <button
          onClick={() => {
            haptic.selection();
            loadSessions();
          }}
          className="glass-pill"
          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          title={t('LOADING') || 'Yangilash'}
        >
          <Icon icon="solar:restart-bold" width="16" height="16" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 1. Live Active Sessions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Faol sessiyalar ({activeSessions.length})</h3>
        </div>

        {activeSessions.length === 0 ? (
          <Card style={{ padding: '20px 16px', textAlign: 'center' }}>
            <Icon icon="solar:gamepad-minimalistic-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Hozirda faol guruh sessiyalari mavjud emas. Quyidagi testlardan birini tanlab yangi jang boshlang!
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeSessions.map((s) => (
              <Card key={s.sessionId} glow style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.chatTitle}>
                    {s.chatTitle}
                  </div>
                  <Badge variant="success" size="sm" style={{ flexShrink: 0 }}>
                    <Icon icon="solar:users-group-two-rounded-bold" width="14" height="14" style={{ marginRight: '4px' }} />
                    {s.participantCount} {t('PARTICIPANTS')}
                  </Badge>
                </div>

                <div
                  style={{
                    fontSize: '0.86rem',
                    color: 'var(--accent-primary)',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={s.quizTitle}
                >
                  {s.quizTitle}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>{t('QUESTIONS_COUNT')}</span>
                    <span>{s.currentIndex + 1} / {s.totalQuestions}</span>
                  </div>
                  <ProgressBar current={s.currentIndex + 1} total={s.totalQuestions} />
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
            Jang uchun testni tanlang
          </h3>
          {onOpenKiut && (
            <button
              onClick={onOpenKiut}
              className="glass-pill"
              style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Icon icon="solar:library-bold" width="14" height="14" />
              <span>KIUT Katalogi</span>
            </button>
          )}
        </div>

        {launchableQuizzes.length === 0 ? (
          <Card style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Icon icon="solar:folder-error-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Sizda hali testlar mavjud emas. Yangi test tuzishingiz yoki KIUT katalogidan tanlashingiz mumkin.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '280px', margin: '0 auto', width: '100%' }}>
              {onOpenCreator && (
                <Button variant="primary" size="sm" icon="solar:add-circle-bold" onClick={onOpenCreator}>
                  {t('GROUP_CREATE_NEW_QUIZ') || 'Yangi test yaratish'}
                </Button>
              )}
              {onOpenKiut && (
                <Button variant="secondary" size="sm" icon="solar:library-bold" onClick={onOpenKiut}>
                  {t('GROUP_CHOOSE_CATALOG') || 'Katalogdan tanlash'}
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
                        {q.isPublic ? 'Umumiy test' : 'Mening testim'}
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
                      👥 Guruh bilan o'ynash (Jonli Battle)
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
          <span>Guruh jangini qanday o'tkazish kerak?</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>🎯 1. <b>«Guruh bilan o'ynash»</b> tugmasini bosing va savollar soni hamda vaqtini belgilang.</div>
          <div>✈️ 2. Kutish zalida <b>«Telegram orqali taklif qilish»</b> havolasini guruhga yoki do'stlarga yuboring.</div>
          <div>🚀 3. Ishtirokchilar qo'shilgach, <b>«Boshlash»</b> tugmasini bosing va birgalikda sinxron bellashing!</div>
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
