import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config, isProduction } from './config.js';
import { get, all, run } from '../db/index.js';
import { HttpError } from './util.js';
import { roleRank } from './permissions.js';

export const COOKIE = 'codinghub_session';

export const hashPassword = (plain) => bcrypt.hashSync(String(plain), 10);
export const checkPassword = (plain, hash) => bcrypt.compareSync(String(plain), String(hash || ''));

export function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, v: 1 }, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000
  });
  return token;
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: isProduction });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

/** Loads a user together with the permissions their role grants. */
export function loadUser(id) {
  const user = get(`
    SELECT u.*, p.avatar_url, p.cover_url, p.bio, p.location, p.website,
           p.theme, p.accent, p.streak_days, p.streak_date,
           p.who_can_message, p.show_online, p.show_last_seen, p.read_receipts,
           r.name AS role_name, r.rank AS role_rank
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN roles r ON r.key = u.role_key
    WHERE u.id = ?`, id);
  if (!user) return null;
  user.permissions = permissionsFor(user);
  return user;
}

export function permissionsFor(user) {
  const rolePerms = all('SELECT permission_key FROM role_permissions WHERE role_key = ?', user.role_key)
    .map((r) => r.permission_key);
  const overrides = all('SELECT permission_key, granted FROM user_permissions WHERE user_id = ?', user.id);
  const set = new Set(rolePerms);
  for (const o of overrides) {
    if (o.granted) set.add(o.permission_key);
    else set.delete(o.permission_key);
  }
  return [...set];
}

export function tokenFromRequest(req) {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Attaches req.user when a valid session cookie is present. Never throws. */
export function attachUser(req, _res, next) {
  const token = tokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (payload?.uid) {
    const user = loadUser(payload.uid);
    if (user && user.status === 'active') {
      req.user = user;
      touchPresence(user.id);
    } else if (user) {
      req.suspendedUser = user;
    }
  }
  next();
}

const lastTouch = new Map();

export function touchPresence(userId) {
  const now = Date.now();
  if (now - (lastTouch.get(userId) || 0) < 30_000) return;
  lastTouch.set(userId, now);
  run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", userId);
  updateStreak(userId);
}

export function updateStreak(userId) {
  const profile = get('SELECT streak_days, streak_date FROM profiles WHERE user_id = ?', userId);
  if (!profile) return;
  const today = new Date().toISOString().slice(0, 10);
  if (profile.streak_date === today) return;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const days = profile.streak_date === yesterday ? (profile.streak_days || 0) + 1 : 1;
  run('UPDATE profiles SET streak_days = ?, streak_date = ? WHERE user_id = ?', days, today, userId);
}

/** Blocks the request unless somebody is signed in. */
export function requireAuth(req, _res, next) {
  if (req.suspendedUser) {
    const message = `This account is ${req.suspendedUser.status}. ${req.suspendedUser.suspend_reason || ''}`.trim();
    return next(new HttpError(403, message, `account_${req.suspendedUser.status}`));
  }
  if (!req.user) return next(new HttpError(401, 'Please sign in to use the Coding Hub.', 'unauthenticated'));
  return next();
}

/** Blocks the request unless the signed-in member holds every listed permission. */
export function requirePermission(...keys) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in.', 'unauthenticated'));
    const missing = keys.filter((k) => !req.user.permissions.includes(k));
    if (missing.length) {
      return next(new HttpError(403, `You do not have permission to do that (${missing.join(', ')}).`, 'forbidden'));
    }
    return next();
  };
}

export const can = (user, key) => Boolean(user?.permissions?.includes(key));

/** A member may only act on somebody whose role sits below their own. */
export function outranks(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return true;
  return roleRank(actor.role_key) > roleRank(target.role_key);
}
