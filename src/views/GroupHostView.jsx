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

export function GroupHostView({ onOpenTournament, onOpenLiveRoom, onOpenCreator, onOpenKiut }) {
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
      {/* Top Header */}
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
          title={t('LOADING') || 'Yangilash'}
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
          <Card style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Icon icon="solar:folder-error-bold-duotone" width="36" height="36" style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {t('MY_QUIZZES_EMPTY')}
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

                    {/* Row 2: 3 Action Launch Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Option 1: Native Bot Poll in Telegram Group */}
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => handleLaunchInGroup(q.shareLink)}
                        icon="solar:forward-bold"
                        style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      >
                        {t('BTN_LAUNCH_BOT_POLL')}
                      </Button>

                      {/* Option 2: WebApp Group Tournament */}
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        loading={creatingId === q.id}
                        onClick={() => handleShareTournament(q.id)}
                        icon="solar:cup-star-bold"
                        style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      >
                        {t('BTN_GROUP_TOURNAMENT')}
                      </Button>

                      {/* Option 3: Synchronous Live Multiplayer Room */}
                      <Button
                        variant="glass"
                        size="sm"
                        fullWidth
                        loading={creatingLiveId === q.id}
                        onClick={() => handleCreateLiveRoom(q.id)}
                        icon="solar:bolt-bold"
                        style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      >
                        {t('BTN_LIVE_ROOM')}
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
          <div>🤖 1. <b>«{t('BTN_LAUNCH_BOT_POLL')}»</b> {t('GROUP_HOST_STEP_1_HINT')}</div>
          <div>🏆 2. <b>«{t('BTN_GROUP_TOURNAMENT')}»</b> {t('GROUP_HOST_STEP_2_HINT')}</div>
          <div>⚡ 3. <b>«{t('BTN_LIVE_ROOM')}»</b> {t('GROUP_HOST_STEP_3_HINT')}</div>
        </div>
      </Card>

      {/* Share Tournament Modal */}
      {shareModalData && (
        <Modal
          isOpen={Boolean(shareModalData)}
          title={t('SHARE_MODAL_TITLE')}
          icon="solar:share-bold"
          maxWidth="400px"
          onClose={() => setShareModalData(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.35', margin: 0 }}>
              {t('SHARE_MODAL_SUBTITLE', { title: shareModalData.title })}
            </p>

            {/* Compact Link & Copy Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid var(--accent-glow)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 6px 4px 10px',
                gap: '6px',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: '0.76rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--accent-primary)',
                  fontWeight: '600',
                  textAlign: 'left',
                }}
                title={shareModalData.shareLink}
              >
                {shareModalData.shareLink}
              </span>
              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  navigator.clipboard?.writeText(shareModalData.shareLink);
                  setCopiedModal(true);
                  setTimeout(() => setCopiedModal(false), 2000);
                }}
                className="glass-pill"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: copiedModal ? 'var(--color-success)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <Icon icon={copiedModal ? 'solar:check-circle-bold' : 'solar:copy-bold'} width="13" height="13" />
                <span>{copiedModal ? t('TOAST_LINK_COPIED') : (t('BTN_COPY_LINK') || 'Nusxalash')}</span>
              </button>
            </div>

            {/* Action Buttons: 2 sleek buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
              <Button
                variant="primary"
                fullWidth
                size="sm"
                icon="solar:share-bold"
                style={{ padding: '9px 12px', fontSize: '0.85rem' }}
                onClick={() => {
                  haptic.impact('medium');
                  const tg = window.Telegram?.WebApp;
                  if (tg?.openTelegramLink) tg.openTelegramLink(shareModalData.telegramShareUrl);
                  else if (tg?.openLink) tg.openLink(shareModalData.telegramShareUrl);
                  else window.open(shareModalData.telegramShareUrl, '_blank');
                }}
              >
                {t('BTN_TELEGRAM_SHARE_GROUP')}
              </Button>

              <Button
                variant="glass"
                fullWidth
                size="sm"
                icon="solar:cup-star-bold"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                onClick={() => {
                  haptic.selection();
                  const code = shareModalData.shareCode;
                  setShareModalData(null);
                  if (onOpenTournament) onOpenTournament(code);
                }}
              >
                {t('BTN_VIEW_TOURNAMENT_RANKS')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
