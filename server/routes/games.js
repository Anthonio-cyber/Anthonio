import express from 'express';
import { db, get, all, run, getSetting, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can } from '../lib/auth.js';
import { userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { awardXp, grantAchievement, gameStats, xpValue } from '../lib/xp.js';
import { notify } from '../lib/notify.js';
import { toUser } from '../realtime/hub.js';
import { newState, applyMove, TURN_BASED } from '../lib/gamelogic.js';

export const router = express.Router();
router.use(requireAuth);

const RESULTS = ['win', 'loss', 'draw', 'played'];

/**
 * Believable limits for each game, so a score sent straight to the API
 * cannot put an impossible number at the top of the leaderboard.
 * min and max are inclusive; anything outside is clamped into range.
 */
const SCORE_LIMITS = {
  typing:       { min: 0, max: 220 },     // words per minute
  snake:        { min: 0, max: 20000 },
  memory_match: { min: 4, max: 400 },     // moves taken
  reaction:     { min: 90, max: 60000 },  // milliseconds; under 90 is not human
  number_guess: { min: 1, max: 1000 },    // guesses taken
  quiz_battle:  { min: 0, max: 20 },
  tic_tac_toe:  { min: 0, max: 1 },
  connect_four: { min: 0, max: 1 },
  rps:          { min: 0, max: 5 }
};

function clampScore(gameKey, raw) {
  const limit = SCORE_LIMITS[gameKey] || { min: 0, max: 1_000_000 };
  const value = Math.round(Number(raw) || 0);
  return Math.min(limit.max, Math.max(limit.min, value));
}

function gamesEnabled() {
  return getSetting('games_enabled', 'true') === 'true';
}

function loadGame(key) {
  const game = get('SELECT * FROM games WHERE key = ?', String(key));
  if (!game) throw new HttpError(404, 'That game does not exist.');
  if (!game.enabled) throw new HttpError(403, `${game.name} has been switched off by an administrator.`);
  if (!gamesEnabled()) throw new HttpError(403, 'The Gaming Hub is currently closed.');
  return game;
}

const shapeGame = (g) => ({
  key: g.key,
  name: g.name,
  description: g.description,
  icon: g.icon,
  category: g.category,
  enabled: !!g.enabled,
  multiplayer: !!g.multiplayer,
  scoreLabel: g.score_label,
  scoreOrder: g.score_order
});

function shapeMatch(match, viewerId) {
  const state = JSON.parse(match.state_json || '{}');
  const myMark = match.player_x === viewerId ? 'X' : (match.player_o === viewerId ? 'O' : null);
  return {
    id: match.id,
    gameKey: match.game_key,
    status: match.status,
    state,
    myMark,
    turnUserId: match.turn_user,
    myTurn: match.turn_user === viewerId,
    winnerId: match.winner_id,
    playerX: userById(match.player_x),
    playerO: userById(match.player_o),
    createdAt: match.created_at,
    updatedAt: match.updated_at
  };
}

// ---------------------------------------------------------------------------
// The Gaming Hub landing data
// ---------------------------------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const rows = all('SELECT * FROM games ORDER BY category, name');
  const visible = can(req.user, 'games.manage') ? rows : rows.filter((g) => g.enabled);
  res.json({
    games: visible.map(shapeGame),
    hubOpen: gamesEnabled(),
    multiplayerEnabled: getSetting('multiplayer_enabled', 'true') === 'true',
    leaderboardEnabled: getSetting('leaderboard_enabled', 'true') === 'true',
    myStats: gameStats(req.user.id),
    xpRewards: {
      win: xpValue('xp_win', 20),
      challenge: xpValue('xp_challenge', 10),
      tournament: xpValue('xp_tournament', 100)
    }
  });
}));

router.get('/tournaments', wrap(async (req, res) => {
  const rows = all(`
    SELECT t.*, g.name AS game_name FROM tournaments t
    JOIN games g ON g.key = t.game_key
    WHERE t.status != 'finished' ORDER BY t.created_at DESC LIMIT 20`);
  res.json({
    tournaments: rows.map((t) => ({
      id: t.id,
      name: t.name,
      gameKey: t.game_key,
      gameName: t.game_name,
      description: t.description,
      startsAt: t.starts_at,
      endsAt: t.ends_at,
      status: t.status,
      entries: all('SELECT user_id, points FROM tournament_entries WHERE tournament_id = ? ORDER BY points DESC', t.id)
        .map((e) => ({ user: userById(e.user_id), points: e.points })),
      joined: !!get('SELECT 1 AS x FROM tournament_entries WHERE tournament_id = ? AND user_id = ?', t.id, req.user.id)
    }))
  });
}));

router.post('/tournaments/:id/join', wrap(async (req, res) => {
  const t = get('SELECT * FROM tournaments WHERE id = ?', Number(req.params.id));
  if (!t || t.status === 'finished') throw new HttpError(404, 'That tournament is not open.');
  run('INSERT OR IGNORE INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)', t.id, req.user.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Single-player scores
// ---------------------------------------------------------------------------
router.post('/:key/score', wrap(async (req, res) => {
  const game = loadGame(req.params.key);
  const score = clampScore(game.key, req.body.score);
  const result = RESULTS.includes(req.body.result) ? req.body.result : 'played';

  let xp = xpValue('xp_challenge', 10);
  if (result === 'win') xp = xpValue('xp_win', 20);
  else if (result === 'loss') xp = Math.round(xpValue('xp_challenge', 10) / 2);

  // A game takes time to play, so a burst of scores is not real play.
  const recent = get(
    "SELECT COUNT(*) AS n FROM game_scores WHERE user_id = ? AND created_at > datetime('now', '-1 minute')",
    req.user.id
  ).n;
  if (recent >= 12) {
    throw new HttpError(429, 'That is a lot of games very quickly. Take a short break and try again.', 'too_fast');
  }

  run('INSERT INTO game_scores (game_key, user_id, score, result, xp_awarded) VALUES (?, ?, ?, ?, ?)',
    game.key, req.user.id, score, result, xp);
  awardXp(req.user.id, xp, `game:${game.key}`);
  if (result === 'win') {
    const wins = get("SELECT COUNT(*) AS n FROM game_scores WHERE user_id = ? AND result = 'win'", req.user.id).n;
    if (wins === 1) grantAchievement(req.user.id, 'first_win');
  }

  const best = get(
    game.score_order === 'asc'
      ? 'SELECT MIN(score) AS best FROM game_scores WHERE game_key = ? AND user_id = ?'
      : 'SELECT MAX(score) AS best FROM game_scores WHERE game_key = ? AND user_id = ?',
    game.key, req.user.id
  ).best;

  res.json({ ok: true, xpAwarded: xp, personalBest: best, stats: gameStats(req.user.id) });
}));

router.get('/:key/scores', wrap(async (req, res) => {
  const game = get('SELECT * FROM games WHERE key = ?', String(req.params.key));
  if (!game) throw new HttpError(404, 'That game does not exist.');
  const order = game.score_order === 'asc' ? 'ASC' : 'DESC';
  const rows = all(`
    SELECT user_id, ${game.score_order === 'asc' ? 'MIN' : 'MAX'}(score) AS best, COUNT(*) AS plays
    FROM game_scores WHERE game_key = ?
    GROUP BY user_id ORDER BY best ${order} LIMIT 20`, game.key);
  res.json({
    game: shapeGame(game),
    scores: rows.map((r, i) => ({ rank: i + 1, user: userById(r.user_id), best: r.best, plays: r.plays }))
  });
}));

// ---------------------------------------------------------------------------
// Multiplayer: invitations
// ---------------------------------------------------------------------------
function multiplayerOn() {
  if (getSetting('multiplayer_enabled', 'true') !== 'true') {
    throw new HttpError(403, 'Multiplayer games are switched off right now.');
  }
}

router.get('/invites', wrap(async (req, res) => {
  const incoming = all(`
    SELECT gi.*, g.name AS game_name FROM game_invites gi JOIN games g ON g.key = gi.game_key
    WHERE gi.to_user = ? AND gi.status = 'pending' ORDER BY gi.created_at DESC`, req.user.id);
  const outgoing = all(`
    SELECT gi.*, g.name AS game_name FROM game_invites gi JOIN games g ON g.key = gi.game_key
    WHERE gi.from_user = ? AND gi.status = 'pending' ORDER BY gi.created_at DESC`, req.user.id);
  const shape = (r) => ({
    id: r.id,
    gameKey: r.game_key,
    gameName: r.game_name,
    from: userById(r.from_user),
    to: userById(r.to_user),
    createdAt: r.created_at
  });
  res.json({ incoming: incoming.map(shape), outgoing: outgoing.map(shape) });
}));

router.post('/:key/invite', wrap(async (req, res) => {
  multiplayerOn();
  const game = loadGame(req.params.key);
  if (!game.multiplayer) throw new HttpError(400, `${game.name} is a single-player game.`);
  const toUserId = Number(req.body.userId);
  if (toUserId === req.user.id) throw new HttpError(400, 'You cannot invite yourself.');
  const target = get("SELECT * FROM users WHERE id = ? AND status = 'active'", toUserId);
  if (!target) throw new HttpError(404, 'That classmate could not be found.');
  const blocked = get(`SELECT 1 AS x FROM blocked_users
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
  req.user.id, toUserId, toUserId, req.user.id);
  if (blocked) throw new HttpError(403, 'You cannot invite this person.');

  const existing = get("SELECT * FROM game_invites WHERE game_key = ? AND from_user = ? AND to_user = ? AND status = 'pending'",
    game.key, req.user.id, toUserId);
  if (existing) return res.json({ invite: { id: existing.id }, alreadySent: true });

  const info = run('INSERT INTO game_invites (game_key, from_user, to_user) VALUES (?, ?, ?)', game.key, req.user.id, toUserId);
  const payload = {
    id: info.lastInsertRowid,
    gameKey: game.key,
    gameName: game.name,
    from: userById(req.user.id)
  };
  toUser(toUserId, 'game:invite', payload);
  notify(toUserId, {
    kind: 'game_invite',
    title: `${req.user.display_name} invited you to ${game.name}`,
    body: 'Open the Gaming Hub to accept or decline.',
    link: '#/games',
    actorId: req.user.id
  });
  return res.status(201).json({ invite: payload });
}));

router.post('/invites/:id/respond', wrap(async (req, res) => {
  const invite = get('SELECT * FROM game_invites WHERE id = ?', Number(req.params.id));
  if (!invite) throw new HttpError(404, 'That invitation is gone.');
  if (invite.to_user !== req.user.id) throw new HttpError(403, 'That invitation is not for you.');
  if (invite.status !== 'pending') throw new HttpError(409, 'That invitation was already answered.');

  if (req.body.action === 'decline') {
    run("UPDATE game_invites SET status = 'declined' WHERE id = ?", invite.id);
    toUser(invite.from_user, 'game:invite_declined', { id: invite.id, by: userById(req.user.id) });
    notify(invite.from_user, {
      kind: 'game_invite',
      title: `${req.user.display_name} declined your game invitation`,
      link: '#/games',
      actorId: req.user.id
    });
    return res.json({ status: 'declined' });
  }

  multiplayerOn();
  const game = loadGame(invite.game_key);
  const state = newState(game.key);
  const create = db.transaction(() => {
    const info = run(`
      INSERT INTO game_matches (game_key, player_x, player_o, state_json, turn_user)
      VALUES (?, ?, ?, ?, ?)`,
    game.key, invite.from_user, req.user.id, JSON.stringify(state),
    TURN_BASED.has(game.key) ? invite.from_user : null);
    run("UPDATE game_invites SET status = 'accepted', match_id = ? WHERE id = ?", info.lastInsertRowid, invite.id);
    return info.lastInsertRowid;
  });
  const matchId = create();
  const match = get('SELECT * FROM game_matches WHERE id = ?', matchId);

  toUser(invite.from_user, 'game:match_started', { match: shapeMatch(match, invite.from_user) });
  toUser(req.user.id, 'game:match_started', { match: shapeMatch(match, req.user.id) });
  notify(invite.from_user, {
    kind: 'game_invite',
    title: `${req.user.display_name} accepted your ${game.name} invitation`,
    body: 'The match is ready.',
    link: `#/games/${game.key}?match=${matchId}`,
    actorId: req.user.id
  });

  return res.json({ status: 'accepted', match: shapeMatch(match, req.user.id) });
}));

router.delete('/invites/:id', wrap(async (req, res) => {
  const invite = get('SELECT * FROM game_invites WHERE id = ?', Number(req.params.id));
  if (!invite) throw new HttpError(404, 'That invitation is gone.');
  if (invite.from_user !== req.user.id) throw new HttpError(403, 'You can only cancel your own invitations.');
  run("UPDATE game_invites SET status = 'cancelled' WHERE id = ?", invite.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Multiplayer: matches
// ---------------------------------------------------------------------------
router.get('/matches', wrap(async (req, res) => {
  const rows = all(`
    SELECT * FROM game_matches
    WHERE (player_x = ? OR player_o = ?) AND status = 'active'
    ORDER BY updated_at DESC`, req.user.id, req.user.id);
  res.json({ matches: rows.map((m) => shapeMatch(m, req.user.id)) });
}));

router.get('/matches/:id', wrap(async (req, res) => {
  const match = get('SELECT * FROM game_matches WHERE id = ?', Number(req.params.id));
  if (!match) throw new HttpError(404, 'That match could not be found.');
  if (match.player_x !== req.user.id && match.player_o !== req.user.id) {
    throw new HttpError(403, 'You are not playing in that match.');
  }
  res.json({ match: shapeMatch(match, req.user.id) });
}));

router.post('/matches/:id/move', wrap(async (req, res) => {
  const match = get('SELECT * FROM game_matches WHERE id = ?', Number(req.params.id));
  if (!match) throw new HttpError(404, 'That match could not be found.');
  if (match.status !== 'active') throw new HttpError(409, 'That match has already finished.');

  const mark = match.player_x === req.user.id ? 'X' : (match.player_o === req.user.id ? 'O' : null);
  if (!mark) throw new HttpError(403, 'You are not playing in that match.');
  if (TURN_BASED.has(match.game_key) && match.turn_user !== req.user.id) {
    throw new HttpError(409, 'It is not your turn yet.');
  }

  let outcome;
  try {
    outcome = applyMove(match.game_key, JSON.parse(match.state_json || '{}'), mark, req.body.move || req.body);
  } catch (err) {
    throw new HttpError(400, err.message || 'That move is not allowed.');
  }

  const opponentId = mark === 'X' ? match.player_o : match.player_x;
  let winnerId = null;
  if (outcome.finished && outcome.winnerMark) {
    winnerId = outcome.winnerMark === 'X' ? match.player_x : match.player_o;
  }

  const nextTurn = TURN_BASED.has(match.game_key) && !outcome.finished ? opponentId : (outcome.finished ? null : match.turn_user);

  run(`UPDATE game_matches SET state_json = ?, turn_user = ?, status = ?, winner_id = ?, updated_at = datetime('now') WHERE id = ?`,
    JSON.stringify(outcome.state), nextTurn, outcome.finished ? 'finished' : 'active', winnerId, match.id);

  if (outcome.finished) recordMatchResults(match, winnerId, outcome);

  const updated = get('SELECT * FROM game_matches WHERE id = ?', match.id);
  for (const playerId of [match.player_x, match.player_o]) {
    toUser(playerId, 'game:match_update', {
      match: shapeMatch(updated, playerId),
      line: outcome.line || null,
      finished: outcome.finished,
      draw: outcome.draw
    });
  }

  res.json({ match: shapeMatch(updated, req.user.id), line: outcome.line || null, finished: outcome.finished, draw: outcome.draw });
}));

function recordMatchResults(match, winnerId, outcome) {
  const winXp = xpValue('xp_win', 20);
  const playXp = Math.round(xpValue('xp_challenge', 10) / 2);
  const game = get('SELECT * FROM games WHERE key = ?', match.game_key);

  for (const playerId of [match.player_x, match.player_o]) {
    const result = outcome.draw ? 'draw' : (playerId === winnerId ? 'win' : 'loss');
    const xp = result === 'win' ? winXp : playXp;
    run('INSERT INTO game_scores (game_key, user_id, score, result, xp_awarded, match_id) VALUES (?, ?, ?, ?, ?, ?)',
      match.game_key, playerId, result === 'win' ? 1 : 0, result, xp, match.id);
    awardXp(playerId, xp, `match:${match.game_key}`);
    if (result === 'win') {
      const wins = get("SELECT COUNT(*) AS n FROM game_scores WHERE user_id = ? AND result = 'win'", playerId).n;
      if (wins === 1) grantAchievement(playerId, 'first_win');
    }
    notify(playerId, {
      kind: 'game_result',
      title: outcome.draw ? `${game.name}: a draw` : (playerId === winnerId ? `You won at ${game.name}` : `You lost at ${game.name}`),
      body: `+${xp} XP`,
      link: '#/games'
    });
    // Tournament points, if this game has a running tournament.
    const tournament = get("SELECT id FROM tournaments WHERE game_key = ? AND status = 'running'", match.game_key);
    if (tournament && result === 'win') {
      run('UPDATE tournament_entries SET points = points + 1 WHERE tournament_id = ? AND user_id = ?', tournament.id, playerId);
    }
  }
}

router.post('/matches/:id/resign', wrap(async (req, res) => {
  const match = get('SELECT * FROM game_matches WHERE id = ?', Number(req.params.id));
  if (!match) throw new HttpError(404, 'That match could not be found.');
  if (match.player_x !== req.user.id && match.player_o !== req.user.id) throw new HttpError(403, 'You are not playing in that match.');
  if (match.status !== 'active') return res.json({ ok: true });

  const winnerId = match.player_x === req.user.id ? match.player_o : match.player_x;
  run("UPDATE game_matches SET status = 'finished', winner_id = ?, turn_user = NULL, updated_at = datetime('now') WHERE id = ?", winnerId, match.id);
  recordMatchResults(match, winnerId, { draw: false });
  const updated = get('SELECT * FROM game_matches WHERE id = ?', match.id);
  for (const playerId of [match.player_x, match.player_o]) {
    toUser(playerId, 'game:match_update', { match: shapeMatch(updated, playerId), finished: true, resigned: true });
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------
router.get('/leaderboard/:category', wrap(async (req, res) => {
  if (getSetting('leaderboard_enabled', 'true') !== 'true') {
    return res.json({ enabled: false, entries: [] });
  }
  const category = clean(req.params.category, 20);
  const { limit } = parsePage(req.query, 25, 100);
  let rows = [];

  if (category === 'games') {
    rows = all(`
      SELECT gs.user_id, COALESCE(SUM(gs.xp_awarded), 0) AS value,
             SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END) AS wins
      FROM game_scores gs
      JOIN users u ON u.id = gs.user_id AND u.status = 'active'
      GROUP BY gs.user_id ORDER BY value DESC LIMIT ?`, limit);
  } else if (category === 'learning') {
    rows = all(`
      SELECT u.id AS user_id,
             (SELECT COUNT(*) FROM homework_status hs WHERE hs.user_id = u.id AND hs.status = 'completed') * 10
             + COALESCE((SELECT SUM(gs.xp_awarded) FROM game_scores gs JOIN games g ON g.key = gs.game_key
                         WHERE gs.user_id = u.id AND g.category = 'learning'), 0) AS value
      FROM users u WHERE u.status = 'active'
      ORDER BY value DESC LIMIT ?`, limit);
  } else if (category === 'weekly') {
    rows = all(`
      SELECT gs.user_id, COALESCE(SUM(gs.xp_awarded), 0) AS value
      FROM game_scores gs
      JOIN users u ON u.id = gs.user_id AND u.status = 'active'
      WHERE gs.created_at >= datetime('now', '-7 days')
      GROUP BY gs.user_id ORDER BY value DESC LIMIT ?`, limit);
  } else {
    rows = all(`SELECT id AS user_id, xp AS value FROM users WHERE status = 'active' ORDER BY xp DESC LIMIT ?`, limit);
  }

  const entries = rows
    .map((r, i) => ({ rank: i + 1, user: userById(r.user_id), value: r.value || 0, wins: r.wins }))
    .filter((e) => e.user);
  const myRank = entries.findIndex((e) => e.user.id === req.user.id);
  return res.json({ enabled: true, category, entries, myRank: myRank === -1 ? null : myRank + 1 });
}));

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
router.patch('/:key', requirePermission('games.manage'), wrap(async (req, res) => {
  const game = get('SELECT * FROM games WHERE key = ?', String(req.params.key));
  if (!game) throw new HttpError(404, 'That game does not exist.');
  const updates = [];
  const params = [];
  if (req.body.enabled !== undefined) { updates.push('enabled = ?'); params.push(req.body.enabled ? 1 : 0); }
  if (req.body.multiplayer !== undefined) { updates.push('multiplayer = ?'); params.push(req.body.multiplayer ? 1 : 0); }
  if (updates.length) run(`UPDATE games SET ${updates.join(', ')} WHERE key = ?`, ...params, game.key);
  logActivity(req.user.id, 'game.updated', 'game', game.key, JSON.stringify(req.body));
  res.json({ game: shapeGame(get('SELECT * FROM games WHERE key = ?', game.key)) });
}));

router.post('/:key/reset-leaderboard', requirePermission('games.manage'), wrap(async (req, res) => {
  const key = String(req.params.key);
  if (key === 'all') {
    run('DELETE FROM game_scores');
    logActivity(req.user.id, 'game.leaderboard_reset', 'game', 'all');
  } else {
    run('DELETE FROM game_scores WHERE game_key = ?', key);
    logActivity(req.user.id, 'game.leaderboard_reset', 'game', key);
  }
  res.json({ ok: true });
}));

router.post('/tournaments', requirePermission('games.manage'), wrap(async (req, res) => {
  const name = clean(req.body.name, 80);
  const gameKey = String(req.body.gameKey || '');
  if (!name || !get('SELECT 1 AS x FROM games WHERE key = ?', gameKey)) {
    throw new HttpError(400, 'A tournament needs a name and a valid game.');
  }
  const info = run(`
    INSERT INTO tournaments (name, game_key, description, starts_at, ends_at, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  name, gameKey, clean(req.body.description || '', 400),
  clean(req.body.startsAt || '', 30) || null, clean(req.body.endsAt || '', 30) || null,
  req.body.status === 'running' ? 'running' : 'open', req.user.id);
  logActivity(req.user.id, 'tournament.created', 'tournament', info.lastInsertRowid, name);
  res.status(201).json({ id: info.lastInsertRowid });
}));

router.patch('/tournaments/:id', requirePermission('games.manage'), wrap(async (req, res) => {
  const t = get('SELECT * FROM tournaments WHERE id = ?', Number(req.params.id));
  if (!t) throw new HttpError(404, 'That tournament could not be found.');
  const status = ['open', 'running', 'finished'].includes(req.body.status) ? req.body.status : t.status;
  run('UPDATE tournaments SET status = ? WHERE id = ?', status, t.id);

  if (status === 'finished') {
    const top = get('SELECT user_id FROM tournament_entries WHERE tournament_id = ? ORDER BY points DESC LIMIT 1', t.id);
    if (top) {
      awardXp(top.user_id, xpValue('xp_tournament', 100), 'tournament');
      notify(top.user_id, {
        kind: 'game_result',
        title: `You won the ${t.name} tournament`,
        body: `+${xpValue('xp_tournament', 100)} XP`,
        link: '#/leaderboard'
      });
    }
  }
  logActivity(req.user.id, 'tournament.updated', 'tournament', t.id, status);
  res.json({ ok: true, status });
}));
