// ==========================================================
// Makes sure the database exists, has the first administrator,
// and (optionally) some example class data to look at.
// Running it twice never duplicates anything.
// ==========================================================
import { db, migrate, get, all, run, getSetting, setSetting } from './index.js';
import { config } from '../lib/config.js';
import { hashPassword } from '../lib/auth.js';
import { inviteCode, pairKey } from '../lib/util.js';

function createUser({ username, password, displayName, role = 'student', bio = '', xp = 0, email = null }) {
  const existing = get('SELECT * FROM users WHERE username = ?', username);
  if (existing) return existing.id;
  const info = run(
    'INSERT INTO users (username, email, password_hash, display_name, role_key, xp) VALUES (?, ?, ?, ?, ?, ?)',
    username, email, hashPassword(password), displayName, role, xp
  );
  run('INSERT INTO profiles (user_id, bio) VALUES (?, ?)', info.lastInsertRowid, bio);
  run('INSERT OR IGNORE INTO user_achievements (user_id, achievement_key) VALUES (?, ?)', info.lastInsertRowid, 'welcome');
  return info.lastInsertRowid;
}

export async function ensureDatabase() {
  migrate();

  // ---- The first administrator ------------------------------------------
  const adminExists = get("SELECT 1 AS x FROM users WHERE role_key IN ('admin','super_admin')");
  if (!adminExists) {
    const id = createUser({
      username: config.admin.username,
      password: config.admin.password,
      displayName: config.admin.displayName,
      email: config.admin.email,
      role: 'super_admin',
      bio: 'Runs the Grade 8 Hub.'
    });
    run('UPDATE users SET must_change_pw = 1 WHERE id = ?', id);
    console.log('\n  First administrator created:');
    console.log(`     username: ${config.admin.username}`);
    console.log(`     password: ${config.admin.password}`);
    console.log('     Please sign in and change this password straight away.\n');
  }

  if (config.seedDemoData && getSetting('demo_seeded', 'no') !== 'yes') {
    seedDemoData();
    setSetting('demo_seeded', 'yes');
    console.log('  Example class data added (set SEED_DEMO_DATA=false in .env to skip this).\n');
  }

  return true;
}

function seedDemoData() {
  const adminId = get("SELECT id FROM users WHERE role_key IN ('admin','super_admin') ORDER BY id LIMIT 1").id;

  const teacherId = createUser({
    username: 'ms.bennett', password: 'Teacher123!', displayName: 'Ms Bennett', role: 'teacher',
    bio: 'Grade 8 form teacher. Mathematics and Science.'
  });

  const students = [
    { username: 'alex', displayName: 'Alex Mensah', bio: 'Football, coding and too much Snake.', xp: 1250 },
    { username: 'daniel', displayName: 'Daniel Osei', bio: 'Quiz Battle champion (self-declared).', xp: 1120 },
    { username: 'sarah', displayName: 'Sarah Adjei', bio: 'Art club. I draw during break.', xp: 980 },
    { username: 'lena', displayName: 'Lena Kwarteng', bio: 'Science club, loves experiments.', xp: 760 },
    { username: 'joel', displayName: 'Joel Baffour', bio: 'Music club. Drums.', xp: 540 },
    { username: 'amina', displayName: 'Amina Yakubu', bio: 'Study club organiser.', xp: 430 }
  ];
  const ids = {};
  for (const s of students) {
    ids[s.username] = createUser({ ...s, password: 'Student123!', role: 'student' });
  }
  run("UPDATE users SET role_key = 'moderator' WHERE id = ?", ids.daniel);

  // ---- Clubs -------------------------------------------------------------
  const clubs = [
    { name: 'Coding Club', handle: 'coding-club', category: 'Technology', description: 'We build small websites and games together every Thursday.', owner: ids.alex },
    { name: 'Football Club', handle: 'football-club', category: 'Sport', description: 'Training on Tuesdays, matches on Fridays.', owner: ids.joel },
    { name: 'Gaming Club', handle: 'gaming-club', category: 'Games', description: 'Tournaments in the Gaming Hub. Everyone welcome.', owner: ids.daniel },
    { name: 'Art Club', handle: 'art-club', category: 'Creative', description: 'Drawing, painting and the class notice board designs.', owner: ids.sarah },
    { name: 'Science Club', handle: 'science-club', category: 'Academic', description: 'Experiments, science fair projects and quizzes.', owner: ids.lena },
    { name: 'Study Club', handle: 'study-club', category: 'Academic', description: 'Homework help before tests. Bring your questions.', owner: ids.amina }
  ];

  for (const c of clubs) {
    if (get('SELECT 1 AS x FROM clubs WHERE handle = ?', c.handle)) continue;
    const info = run(`INSERT INTO clubs (name, handle, description, category, owner_id, status, rules)
                      VALUES (?, ?, ?, ?, ?, 'approved', ?)`,
    c.name, c.handle, c.description, c.category, c.owner, 'Be kind. Stay on topic. No bullying.');
    const clubId = info.lastInsertRowid;
    run("INSERT OR IGNORE INTO club_members (club_id, user_id, club_role) VALUES (?, ?, 'owner')", clubId, c.owner);

    // A few members in each club.
    const others = Object.values(ids).filter((id) => id !== c.owner).slice(0, 3);
    for (const memberId of others) {
      run("INSERT OR IGNORE INTO club_members (club_id, user_id, club_role) VALUES (?, ?, 'member')", clubId, memberId);
    }
    // Club chat.
    const conv = run("INSERT INTO conversations (kind, club_id) VALUES ('club', ?)", clubId);
    for (const m of all('SELECT user_id FROM club_members WHERE club_id = ?', clubId)) {
      run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.lastInsertRowid, m.user_id);
    }
    run('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
      conv.lastInsertRowid, c.owner, `Welcome to the ${c.name} chat.`);
  }

  // ---- Announcements -----------------------------------------------------
  const announcements = [
    { title: 'Science test on Friday', message: 'The Science test covers chapters 4 and 5. Bring a calculator and a pen.', priority: 'urgent', category: 'test', pinned: 1, author: teacherId },
    { title: 'Homework reminder', message: 'The English assignment is due tomorrow. Please hand it in before first break.', priority: 'important', category: 'homework', pinned: 0, author: teacherId },
    { title: 'Inter-class football match', message: 'Grade 8 plays Grade 9 on Friday afternoon. Come and support the team.', priority: 'normal', category: 'event', pinned: 0, author: adminId },
    { title: 'Welcome to the Grade 8 Hub', message: 'This is our private class network. Be respectful, help each other, and report anything that is not okay.', priority: 'normal', category: 'general', pinned: 0, author: adminId }
  ];
  for (const a of announcements) {
    if (get('SELECT 1 AS x FROM announcements WHERE title = ?', a.title)) continue;
    run(`INSERT INTO announcements (title, message, author_id, category, priority, audience, pinned)
         VALUES (?, ?, ?, ?, ?, 'everyone', ?)`,
    a.title, a.message, a.author, a.category, a.priority, a.pinned);
  }

  // ---- Homework ----------------------------------------------------------
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const homework = [
    { subject: 'Mathematics', title: 'Algebra Practice', description: 'Complete questions 1-20.', instructions: 'Show every step of your working. Textbook page 84.', due: day(1), priority: 'important' },
    { subject: 'English', title: 'Book Report', description: 'One page about the book you are reading.', instructions: 'Include the title, author and your favourite part.', due: day(0), priority: 'urgent' },
    { subject: 'Science', title: 'Photosynthesis Diagram', description: 'Draw and label the process.', instructions: 'Use colour and label at least six parts.', due: day(3), priority: 'normal' },
    { subject: 'History', title: 'Timeline Project', description: 'Build a timeline of ten important events.', instructions: 'Work in pairs if you prefer.', due: day(6), priority: 'normal' },
    { subject: 'Geography', title: 'Map Skills Worksheet', description: 'Finish the worksheet from class.', instructions: 'Questions 1 to 12 only.', due: day(-2), priority: 'important' }
  ];
  for (const h of homework) {
    if (get('SELECT 1 AS x FROM homework WHERE title = ?', h.title)) continue;
    run(`INSERT INTO homework (subject, title, description, instructions, due_date, priority, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    h.subject, h.title, h.description, h.instructions, h.due, h.priority, teacherId);
  }
  // Some progress so the dashboard is not empty.
  const firstHw = get('SELECT id FROM homework ORDER BY id LIMIT 1');
  if (firstHw) {
    run(`INSERT OR IGNORE INTO homework_status (homework_id, user_id, status) VALUES (?, ?, 'completed')`, firstHw.id, ids.alex);
    run(`INSERT OR IGNORE INTO homework_status (homework_id, user_id, status) VALUES (?, ?, 'in_progress')`, firstHw.id, ids.sarah);
  }

  // ---- Feed posts --------------------------------------------------------
  const posts = [
    { author: ids.alex, type: 'homework_question', subject: 'Mathematics', content: 'Did anyone understand question 5 of the algebra homework? I keep getting a different answer.' },
    { author: ids.sarah, type: 'text', content: 'The art club notice board is finished. Come and have a look outside the library.' },
    { author: ids.daniel, type: 'text', content: 'Quiz Battle tournament this Friday in the Gaming Hub. Sign up on the games page.' },
    { author: teacherId, type: 'study', subject: 'Science', content: 'Reminder for Friday: revise chapters 4 and 5, especially the diagrams.' },
    { author: ids.lena, type: 'poll', content: 'Which club should organise the end of term party?', options: ['Gaming Club', 'Art Club', 'Music Club', 'Science Club'] }
  ];
  for (const p of posts) {
    if (get('SELECT 1 AS x FROM posts WHERE content = ?', p.content)) continue;
    const pollJson = p.type === 'poll' ? JSON.stringify({ question: p.content, options: p.options }) : '';
    const info = run('INSERT INTO posts (author_id, type, subject, content, poll_json) VALUES (?, ?, ?, ?, ?)',
      p.author, p.type, p.subject || '', p.content, pollJson);
    // A couple of likes and a reply on the first post.
    if (p.type === 'homework_question') {
      run('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', info.lastInsertRowid, ids.daniel);
      run('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', info.lastInsertRowid, ids.sarah);
      run('INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)',
        info.lastInsertRowid, ids.daniel, 'You have to factorise first, then divide. I can explain at break.');
    }
  }

  // ---- A private conversation so Messages is not empty --------------------
  const key = pairKey(ids.alex, ids.daniel);
  if (!get('SELECT 1 AS x FROM conversations WHERE pair_key = ?', key)) {
    const conv = run("INSERT INTO conversations (kind, pair_key) VALUES ('direct', ?)", key);
    run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.lastInsertRowid, ids.alex);
    run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.lastInsertRowid, ids.daniel);
    const lines = [
      [ids.alex, 'Did you understand today\'s math homework?'],
      [ids.daniel, 'Yeah, question 5 was confusing though.'],
      [ids.alex, 'That is the one I got stuck on.'],
      [ids.daniel, 'I will explain it at break.']
    ];
    for (const [sender, body] of lines) {
      run('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', conv.lastInsertRowid, sender, body);
    }
  }

  // ---- Game history so the leaderboard has something to show --------------
  const gameSeed = [
    [ids.alex, 'snake', 320, 'played', 10], [ids.alex, 'tic_tac_toe', 1, 'win', 20],
    [ids.daniel, 'quiz_battle', 8, 'win', 20], [ids.daniel, 'typing', 46, 'played', 10],
    [ids.sarah, 'memory_match', 18, 'played', 10], [ids.lena, 'reaction', 268, 'played', 10],
    [ids.joel, 'number_guess', 5, 'played', 10], [ids.amina, 'snake', 210, 'played', 10]
  ];
  if (get('SELECT COUNT(*) AS n FROM game_scores').n === 0) {
    for (const [userId, gameKey, score, result, xp] of gameSeed) {
      run('INSERT INTO game_scores (game_key, user_id, score, result, xp_awarded) VALUES (?, ?, ?, ?, ?)',
        gameKey, userId, score, result, xp);
    }
  }

  // ---- An event and a spare invitation code -------------------------------
  const codingClub = get("SELECT id FROM clubs WHERE handle = 'coding-club'");
  if (codingClub && !get('SELECT 1 AS x FROM events')) {
    run('INSERT INTO events (club_id, title, description, location, starts_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      codingClub.id, 'Coding Club: build a game', 'We finish the Snake clone we started last week.',
      'Computer room', new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16).replace('T', ' '), ids.alex);
  }
  if (get('SELECT COUNT(*) AS n FROM invitations').n === 0) {
    run('INSERT INTO invitations (code, name, role_key, created_by) VALUES (?, ?, ?, ?)',
      inviteCode(), 'Spare code for a new classmate', 'student', adminId);
  }
}

// Allow "npm run seed" to run this file directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureDatabase();
  console.log('Database ready.');
  process.exit(0);
}
