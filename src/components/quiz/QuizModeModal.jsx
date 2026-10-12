// src/components/quiz/QuizModeModal.jsx
// Interactive Quiz Mode Selector Modal for WebApp (Full, Range, Random)

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
  const [selectedMode, setSelectedMode] = useState('full'); // 'full' | 'range' | 'random'
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(25);
  const [randomCount, setRandomCount] = useState(20);

  useEffect(() => {
    if (!isOpen || !quizId) return;
    setLoading(true);
    setSelectedMode('full');

    fetchQuizDetail(quizId)
      .then((res) => {
        if (res && res.quiz) {
          setQuizData(res);
          const total = res.questions?.length || 0;
          setRangeStart(1);
          setRangeEnd(Math.min(25, total || 1));
          setRandomCount(Math.min(20, total || 10));
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
    const step = 25;
    const presets = [];
    for (let i = 1; i <= totalQuestions; i += step) {
      const end = Math.min(i + step - 1, totalQuestions);
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

    if (onConfirmMode) {
      onConfirmMode({
        quizId,
        mode: selectedMode,
        range: validatedRange,
        randomCount: validatedRandomCount,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('SELECT_MODE_TITLE')}
      maxWidth="480px"
    >
      {loading ? (
        <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
          <Icon icon="line-md:loading-loop" width="36" height="36" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Summary */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md, 14px)',
              backgroundColor: 'var(--surface-card, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {quiz?.title || 'Test'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge variant="primary" icon="solar:question-circle-bold" size="sm">
                {totalQuestions} {t('QUESTIONS_COUNT')}
              </Badge>
              <Badge variant="warning" icon="solar:clock-circle-bold" size="sm">
                {quiz?.timeLimit || 30}s
              </Badge>
            </div>
          </div>

          {/* Mode Option Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 1. Full Mode */}
            <div
              onClick={() => {
                haptic.selection();
                setSelectedMode('full');
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md, 14px)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: selectedMode === 'full' ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                border: selectedMode === 'full' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: selectedMode === 'full' ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <Icon icon="solar:document-text-bold" width="22" height="22" />
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {t('MODE_FULL_TITLE')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('MODE_FULL_DESC', { total: totalQuestions })}
                  </div>
                </div>
              </div>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: selectedMode === 'full' ? '6px solid var(--accent-primary, #6366f1)' : '2px solid var(--surface-border, rgba(255, 255, 255, 0.2))',
                  backgroundColor: '#fff',
                }}
              />
            </div>

            {/* 2. Range Mode */}
            <div
              onClick={() => {
                haptic.selection();
                setSelectedMode('range');
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md, 14px)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: selectedMode === 'range' ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                border: selectedMode === 'range' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: selectedMode === 'range' ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <Icon icon="solar:sort-from-top-to-bottom-bold" width="22" height="22" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {t('MODE_RANGE_TITLE')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {t('MODE_RANGE_DESC')}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: selectedMode === 'range' ? '6px solid var(--accent-primary, #6366f1)' : '2px solid var(--surface-border, rgba(255, 255, 255, 0.2))',
                    backgroundColor: '#fff',
                  }}
                />
              </div>

              {/* Range Configuration details if active */}
              {selectedMode === 'range' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '4px',
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
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
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
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('RANGE_FROM_LABEL')}</span>
                      <input
                        type="number"
                        min="1"
                        max={totalQuestions}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--surface-border)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          fontWeight: '700',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <span style={{ paddingTop: '16px', color: 'var(--text-secondary)' }}>—</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('RANGE_TO_LABEL')}</span>
                      <input
                        type="number"
                        min={rangeStart}
                        max={totalQuestions}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(Math.max(rangeStart, Math.min(totalQuestions, parseInt(e.target.value, 10) || totalQuestions)))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--surface-border)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
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
                borderRadius: 'var(--radius-md, 14px)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: selectedMode === 'random' ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-card, rgba(255, 255, 255, 0.03))',
                border: selectedMode === 'random' ? '1.5px solid var(--accent-primary, #6366f1)' : '1px solid var(--surface-border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: selectedMode === 'random' ? 'var(--accent-primary, #6366f1)' : 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <Icon icon="solar:shuffle-bold" width="22" height="22" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {t('MODE_RANDOM_TITLE')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {t('MODE_RANDOM_DESC')}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: selectedMode === 'random' ? '6px solid var(--accent-primary, #6366f1)' : '2px solid var(--surface-border, rgba(255, 255, 255, 0.2))',
                    backgroundColor: '#fff',
                  }}
                />
              </div>

              {/* Random Configuration details if active */}
              {selectedMode === 'random' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '4px',
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
                            padding: '5px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: isCurrent ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: isCurrent ? '#fff' : 'var(--text-secondary)',
                          }}
                        >
                          {cnt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('RANDOM_COUNT_LABEL')} (max: {totalQuestions})</span>
                    <input
                      type="number"
                      min="1"
                      max={totalQuestions}
                      value={randomCount}
                      onChange={(e) => setRandomCount(Math.max(1, Math.min(totalQuestions, parseInt(e.target.value, 10) || 10)))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--surface-border)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Start Button */}
          <div style={{ marginTop: '8px' }}>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon="solar:play-circle-bold"
              onClick={handleStart}
            >
              {t('BTN_START_PLAY')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default QuizModeModal;
