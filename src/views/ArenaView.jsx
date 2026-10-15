// src/views/ArenaView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useQuizTimer } from '../hooks/useQuizTimer.js';
import { fetchQuizDetail, submitSoloResult, submitTournamentResult, submitLiveRoomResult } from '../services/quizService.js';
import { shuffleQuestionOptions } from '../utils/quizHelpers.js';
import { TimerRing } from '../components/quiz/TimerRing.jsx';
import { ProgressBar } from '../components/quiz/ProgressBar.jsx';
import { OptionCard } from '../components/quiz/OptionCard.jsx';
import { MathText } from '../components/quiz/MathText.jsx';
import { ResultCard } from '../components/quiz/ResultCard.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Card } from '../components/common/Card.jsx';

export function ArenaView({
  quizId,
  customQuestions = null,
  customTitle = null,
  mode = 'full',
  range = null,
  randomCount = null,
  tournamentShareCode = null,
  liveRoomCode = null,
  onExit,
}) {

  const { t } = useTranslation();
  const { haptic, backButton } = useTelegram();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [inactivityStopped, setInactivityStopped] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [tournamentResult, setTournamentResult] = useState(null);
  const [liveRoomResult, setLiveRoomResult] = useState(null);

  const startTimeRef = useRef(Date.now());
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const consecutiveMissesRef = useRef(0);
  const failedQuestionsRef = useRef([]);
  const resolvedMistakeIdsRef = useRef([]);

  // Load quiz details or use custom questions with option shuffling
  const loadQuiz = useCallback(async () => {
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    if (customQuestions && customQuestions.length > 0) {
      setQuiz({
        id: 0,
        title: customTitle || t('MISTAKES_PRACTICE_TITLE'),
        timeLimit: 30,
        shuffleOptions: true,
      });

      // Always shuffle options for mistakes practice questions while preserving question order
      const preparedMistakes = customQuestions.map((q) => {
        const shuf = shuffleQuestionOptions(q.options || [], q.correctOptionId ?? 0);
        return {
          ...q,
          options: shuf.options,
          correctOptionId: shuf.correctOptionId,
        };
      });

      setQuestions(preparedMistakes);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchQuizDetail(quizId);
      if (data && data.quiz && data.questions?.length > 0) {
        setQuiz(data.quiz);
        let pool = [...data.questions];

        // 1. Filter / Slice questions based on selected mode
        if (mode === 'range' && Array.isArray(range) && range.length === 2) {
          const start = Math.max(1, Math.min(Number(range[0]) || 1, pool.length));
          const end = Math.max(start, Math.min(Number(range[1]) || pool.length, pool.length));
          pool = pool.slice(start - 1, end);
        } else if (mode === 'random' && randomCount) {
          // Only in random mode: shuffle question order!
          const count = Math.min(pool.length, Math.max(1, Number(randomCount) || 10));
          pool = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
        }

        // 2. Always shuffle options for each question (Fisher-Yates) unless shuffleOptions is explicitly false
        const shouldShuffle = data.quiz.shuffleOptions !== false;
        const preparedQuestions = pool.map((q) => {
          if (shouldShuffle && Array.isArray(q.options) && q.options.length >= 2) {
            const shuf = shuffleQuestionOptions(q.options, q.correctOptionId ?? 0);
            return {
              ...q,
              options: shuf.options,
              correctOptionId: shuf.correctOptionId,
            };
          }
          return q;
        });

        setQuestions(preparedQuestions);
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
    } finally {
      setLoading(false);
    }
  }, [quizId, customQuestions, customTitle, mode, range, randomCount]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Current question data
  const currentQ = questions[currentIndex];
  const timeLimit = quiz?.timeLimit || 30;

  // Next question step
  const handleAdvance = useCallback((autoStop = false) => {
    setIsRevealed(false);
    setSelectedOption(null);

    if (!autoStop && currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setTotalTimeSpent(elapsed);
      setIsFinished(true);

      const finalCorrect = correctCountRef.current;
      const finalWrong = wrongCountRef.current;

      if (tournamentShareCode) {
        submitTournamentResult({
          shareCode: tournamentShareCode,
          score: finalCorrect,
          totalQuestions: questions.length,
          totalTimeSeconds: elapsed,
        }).then((res) => {
          if (res && res.success) {
            setTournamentResult(res);
          }
        }).catch((err) => {
          console.error('Failed to submit tournament result:', err);
        });
      } else if (liveRoomCode) {
        submitLiveRoomResult({
          roomCode: liveRoomCode,
          score: finalCorrect,
          totalQuestions: questions.length,
          totalTimeSeconds: elapsed,
        }).then((res) => {
          if (res && res.success) {
            setLiveRoomResult(res);
          }
        }).catch((err) => {
          console.error('Failed to submit live room result:', err);
        });
      } else {
        submitSoloResult({
          quizId: quizId || 0,
          isMistakesMode: Boolean(customQuestions),
          mode: Boolean(customQuestions) ? 'mistakes' : mode,
          correctCount: finalCorrect,
          wrongCount: finalWrong,
          timeSpent: elapsed,
          failedQuestions: failedQuestionsRef.current,
          resolvedMistakeIds: resolvedMistakeIdsRef.current,
        }).catch((err) => {
          console.error('Failed to submit solo result:', err);
        });
      }
    }
  }, [currentIndex, questions.length, quizId, customQuestions, mode, tournamentShareCode, liveRoomCode]);


  // Timeout handler
  const handleTimeout = useCallback(() => {
    if (isRevealed || isFinished) return;
    haptic.notification('error');
    setIsRevealed(true);
    wrongCountRef.current += 1;
    setWrongCount((prev) => prev + 1);
    consecutiveMissesRef.current += 1;

    // If solving regular quiz and timed out, count as failed question
    if (!customQuestions && currentQ) {
      failedQuestionsRef.current.push({
        questionText: currentQ.questionText,
        options: currentQ.options || [],
        correctOptionId: currentQ.correctOptionId ?? 0,
        explanation: currentQ.explanation || null,
        originalQuizId: quizId || null,
      });
    }

    // Auto-stop quiz if user is inactive for 3 consecutive questions
    if (consecutiveMissesRef.current >= 3) {
      setInactivityStopped(true);
      setTimeout(() => {
        handleAdvance(true);
      }, 1000);
      return;
    }

    setTimeout(() => {
      handleAdvance(false);
    }, 1200);
  }, [isRevealed, isFinished, haptic, handleAdvance, customQuestions, currentQ, quizId]);

  // Timer hook
  const { timeLeft, reset: resetTimer, pause: pauseTimer } = useQuizTimer(timeLimit, handleTimeout);

  // Reset timer on question change
  useEffect(() => {
    if (!loading && !isFinished) {
      resetTimer(timeLimit);
    }
  }, [currentIndex, loading, isFinished, timeLimit, resetTimer]);

  // Option selection handler
  const handleSelectOption = (optIndex) => {
    if (isRevealed) return;

    consecutiveMissesRef.current = 0; // Reset inactive counter on any active answer
    pauseTimer();
    setSelectedOption(optIndex);
    setIsRevealed(true);

    const isCorrect = optIndex === currentQ?.correctOptionId;
    if (isCorrect) {
      haptic.notification('success');
      correctCountRef.current += 1;
      setCorrectCount((prev) => prev + 1);
      // If solving mistakes practice, mark this mistake as resolved
      if (customQuestions && (currentQ?.mistakeId || currentQ?.id)) {
        resolvedMistakeIdsRef.current.push(currentQ.mistakeId || currentQ.id);
      }
    } else {
      haptic.notification('error');
      wrongCountRef.current += 1;
      setWrongCount((prev) => prev + 1);
      // If solving regular quiz, collect failed question for mistakes practice
      if (!customQuestions && currentQ) {
        failedQuestionsRef.current.push({
          questionText: currentQ.questionText,
          options: currentQ.options || [],
          correctOptionId: currentQ.correctOptionId ?? 0,
          explanation: currentQ.explanation || null,
          originalQuizId: quizId || null,
        });
      }
    }

    // Delay to let user see correct/wrong feedback, then advance
    setTimeout(() => {
      handleAdvance(false);
    }, 1200);
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    onExit(true);
  };

  // Telegram BackButton integration
  useEffect(() => {
    const handleBack = () => {
      if (isFinished) {
        onExit(false);
      } else {
        setShowExitModal(true);
      }
    };

    backButton.show(handleBack);
    return () => {
      backButton.hide(handleBack);
    };
  }, [backButton, isFinished, onExit]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon="line-md:loading-loop" width="40" height="40" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (isFinished) {
    return (
      <ResultCard
        quizTitle={quiz?.title}
        quizId={quiz?.id}
        correctCount={correctCount}
        wrongCount={wrongCount}
        totalTimeSeconds={totalTimeSpent}
        tournamentResult={tournamentResult}
        tournamentShareCode={tournamentShareCode}
        liveRoomResult={liveRoomResult}
        liveRoomCode={liveRoomCode}
        inactivityStopped={inactivityStopped}
        onRetry={() => {
          setCurrentIndex(0);
          setCorrectCount(0);
          setWrongCount(0);
          consecutiveMissesRef.current = 0;
          setInactivityStopped(false);
          setTournamentResult(null);
          setLiveRoomResult(null);
          failedQuestionsRef.current = [];
          resolvedMistakeIdsRef.current = [];
          setIsFinished(false);
          setIsRevealed(false);
          setSelectedOption(null);
          startTimeRef.current = Date.now();
        }}
        onBackHome={() => onExit(false)}
      />
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '520px',
        margin: '0 auto',
        width: '100%',
        minHeight: '100vh',
      }}
      className="animate-fade-in"
    >
      {/* Top Bar: Progress, Timer, and Exit Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button
          type="button"
          onClick={() => {
            haptic.impact('light');
            setShowExitModal(true);
          }}
          className="glass-pill"
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          title={t('BTN_EXIT') || 'Chiqish'}
        >
          <Icon icon="solar:close-circle-bold" width="22" height="22" />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            <span>{t('QUESTION_PROGRESS', { current: currentIndex + 1, total: questions.length })}</span>
            <span style={{ color: 'var(--color-success)' }}>{correctCount} ✓</span>
          </div>
          <ProgressBar current={currentIndex + 1} total={questions.length} />
        </div>

        <TimerRing timeLeft={timeLeft} totalTime={timeLimit} size={54} strokeWidth={4} />
      </div>

      {/* Question Card */}
      <Card
        style={{
          padding: '24px 20px',
          minHeight: '130px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          border: '1px solid var(--surface-border)',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', lineHeight: '1.45', color: 'var(--text-primary)' }}>
          <MathText text={currentQ?.questionText} />
        </h3>
      </Card>

      {/* Options List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {currentQ?.options?.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = idx === currentQ.correctOptionId;
          const isWrong = isSelected && !isCorrect;

          return (
            <OptionCard
              key={idx}
              index={idx}
              text={opt}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isWrong={isWrong}
              isRevealed={isRevealed}
              disabled={isRevealed}
              onClick={handleSelectOption}
            />
          );
        })}
      </div>

      {/* Explanation Banner (if revealed and explanation exists) */}
      {isRevealed && currentQ?.explanation && (
        <Card
          className="animate-fade-in"
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderColor: 'rgba(99, 102, 241, 0.25)',
          }}
        >
          <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '4px' }}>
            {t('EXPLANATION_TITLE')}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <MathText text={currentQ.explanation} />
          </div>
        </Card>
      )}

      {/* Exit Confirmation Modal */}
      <Modal
        isOpen={showExitModal}
        title={t('CONFIRM_EXIT_TITLE')}
        icon="solar:danger-triangle-bold"
        confirmText={t('BTN_EXIT')}
        confirmVariant="danger"
        cancelText={t('BTN_CONTINUE')}
        onConfirm={handleConfirmExit}
        onClose={() => setShowExitModal(false)}
      >
        {t('CONFIRM_EXIT_DESC')}
      </Modal>
    </div>
  );
}
