// ==========================================================
// A tiny wrapper around Socket.IO so any route can push a live
// update without importing the whole realtime layer.
// ==========================================================

let io = null;

/** userId -> Set of socket ids */
const online = new Map();

export function setIo(instance) {
  io = instance;
}

export function getIo() {
  return io;
}

export function markOnline(userId, socketId) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
}

export function markOffline(userId, socketId) {
  const set = online.get(userId);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    online.delete(userId);
    return true;
  }
  return false;
}

export const isOnline = (userId) => online.has(Number(userId));
export const onlineIds = () => [...online.keys()];

/** Send an event to every socket belonging to one member. */
export function toUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Send an event to everybody signed in. */
export function toEveryone(event, payload) {
  io?.emit(event, payload);
}

/** Send an event to a conversation room. */
export function toConversation(conversationId, event, payload) {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function toClub(clubId, event, payload) {
  io?.to(`club:${clubId}`).emit(event, payload);
}
