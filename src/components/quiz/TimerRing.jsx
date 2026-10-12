// src/components/quiz/TimerRing.jsx
import React from 'react';

export function TimerRing({ timeLeft, totalTime, size = 64, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, timeLeft / (totalTime || 1)));
  const offset = circumference - fraction * circumference;

  // Color changes from green to yellow to red
  let strokeColor = 'var(--color-success)';
  if (fraction < 0.25) {
    strokeColor = 'var(--color-error)';
  } else if (fraction < 0.5) {
    strokeColor = 'var(--color-warning)';
  }

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--surface-border)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated depleting progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s ease',
          }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontFamily: 'var(--font-family-display)',
          fontSize: size <= 64 ? '1.1rem' : '1.4rem',
          fontWeight: '800',
          color: strokeColor,
        }}
      >
        {timeLeft}
      </span>
    </div>
  );
}
