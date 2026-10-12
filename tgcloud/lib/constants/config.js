// tgcloud/lib/constants/config.js
// Global project configuration and Telegram limits

export const CONFIG = {
  // Telegram Bot limits for native polls
  POLL: {
    MIN_OPTIONS: 2,
    MAX_OPTIONS: 10,
    MAX_QUESTION_LENGTH: 300,
    MAX_OPTION_LENGTH: 100,
    MAX_EXPLANATION_LENGTH: 200,
    DEFAULT_TIME_LIMIT: 30,
    ALLOWED_TIME_LIMITS: [10, 15, 30, 45, 60, 120, 180, 300],
    MIN_DURATION: 10,
    MAX_DURATION: 600,
  },

  // Pagination sizes
  PAGINATION: {
    MY_QUIZZES: 8,
    USERS: 10,
    GROUPS: 10,
    LEADERBOARD: 10,
  },

  // Bot profile
  BOT: {
    USERNAME: 'Queasy_uz_Bot',
    ID: 8869835041,
    APP_ID: 'app8869835041',
    WEBAPP_URL: 'https://app8869835041.tgcloud.ai/',
  },

  // Localization settings
  I18N: {
    DEFAULT_LANG: 'UZ',
    SUPPORTED: ['UZ', 'RU', 'EN'],
  },

  // Admin and permissions
  ADMINS: [
    8756078762, // Islombek (Primary Admin)
    8869835041, // Bot App Owner
  ],

  // Max batch size for broadcast
  BROADCAST: {
    CHUNK_SIZE: 25,
    DELAY_MS: 50,
  },
};

export default CONFIG;
