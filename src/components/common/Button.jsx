// src/components/common/Button.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { useTelegram } from '../../hooks/useTelegram.js';
import { Spinner } from './Spinner.jsx';

export function Button({
  children,
  onClick,
  variant = 'primary', // 'primary', 'secondary', 'glass', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) {
  const { haptic } = useTelegram();

  const handleClick = (e) => {
    if (disabled || loading) return;
    haptic.impact('light');
    if (onClick) onClick(e);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--accent-gradient)',
          color: '#ffffff',
          boxShadow: 'var(--shadow-accent)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--surface-border)',
        };
      case 'danger':
        return {
          background: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          border: '1px solid var(--color-error-border)',
        };
      case 'glass':
      default:
        return {
          background: 'var(--surface-card)',
          backdropFilter: 'blur(12px)',
          color: 'var(--text-primary)',
          border: '1px solid var(--surface-border)',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '8px 14px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' };
      case 'lg':
        return { padding: '16px 24px', fontSize: '1.05rem', borderRadius: 'var(--radius-lg)' };
      case 'md':
      default:
        return { padding: '12px 20px', fontSize: '0.95rem', borderRadius: 'var(--radius-md)' };
    }
  };

  const { style = {}, ...restProps } = props;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 20;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size === 'sm' ? '6px' : '8px',
        fontWeight: '700',
        width: fullWidth ? '100%' : 'auto',
        boxSizing: 'border-box',
        minWidth: 0,
        maxWidth: '100%',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all var(--transition-fast)',
        ...style,
      }}
      className={`glass-panel-interactive ${className}`}
      {...restProps}
    >
      {loading ? (
        <Spinner size={iconSize} color="currentColor" />
      ) : (
        <>
          {icon && <Icon icon={icon} width={iconSize} height={iconSize} style={{ flexShrink: 0 }} />}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: style?.whiteSpace || 'nowrap',
              maxWidth: '100%',
              minWidth: 0,
              textAlign: 'center',
              lineHeight: style?.lineHeight || 'inherit',
            }}
          >
            {children}
          </span>
          {iconRight && <Icon icon={iconRight} width={iconSize} height={iconSize} style={{ flexShrink: 0 }} />}
        </>
      )}

    </button>
  );
}
