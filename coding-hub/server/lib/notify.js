import { run, get } from '../db/index.js';
import { toUser } from '../realtime/hub.js';

/**
 * Stores a notification and pushes it to the member straight away
 * so the bell counter updates without a refresh.
 */
export function notify(userId, { kind, title, body = '', link = '', actorId = null }) {
  if (!userId) return null;
  const info = run(
    'INSERT INTO notifications (user_id, kind, title, body, link, actor_id) VALUES (?, ?, ?, ?, ?, ?)',
    userId, kind, title, body, link, actorId
  );
  const row = get('SELECT * FROM notifications WHERE id = ?', info.lastInsertRowid);
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', userId).n;
  toUser(userId, 'notification:new', { notification: row, unread });
  return row;
}

/** Notify a list of members at once (skipping the person who caused it). */
export function notifyMany(userIds, payload, exceptId = null) {
  for (const id of new Set(userIds)) {
    if (exceptId && Number(id) === Number(exceptId)) continue;
    notify(id, payload);
  }
}
