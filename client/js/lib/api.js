// ==========================================================
// Talks to the Grade 8 Hub server. Every call returns parsed JSON
// and throws a readable Error when something goes wrong.
// ==========================================================

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body, options = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: {},
    ...options
  };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the server. Check that it is still running.', 0, 'offline');
  }

  if (response.status === 204) return null;

  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { error: text }; }
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status, payload?.code);
  }
  return payload;
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  delete: (path, body, options) => request('DELETE', path, body, options),

  // ---- Convenience wrappers used across the app ----
  auth: {
    config: () => request('GET', '/auth/config'),
    me: () => request('GET', '/auth/me'),
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    register: (data) => request('POST', '/auth/register', data),
    checkInvite: (code) => request('GET', `/auth/invite/${encodeURIComponent(code)}`),
    logout: () => request('POST', '/auth/logout'),
    changePassword: (currentPassword, newPassword) =>
      request('POST', '/auth/change-password', { currentPassword, newPassword })
  },

  dashboard: () => request('GET', '/dashboard'),

  users: {
    list: (query = '') => request('GET', `/users${query}`),
    online: () => request('GET', '/users/online'),
    profile: (username) => request('GET', `/users/${encodeURIComponent(username)}`),
    posts: (username) => request('GET', `/users/${encodeURIComponent(username)}/posts`),
    updateMe: (data) => request('PATCH', '/users/me', data),
    uploadAvatar: (formData) => request('POST', '/users/me/avatar', formData),
    uploadCover: (formData) => request('POST', '/users/me/cover', formData),
    connect: (id) => request('POST', `/users/${id}/connect`),
    disconnect: (id) => request('DELETE', `/users/${id}/connect`),
    connections: () => request('GET', '/users/me/connections'),
    block: (id) => request('POST', `/users/${id}/block`),
    unblock: (id) => request('DELETE', `/users/${id}/block`),
    blocked: () => request('GET', '/users/me/blocked')
  },

  posts: {
    feed: (query = '') => request('GET', `/posts${query}`),
    one: (id) => request('GET', `/posts/${id}`),
    create: (formData) => request('POST', '/posts', formData),
    update: (id, content) => request('PATCH', `/posts/${id}`, { content }),
    remove: (id) => request('DELETE', `/posts/${id}`),
    like: (id) => request('POST', `/posts/${id}/like`),
    save: (id) => request('POST', `/posts/${id}/save`),
    hide: (id) => request('POST', `/posts/${id}/hide`),
    pin: (id) => request('POST', `/posts/${id}/pin`),
    vote: (id, optionIndex) => request('POST', `/posts/${id}/vote`, { optionIndex }),
    share: (id, userId) => request('POST', `/posts/${id}/share`, { userId }),
    comments: (id) => request('GET', `/posts/${id}/comments`),
    comment: (id, content) => request('POST', `/posts/${id}/comments`, { content }),
    editComment: (commentId, content) => request('PATCH', `/posts/comments/${commentId}`, { content }),
    deleteComment: (commentId) => request('DELETE', `/posts/comments/${commentId}`)
  },

  messages: {
    conversations: () => request('GET', '/messages/conversations'),
    unread: () => request('GET', '/messages/unread-count'),
    openWith: (userId) => request('POST', `/messages/conversations/with/${userId}`),
    thread: (id, query = '') => request('GET', `/messages/conversations/${id}/messages${query}`),
    send: (id, formData) => request('POST', `/messages/conversations/${id}/messages`, formData),
    edit: (messageId, body) => request('PATCH', `/messages/${messageId}`, { body }),
    remove: (messageId) => request('DELETE', `/messages/${messageId}`),
    react: (messageId, emoji) => request('POST', `/messages/${messageId}/react`, { emoji }),
    markRead: (id) => request('POST', `/messages/conversations/${id}/read`)
  },

  clubs: {
    list: (query = '') => request('GET', `/clubs${query}`),
    popular: () => request('GET', '/clubs/popular'),
    one: (id) => request('GET', `/clubs/${id}`),
    create: (formData) => request('POST', '/clubs', formData),
    update: (id, formData) => request('PATCH', `/clubs/${id}`, formData),
    remove: (id) => request('DELETE', `/clubs/${id}`),
    join: (id, message) => request('POST', `/clubs/${id}/join`, { message }),
    leave: (id) => request('POST', `/clubs/${id}/leave`),
    respondRequest: (id, requestId, action) => request('POST', `/clubs/${id}/requests/${requestId}`, { action }),
    invite: (id, userId) => request('POST', `/clubs/${id}/invite`, { userId }),
    removeMember: (id, userId) => request('DELETE', `/clubs/${id}/members/${userId}`),
    setRole: (id, userId, role) => request('PATCH', `/clubs/${id}/members/${userId}`, { role }),
    transfer: (id, userId) => request('POST', `/clubs/${id}/transfer`, { userId }),
    createEvent: (id, data) => request('POST', `/clubs/${id}/events`, data),
    deleteEvent: (id, eventId) => request('DELETE', `/clubs/${id}/events/${eventId}`)
  },

  homework: {
    list: (query = '') => request('GET', `/homework${query}`),
    one: (id) => request('GET', `/homework/${id}`),
    create: (formData) => request('POST', '/homework', formData),
    update: (id, formData) => request('PATCH', `/homework/${id}`, formData),
    remove: (id) => request('DELETE', `/homework/${id}`),
    setStatus: (id, status, note) => request('POST', `/homework/${id}/status`, { status, note }),
    remind: (id, message) => request('POST', `/homework/${id}/remind`, { message }),
    stats: (id) => request('GET', `/homework/${id}/stats`)
  },

  announcements: {
    list: (query = '') => request('GET', `/announcements${query}`),
    one: (id) => request('GET', `/announcements/${id}`),
    create: (data) => request('POST', '/announcements', data),
    update: (id, data) => request('PATCH', `/announcements/${id}`, data),
    pin: (id) => request('POST', `/announcements/${id}/pin`),
    remove: (id) => request('DELETE', `/announcements/${id}`),
    markRead: (id) => request('POST', `/announcements/${id}/read`)
  },

  notifications: {
    list: (query = '') => request('GET', `/notifications${query}`),
    count: () => request('GET', '/notifications/count'),
    markRead: (id) => request('POST', `/notifications/${id}/read`),
    markAllRead: () => request('POST', '/notifications/read-all'),
    remove: (id) => request('DELETE', `/notifications/${id}`),
    clear: () => request('DELETE', '/notifications')
  },

  games: {
    hub: () => request('GET', '/games'),
    submitScore: (key, score, result) => request('POST', `/games/${key}/score`, { score, result }),
    scores: (key) => request('GET', `/games/${key}/scores`),
    leaderboard: (category) => request('GET', `/games/leaderboard/${category}`),
    invites: () => request('GET', '/games/invites'),
    invite: (key, userId) => request('POST', `/games/${key}/invite`, { userId }),
    respondInvite: (id, action) => request('POST', `/games/invites/${id}/respond`, { action }),
    cancelInvite: (id) => request('DELETE', `/games/invites/${id}`),
    matches: () => request('GET', '/games/matches'),
    match: (id) => request('GET', `/games/matches/${id}`),
    move: (id, move) => request('POST', `/games/matches/${id}/move`, { move }),
    resign: (id) => request('POST', `/games/matches/${id}/resign`),
    setGame: (key, data) => request('PATCH', `/games/${key}`, data),
    resetLeaderboard: (key) => request('POST', `/games/${key}/reset-leaderboard`),
    tournaments: () => request('GET', '/games/tournaments'),
    createTournament: (data) => request('POST', '/games/tournaments', data),
    updateTournament: (id, data) => request('PATCH', `/games/tournaments/${id}`, data),
    joinTournament: (id) => request('POST', `/games/tournaments/${id}/join`)
  },

  reports: {
    create: (data) => request('POST', '/reports', data),
    list: (query = '') => request('GET', `/reports${query}`),
    resolve: (id, data) => request('POST', `/reports/${id}/resolve`, data),
    accessLog: () => request('GET', '/reports/message-access-log')
  },

  admin: {
    stats: () => request('GET', '/admin/stats'),
    users: (query = '') => request('GET', `/admin/users${query}`),
    user: (id) => request('GET', `/admin/users/${id}`),
    createUser: (data) => request('POST', '/admin/users', data),
    updateUser: (id, data) => request('PATCH', `/admin/users/${id}`, data),
    setRole: (id, role) => request('POST', `/admin/users/${id}/role`, { role }),
    suspend: (id, suspend, reason) => request('POST', `/admin/users/${id}/suspend`, { suspend, reason }),
    restrict: (id, data) => request('POST', `/admin/users/${id}/restrict`, data),
    resetPassword: (id, password) => request('POST', `/admin/users/${id}/reset-password`, { password }),
    deleteUser: (id, hard) => request('DELETE', `/admin/users/${id}`, { hard }),
    adjustXp: (id, delta) => request('POST', `/admin/users/${id}/xp`, { delta }),
    setBadge: (id, key, remove) => request('POST', `/admin/users/${id}/badge`, { key, remove }),
    badges: () => request('GET', '/admin/badges'),
    clubs: (query = '') => request('GET', `/admin/clubs${query}`),
    setClubStatus: (id, status, note) => request('POST', `/admin/clubs/${id}/status`, { status, note }),
    deleteClub: (id) => request('DELETE', `/admin/clubs/${id}`),
    invitations: () => request('GET', '/admin/invitations'),
    createInvitation: (data) => request('POST', '/admin/invitations', data),
    revokeInvitation: (id) => request('POST', `/admin/invitations/${id}/revoke`),
    settings: () => request('GET', '/admin/settings'),
    updateSettings: (data) => request('PATCH', '/admin/settings', data),
    roles: () => request('GET', '/admin/roles'),
    setPermission: (id, data) => request('POST', `/admin/users/${id}/permissions`, data),
    logs: (query = '') => request('GET', `/admin/logs${query}`)
  }
};
