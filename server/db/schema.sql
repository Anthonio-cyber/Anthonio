-- ==========================================================
-- Grade 8 Hub - database schema (SQLite)
-- Every table is created only if it does not already exist,
-- so starting the server never destroys existing data.
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

-- Per-user grants/revokes that override the role defaults.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_key)
);

-- ---------- Users & profiles ----------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email          TEXT UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  role_key       TEXT NOT NULL DEFAULT 'student' REFERENCES roles(key),
  status         TEXT NOT NULL DEFAULT 'active',   -- active | suspended | deleted
  suspend_reason TEXT DEFAULT '',
  can_message    INTEGER NOT NULL DEFAULT 1,
  can_post       INTEGER NOT NULL DEFAULT 1,
  xp             INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen      TEXT,
  must_change_pw INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url    TEXT DEFAULT '',
  cover_url     TEXT DEFAULT '',
  bio           TEXT DEFAULT '',
  favourite_subject TEXT DEFAULT '',
  class_section TEXT DEFAULT 'Grade 8',
  theme         TEXT NOT NULL DEFAULT 'dark',
  accent        TEXT NOT NULL DEFAULT 'violet',
  streak_days   INTEGER NOT NULL DEFAULT 0,
  streak_date   TEXT DEFAULT '',
  show_online   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS connections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',      -- pending | accepted
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ---------- Feed ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id     INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'text',  -- text|image|poll|homework_question|study|announcement
  subject     TEXT DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  image_url   TEXT DEFAULT '',
  poll_json   TEXT DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_club ON posts(club_id);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

CREATE TABLE IF NOT EXISTS likes (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_posts (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS hidden_posts (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- ---------- Clubs -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  handle      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT DEFAULT '',
  category    TEXT DEFAULT 'General',
  rules       TEXT DEFAULT '',
  logo_url    TEXT DEFAULT '',
  cover_url   TEXT DEFAULT '',
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'approved',  -- pending | approved | rejected | suspended
  reject_note TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_members (
  club_id   INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_role TEXT NOT NULL DEFAULT 'member',   -- owner | admin | moderator | member
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS club_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id    INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'join',  -- join | invite
  status     TEXT NOT NULL DEFAULT 'pending',
  message    TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (club_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id     INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  location    TEXT DEFAULT '',
  starts_at   TEXT NOT NULL,
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Messaging -------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'direct',   -- direct | club
  club_id    INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  pair_key   TEXT UNIQUE,                      -- "12:47" for direct chats
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
  muted           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL DEFAULT '',
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

-- Every time a moderator opens a private conversation it is recorded here.
CREATE TABLE IF NOT EXISTS message_access_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  moderator_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL,
  report_id       INTEGER,
  reason          TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Homework --------------------------------------------------------
CREATE TABLE IF NOT EXISTS homework (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject      TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  due_date     TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'normal',  -- normal | important | urgent
  attachment_url TEXT DEFAULT '',
  created_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS homework_status (
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed
  note        TEXT DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (homework_id, user_id)
);

-- ---------- Announcements ---------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL DEFAULT 'general',  -- general | homework | test | event | club
  priority   TEXT NOT NULL DEFAULT 'normal',
  audience   TEXT NOT NULL DEFAULT 'everyone', -- everyone | students | staff | club
  club_id    INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  pinned     INTEGER NOT NULL DEFAULT 0,
  publish_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement_id, user_id)
);

-- ---------- Games -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'GAME',
  category    TEXT DEFAULT 'arcade',
  enabled     INTEGER NOT NULL DEFAULT 1,
  multiplayer INTEGER NOT NULL DEFAULT 0,
  score_label TEXT DEFAULT 'Score',
  score_order TEXT DEFAULT 'desc'   -- desc = higher is better, asc = lower is better
);

CREATE TABLE IF NOT EXISTS game_scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key   TEXT NOT NULL REFERENCES games(key) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL DEFAULT 0,
  result     TEXT NOT NULL DEFAULT 'played',  -- win | loss | draw | played
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  match_id   INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scores_game ON game_scores(game_key, score DESC);

CREATE TABLE IF NOT EXISTS game_matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key    TEXT NOT NULL REFERENCES games(key) ON DELETE CASCADE,
  player_x    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_o    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_json  TEXT NOT NULL DEFAULT '{}',
  turn_user   INTEGER,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | finished | abandoned
  winner_id   INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key   TEXT NOT NULL REFERENCES games(key) ON DELETE CASCADE,
  from_user  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | cancelled
  match_id   INTEGER REFERENCES game_matches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  game_key    TEXT NOT NULL REFERENCES games(key) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  starts_at   TEXT,
  ends_at     TEXT,
  status      TEXT NOT NULL DEFAULT 'open',   -- open | running | finished
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, user_id)
);

-- ---------- Achievements ----------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'BADGE'
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL REFERENCES achievements(key) ON DELETE CASCADE,
  awarded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  awarded_by     INTEGER,
  PRIMARY KEY (user_id, achievement_key)
);

-- ---------- Notifications ---------------------------------------------------
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

-- ---------- Moderation ------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,   -- post | comment | user | club | message | profile
  target_id   INTEGER NOT NULL,
  reason      TEXT NOT NULL,   -- spam | bullying | harassment | inappropriate | scam | impersonation | other
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

-- ---------- Invitations & settings -----------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name       TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  role_key   TEXT NOT NULL DEFAULT 'student',
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

-- ==========================================================
-- Coding Hub - the learning platform
-- Subjects -> topics -> lessons -> challenges, plus the question
-- bank, everybody's progress and their bookmarks.
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
  answer       TEXT NOT NULL DEFAULT '',      -- index for choices, text for the rest
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

CREATE TABLE IF NOT EXISTS learn_bookmarks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                    -- lesson | topic | question | challenge
  ref_id     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref_id)
);
