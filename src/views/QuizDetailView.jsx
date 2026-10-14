// src/views/QuizDetailView.jsx
// Dedicated full-page view for inspecting a quiz's questions, options, and metadata
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { fetchQuizDetail } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { MathText } from '../components/quiz/MathText.jsx';

export function QuizDetailView({ quizId, onBack }) {
  const { t } = useTranslation();
  const { haptic, backButton } = useTelegram();

  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Telegram native BackButton integration
  useEffect(() => {
    const handleTgBack = () => {
      haptic.selection();
      if (onBack) onBack();
    };

    backButton.show(handleTgBack);
    return () => {
      backButton.hide(handleTgBack);
    };
  }, [backButton, haptic, onBack]);

  // Load quiz details
  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    fetchQuizDetail(quizId)
      .then((res) => {
        if (res) setQuizData(res);
      })
      .catch((err) => {
        console.error('Failed to load quiz details for QuizDetailView:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [quizId]);

  const quiz = quizData?.quiz;
  const questions = quizData?.questions || [];
  const totalPages = Math.ceil(questions.length / pageSize);

  // Paginated slice
  const startIndex = (currentPage - 1) * pageSize;
  const currentQuestions = questions.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '12px',
        }}
        className="animate-fade-in"
      >
        <Icon icon="line-md:loading-loop" width="40" height="40" style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{t('LOADING_APP')}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '720px',
        margin: '0 auto',
      }}
      className="animate-fade-in"
    >
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          onClick={() => {
            haptic.selection();
            if (onBack) onBack();
          }}
          className="glass-pill"
          style={{
            padding: '6px 12px',
            fontSize: '0.82rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <Icon icon="solar:arrow-left-bold" width="16" height="16" />
          <span>{t('BTN_EXIT')}</span>
        </button>

      </div>

      {/* Quiz Overview Card */}
      <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: '800',
            color: 'var(--text-primary)',
            lineHeight: '1.35',
            wordBreak: 'break-word',
            margin: 0,
          }}
        >
          {quiz?.title || t('INSPECT_QUIZ_TITLE')}
        </h1>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
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

        {quiz?.description && (
          <p
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4',
              wordBreak: 'break-word',
              margin: '4px 0 0 0',
              paddingTop: '8px',
              borderTop: '1px solid var(--surface-border)',
            }}
          >
            {quiz.description}
          </p>
        )}
      </Card>

      {/* Questions Section Header & Range indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          {t('QUESTIONS_COUNT')}: {questions.length} ta
        </h3>
        {questions.length > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {startIndex + 1}–{Math.min(startIndex + pageSize, questions.length)} / {questions.length}
          </span>
        )}
      </div>

      {/* Top Pagination (if multiple pages) */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          style={{ padding: '0' }}
        />
      )}

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentQuestions.map((q, localIdx) => {
          const globalIdx = startIndex + localIdx;
          return (
            <Card
              key={q.id || globalIdx}
              style={{
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Question Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span
                  style={{
                    fontWeight: '800',
                    color: 'var(--accent-primary)',
                    fontSize: '0.86rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    flexShrink: 0,
                  }}
                >
                  #{globalIdx + 1}
                </span>

                <div
                  style={{
                    fontWeight: '700',
                    fontSize: '0.92rem',
                    color: 'var(--text-primary)',
                    lineHeight: '1.45',
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  <MathText text={q.questionText} />
                </div>
              </div>

              {/* Options List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {(q.options || []).map((opt, oIdx) => {
                  const isCorrect = q.correctOptionId === oIdx;
                  const letter = String.fromCharCode(65 + oIdx);
                  return (
                    <div
                      key={oIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                        border: isCorrect ? '1.5px solid var(--color-success)' : '1px solid var(--surface-border)',
                        fontSize: '0.86rem',
                        color: isCorrect ? 'var(--color-success)' : 'var(--text-primary)',
                        fontWeight: isCorrect ? '700' : '500',
                        transition: 'all var(--transition-fast)',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '0.76rem',
                          backgroundColor: isCorrect ? 'var(--color-success)' : 'rgba(255, 255, 255, 0.08)',
                          color: isCorrect ? '#fff' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {isCorrect ? '✓' : letter}
                      </span>
                      <div style={{ flex: 1 }}>
                        <MathText text={typeof opt === 'object' ? opt.text : String(opt)} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanation (if any) */}
              {q.explanation && (
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Icon icon="solar:lightbulb-bold" width="16" height="16" style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                  <span>{q.explanation}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}


    </div>
  );
}
