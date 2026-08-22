# Coding Hub

A learning platform for programming. Lessons you can read, coding challenges you
can build, a question bank you can practise against, progress that is tracked
properly, and private messaging so learners can help each other.

It is **its own application**: its own server, its own database and its own
installer. It shares nothing at runtime with the Grade 8 Hub in the folder above,
and the two can be installed side by side.

There are **no AI features** anywhere in this project. Every lesson, example and
question is written by a person through the admin dashboard.

---

## What is inside

| Area | What it does |
|---|---|
| **Subjects** | HTML, CSS, JavaScript, Python, Git & GitHub and React, holding 161 topics between them |
| **Lessons** | Written block by block: headings, paragraphs, code samples, lists, tables, notes, warnings and information boxes. Every save keeps the previous version, and any version can be restored |
| **Challenges** | Problem, requirements, starter code, expected result and hints, with your solution saved against your account |
| **Practice** | Seven question types across three difficulty levels. Answer one and the result and the explanation appear straight away |
| **Progress** | Lessons completed, questions answered, accuracy, correct streak, progress per subject, and the topics you find hardest |
| **Gamification** | XP, levels (Beginner → Learner → Coder → Developer → Expert), badges and five leaderboards |
| **Messaging** | Direct messages with live delivery, typing indicators, read receipts, online status, reactions, replies, editing, delete for me and delete for everyone, and code snippets |
| **Privacy** | Choose who may message you, and whether people can see that you are online, when you were last seen, and that you read their message |
| **Community** | Member directory, profiles, connections, blocking, reporting, announcements, notifications and global search |
| **Admin** | Fourteen sections: users, subjects, topics, lessons, questions, messaging, reports, badges, announcements, analytics, content health, activity log, permissions and settings |

---

## Running it

```
npm install
npm start
```

Then open **http://localhost:4000**.

The first start creates the database and the first administrator, and prints the
password in the terminal. Sign in and change it straight away.

| Command | What it does |
|---|---|
| `npm install` | Installs what the app needs (run once) |
| `npm start` | Starts the app |
| `npm run dev` | Starts it and restarts when you edit a file |
| `npm run build` | Checks the files and version stamps are in order |
| `npm run reset-db` | Wipes the database and starts again |
| `npm run app` | Runs the desktop app from source (needs Electron) |
| `npm run app:build` | Builds an installer for this computer |

---

## Installing it as a real app

Installers for Windows, macOS and Linux are built by GitHub Actions:
**Actions → Build installers → Run workflow → app: `coding-hub`**. Fill in a
version such as `coding-hub-v1.0.0` to publish a release with permanent
download links, or leave it blank to just build them.

The installed app carries its own copy of Node.js, so nothing else needs
installing. Its database and uploads live in the normal application-data folder
for the computer, which means they survive updating or reinstalling.

---

## Design

The interface is neon over a dark base: a slow-moving glow behind the page,
glowing panels, gradient headings and lit-up progress bars. The light theme is a
calmer version of the same idea.

Finishing something worth celebrating — a lesson, a challenge, a perfect
practice set, ten correct answers in a row, a new level or a badge — brings up a
blocky character who springs onto the screen and high-fives you, with an impact
flash, shockwave rings and confetti. He is built from six real CSS 3D boxes
(thirty-six faces) on `preserve-3d`; there is no library, no image and no WebGL
involved, so he works in the installed app with nothing to download.

Anybody whose system asks for reduced motion gets the same screens and the same
messages with the movement switched off.

---

## Roles and permissions

Four roles over 38 permissions:

| Role | Can do |
|---|---|
| **User** | Learn, practise, build, message and take part |
| **Moderator** | Handle reports, open a reported conversation (always logged), restrict and suspend members |
| **Admin** | Everything a moderator can, plus writing the material, managing members, badges, announcements and invitations |
| **Super Admin** | Everything, including site settings and individual permissions |

Permissions live in real database tables and are checked **on the server for
every single request**. Hiding a button in the browser is never treated as
security, nobody can act on somebody at or above their own level, and the last
Super Admin cannot be demoted or deleted.

---

## How the content works

`server/db/curriculum.js` holds the subjects and their topics, and
`server/db/content/*.js` holds the starting lessons and questions. They are
copied into the database the first time the server starts and never again, so
anything an administrator edits, hides or deletes stays that way.

What ships today:

| Subject | Topics | Lessons | Questions |
|---|---|---|---|
| HTML | 25 | 4 | 42 |
| CSS | 26 | 3 | 39 |
| JavaScript | 40 | 4 | 42 |
| Python | 30 | 3 | 39 |
| Git & GitHub | 20 | 2 | 24 |
| React | 20 | 2 | 24 |
| **Total** | **161** | **18** | **210** |

Every topic exists and is ready to be filled in. The specification aims for 100
questions per topic, which is a large amount of writing, so the admin tools are
built for it: a block-by-block lesson editor, a "write a set" screen for typing
many questions in one sitting, bulk editing, and JSON import and export. The
**Content health** screen lists the topics with the fewest questions, so there is
always an obvious next thing to write.

---

## Security

- Passwords are hashed with bcrypt and never leave the server
- Sessions are signed cookies; the signing secret is per installation
- Every admin route names the permission it needs, and checks it server-side
- A learner is never sent the correct answer to a question they have not
  answered yet, and marking and XP happen only on the server
- Draft material is filtered out before it leaves the server
- Private conversations can only be opened by a moderator through a report, with
  a reason, and every time it happens it is logged and everybody in the
  conversation is told
- Uploads are only served to signed-in members
- Sensitive actions are rate limited

---

## Project layout

```
coding-hub/
├── client/                 the browser application
│   ├── index.html
│   ├── styles/             base, layout, components, pages, learn, neon, celebrate
│   └── js/
│       ├── app.js          entry point
│       ├── lib/            api, router, store, ui, icons, celebrate, helpers
│       ├── components/     shell, shared pieces, learning pieces
│       └── views/          one file per screen
├── server/
│   ├── index.js            express app and start-up
│   ├── boot.js             what the desktop app runs
│   ├── db/                 schema, connection, curriculum and content
│   ├── lib/                auth, permissions, learning, XP, uploads
│   ├── routes/             one file per area of the API
│   └── realtime/           the live layer
├── database/               the SQLite file lives here
├── public/                 icons, app manifest and the offline worker
├── desktop/                the desktop app wrapper
└── scripts/                setup, build and reset
```

The browser code is plain ES modules, so there is **no build step and no
bundler**. What you read in `client/` is exactly what runs.
