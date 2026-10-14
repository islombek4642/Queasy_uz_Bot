// src/components/quiz/QuestionInspectorModal.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { fetchQuizDetail } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Card } from '../common/Card.jsx';
import { Badge } from '../common/Badge.jsx';
import { MathText } from './MathText.jsx';

const PAGE_SIZE = 10;

export function QuestionInspectorModal({ isOpen, onClose, quizId, onStartQuiz }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const listTopRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !quizId) return;
    setLoading(true);
    setSearchQuery('');
    setCurrentPage(1);

    fetchQuizDetail(quizId)
      .then((res) => {
        if (res) setQuizData(res);
      })
      .catch((err) => {
        console.error('Failed to load quiz details for inspector:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, quizId]);

  const quiz = quizData?.quiz;
  const questions = useMemo(() => quizData?.questions || [], [quizData]);

  // Filter questions based on search query (text or question number like #15 or 15)
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return questions.map((q, idx) => ({ ...q, originalIndex: idx }));
    }
    const qLower = searchQuery.toLowerCase().trim();
    const numMatch = qLower.replace('#', '').trim();
    const isNum = /^\d+$/.test(numMatch);
    const targetIdx = isNum ? parseInt(numMatch, 10) - 1 : -1;

    return questions
      .map((q, idx) => ({ ...q, originalIndex: idx }))
      .filter((q) => {
        if (targetIdx >= 0 && q.originalIndex === targetIdx) return true;
        if (q.questionText?.toLowerCase().includes(qLower)) return true;
        if (Array.isArray(q.options) && q.options.some((opt) => String(opt).toLowerCase().includes(qLower))) return true;
        if (q.explanation?.toLowerCase().includes(qLower)) return true;
        return false;
      });
  }, [questions, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    haptic.selection();
    setCurrentPage(newPage);
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quiz?.title || t('INSPECT_QUIZ_TITLE')}
      maxWidth="520px"
    >
      {loading ? (
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Icon icon="line-md:loading-loop" width="32" height="32" style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('LOADING') || 'Yuklanmoqda...'}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Metadata badges & Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Badge variant="primary" icon="solar:question-circle-bold" size="sm">
                {questions.length} {t('QUESTIONS_COUNT')}
              </Badge>
              <Badge variant="warning" icon="solar:clock-circle-bold" size="sm">
                {quiz?.timeLimit || 30}s
              </Badge>
              {quiz?.shuffleOptions && (
                <Badge variant="neutral" icon="solar:shuffle-bold" size="sm">
                  {t('SHUFFLE_OPTIONS_LABEL')}
                </Badge>
              )}
            </div>

            {/* Pagination header pills if more than 1 page */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="glass-pill"
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.74rem',
                    opacity: currentPage <= 1 ? 0.35 : 1,
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Icon icon="solar:alt-arrow-left-bold" width="12" height="12" />
                </button>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="glass-pill"
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.74rem',
                    opacity: currentPage >= totalPages ? 0.35 : 1,
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Icon icon="solar:alt-arrow-right-bold" width="12" height="12" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '4px 8px',
              gap: '6px',
            }}
          >
            <Icon icon="solar:magnifer-bold" width="14" height="14" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('INSPECT_SEARCH_PLACEHOLDER') || 'Savollardan qidirish...'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <Icon icon="solar:close-circle-bold" width="14" height="14" />
              </button>
            )}
          </div>

          <div ref={listTopRef} />

          {/* Questions List */}
          {currentQuestions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {t('NO_QUESTIONS_FOUND') || 'Savollar topilmadi'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {currentQuestions.map((q) => (
                <Card
                  key={q.id || q.originalIndex}
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    border: '1px solid var(--surface-border)',
                  }}
                >
                  {/* Question header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--accent-primary)',
                        fontWeight: '800',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      #{q.originalIndex + 1}
                    </span>
                    <div style={{ fontWeight: '700', fontSize: '0.82rem', lineHeight: '1.35', color: 'var(--text-primary)' }}>
                      <MathText text={q.questionText} />
                    </div>
                  </div>

                  {/* Options: Compact 2-column grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '4px',
                      marginTop: '2px',
                    }}
                  >
                    {(q.options || []).map((opt, oIdx) => {
                      const isCorrect = q.correctOptionId === oIdx;
                      const letter = String.fromCharCode(65 + oIdx);
                      return (
                        <div
                          key={oIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                            border: isCorrect ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--surface-border)',
                            fontSize: '0.75rem',
                            color: isCorrect ? 'var(--color-success)' : 'var(--text-secondary)',
                            fontWeight: isCorrect ? '700' : '500',
                            lineHeight: '1.2',
                          }}
                        >
                          <span
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              backgroundColor: isCorrect ? 'var(--color-success)' : 'rgba(255, 255, 255, 0.08)',
                              color: isCorrect ? '#fff' : 'var(--text-muted)',
                              fontSize: '0.65rem',
                              fontWeight: '800',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isCorrect ? '✓' : letter}
                          </span>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            <MathText text={opt} />
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px', lineHeight: '1.25' }}>
                      💡 {q.explanation}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Pagination Controls below list */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingTop: '4px' }}>
              <Button
                variant="glass"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                icon="solar:alt-arrow-left-bold"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredQuestions.length)} / {filteredQuestions.length}
              </span>
              <Button
                variant="glass"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                icon="solar:alt-arrow-right-bold"
              />
            </div>
          )}

          {/* Footer Action */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <Button variant="secondary" size="sm" onClick={onClose} style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}>
              {t('BTN_EXIT')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              style={{ flex: 2, padding: '8px 12px', fontSize: '0.82rem' }}
              icon="solar:play-bold"
              onClick={() => {
                onClose();
                if (onStartQuiz) onStartQuiz(quizId);
              }}
            >
              {t('BTN_START_QUIZ')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
