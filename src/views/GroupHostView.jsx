// src/views/GroupHostView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchGroupSessions, createTournament, createLiveRoom } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { ProgressBar } from '../components/quiz/ProgressBar.jsx';

export function GroupHostView({ onOpenTournament, onOpenLiveRoom }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [data, setData] = useState({ activeSessions: [], launchableQuizzes: [] });
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState(null);
  const [creatingLiveId, setCreatingLiveId] = useState(null);
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [shareModalData, setShareModalData] = useState(null);
  const [copiedModal, setCopiedModal] = useState(false);

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

  const handleShareTournament = async (quizId) => {
    haptic.impact('medium');
    setCreatingId(quizId);
    try {
      const res = await createTournament(quizId);
      if (res && res.success) {
        setShareModalData(res);
        const tg = window.Telegram?.WebApp;
        if (tg && typeof tg.openTelegramLink === 'function') {
          tg.openTelegramLink(res.telegramShareUrl);
        } else if (tg && typeof tg.openLink === 'function') {
          tg.openLink(res.telegramShareUrl);
        }
      } else {
        alert(res?.error || 'Turnir yaratishda xatolik yuz berdi');
      }
    } catch (err) {
      console.error('Failed to create tournament:', err);
      alert('Xatolik: ' + (err.message || 'Tarmoq xatosi'));
    } finally {
      setCreatingId(null);
    }
  };

  const handleCreateLiveRoom = async (quizId) => {
    haptic.impact('heavy');
    setCreatingLiveId(quizId);
    try {
      const res = await createLiveRoom(quizId);
      if (res && res.success) {
        if (onOpenLiveRoom && res.roomCode) {
          onOpenLiveRoom(res.roomCode);
        }
      } else {
        alert(res?.error || 'Jonli xona ochishda xatolik yuz berdi');
      }
    } catch (err) {
      console.error('Failed to create live room:', err);
      alert('Xatolik: ' + (err.message || 'Tarmoq xatosi'));
    } finally {
      setCreatingLiveId(null);
    }
  };



  const handleLaunchInGroup = (shareLink) => {
    haptic.impact('medium');
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(shareLink);
    } else {
      window.open(shareLink, '_blank');
    }
  };


  const activeSessions = data.activeSessions || [];
  const launchableQuizzes = data.launchableQuizzes || [];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('GROUP_HOST_TITLE')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
            {t('GROUP_HOST_DESC')}
          </p>
        </div>
        <button
          onClick={() => {
            haptic.selection();
            loadSessions();
          }}
          className="glass-pill"
          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          title="Yangilash"
        >
          <Icon icon="solar:restart-bold" width="16" height="16" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 1. Live Active Sessions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{t('ACTIVE_SESSIONS')} ({activeSessions.length})</h3>
        </div>

        {activeSessions.length === 0 ? (
          <Card style={{ padding: '20px 16px', textAlign: 'center' }}>
            <Icon icon="solar:gamepad-minimalistic-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('NO_ACTIVE_SESSIONS')}
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
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px' }}>
          {t('LAUNCH_IN_GROUP')}
        </h3>

        {launchableQuizzes.length === 0 ? (
          <Card style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('MY_QUIZZES_EMPTY')}
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
                  </div>

                  {/* Action Toolbar - 2 evenly distributed rows */}
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
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Badge size="sm">{q.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                      <Badge size="sm" variant="warning">{q.timeLimit}s</Badge>
                    </div>

                    {/* Row 2: Action Buttons (Share Tournament & Live Room) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        loading={creatingId === q.id}
                        onClick={() => handleShareTournament(q.id)}
                        icon="solar:share-bold"
                        style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      >
                        {t('BTN_SHARE_TO_GROUP')}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        loading={creatingLiveId === q.id}
                        onClick={() => handleCreateLiveRoom(q.id)}
                        icon="solar:bolt-bold"
                        style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      >
                        {t('BTN_CREATE_LIVE_ROOM')}
                      </Button>
                    </div>
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
          <span>{t('HOW_TO_PLAY_GROUP')}</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>🎯 1. <b>«{t('BTN_SHARE_TO_GROUP')}»</b> tugmasini bosing va o'z guruhingizni tanlang.</div>
          <div>⚡ 2. <b>«{t('BTN_CREATE_LIVE_ROOM')}»</b> orqali Kahoot kabi real-time xona ochib, bir vaqtda test o'ynang!</div>
        </div>
      </Card>

      {/* Share Tournament Modal */}
      {shareModalData && (
        <Modal
          isOpen={Boolean(shareModalData)}
          title="Guruhga Ulashish 🚀"
          icon="solar:share-bold"
          onClose={() => setShareModalData(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <b>«{shareModalData.title}»</b> guruh turniri yaratildi! Guruhdoshlaringizga yuboring:
            </p>

            <div
              style={{
                padding: '12px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid var(--accent-glow)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                wordBreak: 'break-all',
                color: 'var(--accent-primary)',
                fontWeight: '600',
              }}
            >
              {shareModalData.shareLink}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <Button
                variant="primary"
                fullWidth
                size="md"
                icon="solar:share-bold"
                onClick={() => {
                  const tg = window.Telegram?.WebApp;
                  if (tg?.openTelegramLink) tg.openTelegramLink(shareModalData.telegramShareUrl);
                  else if (tg?.openLink) tg.openLink(shareModalData.telegramShareUrl);
                  else window.open(shareModalData.telegramShareUrl, '_blank');
                }}
              >
                Telegram Guruhga Yuborish
              </Button>

              <Button
                variant="secondary"
                fullWidth
                size="md"
                icon={copiedModal ? 'solar:check-circle-bold' : 'solar:copy-bold'}
                onClick={() => {
                  navigator.clipboard?.writeText(shareModalData.shareLink);
                  setCopiedModal(true);
                  setTimeout(() => setCopiedModal(false), 2000);
                }}
              >
                {copiedModal ? 'Nusxalandi!' : 'Havolani nusxalash'}
              </Button>

              <Button
                variant="glass"
                fullWidth
                size="md"
                icon="solar:cup-star-bold"
                onClick={() => {
                  const code = shareModalData.shareCode;
                  setShareModalData(null);
                  if (onOpenTournament) onOpenTournament(code);
                }}
              >
                Turnir Peshqadamlarini Ko'rish
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

