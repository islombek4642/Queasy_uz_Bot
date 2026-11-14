// src/views/ArenaView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useQuizTimer } from '../hooks/useQuizTimer.js';
import {
  fetchQuizDetail,
  submitSoloResult,
  submitTournamentResult,
  fetchLiveRoomState,
  submitLiveRoomResult,
  fetchLiveQuestion,
  submitLiveAnswer,
} from '../services/quizService.js';
import { shuffleQuestionOptions, shuffleArray } from '../utils/quizHelpers.js';
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

  // Live battle synchronous state
  const [liveTotalQuestions, setLiveTotalQuestions] = useState(1);
  const [liveScoreAwarded, setLiveScoreAwarded] = useState(null);
  const [serverCorrectId, setServerCorrectId] = useState(null);
  const [countdown, setCountdown] = useState(liveRoomCode ? 3 : 0);

  const startTimeRef = useRef(Date.now());
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const consecutiveMissesRef = useRef(0);
  const failedQuestionsRef = useRef([]);
  const resolvedMistakeIdsRef = useRef([]);

  // Live battle 3-2-1 countdown
  useEffect(() => {
    if (!liveRoomCode || countdown <= 0) return;
    haptic.impact('light');
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
      if (countdown === 1) {
        haptic.notification('success');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [liveRoomCode, countdown, haptic]);

  // Load quiz details or use custom questions with option shuffling
  const loadQuiz = useCallback(async () => {
    correctCountRef.current = 0;
    wrongCountRef.current = 0;

    // A. Mistakes Mode
    if (customQuestions && customQuestions.length > 0) {
      setQuiz({
        id: 0,
        title: customTitle || t('MISTAKES_PRACTICE_TITLE'),
        timeLimit: 30,
        shuffleOptions: true,
      });

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

    // B. Live Battle Mode (Anti-Cheat: Fetch initial question from server)
    if (liveRoomCode) {
      setLoading(true);
      try {
        const stateRes = await fetchLiveRoomState(liveRoomCode);
        if (stateRes && stateRes.success) {
          const room = stateRes.room || {};
          if (room.isFinished || room.status === 'finished') {
            setIsFinished(true);
            setLoading(false);
            return;
          }

          const targetIdx = Number(room.currentQuestionIndex || 0);
          const liveRes = await fetchLiveQuestion(liveRoomCode, targetIdx);
          if (liveRes && liveRes.success && liveRes.question) {
            setQuiz({
              id: quizId || stateRes.quiz?.id || 0,
              title: customTitle || stateRes.quiz?.title || t('GROUP_BATTLE_DEFAULT_TITLE'),
              timeLimit: liveRes.timeLimit || stateRes.quiz?.timeLimit || 30,
              shuffleOptions: false,
            });
            setQuestions((prev) => {
              const updated = [...prev];
              updated[targetIdx] = liveRes.question;
              return updated;
            });
            setCurrentIndex(targetIdx);
            setLiveTotalQuestions(liveRes.totalQuestions || stateRes.quiz?.questionCount || 1);

            if (room.roundPhase === 'countdown') {
              setCountdown(Math.max(1, room.timeRemaining || 3));
            } else {
              setCountdown(0);
              if (room.roundPhase === 'answering') {
                resetTimer(Math.max(1, room.timeRemaining || liveRes.timeLimit || 30));
              } else if (room.roundPhase === 'revealing') {
                setIsRevealed(true);
                pauseTimer();
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial live question:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // C. Standard Solo Quiz Mode
    setLoading(true);
    try {
      const data = await fetchQuizDetail(quizId);
      if (data && data.quiz && data.questions?.length > 0) {
        setQuiz(data.quiz);
        let pool = [...data.questions];

        if (mode === 'range' && Array.isArray(range) && range.length === 2) {
          const start = Math.max(1, Math.min(Number(range[0]) || 1, pool.length));
          const end = Math.max(start, Math.min(Number(range[1]) || pool.length, pool.length));
          pool = pool.slice(start - 1, end);
        } else if (mode === 'random' && randomCount) {
          const count = Math.min(pool.length, Math.max(1, Number(randomCount) || 10));
          pool = shuffleArray(pool).slice(0, count);
        }

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
  }, [quizId, customQuestions, customTitle, mode, range, randomCount, liveRoomCode, t]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Current question data
  const currentQ = questions[currentIndex];
  const timeLimit = quiz?.timeLimit || 30;
  const totalCount = liveRoomCode ? liveTotalQuestions : questions.length;

  // Next question step
  const handleAdvance = useCallback(async (autoStop = false) => {
    setIsRevealed(false);
    setSelectedOption(null);
    setLiveScoreAwarded(null);
    setServerCorrectId(null);

    const questionLimit = liveRoomCode ? liveTotalQuestions : questions.length;

    if (!autoStop && currentIndex + 1 < questionLimit) {
      const nextIdx = currentIndex + 1;
      if (liveRoomCode) {
        try {
          const nextQ = await fetchLiveQuestion(liveRoomCode, nextIdx);
          if (nextQ && nextQ.success && nextQ.question) {
            setQuestions((prev) => {
              const updated = [...prev];
              updated[nextIdx] = nextQ.question;
              return updated;
            });
            setCurrentIndex(nextIdx);
          } else {
            setIsFinished(true);
          }
        } catch (err) {
          console.error('Failed to fetch next live question:', err);
          setIsFinished(true);
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
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
          totalQuestions: questionLimit,
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
  }, [currentIndex, questions.length, liveTotalQuestions, liveRoomCode, quizId, customQuestions, mode, tournamentShareCode]);

  // Timeout handler
  const handleTimeout = useCallback(() => {
    if (isRevealed || isFinished) return;
    haptic.notification('error');
    setIsRevealed(true);
    wrongCountRef.current += 1;
    setWrongCount((prev) => prev + 1);
    consecutiveMissesRef.current += 1;

    if (!customQuestions && currentQ) {
      failedQuestionsRef.current.push({
        questionText: currentQ.questionText,
        options: currentQ.options || [],
        correctOptionId: currentQ.correctOptionId ?? 0,
        explanation: currentQ.explanation || null,
        originalQuizId: quizId || null,
      });
    }

    if (consecutiveMissesRef.current >= 3) {
      setInactivityStopped(true);
      setTimeout(() => {
        handleAdvance(true);
      }, 1000);
      return;
    }

    if (liveRoomCode) {
      // In Live Battle, player remains on question until server round transitions
      return;
    }

    setTimeout(() => {
      handleAdvance(false);
    }, 1200);
  }, [isRevealed, isFinished, haptic, handleAdvance, customQuestions, currentQ, quizId, liveRoomCode]);

  // Timer hook
  const { timeLeft, reset: resetTimer, pause: pauseTimer } = useQuizTimer(timeLimit, handleTimeout);

  // Reset timer on question change (only for solo/tournament, live battle uses synchronized clock)
  useEffect(() => {
    if (!liveRoomCode && !loading && !isFinished && countdown <= 0) {
      resetTimer(timeLimit);
    }
  }, [liveRoomCode, currentIndex, loading, isFinished, timeLimit, resetTimer, countdown]);

  // Synchronized Live Room Game Polling
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const isRevealedRef = useRef(isRevealed);
  isRevealedRef.current = isRevealed;

  useEffect(() => {
    if (!liveRoomCode || isFinished) return;

    const syncInterval = setInterval(async () => {
      try {
        const stateRes = await fetchLiveRoomState(liveRoomCode);
        if (stateRes && stateRes.success) {
          const room = stateRes.room || {};
          if (room.isFinished || room.status === 'finished') {
            handleAdvance(true);
            return;
          }

          const serverIdx = Number(room.currentQuestionIndex);
          if (!isNaN(serverIdx) && serverIdx !== currentIndexRef.current && serverIdx < (stateRes.quiz?.questionCount || liveTotalQuestions)) {
            // Round advanced on server!
            setIsRevealed(false);
            setSelectedOption(null);
            setLiveScoreAwarded(null);
            setServerCorrectId(null);

            const nextQ = await fetchLiveQuestion(liveRoomCode, serverIdx);
            if (nextQ && nextQ.success && nextQ.question) {
              setQuestions((prev) => {
                const updated = [...prev];
                updated[serverIdx] = nextQ.question;
                return updated;
              });
              setCurrentIndex(serverIdx);
              currentIndexRef.current = serverIdx;
              if (room.roundPhase === 'answering') {
                resetTimer(Math.max(1, room.timeRemaining || nextQ.timeLimit || 30));
              } else if (room.roundPhase === 'revealing') {
                setIsRevealed(true);
                pauseTimer();
              }
            }
          } else if (room.roundPhase === 'revealing' && !isRevealedRef.current) {
            setIsRevealed(true);
            pauseTimer();
          }
        }
      } catch (err) {
        console.error('Failed to sync live room state:', err);
      }
    }, 1500);

    return () => clearInterval(syncInterval);
  }, [liveRoomCode, isFinished, liveTotalQuestions, handleAdvance, resetTimer, pauseTimer]);

  // Option selection handler
  const handleSelectOption = (optIndex) => {
    if (isRevealed) return;

    consecutiveMissesRef.current = 0;
    pauseTimer();
    setSelectedOption(optIndex);
    setIsRevealed(true);

    // Live Room synchronous submission
    if (liveRoomCode) {
      const elapsed = Math.max(0, Math.round(timeLimit - timeLeft));
      submitLiveAnswer({
        roomCode: liveRoomCode,
        questionIndex: currentIndex,
        selectedOptionId: optIndex,
        timeTaken: elapsed,
      }).then((res) => {
        if (res && res.success) {
          setServerCorrectId(res.correctOptionId);
          setLiveScoreAwarded(res.scoreAwarded);
          if (res.isCorrect) {
            haptic.notification('success');
            correctCountRef.current += 1;
            setCorrectCount((prev) => prev + 1);
          } else {
            haptic.notification('error');
            wrongCountRef.current += 1;
            setWrongCount((prev) => prev + 1);
          }
        }
      }).catch((err) => {
        console.error('Failed to submit live answer:', err);
      });

      // In Live Battle, do not advance locally! Wait for server round clock transition.
      return;
    }

    // Solo or tournament answer calculation
    const isCorrect = optIndex === currentQ?.correctOptionId;
    if (isCorrect) {
      haptic.notification('success');
      correctCountRef.current += 1;
      setCorrectCount((prev) => prev + 1);
      if (customQuestions && (currentQ?.mistakeId || currentQ?.id)) {
        resolvedMistakeIdsRef.current.push(currentQ.mistakeId || currentQ.id);
      }
    } else {
      haptic.notification('error');
      wrongCountRef.current += 1;
      setWrongCount((prev) => prev + 1);
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
      backButton.hide();
    };
  }, [backButton, isFinished, onExit]);

  // Loading skeleton
  if (loading && !currentQ) {
    return (
      <div style={{ padding: '36px 16px', textAlign: 'center' }} className="animate-fade-in">
        <Icon icon="solar:hourglass-line-bold" width="36" height="36" className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('LOADING')}</p>
      </div>
    );
  }

  // Live battle 3-2-1 visual countdown
  if (countdown > 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
          gap: '16px',
        }}
        className="animate-fade-in"
      >
        <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {t('BATTLE_STARTING_TITLE')}
        </span>
        <div
          style={{
            fontSize: '5.5rem',
            fontWeight: '900',
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-family-display)',
            textShadow: '0 0 35px rgba(99, 102, 241, 0.6)',
          }}
          className="animate-bounce"
        >
          {countdown}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          {t('BATTLE_STARTING_SUB')}
        </p>
      </div>
    );
  }

  // Results Screen (Scorecard)
  if (isFinished) {
    return (
      <ResultCard
        quiz={quiz}
        correctCount={correctCount}
        wrongCount={wrongCount}
        totalQuestions={totalCount}
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
          setLiveScoreAwarded(null);
          setServerCorrectId(null);
          startTimeRef.current = Date.now();
        }}
        onBackHome={() => onExit(false)}
      />
    );
  }

  // Resolve true correct option ID
  const trueCorrectId = liveRoomCode
    ? (serverCorrectId !== null ? serverCorrectId : -1)
    : currentQ?.correctOptionId;

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
          title={t('BTN_EXIT')}
        >
          <Icon icon="solar:close-circle-bold" width="22" height="22" />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            <span>{t('QUESTION_PROGRESS', { current: currentIndex + 1, total: totalCount })}</span>
            <span style={{ color: 'var(--color-success)' }}>{correctCount} ✓</span>
          </div>
          <ProgressBar current={currentIndex + 1} total={totalCount} />
        </div>

        <TimerRing timeLeft={timeLeft} totalTime={timeLimit} size={54} strokeWidth={4} />
      </div>

      {/* Intermediate Result Pill for Live Battles */}
      {liveRoomCode && isRevealed && liveScoreAwarded !== null && (
        <div
          className="animate-fade-in"
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            backgroundColor: liveScoreAwarded > 0 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
            border: liveScoreAwarded > 0 ? '1.5px solid #10b981' : '1.5px solid #ef4444',
            textAlign: 'center',
            fontWeight: '800',
            fontSize: '0.94rem',
            color: liveScoreAwarded > 0 ? 'var(--color-success)' : 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Icon icon={liveScoreAwarded > 0 ? 'solar:cup-star-bold' : 'solar:close-circle-bold'} width="22" height="22" />
          <span>{liveScoreAwarded > 0 ? t('LIVE_SCORE_AWARDED', { score: liveScoreAwarded }) : t('LIVE_SCORE_ZERO')}</span>
        </div>
      )}

      {/* Waiting for next round notification for Live Battles */}
      {liveRoomCode && isRevealed && !isFinished && (
        <div
          className="animate-fade-in"
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            textAlign: 'center',
            fontSize: '0.82rem',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Icon icon="solar:clock-circle-bold" width="16" height="16" className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <span>{t('LIVE_WAITING_NEXT_ROUND')}</span>
        </div>
      )}

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
          const isCorrect = isRevealed && idx === trueCorrectId;
          const isWrong = isRevealed && isSelected && !isCorrect;

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
