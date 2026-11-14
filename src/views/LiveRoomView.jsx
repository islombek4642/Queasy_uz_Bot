// src/views/LiveRoomView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchLiveRoomState, startLiveRoom, finishLiveRoom, toggleLiveReady } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { APP_CONFIG } from '../constants/config.js';

export function LiveRoomView({ roomCode, onStartGame, onBack }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevStatusRef = useRef(null);

  const loadState = async () => {
    try {
      const res = await fetchLiveRoomState(roomCode);
      if (res && res.success) {
        setRoomData(res);
        // Trigger onStartGame when room is active (for both waiting players and mid-game joiners)
        if (
          res.room?.status === 'active' &&
          !res.hasFinished
        ) {
          prevStatusRef.current = 'active';
          haptic.notification('success');
          onStartGame(res.quiz.id, roomCode, res.modeConfig);
          return;
        }
        prevStatusRef.current = res.room?.status;
      } else if (res && res.error === 'ROOM_FULL') {
        setRoomData({ error: 'ROOM_FULL', message: res.message || t('ROOM_FULL') });
      }
    } catch (err) {
      console.error('Failed to poll room state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 2000); // 2s polling
    return () => clearInterval(interval);
  }, [roomCode]);

  const handleStart = async () => {
    haptic.impact('heavy');
    setStarting(true);
    try {
      const modeConfig = roomData?.modeConfig || {};
      const res = await startLiveRoom(roomCode, modeConfig);
      if (res && res.success) {
        onStartGame(roomData.quiz.id, roomCode, modeConfig);
      } else if (res?.message) {
        alert(res.message);
      }
    } catch (err) {
      console.error('Failed to start room:', err);
    } finally {
      setStarting(false);
    }
  };

  const handleToggleReady = async (isReady) => {
    haptic.selection();
    setTogglingReady(true);
    try {
      await toggleLiveReady(roomCode, isReady);
      await loadState();
    } catch (err) {
      console.error('Failed to toggle ready status:', err);
    } finally {
      setTogglingReady(false);
    }
  };

  const handleFinishRoom = async () => {
    haptic.impact('medium');
    setFinishing(true);
    try {
      const res = await finishLiveRoom(roomCode);
      if (res && res.success) {
        loadState();
      }
    } catch (err) {
      console.error('Failed to finish room:', err);
    } finally {
      setFinishing(false);
    }
  };

  const handleShareToTelegram = () => {
    haptic.impact('medium');
    const quizTitle = roomData?.quiz?.title || t('DEFAULT_QUIZ_FALLBACK');
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=battle_${roomCode}`;
    const text = t('LIVE_ROOM_SHARE_TEXT', { title: quizTitle });
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    haptic.selection();
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=battle_${roomCode}`;
    navigator.clipboard?.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading && !roomData) {
    return (
      <div style={{ padding: '36px 16px', textAlign: 'center' }} className="animate-fade-in">
        <Spinner size={36} style={{ margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('LIVE_ROOM_LOADING')}</p>
      </div>
    );
  }

  if (roomData?.error === 'ROOM_FULL') {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Icon icon="solar:users-group-two-rounded-bold" width="40" height="40" style={{ color: 'var(--color-warning)', margin: '0 auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>{t('ROOM_FULL')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {roomData.message || t('ROOM_FULL')}
          </p>
          <Button variant="primary" style={{ marginTop: '12px' }} onClick={onBack}>{t('BTN_BACK')}</Button>
        </Card>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <Card style={{ padding: '24px' }}>
          <p style={{ color: 'var(--color-error)', fontWeight: '700' }}>{t('LIVE_ROOM_NOT_FOUND')}</p>
          <Button variant="primary" style={{ marginTop: '16px' }} onClick={onBack}>{t('BTN_BACK')}</Button>
        </Card>
      </div>
    );
  }

  const room = roomData?.room || {};
  const quiz = roomData?.quiz || {};
  const players = Array.isArray(roomData?.players) ? roomData.players : [];
  const isHost = Boolean(room.isHost);
  const isFinished = room.status === 'finished';
  const readyCount = roomData?.readyCount || 0;
  const canStart = Boolean(roomData?.canStart);
  const maxPlayers = roomData?.maxPlayers || 10;

  const currentUser = players.find((p) => p.isCurrentUser);
  const isCurrentUserReady = Boolean(currentUser?.isReady);

  // --------------------------------------------------------------------------
  // STATE A: PODIUM / RESULTS SCREEN (When finished or player completed)
  // --------------------------------------------------------------------------
  if (isFinished) {
    const topThree = players.slice(0, 3);

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
        {/* Header */}
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
            <span>{t('BTN_BACK')}</span>
          </button>

          <Badge variant="success" size="sm">
            <Icon icon="solar:cup-star-bold" width="14" height="14" style={{ marginRight: '4px' }} />
            {room.status === 'finished' ? t('STATUS_FINISHED') : t('STATUS_RESULTS')}
          </Badge>
        </div>

        {/* Podium Card */}
        <Card
          glow
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.12) 100%)',
            border: '1px solid var(--accent-glow)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>
            {t('LIVE_ROOM_PODIUM_TITLE')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '20px' }}>
            {quiz.title} • PIN: {roomCode}
          </p>

          {/* Top 3 Visual Podium */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', minHeight: '140px', marginBottom: '8px' }}>
            {/* 2nd Place */}
            {topThree[1] && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥈</div>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }} title={topThree[1]?.userName || t('ROLE_PLAYER')}>
                  {topThree[1]?.userName || t('ROLE_PLAYER')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '800' }}>
                  {topThree[1]?.score || 0} {t('SCORE_POINTS')}
                </div>
                <div style={{ height: '55px', width: '100%', background: 'rgba(148, 163, 184, 0.25)', borderTop: '3px solid #94a3b8', borderRadius: '6px 6px 0 0', marginTop: '6px' }} />
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🥇</div>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={topThree[0]?.userName || t('ROLE_PLAYER')}>
                  {topThree[0]?.userName || t('ROLE_PLAYER')}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--color-success)', fontWeight: '900' }}>
                  {topThree[0]?.score || 0} {t('SCORE_POINTS')}
                </div>
                <div style={{ height: '80px', width: '100%', background: 'rgba(245, 158, 11, 0.25)', borderTop: '3px solid #f59e0b', borderRadius: '8px 8px 0 0', marginTop: '6px' }} />
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥉</div>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }} title={topThree[2]?.userName || t('ROLE_PLAYER')}>
                  {topThree[2]?.userName || t('ROLE_PLAYER')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '800' }}>
                  {topThree[2]?.score || 0} {t('SCORE_POINTS')}
                </div>
                <div style={{ height: '40px', width: '100%', background: 'rgba(217, 119, 6, 0.2)', borderTop: '3px solid #d97706', borderRadius: '6px 6px 0 0', marginTop: '6px' }} />
              </div>
            )}
          </div>
        </Card>

        {/* Full Leaderboard Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '0.94rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
            {t('ALL_PARTICIPANTS_COUNT', { count: players.length })}
          </h3>
          {players.map((p, idx) => (
            <Card
              key={p.id || idx}
              style={{
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: p.isCurrentUser ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-card)',
                border: p.isCurrentUser ? '1px solid var(--accent-glow)' : '1px solid var(--surface-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontWeight: '800', fontSize: '0.9rem', color: idx < 3 ? 'var(--accent-primary)' : 'var(--text-muted)', width: '22px' }}>
                  #{idx + 1}
                </span>
                <span style={{ fontWeight: p?.isCurrentUser ? '800' : '600', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p?.userName || t('ROLE_PLAYER')}>
                  {p?.userName || t('ROLE_PLAYER')} {p?.isCurrentUser && t('CURRENT_USER_TAG')}
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--color-success)', flexShrink: 0 }}>
                {p?.score || 0} {t('SCORE_POINTS')}
              </div>
            </Card>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {isHost && room.status !== 'finished' && (
            <Button
              variant="warning"
              fullWidth
              loading={finishing}
              icon="solar:stop-circle-bold"
              onClick={handleFinishRoom}
            >
              {t('LIVE_ROOM_FINISH_BTN')}
            </Button>
          )}

          <Button
            variant="primary"
            fullWidth
            icon="solar:arrow-left-bold"
            onClick={onBack}
          >
            {t('LIVE_ROOM_EXIT')}
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STATE B: LOBBY (WAITING ROOM)
  // --------------------------------------------------------------------------
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      {/* Top Header */}
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
          <span>{t('BTN_BACK')}</span>
        </button>

        <Badge variant="warning" size="sm">
          <Icon icon="solar:bolt-bold" width="14" height="14" style={{ marginRight: '4px' }} />
          {t('LIVE_ROOM_TITLE')}
        </Badge>
      </div>

      {/* Streamlined Room Code & Info Card */}
      <Card
        glow
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid var(--accent-glow)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
              {t('LIVE_ROOM_TITLE')}
            </span>
            <Badge variant="warning" size="sm">
              {quiz.questionCount || 0} {t('QUESTIONS_COUNT')}
            </Badge>
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.3' }}>
            {quiz.title}
          </h2>
        </div>

        {/* Compact PIN Badge with copy button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '8px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>PIN:</span>
            <span
              style={{
                fontSize: '1.4rem',
                fontWeight: '900',
                color: 'var(--accent-primary)',
                letterSpacing: '3px',
                fontFamily: 'var(--font-family-display)',
              }}
            >
              {roomCode}
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="glass-pill"
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <Icon icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'} width="13" height="13" />
            <span>{copied ? t('TOAST_LINK_COPIED') : t('BTN_COPY_LINK')}</span>
          </button>
        </div>

        {/* Share Button to invite group members */}
        <Button
          variant="primary"
          size="md"
          fullWidth
          icon="solar:share-bold"
          onClick={handleShareToTelegram}
          style={{ height: '40px', fontSize: '0.88rem', fontWeight: '700' }}
        >
          {t('LIVE_ROOM_INVITE_GROUP')}
        </Button>
      </Card>

      {/* Lobby / Players Waiting Area */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            {t('LIVE_ROOM_LOBBY_TITLE')} ({players.length} / {maxPlayers})
          </h3>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {isHost ? t('LIVE_ROOM_YOU_ARE_HOST') : t('LIVE_ROOM_WAITING_HOST')}
          </span>
        </div>

        {players.length === 0 ? (
          <Card style={{ padding: '28px 16px', textAlign: 'center' }}>
            <Icon icon="solar:users-group-two-rounded-bold-duotone" width="40" height="40" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('LIVE_ROOM_EMPTY_PLAYERS')}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            {players.map((p) => {
              const pInitial = (p?.userName || 'O\'yinchi').slice(0, 1).toUpperCase();
              const isPlayerHost = Number(p.userId) === Number(room.hostId);

              return (
                <Card
                  key={p.id || p.userId}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: p.isCurrentUser ? '1.5px solid var(--accent-glow)' : '1px solid var(--surface-border)',
                    background: p.isCurrentUser ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface-card)',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isPlayerHost ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '800',
                      fontSize: '0.82rem',
                      flexShrink: 0,
                    }}
                  >
                    {isPlayerHost ? '👑' : pInitial}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: p?.isCurrentUser ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}
                      title={p?.userName || t('ROLE_PLAYER')}
                    >
                      {p?.userName || t('ROLE_PLAYER')}
                    </div>
                    <div style={{ marginTop: '2px' }}>
                      {isPlayerHost ? (
                        <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#f59e0b' }}>
                          {t('ROLE_HOST')}
                        </span>
                      ) : p.isReady ? (
                        <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--color-success)' }}>
                          ✅ {t('PLAYER_READY')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                          ⏳ {t('PLAYER_NOT_READY')}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Host Controls or Participant Ready Toggle */}
      <div style={{ marginTop: '10px' }}>
        {room.status === 'active' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              variant="success"
              size="lg"
              fullWidth
              icon="solar:play-bold"
              onClick={() => onStartGame(quiz.id, roomCode, roomData?.modeConfig)}
              style={{ fontSize: '1rem', fontWeight: '800', padding: '14px' }}
            >
              🚀 {t('LIVE_ROOM_JOIN_ACTIVE_GAME')}
            </Button>
            {isHost && (
              <Button
                variant="warning"
                fullWidth
                loading={finishing}
                icon="solar:stop-circle-bold"
                onClick={handleFinishRoom}
              >
                {t('LIVE_ROOM_FINISH_BTN')}
              </Button>
            )}
            <Button
              variant="glass"
              fullWidth
              icon="solar:arrow-left-bold"
              onClick={onBack}
            >
              {t('LIVE_ROOM_EXIT')}
            </Button>
          </div>
        ) : isHost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              variant="success"
              size="lg"
              fullWidth
              disabled={!canStart}
              loading={starting}
              icon="solar:play-bold"
              onClick={handleStart}
              style={{
                fontSize: '1rem',
                fontWeight: '800',
                padding: '14px',
                opacity: canStart ? 1 : 0.65,
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}
            >
              {players.length < 2
                ? t('MIN_PLAYERS_HINT')
                : readyCount < 2
                ? t('MIN_READY_HINT')
                : t('LIVE_ROOM_START_READY_BTN', { ready: readyCount, total: players.length })}
            </Button>
            {!canStart && (
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                {players.length < 2 ? t('MIN_PLAYERS_HINT') : t('MIN_READY_HINT')}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Player Readiness Toggle Button */}
            <Button
              variant={isCurrentUserReady ? 'glass' : 'success'}
              size="lg"
              fullWidth
              loading={togglingReady}
              icon={isCurrentUserReady ? 'solar:clock-circle-bold' : 'solar:check-circle-bold'}
              onClick={() => handleToggleReady(!isCurrentUserReady)}
              style={{ fontSize: '1rem', fontWeight: '800', padding: '14px' }}
            >
              {isCurrentUserReady ? t('BTN_TOGGLE_UNREADY') : t('BTN_TOGGLE_READY')}
            </Button>

            <Card
              style={{
                padding: '12px 16px',
                textAlign: 'center',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner size={16} />
                <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {t('LIVE_ROOM_WAITING_CARD_TITLE')}
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {readyCount < 2 ? t('MIN_READY_HINT') : t('LIVE_ROOM_WAITING_CARD_SUB')}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveRoomView;
