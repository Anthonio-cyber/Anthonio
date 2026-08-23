// ==========================================================
// Market World - the product catalogue.
//
// Every item in the game lives here: what it looks like on a shelf,
// what it is worth, and where it comes from. All of it is original to
// this game.
//   kind: crop | animal | processed | supplied
//   shape: how the little 3D model on the shelf is built
// ==========================================================

export const ITEMS = {
  // ---- Field crops -------------------------------------------------
  lettuce:      { name: 'Lettuce',          kind: 'crop', shape: 'leaf',   color: '#7ec850', accent: '#a8e06a', value: 6 },
  tomato:       { name: 'Tomato',           kind: 'crop', shape: 'ball',   color: '#e8523f', accent: '#5fa143', value: 8 },
  carrot:       { name: 'Carrot',           kind: 'crop', shape: 'cone',   color: '#f08a2c', accent: '#63a542', value: 7 },
  potato:       { name: 'Potato',           kind: 'crop', shape: 'lump',   color: '#c9a06a', accent: '#a67c4a', value: 5 },
  corn:         { name: 'Corn',             kind: 'crop', shape: 'cob',    color: '#f6cd45', accent: '#7cb342', value: 9 },
  wheat:        { name: 'Wheat',            kind: 'crop', shape: 'stalk',  color: '#e2be5e', accent: '#c49a3f', value: 7 },
  strawberry:   { name: 'Strawberry',       kind: 'crop', shape: 'ball',   color: '#e5405c', accent: '#4f9c3f', value: 14 },
  melon:        { name: 'Melon',            kind: 'crop', shape: 'ball',   color: '#8fce62', accent: '#2f7d3c', value: 18 },
  grapes:       { name: 'Grapes',           kind: 'crop', shape: 'cluster', color: '#8a5bd0', accent: '#4b8a3c', value: 16 },
  chilli:       { name: 'Chilli',           kind: 'crop', shape: 'cone',   color: '#d33a2c', accent: '#5da03e', value: 12 },
  coffeebean:   { name: 'Coffee Cherries',  kind: 'crop', shape: 'cluster', color: '#a4402c', accent: '#4d7a3a', value: 22 },
  cactusfruit:  { name: 'Cactus Fruit',     kind: 'crop', shape: 'ball',   color: '#d75f8f', accent: '#4f8f52', value: 20 },
  pumpkin:      { name: 'Pumpkin',          kind: 'crop', shape: 'ball',   color: '#e88b2a', accent: '#4f7c33', value: 19 },

  // ---- Animal products ---------------------------------------------
  egg:          { name: 'Eggs',             kind: 'animal', shape: 'ball',   color: '#f6e7c8', accent: '#d8c39a', value: 10 },
  milk:         { name: 'Raw Milk',         kind: 'animal', shape: 'bucket', color: '#f3f5f8', accent: '#c9d3dd', value: 12 },
  goatmilk:     { name: 'Goat Milk',        kind: 'animal', shape: 'bucket', color: '#eef1f4', accent: '#bcc7d2', value: 15 },
  wool:         { name: 'Wool',             kind: 'animal', shape: 'lump',   color: '#eae4d8', accent: '#c7bda9', value: 16 },

  // ---- Processed goods ---------------------------------------------
  sauce:        { name: 'Tomato Sauce',     kind: 'processed', shape: 'bottle', color: '#c8341f', accent: '#8d2114', value: 26 },
  flour:        { name: 'Flour',            kind: 'processed', shape: 'bag',    color: '#f0e6d2', accent: '#d6c7a8', value: 18 },
  bread:        { name: 'Bread',            kind: 'processed', shape: 'loaf',   color: '#d59a4e', accent: '#a97231', value: 30 },
  cake:         { name: 'Cake',             kind: 'processed', shape: 'cake',   color: '#f3c9d8', accent: '#c96a92', value: 58 },
  pastry:       { name: 'Pastry',           kind: 'processed', shape: 'loaf',   color: '#e6b56a', accent: '#c08a3d', value: 38 },
  bottledmilk:  { name: 'Milk Bottles',     kind: 'processed', shape: 'bottle', color: '#ffffff', accent: '#7fb6e0', value: 28 },
  cheese:       { name: 'Cheese',           kind: 'processed', shape: 'wedge',  color: '#f2c94c', accent: '#d1a32c', value: 46 },
  yoghurt:      { name: 'Yoghurt',          kind: 'processed', shape: 'cup',    color: '#f7f2ea', accent: '#e2a9c2', value: 34 },
  butter:       { name: 'Butter',           kind: 'processed', shape: 'box',    color: '#f5dd8a', accent: '#d9bb56', value: 40 },
  cornflakes:   { name: 'Corn Flakes',      kind: 'processed', shape: 'box',    color: '#eba43a', accent: '#b8752a', value: 33 },
  popcorn:      { name: 'Popcorn',          kind: 'processed', shape: 'bag',    color: '#fbf1d6', accent: '#e0b84f', value: 24 },
  packedeggs:   { name: 'Packaged Eggs',    kind: 'processed', shape: 'carton', color: '#e9dcc0', accent: '#b7a37c', value: 26 },
  juice:        { name: 'Fruit Juice',      kind: 'processed', shape: 'bottle', color: '#f7913c', accent: '#c96c1e', value: 36 },
  jam:          { name: 'Berry Jam',        kind: 'processed', shape: 'jar',    color: '#c2325c', accent: '#8e2141', value: 44 },
  saladbox:     { name: 'Salad Box',        kind: 'processed', shape: 'box',    color: '#9ada6a', accent: '#5c9a3c', value: 30 },
  frozenveg:    { name: 'Frozen Veg',       kind: 'processed', shape: 'bag',    color: '#a7d8ef', accent: '#5c9fc4', value: 32 },
  icecream:     { name: 'Ice Cream',        kind: 'processed', shape: 'cup',    color: '#f9e6f0', accent: '#8fd0e8', value: 48 },
  frozenpizza:  { name: 'Frozen Pizza',     kind: 'processed', shape: 'box',    color: '#e2a15c', accent: '#b2622c', value: 52 },
  coffeebag:    { name: 'Coffee',           kind: 'processed', shape: 'bag',    color: '#5e3a25', accent: '#3a2317', value: 62 },
  hotsauce:     { name: 'Hot Sauce',        kind: 'processed', shape: 'bottle', color: '#b8261a', accent: '#7a1710', value: 42 },
  pumpkinpie:   { name: 'Pumpkin Pie',      kind: 'processed', shape: 'cake',   color: '#e0a55c', accent: '#b47a2c', value: 60 },
  fishfillet:   { name: 'Fish Fillet',      kind: 'processed', shape: 'box',    color: '#e8b9a6', accent: '#b07f6b', value: 55 },
  giftbasket:   { name: 'Gift Basket',      kind: 'processed', shape: 'box',    color: '#d8b46a', accent: '#9a7a35', value: 180 },

  // ---- Bought in from suppliers ------------------------------------
  soda:         { name: 'Fizzy Drink',      kind: 'supplied', shape: 'bottle', color: '#4fa4d8', accent: '#26688f', value: 30, cost: 13 },
  water:        { name: 'Bottled Water',    kind: 'supplied', shape: 'bottle', color: '#bfe6f7', accent: '#6fb4d8', value: 18, cost: 7 },
  chips:        { name: 'Crisps',           kind: 'supplied', shape: 'bag',    color: '#f0b429', accent: '#c08512', value: 26, cost: 11 },
  chocolate:    { name: 'Chocolate',        kind: 'supplied', shape: 'box',    color: '#6b4227', accent: '#402616', value: 34, cost: 15 },
  biscuits:     { name: 'Biscuits',         kind: 'supplied', shape: 'box',    color: '#dda85e', accent: '#a97a34', value: 28, cost: 12 },
  soap:         { name: 'Soap',             kind: 'supplied', shape: 'box',    color: '#8fd6c8', accent: '#4f9c8e', value: 32, cost: 13 },
  detergent:    { name: 'Detergent',        kind: 'supplied', shape: 'bottle', color: '#4f7fd8', accent: '#2c4f9c', value: 55, cost: 24 },
  papertowel:   { name: 'Paper Towels',     kind: 'supplied', shape: 'roll',   color: '#f2f2f2', accent: '#c9c9c9', value: 38, cost: 16 },
  batteries:    { name: 'Batteries',        kind: 'supplied', shape: 'box',    color: '#2f3542', accent: '#f0b429', value: 70, cost: 31 },
  headphones:   { name: 'Headphones',       kind: 'supplied', shape: 'box',    color: '#3d4a5c', accent: '#7fd0f0', value: 240, cost: 110 },
  desklamp:     { name: 'Desk Lamp',        kind: 'supplied', shape: 'box',    color: '#e5e9ef', accent: '#f0b429', value: 190, cost: 88 },
  lipbalm:      { name: 'Lip Balm',         kind: 'supplied', shape: 'cup',    color: '#f0a0b8', accent: '#c25e7e', value: 46, cost: 20 },
  shampoo:      { name: 'Shampoo',          kind: 'supplied', shape: 'bottle', color: '#c79ce8', accent: '#8155ab', value: 58, cost: 25 },
  seafood:      { name: 'Fresh Seafood',    kind: 'supplied', shape: 'box',    color: '#f0a48d', accent: '#c06a52', value: 95, cost: 42 },
  truffle:      { name: 'Truffle',          kind: 'supplied', shape: 'lump',   color: '#4a3628', accent: '#241a12', value: 420, cost: 190 },
  luxchocolate: { name: 'Luxury Chocolate', kind: 'supplied', shape: 'box',    color: '#3b2418', accent: '#d8b46a', value: 260, cost: 115 },
  skincream:    { name: 'Skin Cream',       kind: 'supplied', shape: 'cup',    color: '#f6e7dd', accent: '#d8a68c', value: 150, cost: 66 },
  parka:        { name: 'Winter Parka',     kind: 'supplied', shape: 'box',    color: '#2f6ba8', accent: '#dce8f2', value: 210, cost: 95 },
  sunhat:       { name: 'Sun Hat',          kind: 'supplied', shape: 'box',    color: '#f4dfa8', accent: '#c9a44f', value: 88, cost: 38 }
};

// A typo-proof helper: unknown ids fall back to a neutral grey crate.
const FALLBACK = { name: 'Unknown', kind: 'supplied', shape: 'box', color: '#9aa4b2', accent: '#6b7480', value: 10, cost: 5 };
export const item = (id) => ITEMS[id] || FALLBACK;
export const itemName = (id) => item(id).name;

// ==========================================================
// CROPS - what can be planted, and how it grows.
// stages: seed -> sprout -> young -> mature -> ready (5 states)
// ==========================================================
export const CROPS = {
  lettuce:    { item: 'lettuce',    name: 'Lettuce',    seed: 4,  grow: 24,  yield: 3, water: 1, unlock: 1,  height: 0.35, form: 'bush' },
  carrot:     { item: 'carrot',     name: 'Carrot',     seed: 5,  grow: 30,  yield: 3, water: 1, unlock: 1,  height: 0.4,  form: 'tuft' },
  tomato:     { item: 'tomato',     name: 'Tomato',     seed: 8,  grow: 42,  yield: 4, water: 2, unlock: 2,  height: 0.7,  form: 'vine' },
  potato:     { item: 'potato',     name: 'Potato',     seed: 6,  grow: 36,  yield: 5, water: 1, unlock: 2,  height: 0.38, form: 'bush' },
  corn:       { item: 'corn',       name: 'Corn',       seed: 10, grow: 55,  yield: 4, water: 2, unlock: 3,  height: 1.1,  form: 'tall' },
  wheat:      { item: 'wheat',      name: 'Wheat',      seed: 9,  grow: 50,  yield: 6, water: 2, unlock: 4,  height: 0.85, form: 'tall' },
  strawberry: { item: 'strawberry', name: 'Strawberry', seed: 16, grow: 62,  yield: 5, water: 2, unlock: 6,  height: 0.34, form: 'bush' },
  melon:      { item: 'melon',      name: 'Melon',      seed: 22, grow: 80,  yield: 3, water: 3, unlock: 8,  height: 0.4,  form: 'ground' },
  grapes:     { item: 'grapes',     name: 'Grapes',     seed: 24, grow: 95,  yield: 5, water: 3, unlock: 10, height: 1.0,  form: 'vine' },
  chilli:     { item: 'chilli',     name: 'Chilli',     seed: 18, grow: 70,  yield: 5, water: 2, unlock: 12, height: 0.5,  form: 'bush' },
  pumpkin:    { item: 'pumpkin',    name: 'Pumpkin',    seed: 26, grow: 110, yield: 3, water: 3, unlock: 14, height: 0.45, form: 'ground' },
  coffeebean: { item: 'coffeebean', name: 'Coffee',     seed: 34, grow: 130, yield: 4, water: 3, unlock: 18, height: 1.2,  form: 'tall' },
  cactusfruit:{ item: 'cactusfruit',name: 'Cactus Fruit', seed: 30, grow: 120, yield: 4, water: 1, unlock: 20, height: 0.9, form: 'cactus' }
};

// ==========================================================
// ANIMALS
// ==========================================================
export const ANIMALS = {
  chicken: { name: 'Chicken', item: 'egg',      cost: 220,  interval: 34, feed: 3,  unlock: 5,  amount: 2, color: '#f6f1e6', accent: '#e05a3a' },
  cow:     { name: 'Cow',     item: 'milk',     cost: 900,  interval: 62, feed: 8,  unlock: 9,  amount: 2, color: '#f4f2ee', accent: '#4a4038' },
  goat:    { name: 'Goat',    item: 'goatmilk', cost: 1500, interval: 74, feed: 10, unlock: 13, amount: 2, color: '#d9cfc0', accent: '#6d6255' },
  sheep:   { name: 'Sheep',   item: 'wool',     cost: 2400, interval: 96, feed: 12, unlock: 17, amount: 2, color: '#efe9de', accent: '#3f3a33' }
};

// ==========================================================
// MACHINES and RECIPES
// A machine holds a queue; each recipe takes inputs and time.
// ==========================================================
export const MACHINES = {
  saucery:   { name: 'Sauce Kitchen',   cost: 900,    unlock: 4,  color: '#d05a45', slots: 1 },
  mill:      { name: 'Grain Mill',      cost: 1400,   unlock: 6,  color: '#c8a76a', slots: 1 },
  bakery:    { name: 'Bakery Oven',     cost: 2600,   unlock: 8,  color: '#e0a05a', slots: 2 },
  dairy:     { name: 'Dairy Plant',     cost: 4200,   unlock: 10, color: '#7fb6e0', slots: 2 },
  packer:    { name: 'Packing Line',    cost: 1800,   unlock: 7,  color: '#8fc472', slots: 2 },
  juicer:    { name: 'Juice Press',     cost: 5600,   unlock: 12, color: '#f0913c', slots: 2 },
  snackworks:{ name: 'Snack Works',     cost: 9500,   unlock: 15, color: '#eba43a', slots: 2 },
  freezer:   { name: 'Freezer Unit',    cost: 16000,  unlock: 18, color: '#a7d8ef', slots: 2 },
  roastery:  { name: 'Coffee Roastery', cost: 32000,  unlock: 21, color: '#5e3a25', slots: 2 },
  giftline:  { name: 'Gift Assembly',   cost: 90000,  unlock: 26, color: '#d8b46a', slots: 2 }
};

export const RECIPES = [
  { id: 'sauce',       machine: 'saucery',   inputs: { tomato: 3 },                 output: 'sauce',       amount: 2, time: 26 },
  { id: 'hotsauce',    machine: 'saucery',   inputs: { tomato: 2, chilli: 2 },      output: 'hotsauce',    amount: 2, time: 34, unlock: 12 },
  { id: 'saladbox',    machine: 'packer',    inputs: { lettuce: 2, carrot: 1 },     output: 'saladbox',    amount: 2, time: 20 },
  { id: 'packedeggs',  machine: 'packer',    inputs: { egg: 4 },                    output: 'packedeggs',  amount: 2, time: 22 },
  { id: 'flour',       machine: 'mill',      inputs: { wheat: 3 },                  output: 'flour',       amount: 3, time: 24 },
  { id: 'cornflakes',  machine: 'mill',      inputs: { corn: 4 },                   output: 'cornflakes',  amount: 3, time: 30 },
  { id: 'bread',       machine: 'bakery',    inputs: { flour: 2 },                  output: 'bread',       amount: 3, time: 30 },
  { id: 'pastry',      machine: 'bakery',    inputs: { flour: 2, butter: 1 },       output: 'pastry',      amount: 3, time: 38 },
  { id: 'cake',        machine: 'bakery',    inputs: { flour: 2, egg: 2, milk: 1 }, output: 'cake',        amount: 2, time: 46 },
  { id: 'pumpkinpie',  machine: 'bakery',    inputs: { flour: 2, pumpkin: 1 },      output: 'pumpkinpie',  amount: 2, time: 50, unlock: 14 },
  { id: 'bottledmilk', machine: 'dairy',     inputs: { milk: 2 },                   output: 'bottledmilk', amount: 3, time: 26 },
  { id: 'cheese',      machine: 'dairy',     inputs: { milk: 3 },                   output: 'cheese',      amount: 2, time: 44 },
  { id: 'goatcheese',  machine: 'dairy',     inputs: { goatmilk: 3 },               output: 'cheese',      amount: 3, time: 40, unlock: 13 },
  { id: 'yoghurt',     machine: 'dairy',     inputs: { milk: 2, strawberry: 1 },    output: 'yoghurt',     amount: 3, time: 34 },
  { id: 'butter',      machine: 'dairy',     inputs: { milk: 3 },                   output: 'butter',      amount: 2, time: 40 },
  { id: 'juice',       machine: 'juicer',    inputs: { melon: 2 },                  output: 'juice',       amount: 3, time: 32 },
  { id: 'grapejuice',  machine: 'juicer',    inputs: { grapes: 2 },                 output: 'juice',       amount: 4, time: 30 },
  { id: 'jam',         machine: 'juicer',    inputs: { strawberry: 3 },             output: 'jam',         amount: 3, time: 40 },
  { id: 'popcorn',     machine: 'snackworks',inputs: { corn: 3 },                   output: 'popcorn',     amount: 4, time: 26 },
  { id: 'chipsmake',   machine: 'snackworks',inputs: { potato: 4 },                 output: 'chips',       amount: 4, time: 30 },
  { id: 'frozenveg',   machine: 'freezer',   inputs: { carrot: 2, corn: 2 },        output: 'frozenveg',   amount: 4, time: 34 },
  { id: 'icecream',    machine: 'freezer',   inputs: { milk: 2, strawberry: 1 },    output: 'icecream',    amount: 3, time: 42 },
  { id: 'frozenpizza', machine: 'freezer',   inputs: { bread: 1, cheese: 1, sauce: 1 }, output: 'frozenpizza', amount: 2, time: 52 },
  { id: 'coffeebag',   machine: 'roastery',  inputs: { coffeebean: 3 },             output: 'coffeebag',   amount: 3, time: 48 },
  { id: 'giftbasket',  machine: 'giftline',  inputs: { coffeebag: 1, luxchocolate: 1, cheese: 1 }, output: 'giftbasket', amount: 1, time: 70 }
];

export const recipesFor = (machineId) => RECIPES.filter((r) => r.machine === machineId);

// ==========================================================
// DEPARTMENTS - each one unlocks a group of shelves.
// ==========================================================
export const DEPARTMENTS = [
  { id: 'vegetables', name: 'Vegetables', level: 1,  color: '#7ec850', products: ['lettuce', 'tomato', 'carrot', 'potato', 'corn', 'saladbox'] },
  { id: 'fruit',      name: 'Fruit',      level: 3,  color: '#f2934a', products: ['strawberry', 'melon', 'grapes', 'pumpkin'] },
  { id: 'bakery',     name: 'Bakery',     level: 6,  color: '#dca055', products: ['bread', 'pastry', 'cake', 'pumpkinpie'] },
  { id: 'dairy',      name: 'Dairy',      level: 9,  color: '#7fb6e0', products: ['bottledmilk', 'cheese', 'yoghurt', 'butter', 'packedeggs'] },
  { id: 'drinks',     name: 'Drinks',     level: 12, color: '#4fa4d8', products: ['juice', 'soda', 'water', 'coffeebag'] },
  { id: 'snacks',     name: 'Snacks',     level: 15, color: '#f0b429', products: ['chips', 'popcorn', 'chocolate', 'biscuits', 'cornflakes'] },
  { id: 'frozen',     name: 'Frozen Food', level: 18, color: '#a7d8ef', products: ['frozenveg', 'icecream', 'frozenpizza'] },
  { id: 'household',  name: 'Household',  level: 21, color: '#8fd6c8', products: ['soap', 'detergent', 'papertowel'] },
  { id: 'electronics',name: 'Electronics', level: 24, color: '#3d4a5c', products: ['batteries', 'headphones', 'desklamp'] },
  { id: 'premium',    name: 'Premium Market', level: 28, color: '#d8b46a', products: ['truffle', 'luxchocolate', 'skincream', 'giftbasket'] }
];

export const departmentById = (id) => DEPARTMENTS.find((d) => d.id === id);
export const departmentOf = (itemId) => DEPARTMENTS.find((d) => d.products.includes(itemId));

/** Storage tiers - the physical warehouse the player upgrades. */
export const STORAGE_TIERS = [
  { name: 'Corner Store Room', cap: 100,   cost: 0 },
  { name: 'Back Store Room',   cap: 250,   cost: 1200 },
  { name: 'Cold Room',         cap: 500,   cost: 5200 },
  { name: 'Warehouse',         cap: 1000,  cost: 18000 },
  { name: 'Large Warehouse',   cap: 2200,  cost: 62000 },
  { name: 'Distribution Centre', cap: 5000, cost: 210000 }
];
