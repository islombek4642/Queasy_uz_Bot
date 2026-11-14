// src/components/quiz/QuizModeModal.jsx
// Interactive 2-Step Wizard Modal for WebApp (Step 1: Questions Mode & Count, Step 2: Time Limit)

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../../hooks/useTranslation.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { fetchQuizDetail } from '../../services/quizService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';

export function QuizModeModal({ isOpen, onClose, quizId, onConfirmMode }) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();

  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [step, setStep] = useState(1); // 1: Questions Mode & Count, 2: Time Limit per Question
  const [selectedMode, setSelectedMode] = useState('full'); // 'full' | 'range' | 'random'
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(25);
  const [randomCount, setRandomCount] = useState(20);
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(30);
  const [customTimeInput, setCustomTimeInput] = useState('');

  useEffect(() => {
    if (!isOpen || !quizId) return;
    setLoading(true);
    setStep(1);
    setSelectedMode('full');
    setCustomTimeInput('');

    fetchQuizDetail(quizId)
      .then((res) => {
        if (res && res.quiz) {
          setQuizData(res);
          const total = res.questions?.length || 0;
          setRangeStart(1);
          setRangeEnd(Math.min(25, total || 1));
          setRandomCount(Math.min(20, total || 10));
          setSelectedTimeLimit(res.quiz.timeLimit || 30);
        }
      })
      .catch((err) => {
        console.error('Failed to load quiz details for mode modal:', err);
      })
      .finally(() => {
        setLoading(false);
      });
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

  const handleSelectFullMode = () => {
    haptic.selection();
    setSelectedMode('full');
    // Auto-advance to Step 2 for instant friction-free setup!
    setStep(2);
  };

  const handleNextStep = () => {
    haptic.impact('light');
    setStep(2);
  };

  const handleStart = () => {
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
        quizId,
        mode: selectedMode,
        range: validatedRange,
        randomCount: validatedRandomCount,
        timeLimit: finalTime,
      });
    }
  };

  // Summary label for Step 2
  const getSelectedSummary = () => {
    if (selectedMode === 'full') {
      return `${totalQuestions} ${t('QUESTIONS_COUNT')} (Barchasi)`;
    }
    if (selectedMode === 'range') {
      const count = Math.max(1, (Number(rangeEnd) - Number(rangeStart) + 1));
      return `${count} ta savol (${rangeStart}–${rangeEnd})`;
    }
    if (selectedMode === 'random') {
      return `${randomCount} ta tasodifiy savol`;
    }
    return `${totalQuestions} ta savol`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? (t('SELECT_MODE_TITLE') || 'O\'yin rejimini tanlang') : 'Savol vaqtini tanlang'}
      maxWidth="440px"
    >
      {loading ? (
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="32" height="32" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header Summary */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md, 12px)',
              backgroundColor: 'var(--surface-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: '800',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={quiz?.title}
            >
              {quiz?.title || 'Test'}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
              <Badge variant="primary" icon="solar:question-circle-bold" size="sm">
                {step === 1 ? totalQuestions : getSelectedSummary()}
              </Badge>
              <Badge variant="accent" size="sm">
                {step === 1 ? '1/2 bosqich' : '2/2 bosqich'}
              </Badge>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STEP 1: Questions Mode & Range/Random Selector                            */}
          {/* ========================================================================= */}
          {step === 1 && (
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
                      {t('MODE_FULL_TITLE') || 'To\'liq rejim'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('MODE_FULL_DESC', { total: totalQuestions }) || `Barcha ${totalQuestions} ta savol`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: '700' }}>
                  <span>Tanlash</span>
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
                        {t('MODE_RANGE_TITLE') || 'Oraliq bo\'yicha'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('MODE_RANGE_DESC') || 'Savollar oralig\'ini belgilash'}
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
                    {/* Preset Pills */}
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
                                setRangeEnd(pEnd);
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

                    {/* Manual Inputs */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('RANGE_FROM_LABEL') || 'Boshlanishi'}</span>
                        <input
                          type="number"
                          min="1"
                          max={totalQuestions}
                          value={rangeStart}
                          onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                      <span style={{ paddingTop: '16px', color: 'var(--text-secondary)' }}>—</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('RANGE_TO_LABEL') || 'Tugashi'}</span>
                        <input
                          type="number"
                          min={rangeStart}
                          max={totalQuestions}
                          value={rangeEnd}
                          onChange={(e) => setRangeEnd(Math.max(rangeStart, Math.min(totalQuestions, parseInt(e.target.value, 10) || totalQuestions)))}
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
                        {t('MODE_RANDOM_TITLE') || 'Tasodifiy savollar'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('MODE_RANDOM_DESC') || 'Aralashtirilgan savollar soni'}
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
                            {cnt} ta
                          </button>
                        );
                      })}
                    </div>

                    {/* Manual Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {t('RANDOM_COUNT_LABEL') || 'Savollar soni'} (max: {totalQuestions})
                      </span>
                      <input
                        type="number"
                        min="1"
                        max={totalQuestions}
                        value={randomCount}
                        onChange={(e) => setRandomCount(Math.max(1, Math.min(totalQuestions, parseInt(e.target.value, 10) || 10)))}
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
                    Vaqt tanlashga o'tish ➡️
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: Time Limit per Question Selector                                  */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setStep(1);
                  }}
                  className="glass-pill"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Icon icon="solar:arrow-left-linear" width="14" height="14" />
                  <span>Orqaga</span>
                </button>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Har bir savol uchun vaqt
                </span>
              </div>

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
                        {tp.value} soniya
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
                  Ixtiyoriy vaqt:
                </span>
                <input
                  type="number"
                  min="5"
                  max="300"
                  placeholder="soniya (masalan: 25)"
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
                  🚀 O'yinni boshlash
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
