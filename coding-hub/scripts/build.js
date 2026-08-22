// ==========================================================
// "npm run build" - the browser code is plain ES modules, so there
// is nothing to bundle. This script prepares the app for production:
// it checks the environment, sets up the database and reports what
// the hosting service needs.
// ==========================================================
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

console.log('Preparing Coding Hub for production...\n');

await import('./setup.js');

const required = ['client/index.html', 'client/js/app.js', 'server/index.js', 'server/db/schema.sql'];
let ok = true;
for (const file of required) {
  const exists = fs.existsSync(path.join(root, file));
  console.log(`  ${exists ? 'OK  ' : 'MISSING '} ${file}`);
  if (!exists) ok = false;
}

// The update guard only works if every copy of the version agrees, so
// a mismatch is caught here rather than by a class that cannot see the
// new screens after installing an update.
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const guard = fs.readFileSync(path.join(root, 'client/js/update-guard.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');

const guardVersion = guard.match(/var VERSION = '([^']+)'/)?.[1];
const linkVersion = indexHtml.match(/update-guard\.js\?v=([^"']+)/)?.[1];

for (const [where, found] of [['client/js/update-guard.js', guardVersion], ['client/index.html (?v=)', linkVersion]]) {
  const matches = found === appVersion;
  console.log(`  ${matches ? 'OK  ' : 'WRONG   '} version ${found || '(not found)'} in ${where}`);
  if (!matches) {
    ok = false;
    console.log(`          package.json says ${appVersion}. Make them the same.`);
  }
}

const envText = fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '';
if (envText.includes('change-this-to-a-long-random-secret-string')) {
  console.log('\n  WARNING: JWT_SECRET is still the example value. Change it in .env before hosting.');
}
if (!envText.includes('NODE_ENV=production')) {
  console.log('  NOTE: set NODE_ENV=production in .env when you host this for real.');
}

console.log(ok ? '\nBuild check finished. Start the app with: npm start' : '\nBuild check failed - see the lines marked MISSING or WRONG above.');
process.exit(ok ? 0 : 1);
