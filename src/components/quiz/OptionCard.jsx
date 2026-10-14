// src/components/quiz/OptionCard.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { MathText } from './MathText.jsx';
import { useTelegram } from '../../hooks/useTelegram.js';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function OptionCard({
  index,
  text,
  isSelected,
  isCorrect,
  isWrong,
  isRevealed,
  disabled,
  onClick,
}) {
  const { haptic } = useTelegram();
  const letter = OPTION_LETTERS[index] || String(index + 1);

  const handleClick = () => {
    if (disabled || isRevealed) return;
    haptic.impact('light');
    if (onClick) onClick(index);
  };

  let backgroundColor = 'var(--surface-card)';
  let borderColor = 'var(--surface-border)';
  let letterBg = 'var(--bg-tertiary)';
  let letterColor = 'var(--text-secondary)';
  let textColor = 'var(--text-primary)';
  let icon = null;

  if (isRevealed) {
    if (isCorrect) {
      backgroundColor = 'var(--color-success-bg)';
      borderColor = 'var(--color-success)';
      letterBg = 'var(--color-success)';
      letterColor = '#ffffff';
      textColor = 'var(--color-success)';
      icon = 'solar:check-circle-bold';
    } else if (isWrong) {
      backgroundColor = 'var(--color-error-bg)';
      borderColor = 'var(--color-error)';
      letterBg = 'var(--color-error)';
      letterColor = '#ffffff';
      textColor = 'var(--color-error)';
      icon = 'solar:close-circle-bold';
    }
  } else if (isSelected) {
    backgroundColor = 'rgba(99, 102, 241, 0.15)';
    borderColor = 'var(--accent-primary)';
    letterBg = 'var(--accent-primary)';
    letterColor = '#ffffff';
  }

  return (
    <div
      onClick={handleClick}
      className="glass-panel glass-panel-interactive"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        minHeight: '54px',
        backgroundColor,
        borderColor,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: isRevealed && isCorrect ? '0 0 16px rgba(16, 185, 129, 0.3)' : 'none',
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Letter badge */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: letterBg,
          color: letterColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '800',
          fontSize: '0.9rem',
          flexShrink: 0,
          transition: 'all var(--transition-fast)',
        }}
      >
        {letter}
      </div>

      {/* Option text */}
      <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: '500', color: textColor }}>
        <MathText text={text} />
      </div>

      {/* Result indicator icon */}
      {icon && (
        <div style={{ flexShrink: 0, color: isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
          <Icon icon={icon} width="22" height="22" />
        </div>
      )}
    </div>
  );
}
