// src/components/common/Badge.jsx
import React from 'react';
import { Icon } from '@iconify/react';

export function Badge({
  children,
  icon,
  variant = 'default', // 'default', 'success', 'warning', 'error', 'primary'
  size = 'md', // 'sm', 'md'
  className = '',
}) {
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--accent-primary)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
        };
      case 'success':
        return {
          background: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          borderColor: 'var(--color-success-border)',
        };
      case 'warning':
        return {
          background: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
        };
      case 'error':
        return {
          background: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          borderColor: 'var(--color-error-border)',
        };
      case 'default':
      default:
        return {
          background: 'var(--surface-card)',
          color: 'var(--text-secondary)',
          borderColor: 'var(--surface-border)',
        };
    }
  };

  const colors = getColors();

  return (
    <span
      className={`glass-pill ${className}`}
      style={{
        ...colors,
        border: `1px solid ${colors.borderColor}`,
        padding: size === 'sm' ? '3px 8px' : '5px 12px',
        fontSize: size === 'sm' ? '0.75rem' : '0.85rem',
      }}
    >
      {icon && <Icon icon={icon} width={size === 'sm' ? '14' : '16'} height={size === 'sm' ? '14' : '16'} />}
      <span>{children}</span>
    </span>
  );
}
