// src/constants/achievements.js

export const ACHIEVEMENTS = [
  {
    id: 'first_step',
    icon: 'solar:flag-2-bold-duotone',
    color: '#3b82f6',
    titleKey: 'ACH_FIRST_STEP_TITLE',
    descKey: 'ACH_FIRST_STEP_DESC',
    checkUnlocked: (stats, user) => (stats?.totalSolved || 0) > 0,
  },
  {
    id: 'sniper',
    icon: 'solar:target-bold-duotone',
    color: '#10b981',
    titleKey: 'ACH_SNIPER_TITLE',
    descKey: 'ACH_SNIPER_DESC',
    checkUnlocked: (stats, user) => (stats?.accuracy || 0) >= 100 && (stats?.totalSolved || 0) > 0,
  },
  {
    id: 'speed_demon',
    icon: 'solar:bolt-bold-duotone',
    color: '#f59e0b',
    titleKey: 'ACH_SPEED_TITLE',
    descKey: 'ACH_SPEED_DESC',
    checkUnlocked: (stats, user) => (user?.xp || 0) >= 200,
  },
  {
    id: 'quiz_master',
    icon: 'solar:cup-star-bold-duotone',
    color: '#8b5cf6',
    titleKey: 'ACH_MASTER_TITLE',
    descKey: 'ACH_MASTER_DESC',
    checkUnlocked: (stats, user) => (stats?.totalSolved || 0) >= 10,
  },
  {
    id: 'level_five',
    icon: 'solar:crown-star-bold-duotone',
    color: '#ec4899',
    titleKey: 'ACH_LEVEL5_TITLE',
    descKey: 'ACH_LEVEL5_DESC',
    checkUnlocked: (stats, user) => (user?.level || 1) >= 5,
  },
  {
    id: 'creator',
    icon: 'solar:pen-new-square-bold-duotone',
    color: '#06b6d4',
    titleKey: 'ACH_CREATOR_TITLE',
    descKey: 'ACH_CREATOR_DESC',
    checkUnlocked: (stats, user, myQuizzes) => Array.isArray(myQuizzes) && myQuizzes.length > 0,
  },
];
