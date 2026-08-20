// Creates (or repairs) an administrator account from the command line.
// Usage: npm run create-admin -- username password "Display Name"
import readline from 'node:readline/promises';

const { migrate, get, run } = await import('../server/db/index.js');
migrate();
const { hashPassword } = await import('../server/lib/auth.js');

let [username, password, displayName] = process.argv.slice(2);

if (!username || !password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  username = username || (await rl.question('Username: ')).trim();
  password = password || (await rl.question('Password (min 8 characters): ')).trim();
  displayName = displayName || (await rl.question('Display name: ')).trim();
  rl.close();
}

if (!username || password.length < 8) {
  console.error('A username and a password of at least 8 characters are required.');
  process.exit(1);
}

const existing = get('SELECT * FROM users WHERE username = ?', username);
if (existing) {
  run("UPDATE users SET password_hash = ?, role_key = 'super_admin', status = 'active' WHERE id = ?",
    hashPassword(password), existing.id);
  console.log(`Updated "${username}" - the account is now a Super Admin with the new password.`);
} else {
  const info = run(
    "INSERT INTO users (username, password_hash, display_name, role_key) VALUES (?, ?, ?, 'super_admin')",
    username, hashPassword(password), displayName || username
  );
  run('INSERT INTO profiles (user_id) VALUES (?)', info.lastInsertRowid);
  console.log(`Created Super Admin "${username}".`);
}
process.exit(0);
