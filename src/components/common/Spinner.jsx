// src/components/common/Spinner.jsx
import React from 'react';
import { Icon } from '@iconify/react';

/**
 * Premium Iconify Spinner component.
 * Uses the trending 'line-md:loading-twotone-loop' from Iconify for sleek, balanced two-tone micro-animated loading.
 */
export function Spinner({
  size = 36,
  color = 'var(--accent-primary)',
  icon = 'line-md:loading-twotone-loop',
  style = {},
  className = '',
  ...props
}) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        lineHeight: 1,
        verticalAlign: 'middle',
        ...style,
      }}
      {...props}
    >
      <Icon
        icon={icon}
        width={size}
        height={size}
        style={{
          display: 'block',
          flexShrink: 0,
        }}
      />
    </div>
  );
}
