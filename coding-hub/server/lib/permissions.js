// ==========================================================
// Coding Hub - roles and permissions.
//
// The lists below are written into the database on first run so
// permissions live in real tables, but the source of truth for the
// *defaults* stays in code where it can be reviewed easily.
//
// A normal member can never gain a permission by editing the page:
// every check happens on the server, against these tables.
// ==========================================================

export const PERMISSIONS = {
  'users.view': 'View member profiles and the member directory',
  'users.create': 'Create accounts',
  'users.edit': 'Edit another member\'s account details',
  'users.delete': 'Delete accounts',
  'users.suspend': 'Suspend, unsuspend and ban members',
  'users.roles': 'Change a member\'s role',
  'users.verify': 'Verify accounts',
  'users.password': 'Reset another member\'s password',
  'users.xp': 'Adjust XP and reset progress',
  'users.badges': 'Give and take away badges',
  'users.restrict': 'Restrict a member\'s messaging',
  'users.invite': 'Create and revoke invitation codes',

  'subjects.view': 'See unpublished (draft) material',
  'subjects.create': 'Create subjects',
  'subjects.edit': 'Edit, reorder, hide and publish subjects',
  'subjects.delete': 'Delete subjects',

  'topics.create': 'Create topics',
  'topics.edit': 'Edit, reorder, hide and publish topics',
  'topics.delete': 'Delete topics',

  'lessons.create': 'Write lessons',
  'lessons.edit': 'Edit lessons, restore versions, publish and unpublish',
  'lessons.delete': 'Delete lessons',

  'questions.create': 'Add questions to the bank',
  'questions.edit': 'Edit questions and change them in bulk',
  'questions.delete': 'Delete questions',
  'questions.import': 'Import and export question files',

  'badges.manage': 'Create and edit badges',
  'announcements.create': 'Publish announcements',
  'announcements.edit': 'Edit and pin announcements',
  'announcements.delete': 'Delete announcements',

  'messages.moderate': 'Open a reported private conversation (always logged)',
  'reports.view': 'See the moderation queue',
  'reports.resolve': 'Resolve and dismiss reports',

  'analytics.view': 'See platform analytics and everyone\'s progress',
  'logs.view': 'View the administration activity log',
  'settings.manage': 'Change site settings',
  'permissions.manage': 'Grant and revoke individual permissions',
  'admin.access': 'Open the admin dashboard'
};

// ---- What each role can do -------------------------------------------------
const USER = [
  'users.view'
];

const MODERATOR = [
  ...USER,
  'subjects.view',
  'reports.view', 'reports.resolve',
  'messages.moderate',
  'users.restrict', 'users.suspend',
  'admin.access'
];

// Everything needed to build and look after the curriculum.
const CONTENT = [
  'subjects.view', 'subjects.create', 'subjects.edit',
  'topics.create', 'topics.edit', 'topics.delete',
  'lessons.create', 'lessons.edit', 'lessons.delete',
  'questions.create', 'questions.edit', 'questions.delete', 'questions.import',
  'badges.manage',
  'announcements.create', 'announcements.edit', 'announcements.delete',
  'analytics.view'
];

const ADMIN = [
  ...new Set([
    ...MODERATOR,
    ...CONTENT,
    'users.create', 'users.edit', 'users.roles', 'users.verify',
    'users.password', 'users.xp', 'users.badges', 'users.invite',
    'subjects.delete',
    'logs.view'
  ])
];

// A Super Admin has every permission there is.
const SUPER_ADMIN = Object.keys(PERMISSIONS);

export const ROLES = [
  { key: 'user',        name: 'User',        rank: 10, description: 'Learns, practises and chats.',                   permissions: USER },
  { key: 'moderator',   name: 'Moderator',   rank: 30, description: 'Handles reports and keeps the community safe.',  permissions: MODERATOR },
  { key: 'admin',       name: 'Admin',       rank: 50, description: 'Runs the platform and writes the material.',     permissions: ADMIN },
  { key: 'super_admin', name: 'Super Admin', rank: 60, description: 'Full control, including settings and permissions.', permissions: SUPER_ADMIN }
];

export const ROLE_KEYS = ROLES.map((r) => r.key);
export const roleRank = (key) => ROLES.find((r) => r.key === key)?.rank ?? 0;

export const DEFAULT_SETTINGS = {
  // ---- Site ----
  site_name: 'Coding Hub',
  site_description: 'Learn to code, one topic at a time.',
  site_tagline: 'Learn → Practise → Build → Track progress → Connect → Chat → Improve',
  welcome_message: 'Welcome to the Coding Hub. Pick a subject and start learning.',
  theme: 'dark',
  maintenance_mode: 'false',

  // ---- Accounts ----
  registration_mode: 'open',        // open | invite | closed
  require_email_verification: 'false',
  allow_username_change: 'true',

  // ---- Messaging ----
  messaging_enabled: 'true',
  message_editing: 'true',
  message_delete_for_everyone: 'true',
  message_reactions: 'true',
  message_type_code: 'true',
  message_type_images: 'false',
  message_type_files: 'false',

  // ---- Learning ----
  practice_question_count: '10',
  leaderboards_enabled: 'true',
  xp_lesson_complete: '25',
  xp_correct_answer: '5',
  xp_coding_challenge: '20',

  // ---- Notifications ----
  notify_new_lessons: 'true',
  notify_announcements: 'true'
};

// Badges the platform awards by itself. Admins can add their own on top.
export const BADGES = [
  { key: 'welcome',        name: 'Welcome Aboard',   description: 'Joined the Coding Hub.',                     icon: 'star' },
  { key: 'first_lesson',   name: 'First Lesson',     description: 'Finished your first lesson.',                icon: 'book' },
  { key: 'first_challenge', name: 'First Build',     description: 'Completed your first coding challenge.',     icon: 'zap' },
  { key: 'questions_100',  name: '100 Questions',    description: 'Answered 100 practice questions.',           icon: 'target' },
  { key: 'questions_500',  name: '500 Questions',    description: 'Answered 500 practice questions.',           icon: 'target' },
  { key: 'questions_1000', name: '1,000 Questions',  description: 'Answered 1,000 practice questions.',          icon: 'target' },
  { key: 'sharp_shooter',  name: 'Sharp Shooter',    description: 'Answered 25 questions in a row correctly.',  icon: 'star' },
  { key: 'streak_7',       name: 'Week Streak',      description: 'Visited seven days in a row.',               icon: 'fire' },
  { key: 'level_5',        name: 'Level 5',          description: 'Reached level 5.',                           icon: 'zap' },
  { key: 'level_10',       name: 'Level 10',         description: 'Reached level 10.',                          icon: 'zap' },
  { key: 'social',         name: 'Good Company',     description: 'Connected with five other learners.',        icon: 'users' },
  { key: 'master_html',       name: 'HTML Master',       description: 'Completed every published HTML lesson.',       icon: 'award' },
  { key: 'master_css',        name: 'CSS Master',        description: 'Completed every published CSS lesson.',        icon: 'award' },
  { key: 'master_javascript', name: 'JavaScript Master', description: 'Completed every published JavaScript lesson.', icon: 'award' },
  { key: 'master_python',     name: 'Python Master',     description: 'Completed every published Python lesson.',     icon: 'award' },
  { key: 'master_git',        name: 'Git Master',        description: 'Completed every published Git & GitHub lesson.', icon: 'award' },
  { key: 'master_react',      name: 'React Master',      description: 'Completed every published React lesson.',      icon: 'award' }
];
