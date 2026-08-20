import { get, all, run, getSetting } from '../db/index.js';
import { levelFromXp } from './util.js';
import { notify } from './notify.js';
import { toUser } from '../realtime/hub.js';

export function xpValue(key, fallback) {
  const raw = getSetting(key, String(fallback));
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Adds XP, keeps the level in sync and tells the member when they level up. */
export function awardXp(userId, amount, reason = '') {
  if (!amount) return null;
  const before = get('SELECT xp FROM users WHERE id = ?', userId);
  if (!before) return null;
  const beforeLevel = levelFromXp(before.xp).level;
  const nextXp = Math.max(0, before.xp + Number(amount));
  run('UPDATE users SET xp = ? WHERE id = ?', nextXp, userId);
  const after = levelFromXp(nextXp);

  toUser(userId, 'xp:changed', { xp: nextXp, ...after, reason, delta: Number(amount) });

  if (after.level > beforeLevel) {
    notify(userId, {
      kind: 'achievement',
      title: `Level ${after.level} reached`,
      body: `You now have ${nextXp} XP. Keep going!`,
      link: '#/profile'
    });
    if (after.level >= 5) grantAchievement(userId, 'level_5');
  }
  return { xp: nextXp, ...after };
}

/** Gives a badge once; repeated calls are harmless. */
export function grantAchievement(userId, key, awardedBy = null) {
  const achievement = get('SELECT * FROM achievements WHERE key = ?', key);
  if (!achievement) return null;
  const existing = get('SELECT 1 AS x FROM user_achievements WHERE user_id = ? AND achievement_key = ?', userId, key);
  if (existing) return null;
  run('INSERT INTO user_achievements (user_id, achievement_key, awarded_by) VALUES (?, ?, ?)', userId, key, awardedBy);
  notify(userId, {
    kind: 'achievement',
    title: `Badge unlocked: ${achievement.name}`,
    body: achievement.description,
    link: '#/profile'
  });
  return achievement;
}

/** Game statistics used on profiles and the leaderboard. */
export function gameStats(userId) {
  const row = get(`
    SELECT COUNT(*) AS played,
           SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
           SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws,
           COALESCE(SUM(xp_awarded), 0) AS game_xp
    FROM game_scores WHERE user_id = ?`, userId);
  const best = all(`
    SELECT gs.game_key, g.name, g.score_label, g.score_order,
           CASE WHEN g.score_order = 'asc' THEN MIN(gs.score) ELSE MAX(gs.score) END AS best
    FROM game_scores gs JOIN games g ON g.key = gs.game_key
    WHERE gs.user_id = ? GROUP BY gs.game_key`, userId);
  return {
    played: row?.played || 0,
    wins: row?.wins || 0,
    losses: row?.losses || 0,
    draws: row?.draws || 0,
    gameXp: row?.game_xp || 0,
    best
  };
}
