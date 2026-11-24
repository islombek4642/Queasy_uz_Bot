// src/components/common/MediaImage.jsx
import React, { useState, useEffect } from 'react';

const mediaMemoryCache = new Map();

export function MediaImage({ src, alt = 'Savol rasmi', style = {}, className = '' }) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    if (!src) return null;
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    return mediaMemoryCache.get(src) || null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (!src) return false;
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return false;
    }
    return !mediaMemoryCache.has(src);
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setIsLoading(false);
      return;
    }

    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      setResolvedSrc(src);
      setIsLoading(false);
      return;
    }

    if (mediaMemoryCache.has(src)) {
      setResolvedSrc(mediaMemoryCache.get(src));
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const handleSuccess = (dataUrl) => {
      if (isMounted) {
        mediaMemoryCache.set(src, dataUrl);
        setResolvedSrc(dataUrl);
        setIsLoading(false);
      }
    };

    const handleFail = () => {
      if (isMounted) {
        setIsLoading(false);
      }
    };

    // 1. Try Telegram Serverless SDK call
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.Serverless?.call) {
      window.Telegram.WebApp.Serverless.call('get_media', { fileId: src }, (err, res) => {
        if (!err && res?.success && res?.dataUrl) {
          handleSuccess(res.dataUrl);
        } else {
          // Fallback to fetch
          fetchFromApi();
        }
      });
    } else {
      fetchFromApi();
    }

    function fetchFromApi() {
      fetch('/api/get_media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: src }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.success && res?.dataUrl) {
            handleSuccess(res.dataUrl);
          } else {
            handleFail();
          }
        })
        .catch(() => {
          handleFail();
        });
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (!src) return null;

  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          minHeight: '120px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          ...style,
        }}
      >
        <span style={{ fontSize: '13px', opacity: 0.7, color: 'inherit' }}>
          🖼️ Rasm yuklanmoqda...
        </span>
      </div>
    );
  }

  if (!resolvedSrc) return null;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={{
        maxWidth: '100%',
        maxHeight: '320px',
        borderRadius: '12px',
        objectFit: 'contain',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        border: '1px solid var(--surface-border, rgba(255,255,255,0.08))',
        ...style,
      }}
    />
  );
}

export default MediaImage;

