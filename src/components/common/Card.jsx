// src/components/common/Card.jsx
import React from 'react';
import { useTelegram } from '../../hooks/useTelegram.js';

export function Card({
  children,
  onClick,
  interactive = false,
  glow = false,
  padding = '16px',
  className = '',
  style = {},
  ...props
}) {
  const { haptic } = useTelegram();

  const handleClick = (e) => {
    if (!interactive) return;
    haptic.impact('light');
    if (onClick) onClick(e);
  };

  return (
    <div
      onClick={handleClick}
      className={`glass-panel ${interactive ? 'glass-panel-interactive' : ''} ${glow ? 'glow-border' : ''} ${className}`}
      style={{
        padding,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
