// ==========================================================
// Talks to the Coding Hub server. Every call returns parsed JSON
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
  const init = { method, credentials: 'same-origin', headers: {}, ...options };

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
    progress: (username) => request('GET', `/users/${encodeURIComponent(username)}/progress`),
    leaderboard: (category) => request('GET', `/users/leaderboard/${category}`),
    badges: () => request('GET', '/users/me/badges'),
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

  messages: {
    conversations: () => request('GET', '/messages/conversations'),
    unread: () => request('GET', '/messages/unread-count'),
    openWith: (userId) => request('POST', `/messages/conversations/with/${userId}`),
    thread: (id, query = '') => request('GET', `/messages/conversations/${id}/messages${query}`),
    send: (id, formData) => request('POST', `/messages/conversations/${id}/messages`, formData),
    edit: (messageId, body) => request('PATCH', `/messages/${messageId}`, { body }),
    remove: (messageId, forEveryone = true, reason = '') =>
      request('DELETE', `/messages/${messageId}`, { forEveryone, reason }),
    react: (messageId, emoji) => request('POST', `/messages/${messageId}/react`, { emoji }),
    markRead: (id) => request('POST', `/messages/conversations/${id}/read`)
  },

  // ---- The learning platform ----
  learn: {
    overview: () => request('GET', '/learn/overview'),
    subjects: () => request('GET', '/learn/subjects'),
    subject: (key) => request('GET', `/learn/subjects/${encodeURIComponent(key)}`),
    topic: (id) => request('GET', `/learn/topics/${id}`),
    lesson: (id) => request('GET', `/learn/lessons/${id}`),
    completeLesson: (id) => request('POST', `/learn/lessons/${id}/complete`),
    reopenLesson: (id) => request('POST', `/learn/lessons/${id}/reopen`),
    challenges: () => request('GET', '/learn/challenges'),
    completeChallenge: (id, solution) => request('POST', `/learn/challenges/${id}/complete`, { solution }),
    resetChallenge: (id) => request('POST', `/learn/challenges/${id}/reset`),
    practice: (query = '') => request('GET', `/learn/practice${query}`),
    answer: (id, answer) => request('POST', `/learn/questions/${id}/answer`, { answer }),
    question: (id) => request('GET', `/learn/questions/${id}`),
    bookmarks: () => request('GET', '/learn/bookmarks'),
    toggleBookmark: (kind, refId) => request('POST', '/learn/bookmarks', { kind, refId }),
    progress: () => request('GET', '/learn/progress'),
    history: (query = '') => request('GET', `/learn/history${query}`),
    search: (term) => request('GET', `/learn/search?q=${encodeURIComponent(term)}`)
  },

  // ---- Content management ----
  curriculum: {
    subjects: () => request('GET', '/curriculum/subjects'),
    createSubject: (data) => request('POST', '/curriculum/subjects', data),
    updateSubject: (id, data) => request('PATCH', `/curriculum/subjects/${id}`, data),
    reorderSubjects: (order) => request('POST', '/curriculum/subjects/reorder', { order }),
    deleteSubject: (id) => request('DELETE', `/curriculum/subjects/${id}`),

    topics: (query = '') => request('GET', `/curriculum/topics${query}`),
    createTopic: (data) => request('POST', '/curriculum/topics', data),
    updateTopic: (id, data) => request('PATCH', `/curriculum/topics/${id}`, data),
    reorderTopics: (order) => request('POST', '/curriculum/topics/reorder', { order }),
    deleteTopic: (id) => request('DELETE', `/curriculum/topics/${id}`),

    lessons: (query = '') => request('GET', `/curriculum/lessons${query}`),
    lesson: (id) => request('GET', `/curriculum/lessons/${id}`),
    createLesson: (data) => request('POST', '/curriculum/lessons', data),
    updateLesson: (id, data) => request('PATCH', `/curriculum/lessons/${id}`, data),
    duplicateLesson: (id) => request('POST', `/curriculum/lessons/${id}/duplicate`),
    reorderLessons: (order) => request('POST', '/curriculum/lessons/reorder', { order }),
    deleteLesson: (id) => request('DELETE', `/curriculum/lessons/${id}`),
    lessonVersion: (id, version) => request('GET', `/curriculum/lessons/${id}/versions/${version}`),
    restoreVersion: (id, version) => request('POST', `/curriculum/lessons/${id}/restore/${version}`),

    createChallenge: (lessonId, data) => request('POST', `/curriculum/lessons/${lessonId}/challenges`, data),
    updateChallenge: (id, data) => request('PATCH', `/curriculum/challenges/${id}`, data),
    deleteChallenge: (id) => request('DELETE', `/curriculum/challenges/${id}`),

    questions: (query = '') => request('GET', `/curriculum/questions${query}`),
    createQuestion: (data) => request('POST', '/curriculum/questions', data),
    createQuestions: (data) => request('POST', '/curriculum/questions/batch', data),
    updateQuestion: (id, data) => request('PATCH', `/curriculum/questions/${id}`, data),
    duplicateQuestion: (id) => request('POST', `/curriculum/questions/${id}/duplicate`),
    deleteQuestion: (id) => request('DELETE', `/curriculum/questions/${id}`),
    bulkQuestions: (data) => request('POST', '/curriculum/questions/bulk', data),
    exportQuestions: (query = '') => request('GET', `/curriculum/questions/export${query}`),
    importQuestions: (data) => request('POST', '/curriculum/questions/import', data),

    analytics: () => request('GET', '/curriculum/analytics'),
    learner: (id) => request('GET', `/curriculum/learners/${id}`)
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
    setStatus: (id, status, reason) => request('POST', `/admin/users/${id}/status`, { status, reason }),
    restrict: (id, canMessage) => request('POST', `/admin/users/${id}/restrict`, { canMessage }),
    resetPassword: (id, password) => request('POST', `/admin/users/${id}/reset-password`, { password }),
    adjustXp: (id, delta) => request('POST', `/admin/users/${id}/xp`, { delta }),
    resetProgress: (id) => request('POST', `/admin/users/${id}/reset-progress`),
    setBadge: (id, key, remove) => request('POST', `/admin/users/${id}/badge`, { key, remove }),
    deleteUser: (id, hard) => request('DELETE', `/admin/users/${id}`, { hard }),

    badges: () => request('GET', '/admin/badges'),
    createBadge: (data) => request('POST', '/admin/badges', data),
    updateBadge: (key, data) => request('PATCH', `/admin/badges/${key}`, data),
    deleteBadge: (key) => request('DELETE', `/admin/badges/${key}`),

    invitations: () => request('GET', '/admin/invitations'),
    createInvitation: (data) => request('POST', '/admin/invitations', data),
    revokeInvitation: (id) => request('POST', `/admin/invitations/${id}/revoke`),

    roles: () => request('GET', '/admin/roles'),
    setPermission: (id, data) => request('POST', `/admin/users/${id}/permissions`, data),
    settings: () => request('GET', '/admin/settings'),
    updateSettings: (data) => request('PATCH', '/admin/settings', data),
    logs: (query = '') => request('GET', `/admin/logs${query}`),
    analytics: () => request('GET', '/admin/analytics'),
    messageStats: () => request('GET', '/admin/messages/stats'),
    messageAccessLog: () => request('GET', '/admin/messages/access-log')
  }
};
