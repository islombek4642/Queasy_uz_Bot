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
      maxWidth="520px"
    >
      {loading ? (
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="32" height="32" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Metadata badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.35', wordBreak: 'break-word', margin: 0 }}>
              {quiz.description}
            </p>
          )}

          {/* Question List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {questions.map((q, idx) => (
              <Card key={q.id || idx} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '800', color: 'var(--accent-primary)', fontSize: '0.82rem' }}>
                    #{idx + 1}
                  </span>
                  <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <MathText text={q.questionText} />
                  </div>
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                  {(q.options || []).map((opt, oIdx) => {
                    const isCorrect = q.correctOptionId === oIdx;
                    return (
                      <div
                        key={oIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                          border: isCorrect ? '1px solid var(--color-success)' : '1px solid var(--surface-border)',
                          fontSize: '0.82rem',
                          color: isCorrect ? 'var(--color-success)' : 'var(--text-secondary)',
                          fontWeight: isCorrect ? '700' : '500',
                        }}
                      >
                        <span style={{ width: '16px', fontWeight: '800' }}>
                          {isCorrect ? '✓' : String.fromCharCode(65 + oIdx)}
                        </span>
                        <MathText text={opt} />
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                    💡 {q.explanation}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Footer Action */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <Button variant="secondary" size="sm" onClick={onClose} style={{ flex: 1 }}>
              {t('BTN_EXIT')}
            </Button>
            <Button
              variant="primary"
              size="sm"
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
