// src/hooks/useQuizTimer.js
import { useState, useEffect, useRef } from 'react';

export function useQuizTimer(initialTime = 30, onTimeout) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  const reset = (newTime = initialTime) => {
    clearInterval(timerRef.current);
    setTimeLeft(newTime);
    setIsRunning(true);
  };

  const pause = () => {
    clearInterval(timerRef.current);
    setIsRunning(false);
  };

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsRunning(false);
          if (onTimeout) onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isRunning, onTimeout]);

  return {
    timeLeft,
    isRunning,
    start: () => setIsRunning(true),
    pause,
    reset,
  };
}
