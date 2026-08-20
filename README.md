# Grade 8 Hub

A private community platform for one Grade 8 class. It brings the class feed,
private messaging, clubs, homework, announcements, a gaming hub, leaderboards
and a full administration area together in one application.

The hub is **private by design**. Nobody can see anything until they sign in,
and an administrator controls who is allowed to join.

There are **no AI features** anywhere in this project.

---

## What is inside

| Area | What it does |
|---|---|
| **Home** | Welcome dashboard with homework due, the latest announcement, unread messages, your clubs, your streak, recent posts, events and who is online |
| **Feed** | Class posts: text, pictures, polls, homework questions, study discussions and class announcements, with likes, comments, sharing, saving and reporting |
| **Messages** | One-to-one and club group chats with live delivery, typing indicators, read receipts, online status, reactions, replies, editing, deleting and blocking |
| **Games** | Nine browser games. Tic-Tac-Toe, Rock Paper Scissors, Snake, Memory Match, Reaction Test, Number Guessing, Quiz Battle, Typing Challenge and Connect Four |
| **Multiplayer** | Invite a classmate to Tic-Tac-Toe, Connect Four, Rock Paper Scissors, Reaction Battle or Quiz Battle. The server decides every result |
| **Clubs** | Create clubs, invite and approve members, four club roles, club posts, a dedicated club chat and club events |
| **Homework** | Assignments with subject, due date, priority, instructions and attachments, plus per-student progress and completion statistics for teachers |
| **Announcements** | Priority levels, audiences, pinning, scheduling and expiry |
| **Leaderboard** | Overall, Games, Learning and Weekly boards, which an administrator can switch off |
| **Notifications** | Live notifications with an unread counter for everything that happens |
| **Admin** | Members, clubs, homework, announcements, games, moderation queue, invitations, roles, settings and an activity log |

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

---

## Roles and permissions

Six roles, each with its own permissions:

| Role | Can do |
|---|---|
| **Student** | Post, comment, message, join and create clubs, play games |
| **Club Admin** | Everything a student can, plus running their own clubs |
| **Moderator** | Handle reports, moderate posts, restrict members |
| **Teacher** | Set homework, publish announcements, see completion statistics |
| **Admin** | Manage members, clubs, invitations, games and moderation |
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
│   ├── styles/             base, layout, components, pages, games
│   └── js/
│       ├── app.js          entry point
│       ├── lib/            api, router, store, ui, icons, helpers
│       ├── components/     shell, post card, shared pieces
│       ├── views/          one file per screen
│       └── games/          one file per game
├── server/                 the backend
│   ├── index.js            express app and start-up
│   ├── db/                 schema, connection, example data
│   ├── lib/                auth, permissions, uploads, XP, game rules
│   ├── routes/             one file per area of the API
│   └── realtime/           the live layer
├── database/               the SQLite file lives here
├── public/                 favicon and static files
├── uploads/                pictures members upload
├── scripts/                setup, build and admin scripts
├── .env.example
├── start.bat               Windows start file
├── start.sh                macOS and Linux start file
└── package.json
```

The browser code is plain ES modules, so there is **no build step and no
bundler**. What you read in `client/` is exactly what runs.

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
