// ==========================================================
// Coding Hub starter content - CSS.
// ==========================================================

export default {
  subject: 'css',

  lessons: [
    {
      topic: 'Selectors',
      title: 'Selectors: choosing exactly what you want to style',
      summary: 'Target elements, classes, ids and combinations, and understand which rule wins.',
      minutes: 15,
      objectives: [
        'Write element, class and id selectors',
        'Combine selectors with descendant, child and grouping combinators',
        'Work out which rule wins when two rules disagree'
      ],
      blocks: [
        { type: 'paragraph', text: 'A CSS rule has two halves: a selector that says *which* elements, and a declaration block that says *what* to change.' },
        { type: 'code', language: 'css', code: 'p {            /* selector  */\n  color: navy; /* declaration */\n}' },
        { type: 'heading', text: 'The three you use every day' },
        { type: 'table', headers: ['Selector', 'Matches', 'Example'], rows: [
          ['p', 'Every element of that type', 'p { margin: 0; }'],
          ['.note', 'Every element with class="note"', '.note { background: gold; }'],
          ['#header', 'The one element with id="header"', '#header { height: 60px; }']
        ] },
        { type: 'note', title: 'Reach for classes', text: 'Classes are reusable and easy to override. ids are so specific that they become hard to work with later. In practice, most professional stylesheets are almost entirely classes.' },
        { type: 'heading', text: 'Combining selectors' },
        { type: 'code', language: 'css', code: '/* Any <a> anywhere inside a <nav> */\nnav a { text-decoration: none; }\n\n/* Only a direct child */\nnav > a { font-weight: bold; }\n\n/* Elements with BOTH classes */\n.card.featured { border-color: gold; }\n\n/* Several selectors sharing one block */\nh1, h2, h3 { font-family: Georgia, serif; }\n\n/* The next sibling */\nh2 + p { margin-top: 0; }' },
        { type: 'heading', text: 'Which rule wins?' },
        { type: 'paragraph', text: 'When two rules set the same property on the same element, the browser scores each selector. Higher specificity wins; if the scores tie, the rule written last wins.' },
        { type: 'table', headers: ['Selector type', 'Score'], rows: [
          ['Inline style attribute', '1000'],
          ['id (#header)', '100'],
          ['class, attribute, pseudo-class (.note, [href], :hover)', '10'],
          ['element, pseudo-element (p, ::before)', '1']
        ] },
        { type: 'code', language: 'css', code: '/* score 1  */  p          { color: black; }\n/* score 10 */  .intro     { color: blue;  }\n/* score 11 */  p.intro    { color: green; }  /* this one wins */' },
        { type: 'warning', title: 'Avoid !important', text: 'It overrides everything and can then only be beaten by another !important. Almost every time you reach for it, a slightly more specific selector is the better fix.' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Writing .my class instead of .my-class — a space means "inside".',
          'Forgetting the dot: class="note" is selected by .note, not note.',
          'Fighting specificity by piling on ids instead of simplifying the selectors.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'p targets elements, .name targets a class, #name targets one id.',
          'A space means descendant, > means direct child, + means next sibling.',
          'Ties are broken by source order; otherwise higher specificity wins.'
        ] }
      ],
      challenge: {
        title: 'Style a card without touching the HTML',
        description: 'Using only CSS selectors, style the markup below to the requirements.',
        requirements: [
          'Every .card gets a light border and 1rem of padding',
          'Only the card that also has .featured gets a gold border',
          'Links inside a card have no underline, but regain it on hover',
          'The first paragraph directly after each h3 has no top margin'
        ],
        starterCode: '<div class="card">\n  <h3>Normal card</h3>\n  <p>Some text with a <a href="#">link</a>.</p>\n</div>\n<div class="card featured">\n  <h3>Featured card</h3>\n  <p>More text.</p>\n</div>\n\n<style>\n  /* your CSS here */\n</style>',
        expectedResult: 'Two bordered cards, the second with a gold border, tidy link styling and no gap between each heading and the paragraph under it.',
        hints: [
          'Two classes on the same element are written together with no space.',
          'h3 + p selects the paragraph immediately after the heading.'
        ],
        difficulty: 'intermediate',
        points: 30
      }
    },

    {
      topic: 'Box Model',
      title: 'The box model, and why your layout is 20px too wide',
      summary: 'Content, padding, border and margin — and the one line of CSS that makes sizing behave.',
      minutes: 14,
      objectives: [
        'Name the four layers of the CSS box model',
        'Calculate the rendered width of an element',
        'Explain what box-sizing: border-box changes',
        'Recognise margin collapse'
      ],
      blocks: [
        { type: 'paragraph', text: 'Every element is a rectangular box built from four layers, working outwards: content, padding, border, margin.' },
        { type: 'table', headers: ['Layer', 'What it is'], rows: [
          ['Content', 'The text or image itself'],
          ['Padding', 'Space inside the border — takes the background colour'],
          ['Border', 'The line around the padding'],
          ['Margin', 'Space outside the border, pushing other elements away — always transparent']
        ] },
        { type: 'heading', text: 'The classic surprise' },
        { type: 'code', language: 'css', code: '.box {\n  width: 200px;\n  padding: 20px;\n  border: 5px solid black;\n}' },
        { type: 'paragraph', text: 'By default, width sets the *content* width only. The box above actually occupies 200 + 20 + 20 + 5 + 5 = 250px. Put two of them in a 500px container with any margin at all and the layout breaks.' },
        { type: 'heading', text: 'The fix everybody uses' },
        { type: 'code', language: 'css', code: '*, *::before, *::after {\n  box-sizing: border-box;\n}' },
        { type: 'paragraph', text: 'With border-box, width includes the padding and border. The box above is then exactly 200px wide, with 150px of usable content space. Nearly every real project starts with this rule.' },
        { type: 'heading', text: 'Shorthand values' },
        { type: 'code', language: 'css', code: 'padding: 10px;                 /* all four sides */\npadding: 10px 20px;            /* top+bottom, left+right */\npadding: 10px 20px 30px;       /* top, left+right, bottom */\npadding: 10px 20px 30px 40px;  /* top, right, bottom, left (clockwise) */' },
        { type: 'heading', text: 'Margin collapse' },
        { type: 'paragraph', text: 'Two vertical margins that meet do not add up — the larger one wins. A 30px bottom margin above a 20px top margin produces a 30px gap, not 50px. Horizontal margins never collapse, and neither do margins inside a flex or grid container.' },
        { type: 'code', language: 'css', code: '/* Centre a fixed-width block horizontally */\n.container {\n  width: 960px;\n  max-width: 100%;\n  margin: 0 auto;\n}' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Using margin when you wanted space *inside* a coloured box — that is padding.',
          'Expecting width: 100% plus padding to fit, without border-box.',
          'Trying to put a margin on an inline element such as <span> and seeing nothing happen vertically.'
        ] },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'Content, padding, border, margin — outwards in that order.',
          'box-sizing: border-box makes width mean what you expect.',
          'Padding is inside the background; margin is outside it.',
          'Vertical margins collapse to the larger of the two.'
        ] }
      ],
      challenge: {
        title: 'Two boxes, one row',
        description: 'Make two boxes sit side by side in a 400px container, each with padding and a border, with no overflow.',
        requirements: [
          'The container is exactly 400px wide',
          'Each box is 50% wide with 16px padding and a 2px border',
          'Both boxes fit on one row with nothing spilling out',
          'You may not calculate the widths by hand'
        ],
        starterCode: '<div class="container">\n  <div class="box">One</div>\n  <div class="box">Two</div>\n</div>\n\n<style>\n  .container { width: 400px; display: flex; }\n  .box { width: 50%; padding: 16px; border: 2px solid #333; }\n  /* one more rule is needed */\n</style>',
        expectedResult: 'Two equal boxes filling the 400px container exactly, with visible padding and borders.',
        hints: ['The missing rule is one property applied to everything.'],
        difficulty: 'beginner',
        points: 25
      }
    },

    {
      topic: 'Flexbox',
      title: 'Flexbox: laying things out in a row or a column',
      summary: 'The one-dimensional layout system that solved centring, navigation bars and equal columns.',
      minutes: 16,
      objectives: [
        'Turn an element into a flex container',
        'Control alignment along both axes',
        'Use flex on children to share out space',
        'Centre anything, vertically and horizontally'
      ],
      blocks: [
        { type: 'paragraph', text: 'Flexbox arranges children along a single line — a row or a column. You set properties on the *container* to control the whole group, and on the *children* to control how each one flexes.' },
        { type: 'code', language: 'css', code: '.nav {\n  display: flex;          /* children now sit in a row */\n  gap: 1rem;              /* space between them */\n  align-items: center;    /* vertically centred */\n}' },
        { type: 'heading', text: 'The two axes' },
        { type: 'paragraph', text: 'The main axis follows flex-direction (row by default). The cross axis runs at right angles to it. justify-content works along the main axis; align-items works along the cross axis. Swap flex-direction to column and the two swap meaning — this is the single most common source of confusion.' },
        { type: 'table', headers: ['Property', 'Axis', 'Common values'], rows: [
          ['justify-content', 'Main', 'flex-start, center, space-between, space-around'],
          ['align-items', 'Cross', 'stretch, center, flex-start, flex-end, baseline'],
          ['flex-direction', '—', 'row, column, row-reverse, column-reverse'],
          ['flex-wrap', '—', 'nowrap, wrap'],
          ['gap', '—', 'Any length, e.g. 1rem']
        ] },
        { type: 'heading', text: 'Perfect centring' },
        { type: 'code', language: 'css', code: '.centre-me {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}' },
        { type: 'paragraph', text: 'Three lines. Before flexbox this took absolute positioning, negative margins and a lot of hope.' },
        { type: 'heading', text: 'Sharing out space with flex' },
        { type: 'code', language: 'css', code: '.sidebar { flex: 0 0 240px; }  /* never grow, never shrink, 240px */\n.content { flex: 1; }          /* take all remaining space */' },
        { type: 'paragraph', text: 'flex: 1 is shorthand for flex-grow: 1; flex-shrink: 1; flex-basis: 0. Two children both set to flex: 1 end up exactly equal, whatever is inside them.' },
        { type: 'heading', text: 'A real navigation bar' },
        { type: 'code', language: 'css', code: '.header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 1.5rem;\n}\n.header nav {\n  display: flex;\n  gap: 1.25rem;\n}' },
        { type: 'heading', text: 'Common mistakes' },
        { type: 'list', items: [
          'Setting flex properties on the child when they belong on the container (or the reverse).',
          'Using justify-content to centre vertically in a row — that is align-items.',
          'Forgetting flex-wrap: wrap, so items squash instead of moving to a new line on small screens.',
          'Reaching for margins between items when gap does the job cleanly.'
        ] },
        { type: 'info', title: 'Flexbox or Grid?', text: 'Flexbox is one-dimensional: a row *or* a column. Grid is two-dimensional: rows *and* columns at the same time. A navigation bar is flexbox; a photo gallery with aligned rows and columns is grid.' },
        { type: 'heading', text: 'Summary' },
        { type: 'list', items: [
          'display: flex on the parent starts everything.',
          'justify-content = main axis, align-items = cross axis.',
          'flex: 1 on children shares out the leftover space.',
          'gap is the modern way to space items apart.'
        ] }
      ],
      challenge: {
        title: 'Build a responsive header',
        description: 'Build a header with a logo on the left and navigation links on the right that wraps neatly on a narrow screen.',
        requirements: [
          'The logo is on the far left, the links on the far right',
          'Everything is vertically centred',
          'There is 1rem of space between the links, set with gap',
          'On a narrow screen the links wrap onto a second line instead of overflowing'
        ],
        starterCode: '<header class="header">\n  <a class="logo" href="#">CodeHub</a>\n  <nav>\n    <a href="#">Subjects</a>\n    <a href="#">Practice</a>\n    <a href="#">Progress</a>\n    <a href="#">Profile</a>\n  </nav>\n</header>\n\n<style>\n  /* your CSS here */\n</style>',
        expectedResult: 'A header bar with the logo left, links right, all vertically centred, wrapping gracefully when the window is narrowed.',
        hints: [
          'space-between pushes the first and last child to the two ends.',
          'Both the header and the nav can be flex containers.'
        ],
        difficulty: 'intermediate',
        points: 35
      }
    }
  ],

  questions: [
    { topic: 'CSS Introduction', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'What does CSS stand for?',
      options: ['Cascading Style Sheets', 'Computer Style System', 'Coloured Simple Sheets', 'Creative Styling Syntax'],
      answer: 0, tags: 'basics',
      explanation: '"Cascading" describes how several rules flow together and one of them wins.' },
    { topic: 'CSS Introduction', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which element links an external stylesheet to a page?',
      options: ['<style>', '<css>', '<link>', '<script>'], answer: 2, tags: 'basics',
      explanation: '<link rel="stylesheet" href="styles.css"> goes in the head.' },
    { topic: 'Syntax', type: 'fill_blank', difficulty: 'beginner', points: 10,
      prompt: 'Complete the rule: p { color_______ red; }', answer: ':', tags: 'syntax',
      explanation: 'A declaration is property, colon, value, semicolon.' },
    { topic: 'Syntax', type: 'debug', difficulty: 'beginner', points: 15,
      prompt: 'Why does the background colour not apply?',
      code: '.card {\n  background-color #f0f0f0;\n  padding: 1rem;\n}',
      options: ['background-color is not a real property', 'The colon after the property is missing', 'Hex colours need quotes', 'The class needs a # instead of a .'],
      answer: 1, tags: 'syntax',
      explanation: 'Without the colon the declaration is invalid, so the browser skips that line (the padding still works).' },

    { topic: 'Selectors', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which selector matches class="note"?',
      options: ['#note', '.note', 'note', '*note'], answer: 1, tags: 'selectors',
      explanation: 'A dot selects a class; a hash selects an id.' },
    { topic: 'Selectors', type: 'output', difficulty: 'intermediate', points: 15,
      prompt: 'What colour is the paragraph?',
      code: 'p       { color: black; }\n.intro  { color: blue; }\np.intro { color: green; }\n\n<p class="intro">Hello</p>',
      options: ['black', 'blue', 'green', 'The browser default'], answer: 2, tags: 'specificity',
      explanation: 'p.intro scores 11 (one element + one class), beating .intro at 10 and p at 1.' },
    { topic: 'Selectors', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What does "nav > a" select?',
      options: ['Any a inside a nav, at any depth', 'Only a elements that are direct children of nav', 'The a immediately after a nav', 'Every nav that contains an a'],
      answer: 1, tags: 'selectors',
      explanation: '> is the child combinator; a plain space is the descendant combinator.' },
    { topic: 'Selectors', type: 'true_false', difficulty: 'advanced', points: 20,
      prompt: 'An id selector has higher specificity than any number of class selectors.', answer: 'true', tags: 'specificity',
      explanation: 'Specificity is compared column by column: a single id beats even ten classes.' },

    { topic: 'Colors', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which value is a valid CSS colour?',
      options: ['#ff0000', 'rgb(255, 0, 0)', 'red', 'All of these'], answer: 3, tags: 'colour',
      explanation: 'Hex, rgb(), named colours, hsl() and more are all valid ways of writing the same red.' },
    { topic: 'Colors', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'In rgba(0, 0, 0, 0.5), what does the fourth number control?',
      options: ['Brightness', 'Opacity', 'Saturation', 'Hue'], answer: 1, tags: 'colour',
      explanation: 'The alpha channel runs from 0 (fully transparent) to 1 (fully opaque).' },

    { topic: 'Box Model', type: 'output', difficulty: 'intermediate', points: 15,
      prompt: 'With the default box-sizing, how wide is this element on screen?',
      code: '.box {\n  width: 200px;\n  padding: 20px;\n  border: 5px solid black;\n}',
      options: ['200px', '230px', '250px', '245px'], answer: 2, tags: 'box-model',
      explanation: '200 content + 20 + 20 padding + 5 + 5 border = 250px, because width sets only the content box.' },
    { topic: 'Box Model', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which layer sits *outside* the border?',
      options: ['Padding', 'Content', 'Margin', 'Outline'], answer: 2, tags: 'box-model',
      explanation: 'Working outwards: content, padding, border, margin.' },
    { topic: 'Box Model', type: 'fill_blank', difficulty: 'intermediate', points: 15,
      prompt: 'Complete the rule that makes width include padding and border: box-sizing: _______;', answer: 'border-box', tags: 'box-model',
      explanation: 'border-box is applied to * in almost every real project.' },
    { topic: 'Margins', type: 'true_false', difficulty: 'advanced', points: 20,
      prompt: 'A 30px bottom margin above a 20px top margin produces a 50px gap.', answer: 'false', tags: 'box-model',
      explanation: 'Vertical margins collapse: the gap is 30px, the larger of the two.' },
    { topic: 'Padding', type: 'output', difficulty: 'intermediate', points: 15,
      prompt: 'What does "padding: 10px 20px;" set?',
      code: '.box { padding: 10px 20px; }',
      options: ['10px on all sides', '10px top and bottom, 20px left and right', '10px left and right, 20px top and bottom', '10px top, 20px right, 0 elsewhere'],
      answer: 1, tags: 'shorthand',
      explanation: 'Two values are vertical then horizontal. Four values run clockwise from the top.' },

    { topic: 'Display', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which display value makes an element start on a new line and fill the available width?',
      options: ['inline', 'block', 'inline-block', 'none'], answer: 1, tags: 'display',
      explanation: 'Block elements stack vertically. Inline elements sit within a line of text.' },
    { topic: 'Display', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'You set a height on a <span> and nothing changes. Why?',
      options: ['Spans cannot be styled', 'Inline elements ignore width and height', 'The height needs !important', 'You must set position first'],
      answer: 1, tags: 'display',
      explanation: 'Give it display: inline-block (or block) and the height applies.' },

    { topic: 'Position', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which position value takes an element out of the normal flow and positions it relative to the nearest positioned ancestor?',
      options: ['static', 'relative', 'absolute', 'sticky'], answer: 2, tags: 'position',
      explanation: 'absolute looks up the tree for an ancestor whose position is not static, and falls back to the page.' },
    { topic: 'Position', type: 'true_false', difficulty: 'intermediate', points: 15,
      prompt: 'position: relative moves an element but leaves its original space reserved.', answer: 'true', tags: 'position',
      explanation: 'That is exactly why relative is used as the anchor for an absolutely positioned child.' },
    { topic: 'Z-Index', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'Why might z-index: 9999 have no effect?',
      options: ['The number is too large', 'The element has position: static', 'z-index only works on images', 'It needs a unit'],
      answer: 1, tags: 'position',
      explanation: 'z-index applies only to positioned elements (relative, absolute, fixed, sticky) and flex/grid children.' },

    { topic: 'Flexbox', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which property starts a flex layout?',
      options: ['flex: 1', 'display: flex', 'flex-direction: row', 'align-items: center'], answer: 1, tags: 'flexbox',
      explanation: 'display: flex on the container is what makes all the other flex properties apply.' },
    { topic: 'Flexbox', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'In a default flex row, which property centres the children vertically?',
      options: ['justify-content: center', 'align-items: center', 'text-align: center', 'vertical-align: middle'],
      answer: 1, tags: 'flexbox',
      explanation: 'In a row the cross axis is vertical, and align-items works on the cross axis.' },
    { topic: 'Flexbox', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'You want a fixed 240px sidebar and a content area that takes everything else. What do you put on the content area?',
      options: ['width: 100%', 'flex: 1', 'flex-basis: auto', 'align-self: stretch'], answer: 1, tags: 'flexbox',
      explanation: 'flex: 1 lets it grow into whatever space the fixed sidebar leaves behind.' },
    { topic: 'Flexbox', type: 'true_false', difficulty: 'intermediate', points: 15,
      prompt: 'Setting flex-direction: column swaps which axis justify-content and align-items work on.', answer: 'true', tags: 'flexbox',
      explanation: 'justify-content always follows the main axis, which becomes vertical in a column.' },

    { topic: 'CSS Grid', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'What does "grid-template-columns: repeat(3, 1fr)" create?',
      options: ['Three rows of equal height', 'Three columns of equal width', 'A 3x3 grid', 'Three columns of 1 pixel'],
      answer: 1, tags: 'grid',
      explanation: 'fr is a fraction of the free space, so three 1fr columns share the width equally.' },
    { topic: 'CSS Grid', type: 'scenario', difficulty: 'advanced', points: 20,
      prompt: 'You need a gallery whose columns fit as many 200px cards as will fit, with no media queries. Which value does it?',
      options: ['repeat(4, 200px)', 'repeat(auto-fit, minmax(200px, 1fr))', '200px 200px 200px', 'auto auto auto'],
      answer: 1, tags: 'grid',
      explanation: 'auto-fit with minmax lets the browser work out the column count at every width by itself.' },

    { topic: 'Responsive Design', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which unit is relative to the root font size?',
      options: ['px', 'rem', 'pt', 'cm'], answer: 1, tags: 'units',
      explanation: 'rem = root em. It scales with the user’s browser font-size setting, which px does not.' },
    { topic: 'Media Queries', type: 'fill_blank', difficulty: 'intermediate', points: 15,
      prompt: 'Complete the query for screens 600px and narrower: @media (_______: 600px) { ... }', answer: 'max-width', tags: 'responsive',
      explanation: 'max-width applies at that width and below; min-width applies at that width and above.' },
    { topic: 'Media Queries', type: 'true_false', difficulty: 'intermediate', points: 15,
      prompt: 'In a mobile-first stylesheet you write the small-screen styles first and add min-width queries for larger screens.', answer: 'true', tags: 'responsive',
      explanation: 'Mobile-first keeps the base stylesheet simple and only adds complexity as space allows.' },

    { topic: 'Transitions', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which declaration smoothly animates a colour change over a quarter of a second?',
      options: ['transition: background-color 0.25s;', 'animate: background-color 250;', 'transition: 250;', 'change: background-color slow;'],
      answer: 0, tags: 'animation',
      explanation: 'transition takes a property, a duration and optionally a timing function and delay.' },
    { topic: 'Animations', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'Which at-rule defines the steps of a CSS animation?',
      options: ['@media', '@keyframes', '@animation', '@steps'], answer: 1, tags: 'animation',
      explanation: '@keyframes names the animation and lists the states from 0% to 100%.' },
    { topic: 'Transforms', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which transform makes an element 10% larger?',
      options: ['scale(1.1)', 'zoom(110)', 'size(1.1)', 'grow(10%)'], answer: 0, tags: 'animation',
      explanation: 'scale() multiplies the size; 1 is the original, 1.1 is 10% larger.' },

    { topic: 'Variables', type: 'output', difficulty: 'intermediate', points: 15,
      prompt: 'What colour is the button?',
      code: ':root { --brand: #2f6feb; }\n.button { background: var(--brand); }',
      options: ['Transparent', '#2f6feb', 'Black', 'It is invalid CSS'], answer: 1, tags: 'variables',
      explanation: 'Custom properties are declared with -- and read back with var().' },
    { topic: 'Variables', type: 'true_false', difficulty: 'advanced', points: 20,
      prompt: 'A CSS custom property can be changed at runtime by JavaScript.', answer: 'true', tags: 'variables',
      explanation: 'element.style.setProperty("--brand", "red") updates it live — this is how theme switchers work.' },

    { topic: 'Pseudo-classes', type: 'multiple_choice', difficulty: 'beginner', points: 10,
      prompt: 'Which pseudo-class styles an element while the pointer is over it?',
      options: [':focus', ':hover', ':active', ':visited'], answer: 1, tags: 'pseudo',
      explanation: ':hover is pointer-over, :focus is keyboard/selection focus, :active is while being pressed.' },
    { topic: 'Pseudo-elements', type: 'multiple_choice', difficulty: 'advanced', points: 20,
      prompt: 'What must ::before always have in order to appear?',
      options: ['A width', 'A content property', 'position: absolute', 'A z-index'], answer: 1, tags: 'pseudo',
      explanation: 'Without content (even content: "") the pseudo-element is not generated at all.' },
    { topic: 'Overflow', type: 'multiple_choice', difficulty: 'intermediate', points: 15,
      prompt: 'Which value adds scrollbars only when the content is actually too big?',
      options: ['overflow: scroll', 'overflow: auto', 'overflow: hidden', 'overflow: visible'],
      answer: 1, tags: 'overflow',
      explanation: 'scroll shows the scrollbar track always; auto shows it only when needed.' },
    { topic: 'Fonts', type: 'scenario', difficulty: 'intermediate', points: 15,
      prompt: 'Why does font-family usually list several names, such as "Inter, system-ui, sans-serif"?',
      options: ['To blend the fonts together', 'It is a fallback list, tried left to right', 'To make the text load faster', 'Browsers require exactly three'],
      answer: 1, tags: 'fonts',
      explanation: 'The browser uses the first font it can actually find, so the last entry should be a generic family.' },
    { topic: 'Advanced CSS', type: 'scenario', difficulty: 'advanced', points: 20,
      prompt: 'A rule refuses to apply and you are tempted to add !important. What is the better first step?',
      options: ['Add an id to the element', 'Check the specificity and source order of the competing rules', 'Move the rule to the top of the file', 'Add !important to both rules'],
      answer: 1, tags: 'specificity',
      explanation: 'Inspecting which rule is winning, and why, usually reveals a one-word fix. !important only postpones the problem.' }
  ]
};
