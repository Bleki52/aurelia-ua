/**
 * ============================================================================
 * AURELIA UA — Ukrainian Cities & Regional Store Configuration
 * Prioritizes Western Ukraine with localized store lists and real branch IDs.
 * Default city: ivano-frankivsk ("Івано-Франківськ")
 * ============================================================================
 */

const DEFAULT_CITY = 'ivano-frankivsk';

const ALL_STORE_IDS = [
  'silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart',
  'fora', 'eko', 'ultramarket', 'megamarket',
  'thrash', 'simi', 'blyzenko', 'taistra', 'arsen', 'rukavychka', 'torba', 'sviy_market', 'nash_kray', 'spar',
  'eva', 'prostor', 'avrora', 'epicentr'
];

const CITIES = {
  'ivano-frankivsk': {
    id: 'ivano-frankivsk',
    name: 'Івано-Франківськ',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'metro', 'velmart', 'epicentrk_food', 'eko', 'arsen',
      'rukavychka', 'thrash', 'simi', 'blyzenko', 'taistra', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b5a-55fb-6864-9a0f-d54e0a9fe643', // вул. Мазепи, 168А
    silpoAddress: 'вул. Мазепи, 168А',
    zakazStores: {
      metro: ['48215627'], // METRO Ivano-Frankivsk DRIVE (Вовчинецька 225М)
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867130'], // Torba Tatariv / Ivano-Frankivsk region DRIVE
      eko: ['482800030'],
      ultramarket: [],
      megamarket: []
    }
  },
  'lviv': {
    id: 'lviv',
    name: 'Львів',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'metro', 'auchan', 'epicentrk_food', 'ultramarket', 'arsen',
      'rukavychka', 'blyzenko', 'simi', 'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora', 'novus'
    ],
    silpoBranchId: '1edb6b12-3f2d-681e-9a93-eb10f39e9fe0', // вул. Кульпарківська, 226А
    silpoAddress: 'вул. Кульпарківська, 226А',
    zakazStores: {
      metro: ['48215637'], // METRO Lviv DRIVE
      auchan: ['48246409'], // Auchan Lviv DRIVE
      novus: ['482010201'], // NOVUS Lviv
      epicentrk_food: [],
      torba: ['482867220'],
      eko: [],
      ultramarket: ['48277601'],
      megamarket: []
    }
  },
  'ternopil': {
    id: 'ternopil',
    name: 'Тернопіль',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi',
      'blyzenko', 'thrash', 'taistra', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b5d-ae47-6e5c-b897-a302e997617d', // вул. Петлюри, 2Б
    silpoAddress: 'вул. Петлюри, 2Б',
    zakazStores: {
      metro: [],
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867220'],
      eko: [],
      ultramarket: [],
      megamarket: []
    }
  },
  'lutsk': {
    id: 'lutsk',
    name: 'Луцьк',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'epicentrk_food', 'eko', 'rukavychka', 'simi',
      'blyzenko', 'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b56-f57d-6c56-b993-639d81d4aac4', // вул. Кравчука, 23
    silpoAddress: 'вул. Кравчука, 23',
    zakazStores: {
      metro: [],
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867220'],
      eko: ['482800030'],
      ultramarket: [],
      megamarket: []
    }
  },
  'chernivtsi': {
    id: 'chernivtsi',
    name: 'Чернівці',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'metro', 'epicentrk_food', 'eko', 'rukavychka',
      'taistra', 'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b5b-831e-60fc-bf42-a302e997617d', // вул. Героїв Майдану, 71
    silpoAddress: 'вул. Героїв Майдану, 71',
    zakazStores: {
      metro: ['48215628'], // METRO Chernivtsi DRIVE
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867104'], // Torba Chernivtsi
      eko: ['482800030'],
      ultramarket: [],
      megamarket: []
    }
  },
  'rivne': {
    id: 'rivne',
    name: 'Рівне',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'metro', 'novus', 'fora', 'eko', 'epicentrk_food', 'rukavychka',
      'simi', 'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b55-2691-60a6-b134-d54e0a9fe643', // вул. Київська, 69
    silpoAddress: 'вул. Київська, 69',
    zakazStores: {
      metro: ['48215634'], // METRO Rivne DRIVE
      novus: ['48201022'], // NOVUS Rivne DRIVE
      auchan: [],
      epicentrk_food: [],
      torba: ['482867220'], // Torba Rivne
      eko: ['482800030'],
      ultramarket: [],
      megamarket: []
    }
  },
  'uzhhorod': {
    id: 'uzhhorod',
    name: 'Ужгород',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'fora', 'epicentrk_food', 'rukavychka', 'simi',
      'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b59-2df4-63d0-bb41-d54e0a9fe643', // вул. Швабська, 3
    silpoAddress: 'вул. Швабська, 3',
    zakazStores: {
      metro: [],
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867130'],
      eko: [],
      ultramarket: [],
      megamarket: []
    }
  },
  'khmelnytskyi': {
    id: 'khmelnytskyi',
    name: 'Хмельницький',
    region: 'Західна Україна',
    activeStores: [
      'silpo', 'atb', 'fora', 'eko', 'epicentrk_food', 'rukavychka', 'taistra',
      'thrash', 'torba', 'sviy_market', 'nash_kray', 'spar',
      'eva', 'prostor', 'avrora'
    ],
    silpoBranchId: '1edb6b6b-6ceb-6496-ac30-33779385ece7', // вул. Шевченка, 34
    silpoAddress: 'вул. Шевченка, 34',
    zakazStores: {
      metro: [],
      auchan: [],
      novus: [],
      epicentrk_food: [],
      torba: ['482867104'],
      eko: ['482800030'],
      ultramarket: [],
      megamarket: []
    }
  },
  'kyiv': {
    id: 'kyiv',
    name: 'Київ',
    region: 'Центральна Україна',
    activeStores: [
      'silpo', 'atb', 'novus', 'metro', 'varus', 'auchan',
      'epicentrk_food', 'velmart', 'fora', 'eko', 'ultramarket', 'megamarket',
      'thrash', 'simi', 'eva', 'prostor', 'avrora', 'epicentr'
    ],
    silpoBranchId: '1ed43e73-051b-6842-a111-a5ad042eb496', // просп. Володимира Івасюка, 46
    silpoAddress: 'просп. Володимира Івасюка, 46',
    zakazStores: {
      novus: ['482010105', '48201029'],
      metro: ['48215611', '48215610'],
      auchan: ['48246401', '48246407'],
      epicentrk_food: ['482374007'],
      torba: [],
      eko: ['482800030', '482800245'],
      ultramarket: ['48277601', '48277602'],
      megamarket: ['48267601', '48267602']
    }
  }
};

function getCityConfig(cityId) {
  const normalized = String(cityId || '').toLowerCase().trim();
  if (normalized === 'all') {
    return {
      id: 'all',
      name: 'Усі міста',
      region: 'Усі регіони України',
      activeStores: [...ALL_STORE_IDS],
      silpoBranchId: CITIES[DEFAULT_CITY].silpoBranchId,
      silpoAddress: CITIES[DEFAULT_CITY].silpoAddress,
      zakazStores: {
        novus: ['482010105', '482010201', '48201022'],
        metro: ['48215627', '48215637', '48215611', '48215628', '48215634'],
        auchan: ['48246409', '48246401'],
        epicentrk_food: ['482374007'],
        torba: ['482867130', '482867104', '482867220'],
        eko: ['482800030', '482800245'],
        ultramarket: ['48277601', '48277602'],
        megamarket: ['48267601', '48267602']
      }
    };
  }
  return CITIES[normalized] || CITIES[DEFAULT_CITY];
}

function getAllCities() {
  return Object.values(CITIES);
}

function isStoreInCity(storeId, cityId) {
  const city = getCityConfig(cityId);
  const s = String(storeId || '').toLowerCase().trim();
  return city.activeStores.includes(s);
}

module.exports = {
  DEFAULT_CITY,
  ALL_STORE_IDS,
  CITIES,
  getCityConfig,
  getAllCities,
  isStoreInCity
};

