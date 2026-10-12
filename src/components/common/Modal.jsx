// src/components/common/Modal.jsx
import React, { useEffect } from 'react';
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

  // Telegram BackButton integration
  useEffect(() => {
    if (!isOpen) return;
    const handleBack = () => {
      haptic.impact('light');
      if (onClose) onClose();
    };

    backButton.show(handleBack);
    return () => {
      backButton.hide(handleBack);
    };
  }, [isOpen, onClose, backButton, haptic]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
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
          maxHeight: '88vh',
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
            padding: '16px 20px',
            borderBottom: '1px solid var(--surface-border)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={icon} width="22" height="22" />
              </div>
            )}
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
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
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            title="Yopish"
          >
            <Icon icon="solar:close-circle-bold" width="22" height="22" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, color: 'var(--text-secondary)' }}>
          {children}
        </div>

        {/* Footer (if cancel/confirm buttons present) */}
        {(cancelText || confirmText) && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              padding: '14px 20px',
              borderTop: '1px solid var(--surface-border)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            {cancelText && (
              <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                {cancelText}
              </Button>
            )}
            {confirmText && (
              <Button variant={confirmVariant} onClick={onConfirm} style={{ flex: 1 }}>
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
