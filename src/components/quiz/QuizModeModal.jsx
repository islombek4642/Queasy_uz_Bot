// src/components/quiz/QuizModeModal.jsx
// Interactive Wizard Modal for WebApp (Step 1: Quiz Selection [if needed], Step 2: Questions Mode & Count, Step 3: Time Limit)

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { fetchQuizDetail } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';

export function QuizModeModal({
  isOpen,
  onClose,
  quizId = null,
  userQuizzes = [],
  onOpenCreator = null,
  onConfirmMode,
}) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const isQuizSelectionRequired = !quizId;
  const totalSteps = isQuizSelectionRequired ? 3 : 2;

  const [activeQuizId, setActiveQuizId] = useState(quizId || null);
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [step, setStep] = useState(1); // 1: Select Quiz (if needed) or Questions Mode, etc.
  const [selectedMode, setSelectedMode] = useState('full'); // 'full' | 'range' | 'random'
  const [rangeStart, setRangeStart] = useState(1);
  const [rawRangeStart, setRawRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState(25);
  const [rawRangeEnd, setRawRangeEnd] = useState('25');
  const [randomCount, setRandomCount] = useState(20);
  const [rawRandomCount, setRawRandomCount] = useState('20');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(30);
  const [customTimeInput, setCustomTimeInput] = useState('');

  // Load quiz details when activeQuizId is known
  const loadQuiz = (id) => {
    setLoading(true);
    fetchQuizDetail(id)
      .then((res) => {
        if (res && res.quiz) {
          setQuizData(res);
          const total = res.questions?.length || 0;
          const endVal = Math.min(25, total || 1);
          const randVal = Math.min(20, total || 10);
          setRangeStart(1);
          setRawRangeStart('1');
          setRangeEnd(endVal);
          setRawRangeEnd(String(endVal));
          setRandomCount(randVal);
          setRawRandomCount(String(randVal));
          setSelectedTimeLimit(res.quiz.timeLimit || 30);
        }
      })
      .catch((err) => {
        console.error('Failed to load quiz details for mode modal:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMode('full');
    setCustomTimeInput('');

    if (quizId) {
      setActiveQuizId(quizId);
      setStep(1); // 1: Mode & Count
      loadQuiz(quizId);
    } else {
      setActiveQuizId(null);
      setQuizData(null);
      setStep(1); // 1: Quiz Selection
      setLoading(false);
    }
  }, [isOpen, quizId]);

  const quiz = quizData?.quiz;
  const totalQuestions = quizData?.questions?.length || 0;

  // Preset ranges based on totalQuestions
  const getPresetRanges = () => {
    if (totalQuestions <= 15) return [];
    const stepSize = 25;
    const presets = [];
    for (let i = 1; i <= totalQuestions; i += stepSize) {
      const end = Math.min(i + stepSize - 1, totalQuestions);
      presets.push([i, end]);
      if (presets.length >= 4) break;
    }
    return presets;
  };

  // Preset random counts
  const getPresetRandomCounts = () => {
    const allPresets = [10, 15, 20, 30, 50];
    const valid = allPresets.filter((cnt) => cnt <= totalQuestions);
    if (valid.length === 0 && totalQuestions > 0) {
      return [totalQuestions];
    }
    return valid;
  };

  // Time limit presets matching telegram bot options: 10s, 15s, 30s, 45s, 60s (1m), 120s (2m)
  const timePresets = [
    { label: '10s', value: 10 },
    { label: '15s', value: 15 },
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '1m', value: 60 },
    { label: '2m', value: 120 },
  ];

  // Handler for picking quiz in Step 1
  const handleSelectQuiz = (q) => {
    haptic.selection();
    setActiveQuizId(q.id);
    loadQuiz(q.id);
    setStep(2); // Advance to Mode & Range
  };

  const handleSelectFullMode = () => {
    haptic.selection();
    setSelectedMode('full');
    // Auto-advance to Time limit step
    setStep(isQuizSelectionRequired ? 3 : 2);
  };

  const handleNextStep = () => {
    haptic.impact('light');
    // Commit any raw strings into numbers
    const parsedStart = Math.max(1, Math.min(totalQuestions, parseInt(rawRangeStart, 10) || 1));
    const parsedEnd = Math.max(parsedStart, Math.min(totalQuestions, parseInt(rawRangeEnd, 10) || totalQuestions));
    const parsedRand = Math.max(1, Math.min(totalQuestions, parseInt(rawRandomCount, 10) || 10));

    setRangeStart(parsedStart);
    setRawRangeStart(String(parsedStart));
    setRangeEnd(parsedEnd);
    setRawRangeEnd(String(parsedEnd));
    setRandomCount(parsedRand);
    setRawRandomCount(String(parsedRand));

    setStep(isQuizSelectionRequired ? 3 : 2);
  };

  const handleStart = () => {
    if (totalQuestions <= 0) {
      alert(t('ERR_QUIZ_EMPTY') || "Ushbu testda savollar mavjud emas");
      return;
    }
    haptic.impact('medium');
    let validatedRange = null;
    let validatedRandomCount = null;

    if (selectedMode === 'range') {
      const start = Math.max(1, Math.min(Number(rangeStart) || 1, totalQuestions));
      const end = Math.max(start, Math.min(Number(rangeEnd) || totalQuestions, totalQuestions));
      validatedRange = [start, end];
    } else if (selectedMode === 'random') {
      validatedRandomCount = Math.max(1, Math.min(Number(randomCount) || 10, totalQuestions));
    }

    const finalTime = customTimeInput && parseInt(customTimeInput, 10) > 0
      ? parseInt(customTimeInput, 10)
      : (selectedTimeLimit || 30);

    if (onConfirmMode) {
      onConfirmMode({
        quizId: activeQuizId,
        mode: selectedMode,
        range: validatedRange,
        randomCount: validatedRandomCount,
        timeLimit: finalTime,
      });
    }
  };

  // Summary label for Mode / Time steps
  const getSelectedSummary = () => {
    if (selectedMode === 'full') {
      return `${totalQuestions} ${t('QUESTIONS_COUNT')} (${t('MODE_ALL_QUESTIONS')})`;
    }
    if (selectedMode === 'range') {
      const count = Math.max(1, (Number(rangeEnd) - Number(rangeStart) + 1));
      return t('MODE_RANGE_SUMMARY', { count, start: rangeStart, end: rangeEnd });
    }
    if (selectedMode === 'random') {
      return t('MODE_RANDOM_SUMMARY', { count: randomCount });
    }
    return t('MODE_TOTAL_SUMMARY', { count: totalQuestions });
  };

  const getModalTitle = () => {
    if (isQuizSelectionRequired) {
      if (step === 1) return t('SELECT_MY_QUIZ_TITLE');
      if (step === 2) return t('SELECT_MODE_TITLE');
      return t('SELECT_TIME_TITLE');
    }
    return step === 1 ? t('SELECT_MODE_TITLE') : t('SELECT_TIME_TITLE');
  };

  const getStepBadge = () => {
    if (isQuizSelectionRequired) {
      if (step === 1) return t('STEP_1_OF_3');
      if (step === 2) return t('STEP_2_OF_3');
      return t('STEP_3_OF_3');
    }
    return step === 1 ? t('STEP_1_OF_2') : t('STEP_2_OF_2');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      maxWidth="440px"
    >
      {loading ? (
        <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="32" height="32" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Unified Wizard Navigation Bar: Back button (if step > 1) & Step Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '28px',
              paddingBottom: '2px',
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  haptic.selection();
                  setStep((prev) => Math.max(1, prev - 1));
                }}
                className="glass-pill"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                <Icon icon="solar:arrow-left-linear" width="14" height="14" />
                <span>{t('BTN_BACK')}</span>
              </button>
            ) : (
              <div />
            )}

            <Badge variant="accent" size="sm">
              {getStepBadge()}
            </Badge>
          </div>

          {/* ========================================================================= */}
          {/* STEP A: Quiz Selection (When user clicked "+ Guruh testi yaratish")       */}
          {/* ========================================================================= */}
          {isQuizSelectionRequired && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-fade-in">
              {userQuizzes && userQuizzes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '2px' }}>
                  {userQuizzes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleSelectQuiz(q)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'var(--surface-card, rgba(255, 255, 255, 0.04))',
                        border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: '800',
                            fontSize: '0.92rem',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={q.title}
                        >
                          {q.title}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                          <Badge size="sm">{q.questionCount || 0} {t('QUESTIONS_COUNT')}</Badge>
                          <Badge size="sm" variant="warning">{q.timeLimit}s</Badge>
                        </div>
                      </div>
                      <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.82rem', fontWeight: '700', flexShrink: 0 }}>
                        <span>{t('SELECT_BTN')}</span>
                        <Icon icon="solar:arrow-right-linear" width="16" height="16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '28px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <Icon icon="solar:document-add-bold-duotone" width="46" height="46" style={{ color: 'var(--accent-primary)' }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: '800' }}>{t('NO_MY_QUIZZES_TITLE')}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: '1.4' }}>
                    {t('NO_MY_QUIZZES_DESC')}
                  </p>
                  {onOpenCreator && (
                    <Button
                      variant="primary"
                      size="md"
                      icon="solar:add-circle-bold"
                      onClick={() => {
                        onClose();
                        onOpenCreator();
                      }}
                      style={{ marginTop: '4px' }}
                    >
                      {t('GROUP_CREATE_NEW_QUIZ')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP B: Questions Mode & Range/Random Selector                            */}
          {/* ========================================================================= */}
          {((isQuizSelectionRequired && step === 2) || (!isQuizSelectionRequired && step === 1)) && (
            totalQuestions === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }} className="animate-fade-in">
                <Icon icon="solar:danger-triangle-bold" width="46" height="46" style={{ color: 'var(--color-warning)' }} />
                <h4 style={{ fontSize: '1rem', fontWeight: '800' }}>{t('ERR_QUIZ_EMPTY') || "Savollar mavjud emas"}</h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: '1.4', margin: 0 }}>
                  {t('ERR_QUIZ_EMPTY_DESC') || "Ushbu testda hali savollar mavjud emas."}
                </p>
                <Button variant="secondary" size="md" onClick={onClose} style={{ marginTop: '8px' }}>
                  {t('BTN_EXIT') || "Yopish"}
                </Button>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-fade-in">
              {/* 1. Full Mode (With Auto-Advance!) */}
              <div
                onClick={handleSelectFullMode}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 12px)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: selectedMode === 'full' ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                  border: selectedMode === 'full' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-primary, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <Icon icon="solar:document-text-bold" width="18" height="18" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {t('MODE_FULL_TITLE')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('MODE_FULL_DESC', { total: totalQuestions })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: '700' }}>
                  <span>{t('BTN_CHOOSE')}</span>
                  <Icon icon="solar:arrow-right-linear" width="16" height="16" />
                </div>
              </div>

              {/* 2. Range Mode */}
              <div
                onClick={() => {
                  haptic.selection();
                  setSelectedMode('range');
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 12px)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: selectedMode === 'range' ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                  border: selectedMode === 'range' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: selectedMode === 'range' ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      <Icon icon="solar:sort-from-top-to-bottom-bold" width="18" height="18" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {t('MODE_RANGE_TITLE')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('MODE_RANGE_DESC')}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: selectedMode === 'range' ? '5px solid var(--accent-primary, #6366f1)' : '2px solid var(--surface-border, rgba(255, 255, 255, 0.2))',
                      backgroundColor: '#fff',
                    }}
                  />
                </div>

                {selectedMode === 'range' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '2px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Presets Pills */}
                    {getPresetRanges().length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {getPresetRanges().map(([pStart, pEnd]) => {
                          const isCurrent = Number(rangeStart) === pStart && Number(rangeEnd) === pEnd;
                          return (
                            <button
                              key={`${pStart}-${pEnd}`}
                              type="button"
                              onClick={() => {
                                haptic.selection();
                                setRangeStart(pStart);
                                setRawRangeStart(String(pStart));
                                setRangeEnd(pEnd);
                                setRawRangeEnd(String(pEnd));
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: isCurrent ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                                color: isCurrent ? '#fff' : 'var(--text-secondary)',
                              }}
                            >
                              {pStart}–{pEnd}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Manual Range Inputs with Backspace/Clear Support */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {t('RANGE_START_LABEL')}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max={totalQuestions}
                          placeholder="1"
                          value={rawRangeStart}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRawRangeStart(val);
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed)) {
                              setRangeStart(parsed);
                            }
                          }}
                          onBlur={() => {
                            let parsed = parseInt(rawRangeStart, 10);
                            if (isNaN(parsed) || parsed < 1) parsed = 1;
                            if (parsed > totalQuestions) parsed = totalQuestions;
                            setRangeStart(parsed);
                            setRawRangeStart(String(parsed));
                            if (parsed > rangeEnd) {
                              setRangeEnd(parsed);
                              setRawRangeEnd(String(parsed));
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--surface-border)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            fontWeight: '700',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <span style={{ color: 'var(--text-muted)', paddingTop: '16px' }}>—</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {t('RANGE_END_LABEL')}
                        </span>
                        <input
                          type="number"
                          min={rangeStart}
                          max={totalQuestions}
                          placeholder={String(totalQuestions || 25)}
                          value={rawRangeEnd}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRawRangeEnd(val);
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed)) {
                              setRangeEnd(parsed);
                            }
                          }}
                          onBlur={() => {
                            let parsed = parseInt(rawRangeEnd, 10);
                            if (isNaN(parsed)) parsed = totalQuestions;
                            if (parsed < rangeStart) parsed = rangeStart;
                            if (parsed > totalQuestions) parsed = totalQuestions;
                            setRangeEnd(parsed);
                            setRawRangeEnd(String(parsed));
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--surface-border)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            fontWeight: '700',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Random Mode */}
              <div
                onClick={() => {
                  haptic.selection();
                  setSelectedMode('random');
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 12px)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: selectedMode === 'random' ? 'rgba(99, 102, 241, 0.14)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                  border: selectedMode === 'random' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: selectedMode === 'random' ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      <Icon icon="solar:shuffle-bold" width="18" height="18" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {t('MODE_RANDOM_TITLE')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('MODE_RANDOM_DESC')}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: selectedMode === 'random' ? '5px solid var(--accent-primary, #6366f1)' : '2px solid var(--surface-border, rgba(255, 255, 255, 0.2))',
                      backgroundColor: '#fff',
                    }}
                  />
                </div>

                {selectedMode === 'random' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '2px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Preset Pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {getPresetRandomCounts().map((cnt) => {
                        const isCurrent = Number(randomCount) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setRandomCount(cnt);
                              setRawRandomCount(String(cnt));
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.76rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: isCurrent ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                              color: isCurrent ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {t('COUNT_PILL', { count: cnt })}
                          </button>
                        );
                      })}
                    </div>

                    {/* Manual Input with Backspace/Clear Support */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {t('RANDOM_COUNT_LABEL')} (max: {totalQuestions})
                      </span>
                      <input
                        type="number"
                        min="1"
                        max={totalQuestions}
                        value={rawRandomCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRawRandomCount(val);
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed)) {
                            setRandomCount(parsed);
                          }
                        }}
                        onBlur={() => {
                          let parsed = parseInt(rawRandomCount, 10);
                          if (isNaN(parsed) || parsed < 1) parsed = Math.min(10, totalQuestions);
                          if (parsed > totalQuestions) parsed = totalQuestions;
                          setRandomCount(parsed);
                          setRawRandomCount(String(parsed));
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--surface-border)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          fontWeight: '700',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Next Button for Range/Random */}
              {selectedMode !== 'full' && (
                <div style={{ marginTop: '6px' }}>
                  <Button
                    variant="primary"
                    fullWidth
                    size="md"
                    icon="solar:arrow-right-linear"
                    style={{ padding: '10px 16px', fontSize: '0.92rem' }}
                    onClick={handleNextStep}
                  >
                    {t('BTN_PROCEED_TO_TIME')}
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* ========================================================================= */}
          {/* STEP C: Time Limit per Question Selector                                  */}
          {/* ========================================================================= */}
          {((isQuizSelectionRequired && step === 3) || (!isQuizSelectionRequired && step === 2)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} className="animate-fade-in">
              {/* Time Presets Grid (2 rows x 3 columns) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {timePresets.map((tp) => {
                  const isSelected = !customTimeInput && selectedTimeLimit === tp.value;
                  return (
                    <button
                      key={tp.value}
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        setSelectedTimeLimit(tp.value);
                        setCustomTimeInput('');
                      }}
                      style={{
                        padding: '12px 8px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: isSelected ? '2px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {tp.label}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {t('SECONDS_LABEL', { seconds: tp.value })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Time Input */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icon icon="solar:clock-circle-bold" width="18" height="18" style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {t('CUSTOM_TIME_LABEL')}
                </span>
                <input
                  type="number"
                  min="5"
                  max="300"
                  placeholder={t('CUSTOM_TIME_PLACEHOLDER')}
                  value={customTimeInput}
                  onChange={(e) => {
                    setCustomTimeInput(e.target.value);
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--surface-border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Final Confirm Button */}
              <div style={{ marginTop: '4px' }}>
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  icon="solar:play-circle-bold"
                  style={{ padding: '12px 16px', fontSize: '0.94rem', fontWeight: '800' }}
                  onClick={handleStart}
                >
                  {t('BTN_START_GAME')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default QuizModeModal;
