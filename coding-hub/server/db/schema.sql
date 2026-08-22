-- ==========================================================
-- Coding Hub - database schema (SQLite)
--
-- Learn -> Practise -> Build -> Track progress -> Connect -> Chat.
--
-- Every table is created only if it does not already exist, so
-- starting the server never destroys existing data.
-- ==========================================================

PRAGMA foreign_keys = ON;

-- ---------- Roles & permissions -------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rank        INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS permissions (
  key         TEXT PRIMARY KEY,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key       TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- Per-user grants and revokes that override the role defaults.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_key)
);

-- ---------- Accounts --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email          TEXT UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  role_key       TEXT NOT NULL DEFAULT 'user' REFERENCES roles(key),
  status         TEXT NOT NULL DEFAULT 'active',   -- active | suspended | banned | deleted
  suspend_reason TEXT DEFAULT '',
  verified       INTEGER NOT NULL DEFAULT 0,
  can_message    INTEGER NOT NULL DEFAULT 1,
  xp             INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen      TEXT,
  must_change_pw INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url      TEXT DEFAULT '',
  cover_url       TEXT DEFAULT '',
  bio             TEXT DEFAULT '',
  location        TEXT DEFAULT '',
  website         TEXT DEFAULT '',
  theme           TEXT NOT NULL DEFAULT 'dark',
  accent          TEXT NOT NULL DEFAULT 'violet',
  streak_days     INTEGER NOT NULL DEFAULT 0,
  streak_date     TEXT DEFAULT '',
  -- Messaging privacy (spec section 28)
  who_can_message TEXT NOT NULL DEFAULT 'everyone',  -- everyone | registered | connections | nobody
  show_online     INTEGER NOT NULL DEFAULT 1,
  show_last_seen  INTEGER NOT NULL DEFAULT 1,
  read_receipts   INTEGER NOT NULL DEFAULT 1
);

-- "People they follow / connect with", used by the messaging privacy setting.
CREATE TABLE IF NOT EXISTS connections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending | accepted
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ==========================================================
-- The curriculum: subjects -> topics -> lessons -> challenges,
-- with a question bank hanging off every topic.
-- ==========================================================
CREATE TABLE IF NOT EXISTS subjects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'code',
  colour      TEXT DEFAULT 'violet',
  cover_url   TEXT DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subject_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id, position);

CREATE TABLE IF NOT EXISTS lessons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  summary     TEXT DEFAULT '',
  objectives  TEXT DEFAULT '',                -- one learning objective per line
  body        TEXT NOT NULL DEFAULT '[]',     -- JSON array of lesson blocks
  minutes     INTEGER NOT NULL DEFAULT 10,
  xp_reward   INTEGER NOT NULL DEFAULT 25,
  position    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  version     INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_topic ON lessons(topic_id, position);

-- Every save keeps the previous wording so an admin can look back or restore it.
CREATE TABLE IF NOT EXISTS lesson_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  summary    TEXT DEFAULT '',
  objectives TEXT DEFAULT '',
  body       TEXT NOT NULL DEFAULT '[]',
  note       TEXT DEFAULT '',
  saved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lesson_id, version)
);

CREATE TABLE IF NOT EXISTS challenges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id       INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  requirements    TEXT DEFAULT '',            -- one requirement per line
  starter_code    TEXT DEFAULT '',
  expected_result TEXT DEFAULT '',
  hints           TEXT DEFAULT '',            -- one hint per line
  difficulty      TEXT NOT NULL DEFAULT 'beginner',
  points          INTEGER NOT NULL DEFAULT 20,
  position        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS challenge_completions (
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  solution     TEXT DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id     INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'multiple_choice',
  prompt       TEXT NOT NULL,
  code         TEXT DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  answer       TEXT NOT NULL DEFAULT '',      -- option index for choices, text otherwise
  explanation  TEXT DEFAULT '',
  difficulty   TEXT NOT NULL DEFAULT 'beginner',
  points       INTEGER NOT NULL DEFAULT 10,
  tags         TEXT DEFAULT '',
  published    INTEGER NOT NULL DEFAULT 1,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id, difficulty);

CREATE TABLE IF NOT EXISTS question_attempts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id    INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer         TEXT DEFAULT '',
  correct        INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON question_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON question_attempts(question_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'opened',   -- opened | completed
  opened_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (lesson_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                    -- lesson | topic | question | challenge
  ref_id     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref_id)
);

-- ==========================================================
-- Direct messaging
-- The member table carries a conversation kind so group chats can be
-- added later (spec section 30) without moving any existing message.
-- ==========================================================
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'direct',   -- direct | group
  title      TEXT DEFAULT '',
  image_url  TEXT DEFAULT '',
  pair_key   TEXT UNIQUE,                      -- "12:47" for direct chats
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role     TEXT NOT NULL DEFAULT 'member',   -- member | admin (for future groups)
  last_read_at    TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
  muted           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL DEFAULT '',
  message_type    TEXT NOT NULL DEFAULT 'text',     -- text | code | image | file
  code_language   TEXT DEFAULT '',
  attachment_url  TEXT DEFAULT '',
  reply_to_id     INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- "Delete for me": the message stays for everybody else.
CREATE TABLE IF NOT EXISTS message_hides (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

-- Every time a moderator opens a private conversation it is recorded here.
CREATE TABLE IF NOT EXISTS message_access_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  moderator_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL,
  report_id       INTEGER,
  reason          TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================================
-- Community, gamification and moderation
-- ==========================================================
CREATE TABLE IF NOT EXISTS badges (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'award',
  is_custom   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key  TEXT NOT NULL REFERENCES badges(key) ON DELETE CASCADE,
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  awarded_by INTEGER,
  PRIMARY KEY (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  link       TEXT DEFAULT '',
  actor_id   INTEGER,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS announcements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority     TEXT NOT NULL DEFAULT 'normal',    -- normal | important | urgent
  audience     TEXT NOT NULL DEFAULT 'everyone',  -- everyone | new_users | roles | users
  audience_ref TEXT DEFAULT '',                   -- role keys or user ids, comma separated
  pinned       INTEGER NOT NULL DEFAULT 0,
  publish_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,   -- message | user | profile | question | lesson
  target_id   INTEGER NOT NULL,
  reason      TEXT NOT NULL,   -- spam | harassment | scam | inappropriate | threatening | other
  details     TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',   -- open | reviewing | resolved | dismissed
  resolution  TEXT DEFAULT '',
  resolved_by INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id   TEXT DEFAULT '',
  details     TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name       TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  role_key   TEXT NOT NULL DEFAULT 'user',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at    TEXT,
  revoked    INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
