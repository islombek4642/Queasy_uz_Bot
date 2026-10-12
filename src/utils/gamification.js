// src/utils/gamification.js

export function calculateLevelProgress(xp = 0) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(safeXp / 100) + 1;
  const currentLevelXp = safeXp % 100;
  const nextLevelXp = 100;
  const percentage = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));

  let rankKey = 'RANK_NOVICE';
  let rankColor = '#94a3b8'; // gray/novice

  if (level >= 20) {
    rankKey = 'RANK_MASTER';
    rankColor = '#ef4444'; // red/mythic
  } else if (level >= 10) {
    rankKey = 'RANK_SCHOLAR';
    rankColor = '#8b5cf6'; // purple/scholar
  } else if (level >= 5) {
    rankKey = 'RANK_EXPLORER';
    rankColor = '#3b82f6'; // blue/explorer
  }

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    percentage,
    rankKey,
    rankColor,
  };
}
