// src/views/LeaderboardView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchLeaderboard } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Avatar } from '../components/common/Avatar.jsx';

// Persistent module-level cache for instantaneous 0ms display per timeframe
const CACHED_LEADERBOARD = {};

export function LeaderboardView() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [timeframe, setTimeframe] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState(() => CACHED_LEADERBOARD['all'] || { topUsers: [], currentUserRank: null });
  const [loading, setLoading] = useState(() => !CACHED_LEADERBOARD['all']);

  useEffect(() => {
    let isMounted = true;
    if (CACHED_LEADERBOARD[timeframe]) {
      setLeaderboardData(CACHED_LEADERBOARD[timeframe]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchLeaderboard(timeframe)
      .then((data) => {
        if (isMounted && data) {
          CACHED_LEADERBOARD[timeframe] = data;
          setLeaderboardData(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load leaderboard:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  const handleTabChange = (newTab) => {
    if (newTab === timeframe) return;
    haptic.selection();
    setTimeframe(newTab);
  };

  const topUsers = leaderboardData?.topUsers || [];
  const top1 = topUsers[0];
  const top2 = topUsers[1];
  const top3 = topUsers[2];
  const restUsers = topUsers.slice(3);
  const currentUser = leaderboardData?.currentUserRank;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{t('LEADERBOARD_TITLE')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
          {t('LEADERBOARD_SUBTITLE')}
        </p>
      </div>

      {/* Tabs */}
      <div className="glass-panel" style={{ display: 'flex', padding: '4px', gap: '6px', borderRadius: 'var(--radius-md)' }}>
        <button
          onClick={() => handleTabChange('all')}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: '700',
            fontSize: '0.85rem',
            backgroundColor: timeframe === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: timeframe === 'all' ? '#fff' : 'var(--text-secondary)',
            boxShadow: timeframe === 'all' ? '0 2px 10px rgba(99, 102, 241, 0.3)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          {t('TAB_ALL_TIME')}
        </button>
        <button
          onClick={() => handleTabChange('weekly')}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: '700',
            fontSize: '0.85rem',
            backgroundColor: timeframe === 'weekly' ? 'var(--accent-primary)' : 'transparent',
            color: timeframe === 'weekly' ? '#fff' : 'var(--text-secondary)',
            boxShadow: timeframe === 'weekly' ? '0 2px 10px rgba(99, 102, 241, 0.3)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          {t('TAB_WEEKLY')}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : topUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
          <Icon icon="solar:cup-star-bold-duotone" width="48" height="48" style={{ marginBottom: '12px' }} />
          <p style={{ fontSize: '0.9rem' }}>Hozircha reytingda natijalar mavjud emas</p>
        </div>
      ) : (
        <>
          {/* Podium Top 3 */}
          {top1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'end', marginTop: '12px' }}>
              {/* 2nd place (Left) */}
              <Card
                style={{
                  padding: '14px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '145px',
                  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.12) 0%, var(--surface-card) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                }}
              >
                <div style={{ fontSize: '1.3rem' }}>🥈</div>
                <Avatar user={top2} size={44} showRing={false} />
                <div style={{ fontWeight: '700', fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }}>
                  {top2?.name || '-'}
                </div>
                <Badge variant="neutral" size="sm">{top2?.xp || 0} XP</Badge>
              </Card>

              {/* 1st place (Center - elevated) */}
              <Card
                glow
                style={{
                  padding: '18px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '175px',
                  background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, var(--surface-card) 100%)',
                  border: '2px solid rgba(245, 158, 11, 0.6)',
                  boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.6rem', transform: 'scale(1.15)' }}>👑</div>
                <Avatar user={top1} size={52} showRing={true} />
                <div style={{ fontWeight: '800', fontSize: '0.88rem', textAlign: 'center', color: 'var(--color-warning)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                  {top1?.name || '-'}
                </div>
                <Badge variant="warning" size="sm">{top1?.xp || 0} XP</Badge>
              </Card>

              {/* 3rd place (Right) */}
              <Card
                style={{
                  padding: '12px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '135px',
                  background: 'linear-gradient(180deg, rgba(217, 119, 6, 0.12) 0%, var(--surface-card) 100%)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                }}
              >
                <div style={{ fontSize: '1.3rem' }}>🥉</div>
                <Avatar user={top3} size={42} showRing={false} />
                <div style={{ fontWeight: '700', fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }}>
                  {top3?.name || '-'}
                </div>
                <Badge variant="neutral" size="sm">{top3?.xp || 0} XP</Badge>
              </Card>
            </div>
          )}

          {/* Rest of the list (#4 downwards) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {restUsers.map((u) => {
              const isMe = u.isCurrentUser;
              return (
                <Card
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    border: isMe ? '2px solid var(--accent-primary)' : '1px solid var(--surface-border)',
                    backgroundColor: isMe ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '800', width: '22px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      #{u.rank}
                    </span>
                    <Avatar user={u} size={36} showRing={false} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {u.name} {isMe && '⭐'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {t('LEVEL')} {u.level || 1} • {u.accuracy || 0}% {t('STATS_ACCURACY')}
                      </div>
                    </div>
                  </div>

                  <Badge variant={isMe ? 'primary' : 'neutral'}>{u.xp} XP</Badge>
                </Card>
              );
            })}
          </div>

          {/* Sticky Current User Rank if not in top list */}
          {currentUser && currentUser.rank > 3 && (
            <div
              className="glass-panel"
              style={{
                position: 'sticky',
                bottom: '12px',
                zIndex: 50,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--accent-primary)',
                boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--accent-primary)' }}>
                  #{currentUser.rank}
                </span>
                <Avatar user={currentUser} size={36} showRing={true} />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.88rem' }}>{t('YOU_ARE_RANKED', { rank: currentUser.rank })}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{currentUser.xp || 0} XP</div>
                </div>
              </div>
              <Badge variant="primary">{currentUser.xp} XP</Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
}
