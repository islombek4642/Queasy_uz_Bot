// src/components/common/Spinner.jsx
import React from 'react';

/**
 * High-performance, perfectly concentric SVG loading spinner.
 * Rotates exactly around its mathematical center (12, 12) with zero wobble.
 * Completely self-contained: works instantly even on slow networks without Iconify fetches.
 */
export function Spinner({
  size = 36,
  color = 'var(--accent-primary)',
  trackColor = 'rgba(255, 255, 255, 0.12)',
  style = {},
  className = '',
  ...props
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-spin ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        transformOrigin: '12px 12px',
        ...style,
      }}
      {...props}
    >
      {/* Background track circle */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke={trackColor}
        strokeWidth="2.5"
      />
      {/* Spinning accent arc */}
      <path
        d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
