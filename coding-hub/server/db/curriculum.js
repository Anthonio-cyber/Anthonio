// ==========================================================
// Coding Hub - the starting curriculum.
// Only the *structure* lives here (subjects and their topics).
// Lessons and questions live in ./content and are written by hand,
// exactly like an administrator would write them in the dashboard.
//
// Nothing here is the source of truth once the hub is running:
// it is copied into the database on first start, and from then on
// administrators own it through /admin/subjects, /admin/topics,
// /admin/lessons and /admin/questions.
// ==========================================================

export const SUBJECT_CATALOGUE = [
  {
    slug: 'html',
    name: 'HTML',
    icon: 'code',
    colour: 'orange',
    description: 'The language every web page is built from: structure, text, links, media, tables and forms.',
    topics: [
      'HTML Introduction', 'Document Structure', 'Headings', 'Paragraphs', 'Text Formatting',
      'Links', 'Images', 'Audio', 'Video', 'Lists',
      'Tables', 'Forms', 'Input Elements', 'Buttons', 'Semantic HTML',
      'Div and Span', 'Classes and IDs', 'Attributes', 'Meta Tags', 'Accessibility',
      'Entities', 'Iframes', 'Data Attributes', 'HTML APIs', 'Advanced HTML'
    ]
  },
  {
    slug: 'css',
    name: 'CSS',
    icon: 'image',
    colour: 'blue',
    description: 'Everything about how a page looks: colour, spacing, layout, responsive design and animation.',
    topics: [
      'CSS Introduction', 'Syntax', 'Selectors', 'Colors', 'Backgrounds',
      'Borders', 'Margins', 'Padding', 'Box Model', 'Text',
      'Fonts', 'Display', 'Position', 'Z-Index', 'Overflow',
      'Flexbox', 'CSS Grid', 'Responsive Design', 'Media Queries', 'Transitions',
      'Animations', 'Transforms', 'Variables', 'Pseudo-classes', 'Pseudo-elements',
      'Advanced CSS'
    ]
  },
  {
    slug: 'javascript',
    name: 'JavaScript',
    icon: 'zap',
    colour: 'amber',
    description: 'The programming language of the browser: logic, data, the DOM, events and working with APIs.',
    topics: [
      'Introduction', 'Variables', 'Data Types', 'Operators', 'Strings',
      'Numbers', 'Arrays', 'Objects', 'Functions', 'Parameters',
      'Return Values', 'Conditions', 'Switch', 'Loops', 'Array Methods',
      'String Methods', 'Object Methods', 'Scope', 'Hoisting', 'Closures',
      'Callbacks', 'Promises', 'Async/Await', 'Fetch API', 'JSON',
      'DOM', 'Events', 'Forms', 'Local Storage', 'Session Storage',
      'Modules', 'Classes', 'Error Handling', 'Regular Expressions', 'Dates',
      'Math', 'ES6+', 'Browser APIs', 'APIs', 'Advanced JavaScript'
    ]
  },
  {
    slug: 'python',
    name: 'Python',
    icon: 'brain',
    colour: 'green',
    description: 'A friendly, readable language used for scripts, data work, automation and back-end services.',
    topics: [
      'Introduction', 'Variables', 'Data Types', 'Strings', 'Numbers',
      'Lists', 'Tuples', 'Sets', 'Dictionaries', 'Conditions',
      'Loops', 'Functions', 'Parameters', 'Modules', 'Packages',
      'File Handling', 'Exceptions', 'Classes', 'Objects', 'Inheritance',
      'Polymorphism', 'Iterators', 'Generators', 'Decorators', 'Lambda Functions',
      'List Comprehension', 'APIs', 'JSON', 'Virtual Environments', 'Advanced Python'
    ]
  },
  {
    slug: 'git',
    name: 'Git & GitHub',
    icon: 'flag',
    colour: 'red',
    description: 'Save your work properly, undo mistakes, work on branches and share code with other people.',
    topics: [
      'Git Introduction', 'Installation', 'Repositories', 'Git Init', 'Git Add',
      'Git Commit', 'Git Status', 'Git Log', 'Branches', 'Merging',
      'GitHub', 'Remote Repositories', 'Push', 'Pull', 'Clone',
      'Pull Requests', 'Issues', 'GitHub Pages', 'Collaboration', 'Advanced Git'
    ]
  },
  {
    slug: 'react',
    name: 'React',
    icon: 'grid',
    colour: 'cyan',
    description: 'Build interfaces out of components: props, state, hooks, routing and talking to an API.',
    topics: [
      'React Introduction', 'Installation', 'Components', 'JSX', 'Props',
      'State', 'Events', 'Conditional Rendering', 'Lists', 'Forms',
      'Hooks', 'useState', 'useEffect', 'useRef', 'Context',
      'Routing', 'API Requests', 'Project Structure', 'Performance', 'Advanced React'
    ]
  }
];

/** "Document Structure" -> "document-structure" */
export function topicSlug(name) {
  return String(name).toLowerCase().trim()
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
