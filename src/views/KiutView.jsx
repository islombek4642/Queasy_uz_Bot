// src/views/KiutView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchKiutCatalog, cloneQuiz } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';

export function KiutView({ onBack, onStartQuiz, myQuizzes = [], onQuizSaved }) {
  const { t } = useTranslation();
  const { haptic, backButton } = useTelegram();

  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState({ categories: [], subcategories: [], quizzes: [], totalQuizzes: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [savingQuizId, setSavingQuizId] = useState(null);
  const [savedQuizIds, setSavedQuizIds] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);

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
    loadCatalog(currentPath, searchQuery);
  }, [currentPath]);

  // Handle Telegram native back button
  useEffect(() => {
    const handleTgBack = () => {
      haptic.selection();
      if (searchQuery) {
        setSearchQuery('');
        loadCatalog(currentPath, '');
      } else if (currentPath) {
        const parts = currentPath.split(' / ');
        parts.pop();
        setCurrentPath(parts.join(' / '));
      } else if (onBack) {
        onBack();
      }
    };

    backButton.show(handleTgBack);
    return () => {
      backButton.hide(handleTgBack);
    };
  }, [currentPath, searchQuery, onBack]);

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

  const isQuizSaved = (quiz) => {
    if (savedQuizIds.has(quiz.id)) return true;
    if (myQuizzes && myQuizzes.some((mq) => mq.title === quiz.title || mq.id === quiz.id)) {
      return true;
    }
    return false;
  };

  const handleSaveQuiz = async (quiz) => {
    if (savingQuizId || isQuizSaved(quiz)) return;
    haptic.impact('medium');
    setSavingQuizId(quiz.id);

    try {
      const res = await cloneQuiz(quiz.id);
      if (res && res.success) {
        haptic.notification('success');
        setSavedQuizIds((prev) => new Set([...prev, quiz.id]));
        if (onQuizSaved) onQuizSaved();
        setToastMessage({ text: t('TOAST_QUIZ_SAVED'), type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        haptic.notification('error');
        setToastMessage({ text: res?.error || t('ERROR_GENERIC'), type: 'error' });
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to save quiz:', err);
      haptic.notification('error');
      setToastMessage({ text: err?.message || t('ERROR_SERVER_CONNECTION'), type: 'error' });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setSavingQuizId(null);
    }
  };

  const handleBackOneLevel = () => {
    haptic.selection();
    setSearchQuery('');
    if (!currentPath) {
      if (onBack) onBack();
      return;
    }
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
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {currentPath && (
            <button
              onClick={handleBackOneLevel}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                background: 'var(--surface-card, #161c2a)',
                border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                flexShrink: 0,
              }}
            >
              <Icon icon="solar:arrow-left-bold" width="18" height="18" />
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', lineHeight: '1.3' }}>
              {currentPath ? pathParts[pathParts.length - 1] : t('KIUT_EXPLORER_TITLE')}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
              {currentPath ? t('KIUT_TEST_TITLE') : t('KIUT_TEST_SUBTITLE')}
            </div>
          </div>
        </div>

        {data.totalQuizzes > 0 && !currentPath && (
          <Badge variant="primary" size="md" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {data.totalQuizzes} {t('KIUT_TOTAL_AVAILABLE')}
          </Badge>
        )}
      </div>

      {/* Toast Notification for Saving Quiz */}
      {toastMessage && (
        <div
          className="animate-pop-in"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm, 10px)',
            backgroundColor: toastMessage.type === 'error' ? 'var(--color-error-bg, rgba(239, 68, 68, 0.15))' : 'var(--color-success-bg, rgba(16, 185, 129, 0.15))',
            color: toastMessage.type === 'error' ? 'var(--color-error, #ef4444)' : 'var(--color-success, #10b981)',
            border: toastMessage.type === 'error' ? '1px solid var(--color-error-border, rgba(239, 68, 68, 0.3))' : '1px solid var(--color-success-border, rgba(16, 185, 129, 0.3))',
            fontSize: '0.85rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon icon={toastMessage.type === 'error' ? "solar:danger-triangle-bold" : "solar:check-circle-bold"} width="18" height="18" />
          <span>{toastMessage.text || toastMessage}</span>
        </div>
      )}

      {/* Full-width High-Contrast Search Input */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchQuery ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Icon icon="solar:magnifer-bold" width="20" height="20" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('KIUT_SEARCH_PLACEHOLDER')}
          style={{
            width: '100%',
            padding: '13px 40px 13px 44px',
            fontSize: '0.92rem',
            fontWeight: '500',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md, 14px)',
            outline: 'none',
            boxSizing: 'border-box',
            border: '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.15))',
            backgroundColor: 'var(--surface-card, #161c2a)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-primary, #6366f1)';
            e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--surface-border, rgba(255, 255, 255, 0.15))';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
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
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Icon icon="solar:close-circle-bold" width="16" height="16" />
          </button>
        )}
      </div>

      {/* Spacious Breadcrumb Navigation */}
      {!searchQuery && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            fontSize: '0.82rem',
            padding: '6px 2px',
          }}
        >
          <button
            onClick={() => handleBreadcrumbClick('')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: currentPath ? 'var(--accent-primary)' : 'var(--text-primary)',
              fontWeight: currentPath ? '600' : '800',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            <Icon icon="solar:home-smile-bold" width="16" height="16" />
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
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                  title={part}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      )}

      {/* Root Categories (6 Study Modes) */}
      {!loading && !searchQuery && !currentPath && data.categories && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.categories.map((cat) => {
            const icon = getCategoryIcon(cat.name);
            const color = getCategoryColor(cat.name);
            return (
              <Card
                key={cat.name}
                interactive
                onClick={() => handleCategoryClick(cat)}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `${color}20`,
                      color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={icon} width="24" height="24" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: '800',
                        fontSize: '0.95rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={cat.name}
                    >
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cat.count} {t('KIUT_TOTAL_AVAILABLE')}
                    </div>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-linear" width="20" height="20" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Card>
            );
          })}
        </div>
      )}

      {/* Subcategories (Directions, Semesters, etc.) */}
      {!loading && !searchQuery && currentPath && data.subcategories && data.subcategories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.subcategories.map((subcat) => {
            const icon = getCategoryIcon(subcat.name);
            const color = getCategoryColor(subcat.name);
            return (
              <Card
                key={subcat.name}
                interactive
                onClick={() => handleCategoryClick(subcat)}
                style={{
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <Icon icon={icon} width="22" height="22" style={{ color, flexShrink: 0 }} />
                  <span
                    style={{
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {subcat.name}
                  </span>
                </div>
                <Badge size="md" variant="neutral">{subcat.count}</Badge>
              </Card>
            );
          })}
        </div>
      )}

      {/* Direct Quizzes (inside semester or search results) */}
      {!loading && data.quizzes && data.quizzes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      lineHeight: '1.35',
                      cursor: 'pointer',
                      whiteSpace: isExpanded ? 'normal' : 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={quiz.title}
                  >
                    {quiz.title}
                  </div>

                  {searchQuery && quiz.category && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        haptic.selection();
                        setExpandedQuizId(isExpanded ? null : quiz.id);
                      }}
                    >
                      📍 {quiz.category}
                    </div>
                  )}
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
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--surface-border)',
                    marginTop: '2px',
                    gap: '8px',
                  }}
                >
                  <Button
                    size="sm"
                    variant={isQuizSaved(quiz) ? "outline" : "secondary"}
                    icon={isQuizSaved(quiz) ? "solar:check-circle-bold" : "solar:bookmark-square-bold"}
                    disabled={isQuizSaved(quiz) || savingQuizId === quiz.id}
                    loading={savingQuizId === quiz.id}
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.82rem',
                      ...(isQuizSaved(quiz)
                        ? {
                            color: 'var(--color-success)',
                            borderColor: 'var(--color-success-border, rgba(16, 185, 129, 0.4))',
                            backgroundColor: 'var(--color-success-bg, rgba(16, 185, 129, 0.12))',
                          }
                        : {}),
                    }}
                    onClick={() => handleSaveQuiz(quiz)}
                  >
                    {isQuizSaved(quiz) ? t('BTN_SAVED_QUIZ') : t('BTN_SAVE_QUIZ')}
                  </Button>

                  <Button
                    size="sm"
                    variant="primary"
                    icon="solar:play-bold"
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    onClick={() => {
                      haptic.impact('medium');
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
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <Icon icon="solar:folder-open-bold-duotone" width="48" height="48" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '0.9rem' }}>{t('KIUT_NO_TESTS_FOUND')}</p>
          </div>
        )}
    </div>
  );
}

export default KiutView;
