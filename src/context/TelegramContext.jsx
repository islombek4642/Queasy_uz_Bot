// src/context/TelegramContext.jsx
import React, { createContext, useEffect, useState, useMemo } from 'react';

export const TelegramContext = createContext(null);

export function TelegramProvider({ children }) {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        setUser(tgUser);
      } else {
        // Fallback for development preview
        setUser({
          id: 8756078762,
          first_name: 'Islombek',
          username: 'islombek_dev',
        });
      }
    } else {
      setUser({
        id: 8756078762,
        first_name: 'Guest Player',
        username: 'guest',
      });
    }
  }, [tg]);

  const haptic = useMemo(
    () => ({
      impact: (style = 'light') => {
        try {
          tg?.HapticFeedback?.impactOccurred(style);
        } catch {}
      },
      notification: (type = 'success') => {
        try {
          tg?.HapticFeedback?.notificationOccurred(type);
        } catch {}
      },
      selection: () => {
        try {
          tg?.HapticFeedback?.selectionChanged();
        } catch {}
      },
    }),
    [tg]
  );

  const backButton = useMemo(
    () => ({
      show: (callback) => {
        if (tg?.BackButton) {
          tg.BackButton.show();
          if (callback) {
            tg.BackButton.onClick(callback);
          }
        }
      },
      hide: (callback) => {
        if (tg?.BackButton) {
          tg.BackButton.hide();
          if (callback) {
            tg.BackButton.offClick(callback);
          }
        }
      },
    }),
    [tg]
  );

  return (
    <TelegramContext.Provider
      value={{
        tg,
        user,
        haptic,
        backButton,
        close: () => tg?.close(),
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}
