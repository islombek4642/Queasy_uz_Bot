// src/components/common/Pagination.jsx
import React from 'react';
import { Icon } from '@iconify/react';
import { useTelegram } from '../../hooks/useTelegram.js';

export function Pagination({ currentPage, totalPages, onPageChange, style = {} }) {
  const { haptic } = useTelegram();

  if (totalPages <= 1) return null;

  const handlePageClick = (page) => {
    if (page === currentPage || page < 1 || page > totalPages) return;
    haptic.selection();
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const delta = 1;
    const range = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      range.unshift('...');
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  const pages = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px 0',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Prev button */}
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        className="glass-pill"
        style={{
          padding: '6px 10px',
          fontSize: '0.8rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: currentPage === 1 ? 0.4 : 1,
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)',
        }}
        title="Oldingi"
      >
        <Icon icon="solar:alt-arrow-left-bold" width="16" height="16" />
      </button>

      {/* Number pills */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: '4px 6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                }}
              >
                …
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={`page-${p}`}
              onClick={() => handlePageClick(p)}
              className="glass-pill"
              style={{
                minWidth: '32px',
                height: '32px',
                padding: '0 6px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                fontWeight: isActive ? '800' : '600',
                backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent-glow)' : '1px solid var(--surface-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="glass-pill"
        style={{
          padding: '6px 10px',
          fontSize: '0.8rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: currentPage === totalPages ? 0.4 : 1,
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)',
        }}
        title="Keyingi"
      >
        <Icon icon="solar:alt-arrow-right-bold" width="16" height="16" />
      </button>
    </div>
  );
}
