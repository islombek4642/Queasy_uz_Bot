// src/components/quiz/QuestionInspectorModal.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { fetchQuizDetail } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Card } from '../common/Card.jsx';
import { Badge } from '../common/Badge.jsx';
import { MathText } from './MathText.jsx';

export function QuestionInspectorModal({ isOpen, onClose, quizId, onStartQuiz }) {
  const { t } = useTranslation();
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !quizId) return;
    setLoading(true);
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
  const questions = quizData?.questions || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quiz?.title || t('INSPECT_QUIZ_TITLE')}
      maxWidth="560px"
    >
      {loading ? (
        <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metadata badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Badge variant="primary" icon="solar:question-circle-bold">
              {questions.length} {t('QUESTIONS_COUNT')}
            </Badge>
            <Badge variant="warning" icon="solar:clock-circle-bold">
              {quiz?.timeLimit || 30}s
            </Badge>
            {quiz?.shuffleOptions && (
              <Badge variant="neutral" icon="solar:shuffle-bold">
                {t('SHUFFLE_OPTIONS_LABEL')}
              </Badge>
            )}
          </div>

          {quiz?.description && (
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {quiz.description}
            </p>
          )}

          {/* Question List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q, idx) => (
              <Card key={q.id || idx} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '800', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                    #{idx + 1}
                  </span>
                  <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    <MathText text={q.questionText} />
                  </div>
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {(q.options || []).map((opt, oIdx) => {
                    const isCorrect = q.correctOptionId === oIdx;
                    return (
                      <div
                        key={oIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                          border: isCorrect ? '1px solid var(--color-success)' : '1px solid var(--surface-border)',
                          fontSize: '0.85rem',
                          color: isCorrect ? 'var(--color-success)' : 'var(--text-secondary)',
                          fontWeight: isCorrect ? '700' : '500',
                        }}
                      >
                        <span style={{ width: '18px', fontWeight: '800' }}>
                          {isCorrect ? '✓' : String.fromCharCode(65 + oIdx)}
                        </span>
                        <MathText text={opt} />
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                    💡 {q.explanation}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Footer Action */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>
              {t('BTN_EXIT')}
            </Button>
            <Button
              variant="primary"
              size="md"
              style={{ flex: 2 }}
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
