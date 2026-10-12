// src/views/LiveRoomView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchLiveRoomState, startLiveRoom } from '../services/quizService.js';
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
  const [copied, setCopied] = useState(false);
  const prevStatusRef = useRef(null);

  const loadState = async () => {
    try {
      const res = await fetchLiveRoomState(roomCode);
      if (res && res.success) {
        setRoomData(res);
        // If room transitioned to active, start the quiz for all players!
        if (res.room?.status === 'active' && prevStatusRef.current !== 'active') {
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

  const handleShareToTelegram = () => {
    haptic.impact('medium');
    const quizTitle = roomData?.quiz?.title || 'Viktorina';
    const shareLink = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=room_${roomCode}`;
    const text = `⚡ "${quizTitle}" jonli xonasi ochildi!\n🔑 PIN kod: ${roomCode}\n🎮 Qo'shilish uchun quyidagi tugmani bosing:`;
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Xona yuklanmoqda...</p>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <Card style={{ padding: '24px' }}>
          <p style={{ color: 'var(--color-error)', fontWeight: '700' }}>Xona topilmadi yoki yopilgan</p>
          <Button variant="primary" style={{ marginTop: '16px' }} onClick={onBack}>Orqaga</Button>
        </Card>
      </div>
    );
  }

  const { room, quiz, players } = roomData;
  const isHost = room.isHost;

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
          <span>Orqaga</span>
        </button>

        <Badge variant="warning" size="sm">
          <Icon icon="solar:bolt-bold" width="14" height="14" style={{ marginRight: '4px' }} />
          Jonli Xona (Live)
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
          Xona PIN kodi
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
            Guruhga taklif qilish
          </Button>
          <Button
            variant="glass"
            size="sm"
            fullWidth
            icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'}
            onClick={handleCopyLink}
          >
            {copied ? 'Havola nusxalandi!' : 'Xona havolasini nusxalash'}
          </Button>
        </div>
      </Card>

      {/* Lobby / Players Waiting Area */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            Kutish zali ({players.length} o'yinchi)
          </h3>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {isHost ? 'Siz boshlovchisiz' : 'Boshlanishini kuting...'}
          </span>
        </div>

        {players.length === 0 ? (
          <Card style={{ padding: '28px 16px', textAlign: 'center' }}>
            <Icon icon="solar:users-group-two-rounded-bold-duotone" width="40" height="40" style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Hozircha hech kim qo'shilmadi. PIN kodni do'stlaringizga ulashing!
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
            O'yinni Boshlash ({players.length} o'yinchi)
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
                Boshlovchi o'yinni boshlashini kuting...
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Boshlovchi "Start" tugmasini bosishi bilanoq test avtomatik boshlanadi!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
