// src/components/common/Modal.jsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { Button } from './Button.jsx';
import { useTelegram } from '../../hooks/useTelegram.js';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmText,
  cancelText,
  onConfirm,
  confirmVariant = 'primary',
  icon,
  maxWidth = '500px',
}) {
  const { haptic, backButton } = useTelegram();

  // Telegram BackButton integration & Body Scroll Lock
  useEffect(() => {
    if (!isOpen) return;
    const handleBack = () => {
      haptic.impact('light');
      if (onClose) onClose();
    };

    backButton.show(handleBack);

    // Lock body scroll when modal is active to prevent background scrolling/empty gaps
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      backButton.hide(handleBack);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, backButton, haptic]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          haptic.impact('light');
          onClose();
        }
      }}
    >
      <div
        className="glass-panel animate-pop-in"
        style={{
          width: '100%',
          maxWidth,
          minWidth: 0,
          boxSizing: 'border-box',
          maxHeight: 'min(88vh, 88dvh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--surface-border)',
            backgroundColor: 'var(--bg-primary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '8px' }}>
            {icon && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon icon={icon} width="16" height="16" />
              </div>
            )}
            <h3
              style={{
                fontSize: '0.98rem',
                fontWeight: '800',
                color: 'var(--text-primary)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={typeof title === 'string' ? title : undefined}
            >
              {title}
            </h3>
          </div>

          {/* Close button (X) */}
          <button
            onClick={() => {
              haptic.impact('light');
              if (onClose) onClose();
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}
            title="Yopish"
          >
            <Icon icon="solar:close-circle-bold" width="16" height="16" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '12px 14px',
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            boxSizing: 'border-box',
            flex: 1,
            color: 'var(--text-secondary)',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>

        {/* Footer (if cancel/confirm buttons present) */}
        {(cancelText || confirmText) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
              padding: '8px 14px',
              borderTop: '1px solid var(--surface-border)',
              backgroundColor: 'var(--bg-primary)',
              flexShrink: 0,
            }}
          >
            {cancelText && (
              <Button variant="secondary" size="sm" onClick={onClose} style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem' }}>
                {cancelText}
              </Button>
            )}
            {confirmText && (
              <Button variant={confirmVariant} size="sm" onClick={onConfirm} style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem' }}>
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
