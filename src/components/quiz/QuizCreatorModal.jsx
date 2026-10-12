// src/components/quiz/QuizCreatorModal.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { saveCustomQuiz, updateQuiz, fetchQuizDetail } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Card } from '../common/Card.jsx';

export function QuizCreatorModal({ isOpen, onClose, onCreated, quizIdToEdit = null }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [saving, setSaving] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [questions, setQuestions] = useState([
    {
      questionText: '',
      options: ['', '', '', ''],
      correctOptionId: 0,
    },
  ]);

  // Load existing quiz if editing
  useEffect(() => {
    if (!isOpen) return;

    if (quizIdToEdit) {
      setLoadingQuiz(true);
      fetchQuizDetail(quizIdToEdit)
        .then((res) => {
          if (res && res.quiz) {
            setTitle(res.quiz.title || '');
            setDescription(res.quiz.description || '');
            setTimeLimit(res.quiz.timeLimit || 30);
            if (Array.isArray(res.questions) && res.questions.length > 0) {
              setQuestions(
                res.questions.map((q) => ({
                  questionText: q.questionText,
                  options: q.options || ['', '', '', ''],
                  correctOptionId: q.correctOptionId || 0,
                }))
              );
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load quiz to edit:', err);
        })
        .finally(() => {
          setLoadingQuiz(false);
        });
    } else {
      // Reset form
      setTitle('');
      setDescription('');
      setTimeLimit(30);
      setQuestions([
        {
          questionText: '',
          options: ['', '', '', ''],
          correctOptionId: 0,
        },
      ]);
      setErrorMessage('');
    }
  }, [isOpen, quizIdToEdit]);

  const handleAddQuestion = () => {
    haptic.selection();
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOptionId: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length <= 1) return;
    haptic.selection();
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (qIndex, text) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].questionText = text;
      return updated;
    });
  };

  const handleOptionChange = (qIndex, optIndex, text) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const newOpts = [...updated[qIndex].options];
      newOpts[optIndex] = text;
      updated[qIndex].options = newOpts;
      return updated;
    });
  };

  const handleSelectCorrect = (qIndex, optIndex) => {
    haptic.selection();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex].correctOptionId = optIndex;
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage(t('VALIDATION_FILL_FIELDS'));
      haptic.notification('error');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setErrorMessage(`${i + 1}-savol matnini kiriting`);
        haptic.notification('error');
        return;
      }
      const filledOpts = q.options.filter((o) => o.trim().length > 0);
      if (filledOpts.length < 2) {
        setErrorMessage(`${i + 1}-savol uchun kamida 2 ta variant kiriting`);
        haptic.notification('error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        timeLimit: Number(timeLimit),
        questions: questions.map((q) => ({
          questionText: q.questionText.trim(),
          options: q.options.filter((o) => o.trim().length > 0),
          correctOptionId: q.correctOptionId,
        })),
      };

      let res;
      if (quizIdToEdit) {
        payload.quizId = quizIdToEdit;
        res = await updateQuiz(payload);
      } else {
        res = await saveCustomQuiz(payload);
      }

      if (res && res.success) {
        haptic.notification('success');
        if (onCreated) onCreated(res.quizId || quizIdToEdit);
        onClose();
      } else {
        setErrorMessage(res?.error || 'Xatolik yuz berdi');
        haptic.notification('error');
      }
    } catch (err) {
      console.error('Failed to save quiz:', err);
      setErrorMessage('Server bilan bog\'lanishda xatolik');
      haptic.notification('error');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = quizIdToEdit ? t('EDIT_QUIZ_TITLE') : t('CREATE_QUIZ_TITLE');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="540px">
      {loadingQuiz ? (
        <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-error)',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* 1. Basic Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              {t('QUIZ_NAME_LABEL')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('QUIZ_NAME_PLACEHOLDER')}
              required
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border)',
                fontSize: '0.92rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              {t('QUIZ_DESC_LABEL')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('QUIZ_DESC_PLACEHOLDER')}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* Time Limit Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              {t('TIME_LIMIT_LABEL')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[15, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setTimeLimit(sec);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    backgroundColor: timeLimit === sec ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: timeLimit === sec ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--surface-border)',
                  }}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Questions list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                {t('QUESTIONS_COUNT')} ({questions.length})
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                {t('ADD_QUESTION')}
              </Button>
            </div>

            {questions.map((q, qIndex) => (
              <Card key={qIndex} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--accent-primary)' }}>
                    #{qIndex + 1} Savol
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      style={{ color: 'var(--color-error)', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width="16" height="16" />
                      <span>{t('DELETE_QUESTION')}</span>
                    </button>
                  )}
                </div>

                <textarea
                  value={q.questionText}
                  onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                  placeholder={`${t('QUESTION_TEXT_LABEL')}...`}
                  rows={2}
                  required
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--surface-border)',
                    fontSize: '0.88rem',
                    resize: 'none',
                  }}
                />

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Variantlarni kiriting va to'g'ri javobni tanlang:
                  </span>
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = q.correctOptionId === optIndex;
                    return (
                      <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectCorrect(qIndex, optIndex)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isCorrect ? 'var(--color-success)' : 'transparent',
                            border: isCorrect ? 'none' : '2px solid var(--surface-border)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            flexShrink: 0,
                          }}
                          title={t('CORRECT_ANSWER')}
                        >
                          {isCorrect ? '✓' : String.fromCharCode(65 + optIndex)}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                          placeholder={`${t('OPTION_PLACEHOLDER')} ${String.fromCharCode(65 + optIndex)}`}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: isCorrect ? '1px solid var(--color-success)' : '1px solid var(--surface-border)',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* Actions: Save & Cancel */}
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px' }}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              {t('BTN_EXIT')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              style={{ flex: 2 }}
              disabled={saving}
            >
              {saving ? t('SAVING') : t('SAVE_QUIZ_BTN')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
