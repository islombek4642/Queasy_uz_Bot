// src/views/QuizCreatorView.jsx
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { saveCustomQuiz, updateQuiz, fetchQuizDetail } from '../services/quizService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Pagination } from '../components/common/Pagination.jsx';

export function QuizCreatorView({ onBack, onCreated, quizIdToEdit = null }) {
  const { t } = useTranslation();
  const { haptic, backButton } = useTelegram();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [saving, setSaving] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [questions, setQuestions] = useState([
    {
      questionText: '',
      options: ['', '', '', ''],
      correctOptionId: 0,
    },
  ]);

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

  // Load existing quiz if editing
  useEffect(() => {
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
                  questionText: q.questionText || '',
                  options: (q.options && q.options.length >= 2) ? q.options : ['', '', '', ''],
                  correctOptionId: q.correctOptionId || 0,
                }))
              );
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load quiz to edit:', err);
          setErrorMessage(t('ERROR_SERVER_CONNECTION'));
        })
        .finally(() => {
          setLoadingQuiz(false);
        });
    } else {
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
  }, [quizIdToEdit]);

  const handleAddQuestion = () => {
    haptic.selection();
    setQuestions((prev) => {
      const next = [
        ...prev,
        {
          questionText: '',
          options: ['', '', '', ''],
          correctOptionId: 0,
        },
      ];
      const newTotal = Math.ceil(next.length / pageSize);
      setCurrentPage(newTotal);
      return next;
    });
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length <= 1) return;
    haptic.selection();
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const newTotal = Math.ceil(next.length / pageSize);
      if (currentPage > newTotal) {
        setCurrentPage(Math.max(1, newTotal));
      }
      return next;
    });
  };

  const handleQuestionTextChange = (qIndex, text) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], questionText: text };
      return updated;
    });
  };

  const handleOptionChange = (qIndex, optIndex, text) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const newOpts = [...updated[qIndex].options];
      newOpts[optIndex] = text;
      updated[qIndex] = { ...updated[qIndex], options: newOpts };
      return updated;
    });
  };

  const handleSelectCorrect = (qIndex, optIndex) => {
    haptic.selection();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], correctOptionId: optIndex };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage(t('VALIDATION_FILL_FIELDS'));
      haptic.notification('error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setErrorMessage(t('ERROR_QUESTION_EMPTY', { num: i + 1 }));
        haptic.notification('error');
        return;
      }
      const filledOpts = q.options.filter((o) => o && o.trim().length > 0);
      if (filledOpts.length < 2) {
        setErrorMessage(t('ERROR_OPTIONS_MIN', { num: i + 1 }));
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
          options: q.options.filter((o) => o && o.trim().length > 0),
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
        if (onCreated) {
          onCreated(res.quizId || quizIdToEdit);
        } else if (onBack) {
          onBack();
        }
      } else {
        setErrorMessage(res?.error || t('ERROR_GENERIC'));
        haptic.notification('error');
      }
    } catch (err) {
      console.error('Failed to save quiz:', err);
      setErrorMessage(t('ERROR_SERVER_CONNECTION'));
      haptic.notification('error');
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = quizIdToEdit ? t('EDIT_QUIZ_TITLE') : t('CREATE_QUIZ_TITLE');
  const totalPages = Math.ceil(questions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentQuestions = questions.slice(startIndex, startIndex + pageSize);

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '680px',
        margin: '0 auto',
      }}
      className="animate-fade-in"
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button
            type="button"
            onClick={() => {
              haptic.selection();
              if (onBack) onBack();
            }}
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
            aria-label={t('BTN_BACK')}
          >
            <Icon icon="solar:arrow-left-bold" width="18" height="18" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', lineHeight: '1.3' }}>
              {pageTitle}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
              {t('CREATE_QUIZ_SUBTITLE')}
            </div>
          </div>
        </div>

        <Badge variant="primary" size="md" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {questions.length} {t('QUESTIONS_COUNT').toLowerCase()}
        </Badge>
      </div>

      {loadingQuiz ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Icon icon="line-md:loading-loop" width="40" height="40" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm, 10px)',
                backgroundColor: 'var(--color-error-bg, rgba(239, 68, 68, 0.15))',
                color: 'var(--color-error, #ef4444)',
                fontSize: '0.86rem',
                fontWeight: '600',
                border: '1px solid var(--color-error-border, rgba(239, 68, 68, 0.3))',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icon icon="solar:danger-triangle-bold" width="20" height="20" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{errorMessage}</span>
            </div>
          )}

          {/* 1. Basic Info Card */}
          <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--surface-border)', paddingBottom: '10px' }}>
              <Icon icon="solar:pen-new-square-bold" width="20" height="20" style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {t('QUIZ_NAME_LABEL')}
              </span>
            </div>

            {/* Quiz Title */}
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
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 14px)',
                  backgroundColor: 'var(--surface-card, #161c2a)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-primary, #6366f1)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--surface-border, rgba(255, 255, 255, 0.12))';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Quiz Description */}
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
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-md, 14px)',
                  backgroundColor: 'var(--surface-card, #161c2a)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-primary, #6366f1)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--surface-border, rgba(255, 255, 255, 0.12))';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Time Limit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                {t('TIME_LIMIT_LABEL')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[10, 15, 30, 45, 60, 120].map((sec) => {
                  const isActive = timeLimit === sec;
                  const label = sec >= 60 ? `${sec}s (${sec / 60}m)` : `${sec}s`;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        setTimeLimit(sec);
                      }}
                      style={{
                        padding: '9px 4px',
                        borderRadius: 'var(--radius-sm, 10px)',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        backgroundColor: isActive ? 'var(--accent-primary, #6366f1)' : 'var(--surface-card, #161c2a)',
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                        border: isActive ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                        boxShadow: isActive ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* 2. Questions Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon icon="solar:question-circle-bold" width="22" height="22" style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {t('QUESTIONS_COUNT')} ({questions.length})
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion} icon="solar:add-circle-bold">
                {t('ADD_QUESTION')}
              </Button>
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
              />
            )}

            {currentQuestions.map((q, localIdx) => {
              const qIndex = startIndex + localIdx;
              return (
              <Card
                key={qIndex}
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                {/* Question Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                      }}
                    >
                      {qIndex + 1}
                    </div>
                    <span style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {t('QUESTION_CARD_TITLE', { num: qIndex + 1 })}
                    </span>
                  </div>

                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      style={{
                        color: 'var(--color-error, #ef4444)',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '5px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width="16" height="16" />
                      <span>{t('DELETE_QUESTION')}</span>
                    </button>
                  )}
                </div>

                {/* Question Textarea */}
                <textarea
                  value={q.questionText}
                  onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                  placeholder={`${t('QUESTION_TEXT_LABEL')}...`}
                  rows={2}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm, 10px)',
                    backgroundColor: 'var(--surface-card, #161c2a)',
                    color: 'var(--text-primary)',
                    border: '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-primary, #6366f1)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--surface-border, rgba(255, 255, 255, 0.12))';
                    e.target.style.boxShadow = 'none';
                  }}
                />

                {/* Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {t('QUIZ_OPTIONS_HINT')}
                  </span>
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = q.correctOptionId === optIndex;
                    const letter = String.fromCharCode(65 + optIndex);
                    return (
                      <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectCorrect(qIndex, optIndex)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: isCorrect ? 'var(--color-success, #10b981)' : 'var(--surface-card, #161c2a)',
                            border: isCorrect ? '2px solid var(--color-success, #10b981)' : '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.15))',
                            color: isCorrect ? '#ffffff' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.82rem',
                            fontWeight: '800',
                            flexShrink: 0,
                            cursor: 'pointer',
                            boxShadow: isCorrect ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                          title={t('CORRECT_ANSWER')}
                        >
                          {isCorrect ? '✓' : letter}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                          placeholder={`${t('OPTION_PLACEHOLDER')} ${letter}`}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm, 10px)',
                            backgroundColor: 'var(--surface-card, #161c2a)',
                            color: 'var(--text-primary)',
                            border: isCorrect ? '1.5px solid var(--color-success, #10b981)' : '1.5px solid var(--surface-border, rgba(255, 255, 255, 0.12))',
                            fontSize: '0.88rem',
                            outline: 'none',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                          }}
                          onFocus={(e) => {
                            if (!isCorrect) {
                              e.target.style.borderColor = 'var(--accent-primary, #6366f1)';
                              e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
                            }
                          }}
                          onBlur={(e) => {
                            if (!isCorrect) {
                              e.target.style.borderColor = 'var(--surface-border, rgba(255, 255, 255, 0.12))';
                              e.target.style.boxShadow = 'none';
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ); })}

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
              />
            )}

            {/* Quick Add Question Button */}
            <button
              type="button"
              onClick={handleAddQuestion}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-md, 14px)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1.5px dashed var(--accent-primary, #6366f1)',
                color: 'var(--accent-primary, #6366f1)',
                fontWeight: '700',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon icon="solar:add-circle-bold" width="20" height="20" />
              <span>{t('ADD_QUESTION')}</span>
            </button>
          </div>

          {/* Sticky / Footer Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              paddingTop: '8px',
              paddingBottom: '24px',
            }}
          >
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                haptic.selection();
                if (onBack) onBack();
              }}
              style={{ flex: 1 }}
            >
              {t('BTN_EXIT')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              style={{ flex: 2 }}
              disabled={saving}
              loading={saving}
            >
              {saving ? t('SAVING') : t('SAVE_QUIZ_BTN')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
