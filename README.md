# Grade 8 Hub

A private community and coding-learning platform for one Grade 8 class. It
brings the **Coding Hub** — subjects, lessons, coding challenges and a question
bank — together with the class feed, private messaging, clubs, homework,
announcements, a gaming hub, leaderboards and a full administration area, all
in one application.

The hub is **private by design**. Nobody can see anything until they sign in,
and an administrator controls who is allowed to join.

It installs as a **real app** on a laptop, phone or tablet, and can also be
built as a **Windows, macOS or Linux desktop program**. It keeps working when
the connection drops.

There are **no AI features** anywhere in this project.

---

## What is inside

| Area | What it does |
|---|---|
| **Coding Hub** | Learn to code: HTML, CSS, JavaScript, Python, Git & GitHub and React. Subjects hold topics, topics hold detailed lessons, every lesson can hold a coding challenge |
| **Lessons** | Written by administrators block by block: headings, paragraphs, code samples, lists, tables, notes, warnings and information boxes. Every save keeps the previous version so it can be restored |
| **Practice** | A question bank with seven question types and three difficulty levels. Filter by subject, difficulty or type, answer, and see immediately whether you were right and why |
| **Progress** | Lessons completed, questions answered, accuracy, correct streak, progress per subject, and the topics you find hardest |
| **Bookmarks & history** | Save any lesson, topic, challenge or question, and look back over everything you have opened and answered |
| **Home** | Welcome dashboard with "continue learning", homework due, the latest announcement, unread messages, your clubs, your streak, recent posts, events and who is online |
| **Feed** | Class posts: text, pictures, polls, homework questions, study discussions and class announcements, with likes, comments, sharing, saving and reporting |
| **Messages** | One-to-one and club group chats with live delivery, typing indicators, read receipts, online status, reactions, replies, editing, deleting and blocking |
| **Games** | Nine browser games. Tic-Tac-Toe, Rock Paper Scissors, Snake, Memory Match, Reaction Test, Number Guessing, Quiz Battle, Typing Challenge and Connect Four |
| **Multiplayer** | Invite a classmate to Tic-Tac-Toe, Connect Four, Rock Paper Scissors, Reaction Battle or Quiz Battle. The server decides every result |
| **Clubs** | Create clubs, invite and approve members, four club roles, club posts, a dedicated club chat and club events |
| **Homework** | Assignments with subject, due date, priority, instructions and attachments, plus per-student progress and completion statistics for teachers |
| **Announcements** | Priority levels, audiences, pinning, scheduling and expiry |
| **Leaderboard** | Overall, Games, Learning and Weekly boards, which an administrator can switch off |
| **Notifications** | Live notifications with an unread counter for everything that happens |
| **Admin** | Members, subjects, topics, lessons, the question bank, learning analytics, clubs, homework, announcements, games, moderation queue, invitations, roles, settings and an activity log |

---

## Two applications in this repository

| Application | Where | What it is |
|---|---|---|
| **Grade 8 Hub** | this folder | The private class network: feed, messaging, clubs, homework, games and the built-in Coding Hub section |
| **Coding Hub** | [`coding-hub/`](coding-hub/README.md) | The learning platform on its own: lessons, challenges, the question bank, progress, badges and private messaging, with its own database and its own installer |

They are separate programs. Installing one does not affect the other, and they
can sit side by side on the same computer. Installers for both are built by the
same workflow: **Actions → Build installers → Run workflow**, then choose which
app.

The rest of this file is about the Grade 8 Hub. For the standalone Coding Hub,
see [coding-hub/README.md](coding-hub/README.md).

---

## The Coding Hub section

The Coding Hub is the learning half of this app. It is built around four
levels: **subject → topic → lesson → challenge**, with a separate question bank
attached to every topic.

### What ships with it

| Subject | Topics | Starter lessons | Starter questions |
|---|---|---|---|
| HTML | 25 | 4 | 42 |
| CSS | 26 | 3 | 39 |
| JavaScript | 40 | 4 | 42 |
| Python | 30 | 3 | 39 |
| Git & GitHub | 20 | 2 | 24 |
| React | 20 | 2 | 24 |
| **Total** | **161** | **18** | **210** |

All 161 topics from the specification exist and are ready to be filled in. The
18 lessons and 210 questions are a hand-written starting point, not the finished
course — the specification aims for 100 questions per topic, and the tools below
exist so administrators can build up to that at their own pace. The admin
**Learning** screen lists the topics with the fewest questions so you always know
what to write next.

**Nothing on this platform is AI-generated.** Every lesson, example and question
is written by a person, and there is no endpoint anywhere that generates content.

### For learners

- **Subjects** (`#/subjects`) — pick a subject and see how far through it you are
- **Topics** — the lessons in order, plus how many questions are waiting
- **Lessons** — objectives, explanations, code samples, tables, notes and
  warnings, then a coding challenge with requirements, starter code and hints
- **Practice** (`#/practice`) — a set of questions filtered however you like;
  answer one and the result and explanation appear straight away
- **Progress** (`#/progress`), **History** (`#/history`),
  **Bookmarks** (`#/bookmarks`) and **Achievements** (`#/achievements`)

XP comes from finishing lessons, answering questions correctly and completing
challenges. Badges include First Lesson, 100/500/1,000 Questions, Sharp Shooter
and a Master badge for each subject. Every XP amount is adjustable in
**Admin → Settings**.

### For administrators

| Screen | What you can do |
|---|---|
| **Admin → Subjects** | Create, edit, reorder, hide, publish and delete subjects, each with its own icon and colour |
| **Admin → Topics** | The same for topics, filtered by subject, showing how many questions each one still needs |
| **Admin → Lessons** | Write lessons block by block, save drafts, publish, duplicate, reorder, attach coding challenges, and restore any earlier version |
| **Admin → Questions** | The full bank: filter by subject, topic, difficulty, type or status; edit one at a time, write a whole set in one sitting, select many and change them together, and import or export JSON |
| **Admin → Learning** | Lesson and question totals, average accuracy, hardest topics, most studied subjects, top learners, and the topics that still need content |

Bulk actions on selected questions: publish, unpublish, change difficulty,
change points, move to another topic, delete.

### Question types

Seven types, each with three difficulty levels (beginner, intermediate,
advanced): multiple choice, true/false, fill in the blank, code, "what is the
output?", find the bug, and scenario.

**Marking always happens on the server.** A learner is never sent the correct
answer to a question they have not answered yet, so the answer cannot be read
out of the page, and points cannot be awarded by editing a request. Free-text
answers ignore capitals and surrounding spaces, and can accept several
alternatives separated by a vertical bar (`</p>|&lt;/p&gt;`).

### Where the starting content lives

`server/db/curriculum.js` holds the subject and topic structure, and
`server/db/content/*.js` holds the lessons and questions. They are copied into
the database the first time the server starts and then never again — so anything
an administrator edits, hides or deletes stays that way after a restart.

---

## Running it

You do **not** need VS Code. VS Code is only a text editor — the finished
application runs from any terminal, or by double-clicking a start file.

### What you need first

**Node.js version 18 or newer.** Download the LTS version from
<https://nodejs.org> and install it. That is the only thing you need to
install by hand.

To check it worked, open a terminal and run:

```
node -v
```

### The easy way

**Windows** — double-click **`start.bat`**.

It checks that Node.js is installed, installs everything the app needs the
first time, starts the server and opens your browser.

**macOS or Linux** — run:

```
./start.sh
```

### The normal way (any system)

Open a terminal in the project folder and run:

```
npm install
npm run dev
```

Then open <http://localhost:3000> in your browser.

`npm install` only needs to be run once, or after you update the project.

### For real use (hosting it properly)

```
npm install
npm run build
npm start
```

Set `NODE_ENV=production` and a long random `JWT_SECRET` in your `.env` file
first. See **Settings** below.

This works from Windows Command Prompt, PowerShell, Windows Terminal, the
macOS or Linux terminal, the VS Code terminal, or a hosting service.

---

## Installing it as a real app

The hub is not only a website. It installs as a proper app with its own icon
and its own window, with no address bar.

### On a laptop or phone (easiest)

1. Open the hub in Chrome, Edge or Safari
2. **Chrome / Edge**: open the browser menu and choose **Install app**
   (or use the **Install the app** button in Settings)
   **iPhone / iPad**: tap **Share**, then **Add to Home Screen**
   **Android**: tap the menu, then **Install app**
3. It now appears with the other apps on the device

It also gets shortcuts, so a right-click (or long press) on the icon jumps
straight to Messages, Homework, Games or the Feed.

> Browsers only allow installing over `https` or on `localhost`. If classmates
> open the hub over the network on plain `http`, they can still use everything
> normally - they just cannot install it until the hub is behind `https`.
> See **Publishing it** below.

### As a Windows / macOS / Linux desktop program

This builds a real installer that puts "Grade 8 Hub" in the Start Menu or
Applications folder:

```
npm run app:setup       # once - fetches the desktop build tools
npm run app             # opens the app in its own window
npm run app:build:win   # builds a Windows installer into dist-app/
```

Use `app:build:mac` or `app:build:linux` for the other systems. You can only
build a Windows installer on Windows, a Mac one on a Mac, and so on.

The desktop app runs the class server inside itself, so on that computer the
hub works with **no network at all**. It keeps its database, uploads and its
own sign-in secret in your normal application-data folder, so reinstalling or
updating the app never loses the class data.

**The installed app does not need Node.js.** It carries its own copy, so it
runs on a computer with nothing else installed. (Node.js is only needed to
*build* the installer, or to run the hub from source with `npm start`.)

### Getting installers without owning every computer

You do not need a Windows machine to make a Windows installer. GitHub can
build all three for you:

1. Push this project to GitHub
2. Open the **Actions** tab and run **Build installers**
   (or push a version tag: `git tag v1.0.0 && git push --tags`)
3. When it finishes, download them from **Artifacts** at the bottom of the run

Tagging also creates a **Release** with all three installers attached, which
is the easiest way to hand the app to classmates - just send them the link.

The installers are unsigned, because code-signing certificates cost money.
Windows will say the publisher is unknown: choose **More info** then
**Run anyway**. On macOS, right-click the app and choose **Open** the first time.

---

## What works offline

The hub keeps working when the connection drops:

| Works offline | Needs the class server |
|---|---|
| The whole app opens, with every screen | Sending messages and posts |
| **All nine games**, including against the computer | Live multiplayer games |
| The last copy of your dashboard, homework, announcements, feed, clubs and leaderboard | Seeing anything somebody else just added |
| Scores you earn are saved and sent automatically when you are back | Signing in for the first time on a device |

A bar appears at the bottom of the screen when you are offline, so it is always
clear whether you are looking at live data or the last saved copy.

Private conversations are never saved on the device, and everything cached is
wiped when you sign out.

> One thing to be clear about: this is a *class network*, so "offline" means
> your device has no connection. The computer running the hub still has to be
> switched on for classmates to reach it. The desktop app is the exception -
> there the server runs on your own computer.

---

## Signing in the first time

The first time the app starts it creates an administrator account and prints
the details in the terminal:

```
username: admin
password: Grade8Admin!
```

**Sign in and change that password straight away** (Settings → Security). You
will be asked to change it on first sign-in anyway.

You can change the starting details in `.env` before the first run, or make a
new administrator at any time with:

```
npm run create-admin
```

### Example data

By default the hub starts with an example class so there is something to look
at: a teacher, six students, six clubs, homework, announcements, posts and a
conversation.

The example accounts all use the password `Student123!` (the teacher account
`ms.bennett` uses `Teacher123!`).

**For real use, turn this off before the first run.** Open `.env` and set:

```
SEED_DEMO_DATA=false
```

If you have already started the app once and want a clean start, run
`npm run reset-db`.

---

## Adding your classmates

The hub only lets in people an administrator invites.

1. Sign in as an administrator
2. Open **Admin Dashboard → Invitations**
3. Fill in the student's name and press **Create code**
4. A code appears, for example `GRADE8-AB92K`
5. Give the code to the student
6. They open the sign-in page, choose **Join with an invitation code**, enter
   the code and choose their own username and password

Each code works once. You can cancel any unused code at any time.

Under **Admin Dashboard → Settings** you can change who is allowed to join:

- **Invitation code required** — the safe default for a private class network
- **Anybody with the link can join** — only for a closed home network
- **Closed** — nobody new can join at all

---

## Settings file

Copy `.env.example` to `.env` and edit it. If you do not, the app creates one
for you on the first run with a fresh random session secret.

| Setting | What it does |
|---|---|
| `PORT` | The port the app listens on. Default `3000` |
| `JWT_SECRET` | Signs the sign-in sessions. **Change this before hosting** |
| `SESSION_DAYS` | How long a sign-in lasts. Default 14 days |
| `DATABASE_FILE` | Where the database file is kept |
| `UPLOAD_DIR` | Where uploaded pictures are kept |
| `MAX_UPLOAD_MB` | Largest upload allowed. Default 8 MB |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | The first administrator account |
| `SEED_DEMO_DATA` | `true` adds the example class, `false` starts empty |
| `NODE_ENV` | Set to `production` when hosting for real |

---

## The database

The hub uses **SQLite**, a real database kept in a single file at
`database/grade8hub.db`. Nothing else needs installing, and everything is
saved permanently: accounts, posts, messages, clubs, games, homework,
announcements, reports and permissions.

Tables include `users`, `profiles`, `roles`, `permissions`, `role_permissions`,
`user_permissions`, `posts`, `comments`, `likes`, `saved_posts`, `poll_votes`,
`clubs`, `club_members`, `club_requests`, `events`, `conversations`,
`conversation_members`, `messages`, `message_reactions`, `message_access_logs`,
`homework`, `homework_status`, `announcements`, `announcement_reads`, `games`,
`game_scores`, `game_matches`, `game_invites`, `tournaments`, `achievements`,
`user_achievements`, `notifications`, `reports`, `blocked_users`,
`activity_logs`, `invitations` and `settings`.

The Coding Hub adds `subjects`, `topics`, `lessons`, `lesson_versions`,
`challenges`, `challenge_completions`, `questions`, `question_attempts`,
`lesson_progress` and `learn_bookmarks`.

**Backing up is simply copying `database/grade8hub.db` somewhere safe.**

To wipe everything and start again:

```
npm run reset-db
```

---

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs what the app needs (run once) |
| `npm run dev` | Starts the app and restarts it when you edit a file |
| `npm start` | Starts the app normally |
| `npm run build` | Checks the project is ready for hosting |
| `npm run seed` | Sets up the database without starting the server |
| `npm run reset-db` | Deletes everything and builds a fresh database |
| `npm run create-admin` | Creates or repairs an administrator account |
| `npm run app:setup` | Fetches the tools for building the desktop app (once) |
| `npm run app` | Opens the hub as a desktop app in its own window |
| `npm run app:build:win` | Builds a Windows installer into `dist-app/` |
| `npm run app:build:mac` | Builds a macOS disk image |
| `npm run app:build:linux` | Builds a Linux AppImage and .deb |

---

## Roles and permissions

Six roles, each with its own permissions:

| Role | Can do |
|---|---|
| **Student** | Learn, practise, post, comment, message, join and create clubs, play games |
| **Club Admin** | Everything a student can, plus running their own clubs |
| **Moderator** | Handle reports, moderate posts, restrict members |
| **Teacher** | Write subjects, topics, lessons and questions, set homework, publish announcements, see completion statistics and learning analytics |
| **Admin** | Everything a teacher can, plus deleting subjects, and managing members, clubs, invitations, games and moderation |
| **Super Admin** | Everything, including community settings and permissions |

Permissions are stored in the database and checked **on the server for every
single request**. Hiding a button in the browser is never treated as security,
and a member can never act on somebody at or above their own role.

---

## Privacy and safety

This is a private class network, and it is built that way:

- Nothing is readable until you sign in — the feed, clubs, messages, games,
  homework, announcements and even uploaded pictures all require a session
- Only invited members can join, and an administrator controls the invitations
- Students can block classmates and report posts, comments, members, clubs,
  messages and profiles
- Reports go to a moderation queue with seven reasons to choose from
- **Administrators cannot casually read private conversations.** Opening a
  reported private chat needs the `messages.moderate` permission *and* a
  written reason. Every time it happens it is written to a permanent access
  log, and both members of that conversation are told
- Suspensions, role changes, club deletions, permission changes, deleted
  announcements and every moderation action are written to the activity log
- Passwords are stored hashed with bcrypt, never as plain text
- Sessions use signed, http-only cookies
- Uploads are limited by type and size
- Sign-in attempts are rate-limited

---

## Design

- Works on desktop, laptop, tablet and phone
- Dark and light themes, plus five accent colours, saved to your account
- A sidebar on wide screens; bottom navigation and a drawer on phones
- Buttons are sized for touch screens
- Respects the "reduce motion" accessibility setting
- No external services: every font, icon and script is served by the app
  itself, so the hub works on a school network with no internet access

---

## Project layout

```
grade8-hub/
├── client/                 the browser application
│   ├── index.html
│   ├── styles/             base, layout, components, pages, games, learn
│   └── js/
│       ├── app.js          entry point
│       ├── lib/            api, router, store, ui, icons, helpers
│       ├── components/     shell, post card, shared pieces
│       ├── views/          one file per screen
│       └── games/          one file per game
├── server/                 the backend
│   ├── index.js            express app and start-up
│   ├── db/                 schema, connection, example data
│   │   ├── curriculum.js   the six starting subjects and their topics
│   │   └── content/        the starting lessons and questions, per subject
│   ├── lib/                auth, permissions, uploads, XP, game rules, learning
│   ├── routes/             one file per area of the API
│   └── realtime/           the live layer
├── database/               the SQLite file lives here
├── public/                 icons, app manifest and the offline worker
├── uploads/                pictures members upload
├── desktop/                the desktop app wrapper
├── scripts/                setup, build and admin scripts
├── .env.example
├── start.bat               Windows start file
├── start.sh                macOS and Linux start file
└── package.json
```

The browser code is plain ES modules, so there is **no build step and no
bundler**. What you read in `client/` is exactly what runs.

---

## Publishing it

### Just for our class, on one computer

Run `npm start` (or open the desktop app) on one computer and leave it on.
Everybody else opens `http://THAT-COMPUTERS-ADDRESS:3000` on the same Wi-Fi.
Find the address with `ipconfig` on Windows, or `ip addr` on macOS and Linux.

Before you do, in `.env`:

- set `NODE_ENV=production`
- set a long random `JWT_SECRET`
- set `SEED_DEMO_DATA=false`

### On the internet, so it works from home

Any host that runs Node.js will do. The steps are the same everywhere:

1. Put the project on the host (a Git push, or upload the files)
2. Run `npm install` then `npm run build`
3. Start it with `npm start`
4. Point your domain at it and put it behind `https`

The hub keeps its data in a single SQLite file, so choose a host that gives you
a **persistent disk**. On hosts with a temporary filesystem the database is
wiped on every restart. Set `DATABASE_FILE` and `UPLOAD_DIR` to paths on that
disk.

Things to do before letting anybody in:

- A long random `JWT_SECRET` in `.env` - never the example one
- `NODE_ENV=production`
- `SEED_DEMO_DATA=false`, so the example students are not created
- Sign in as the administrator and change the password
- Set **Registration** to *Invitation code required* in Admin → Settings
- Back up `database/grade8hub.db` regularly - that one file is everything

Serving it over `https` also lets everybody install it as an app.

### A note on privacy

This hub holds real messages between real children. Keep it invitation-only,
keep it off public search engines, and make sure a responsible adult is one of
the administrators.

---

## If something goes wrong

**The page says the hub is not responding**
The server is not running. Start it with `npm start` and reload.

**Port 3000 is already in use**
Change `PORT` in `.env` to another number, for example `PORT=4000`, then use
<http://localhost:4000>.

**`npm install` fails**
Check your internet connection, and that `node -v` reports 18 or higher.

**I forgot the administrator password**
Run `npm run create-admin` and give it the same username. It resets that
account's password and makes sure it is a Super Admin.

**I want to start completely fresh**
Run `npm run reset-db`.

**Other people on the network cannot reach it**
Find the host computer's local address (`ipconfig` on Windows, `ifconfig` or
`ip addr` on macOS and Linux) and use `http://THAT-ADDRESS:3000`. You may need
to allow Node.js through the firewall.
