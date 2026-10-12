// src/views/ArenaView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useQuizTimer } from '../hooks/useQuizTimer.js';
import { fetchQuizDetail, submitSoloResult } from '../services/quizService.js';
import { TimerRing } from '../components/quiz/TimerRing.jsx';
import { ProgressBar } from '../components/quiz/ProgressBar.jsx';
import { OptionCard } from '../components/quiz/OptionCard.jsx';
import { MathText } from '../components/quiz/MathText.jsx';
import { ResultCard } from '../components/quiz/ResultCard.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Card } from '../components/common/Card.jsx';

export function ArenaView({ quizId, customQuestions = null, customTitle = null, onExit }) {
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
  const [showExitModal, setShowExitModal] = useState(false);

  const startTimeRef = useRef(Date.now());
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);

  // Load quiz details or use custom questions
  const loadQuiz = useCallback(async () => {
    if (customQuestions && customQuestions.length > 0) {
      setQuiz({
        id: 0,
        title: customTitle || t('MISTAKES_PRACTICE_TITLE'),
        timeLimit: 30,
        shuffleOptions: true,
      });
      setQuestions(customQuestions);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchQuizDetail(quizId);
      if (data && data.quiz && data.questions?.length > 0) {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
    } finally {
      setLoading(false);
    }
  }, [quizId, customQuestions, customTitle, t]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Current question data
  const currentQ = questions[currentIndex];
  const timeLimit = quiz?.timeLimit || 30;

  // Next question step
  const handleAdvance = useCallback(() => {
    setIsRevealed(false);
    setSelectedOption(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setTotalTimeSpent(elapsed);
      setIsFinished(true);
      submitSoloResult({
        quizId,
        correctCount,
        wrongCount,
        timeSpent: elapsed,
      }).catch(() => {});
    }
  }, [currentIndex, questions.length, quizId, correctCount, wrongCount]);

  // Timeout handler
  const handleTimeout = useCallback(() => {
    if (isRevealed || isFinished) return;
    haptic.notification('error');
    setIsRevealed(true);
    setWrongCount((prev) => prev + 1);

    setTimeout(() => {
      handleAdvance();
    }, 1200);
  }, [isRevealed, isFinished, haptic, handleAdvance]);

  // Timer hook
  const { timeLeft, reset: resetTimer } = useQuizTimer(timeLimit, handleTimeout);

  // Reset timer on question change
  useEffect(() => {
    if (!loading && !isFinished) {
      resetTimer(timeLimit);
    }
  }, [currentIndex, loading, isFinished, timeLimit]);

  // Option selection handler
  const handleSelectOption = (optIndex) => {
    if (isRevealed) return;

    setSelectedOption(optIndex);
    setIsRevealed(true);

    const isCorrect = optIndex === currentQ?.correctOptionId;
    if (isCorrect) {
      haptic.notification('success');
      setCorrectCount((prev) => prev + 1);
    } else {
      haptic.notification('error');
      setWrongCount((prev) => prev + 1);
    }

    // Delay to let user see correct/wrong feedback, then advance
    setTimeout(() => {
      handleAdvance();
    }, 1200);
  };

  // Telegram BackButton integration
  useEffect(() => {
    const handleBack = () => {
      if (isFinished) {
        onExit();
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
        onRetry={() => {
          setCurrentIndex(0);
          setCorrectCount(0);
          setWrongCount(0);
          setIsFinished(false);
          setIsRevealed(false);
          setSelectedOption(null);
          startTimeRef.current = Date.now();
        }}
        onBackHome={onExit}
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
      {/* Top Bar: Progress and Timer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        onConfirm={onExit}
        onClose={() => setShowExitModal(false)}
      >
        {t('CONFIRM_EXIT_DESC')}
      </Modal>
    </div>
  );
}
