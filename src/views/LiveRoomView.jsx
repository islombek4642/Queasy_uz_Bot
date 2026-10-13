// src/views/LiveRoomView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchLiveRoomState, startLiveRoom, finishLiveRoom } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { APP_CONFIG } from '../constants/config.js';

export function LiveRoomView({ roomCode, onStartGame, onBack }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevStatusRef = useRef(null);

  const loadState = async () => {
    try {
      const res = await fetchLiveRoomState(roomCode);
      if (res && res.success) {
        setRoomData(res);
        // Only trigger onStartGame if:
        // 1. Room is active
        // 2. The player has NOT yet finished (!res.hasFinished)
        // 3. Status transitioned to active
        if (
          res.room?.status === 'active' &&
          !res.hasFinished &&
          prevStatusRef.current !== 'active'
        ) {
          prevStatusRef.current = 'active';
          haptic.notification('success');
          onStartGame(res.quiz.id, roomCode);
        }
        prevStatusRef.current = res.room?.status;
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
      const res = await startLiveRoom(roomCode);
      if (res && res.success) {
        onStartGame(roomData.quiz.id, roomCode);
      }
    } catch (err) {
      console.error('Failed to start room:', err);
    } finally {
      setStarting(false);
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
    const quizTitle = roomData?.quiz?.title || 'Viktorina';
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=room_${roomCode}`;
    const text = `⚡ "${quizTitle}" jonli xonasi ochildi!\n🔑 PIN kod: ${roomCode}\n🎮 Qo'shilish uchun havola:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    haptic.selection();
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=room_${roomCode}`;
    navigator.clipboard?.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading && !roomData) {
    return (
      <div style={{ padding: '36px 16px', textAlign: 'center' }} className="animate-fade-in">
        <Icon icon="solar:restart-bold" width="36" height="36" className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('LIVE_ROOM_LOADING')}</p>
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

  const { room, quiz, players } = roomData;
  const isHost = room.isHost;
  const isFinished = room.status === 'finished' || roomData.hasFinished;

  // --------------------------------------------------------------------------
  // STATE A: PODIUM / RESULTS SCREEN (When finished or player completed)
  // --------------------------------------------------------------------------
  if (isFinished) {
    const topThree = players.slice(0, 3);
    const restPlayers = players.slice(3);

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
            {room.status === 'finished' ? 'Yakunlandi' : 'Natijalar'}
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
                <div style={{ fontSize: '0.82rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }} title={topThree[1].userName}>
                  {topThree[1].userName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '800' }}>
                  {topThree[1].score} ball
                </div>
                <div style={{ height: '55px', width: '100%', background: 'rgba(148, 163, 184, 0.25)', borderTop: '3px solid #94a3b8', borderRadius: '6px 6px 0 0', marginTop: '6px' }} />
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🥇</div>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={topThree[0].userName}>
                  {topThree[0].userName}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--color-success)', fontWeight: '900' }}>
                  {topThree[0].score} ball
                </div>
                <div style={{ height: '80px', width: '100%', background: 'rgba(245, 158, 11, 0.25)', borderTop: '3px solid #f59e0b', borderRadius: '8px 8px 0 0', marginTop: '6px' }} />
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🥉</div>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }} title={topThree[2].userName}>
                  {topThree[2].userName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '800' }}>
                  {topThree[2].score} ball
                </div>
                <div style={{ height: '40px', width: '100%', background: 'rgba(217, 119, 6, 0.2)', borderTop: '3px solid #d97706', borderRadius: '6px 6px 0 0', marginTop: '6px' }} />
              </div>
            )}
          </div>
        </Card>

        {/* Full Leaderboard Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '0.94rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
            Barcha qatnashchilar ({players.length})
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
                <span style={{ fontWeight: p.isCurrentUser ? '800' : '600', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.userName}>
                  {p.userName} {p.isCurrentUser && ' (Siz)'}
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--color-success)', flexShrink: 0 }}>
                {p.score} ball
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

      {/* Room Code Showcase Card */}
      <Card
        glow
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.2) 100%)',
          border: '1px solid var(--accent-glow)',
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>
          {t('LIVE_ROOM_PIN_LABEL')}
        </div>
        <div
          style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: 'var(--accent-primary)',
            letterSpacing: '6px',
            fontFamily: 'var(--font-family-display)',
            margin: '8px 0',
          }}
        >
          {roomCode}
        </div>
        <p
          style={{
            fontSize: '0.88rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '16px',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            lineHeight: '1.35',
          }}
        >
          {quiz.title}
        </p>

        {/* Share buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon="solar:share-bold"
            onClick={handleShareToTelegram}
          >
            {t('LIVE_ROOM_INVITE_GROUP')}
          </Button>
          <Button
            variant="glass"
            size="sm"
            fullWidth
            icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'}
            onClick={handleCopyLink}
          >
            {copied ? t('TOAST_LINK_COPIED') : t('LIVE_ROOM_COPY_LINK')}
          </Button>
        </div>
      </Card>

      {/* Lobby / Players Waiting Area */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            {t('LIVE_ROOM_LOBBY_TITLE')} ({players.length})
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '8px' }}>
            {players.map((p) => (
              <Card
                key={p.id}
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: p.isCurrentUser ? '1px solid var(--accent-glow)' : '1px solid var(--surface-border)',
                  background: p.isCurrentUser ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface-card)',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--accent-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '0.82rem',
                    flexShrink: 0,
                  }}
                >
                  {p.userName.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: p.isCurrentUser ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                    title={p.userName}
                  >
                    {p.userName}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Host Controls or Player Waiting Banner */}
      <div style={{ marginTop: '10px' }}>
        {isHost ? (
          <Button
            variant="success"
            size="lg"
            fullWidth
            loading={starting}
            icon="solar:play-bold"
            onClick={handleStart}
            style={{ fontSize: '1rem', fontWeight: '800', padding: '14px' }}
          >
            {t('LIVE_ROOM_START_BTN', { count: players.length })}
          </Button>
        ) : (
          <Card
            style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Icon icon="solar:restart-bold" width="18" height="18" className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {t('LIVE_ROOM_WAITING_CARD_TITLE')}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('LIVE_ROOM_WAITING_CARD_SUB')}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
