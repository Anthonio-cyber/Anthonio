// ==========================================================
// Makes sure the database exists and has its first administrator.
// Running it twice never duplicates anything.
// ==========================================================
import { db, migrate, get, run, getSetting, setSetting } from './index.js';
import { config } from '../lib/config.js';
import { hashPassword } from '../lib/auth.js';

function createUser({ username, password, displayName, role = 'user', bio = '', xp = 0, email = null }) {
  const existing = get('SELECT * FROM users WHERE username = ?', username);
  if (existing) return existing.id;
  const info = run(
    'INSERT INTO users (username, email, password_hash, display_name, role_key, xp, verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
    username, email, hashPassword(password), displayName, role, xp
  );
  run('INSERT INTO profiles (user_id, bio) VALUES (?, ?)', info.lastInsertRowid, bio);
  run('INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?, ?)', info.lastInsertRowid, 'welcome');
  return info.lastInsertRowid;
}

export async function ensureDatabase() {
  migrate();

  const adminExists = get("SELECT 1 AS x FROM users WHERE role_key IN ('admin','super_admin')");
  if (!adminExists) {
    const id = createUser({
      username: config.admin.username,
      password: config.admin.password,
      displayName: config.admin.displayName,
      email: config.admin.email,
      role: 'super_admin',
      bio: 'Runs the Coding Hub.'
    });
    run('UPDATE users SET must_change_pw = 1 WHERE id = ?', id);
    console.log('\n  First administrator created:');
    console.log(`     username: ${config.admin.username}`);
    console.log(`     password: ${config.admin.password}`);
    console.log('     Please sign in and change this password straight away.\n');
  }

  if (config.seedDemoData && getSetting('demo_data_added', 'false') !== 'true') {
    for (const person of [
      { username: 'alex', displayName: 'Alex Rivera', bio: 'Learning JavaScript.', xp: 340 },
      { username: 'sarah', displayName: 'Sarah Chen', bio: 'CSS and design.', xp: 610 },
      { username: 'daniel', displayName: 'Daniel Okafor', bio: 'Python, mostly.', xp: 180 }
    ]) {
      createUser({ ...person, password: 'Learner123!' });
    }
    setSetting('demo_data_added', 'true');
    console.log('  Example learners added (set SEED_DEMO_DATA=false to skip this).');
  }

  console.log('Database ready.');
  return db;
}

// Allow "node server/db/seed.js" as well as being imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureDatabase();
  db.close();
}
