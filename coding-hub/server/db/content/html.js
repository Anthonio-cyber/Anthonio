// ==========================================================
// Coding Hub starter content - HTML.
// Written by hand. No generated text anywhere in this platform.
// ==========================================================

export default {
  subject: 'html',

  lessons: [
    {
      topic: 'HTML Introduction',
      title: 'What HTML is and why every website needs it',
      summary: 'Meet the language that gives a web page its structure, and write your first page.',
      minutes: 12,
      objectives: [
        'Explain what HTML is and what it is not',
        'Name the three languages of the front end and what each one does',
        'Write and save a working .html file',
        'Recognise an element, a tag and its content'
      ],
      blocks: [
        { type: 'paragraph', text: 'HTML stands for HyperText Markup Language. It is not a programming language — there are no calculations, decisions or loops in it. HTML is a *markup* language: you take plain text and mark up which part is a heading, which part is a paragraph, which part is a link, and the browser then knows how to display it.' },
        { type: 'heading', text: 'The three languages of a web page' },
        { type: 'table', headers: ['Language', 'Job', 'Think of it as'], rows: [
          ['HTML', 'Structure and meaning', 'The skeleton'],
          ['CSS', 'Appearance', 'The clothes'],
          ['JavaScript', 'Behaviour', 'The muscles']
        ] },
        { type: 'paragraph', text: 'A page can exist with HTML alone. It will look plain, but every link, heading and image will work. Take the HTML away and there is nothing left to style or animate, which is why HTML is always the first thing you learn.' },
        { type: 'heading', text: 'Elements and tags' },
        { type: 'paragraph', text: 'An element is normally written as an opening tag, some content, and a closing tag. The closing tag repeats the name with a forward slash in front of it.' },
        { type: 'code', language: 'html', code: '<p>This sentence is the content of a paragraph element.</p>' },
        { type: 'list', ordered: false, items: [
          '<p> is the opening tag',
          'This sentence is the content of a paragraph element. is the content',
          '</p> is the closing tag',
          'All three together are the element'
        ] },
        { type: 'note', title: 'Empty elements', text: 'A few elements have no content at all, so they have no closing tag. <br> (a line break) and <img> (an image) are the two you will meet first.' },
        { type: 'heading', text: 'Your first page' },
        { type: 'code', language: 'html', code: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <title>My first page</title>\n  </head>\n  <body>\n    <h1>Hello!</h1>\n    <p>I built this page myself.</p>\n  </body>\n</html>' },
        { type: 'paragraph', text: 'Save that as index.html, then double-click the file. It opens in your browser as a real web page — no server, no installation, nothing else needed.' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Saving the file as index.txt. The .html ending is what tells the browser to read it as a page.',
          'Forgetting the closing tag. The browser will usually guess, and it usually guesses wrong.',
          'Writing < p > with spaces inside the angle brackets. Tags have no spaces around the name.',
          'Expecting HTML to do maths or make decisions. That is JavaScript’s job.'
        ] },
        { type: 'heading', text: 'Best practice' },
        { type: 'list', items: [
          'Write tag names in lowercase.',
          'Indent nested elements by two spaces so the structure is visible at a glance.',
          'Always set lang on the <html> element so screen readers pronounce the page correctly.'
        ] },
        { type: 'info', title: 'Where you will see this in real life', text: 'Every single page you use — a search engine, a shop, a school portal — is delivered to your browser as HTML. Right-click any page and choose "View page source" to read the real thing.' },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'HTML marks up text so a browser knows what each part means.',
          'HTML gives structure, CSS gives looks, JavaScript gives behaviour.',
          'Most elements are an opening tag, content and a closing tag.',
          'A file ending in .html opens in any browser as a web page.'
        ] }
      ],
      challenge: {
        title: 'Build your own first page',
        description: 'Create a page that introduces you, using only the elements from this lesson.',
        requirements: [
          'Save the file as about-me.html',
          'Include a <!DOCTYPE html> line and a lang attribute',
          'Give the page a <title> that shows in the browser tab',
          'Use one <h1> with your name and at least two <p> paragraphs'
        ],
        starterCode: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <title><!-- your title here --></title>\n  </head>\n  <body>\n    <!-- your heading and paragraphs here -->\n  </body>\n</html>',
        expectedResult: 'Opening about-me.html in a browser shows your name as a large heading, with two paragraphs underneath, and your title in the browser tab.',
        hints: [
          'The tab text comes from <title>, which lives inside <head>.',
          'Anything you want to see on the page itself goes inside <body>.'
        ],
        difficulty: 'beginner',
        points: 20
      }
    },

    {
      topic: 'Document Structure',
      title: 'head, body and the shape of every HTML document',
      summary: 'Learn what belongs in the head, what belongs in the body, and why the order matters.',
      minutes: 12,
      objectives: [
        'Describe the job of <!DOCTYPE html>, <html>, <head> and <body>',
        'Decide correctly whether a piece of markup belongs in the head or the body',
        'Nest elements without overlapping them'
      ],
      blocks: [
        { type: 'paragraph', text: 'Every HTML document has the same outer shape. Once you know it you can start any page from memory in about ten seconds.' },
        { type: 'code', language: 'html', code: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>Page title</title>\n    <link rel="stylesheet" href="styles.css">\n  </head>\n  <body>\n    <h1>Visible content starts here</h1>\n    <script src="app.js"></script>\n  </body>\n</html>' },
        { type: 'heading', text: 'What each part is for' },
        { type: 'table', headers: ['Part', 'What it does'], rows: [
          ['<!DOCTYPE html>', 'Tells the browser to use modern standards mode. It is not a tag and needs no closing.'],
          ['<html>', 'The root element. Everything else lives inside it.'],
          ['<head>', 'Information *about* the page: title, character set, stylesheets, icons. Nothing here is displayed in the page area.'],
          ['<body>', 'Everything the visitor actually sees.']
        ] },
        { type: 'warning', title: 'The most common beginner bug', text: 'Putting visible content such as <h1> or <p> inside <head>. The browser quietly moves it into the body, which makes the page behave in ways you did not write.' },
        { type: 'heading', text: 'Nesting' },
        { type: 'paragraph', text: 'Elements go inside other elements, but they must never cross over each other. Whatever you open last, you close first.' },
        { type: 'code', language: 'html', code: '<!-- Correct: strong opens and closes inside p -->\n<p>This is <strong>important</strong> text.</p>\n\n<!-- Wrong: the tags overlap -->\n<p>This is <strong>important</p></strong>' },
        { type: 'heading', text: 'Where scripts go' },
        { type: 'paragraph', text: 'A <script> tag at the end of the body runs after the page content exists, so your JavaScript can find the elements it needs. A script in the head runs before the body is built, so it will not find anything unless you add the defer attribute.' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Leaving out <meta charset="UTF-8">, which turns accented letters and emoji into strange symbols.',
          'Forgetting the viewport meta tag, which makes the page look tiny on a phone.',
          'Two <body> elements in one file. There is exactly one of each.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'Doctype, html, head, body — in that order, every time.',
          'The head describes the page; the body is the page.',
          'Close tags in the reverse order you opened them.'
        ] }
      ],
      challenge: {
        title: 'Fix the broken document',
        description: 'The document below has four separate structural mistakes. Find and fix all of them.',
        requirements: [
          'The doctype must be present and first',
          'Nothing visible may remain inside the head',
          'The character set and viewport meta tags must both be present',
          'No tags may overlap'
        ],
        starterCode: '<html>\n  <head>\n    <title>My shop</title>\n    <h1>Welcome to my shop</h1>\n  </head>\n  <body>\n    <p>We sell <strong>excellent</p></strong> things.\n  </body>\n</html>',
        expectedResult: 'A valid document where the heading appears in the body, the meta tags are in the head, and the strong element closes before the paragraph does.',
        hints: [
          'Count how many things are wrong before you start typing: there are four.',
          'The <h1> is content, so it belongs somewhere visible.'
        ],
        difficulty: 'beginner',
        points: 25
      }
    },

    {
      topic: 'Links',
      title: 'Links: the "hypertext" in HyperText Markup Language',
      summary: 'Connect pages together with the anchor element, and understand relative and absolute paths.',
      minutes: 14,
      objectives: [
        'Write links to other sites, to your own pages and to a spot on the same page',
        'Choose between a relative and an absolute path',
        'Write link text that makes sense on its own'
      ],
      blocks: [
        { type: 'paragraph', text: 'A link is an <a> element — a stands for anchor. The href attribute says where it goes, and the content between the tags is what the visitor clicks.' },
        { type: 'code', language: 'html', code: '<a href="https://example.com">Visit example.com</a>' },
        { type: 'heading', text: 'Three kinds of destination' },
        { type: 'table', headers: ['Type', 'Example', 'Goes to'], rows: [
          ['Absolute', 'href="https://example.com/help"', 'A full address on any site'],
          ['Relative', 'href="contact.html"', 'A file next to the current page'],
          ['Fragment', 'href="#prices"', 'The element with id="prices" on this page']
        ] },
        { type: 'code', language: 'html', code: '<!-- A file in the same folder -->\n<a href="contact.html">Contact</a>\n\n<!-- A file in a sub-folder -->\n<a href="pages/help.html">Help</a>\n\n<!-- Up one folder, then into another -->\n<a href="../images/photo.html">Photo</a>\n\n<!-- Jump to a heading on this page -->\n<a href="#prices">See prices</a>\n<h2 id="prices">Prices</h2>' },
        { type: 'heading', text: 'Opening in a new tab' },
        { type: 'code', language: 'html', code: '<a href="https://example.com" target="_blank" rel="noopener">Opens in a new tab</a>' },
        { type: 'note', title: 'Why rel="noopener"', text: 'Without it, the page you opened can reach back into your page through JavaScript. Adding noopener closes that door. Modern browsers do it for you, but writing it costs nothing and works everywhere.' },
        { type: 'heading', text: 'Other useful destinations' },
        { type: 'code', language: 'html', code: '<a href="mailto:hello@example.com">Email us</a>\n<a href="tel:+441234567890">Call us</a>\n<a href="report.pdf" download>Download the report</a>' },
        { type: 'heading', text: 'Link text that works' },
        { type: 'paragraph', text: 'Screen reader users often jump through a page link by link, hearing only the link text. "Click here" tells them nothing.' },
        { type: 'code', language: 'html', code: '<!-- Poor -->\n<p>To read the timetable, <a href="timetable.html">click here</a>.</p>\n\n<!-- Good -->\n<p>Read the <a href="timetable.html">Year 9 timetable</a>.</p>' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Writing href="www.example.com" without https:// — the browser treats it as a file in your folder.',
          'A leading slash (href="/help") means "from the very top of the site", which is not the same as "next to this file".',
          'Using a link for something that does not navigate. If it performs an action, use <button>.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          '<a href="..."> creates a link; the content is what people click.',
          'Absolute paths include the site, relative paths are worked out from the current file.',
          '#id jumps within the page.',
          'Link text should make sense read on its own.'
        ] }
      ],
      challenge: {
        title: 'A three-page mini site',
        description: 'Build three pages that link to each other, plus one in-page jump link.',
        requirements: [
          'index.html, about.html and contact.html all exist',
          'Every page links to the other two using relative paths',
          'index.html has a link that jumps down to an element with id="more"',
          'One external link opens in a new tab with rel="noopener"'
        ],
        starterCode: '<!-- index.html -->\n<nav>\n  <a href="index.html">Home</a>\n  <!-- add the other two links -->\n</nav>\n\n<a href="#more">Read more</a>\n\n<h2 id="more">More about this site</h2>',
        expectedResult: 'You can move between all three pages by clicking, and "Read more" scrolls the page down to the More heading.',
        hints: [
          'The fragment link and the id must match exactly, including capital letters.',
          'Relative links work when all three files sit in the same folder.'
        ],
        difficulty: 'beginner',
        points: 30
      }
    },

    {
      topic: 'Semantic HTML',
      title: 'Semantic HTML: elements that mean something',
      summary: 'Replace a wall of divs with elements that describe what each region of the page actually is.',
      minutes: 13,
      objectives: [
        'Explain what "semantic" means in HTML',
        'Choose the right sectioning element for a region of a page',
        'Describe how semantics help search engines and screen readers'
      ],
      blocks: [
        { type: 'paragraph', text: 'A semantic element says what its content *is*, not what it looks like. <div> means "some box". <nav> means "this is the navigation". Both can be styled identically, but only one of them tells a machine anything useful.' },
        { type: 'heading', text: 'The main sectioning elements' },
        { type: 'table', headers: ['Element', 'Use it for'], rows: [
          ['<header>', 'Introductory content for the page or a section'],
          ['<nav>', 'A block of navigation links'],
          ['<main>', 'The one main content area — only one per page'],
          ['<article>', 'A self-contained item that would still make sense on its own'],
          ['<section>', 'A thematic grouping, normally with a heading'],
          ['<aside>', 'Content that is related but not essential, such as a sidebar'],
          ['<footer>', 'Closing content for the page or a section']
        ] },
        { type: 'code', language: 'html', code: '<body>\n  <header>\n    <h1>Coding Club</h1>\n    <nav>\n      <a href="index.html">Home</a>\n      <a href="posts.html">Posts</a>\n    </nav>\n  </header>\n\n  <main>\n    <article>\n      <h2>How we built the scoreboard</h2>\n      <p>Last week the club…</p>\n    </article>\n  </main>\n\n  <aside>\n    <h2>Next meeting</h2>\n    <p>Thursday, 4pm.</p>\n  </aside>\n\n  <footer>\n    <p>Coding Club 2026</p>\n  </footer>\n</body>' },
        { type: 'heading', text: 'Why it is worth the effort' },
        { type: 'list', items: [
          'Screen readers offer a "jump to main content" shortcut — but only if a <main> exists.',
          'Search engines read the structure to work out what a page is about.',
          'Your own CSS gets simpler, because you can style nav a instead of inventing a class for every link.',
          'Six months later, the markup still explains itself.'
        ] },
        { type: 'heading', text: 'article or section?' },
        { type: 'paragraph', text: 'Ask whether the content would still make sense if you cut it out and pasted it somewhere else. A blog post, a comment or a product card would — that is an <article>. A "Prices" block that only makes sense inside this page is a <section>.' },
        { type: 'warning', title: 'Do not use headings for size', text: 'Choosing <h4> because you want smaller text breaks the outline of the page. Pick the heading level that matches the structure, then set the size in CSS.' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Two <main> elements on one page.',
          'Wrapping everything in <section> instead of <div> — a section without a heading is usually just a div.',
          'Using <nav> for every group of links. It is for major navigation blocks, not for three links in a paragraph.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'Semantic elements describe meaning, not appearance.',
          'header, nav, main, article, section, aside, footer cover most pages.',
          'One <main> per page.',
          'If nothing semantic fits, then a <div> is the right answer.'
        ] }
      ],
      challenge: {
        title: 'De-div a page',
        description: 'The markup below uses divs and classes for everything. Rewrite it with semantic elements.',
        requirements: [
          'No div remains where a semantic element would fit',
          'Exactly one <main> element',
          'The blog post becomes an <article>',
          'The class names may be removed once the element itself carries the meaning'
        ],
        starterCode: '<div class="header">\n  <h1>My blog</h1>\n  <div class="nav">\n    <a href="index.html">Home</a>\n    <a href="archive.html">Archive</a>\n  </div>\n</div>\n<div class="main">\n  <div class="post">\n    <h2>Learning HTML</h2>\n    <p>Today I learned about semantics.</p>\n  </div>\n</div>\n<div class="footer">\n  <p>2026</p>\n</div>',
        expectedResult: 'The same page structure written with header, nav, main, article and footer, and no leftover layout divs.',
        hints: [
          'The post would still make sense on its own page, which tells you which element to use.',
          'The outer wrappers map one-to-one onto sectioning elements.'
        ],
        difficulty: 'intermediate',
        points: 30
      }
    }
  ],

  questions: [
    // ---- HTML Introduction ----
    { topic: 'HTML Introduction', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does HTML stand for?',
      options: ['HyperText Markup Language', 'Home Tool Markup Language', 'Hyperlinks and Text Markup Language', 'High Level Text Machine Language'],
      answer: 0, tags: 'basics',
      explanation: 'HyperText refers to links between documents, and Markup Language means you mark up text to give it meaning.' },
    { topic: 'HTML Introduction', type: 'true_false', difficulty: 'beginner', points: 10,
      prompt: 'HTML is a programming language.', answer: 'false', tags: 'basics',
      explanation: 'HTML has no variables, conditions or loops. It is a markup language; the programming on a web page is done in JavaScript.' },
    { topic: 'HTML Introduction', type: 'fill_blank', difficulty: 'beginner', points: 10,
      prompt: 'Complete the closing tag for a paragraph: <p>Hello_______', answer: '</p>', tags: 'syntax',
      explanation: 'A closing tag repeats the element name with a forward slash in front of it.' },
    { topic: 'HTML Introduction', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which language is responsible for how a page *looks*?',
      options: ['HTML', 'CSS', 'JavaScript', 'SQL'], answer: 1, tags: 'basics',
      explanation: 'HTML gives structure, CSS gives appearance, JavaScript gives behaviour.' },
    { topic: 'HTML Introduction', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which of these elements has no closing tag?',
      options: ['<p>', '<div>', '<br>', '<span>'], answer: 2, tags: 'syntax',
      explanation: '<br> is an empty element: it has no content, so there is nothing to close.' },
    { topic: 'HTML Introduction', type: 'scenario', difficulty: 'beginner', points: 15,
      prompt: 'You save your work as mypage.txt and double-click it. The browser shows the tags as plain text instead of a page. What went wrong?',
      options: ['The file needs the .html ending', 'The file needs to be on a web server', 'HTML only works in Chrome', 'The doctype is missing'],
      answer: 0, tags: 'files',
      explanation: 'The file extension tells the browser how to read the file. Rename it to mypage.html and it will render.' },

    // ---- Document Structure ----
    { topic: 'Document Structure', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which element holds everything the visitor sees on the page?',
      options: ['<head>', '<body>', '<main>', '<html>'], answer: 1, tags: 'structure',
      explanation: 'The head holds information about the page; the body holds the page itself.' },
    { topic: 'Document Structure', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Where does the <title> element belong?',
      options: ['In the body, at the top', 'In the head', 'Inside <h1>', 'Anywhere at all'], answer: 1, tags: 'structure',
      explanation: '<title> lives in the head. It sets the browser tab text and the name used when the page is bookmarked.' },
    { topic: 'Document Structure', type: 'debug', difficulty: 'intermediate', points: 15,
      prompt: 'What is wrong with this markup?',
      code: '<p>This is <strong>important</p></strong>',
      options: ['Nothing is wrong', 'The tags overlap instead of nesting', '<strong> is not a real element', 'A paragraph cannot contain other elements'],
      answer: 1, tags: 'nesting',
      explanation: 'Whatever you open last must be closed first: <p>This is <strong>important</strong></p>.' },
    { topic: 'Document Structure', type: 'true_false', difficulty: 'beginner', points: 10,
      prompt: '<!DOCTYPE html> is an HTML element with a closing tag.', answer: 'false', tags: 'structure',
      explanation: 'It is a declaration, not an element. It has no content and no closing tag.' },
    { topic: 'Document Structure', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'A page shows strange symbols instead of accented letters. Which line was most likely left out?',
      options: ['<meta name="viewport" ...>', '<meta charset="UTF-8">', '<!DOCTYPE html>', '<link rel="stylesheet" ...>'],
      answer: 1, tags: 'meta',
      explanation: 'The charset meta tag tells the browser which character encoding to use. Without UTF-8 many characters are decoded incorrectly.' },
    { topic: 'Document Structure', type: 'fill_blank', difficulty: 'beginner', points: 10,
      prompt: 'Fill in the attribute that sets the page language: <html _____="en">', answer: 'lang', tags: 'accessibility',
      explanation: 'lang tells screen readers which language to pronounce, and helps browsers offer translation.' },

    // ---- Headings / Paragraphs / Text Formatting ----
    { topic: 'Headings', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'How many heading levels does HTML provide?',
      options: ['Three', 'Six', 'Ten', 'As many as you like'], answer: 1, tags: 'text',
      explanation: 'HTML has <h1> through <h6>. <h1> is the most important.' },
    { topic: 'Headings', type: 'true_false', difficulty: 'intermediate', points: 15,
      prompt: 'You should choose a heading level based on how big you want the text to look.', answer: 'false', tags: 'text',
      explanation: 'Heading levels describe structure. Size is a CSS decision — skipping levels breaks the outline for screen readers.' },
    { topic: 'Paragraphs', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What happens if you press Enter several times inside a <p> element?',
      options: ['The browser adds blank lines', 'The extra whitespace collapses into one space', 'The page breaks', 'A new paragraph starts automatically'],
      answer: 1, tags: 'text',
      explanation: 'HTML collapses runs of whitespace, including newlines, into a single space. Use separate <p> elements or <br> for real breaks.' },
    { topic: 'Text Formatting', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which pair carries *meaning* rather than only appearance?',
      options: ['<b> and <i>', '<strong> and <em>', '<big> and <small>', '<font> and <center>'],
      answer: 1, tags: 'semantics',
      explanation: '<strong> means strong importance and <em> means emphasis; screen readers can announce them. <b> and <i> are purely visual.' },

    // ---- Links ----
    { topic: 'Links', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which attribute sets the destination of a link?',
      options: ['src', 'link', 'href', 'to'], answer: 2, tags: 'links',
      explanation: 'href stands for hypertext reference. src is for embedding files such as images and scripts.' },
    { topic: 'Links', type: 'output', difficulty: 'intermediate', points: 15,
      prompt: 'The page below is at /shop/index.html. Where does the link go?',
      code: '<a href="../help.html">Help</a>',
      options: ['/shop/help.html', '/help.html', 'https://help.html', 'Nowhere — the syntax is invalid'],
      answer: 1, tags: 'paths',
      explanation: '../ moves up one folder, so from /shop/ the link resolves to /help.html.' },
    { topic: 'Links', type: 'fill_blank', difficulty: 'intermediate', points: 15,
      prompt: 'Complete the link so it jumps to <h2 id="prices">: <a href="_______">See prices</a>', answer: '#prices', tags: 'links',
      explanation: 'A hash followed by the id of an element scrolls the page to that element.' },
    { topic: 'Links', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'A screen reader user is listing all links on your page and hears "click here" five times. What should you change?',
      options: ['Add title attributes to the links', 'Rewrite the link text so each one describes its destination', 'Make the links larger', 'Open every link in a new tab'],
      answer: 1, tags: 'accessibility',
      explanation: 'Link text is read out of context, so it must describe where the link goes on its own.' },

    // ---- Images / Media ----
    { topic: 'Images', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which attribute describes an image for someone who cannot see it?',
      options: ['title', 'alt', 'caption', 'aria'], answer: 1, tags: 'accessibility',
      explanation: 'alt text is read by screen readers and shown if the image fails to load.' },
    { topic: 'Images', type: 'true_false', difficulty: 'intermediate', points: 15,
      prompt: 'A purely decorative image should have alt="".', answer: 'true', tags: 'accessibility',
      explanation: 'An empty alt tells assistive technology to skip the image. Leaving alt off entirely makes it read the file name instead.' },
    { topic: 'Video', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which attribute makes a <video> element show play and volume buttons?',
      options: ['controls', 'player', 'buttons', 'ui'], answer: 0, tags: 'media',
      explanation: 'Without the controls attribute the video renders with no interface at all.' },

    // ---- Lists / Tables ----
    { topic: 'Lists', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which element creates a numbered list?',
      options: ['<ul>', '<ol>', '<li>', '<dl>'], answer: 1, tags: 'lists',
      explanation: '<ol> is an ordered list. <ul> is unordered (bullets) and <li> is a single item in either.' },
    { topic: 'Lists', type: 'debug', difficulty: 'intermediate', points: 15,
      prompt: 'Why will this list not display correctly?',
      code: '<ul>\n  <p>Milk</p>\n  <p>Bread</p>\n</ul>',
      options: ['Lists cannot hold text', 'The items must be <li> elements', '<ul> needs a type attribute', 'It needs a closing </p> for the list'],
      answer: 1, tags: 'lists',
      explanation: 'Only <li> (and a few list-related elements) may be direct children of <ul> or <ol>.' },
    { topic: 'Tables', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which element marks a table *header* cell?',
      options: ['<td>', '<th>', '<thead>', '<header>'], answer: 1, tags: 'tables',
      explanation: '<th> is a header cell; <thead> groups the header *rows*, and <td> is an ordinary data cell.' },

    // ---- Forms ----
    { topic: 'Forms', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which attribute of <form> says where the data is sent?',
      options: ['method', 'action', 'target', 'send'], answer: 1, tags: 'forms',
      explanation: 'action holds the URL. method chooses GET or POST.' },
    { topic: 'Forms', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'A login form sends the password visibly in the address bar. Which attribute was set wrongly?',
      options: ['action="/login"', 'method="get"', 'type="password"', 'name="password"'],
      answer: 1, tags: 'forms',
      explanation: 'GET puts form data in the URL. Anything sensitive must use method="post" (over HTTPS).' },
    { topic: 'Input Elements', type: 'fill_blank', difficulty: 'beginner', points: 10,
      prompt: 'Complete the input that hides what is typed: <input type="_______">', answer: 'password', tags: 'forms',
      explanation: 'type="password" masks the characters as they are typed.' },
    { topic: 'Input Elements', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which attribute connects a <label> to its input?',
      options: ['name', 'for', 'id', 'link'], answer: 1, tags: 'accessibility',
      explanation: 'The label’s for attribute must match the input’s id. Clicking the label then focuses the input.' },
    { topic: 'Buttons', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Inside a form, what does <button> do if you do not set a type?',
      options: ['Nothing', 'Submits the form', 'Resets the form', 'Throws an error'], answer: 1, tags: 'forms',
      explanation: 'The default is type="submit". Use type="button" for a button that only runs JavaScript.' },

    // ---- Semantic / attributes / accessibility ----
    { topic: 'Semantic HTML', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'How many <main> elements should a page have?',
      options: ['None', 'Exactly one', 'One per section', 'As many as you like'], answer: 1, tags: 'semantics',
      explanation: 'There is one main content area per page, and assistive technology offers a shortcut straight to it.' },
    { topic: 'Semantic HTML', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'You are marking up a blog comment that would still make sense if it were quoted elsewhere. Which element fits best?',
      options: ['<section>', '<article>', '<aside>', '<div>'], answer: 1, tags: 'semantics',
      explanation: 'An <article> is self-contained content that stands on its own — a post, a comment, a product card.' },
    { topic: 'Classes and IDs', type: 'true_false', difficulty: 'beginner', points: 10,
      prompt: 'The same id value may be used on several elements in one page.', answer: 'false', tags: 'attributes',
      explanation: 'An id must be unique in the document. Use a class when several elements share something.' },
    { topic: 'Attributes', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which is written correctly?',
      options: ['<img src=photo.jpg>', '<img src="photo.jpg" alt="A cat">', '<img "photo.jpg">', '<img=photo.jpg>'],
      answer: 1, tags: 'attributes',
      explanation: 'Attribute values belong in quotes, and an informative image needs alt text.' },
    { topic: 'Meta Tags', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which meta tag makes a page scale properly on a phone?',
      options: ['<meta charset="UTF-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="mobile" content="yes">', '<meta name="description" content="...">'],
      answer: 1, tags: 'meta',
      explanation: 'Without the viewport tag, phones render the page at desktop width and zoom out.' },
    { topic: 'Accessibility', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'Which of these does the *most* for accessibility with the least effort?',
      options: ['Adding ARIA roles to every div', 'Using the correct native elements in the first place', 'Increasing the font size', 'Adding title attributes everywhere'],
      answer: 1, tags: 'accessibility',
      explanation: 'Native elements come with keyboard support, focus behaviour and roles built in. ARIA is for the gaps that are left.' },
    { topic: 'Entities', type: 'fill_blank', difficulty: 'intermediate', points: 15,
      prompt: 'Write the HTML entity that displays a less-than sign: _______', answer: '&lt;', tags: 'entities',
      explanation: 'A literal < would start a tag, so it must be escaped as &lt;.' },
    { topic: 'Iframes', type: 'true_false', difficulty: 'advanced', points: 20,
      prompt: 'A page can control the contents of any iframe it embeds, whatever site it comes from.', answer: 'false', tags: 'security',
      explanation: 'The same-origin policy blocks scripts from reaching into an iframe loaded from a different origin.' },
    { topic: 'Data Attributes', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'How do you read <div data-user-id="7"> from JavaScript?',
      options: ['el.dataset.userId', 'el.data.userId', 'el.getData("user-id")', 'el.userId'], answer: 0, tags: 'data',
      explanation: 'data-* attributes appear on the dataset object, converted from kebab-case to camelCase.' },
    { topic: 'Div and Span', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What is the difference between <div> and <span>?',
      options: ['div is block-level, span is inline', 'span is block-level, div is inline', 'They are identical', 'span cannot be styled'],
      answer: 0, tags: 'layout',
      explanation: 'A div starts on a new line and fills the width available; a span sits inside a line of text.' },
    { topic: 'Advanced HTML', type: 'scenario', difficulty: 'advanced', points: 20,
      prompt: 'You need an expandable "read more" section that works with no JavaScript at all. What should you use?',
      options: ['<details> and <summary>', '<div> with a CSS class', '<dialog>', '<section hidden>'],
      answer: 0, tags: 'elements',
      explanation: '<details> with a <summary> gives a native disclosure widget, keyboard accessible, with zero script.' }
  ]
};
