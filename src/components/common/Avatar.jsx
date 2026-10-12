// src/components/common/Avatar.jsx
import React, { useState } from 'react';

export function Avatar({ user, size = 40, showRing = true, level = null }) {
  const [imageError, setImageError] = useState(false);

  // 1. Direct photo_url from Telegram WebApp initDataUnsafe.user
  // 2. Public telegram userpic CDN fallback if username exists
  const candidateUrl =
    user?.photo_url ||
    (user?.username ? `https://t.me/i/userpic/320/${user.username}.jpg` : null);

  const initial = (user?.first_name || user?.name || 'Q')[0].toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          padding: showRing ? '2px' : '0',
          background: showRing
            ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)'
            : 'transparent',
          boxShadow: showRing ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'transform var(--transition-fast)',
        }}
      >
        {candidateUrl && !imageError ? (
          <img
            src={candidateUrl}
            alt={user?.first_name || 'Avatar'}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              backgroundColor: 'var(--surface-card)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: `${Math.round(size * 0.42)}px`,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
            }}
          >
            {initial}
          </div>
        )}
      </div>

      {level !== null && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: '800',
            padding: '1px 5px',
            borderRadius: '10px',
            border: '2px solid var(--surface-card)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          {level}
        </div>
      )}
    </div>
  );
}
