// src/components/quiz/KiutExplorerModal.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { fetchKiutCatalog } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Card } from '../common/Card.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export function KiutExplorerModal({ isOpen, onClose, onStartQuiz }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState({ categories: [], subcategories: [], quizzes: [], totalQuizzes: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedQuizId, setExpandedQuizId] = useState(null);

  const loadCatalog = (path = '', search = '') => {
    setLoading(true);
    fetchKiutCatalog(path, search)
      .then((res) => {
        if (res) setData(res);
      })
      .catch((err) => {
        console.error('Failed to load KIUT catalog:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog(currentPath, searchQuery);
    }
  }, [isOpen, currentPath]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length >= 2) {
      loadCatalog('', val.trim());
    } else if (val.trim().length === 0) {
      loadCatalog(currentPath, '');
    }
  };

  const handleCategoryClick = (subcat) => {
    haptic.selection();
    setSearchQuery('');
    setCurrentPath(subcat.fullPath);
  };

  const handleBreadcrumbClick = (targetPath) => {
    haptic.selection();
    setSearchQuery('');
    setCurrentPath(targetPath);
  };

  const handleBackOneLevel = () => {
    haptic.selection();
    setSearchQuery('');
    if (!currentPath) return;
    const parts = currentPath.split(' / ');
    parts.pop();
    setCurrentPath(parts.join(' / '));
  };

  const pathParts = currentPath ? currentPath.split(' / ') : [];

  const getCategoryIcon = (name) => {
    if (name.includes('KUNDUZGI') && name.includes('TIBBIYOT')) return 'solar:health-bold-duotone';
    if (name.includes('KUNDUZGI')) return 'solar:sun-2-bold-duotone';
    if (name.includes('SIRTQI')) return 'solar:book-bookmark-bold-duotone';
    if (name.includes('KECHKI')) return 'solar:moon-stars-bold-duotone';
    if (name.includes('MASOFAVIY')) return 'solar:laptop-bold-duotone';
    if (name.includes('FARQI')) return 'solar:refresh-bold-duotone';
    if (name.includes('SEMESTR')) return 'solar:calendar-bold-duotone';
    return 'solar:folder-bold-duotone';
  };

  const getCategoryColor = (name) => {
    if (name.includes('KUNDUZGI') && name.includes('TIBBIYOT')) return '#ef4444';
    if (name.includes('KUNDUZGI')) return '#f59e0b';
    if (name.includes('SIRTQI')) return '#3b82f6';
    if (name.includes('KECHKI')) return '#8b5cf6';
    if (name.includes('MASOFAVIY')) return '#10b981';
    if (name.includes('FARQI')) return '#ec4899';
    return '#6366f1';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('KIUT_EXPLORER_TITLE')}
      icon="solar:diploma-verified-bold-duotone"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '2px' }}>
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icon icon="solar:magnifer-bold" width="18" height="18" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t('KIUT_SEARCH_PLACEHOLDER')}
            className="glass-panel"
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                loadCatalog(currentPath, '');
              }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Icon icon="solar:close-circle-bold" width="16" height="16" />
            </button>
          )}
        </div>

        {/* Breadcrumb Navigation (when not searching) */}
        {!searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <button
              onClick={() => handleBreadcrumbClick('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: currentPath ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: currentPath ? '600' : '800',
              }}
            >
              <Icon icon="solar:home-smile-bold" width="15" height="15" />
              <span>{t('KIUT_BREADCRUMB_ROOT')}</span>
            </button>

            {pathParts.map((part, index) => {
              const fullTillHere = pathParts.slice(0, index + 1).join(' / ');
              const isLast = index === pathParts.length - 1;
              return (
                <React.Fragment key={fullTillHere}>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <button
                    onClick={() => handleBreadcrumbClick(fullTillHere)}
                    style={{
                      color: isLast ? 'var(--text-primary)' : 'var(--accent-primary)',
                      fontWeight: isLast ? '800' : '600',
                      maxWidth: '140px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={part}
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}

            {currentPath && (
              <button
                onClick={handleBackOneLevel}
                className="glass-pill"
                style={{
                  marginLeft: 'auto',
                  padding: '4px 8px',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Icon icon="solar:arrow-left-bold" width="12" height="12" />
                <span>{t('BTN_BACK')}</span>
              </button>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Icon icon="line-md:loading-loop" width="32" height="32" style={{ color: 'var(--accent-primary)' }} />
          </div>
        )}

        {/* Root Categories Grid */}
        {!loading && !searchQuery && !currentPath && data.categories && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.categories.map((cat) => {
              const icon = getCategoryIcon(cat.name);
              const color = getCategoryColor(cat.name);
              return (
                <div
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat)}
                  className="glass-panel-interactive"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: `${color}20`,
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon icon={icon} width="22" height="22" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {cat.count} {t('KIUT_TOTAL_AVAILABLE')}
                      </div>
                    </div>
                  </div>
                  <Icon icon="solar:arrow-right-linear" width="18" height="18" style={{ color: 'var(--text-muted)' }} />
                </div>
              );
            })}
          </div>
        )}

        {/* Subcategories List (when inside a folder) */}
        {!loading && !searchQuery && currentPath && data.subcategories && data.subcategories.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.subcategories.map((subcat) => {
              const icon = getCategoryIcon(subcat.name);
              const color = getCategoryColor(subcat.name);
              return (
                <div
                  key={subcat.name}
                  onClick={() => handleCategoryClick(subcat)}
                  className="glass-panel-interactive"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon icon={icon} width="20" height="20" style={{ color }} />
                    <span style={{ fontWeight: '700', fontSize: '0.86rem' }}>{subcat.name}</span>
                  </div>
                  <Badge size="sm">{subcat.count}</Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Quizzes List (leaf directory or search results) */}
        {!loading && data.quizzes && data.quizzes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {data.quizzes.map((quiz) => {
              const isExpanded = expandedQuizId === quiz.id;
              return (
                <Card
                  key={quiz.id}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div
                      onClick={() => {
                        haptic.selection();
                        setExpandedQuizId(isExpanded ? null : quiz.id);
                      }}
                      style={{
                        fontWeight: '800',
                        fontSize: '0.96rem',
                        color: 'var(--text-primary)',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        lineHeight: '1.35',
                      }}
                      title={quiz.title}
                    >
                      {quiz.title}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Badge size="sm">{quiz.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                    <Badge size="sm" variant="warning">{quiz.timeLimit}s</Badge>
                  </div>

                  {/* Action Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--surface-border)',
                      marginTop: '2px',
                      gap: '8px',
                    }}
                  >
                    <Button
                      size="sm"
                      variant="primary"
                      icon="solar:play-bold"
                      style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                      onClick={() => {
                        haptic.impact('medium');
                        onClose();
                        onStartQuiz(quiz.id);
                      }}
                    >
                      {t('BTN_START_QUIZ')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          (!data.categories || data.categories.length === 0) &&
          (!data.subcategories || data.subcategories.length === 0) &&
          (!data.quizzes || data.quizzes.length === 0) && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <Icon icon="solar:folder-open-bold-duotone" width="40" height="40" style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '0.85rem' }}>{t('KIUT_NO_TESTS_FOUND')}</p>
            </div>
          )}
      </div>
    </Modal>
  );
}
