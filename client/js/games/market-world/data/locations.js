// ==========================================================
// Market World - the world map.
//
// Six places to build a business in, each with its own look, music,
// customers, economy and entry requirements. Nothing unlocks on its
// own: the player has to earn every one of them.
// ==========================================================

export const LOCATIONS = [
  {
    id: 'sunny',
    name: 'Sunny Valley',
    tag: 'Where it all starts',
    blurb: 'A quiet roadside stretch of farmland. Cheap ground, patient neighbours and enough sunshine to grow anything.',
    map: { x: 22, y: 62 },
    population: 1,
    priceMul: 1,
    trafficMul: 1,
    specials: ['lettuce', 'tomato', 'carrot'],
    farmBonus: 0.2,
    requires: null,
    palette: {
      sky: '#bfe4ff', fog: '#cfe8ff', ground: '#6faa4a', ground2: '#5d9540',
      road: '#8b8f96', soil: '#7a5836', building: '#f6efe2', roof: '#e07a52',
      trim: '#4fa3d8', tree: '#3f8a44', trunk: '#7a5836'
    },
    theme: { root: 262, scale: 'major', tempo: 96, wave: 'triangle', sub: 'sine' }
  },
  {
    id: 'coastal',
    name: 'Coastal City',
    tag: 'Salt air and busy pavements',
    blurb: 'A harbour town packed with tourists. Far more customers than the valley, and they arrive hungry.',
    map: { x: 44, y: 34 },
    population: 1.8,
    priceMul: 1.15,
    trafficMul: 1.7,
    specials: ['seafood', 'icecream', 'sunhat'],
    farmBonus: 0,
    requires: { storeLevel: 10, cash: 50000, served: 500, reputation: 4 },
    palette: {
      sky: '#a9e0f2', fog: '#c6ecf5', ground: '#8fb87a', ground2: '#7aa868',
      road: '#9aa0a8', soil: '#8a6c48', building: '#f2f7fa', roof: '#3f8fbf',
      trim: '#f2c14e', tree: '#3f8f6a', trunk: '#7d6248'
    },
    theme: { root: 294, scale: 'lydian', tempo: 104, wave: 'sine', sub: 'triangle' }
  },
  {
    id: 'mountain',
    name: 'Mountain Town',
    tag: 'Cold mornings, rich milk',
    blurb: 'Steep pastures above the treeline. The dairy here is the best in the country and the winters sell coats.',
    map: { x: 63, y: 18 },
    population: 1.3,
    priceMul: 1.3,
    trafficMul: 1.2,
    specials: ['cheese', 'parka', 'coffeebag'],
    farmBonus: 0.35,
    dairyBonus: 0.5,
    requires: { storeLevel: 15, department: 'dairy', cash: 150000, served: 1500 },
    palette: {
      sky: '#cfe3f0', fog: '#dceaf2', ground: '#5f8f5a', ground2: '#527d4e',
      road: '#7f858c', soil: '#6b533a', building: '#e8ddcc', roof: '#7c5b46',
      trim: '#c85a4a', tree: '#2f6b46', trunk: '#5f4a35'
    },
    theme: { root: 233, scale: 'dorian', tempo: 84, wave: 'triangle', sub: 'sine' }
  },
  {
    id: 'desert',
    name: 'Desert City',
    tag: 'Thirsty crowds, endless sun',
    blurb: 'Heat that never lets up. Drinks disappear off the shelves faster than anywhere else in the world.',
    map: { x: 33, y: 84 },
    population: 1.6,
    priceMul: 1.25,
    trafficMul: 1.55,
    specials: ['water', 'soda', 'cactusfruit'],
    farmBonus: -0.1,
    drinkBonus: 0.8,
    requires: { storeLevel: 20, cash: 300000, served: 3000, reputation: 4.2 },
    palette: {
      sky: '#f7d9a8', fog: '#f3dcbb', ground: '#d8b06a', ground2: '#c79a55',
      road: '#a89880', soil: '#b58f52', building: '#f7e9cf', roof: '#c9743f',
      tree: '#5f9057', trunk: '#8a6a44', trim: '#3fa3a0'
    },
    theme: { root: 247, scale: 'minorPent', tempo: 110, wave: 'square', sub: 'sawtooth' }
  },
  {
    id: 'capital',
    name: 'Capital City',
    tag: 'High income, high standards',
    blurb: 'Glass towers and impatient shoppers with deep pockets. They will pay a premium, but they will not queue.',
    map: { x: 70, y: 55 },
    population: 2.6,
    priceMul: 1.6,
    trafficMul: 2.3,
    specials: ['truffle', 'luxchocolate', 'skincream'],
    farmBonus: -0.2,
    patienceMul: 0.75,
    requires: { storeLevel: 25, departments: 5, cash: 500000, served: 10000, reputation: 4.5 },
    palette: {
      sky: '#c3d6ef', fog: '#d3e0f0', ground: '#7f9a7a', ground2: '#6f8a6c',
      road: '#6f757e', soil: '#6f5b44', building: '#e6ebf2', roof: '#4a5a72',
      tree: '#3f7a52', trunk: '#63513c', trim: '#c9a24a'
    },
    theme: { root: 311, scale: 'major', tempo: 116, wave: 'sawtooth', sub: 'square' }
  },
  {
    id: 'mega',
    name: 'Mega City',
    tag: 'The empire finale',
    blurb: 'Twelve million people and no free ground left. Whoever runs the shops here runs the country.',
    map: { x: 86, y: 78 },
    population: 4,
    priceMul: 2,
    trafficMul: 3.4,
    specials: ['giftbasket', 'headphones', 'desklamp'],
    farmBonus: -0.3,
    patienceMul: 0.7,
    requires: { storeLevel: 32, locations: 5, cash: 2000000, served: 25000, reputation: 4.6 },
    palette: {
      sky: '#b7c6e0', fog: '#c8d3e6', ground: '#6f7f88', ground2: '#63737d',
      road: '#5a6069', soil: '#5f5346', building: '#dfe6f0', roof: '#37405a',
      tree: '#3f6f5a', trunk: '#544738', trim: '#e05a8a'
    },
    theme: { root: 330, scale: 'lydian', tempo: 124, wave: 'sawtooth', sub: 'square' }
  }
];

export const locationById = (id) => LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];

// ==========================================================
// STORE EXPANSION - the building physically grows through these five
// stages. Everything here changes what gets built in the 3D world.
// ==========================================================
export const EXPANSIONS = [
  {
    stage: 1,
    name: 'Roadside Shop',
    cost: 0,
    level: 1,
    width: 12,
    depth: 10,
    shelves: 3,
    checkouts: 1,
    staffSlots: 1,
    plots: 6,
    pens: 0,
    machineSlots: 1,
    parking: 1,
    trafficBonus: 0
  },
  {
    stage: 2,
    name: 'Small Grocery',
    cost: 3500,
    level: 5,
    width: 16,
    depth: 13,
    shelves: 6,
    checkouts: 2,
    staffSlots: 3,
    plots: 10,
    pens: 2,
    machineSlots: 2,
    parking: 2,
    trafficBonus: 0.15
  },
  {
    stage: 3,
    name: 'Neighbourhood Market',
    cost: 28000,
    level: 11,
    width: 22,
    depth: 17,
    shelves: 10,
    checkouts: 3,
    staffSlots: 6,
    plots: 16,
    pens: 4,
    machineSlots: 4,
    parking: 4,
    trafficBonus: 0.35
  },
  {
    stage: 4,
    name: 'Large Supermarket',
    cost: 185000,
    level: 19,
    width: 30,
    depth: 22,
    shelves: 16,
    checkouts: 5,
    staffSlots: 10,
    plots: 24,
    pens: 6,
    machineSlots: 6,
    parking: 7,
    trafficBonus: 0.65
  },
  {
    stage: 5,
    name: 'Mega Market',
    cost: 950000,
    level: 27,
    width: 40,
    depth: 28,
    shelves: 24,
    checkouts: 8,
    staffSlots: 16,
    plots: 36,
    pens: 9,
    machineSlots: 9,
    parking: 12,
    trafficBonus: 1.1
  }
];

export const expansionFor = (stage) => EXPANSIONS[Math.max(0, Math.min(EXPANSIONS.length - 1, stage - 1))];

/** Readable text for one requirement key, used by the world map panel. */
export const REQUIREMENT_LABELS = {
  storeLevel: (v) => `Reach player level ${v}`,
  cash: (v) => `Have $${v.toLocaleString()} in the bank`,
  served: (v) => `Serve ${v.toLocaleString()} customers`,
  reputation: (v) => `Hold a ${v.toFixed(1)}-star reputation`,
  department: (v) => `Open the ${v} department`,
  departments: (v) => `Open ${v} departments`,
  locations: (v) => `Run ${v} locations`
};
