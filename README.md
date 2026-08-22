# Grade 8 Hub

A private community platform for one Grade 8 class. It brings the class feed,
private messaging, clubs, homework, announcements, a gaming hub, leaderboards
and a full administration area together in one application.

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

## Using it with NO internet (hotspot)

Socket.io, messaging, online dots and everything else work with **no internet
at all**. They only need the devices to be on the *same network* - and a phone
hotspot counts. Nothing goes through the school Wi-Fi.

Messages arrive in about 50 milliseconds this way. Tested, not guessed.

### Set it up once

**1. Make a network**
   On the host phone or laptop, turn on the **hotspot** (Settings -> Hotspot).
   Everyone else connects to that hotspot. Mobile data can even stay off -
   the hotspot alone is enough for the hub to work.

**2. Allow classmates through the firewall (Windows, once only)**
   Right-click **allow-classmates.bat** -> **Run as administrator**.
   Windows blocks other devices until you do this, and it is the most common
   reason classmates cannot connect.

**3. Start the hub on the host computer**
   Double-click **start.bat** (or run `npm start`). It prints something like:

   ```
   Classmates on the same Wi-Fi or hotspot open:
       http://192.168.43.1:3000
   ```

**4. Everyone else opens that address**
   In any browser on their phone or laptop. That is it - they can sign up
   with an invitation code and start messaging.

### Things worth knowing

- The host computer must stay **on and awake** while people are using it.
- Everyone must stay connected to the **same hotspot**. Walk out of range and
  you go offline - what you write is saved and sent when you come back.
- The address changes when you join a different network. Just read the new
  one off the screen when you start the hub.
- Only **one** computer runs the hub. If everybody installs the desktop app
  and opens it, each person gets their own private empty hub and they will
  not see each other.

## No Wi-Fi at all? Other ways to connect

The hub never contacts the internet, and it does not care *what kind* of
network it runs on. It accepts connections on **every** network the computer
has - Wi-Fi, Ethernet cable, Bluetooth or USB. Anything that gives the devices
an IP address will work.

The one rule that cannot be avoided: **the devices must be joined by
something.** No program can move a message between two devices that have no
connection at all. So pick whichever of these you can actually use.

### 1. A cheap Wi-Fi router (best for a group)

A router does **not** need internet to work. Plug one in, let everyone connect
to it, and run the hub on the host laptop. The router just moves messages
between the devices in the room. A used or travel router costs very little and
handles a whole class.

### 2. An Ethernet cable (best for two computers)

Plug a normal network cable between two laptops. Modern laptops sort the
wiring out themselves. Each gets an address automatically, the hub prints it,
and it works. Rock solid, no radio involved. Many thin laptops need a small
USB-to-Ethernet adapter.

### 3. Bluetooth (slow, but it does work)

Not the Bluetooth *inside* a web page - browsers genuinely cannot chat that
way. What works is **Bluetooth PAN / Bluetooth tethering**, where the
operating system turns Bluetooth into a proper network:

- **Windows**: pair the two computers, then Control Panel ->
  *Devices and Printers* -> right-click the other computer ->
  *Connect using* -> *Access point*
- **Android**: pair, then Settings -> *Bluetooth tethering*

Once joined, the hub works over it unchanged, because it is just a network to
the app. Expect a few devices at most and slower pictures - text chat is fine.

### 4. A phone hotspot with mobile data OFF

Worth trying even with no data plan. Most Android phones will still switch the
hotspot on and create a network, because sharing data and making a network are
two separate things. A laptop hotspot often refuses without a connection to
share, but a phone frequently does not.

### What will not work

- Two laptops in a room with **no** router, cable, Bluetooth or hotspot
  between them. There is no path, so there is nothing for messages to travel
  along.
- Everybody installing the desktop app and expecting to find each other. Each
  installation is its own private hub. One computer hosts; everyone else opens
  its address.

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
