// src/components/quiz/ProgressBar.jsx
import React from 'react';

export function ProgressBar({ current, total }) {
  const percentage = Math.min(100, Math.max(0, ((current) / (total || 1)) * 100));

  return (
    <div
      style={{
        width: '100%',
        height: '6px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percentage}%`,
          height: '100%',
          background: 'var(--accent-gradient)',
          borderRadius: 'var(--radius-full)',
          transition: 'width var(--transition-bounce)',
        }}
      />
    </div>
  );
}
