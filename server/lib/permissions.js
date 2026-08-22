// ==========================================================
// Roles and permissions.
// The lists below are written into the database on first run so
// permissions live in real tables, but the source of truth for the
// *defaults* stays in code where it can be reviewed easily.
// ==========================================================

export const PERMISSIONS = {
  'users.view': 'View the member directory and profiles',
  'users.edit': 'Edit another member\'s account details',
  'users.suspend': 'Suspend or unsuspend members',
  'users.delete': 'Delete member accounts',
  'users.roles': 'Change a member\'s role',
  'users.restrict': 'Restrict messaging or posting for a member',
  'users.xp': 'Adjust XP and award badges',
  'users.invite': 'Create and revoke invitation codes',

  'posts.create': 'Create posts in the class feed',
  'posts.edit': 'Edit own posts',
  'posts.delete': 'Delete own posts',
  'posts.moderate': 'Edit, delete or pin any post or comment',

  'clubs.create': 'Create a club',
  'clubs.approve': 'Approve or reject club requests',
  'clubs.manage': 'Manage any club (members, roles, settings)',
  'clubs.delete': 'Delete or suspend clubs',

  'homework.create': 'Create homework assignments',
  'homework.edit': 'Edit homework assignments',
  'homework.delete': 'Delete homework assignments',
  'homework.stats': 'View homework completion statistics',

  'announcements.create': 'Publish announcements',
  'announcements.edit': 'Edit announcements and pin them',
  'announcements.delete': 'Delete announcements',

  'games.manage': 'Enable/disable games, reset leaderboards, run tournaments',

  'subjects.view': 'See unpublished (draft) coding subjects',
  'subjects.create': 'Create a coding subject',
  'subjects.edit': 'Edit, reorder, hide or publish coding subjects',
  'subjects.delete': 'Delete coding subjects',

  'topics.create': 'Create topics inside a subject',
  'topics.edit': 'Edit, reorder, hide or publish topics',
  'topics.delete': 'Delete topics',

  'lessons.create': 'Write new lessons',
  'lessons.edit': 'Edit lessons, restore versions, publish and unpublish',
  'lessons.delete': 'Delete lessons',

  'questions.create': 'Add questions to the question bank',
  'questions.edit': 'Edit questions and change them in bulk',
  'questions.delete': 'Delete questions',
  'questions.import': 'Import and export question files',

  'learning.analytics': 'See learning analytics and everyone\'s progress',

  'reports.view': 'See the moderation queue',
  'reports.resolve': 'Resolve or dismiss reports',
  'messages.moderate': 'Open a reported private conversation (always logged)',

  'settings.manage': 'Change community settings',
  'logs.view': 'View the administration activity log',
  'admin.access': 'Open the admin dashboard'
};

const STUDENT = [
  'users.view',
  'posts.create', 'posts.edit', 'posts.delete',
  'clubs.create'
];

// Everything needed to build and look after the Coding Hub curriculum.
const CURRICULUM = [
  'subjects.view', 'subjects.create', 'subjects.edit',
  'topics.create', 'topics.edit',
  'lessons.create', 'lessons.edit',
  'questions.create', 'questions.edit', 'questions.import',
  'learning.analytics'
];

const CLUB_ADMIN = [...STUDENT];

const MODERATOR = [
  ...STUDENT,
  'subjects.view',
  'posts.moderate',
  'reports.view', 'reports.resolve',
  'users.restrict',
  'admin.access'
];

const TEACHER = [
  ...STUDENT,
  ...CURRICULUM,
  'lessons.delete', 'questions.delete', 'topics.delete',
  'posts.moderate',
  'homework.create', 'homework.edit', 'homework.delete', 'homework.stats',
  'announcements.create', 'announcements.edit', 'announcements.delete',
  'reports.view',
  'admin.access'
];

const ADMIN = [
  ...new Set([
    ...TEACHER, ...MODERATOR,
    'users.edit', 'users.suspend', 'users.roles', 'users.xp', 'users.invite',
    'clubs.approve', 'clubs.manage', 'clubs.delete',
    'games.manage',
    ...CURRICULUM,
    'subjects.delete', 'topics.delete', 'lessons.delete', 'questions.delete',
    'messages.moderate',
    'logs.view'
  ])
];

const SUPER_ADMIN = Object.keys(PERMISSIONS);

export const ROLES = [
  { key: 'student',     name: 'Student',      rank: 10, description: 'A Grade 8 class member.',                    permissions: STUDENT },
  { key: 'club_admin',  name: 'Club Admin',   rank: 20, description: 'Runs one or more clubs.',                    permissions: CLUB_ADMIN },
  { key: 'moderator',   name: 'Moderator',    rank: 30, description: 'Keeps the feed and reports under control.',  permissions: MODERATOR },
  { key: 'teacher',     name: 'Teacher',      rank: 40, description: 'Writes lessons and questions, sets homework.', permissions: TEACHER },
  { key: 'admin',       name: 'Admin',        rank: 50, description: 'Runs the whole community.',                  permissions: ADMIN },
  { key: 'super_admin', name: 'Super Admin',  rank: 60, description: 'Full control, including settings.',          permissions: SUPER_ADMIN }
];

export const ROLE_KEYS = ROLES.map((r) => r.key);
export const roleRank = (key) => ROLES.find((r) => r.key === key)?.rank ?? 0;

export const DEFAULT_SETTINGS = {
  registration_mode: 'invite',        // invite | open | closed
  club_creation: 'approval',          // anyone | approval | admins
  leaderboard_enabled: 'true',
  multiplayer_enabled: 'true',
  games_enabled: 'true',
  community_name: 'Grade 8 Hub',
  class_name: 'Grade 8',
  welcome_message: 'Welcome to the Grade 8 Hub — our private class network.',
  xp_win: '20',
  xp_challenge: '10',
  xp_tournament: '100',
  xp_post: '2',
  xp_homework_complete: '5',

  // ---- Coding Hub ----
  coding_hub_enabled: 'true',
  coding_hub_name: 'Coding Hub',
  coding_hub_tagline: 'Learn to code, one topic at a time.',
  practice_question_count: '10',
  show_lesson_answers: 'true',
  xp_lesson_complete: '25',
  xp_correct_answer: '5',
  xp_coding_challenge: '20'
};

export const GAME_CATALOGUE = [
  { key: 'tic_tac_toe',  name: 'Tic-Tac-Toe',       description: 'Classic three in a row. Play the computer or a classmate.', icon: '#', category: 'strategy', multiplayer: 1, score_label: 'Wins', score_order: 'desc' },
  { key: 'rps',          name: 'Rock Paper Scissors', description: 'Best of five against the machine or a friend.',           icon: 'RPS', category: 'quick', multiplayer: 1, score_label: 'Wins', score_order: 'desc' },
  { key: 'snake',        name: 'Snake',             description: 'Eat, grow, and do not hit the wall.',                       icon: 'S', category: 'arcade', multiplayer: 0, score_label: 'Score', score_order: 'desc' },
  { key: 'memory_match', name: 'Memory Match',      description: 'Flip the cards and find every pair.',                       icon: 'M', category: 'puzzle', multiplayer: 0, score_label: 'Moves', score_order: 'asc' },
  { key: 'reaction',     name: 'Reaction Test',     description: 'How fast can you tap when the screen turns green?',         icon: 'R', category: 'quick', multiplayer: 1, score_label: 'Milliseconds', score_order: 'asc' },
  { key: 'number_guess', name: 'Number Guessing',   description: 'Find the secret number in as few guesses as possible.',     icon: 'N', category: 'puzzle', multiplayer: 0, score_label: 'Guesses', score_order: 'asc' },
  { key: 'quiz_battle',  name: 'Quiz Battle',       description: 'School subject questions against the clock or a classmate.', icon: 'Q', category: 'learning', multiplayer: 1, score_label: 'Points', score_order: 'desc' },
  { key: 'typing',       name: 'Typing Challenge',  description: 'Type the sentence as fast and accurately as you can.',      icon: 'T', category: 'learning', multiplayer: 0, score_label: 'WPM', score_order: 'desc' },
  { key: 'connect_four', name: 'Connect Four',      description: 'Drop discs and line up four before your opponent does.',    icon: '4', category: 'strategy', multiplayer: 1, score_label: 'Wins', score_order: 'desc' }
];

export const ACHIEVEMENTS = [
  { key: 'welcome',        name: 'Welcome Aboard',   description: 'Joined the Grade 8 Hub.',                 icon: 'star' },
  { key: 'first_post',     name: 'First Words',      description: 'Published your first post.',              icon: 'pen' },
  { key: 'first_win',      name: 'First Victory',    description: 'Won your first game.',                    icon: 'trophy' },
  { key: 'club_founder',   name: 'Club Founder',     description: 'Created a club.',                         icon: 'flag' },
  { key: 'homework_hero',  name: 'Homework Hero',    description: 'Completed 10 homework assignments.',      icon: 'book' },
  { key: 'streak_7',       name: 'Week Streak',      description: 'Visited the hub 7 days in a row.',        icon: 'fire' },
  { key: 'level_5',        name: 'Level 5',          description: 'Reached level 5.',                        icon: 'level' },
  { key: 'social',         name: 'Social Butterfly', description: 'Connected with 5 classmates.',            icon: 'users' },

  // ---- Coding Hub ----
  { key: 'first_lesson',   name: 'First Lesson',     description: 'Finished your first coding lesson.',      icon: 'book' },
  { key: 'questions_100',  name: '100 Questions',    description: 'Answered 100 practice questions.',        icon: 'target' },
  { key: 'questions_500',  name: '500 Questions',    description: 'Answered 500 practice questions.',        icon: 'target' },
  { key: 'questions_1000', name: '1,000 Questions',  description: 'Answered 1,000 practice questions.',      icon: 'target' },
  { key: 'first_challenge', name: 'First Build',     description: 'Completed your first coding challenge.',  icon: 'zap' },
  { key: 'sharp_shooter',  name: 'Sharp Shooter',    description: 'Answered 25 questions in a row correctly.', icon: 'star' },
  { key: 'master_html',    name: 'HTML Master',      description: 'Completed every published HTML lesson.',  icon: 'award' },
  { key: 'master_css',     name: 'CSS Master',       description: 'Completed every published CSS lesson.',   icon: 'award' },
  { key: 'master_javascript', name: 'JavaScript Master', description: 'Completed every published JavaScript lesson.', icon: 'award' },
  { key: 'master_python',  name: 'Python Master',    description: 'Completed every published Python lesson.', icon: 'award' },
  { key: 'master_git',     name: 'Git Master',       description: 'Completed every published Git & GitHub lesson.', icon: 'award' },
  { key: 'master_react',   name: 'React Master',     description: 'Completed every published React lesson.', icon: 'award' }
];
