// ==========================================================
// Coding Hub starter content - Git & GitHub.
// ==========================================================

export default {
  subject: 'git',

  lessons: [
    {
      topic: 'Git Introduction',
      title: 'What Git is, and the three places your work lives',
      summary: 'Understand version control, the working directory, the staging area and the repository.',
      minutes: 13,
      objectives: [
        'Explain what a version control system does',
        'Name the three states a change can be in',
        'Run the commands that move a change through them',
        'Read the output of git status'
      ],
      blocks: [
        { type: 'paragraph', text: 'Git records the history of your project. Every time you commit, it saves a complete snapshot, so you can look at any earlier version, compare two of them, or go back to one that worked. It also lets several people change the same project without overwriting each other.' },
        { type: 'note', title: 'Git is not GitHub', text: 'Git is the program on your computer. GitHub is a website that hosts Git repositories so other people can reach them. Git works perfectly well with no internet connection at all.' },
        { type: 'heading', text: 'The three places' },
        { type: 'table', headers: ['Place', 'What is there', 'How it gets there'], rows: [
          ['Working directory', 'The files you are editing right now', 'You edit them'],
          ['Staging area', 'Changes you have chosen for the next commit', 'git add'],
          ['Repository', 'The permanent history of snapshots', 'git commit']
        ] },
        { type: 'code', language: 'bash', code: '# Start tracking a project\ngit init\n\n# See what has changed\ngit status\n\n# Choose what goes in the next snapshot\ngit add index.html\ngit add .            # everything that changed\n\n# Save the snapshot\ngit commit -m "Add the home page"\n\n# Look back\ngit log --oneline' },
        { type: 'heading', text: 'Why staging exists' },
        { type: 'paragraph', text: 'You fixed a bug and also renamed some variables. They are separate pieces of work and belong in separate commits. Staging lets you commit the fix by itself, then commit the rename afterwards, so the history stays readable.' },
        { type: 'heading', text: 'Reading git status' },
        { type: 'code', language: 'bash', code: 'Changes to be committed:      <- staged, will be in the next commit\n  modified:   index.html\n\nChanges not staged for commit: <- edited but not staged\n  modified:   styles.css\n\nUntracked files:               <- Git has never seen these\n  notes.txt' },
        { type: 'heading', text: 'Good commit messages' },
        { type: 'list', items: [
          'Write what the change does, in the present tense: "Add login form", not "added stuff".',
          'One idea per commit. If the message needs "and", it is probably two commits.',
          'Keep the first line under about 50 characters, then add detail below if needed.'
        ] },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Committing without adding, then wondering why the change is missing.',
          'git commit with no -m, which drops you into an editor you may not know how to leave (:wq in vim).',
          'Committing secrets or huge files. Add a .gitignore before your first commit.',
          'Running git init inside a folder that is already a repository.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'Git stores snapshots of your project over time.',
          'Working directory, staging area, repository — add moves left to right, commit saves.',
          'git status is the command you run most; read it whenever you are unsure.',
          'Write small commits with clear messages.'
        ] }
      ],
      challenge: {
        title: 'Your first repository',
        description: 'Create a repository, make two separate commits, and read the history back.',
        requirements: [
          'A folder with git initialised inside it',
          'A .gitignore that excludes a folder called secrets/',
          'One commit that adds index.html and one that adds styles.css',
          'git log --oneline shows exactly two commits with meaningful messages'
        ],
        starterCode: '# In an empty folder:\ngit init\n\n# create .gitignore, index.html and styles.css\n# then stage and commit them separately',
        expectedResult: 'git log --oneline lists two commits, and git status is clean with nothing from secrets/ tracked.',
        hints: [
          'Add and commit one file, then the other — do not use git add . for both at once.',
          'A .gitignore line of "secrets/" is enough to exclude the whole folder.'
        ],
        difficulty: 'beginner',
        points: 25
      }
    },

    {
      topic: 'Branches',
      title: 'Branches: working on something without breaking main',
      summary: 'Create a branch, switch between branches, merge your work back and resolve a conflict.',
      minutes: 16,
      objectives: [
        'Explain what a branch is',
        'Create, switch and delete branches',
        'Merge a branch back into main',
        'Understand what a merge conflict is and how to finish one'
      ],
      blocks: [
        { type: 'paragraph', text: 'A branch is a movable label pointing at a commit. Making one costs nothing, which is why Git users make them constantly: one branch per feature, per bug fix, per experiment.' },
        { type: 'code', language: 'bash', code: '# Create a branch and switch to it in one step\ngit switch -c add-search\n\n# ...edit, add and commit as normal...\n\n# Go back to main\ngit switch main\n\n# Bring the work in\ngit merge add-search\n\n# Tidy up\ngit branch -d add-search' },
        { type: 'note', title: 'switch or checkout?', text: 'git checkout does many different jobs, which made it confusing. Modern Git splits it up: git switch changes branch, git restore undoes file changes. Older guides will still show checkout, and it still works.' },
        { type: 'heading', text: 'Seeing where you are' },
        { type: 'code', language: 'bash', code: 'git branch            # list branches, * marks the current one\ngit log --oneline --graph --all   # see the shape of the history' },
        { type: 'heading', text: 'Merge conflicts' },
        { type: 'paragraph', text: 'A conflict happens when two branches changed the same lines of the same file. Git cannot know which version you want, so it stops and asks. This is normal and is not an error you have caused.' },
        { type: 'code', language: 'bash', code: '<<<<<<< HEAD\n<h1>Welcome to our site</h1>\n=======\n<h1>Welcome!</h1>\n>>>>>>> add-search' },
        { type: 'list', ordered: true, items: [
          'The part above ======= is what is on your current branch.',
          'The part below is what is coming in from the other branch.',
          'Edit the file so it contains exactly what you want — usually a mixture, not one or the other.',
          'Delete all three marker lines.',
          'git add the file, then git commit to finish the merge.'
        ] },
        { type: 'warning', title: 'Never commit the markers', text: 'If <<<<<<< or >>>>>>> reaches your repository, the file is broken. Search the project for those characters before you commit a merge.' },
        { type: 'heading', text: 'A typical day' },
        { type: 'code', language: 'bash', code: 'git switch main\ngit pull                      # get everyone else’s work first\ngit switch -c fix-login-bug\n# ...work...\ngit add .\ngit commit -m "Fix login redirect"\ngit push -u origin fix-login-bug\n# then open a pull request on GitHub' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Committing straight to main on a shared project.',
          'Branching from an out-of-date main, which causes conflicts later. Pull first.',
          'Deleting a branch before its work is merged (-d refuses; -D forces and loses it).',
          'Panicking during a conflict. git merge --abort puts everything back as it was.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'A branch is a cheap, movable pointer to a commit.',
          'git switch -c makes one; git merge brings it back.',
          'Conflicts mean two branches touched the same lines — you decide the result.',
          'Pull before you branch, and keep branches short-lived.'
        ] }
      ],
      challenge: {
        title: 'Create a conflict and resolve it',
        description: 'Deliberately cause a merge conflict, then finish the merge cleanly.',
        requirements: [
          'main has a README.md with one heading, committed',
          'A branch called new-title changes that heading and commits',
          'Back on main, the same heading is changed differently and committed',
          'Merging new-title produces a conflict which you resolve and commit',
          'No conflict markers remain anywhere in the file'
        ],
        starterCode: 'git switch -c new-title\n# edit the heading in README.md, then add and commit\n\ngit switch main\n# edit the SAME heading differently, then add and commit\n\ngit merge new-title\n# resolve, add, commit',
        expectedResult: 'git log --oneline --graph shows the two branches joining at a merge commit, and README.md contains your chosen heading with no markers.',
        hints: [
          'git status during a conflict tells you exactly which files need attention.',
          'git merge --abort is always available if you want to start again.'
        ],
        difficulty: 'intermediate',
        points: 40
      }
    }
  ],

  questions: [
    { topic: 'Git Introduction', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What is Git?',
      options: ['A website for hosting code', 'A distributed version control system', 'A programming language', 'A text editor'],
      answer: 1, tags: 'basics',
      explanation: 'Git runs on your machine and records the history of your project. GitHub is a hosting service built around it.' },
    { topic: 'Git Introduction', type: 'true_false', difficulty: 'beginner', points: 10,
      prompt: 'You need an internet connection to commit with Git.', answer: 'false', tags: 'basics',
      explanation: 'Commits are local. You only need the network to push, pull, clone or fetch.' },
    { topic: 'Git Init', type: 'fill_blank', difficulty: 'beginner', points: 10,
      prompt: 'Complete the command that starts a new repository: git ______', answer: 'init', tags: 'commands',
      explanation: 'git init creates the hidden .git folder that holds the entire history.' },
    { topic: 'Git Add', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does git add do?',
      options: ['Saves a snapshot', 'Moves changes into the staging area', 'Uploads to GitHub', 'Creates a new file'],
      answer: 1, tags: 'commands',
      explanation: 'Staging chooses what goes into the *next* commit. git commit is what saves it.' },
    { topic: 'Git Commit', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does the -m flag do in git commit -m "..."?',
      options: ['Merges branches', 'Supplies the commit message inline', 'Marks the commit as major', 'Modifies the last commit'],
      answer: 1, tags: 'commands',
      explanation: 'Without -m, Git opens your configured editor to ask for the message.' },
    { topic: 'Git Commit', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'You edited a file, ran git commit -m "fix", and the change is not in the commit. Why?',
      options: ['The file was never staged with git add', 'Commits need a branch first', 'The message was too short', 'Git only commits new files'],
      answer: 0, tags: 'workflow',
      explanation: 'Only staged changes are committed. git commit -a stages tracked files automatically.' },
    { topic: 'Git Status', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does "Untracked files" mean in git status?',
      options: ['The files are staged', 'Git has never recorded these files', 'The files are ignored', 'The files were deleted'],
      answer: 1, tags: 'commands',
      explanation: 'Git will not include them in a commit until you git add them at least once.' },
    { topic: 'Git Log', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which command lists past commits?',
      options: ['git history', 'git log', 'git list', 'git show-all'], answer: 1, tags: 'commands',
      explanation: 'git log --oneline gives a compact one-line-per-commit view.' },
    { topic: 'Branches', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What is a branch?',
      options: ['A copy of the whole project folder', 'A movable pointer to a commit', 'A backup on GitHub', 'A type of commit message'],
      answer: 1, tags: 'branches',
      explanation: 'That is why creating one is instant and costs almost no disk space.' },
    { topic: 'Branches', type: 'fill_blank', difficulty: 'intermediate', points: 15,
      prompt: 'Complete the command that creates and switches to a branch: git switch ___ my-feature', answer: '-c', tags: 'branches',
      explanation: 'git switch -c is the modern equivalent of git checkout -b.' },
    { topic: 'Merging', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What causes a merge conflict?',
      options: ['Two branches changed the same lines of the same file', 'A branch is out of date', 'Two commits have the same message', 'Merging always causes conflicts'],
      answer: 0, tags: 'branches',
      explanation: 'Git merges different parts of a file automatically. It only asks when the same lines disagree.' },
    { topic: 'Merging', type: 'debug', difficulty: 'intermediate', points: 15,
      prompt: 'You find this in a file after a merge. What must you do before committing?',
      code: '<<<<<<< HEAD\n<h1>Welcome to our site</h1>\n=======\n<h1>Welcome!</h1>\n>>>>>>> add-search',
      options: ['Nothing, Git removes them on commit', 'Choose the final content and delete all three marker lines', 'Delete the whole file', 'Run git merge again'],
      answer: 1, tags: 'branches',
      explanation: 'Edit the file to what you actually want, remove the markers, then git add and git commit.' },
    { topic: 'GitHub', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What is the difference between Git and GitHub?',
      options: ['They are the same thing', 'Git is the tool on your computer; GitHub hosts repositories online', 'GitHub is the tool; Git is the website', 'Git is for Windows, GitHub for Mac'],
      answer: 1, tags: 'basics',
      explanation: 'Other hosts such as GitLab and Bitbucket do the same job as GitHub for the same Git repositories.' },
    { topic: 'Remote Repositories', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What does "origin" normally refer to?',
      options: ['Your first commit', 'The default name for the remote repository', 'The main branch', 'The original author'],
      answer: 1, tags: 'remotes',
      explanation: 'origin is just a nickname for a URL. You can rename it or add more remotes.' },
    { topic: 'Push', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does git push do?',
      options: ['Downloads changes from the remote', 'Uploads your commits to the remote', 'Deletes a branch', 'Stages your changes'],
      answer: 1, tags: 'remotes',
      explanation: 'Push sends your local commits up; pull brings other people’s commits down.' },
    { topic: 'Pull', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'git pull is a shortcut for which two commands?',
      options: ['git add and git commit', 'git fetch and git merge', 'git clone and git checkout', 'git push and git merge'],
      answer: 1, tags: 'remotes',
      explanation: 'fetch downloads the new commits, merge joins them into your branch.' },
    { topic: 'Clone', type: 'scenario', difficulty: 'beginner', points: 10,
      prompt: 'You want a local copy of a project that already exists on GitHub. Which command?',
      options: ['git init', 'git clone <url>', 'git pull <url>', 'git copy <url>'], answer: 1, tags: 'remotes',
      explanation: 'Clone downloads the full history and sets up origin for you.' },
    { topic: 'Pull Requests', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What is a pull request for?',
      options: ['Downloading a repository', 'Proposing your branch be merged, so others can review it first', 'Requesting write access', 'Deleting a branch'],
      answer: 1, tags: 'collaboration',
      explanation: 'It is a GitHub feature, not a Git command — a place to discuss and review a change before it lands.' },
    { topic: 'Issues', type: 'true_false', difficulty: 'beginner', points: 10,
      prompt: 'GitHub issues can be used to track bugs and feature ideas.', answer: 'true', tags: 'collaboration',
      explanation: 'Issues are the discussion and tracking system; they can be linked to the pull request that closes them.' },
    { topic: 'GitHub Pages', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What does GitHub Pages do?',
      options: ['Hosts a static website straight from a repository', 'Runs your server code', 'Stores large files', 'Manages your database'],
      answer: 0, tags: 'collaboration',
      explanation: 'Perfect for HTML, CSS and JavaScript sites. Anything needing a back end needs a different host.' },
    { topic: 'Collaboration', type: 'scenario', difficulty: 'advanced', points: 20,
      prompt: 'Your push is rejected because the remote has commits you do not have. What is the safe fix?',
      options: ['git push --force', 'git pull, resolve anything that conflicts, then push again', 'Delete the branch and start again', 'Clone the repository fresh'],
      answer: 1, tags: 'collaboration',
      explanation: '--force overwrites other people’s work. Pull first so your commits sit on top of theirs.' },
    { topic: 'Advanced Git', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'What does .gitignore do?',
      options: ['Deletes files', 'Lists files Git should not track', 'Hides files from other users', 'Ignores commit messages'],
      answer: 1, tags: 'config',
      explanation: 'Use it for node_modules, build output, .env files and anything secret. Add it before your first commit.' },
    { topic: 'Advanced Git', type: 'scenario', difficulty: 'advanced', points: 20,
      prompt: 'You committed a secret API key and pushed it. What must you do?',
      options: ['Delete the file and commit', 'Revoke the key immediately, then remove it from the history', 'Add it to .gitignore', 'Nothing, it is private'],
      answer: 1, tags: 'security',
      explanation: 'The key is in the history and in every clone, so it must be treated as leaked. Revoke first, clean the history second.' },
    { topic: 'Advanced Git', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'Which command safely undoes a commit that is already pushed?',
      options: ['git reset --hard', 'git revert <commit>', 'git rm <commit>', 'git branch -D'],
      answer: 1, tags: 'history',
      explanation: 'revert creates a new commit that undoes the change, leaving shared history intact. reset --hard rewrites it.' }
  ]
};
