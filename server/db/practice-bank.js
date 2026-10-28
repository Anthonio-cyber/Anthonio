// ==========================================================
// The starter set of practice subjects and questions.
//
// Teachers and administrators can add their own from inside the
// app; this is just so Practice is useful on the first day.
// Each question has one right answer and a short explanation,
// because seeing why an answer is right is the point.
// ==========================================================

export const TOPICS = [
  ['Mathematics', 'Number',        'Place value, negatives, primes and indices.'],
  ['Mathematics', 'Algebra',       'Expressions, equations and expanding brackets.'],
  ['Mathematics', 'Fractions',     'Fractions, decimals, percentages and ratio.'],
  ['Mathematics', 'Shape',         'Area, perimeter and angles.'],
  ['Mathematics', 'Data',          'Averages, charts and probability.'],
  ['English',     'Grammar',       'Word classes, tenses and sentence structure.'],
  ['English',     'Punctuation',   'Commas, apostrophes and speech marks.'],
  ['English',     'Spelling',      'Tricky spellings and homophones.'],
  ['English',     'Reading',       'Vocabulary and literary devices.'],
  ['Science',     'Biology',       'Cells, the human body and living things.'],
  ['Science',     'Chemistry',     'Elements, reactions and states of matter.'],
  ['Science',     'Physics',       'Forces, electricity, light and space.'],
  ['Geography',   'Physical',      'Rivers, weather and the structure of the Earth.'],
  ['Geography',   'Human',         'Countries, capitals and population.'],
  ['Geography',   'Map skills',    'Grid references, contours and scale.'],
  ['History',     'World wars',    'Causes, events and consequences.'],
  ['History',     'Africa',        'Independence and the people who led it.'],
  ['History',     'Ancient world', 'Early civilisations and their achievements.'],
  ['History',     'Modern world',  'Exploration, industry and civil rights.'],
  ['ICT',         'Hardware',      'The parts of a computer and what they do.'],
  ['ICT',         'Online safety', 'Passwords, privacy and spotting scams.'],
  ['ICT',         'The internet',  'How the web works and how data travels.'],
  ['ICT',         'Programming',   'Loops, variables, bugs and output.']
];

/**
 * The first questions were written with free-text topics. This puts each
 * one into the matching real topic, so the bank has a tidy structure
 * instead of dozens of one-question topics.
 */
export const TOPIC_ALIASES = {
  'Mathematics': {
    'Percentages': 'Fractions', 'Ratio': 'Fractions', 'Fractions': 'Fractions',
    'Area': 'Shape', 'Perimeter': 'Shape', 'Angles': 'Shape',
    'Number': 'Number', 'Negative numbers': 'Number', 'Indices': 'Number',
    'Algebra': 'Algebra', 'Averages': 'Data'
  },
  'English': {
    'Word classes': 'Grammar', 'Plurals': 'Grammar', 'Grammar': 'Grammar',
    'Apostrophes': 'Punctuation', 'Punctuation': 'Punctuation',
    'Homophones': 'Spelling', 'Spelling': 'Spelling',
    'Vocabulary': 'Reading', 'Literary devices': 'Reading'
  },
  'Science': {
    'Plants': 'Biology', 'Human body': 'Biology', 'Cells': 'Biology', 'Biology': 'Biology',
    'Chemistry': 'Chemistry', 'States of matter': 'Chemistry',
    'Space': 'Physics', 'Forces': 'Physics', 'Electricity': 'Physics'
  },
  'Geography': {
    'Rivers': 'Physical', 'Earth structure': 'Physical', 'Weather': 'Physical',
    'Climate': 'Physical', 'Natural features': 'Physical',
    'Capitals': 'Human', 'Continents': 'Human', 'Maps': 'Map skills'
  },
  'History': {
    'World wars': 'World wars', 'Africa': 'Africa', 'Ancient world': 'Ancient world',
    'Exploration': 'Modern world', 'Industry': 'Modern world', 'Civil rights': 'Modern world'
  },
  'ICT': {
    'Hardware': 'Hardware', 'Storage': 'Hardware',
    'Internet safety': 'Online safety', 'Internet': 'The internet',
    'Programming': 'Programming'
  }
};

export const SUBJECTS = [
  { name: 'Mathematics', icon: 'chart',  description: 'Number, algebra, shape and data.',            sort_order: 1 },
  { name: 'English',     icon: 'book',   description: 'Grammar, punctuation, spelling and reading.', sort_order: 2 },
  { name: 'Science',     icon: 'zap',    description: 'Biology, chemistry and physics.',             sort_order: 3 },
  { name: 'Geography',   icon: 'target', description: 'Maps, places, weather and the Earth.',        sort_order: 4 },
  { name: 'History',     icon: 'clock',  description: 'People and events that shaped the world.',    sort_order: 5 },
  { name: 'ICT',         icon: 'grid',   description: 'Computers, the internet and staying safe.',   sort_order: 6 }
];

const q = (subject, topic, difficulty, question, options, answer_index, explanation) =>
  ({ subject, topic, difficulty, question, options, answer_index, explanation });

export const QUESTIONS = [
  // ---------------- Mathematics ----------------
  q('Mathematics', 'Percentages', 'easy', 'What is 15% of 240?', ['36', '32', '24', '48'], 0,
    '10% of 240 is 24, and 5% is half of that, 12. So 24 + 12 = 36.'),
  q('Mathematics', 'Algebra', 'easy', 'Solve for x:  3x + 7 = 22', ['3', '5', '7', '15'], 1,
    'Take 7 from both sides to get 3x = 15, then divide both sides by 3, so x = 5.'),
  q('Mathematics', 'Area', 'easy', 'What is the area of a triangle with base 10 cm and height 6 cm?', ['60 cm²', '16 cm²', '30 cm²', '32 cm²'], 2,
    'Area of a triangle is half the base times the height: (10 x 6) / 2 = 30 cm².'),
  q('Mathematics', 'Number', 'easy', 'Which of these is a prime number?', ['21', '27', '29', '33'], 2,
    '29 divides only by 1 and itself. 21 = 3 x 7, 27 = 3 x 9 and 33 = 3 x 11.'),
  q('Mathematics', 'Fractions', 'medium', 'What is 2/3 + 1/4?', ['3/7', '11/12', '3/12', '2/7'], 1,
    'Make the bottoms match: 2/3 = 8/12 and 1/4 = 3/12. Then 8/12 + 3/12 = 11/12.'),
  q('Mathematics', 'Ratio', 'medium', 'Share 60 sweets in the ratio 2:3. How many does the smaller share get?', ['20', '24', '30', '36'], 1,
    'There are 2 + 3 = 5 parts, and 60 / 5 = 12 sweets per part. The smaller share is 2 parts, so 2 x 12 = 24.'),
  q('Mathematics', 'Negative numbers', 'easy', 'What is -7 + 12?', ['5', '-5', '19', '-19'], 0,
    'Starting at -7 and counting up 12 lands on 5.'),
  q('Mathematics', 'Indices', 'medium', 'What is 2⁵?', ['10', '25', '32', '16'], 2,
    '2⁵ means 2 x 2 x 2 x 2 x 2, which is 32.'),
  q('Mathematics', 'Angles', 'medium', 'The angles in a triangle are 55° and 65°. What is the third angle?', ['50°', '60°', '70°', '80°'], 1,
    'Angles in a triangle add to 180°. 180 - 55 - 65 = 60°.'),
  q('Mathematics', 'Averages', 'easy', 'What is the mean of 4, 8, 10 and 6?', ['6', '7', '8', '9'], 1,
    'Add them: 4 + 8 + 10 + 6 = 28. Divide by how many there are: 28 / 4 = 7.'),
  q('Mathematics', 'Perimeter', 'easy', 'A rectangle is 9 cm by 4 cm. What is its perimeter?', ['13 cm', '26 cm', '36 cm', '18 cm'], 1,
    'Perimeter is all four sides: 9 + 4 + 9 + 4 = 26 cm.'),
  q('Mathematics', 'Algebra', 'hard', 'Expand and simplify:  3(x + 4) - 2x', ['x + 12', '5x + 12', 'x + 4', '5x + 4'], 0,
    '3(x + 4) is 3x + 12. Taking away 2x leaves x + 12.'),

  // ---------------- English ----------------
  q('English', 'Word classes', 'easy', 'Which word is an adverb?', ['Quickly', 'Quick', 'Quicken', 'Quickness'], 0,
    'Adverbs usually describe how something is done, and often end in -ly.'),
  q('English', 'Plurals', 'easy', 'What is the plural of "child"?', ['Childs', 'Childes', 'Children', 'Childrens'], 2,
    '"Child" is irregular: its plural is "children", with no extra s.'),
  q('English', 'Apostrophes', 'medium', 'Which sentence uses the apostrophe correctly?', ["The dog's bone", "The dogs' bone's", "The dogs bone's", "The dog's bone's"], 0,
    'One dog owns the bone, so the apostrophe goes before the s.'),
  q('English', 'Homophones', 'easy', 'Choose the correct word: "____ going to be late."', ['Their', "They're", 'There', 'Theyre'], 1,
    '"They\'re" is short for "they are", which is what the sentence needs.'),
  q('English', 'Punctuation', 'medium', 'Which sentence is punctuated correctly?', ['After we ate, we went home.', 'After we ate we went, home.', 'After, we ate we went home.', 'After we, ate we went home.'], 0,
    'The comma separates the opening clause from the main part of the sentence.'),
  q('English', 'Vocabulary', 'medium', 'What does "reluctant" mean?', ['Very tired', 'Unwilling', 'Extremely happy', 'In a hurry'], 1,
    'Someone reluctant hesitates because they do not really want to do something.'),
  q('English', 'Grammar', 'medium', 'Which sentence is in the passive voice?', ['The cat chased the mouse.', 'The mouse was chased by the cat.', 'The cat is chasing the mouse.', 'The cat will chase the mouse.'], 1,
    'In the passive, the thing having something done to it comes first.'),
  q('English', 'Literary devices', 'medium', 'Which sentence contains a simile?', ['The wind howled angrily.', 'She was as brave as a lion.', 'The sun smiled down.', 'He has a heart of stone.'], 1,
    'A simile compares using "like" or "as". The others are personification and metaphor.'),
  q('English', 'Spelling', 'easy', 'Which spelling is correct?', ['Definately', 'Definatly', 'Definitely', 'Definitley'], 2,
    'It helps to remember the word "finite" sits inside "definitely".'),
  q('English', 'Word classes', 'medium', 'In "The tall boy ran quickly", which word is the adjective?', ['Tall', 'Boy', 'Ran', 'Quickly'], 0,
    'An adjective describes a noun. "Tall" describes the boy.'),

  // ---------------- Science ----------------
  q('Science', 'Plants', 'easy', 'What gas do plants take in during photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2,
    'Plants take in carbon dioxide and give out oxygen during photosynthesis.'),
  q('Science', 'Chemistry', 'easy', 'What is the chemical symbol for gold?', ['Go', 'Au', 'Ag', 'Gd'], 1,
    'Au comes from the Latin name for gold, "aurum". Ag is silver.'),
  q('Science', 'Human body', 'medium', 'How many bones are in an adult human body?', ['206', '186', '224', '198'], 0,
    'Babies are born with about 270, and some fuse together as they grow.'),
  q('Science', 'Space', 'easy', 'Which planet is closest to the Sun?', ['Venus', 'Earth', 'Mars', 'Mercury'], 3,
    'Mercury is first, then Venus, Earth and Mars.'),
  q('Science', 'States of matter', 'easy', 'What is it called when a gas turns into a liquid?', ['Evaporation', 'Condensation', 'Sublimation', 'Melting'], 1,
    'Condensation is a gas cooling into a liquid, like water forming on a cold window.'),
  q('Science', 'Forces', 'medium', 'What is the unit of force?', ['Joule', 'Watt', 'Newton', 'Pascal'], 2,
    'Force is measured in newtons, named after Isaac Newton.'),
  q('Science', 'Cells', 'medium', 'Which part of a plant cell carries out photosynthesis?', ['Nucleus', 'Chloroplast', 'Cell wall', 'Vacuole'], 1,
    'Chloroplasts hold chlorophyll, the green substance that captures light.'),
  q('Science', 'Electricity', 'medium', 'In a series circuit, what happens if one bulb breaks?', ['Nothing changes', 'The others get brighter', 'All the bulbs go out', 'Only that bulb goes out'], 2,
    'A series circuit is one single loop, so a break anywhere stops the whole current.'),
  q('Science', 'Chemistry', 'medium', 'What is the pH of a neutral substance?', ['0', '7', '10', '14'], 1,
    'Below 7 is acidic and above 7 is alkaline, so 7 is neutral - like pure water.'),
  q('Science', 'Biology', 'easy', 'Which organ pumps blood around the body?', ['Lungs', 'Liver', 'Heart', 'Kidneys'], 2,
    'The heart pumps blood; the lungs add oxygen to it.'),

  // ---------------- Geography ----------------
  q('Geography', 'Rivers', 'easy', 'Which is the longest river in Africa?', ['Congo', 'Niger', 'Nile', 'Zambezi'], 2,
    'The Nile runs about 6,650 km through north-east Africa.'),
  q('Geography', 'Capitals', 'easy', 'What is the capital city of Kenya?', ['Kampala', 'Nairobi', 'Dodoma', 'Kigali'], 1,
    'Kampala is Uganda, Dodoma is Tanzania and Kigali is Rwanda.'),
  q('Geography', 'Earth structure', 'easy', 'Which layer of the Earth do we live on?', ['Mantle', 'Outer core', 'Crust', 'Inner core'], 2,
    'The crust is the thin rocky outer layer.'),
  q('Geography', 'Continents', 'easy', 'How many continents are there?', ['5', '6', '7', '8'], 2,
    'Africa, Antarctica, Asia, Europe, North America, Oceania and South America.'),
  q('Geography', 'Weather', 'medium', 'What instrument measures air pressure?', ['Thermometer', 'Barometer', 'Anemometer', 'Hygrometer'], 1,
    'A barometer measures pressure; an anemometer measures wind speed.'),
  q('Geography', 'Maps', 'medium', 'On a map, what does a contour line show?', ['A road', 'A border', 'Height above sea level', 'A river'], 2,
    'Contour lines join points of equal height. Lines close together mean a steep slope.'),
  q('Geography', 'Climate', 'medium', 'Which line of latitude is at 0 degrees?', ['The Equator', 'The Tropic of Cancer', 'The Prime Meridian', 'The Arctic Circle'], 0,
    'The Equator is 0° latitude. The Prime Meridian is 0° longitude.'),
  q('Geography', 'Natural features', 'medium', 'What causes a tsunami?', ['Strong winds', 'An underwater earthquake', 'Heavy rainfall', 'High tides'], 1,
    'A sudden movement of the sea floor displaces a huge volume of water.'),

  // ---------------- History ----------------
  q('History', 'World wars', 'easy', 'In which year did the Second World War end?', ['1943', '1945', '1947', '1939'], 1,
    'It ended in 1945, after beginning in 1939.'),
  q('History', 'Africa', 'easy', 'Who was the first President of Ghana?', ['Jomo Kenyatta', 'Nelson Mandela', 'Kwame Nkrumah', 'Julius Nyerere'], 2,
    'Kwame Nkrumah led Ghana to independence in 1957.'),
  q('History', 'Ancient world', 'easy', 'The pyramids at Giza were built in which country?', ['Greece', 'Iraq', 'Egypt', 'Mexico'], 2,
    'They were built as tombs for Egyptian pharaohs.'),
  q('History', 'Exploration', 'medium', 'Who is credited with first sailing around the world?', ["Christopher Columbus", "Ferdinand Magellan's expedition", 'Vasco da Gama', 'Marco Polo'], 1,
    "Magellan died on the way, but his expedition completed the voyage in 1522."),
  q('History', 'Industry', 'medium', 'The Industrial Revolution began in which country?', ['France', 'Germany', 'Britain', 'The United States'], 2,
    'It began in Britain in the late 1700s, then spread.'),
  q('History', 'Civil rights', 'medium', 'Nelson Mandela was imprisoned for how many years?', ['18', '27', '33', '12'], 1,
    'He was imprisoned for 27 years and released in 1990.'),

  // ---------------- ICT ----------------
  q('ICT', 'Hardware', 'easy', 'What does CPU stand for?', ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Control Processing Unit'], 1,
    'The Central Processing Unit carries out the instructions in a program.'),
  q('ICT', 'Hardware', 'easy', 'Which of these is an input device?', ['Monitor', 'Printer', 'Keyboard', 'Speaker'], 2,
    'Input devices send information in. The other three send information out.'),
  q('ICT', 'Storage', 'easy', 'How many megabytes are in a gigabyte?', ['100', '512', '1024', '2048'], 2,
    'Each step up multiplies by 1024, so 1 GB = 1024 MB.'),
  q('ICT', 'Internet safety', 'easy', 'What makes a strong password?', ['Your name and birthday', 'A long mix of letters, numbers and symbols', 'The word "password"', 'The same one everywhere'], 1,
    'Length and variety matter most, and never reuse a password across sites.'),
  q('ICT', 'Internet safety', 'medium', 'Somebody you do not know asks for your address online. What should you do?', ['Send it, to be polite', 'Share it only if they share theirs', 'Refuse and tell a trusted adult', 'Post it publicly instead'], 2,
    'Never share personal details with strangers online, and always tell an adult.'),
  q('ICT', 'Internet', 'medium', 'What does the "www" in a web address stand for?', ['World Wide Web', 'Web Wide World', 'Wide World Web', 'World Web Wide'], 0,
    'It stands for World Wide Web.'),
  q('ICT', 'Programming', 'medium', 'In programming, what is a "loop"?', ['A mistake in the code', 'Code that repeats', 'A kind of variable', 'A way to store files'], 1,
    'A loop repeats a block of code, either a set number of times or until a condition is met.'),
  q('ICT', 'Internet safety', 'medium', 'What is phishing?', ['A type of computer game', 'Tricking people into giving away private information', 'Making a website load faster', 'Backing up your files'], 1,
    'Phishing messages pretend to be someone trustworthy to steal passwords or money.')
];

// ---- Questions that are not simple multiple choice ----------------------
// kind: true_false | fill_blank | find_bug | output
const t  = (subject, topic, difficulty, question, isTrue, explanation) =>
  ({ subject, topic, difficulty, kind: 'true_false', question,
     options: ['True', 'False'], answer_index: isTrue ? 0 : 1, explanation });

const fb = (subject, topic, difficulty, question, accepted, explanation) =>
  ({ subject, topic, difficulty, kind: 'fill_blank', question, accepted, explanation });

const code = (subject, topic, difficulty, kind, question, codeSnippet, options, answer_index, explanation) =>
  ({ subject, topic, difficulty, kind, question, codeSnippet, options, answer_index, explanation });

export const EXTRA_QUESTIONS = [
  // ---------------- True or false ----------------
  t('Science', 'Biology', 'easy', 'The heart has four chambers.', true,
    'Two atria on top and two ventricles underneath.'),
  t('Science', 'Physics', 'easy', 'Sound travels faster than light.', false,
    'Light is far faster, which is why you see lightning before you hear thunder.'),
  t('Mathematics', 'Number', 'easy', 'Every prime number is odd.', false,
    '2 is prime and even. It is the only even prime.'),
  t('Mathematics', 'Shape', 'medium', 'The angles inside any quadrilateral add up to 360 degrees.', true,
    'A quadrilateral splits into two triangles, and 180 + 180 = 360.'),
  t('English', 'Grammar', 'medium', 'A verb is a word that describes a noun.', false,
    'That is an adjective. A verb is a doing or being word.'),
  t('Geography', 'Physical', 'easy', 'The Equator is the longest line of latitude.', true,
    'It sits at the widest part of the Earth, so it is the longest.'),
  t('ICT', 'Online safety', 'easy', 'It is safe to use the same password on every website.', false,
    'If one site is broken into, every other account is then at risk.'),

  // ---------------- Fill in the blank ----------------
  fb('Science', 'Biology', 'easy', 'Green plants make their own food by a process called ___.',
    ['photosynthesis'], 'Photosynthesis uses light, water and carbon dioxide.'),
  fb('Science', 'Chemistry', 'medium', 'Water boils at ___ degrees Celsius at sea level.',
    ['100', 'one hundred'], 'At normal air pressure water boils at 100 °C.'),
  fb('Mathematics', 'Shape', 'easy', 'A shape with eight sides is called an ___.',
    ['octagon'], 'Oct- means eight, as in October, once the eighth month.'),
  fb('English', 'Grammar', 'medium', 'A word that describes a verb is an ___.',
    ['adverb'], 'Adverbs often end in -ly, such as quickly or carefully.'),
  fb('Geography', 'Human', 'easy', 'The capital city of Ghana is ___.',
    ['accra'], 'Accra is on the Atlantic coast and is the largest city in Ghana.'),
  fb('ICT', 'Hardware', 'medium', 'Memory that loses its contents when the power goes off is called ___.',
    ['ram', 'random access memory'], 'RAM is temporary. A hard disk keeps its contents without power.'),

  // ---------------- Find the bug ----------------
  code('ICT', 'Programming', 'easy', 'find_bug',
    'This should print the numbers 1 to 5, but it does not. What is wrong?',
    'for (let i = 1; i < 5; i++) {\n  print(i);\n}',
    ['It should be i <= 5', 'It should start at 0', 'print should be inside the brackets', 'i++ should be i--'],
    0, 'With i < 5 the loop stops after 4. Using i <= 5 includes the 5.'),

  code('ICT', 'Programming', 'medium', 'find_bug',
    'This should add up the list, but the total always comes out as the last number. Why?',
    'let total = 0;\nfor (const n of numbers) {\n  total = n;\n}',
    ['total = n should be total = total + n', 'The list is empty', 'total should start at 1', 'The loop runs backwards'],
    0, 'total = n replaces the total each time instead of adding to it.'),

  code('ICT', 'Programming', 'medium', 'find_bug',
    'This is meant to check whether a number is 10. What is the mistake?',
    'if (number = 10) {\n  print("It is ten");\n}',
    ['A single = sets the value instead of comparing', 'It needs quotes around 10', 'if should be while', 'The brackets are the wrong way round'],
    0, 'One = assigns a value. Comparing needs == or ===.'),

  // ---------------- What is the output ----------------
  code('ICT', 'Programming', 'easy', 'output',
    'What does this print?',
    'let x = 4;\nlet y = 3;\nprint(x * y);',
    ['12', '7', '43', '1'],
    0, '4 multiplied by 3 is 12.'),

  code('ICT', 'Programming', 'medium', 'output',
    'What does this print?',
    'let word = "cat";\nprint(word + "s");',
    ['cats', 'cat s', 'cat + s', 'An error'],
    0, 'Joining text together with + is called concatenation, giving "cats".'),

  code('ICT', 'Programming', 'medium', 'output',
    'How many times does this print "hello"?',
    'for (let i = 0; i < 3; i++) {\n  print("hello");\n}',
    ['3', '2', '4', '0'],
    0, 'i takes the values 0, 1 and 2, so it runs three times.'),

  code('Mathematics', 'Algebra', 'medium', 'output',
    'If x = 5, what is the value of this expression?',
    '2 * x + 3',
    ['13', '16', '10', '25'],
    0, 'Multiply first: 2 x 5 = 10, then add 3 to get 13.')
];
