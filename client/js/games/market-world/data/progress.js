// ==========================================================
// Market World - everything the player works towards.
// Staff, upgrades, marketing, events, missions, achievements.
// ==========================================================

// ---- Levelling -----------------------------------------------------
// A gentle curve early on so the first half hour moves quickly, then a
// steady climb that keeps the late game meaningful.
export function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.42) + 45 * level);
}

export const LEVEL_REWARDS = {
  2: { cash: 200, note: 'Tomatoes and potatoes unlocked' },
  3: { cash: 350, note: 'Corn unlocked, Fruit department available' },
  4: { cash: 500, gems: 2, note: 'Wheat and the Sauce Kitchen' },
  5: { cash: 900, note: 'Chickens, and Small Grocery expansion' },
  6: { cash: 1200, note: 'Bakery department, Grain Mill' },
  8: { cash: 2600, gems: 3, note: 'Bakery Oven' },
  9: { cash: 3400, note: 'Cows, Dairy department' },
  10: { cash: 5000, gems: 5, note: 'Dairy Plant. Coastal City is now in reach' },
  12: { cash: 8000, note: 'Drinks department, Juice Press' },
  15: { cash: 16000, gems: 5, note: 'Snack Works' },
  18: { cash: 30000, note: 'Frozen Food, Freezer Unit' },
  21: { cash: 60000, gems: 8, note: 'Household department, Coffee Roastery' },
  24: { cash: 110000, note: 'Electronics department' },
  28: { cash: 250000, gems: 12, note: 'Premium Market' },
  32: { cash: 600000, gems: 20, note: 'Mega City is within reach' }
};

// ---- Staff ---------------------------------------------------------
export const STAFF_TYPES = {
  farmer: {
    name: 'Farmer', unlock: 4, hire: 1200, salary: 9, color: '#6f9f4a',
    blurb: 'Plants, waters and harvests the fields without being asked.'
  },
  stocker: {
    name: 'Stocker', unlock: 6, hire: 2200, salary: 12, color: '#4f8fd0',
    blurb: 'Carries goods from the store room and fills the shelves.'
  },
  cashier: {
    name: 'Cashier', unlock: 8, hire: 3600, salary: 16, color: '#d0684f',
    blurb: 'Runs a till so you never have to stand behind one again.'
  },
  cleaner: {
    name: 'Cleaner', unlock: 11, hire: 3000, salary: 11, color: '#7f6fd0',
    blurb: 'Keeps the floor clean, which keeps shoppers happy.'
  },
  courier: {
    name: 'Delivery Worker', unlock: 14, hire: 6500, salary: 20, color: '#c9a24a',
    blurb: 'Moves stock from the farm and warehouse into the store.'
  },
  manager: {
    name: 'Manager', unlock: 17, hire: 18000, salary: 45, color: '#3f4a5c',
    blurb: 'Lifts the speed of every other worker and steadies reputation.'
  }
};

/** Level 1..5 for each worker. Speed and capacity both scale. */
export const STAFF_LEVELS = [
  { level: 1, speed: 1.0, capacity: 3,  efficiency: 1.0,  cost: 0 },
  { level: 2, speed: 1.25, capacity: 5, efficiency: 1.2,  cost: 2500 },
  { level: 3, speed: 1.55, capacity: 8, efficiency: 1.45, cost: 9000 },
  { level: 4, speed: 1.9,  capacity: 12, efficiency: 1.75, cost: 32000 },
  { level: 5, speed: 2.4,  capacity: 18, efficiency: 2.2,  cost: 120000 }
];

// ---- Upgrades ------------------------------------------------------
// Every one of these changes something the player can see or feel.
export const UPGRADES = {
  growth:    { name: 'Crop Science',      group: 'farm',  max: 6, base: 700,   scale: 2.5, per: 0.14, unit: 'faster growth',   unlock: 2 },
  yield:     { name: 'Rich Soil',         group: 'farm',  max: 6, base: 950,   scale: 2.7, per: 0.2,  unit: 'bigger harvest',  unlock: 3 },
  watering:  { name: 'Watering Can',      group: 'farm',  max: 5, base: 450,   scale: 2.3, per: 0.25, unit: 'faster watering', unlock: 1 },
  seeds:     { name: 'Seed Quality',      group: 'farm',  max: 5, base: 1600,  scale: 2.8, per: 0.1,  unit: 'cheaper seeds',   unlock: 5 },
  sprinkler: { name: 'Sprinkler Network', group: 'farm',  max: 3, base: 9000,  scale: 4,   per: 1,    unit: 'plots watered automatically', unlock: 10 },
  harvester: { name: 'Auto Harvester',    group: 'farm',  max: 3, base: 26000, scale: 4,   per: 1,    unit: 'plots harvested automatically', unlock: 16 },
  carry:     { name: 'Carry Frame',       group: 'you',   max: 6, base: 400,   scale: 2.2, per: 4,    unit: 'more items carried', unlock: 1 },
  boots:     { name: 'Running Shoes',     group: 'you',   max: 5, base: 600,   scale: 2.4, per: 0.12, unit: 'movement speed',  unlock: 2 },
  hands:     { name: 'Quick Hands',       group: 'you',   max: 5, base: 800,   scale: 2.5, per: 0.15, unit: 'faster actions',  unlock: 3 },
  till:      { name: 'Till Speed',        group: 'store', max: 6, base: 900,   scale: 2.4, per: 0.18, unit: 'faster checkout', unlock: 3 },
  selfcheck: { name: 'Self Checkout',     group: 'store', max: 4, base: 14000, scale: 3.2, per: 1,    unit: 'unattended till', unlock: 13 },
  machines:  { name: 'Machine Tuning',    group: 'store', max: 6, base: 2200,  scale: 2.6, per: 0.15, unit: 'faster production', unlock: 7 },
  shelfsize: { name: 'Deep Shelving',     group: 'store', max: 6, base: 1500,  scale: 2.6, per: 8,    unit: 'more room per shelf', unlock: 4 },
  cleaning:  { name: 'Cleaning Robots',   group: 'store', max: 4, base: 12000, scale: 3,   per: 0.4,  unit: 'less mess',       unlock: 12 },
  decor:     { name: 'Store Decoration',  group: 'store', max: 6, base: 3000,  scale: 2.8, per: 0.06, unit: 'shopper happiness', unlock: 6 }
};

export function upgradeCost(id, currentLevel) {
  const u = UPGRADES[id];
  return Math.round(u.base * Math.pow(u.scale, currentLevel));
}

// ---- Marketing -----------------------------------------------------
export const MARKETING_LEVELS = [
  { level: 1, name: 'Basic Advertising', cost: 0 },
  { level: 2, name: 'Social Media Desk', cost: 3500 },
  { level: 3, name: 'Radio Contacts',    cost: 14000 },
  { level: 4, name: 'Billboard Deals',   cost: 55000 },
  { level: 5, name: 'Television Slot',   cost: 190000 },
  { level: 6, name: 'Influencer Agency', cost: 620000 },
  { level: 7, name: 'Global Advertising', cost: 2400000 }
];

export const CAMPAIGNS = [
  { id: 'flyers',     name: 'Flyers',            level: 1, cost: 250,     boost: 0.10, duration: 240, icon: 'flyer',   blurb: 'Hand-drawn flyers pushed through every letterbox on the road.' },
  { id: 'social',     name: 'Social Media',      level: 2, cost: 1000,    boost: 0.20, duration: 600, icon: 'social',  blurb: 'Short clips of the farm doing the rounds online.' },
  { id: 'radio',      name: 'Radio Advert',      level: 3, cost: 4000,    boost: 0.30, duration: 720, icon: 'radio',   blurb: 'A jingle on the local station, every hour, all day.' },
  { id: 'billboard',  name: 'Billboard',         level: 4, cost: 12000,   boost: 0.40, duration: 900, icon: 'board',   blurb: 'A hoarding on the main road into town.' },
  { id: 'tv',         name: 'Television Advert', level: 5, cost: 40000,   boost: 0.60, duration: 1080, icon: 'tv',     blurb: 'Thirty seconds in the evening break.' },
  { id: 'influencer', name: 'Influencer Campaign', level: 6, cost: 120000, boost: 0.80, duration: 600, icon: 'star',   blurb: 'A famous face filming a shop of the whole store.' },
  { id: 'global',     name: 'Global Campaign',   level: 7, cost: 400000,  boost: 1.20, duration: 1500, icon: 'globe',  blurb: 'Every screen in every city carries your brand.' }
];

export const campaignById = (id) => CAMPAIGNS.find((c) => c.id === id);

// ---- Special events ------------------------------------------------
// These fire on their own while the player is running the store.
export const EVENTS = [
  { id: 'weekend',   name: 'Weekend Rush',      duration: 300, traffic: 0.5, demand: {}, blurb: 'The whole neighbourhood is out shopping.' },
  { id: 'harvest',   name: 'Harvest Festival',  duration: 360, traffic: 0.35, demand: { vegetables: 0.8, fruit: 0.8 }, blurb: 'Everyone wants produce straight from the field.' },
  { id: 'school',    name: 'Back to School',    duration: 330, traffic: 0.3, demand: { bakery: 0.6, snacks: 0.6 }, blurb: 'Lunchboxes to fill for a whole term.' },
  { id: 'holiday',   name: 'Holiday Market',    duration: 420, traffic: 0.55, demand: { premium: 0.9, bakery: 0.5, drinks: 0.4 }, blurb: 'Gift shopping in full swing.' },
  { id: 'foodfest',  name: 'Food Festival',     duration: 300, traffic: 0.45, demand: { dairy: 0.7, bakery: 0.7 }, blurb: 'Tasting stalls all along the street.' },
  { id: 'heatwave',  name: 'Heatwave',          duration: 300, traffic: 0.2, demand: { drinks: 1.0, frozen: 0.8 }, blurb: 'Nobody can stop buying cold drinks.' },
  { id: 'discount',  name: 'Mega Discount Day', duration: 240, traffic: 0.9, demand: {}, priceMul: 0.82, blurb: 'Huge crowds, thinner margins. Keep those shelves full.' },
  { id: 'vipday',    name: 'VIP Shopping Day',  duration: 300, traffic: 0.15, demand: { premium: 1.2, electronics: 0.8 }, vip: 0.35, blurb: 'The big spenders are in town.' }
];

// ---- Customers -----------------------------------------------------
export const PERSONALITIES = [
  { id: 'normal',    name: 'Shopper',        weight: 44, items: [1, 3],  spend: 1.0,  patience: 46, speed: 1.0,  tip: 0 },
  { id: 'big',       name: 'Big Shopper',    weight: 15, items: [4, 8],  spend: 1.05, patience: 52, speed: 0.9,  tip: 0 },
  { id: 'impatient', name: 'Impatient',      weight: 14, items: [1, 2],  spend: 1.0,  patience: 20, speed: 1.35, tip: 0 },
  { id: 'vip',       name: 'VIP',            weight: 8,  items: [2, 5],  spend: 1.9,  patience: 40, speed: 1.0,  tip: 0.15 },
  { id: 'budget',    name: 'Budget Shopper', weight: 12, items: [1, 4],  spend: 0.72, patience: 70, speed: 0.85, tip: 0 },
  { id: 'family',    name: 'Family',         weight: 7,  items: [5, 10], spend: 1.15, patience: 44, speed: 0.8,  tip: 0, categories: 3 }
];

// ---- Delivery vehicles ---------------------------------------------
export const VEHICLES = [
  { id: 'van',      name: 'Small Van',         cost: 8000,    unlock: 14, capacity: 40,  speed: 1.0,  color: '#e0e6ee' },
  { id: 'truck',    name: 'Delivery Truck',    cost: 34000,   unlock: 18, capacity: 110, speed: 1.15, color: '#4f8fd0' },
  { id: 'reefer',   name: 'Refrigerated Truck', cost: 120000, unlock: 22, capacity: 220, speed: 1.25, color: '#a7d8ef' },
  { id: 'cargo',    name: 'Large Cargo Truck', cost: 420000,  unlock: 27, capacity: 500, speed: 1.4,  color: '#c9a24a' }
];

// ---- Missions ------------------------------------------------------
// Worked through in order. Each one teaches the next system.
export const MISSIONS = [
  { id: 'm1',  text: 'Plant your first 3 crops',           type: 'plant',    target: 3,    cash: 60,    xp: 30 },
  { id: 'm2',  text: 'Water 4 growing plants',             type: 'water',    target: 4,    cash: 60,    xp: 30 },
  { id: 'm3',  text: 'Harvest 6 crops',                    type: 'harvest',  target: 6,    cash: 120,   xp: 50 },
  { id: 'm4',  text: 'Stock 8 items onto your shelves',    type: 'stock',    target: 8,    cash: 150,   xp: 60 },
  { id: 'm5',  text: 'Serve your first 5 customers',       type: 'serve',    target: 5,    cash: 220,   xp: 90 },
  { id: 'm6',  text: 'Earn $1,000 in sales',               type: 'earn',     target: 1000, cash: 320,   xp: 130 },
  { id: 'm7',  text: 'Buy a farm upgrade',                 type: 'upgrade',  target: 1,    cash: 300,   xp: 120 },
  { id: 'm8',  text: 'Reach player level 5',               type: 'level',    target: 5,    cash: 800,   gems: 3, xp: 0 },
  { id: 'm9',  text: 'Expand to a Small Grocery',          type: 'stage',    target: 2,    cash: 1500,  xp: 400 },
  { id: 'm10', text: 'Hire your first worker',             type: 'hire',     target: 1,    cash: 900,   xp: 250 },
  { id: 'm11', text: 'Buy a chicken and collect 5 eggs',   type: 'collect',  target: 5,    cash: 900,   xp: 260 },
  { id: 'm12', text: 'Build a processing machine',         type: 'machine',  target: 1,    cash: 1200,  xp: 300 },
  { id: 'm13', text: 'Produce 10 processed goods',         type: 'produce',  target: 10,   cash: 1800,  xp: 380 },
  { id: 'm14', text: 'Run a marketing campaign',           type: 'campaign', target: 1,    cash: 1500,  gems: 2, xp: 320 },
  { id: 'm15', text: 'Serve 100 customers',                type: 'serve',    target: 100,  cash: 4000,  xp: 700 },
  { id: 'm16', text: 'Open the Bakery department',         type: 'dept',     target: 'bakery', cash: 5000, xp: 900 },
  { id: 'm17', text: 'Reach a 4-star reputation',          type: 'rep',      target: 4,    cash: 6000,  gems: 4, xp: 900 },
  { id: 'm18', text: 'Expand to a Neighbourhood Market',   type: 'stage',    target: 3,    cash: 12000, xp: 1800 },
  { id: 'm19', text: 'Sell 100 bottles of milk',           type: 'sellitem', item: 'bottledmilk', target: 100, cash: 15000, xp: 2200 },
  { id: 'm20', text: 'Earn $100,000 in total sales',       type: 'earn',     target: 100000, cash: 20000, gems: 6, xp: 3000 },
  { id: 'm21', text: 'Unlock a second location',           type: 'location', target: 2,    cash: 40000, gems: 10, xp: 5000 },
  { id: 'm22', text: 'Buy a delivery vehicle',             type: 'vehicle',  target: 1,    cash: 25000, xp: 3500 },
  { id: 'm23', text: 'Employ 6 workers at once',           type: 'hire',     target: 6,    cash: 60000, xp: 6000 },
  { id: 'm24', text: 'Expand to a Large Supermarket',      type: 'stage',    target: 4,    cash: 150000, gems: 12, xp: 12000 },
  { id: 'm25', text: 'Open 5 departments',                 type: 'deptcount', target: 5,   cash: 200000, xp: 15000 },
  { id: 'm26', text: 'Run 25 marketing campaigns',         type: 'campaign', target: 25,   cash: 260000, gems: 15, xp: 18000 },
  { id: 'm27', text: 'Serve 10,000 customers',             type: 'serve',    target: 10000, cash: 500000, xp: 30000 },
  { id: 'm28', text: 'Build a Mega Market',                type: 'stage',    target: 5,    cash: 900000, gems: 30, xp: 60000 },
  { id: 'm29', text: 'Unlock every location',              type: 'location', target: 6,    cash: 2000000, gems: 60, xp: 120000 }
];

// ---- Achievements --------------------------------------------------
export const ACHIEVEMENTS = [
  { id: 'firstsale',  name: 'First Sale',       blurb: 'Make your first sale.',            stat: 'served',    target: 1,       gems: 1 },
  { id: 'farmer',     name: 'Farmer',           blurb: 'Harvest 1,000 crops.',             stat: 'harvested', target: 1000,    gems: 8 },
  { id: 'greenthumb', name: 'Green Thumb',      blurb: 'Harvest 100 crops.',               stat: 'harvested', target: 100,     gems: 2 },
  { id: 'stockroom',  name: 'Shelf Filler',     blurb: 'Stock 500 items.',                 stat: 'stocked',   target: 500,     gems: 3 },
  { id: 'owner',      name: 'Business Owner',   blurb: 'Earn $100,000.',                   stat: 'earned',    target: 100000,  gems: 6 },
  { id: 'tycoon',     name: 'Retail Tycoon',    blurb: 'Earn $5,000,000.',                 stat: 'earned',    target: 5000000, gems: 40 },
  { id: 'bigbusiness',name: 'Big Business',     blurb: 'Reach level 20.',                  stat: 'level',     target: 20,      gems: 12 },
  { id: 'marketing',  name: 'Marketing Master', blurb: 'Run 50 campaigns.',                stat: 'campaigns', target: 50,      gems: 15 },
  { id: 'crowd',      name: 'Crowd Pleaser',    blurb: 'Serve 5,000 customers.',           stat: 'served',    target: 5000,    gems: 12 },
  { id: 'king',       name: 'Supermarket King', blurb: 'Unlock 5 locations.',              stat: 'locations', target: 5,       gems: 30 },
  { id: 'global',     name: 'Global Brand',     blurb: 'Unlock every location.',           stat: 'locations', target: 6,       gems: 60 },
  { id: 'staffed',    name: 'Good Employer',    blurb: 'Employ 10 workers.',               stat: 'staff',     target: 10,      gems: 10 },
  { id: 'factory',    name: 'Factory Floor',    blurb: 'Produce 1,000 goods.',             stat: 'produced',  target: 1000,    gems: 10 },
  { id: 'fivestar',   name: 'Five Stars',       blurb: 'Hold a 4.8-star reputation.',      stat: 'reputation', target: 4.8,    gems: 20 }
];

// ---- Daily rewards -------------------------------------------------
export const DAILY_REWARDS = [
  { day: 1, cash: 500,   label: '$500' },
  { day: 2, seeds: 10,   label: '10 seed packs' },
  { day: 3, gems: 3,     label: '3 gems' },
  { day: 4, token: 1,    label: 'Upgrade token' },
  { day: 5, cash: 4000,  label: '$4,000' },
  { day: 6, seeds: 25, gems: 2, label: 'Rare seed crate' },
  { day: 7, cash: 20000, gems: 10, token: 2, label: 'Big weekly reward' }
];
