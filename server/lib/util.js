import crypto from 'node:crypto';

export const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** XP -> level curve. Level 1 starts at 0 XP, each level costs a bit more. */
export function levelFromXp(xp) {
  let level = 1;
  let needed = 100;
  let remaining = Math.max(0, xp || 0);
  while (remaining >= needed && level < 100) {
    remaining -= needed;
    level += 1;
    needed = Math.round(needed * 1.25);
  }
  return { level, intoLevel: remaining, needed, progress: Math.round((remaining / needed) * 100) };
}

export function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'club';
}

export function inviteCode(prefix = 'GRADE8') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
  return `${prefix}-${out}`;
}

export function pairKey(a, b) {
  const [x, y] = [Number(a), Number(b)].sort((m, n) => m - n);
  return `${x}:${y}`;
}

/** Small HTTP error helper so routes can `throw new HttpError(403, '...')`. */
export class HttpError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Wraps an async route so rejected promises reach the error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Trims text and strips invisible control characters before storing it. */
export function clean(text, max = 5000) {
  const raw = String(text ?? '');
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (code === 127) continue;
    if (code < 32 && ch !== '\n' && ch !== '\t') continue;
    out += ch;
  }
  return out.trim().slice(0, max);
}

export function parsePage(query, defaultLimit = 20, maxLimit = 100) {
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { limit, offset };
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`, 'missing_fields');
}
