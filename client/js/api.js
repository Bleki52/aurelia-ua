/**
 * ============================================================================
 * AURELIA UA — Async API Client & Local Fallback Engine
 * Communicates with backend http://localhost:5000/api when available,
 * seamlessly falling back to rich Ukrainian localStorage seed data offline.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AureliaAPI = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const LOCAL_API_URL = 'http://localhost:5000/api';
  const PRODUCTION_API_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('@aurelia_api_url')) || 'https://aurelia-ua-api.onrender.com/api';

  const API_BASE = (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? LOCAL_API_URL
    : PRODUCTION_API_URL;

  const REQUEST_TIMEOUT = 3000; // 3000ms before falling back to local offline storage

  const STORAGE_KEYS = {
    CARDS: 'aurelia_cards_data',
    PRODUCTS: 'aurelia_products_data',
    BASKET: 'aurelia_basket_data',
    AUTH: 'aurelia_auth_data'
  };

  const SELECTED_STORES_KEY = '@aurelia_selected_stores';
  const DEFAULT_CITY = 'ivano-frankivsk';
  const SELECTED_CITY_KEY = '@aurelia_selected_city';

  const CITIES = {
    'ivano-frankivsk': {
      id: 'ivano-frankivsk',
      name: 'Івано-Франківськ',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'metro', 'velmart', 'epicentrk_food', 'arsen',
        'rukavychka', 'thrash', 'simi', 'blyzenko', 'taistra', 'eva', 'prostor', 'avrora'
      ]
    },
    'lviv': {
      id: 'lviv',
      name: 'Львів',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'metro', 'auchan', 'epicentrk_food', 'arsen',
        'rukavychka', 'blyzenko', 'simi', 'thrash', 'eva', 'prostor', 'avrora', 'novus'
      ]
    },
    'ternopil': {
      id: 'ternopil',
      name: 'Тернопіль',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi',
        'blyzenko', 'thrash', 'taistra', 'eva', 'prostor', 'avrora'
      ]
    },
    'lutsk': {
      id: 'lutsk',
      name: 'Луцьк',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi',
        'blyzenko', 'thrash', 'eva', 'prostor', 'avrora'
      ]
    },
    'chernivtsi': {
      id: 'chernivtsi',
      name: 'Чернівці',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'metro', 'epicentrk_food', 'rukavychka',
        'taistra', 'thrash', 'eva', 'prostor', 'avrora'
      ]
    },
    'rivne': {
      id: 'rivne',
      name: 'Рівне',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'metro', 'novus', 'epicentrk_food', 'rukavychka',
        'simi', 'thrash', 'eva', 'prostor', 'avrora'
      ]
    },
    'uzhhorod': {
      id: 'uzhhorod',
      name: 'Ужгород',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi',
        'thrash', 'eva', 'prostor', 'avrora'
      ]
    },
    'khmelnytskyi': {
      id: 'khmelnytskyi',
      name: 'Хмельницький',
      region: 'Західна Україна',
      activeStores: [
        'silpo', 'atb', 'epicentrk_food', 'rukavychka', 'taistra',
        'thrash', 'eva', 'prostor', 'avrora'
      ]
    },
    'kyiv': {
      id: 'kyiv',
      name: 'Київ',
      region: 'Центральна Україна',
      activeStores: [
        'silpo', 'atb', 'novus', 'metro', 'varus', 'auchan',
        'epicentrk_food', 'velmart', 'thrash', 'simi', 'eva', 'prostor', 'avrora', 'epicentr'
      ]
    }
  };

  function getSelectedCity() {
    try {
      const city = localStorage.getItem(SELECTED_CITY_KEY);
      if (city && CITIES[city]) return city;
    } catch (_) {}
    return DEFAULT_CITY;
  }

  function setSelectedCity(cityId) {
    const valid = CITIES[cityId] ? cityId : DEFAULT_CITY;
    try {
      localStorage.setItem(SELECTED_CITY_KEY, valid);
    } catch (_) {}
    return valid;
  }

  function getCityConfig(cityId) {
    const c = cityId || getSelectedCity();
    return CITIES[c] || CITIES[DEFAULT_CITY];
  }

  function getAllCities() {
    return Object.values(CITIES);
  }

  function isStoreInCurrentCity(storeId) {
    const config = getCityConfig(getSelectedCity());
    const s = String(storeId || '').toLowerCase().trim();
    return config.activeStores.includes(s);
  }

  /* ─── 18 Supported Ukrainian Retail Chains in 3 Clusters ───────────────── */
  const STORE_CLUSTERS = [
    {
      id: 'national',
      title: 'Національні супермаркети',
      desc: 'Великі загальнонаціональні мережі та гіпермаркети',
      stores: ['silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart']
    },
    {
      id: 'local',
      title: 'Локальні та біля дому',
      desc: 'Зручні щоденні маркети біля дому та регіональні мережі',
      stores: ['thrash', 'simi', 'blyzenko', 'taistra', 'arsen', 'rukavychka']
    },
    {
      id: 'daily',
      title: 'Краса, Дім та Щоденні',
      desc: 'Дрогері, мультимаркети та товари для затишку оселі',
      stores: ['eva', 'prostor', 'avrora', 'epicentr']
    }
  ];

  const ALL_STORE_IDS = [
    'silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart',
    'thrash', 'simi', 'blyzenko', 'taistra', 'arsen', 'rukavychka',
    'eva', 'prostor', 'avrora', 'epicentr'
  ];

  const CORE_STORE_IDS = ['silpo', 'atb', 'novus', 'metro', 'varus', 'auchan'];

  const STORE_META = {
    // 1. Національні супермаркети
    silpo:           { name: 'Сільпо', program: 'Власний Рахунок', logo: 'logo-silpo', cluster: 'national', badgeText: 'балів' },
    atb:             { name: 'АТБ-Маркет', program: 'Картка АТБ', logo: 'logo-atb', cluster: 'national', badgeText: 'знижка' },
    novus:           { name: 'NOVUS', program: 'Ваша Картка', logo: 'logo-novus', cluster: 'national', badgeText: 'бонусів' },
    metro:           { name: 'METRO', program: 'METRO Club', logo: 'logo-metro', cluster: 'national', badgeText: 'клуб' },
    varus:           { name: 'VARUS', program: 'VARUS Poshuk', logo: 'logo-varus', cluster: 'national', badgeText: 'бонусів' },
    auchan:          { name: 'АШАН', program: 'Auchan Club', logo: 'logo-auchan', cluster: 'national', badgeText: 'бонусів' },
    epicentrk_food:  { name: 'Епіцентр Food', program: 'Food Market', logo: 'logo-epicentrk-food', cluster: 'national', badgeText: 'балів' },
    velmart:         { name: 'Велмарт', program: 'Велмарт Клуб', logo: 'logo-velmart', cluster: 'national', badgeText: 'бонусів' },

    // 2. Локальні та біля дому
    thrash:          { name: 'Траш! (Thrash!)', program: 'Траш Клуб', logo: 'logo-thrash', cluster: 'local', badgeText: 'балів' },
    simi:            { name: 'Сімі', program: 'Сімі Клуб', logo: 'logo-simi', cluster: 'local', badgeText: 'бонусів' },
    blyzenko:        { name: 'Близенько', program: 'Близенько Поруч', logo: 'logo-blyzenko', cluster: 'local', badgeText: 'знижка' },
    taistra:         { name: 'Тайстра', program: 'Тайстра Клуб', logo: 'logo-taistra', cluster: 'local', badgeText: 'балів' },
    arsen:           { name: 'Арсен', program: 'Арсен Сім’я', logo: 'logo-arsen', cluster: 'local', badgeText: 'бонусів' },
    rukavychka:      { name: 'Рукавичка', program: 'Родина Рукавичка', logo: 'logo-rukavychka', cluster: 'local', badgeText: 'бонусів' },

    // 3. Краса, Дім та Щоденні
    eva:             { name: 'EVA', program: 'EVA Мозаїка', logo: 'logo-eva', cluster: 'daily', badgeText: 'мозаїка' },
    prostor:         { name: 'Prostor', program: 'Prostor Club', logo: 'logo-prostor', cluster: 'daily', badgeText: 'бонусів' },
    avrora:          { name: 'Аврора', program: 'Аврора Мультимаркет', logo: 'logo-avrora', cluster: 'daily', badgeText: 'знижки' },
    epicentr:        { name: 'Епіцентр', program: 'Вигода', logo: 'logo-epicentr', cluster: 'daily', badgeText: 'балів' },

    other:           { name: 'Інша мережа', program: 'Картка лояльності', logo: 'icon-qr', cluster: 'local', badgeText: 'картка' }
  };

  function getSelectedStores() {
    const cityConfig = getCityConfig(getSelectedCity());
    const validStoreIds = cityConfig.activeStores;
    try {
      const raw = localStorage.getItem(SELECTED_STORES_KEY) || localStorage.getItem('aurelia_selected_stores');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(s => validStoreIds.includes(s));
          if (valid.length > 0) return valid;
        }
      }
    } catch (_) {}
    return [...validStoreIds];
  }

  function setSelectedStores(stores) {
    const list = Array.isArray(stores) && stores.length > 0
      ? stores.filter(s => ALL_STORE_IDS.includes(s))
      : [...ALL_STORE_IDS];
    try {
      localStorage.setItem(SELECTED_STORES_KEY, JSON.stringify(list));
      localStorage.setItem('aurelia_selected_stores', JSON.stringify(list));
    } catch (_) {}
    return list;
  }

  // Self-healing cache cleanup: if previous sessions stored products with empty/corrupted prices, purge them immediately
  try {
    if (typeof localStorage !== 'undefined') {
      const rawProds = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (rawProds) {
        const parsed = JSON.parse(rawProds);
        const isCorrupted = !Array.isArray(parsed) || parsed.length === 0 || parsed.some(p => {
          const hasPrices = Array.isArray(p.prices) && p.prices.length > 0 && p.prices.some(x => parseFloat(x.price) > 0);
          const hasStorePrices = p.storePrices && Object.values(p.storePrices).some(x => parseFloat(x && x.price) > 0);
          return !hasPrices && !hasStorePrices;
        });
        if (isCorrupted) {
          console.warn('⚠️ [Aurelia API] Очищено застарілий кеш товарів з порожніми цінами.');
          localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
        }
      }
    }
  } catch (e) {
    try { localStorage.removeItem(STORAGE_KEYS.PRODUCTS); } catch (_) {}
  }

  /* ─── Rich Seed Data: 5 Ukrainian Supermarket Loyalty Cards ──────────────── */
  const SEED_CARDS = [
    {
      id: 'card-silpo',
      store: 'silpo',
      storeName: 'Сільпо',
      program: 'Власний Рахунок',
      number: '990001248831',
      qrPayload: '990001248831',
      note: '142.50 балів',
      privilegeBadge: 'Преміум гість',
      format: 'qr',
      logo: 'logo-silpo',
      createdAt: '2026-10-19T10:00:00.000Z'
    },
    {
      id: 'card-atb',
      store: 'atb',
      storeName: 'АТБ-Маркет',
      program: 'Картка АТБ',
      number: '414949910023',
      qrPayload: '414949910023',
      note: 'Знижка до 5%',
      privilegeBadge: 'Екстра Знижка',
      format: 'barcode',
      logo: 'logo-atb',
      createdAt: '2026-10-19T10:05:00.000Z'
    },
    {
      id: 'card-novus',
      store: 'novus',
      storeName: 'NOVUS',
      program: 'Програма Ваша Картка',
      number: '290000418552',
      qrPayload: '290000418552',
      note: '85.00 грн бонусів',
      privilegeBadge: 'VIP Покупець',
      format: 'qr',
      logo: 'logo-novus',
      createdAt: '2026-10-19T10:10:00.000Z'
    },
    {
      id: 'card-varus',
      store: 'varus',
      storeName: 'VARUS',
      program: 'VARUS Poshuk',
      number: '770089231104',
      qrPayload: '770089231104',
      note: '230 бонусів',
      privilegeBadge: 'VARUS Family',
      format: 'barcode',
      logo: 'logo-varus',
      createdAt: '2026-10-19T10:15:00.000Z'
    },
    {
      id: 'card-metro',
      store: 'metro',
      storeName: 'METRO',
      program: 'METRO Club',
      number: '500291103381',
      qrPayload: '500291103381',
      note: 'Партнерська ціна',
      privilegeBadge: 'Бізнес Клієнт',
      format: 'qr',
      logo: 'logo-metro',
      createdAt: '2026-10-19T10:20:00.000Z'
    },
    {
      id: 'card-eva',
      store: 'eva',
      storeName: 'EVA',
      program: 'EVA Мозаїка',
      number: '260019481230',
      qrPayload: '260019481230',
      note: '315 бонусів',
      privilegeBadge: 'Преміум Клуб',
      format: 'qr',
      logo: 'logo-eva',
      createdAt: '2026-10-19T10:25:00.000Z'
    },
    {
      id: 'card-epicentr',
      store: 'epicentr',
      storeName: 'Епіцентр',
      program: 'Картка Вигода',
      number: '280011492001',
      qrPayload: '280011492001',
      note: '180 балів',
      privilegeBadge: 'Майстер',
      format: 'barcode',
      logo: 'logo-epicentr',
      createdAt: '2026-10-19T10:30:00.000Z'
    }
  ];

  /* ─── Rich Seed Data: 23 Ukrainian Supermarket Promotional Products ──────── */
  const SEED_PRODUCTS = [
    // ── ПРОДУКТИ: Кава та Чай
    {
      id: 'prod-1',
      title: 'Кава Lavazza Crema e Gusto мелена 250 г',
      mainCategory: 'Продукти',
      subCategory: 'Кава та Чай',
      category: 'Кава та Чай',
      categorySlug: 'coffee',
      unit: 'шт',
      storePrices: {
        silpo: { price: 149.90, oldPrice: 199.00, discount: 25 },
        atb:   { price: 139.50, oldPrice: 189.00, discount: 26 },
        novus: { price: 154.00, oldPrice: 205.00, discount: 25 },
        varus: { price: 145.00, oldPrice: 195.00, discount: 26 },
        metro: { price: 142.00, oldPrice: 185.00, discount: 23 }
      }
    },
    {
      id: 'prod-2',
      title: 'Чай Greenfield Golden Ceylon чорний 100 пакетиків',
      mainCategory: 'Продукти',
      subCategory: 'Кава та Чай',
      category: 'Кава та Чай',
      categorySlug: 'coffee',
      unit: 'шт',
      storePrices: {
        silpo: { price: 129.00, oldPrice: 175.00, discount: 26 },
        atb:   { price: 135.00, oldPrice: 180.00, discount: 25 },
        novus: { price: 124.90, oldPrice: 169.00, discount: 26 },
        varus: { price: 128.00, oldPrice: 172.00, discount: 25 },
        metro: { price: 126.00, oldPrice: 170.00, discount: 26 }
      }
    },
    // ── ПРОДУКТИ: Молочні та Сири
    {
      id: 'prod-3',
      title: 'Молоко Яготинське 2.6% пастеризоване 900 г',
      mainCategory: 'Продукти',
      subCategory: 'Молочні та Сири',
      category: 'Молочні',
      categorySlug: 'dairy',
      unit: 'шт',
      storePrices: {
        silpo: { price: 38.99, oldPrice: 47.90, discount: 19 },
        atb:   { price: 36.40, oldPrice: 44.50, discount: 18 },
        novus: { price: 39.50, oldPrice: 48.00, discount: 18 },
        varus: { price: 37.90, oldPrice: 46.00, discount: 18 },
        metro: { price: 37.00, oldPrice: 45.00, discount: 18 }
      }
    },
    {
      id: 'prod-4',
      title: 'Сир твердий КОМО Тенеро 50% брус 180 г',
      mainCategory: 'Продукти',
      subCategory: 'Молочні та Сири',
      category: 'Молочні',
      categorySlug: 'dairy',
      unit: 'шт',
      storePrices: {
        silpo: { price: 64.99, oldPrice: 89.90, discount: 28 },
        atb:   { price: 67.50, oldPrice: 91.00, discount: 26 },
        novus: { price: 69.90, oldPrice: 94.00, discount: 26 },
        varus: { price: 66.00, oldPrice: 89.00, discount: 26 },
        metro: { price: 65.50, oldPrice: 88.00, discount: 25 }
      }
    },
    // ── ПРОДУКТИ: М'ясо та Риба
    {
      id: 'prod-5',
      title: 'Філе індички охолоджене фермерське 1 кг',
      mainCategory: 'Продукти',
      subCategory: "М'ясо та Риба",
      category: "М'ясо та Риба",
      categorySlug: 'meat',
      unit: 'кг',
      storePrices: {
        silpo: { price: 219.00, oldPrice: 289.00, discount: 24 },
        atb:   { price: 215.00, oldPrice: 279.00, discount: 23 },
        novus: { price: 225.00, oldPrice: 295.00, discount: 24 },
        varus: { price: 209.90, oldPrice: 275.00, discount: 24 },
        metro: { price: 212.00, oldPrice: 280.00, discount: 24 }
      }
    },
    {
      id: 'prod-6',
      title: 'Лосось слабосолений філе Norven 180 г',
      mainCategory: 'Продукти',
      subCategory: "М'ясо та Риба",
      category: "М'ясо та Риба",
      categorySlug: 'meat',
      unit: 'шт',
      storePrices: {
        silpo: { price: 179.00, oldPrice: 239.00, discount: 25 },
        atb:   { price: 169.90, oldPrice: 229.00, discount: 26 },
        novus: { price: 185.00, oldPrice: 245.00, discount: 24 },
        varus: { price: 174.00, oldPrice: 230.00, discount: 24 },
        metro: { price: 172.00, oldPrice: 228.00, discount: 25 }
      }
    },
    // ── ПРОДУКТИ: Солодощі
    {
      id: 'prod-7',
      title: 'Шоколад Roshen екстрачорний з цілим ліщиною 85 г',
      mainCategory: 'Продукти',
      subCategory: 'Солодощі',
      category: 'Солодощі',
      categorySlug: 'sweets',
      unit: 'шт',
      storePrices: {
        silpo: { price: 34.50, oldPrice: 48.00, discount: 28 },
        atb:   { price: 31.90, oldPrice: 45.00, discount: 29 },
        novus: { price: 36.00, oldPrice: 49.00, discount: 27 },
        varus: { price: 33.50, oldPrice: 47.00, discount: 29 },
        metro: { price: 32.50, oldPrice: 46.00, discount: 29 }
      }
    },
    {
      id: 'prod-8',
      title: 'Цукерки Ferrero Rocher хрусткі з горіхом 200 г',
      mainCategory: 'Продукти',
      subCategory: 'Солодощі',
      category: 'Солодощі',
      categorySlug: 'sweets',
      unit: 'шт',
      storePrices: {
        silpo: { price: 199.00, oldPrice: 265.00, discount: 25 },
        atb:   { price: 195.00, oldPrice: 259.00, discount: 25 },
        novus: { price: 189.90, oldPrice: 255.00, discount: 25 },
        varus: { price: 196.00, oldPrice: 260.00, discount: 25 },
        metro: { price: 192.00, oldPrice: 258.00, discount: 26 }
      }
    },
    // ── ПРОДУКТИ: Бакалія
    {
      id: 'prod-9',
      title: 'Олія соняшникова Чумак рафінована 850 мл',
      mainCategory: 'Продукти',
      subCategory: 'Бакалія',
      category: 'Бакалія',
      categorySlug: 'grocery',
      unit: 'пляшка',
      storePrices: {
        silpo: { price: 54.90, oldPrice: 68.00, discount: 19 },
        atb:   { price: 49.90, oldPrice: 64.00, discount: 22 },
        novus: { price: 56.00, oldPrice: 69.00, discount: 19 },
        varus: { price: 52.50, oldPrice: 66.00, discount: 20 },
        metro: { price: 51.00, oldPrice: 65.00, discount: 22 }
      }
    },
    {
      id: 'prod-10',
      title: 'Макарони Barilla Spaghetti n.5 спагеті 500 г',
      mainCategory: 'Продукти',
      subCategory: 'Бакалія',
      category: 'Бакалія',
      categorySlug: 'grocery',
      unit: 'упак',
      storePrices: {
        silpo: { price: 59.90, oldPrice: 85.00, discount: 30 },
        atb:   { price: 58.50, oldPrice: 82.00, discount: 29 },
        novus: { price: 54.90, oldPrice: 79.00, discount: 30 },
        varus: { price: 61.00, oldPrice: 86.00, discount: 29 },
        metro: { price: 56.00, oldPrice: 80.00, discount: 30 }
      }
    },
    // ── ПРОДУКТИ: Напої
    {
      id: 'prod-11',
      title: 'Вода мінеральна Borjomi природна лікувальна 0.5 л скло',
      mainCategory: 'Продукти',
      subCategory: 'Напої',
      category: 'Напої',
      categorySlug: 'drinks',
      unit: 'пляшка',
      storePrices: {
        silpo: { price: 39.90, oldPrice: 52.00, discount: 23 },
        atb:   { price: 37.50, oldPrice: 49.00, discount: 23 },
        novus: { price: 41.00, oldPrice: 54.00, discount: 24 },
        varus: { price: 38.90, oldPrice: 50.00, discount: 22 },
        metro: { price: 38.00, oldPrice: 49.50, discount: 23 }
      }
    },
    {
      id: 'prod-12',
      title: 'Сік Sandora Гранатовий 100% преміум 0.95 л',
      mainCategory: 'Продукти',
      subCategory: 'Напої',
      category: 'Напої',
      categorySlug: 'drinks',
      unit: 'упак',
      storePrices: {
        silpo: { price: 68.00, oldPrice: 89.00, discount: 24 },
        atb:   { price: 69.50, oldPrice: 91.00, discount: 24 },
        novus: { price: 66.90, oldPrice: 88.00, discount: 24 },
        varus: { price: 67.50, oldPrice: 89.00, discount: 24 },
        metro: { price: 65.00, oldPrice: 85.00, discount: 24 }
      }
    },
    // ── ПРОДУКТИ: Овочі та Фрукти
    {
      id: 'prod-13',
      title: 'Банани свіжі добірні преміум 1 кг',
      mainCategory: 'Продукти',
      subCategory: 'Овочі та Фрукти',
      category: 'Овочі та Фрукти',
      categorySlug: 'produce',
      unit: 'кг',
      storePrices: {
        silpo: { price: 64.99, oldPrice: 79.99, discount: 19 },
        atb:   { price: 59.90, oldPrice: 74.50, discount: 20 },
        novus: { price: 63.50, oldPrice: 78.00, discount: 19 },
        varus: { price: 61.90, oldPrice: 76.00, discount: 19 }
      }
    },
    {
      id: 'prod-14',
      title: 'Яблука сорт Симиренка соковиті 1 кг',
      mainCategory: 'Продукти',
      subCategory: 'Овочі та Фрукти',
      category: 'Овочі та Фрукти',
      categorySlug: 'produce',
      unit: 'кг',
      storePrices: {
        silpo: { price: 29.90, oldPrice: 39.90, discount: 25 },
        atb:   { price: 27.50, oldPrice: 36.00, discount: 24 },
        novus: { price: 31.00, oldPrice: 42.00, discount: 26 },
        metro: { price: 28.90, oldPrice: 38.00, discount: 24 }
      }
    },
    // ── КРАСА ТА ГІГІЄНА
    {
      id: 'prod-15',
      title: 'Гель для душу Palmolive Натурэль Олива 500 мл',
      mainCategory: 'Краса та Гігієна',
      subCategory: 'Гігієна',
      category: 'Гігієна',
      categorySlug: 'beauty',
      unit: 'шт',
      storePrices: {
        eva:     { price: 119.00, oldPrice: 169.00, discount: 30 },
        prostor: { price: 124.00, oldPrice: 175.00, discount: 29 },
        silpo:   { price: 132.00, oldPrice: 185.00, discount: 29 },
        novus:   { price: 129.90, oldPrice: 179.00, discount: 27 }
      }
    },
    {
      id: 'prod-16',
      title: 'Шампунь Head & Shoulders Основний догляд 400 мл',
      mainCategory: 'Краса та Гігієна',
      subCategory: 'Волосся',
      category: 'Волосся',
      categorySlug: 'beauty',
      unit: 'шт',
      storePrices: {
        eva:     { price: 169.00, oldPrice: 239.00, discount: 29 },
        prostor: { price: 165.00, oldPrice: 235.00, discount: 30 },
        atb:     { price: 172.00, oldPrice: 245.00, discount: 30 },
        metro:   { price: 164.50, oldPrice: 230.00, discount: 28 }
      }
    },
    {
      id: 'prod-17',
      title: 'Крем для обличчя Nivea Care зволожувальний 100 мл',
      mainCategory: 'Краса та Гігієна',
      subCategory: 'Догляд за шкірою',
      category: 'Догляд за шкірою',
      categorySlug: 'beauty',
      unit: 'шт',
      storePrices: {
        eva:     { price: 145.00, oldPrice: 199.00, discount: 27 },
        prostor: { price: 149.00, oldPrice: 205.00, discount: 27 },
        silpo:   { price: 154.00, oldPrice: 210.00, discount: 27 }
      }
    },
    {
      id: 'prod-18',
      title: 'Бальзам для губ Carmex Classic вишня 10 г',
      mainCategory: 'Краса та Гігієна',
      subCategory: 'Косметика',
      category: 'Косметика',
      categorySlug: 'beauty',
      unit: 'шт',
      storePrices: {
        eva:     { price: 129.00, oldPrice: 169.00, discount: 24 },
        prostor: { price: 132.00, oldPrice: 175.00, discount: 25 },
        avrora:  { price: 125.00, oldPrice: 160.00, discount: 22 }
      }
    },
    // ── ДІМ ТА ПОБУТ
    {
      id: 'prod-19',
      title: 'Капсули для прання Ariel All-in-1 Pods Color 24 шт',
      mainCategory: 'Дім та Побут',
      subCategory: 'Побутова хімія',
      category: 'Побутова хімія',
      categorySlug: 'home',
      unit: 'упак',
      storePrices: {
        epicentr: { price: 349.00, oldPrice: 489.00, discount: 29 },
        eva:      { price: 355.00, oldPrice: 495.00, discount: 28 },
        metro:    { price: 339.00, oldPrice: 479.00, discount: 29 },
        silpo:    { price: 369.00, oldPrice: 519.00, discount: 29 }
      }
    },
    {
      id: 'prod-20',
      title: 'Засіб для миття посуду Fairy Соковитий лимон 500 мл',
      mainCategory: 'Дім та Побут',
      subCategory: 'Кухня та Посуд',
      category: 'Кухня та Посуд',
      categorySlug: 'home',
      unit: 'шт',
      storePrices: {
        avrora:   { price: 69.00, oldPrice: 95.00, discount: 27 },
        atb:      { price: 72.50, oldPrice: 98.00, discount: 26 },
        eva:      { price: 71.00, oldPrice: 96.00, discount: 26 },
        epicentr: { price: 68.00, oldPrice: 92.00, discount: 26 }
      }
    },
    {
      id: 'prod-21',
      title: 'Свічка ароматична WoodWick Ваніль та морська сіль 275 г',
      mainCategory: 'Дім та Побут',
      subCategory: 'Дім та Декор',
      category: 'Дім та Декор',
      categorySlug: 'home',
      unit: 'шт',
      storePrices: {
        epicentr: { price: 489.00, oldPrice: 650.00, discount: 25 },
        prostor:  { price: 499.00, oldPrice: 670.00, discount: 26 }
      }
    },
    // ── ЗООТОВАРИ
    {
      id: 'prod-22',
      title: 'Корм сухий для котів Purina Pro Plan Sterilised з лососем 1.5 кг',
      mainCategory: 'Зоотовари',
      subCategory: 'Для котів',
      category: 'Для котів',
      categorySlug: 'pets',
      unit: 'упак',
      storePrices: {
        silpo:    { price: 489.00, oldPrice: 649.00, discount: 25 },
        metro:    { price: 479.00, oldPrice: 635.00, discount: 25 },
        epicentr: { price: 485.00, oldPrice: 640.00, discount: 24 }
      }
    },
    {
      id: 'prod-23',
      title: 'Ласощі для собак Pedigree DentaStix для середніх порід 7 шт',
      mainCategory: 'Зоотовари',
      subCategory: 'Для собак',
      category: 'Для собак',
      categorySlug: 'pets',
      unit: 'упак',
      storePrices: {
        atb:     { price: 74.90, oldPrice: 99.00, discount: 24 },
        silpo:   { price: 79.00, oldPrice: 105.00, discount: 25 },
        novus:   { price: 76.50, oldPrice: 102.00, discount: 25 },
        avrora:  { price: 72.00, oldPrice: 95.00, discount: 24 }
      }
    }
  ];

  // Ensure SEED_PRODUCTS has both storePrices and prices array for full schema compatibility
  SEED_PRODUCTS.forEach(p => {
    if (!Array.isArray(p.prices) || p.prices.length === 0) {
      p.prices = Object.entries(p.storePrices || {}).map(([s, val]) => ({
        store: s,
        price: Number(val.price),
        oldPrice: val.oldPrice || val.old_price ? Number(val.oldPrice || val.old_price) : null,
        old_price: val.old_price || val.oldPrice ? Number(val.old_price || val.oldPrice) : null,
        discount: val.discount || (val.oldPrice && val.oldPrice > val.price ? Math.round(((val.oldPrice - val.price) / val.oldPrice) * 100) : 0),
        sourceUrl: val.sourceUrl || 'https://silpo.ua'
      }));
    }
  });

  /* ─── Local Storage Helper Utilities ─────────────────────────────────────── */
  function getStorage(key, defaultVal) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.setItem(key, JSON.stringify(defaultVal));
        return defaultVal;
      }
      return JSON.parse(raw);
    } catch (e) {
      return defaultVal;
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Storage quota error:', e);
    }
  }

  /* ─── Fetch With Timeout & Fallback ──────────────────────────────────────── */
  async function fetchWithFallback(url, options, fallbackFn) {
    const controller = new AbortController();
    const timeout = (options && options.timeout) || REQUEST_TIMEOUT;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const auth = getStorage(STORAGE_KEYS.AUTH, null);
      const headers = Object.assign({
        'Content-Type': 'application/json'
      }, options && options.headers);

      if (auth && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }

      const res = await fetch(`${API_BASE}${url}`, Object.assign({}, options, {
        signal: controller.signal,
        headers
      }));

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      // Seamlessly execute offline/mock fallback
      return await fallbackFn();
    }
  }

  /* ─── 1. CARDS API ───────────────────────────────────────────────────────── */
  async function getCards() {
    return fetchWithFallback('/cards', { method: 'GET' }, () => {
      return getStorage(STORAGE_KEYS.CARDS, SEED_CARDS);
    });
  }

  async function createCard(cardData) {
    const res = await fetchWithFallback('/cards', {
      method: 'POST',
      body: JSON.stringify(cardData)
    }, () => {
      const cards = getStorage(STORAGE_KEYS.CARDS, SEED_CARDS);
      const newCard = Object.assign({
        id: 'card-' + Date.now(),
        createdAt: new Date().toISOString()
      }, cardData);
      cards.unshift(newCard);
      setStorage(STORAGE_KEYS.CARDS, cards);
      return newCard;
    });
    return res && res.card ? res.card : res;
  }

  async function updateCard(id, cardData) {
    const res = await fetchWithFallback(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cardData)
    }, () => {
      const cards = getStorage(STORAGE_KEYS.CARDS, SEED_CARDS);
      const idx = cards.findIndex(c => String(c.id) === String(id));
      if (idx === -1) throw new Error('Картку не знайдено.');
      cards[idx] = Object.assign({}, cards[idx], cardData, {
        updatedAt: new Date().toISOString()
      });
      setStorage(STORAGE_KEYS.CARDS, cards);
      return cards[idx];
    });
    return res && res.card ? res.card : res;
  }

  async function deleteCard(id) {
    const res = await fetchWithFallback(`/cards/${id}`, {
      method: 'DELETE'
    }, () => {
      let cards = getStorage(STORAGE_KEYS.CARDS, SEED_CARDS);
      cards = cards.filter(c => String(c.id) !== String(id));
      setStorage(STORAGE_KEYS.CARDS, cards);
      return { success: true, id };
    });
    return res && res.id ? res : { success: true, id };
  }

  /* ─── Word-Boundary Stem Matching Helper ───────────────────────────────── */
  function hasWord(text = '', ...stemArgs) {
    if (!text) return false;
    const t = String(text).toLowerCase();
    const stems = stemArgs.flat(Infinity);
    for (let s of stems) {
      if (!s) continue;
      const requireExact = s.endsWith(' ');
      const trimmed = s.trim().toLowerCase();
      if (!trimmed) continue;
      const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
      const regex = requireExact
        ? new RegExp('(?:^|[^а-яіїєґa-z0-9])' + escaped + '(?:[аеєиіїоуюя]|ом|ем|ям|ів|ей|ами|ями|ах|ях)?(?:$|[^а-яіїєґa-z0-9])', 'i')
        : new RegExp('(?:^|[^а-яіїєґa-z0-9])' + escaped, 'i');
      if (regex.test(t)) return true;
    }
    return false;
  }

  /* ─── Category Normalization & Resolution Utility ────────────────────────── */
  function resolveCategories(p) {
    const rawMain = (p.mainCategory || p.main_category || '').trim();
    const rawSub = (p.subCategory || p.sub_category || '').trim();
    const rawCat = (p.category || '').trim();
    const title = (p.title || p.name || '').trim();
    const store = (p.store || (p.prices && p.prices[0] ? p.prices[0].store : '') || '').toLowerCase().trim();
    const isBeautyStore = ['eva', 'prostor'].includes(store);
    const text = (title + ' ' + rawCat).toLowerCase();

    if (rawMain && rawSub) {
      return { mainCategory: rawMain, subCategory: rawSub, category: rawSub };
    }

    // STAGE 1: Pet Products (mainCategory: 'Зоотовари')
    const petIndicators = [
      'для котів', 'для кішок', 'для кошенят', 'для собак', 'для цуценят', 'для гризунів', 'для папуг',
      'корм сухий', 'корм вологий', 'наповнювач для котячого', 'наповнювач', 'стерилізованих',
      'ласощі для котів', 'ласощі для собак', 'ласощі для тварин', 'для тварин'
    ];
    const petBrands = [
      'whiskas', 'віскас', 'felix', 'фелікс', 'purina', 'пуріна', 'gourmet', 'гурме',
      'sheba', 'шеба', 'friskies', 'фріскіс', 'optimeal', 'оптіміл', 'клуб 4 лапи', 'club 4 paws',
      'pedigree', 'педігрі', 'chappi', 'чаппі', 'brit', 'savory', 'josera'
    ];
    if (rawCat === 'Зоотовари' || rawCat === 'Для котів' || rawCat === 'Для собак' || hasWord(text, petIndicators, petBrands) || (hasWord(text, ['корм ']) && !hasWord(text, ['кормчий']))) {
      let sub = 'Усі зоотовари';
      if (rawCat === 'Для котів' || hasWord(text, ['кіш', 'кіт', 'кот', 'кошен', 'котяч', 'whiskas', 'віскас', 'felix', 'фелікс', 'gourmet', 'гурме', 'sheba', 'шеба', 'наповнювач'])) {
        sub = 'Для котів';
      } else if (rawCat === 'Для собак' || hasWord(text, ['собак', 'пес', 'пса', 'цуцен', 'педігрі', 'pedigree', 'chappi', 'чаппі'])) {
        sub = 'Для собак';
      }
      return { mainCategory: 'Зоотовари', subCategory: sub, category: sub };
    }

    // Pre-checks for Explicit Household & Hygiene
    const householdLaundryTriggers = [
      'для прання', 'пральний порошок', 'капсули для прання', 'гель для прання',
      'ополіскувач для білизни', 'кондиціонер для білизни', 'відбілювач', 'плямовивідник',
      'для миття посуду', 'таблетки для посудомийних', 'сіль для посудомийних',
      'для чищення', 'для унітазу', 'для труб', 'для підлоги', 'для скла',
      'освіжувач повітря', 'дифузор', 'антижир', 'антинакип'
    ];
    const householdLaundryBrands = [
      'persil', 'ariel', 'tide', 'perwoll', 'lenor', 'silan', 'fairy',
      'somat', 'finish', 'domestos', 'breff', 'bref', 'cillit', 'mr. muscle',
      'містер мускул', 'утьонок', 'sano', 'frosch', 'гала', 'gala', 'сарма', 'wash&free', 'savex'
    ];
    const paperTriggers = [
      'туалетний папір', 'паперові рушники', 'серветки столові', 'серветки паперові', 'носові хустинки'
    ];
    const paperBrands = [
      'zewa', 'рута', 'ruta', 'сніжна панда', 'обухів', 'selpak', 'kleenex'
    ];
    const kitchenTriggers = [
      'сковород', 'пательн', 'каструл', 'тарілк', 'чашк', 'склянк', 'келих',
      'термос', 'контейнер для їжі', 'фольга алюмінієва', 'плівка харчова',
      'пергамент для випічки', 'рукав для запікання', 'губка кухонна', 'губки для посуду',
      'серветка для прибирання', 'пакети для сміття', 'мішки для сміття', 'бокс універсальний'
    ];
    const kitchenBrands = [
      'фрекен бок', 'мельниця', 'luminarc', 'tefal', 'ardesto'
    ];

    const explicitHygieneTriggers = [
      'шампунь', 'гель для душу', 'крем-гель для душу', 'бальзам для волосся', 'бальзам-ополіскувач',
      'кондиціонер для волосся', 'фарба для волосся', 'маска для волосся', 'лак для волосся',
      'зубна паста', 'зубна щітка', 'дезодорант', 'антиперспірант', 'піна для гоління',
      'гель для гоління', 'станок для гоління', 'прокладки', 'тампони', 'підгузки', 'підгузники',
      'підгузки-трусики', 'підгузники-трусики', 'вологі серветки', 'пелюшки гігієнічні'
    ];
    const explicitHygieneBrands = [
      'head & shoulders', 'head&shoulders', 'pantene', 'fructis', 'syoss', 'gliss kur',
      'colgate', 'splat', 'biomed', 'oral-b', 'old spice', 'rexona', 'dove', 'palmolive',
      'always', 'kotex', 'libresse', 'discreet', 'huggies', 'pampers', 'tesori d\'oriente', 'deepfresh'
    ];

    const isExplicitNonFood = hasWord(text, householdLaundryTriggers, householdLaundryBrands, paperTriggers, paperBrands, kitchenTriggers, kitchenBrands, explicitHygieneTriggers, explicitHygieneBrands);

    // STAGE 2: Hard Food Lock (isExplicitFood)
    const EXPLICIT_FOOD_STEMS = [
      'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'штрудель',
      'рулет', 'кекс', 'мафін', 'булочка', 'пиріг', 'печиво', 'вафлі', 'вафл', 'пряник',
      'зефір', 'мармелад', 'цукерк', 'шоколад', 'батончик', 'халва', 'морозиво', 'десерт',
      'крем-мед', 'пастила', 'козинак', 'драже', 'льодяник', 'жувальна гумка', 'джем', 'варення',
      'крем-сир', 'крем сир', 'крем-суп', 'вершковий сир', 'сир вершковий', 'плавлений',
      'моцарела', 'гауда', 'чеддер', 'пармезан', 'бринза', 'фета', 'сулугуні', 'кисломолочн',
      'сирок', 'сметана', 'йогурт', 'кефір', 'ряжанка', 'айран', 'закваска',
      'масло солодковершкове', 'масло селянське', 'масло вершкове', 'масло екстра',
      'солодковершкове масло', 'селянське масло', 'вершкове масло',
      '73%', '72.5%', '82%', '82.5%', 'маргарин', 'спред',
      'молоко питне', 'молоко ультрапастеризоване', 'молоко пастеризоване', 'згущене',
      'вершки питні', 'вершки кулінарні',
      'ковбас', 'сосиск', 'сардельк', 'шинк', 'бекон', 'грудинк', 'балик', 'салямі',
      'паштет печінковий', 'паштет м', 'паштет мясний', 'паштет печінк', 'паштет курячий',
      'курк', 'куряч', 'індич', 'свинин', 'яловичин', 'телятин', 'фарш', 'стейк', 'крильця',
      'гомілк', 'стегно', 'лосос', 'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець',
      'скумбрі', 'хек', 'мінтай', 'креветк', 'мідії', 'ікра', 'крабові', 'буженин', 'реберц',
      'хліб ', 'багет', 'лаваш', 'батон', 'тост', 'чіабата', 'макарон', 'спагет', 'локшин',
      'пенне', 'фузіллі', 'вермішель', 'крупа', 'гречк', 'рис басматі', 'рис круглозернистий',
      'рис довгозернистий', 'рис пропарений', 'рис жасмин', 'вівсян', 'пластівці', 'борошно',
      'цукор', 'олія соняшникова', 'соняшникова олія', 'олія оливкова', 'оливкова олія',
      'олія кукурудзяна', 'олія рафінована', 'оцет', 'бальзамічний', 'кетчуп', 'майонез',
      'гірчиц', 'соус', 'томатна паста', 'паста томатна', 'арахісова паста', 'паста шоколадна',
      'nutella', 'нутелла', 'кава', 'еспресо', 'американо', 'капучино', 'лате', 'чай ',
      'матча', 'какао', 'сік ', 'нектар', 'лимонад', 'вода мінеральна', 'вода питна',
      'газован', 'енергетик', 'квас', 'пиво', 'вино', 'сидр', 'чіпси', 'сухарики',
      'горішки', 'фісташки', 'мигдаль', 'фундук', 'яблук', 'банан', 'апельсин', 'лимон',
      'мандарин', 'виноград', 'ківі', 'авокадо', 'помідор', 'томат', 'огірок', 'картопл',
      'моркв', 'цибул', 'капуст', 'перець', 'часник', 'зелень', 'салат '
    ];
    const isExplicitFood = !isExplicitNonFood && hasWord(text, EXPLICIT_FOOD_STEMS) && !isBeautyStore;

    // STAGE 3: Household & Cleaning (mainCategory: 'Дім та Побут')
    if (!isExplicitFood) {
      if (rawCat === 'Побутова хімія' || hasWord(text, householdLaundryTriggers, householdLaundryBrands)) {
        return { mainCategory: 'Дім та Побут', subCategory: 'Побутова хімія', category: 'Побутова хімія' };
      }
      if (rawCat === 'Паперова продукція' || hasWord(text, paperTriggers, paperBrands)) {
        return { mainCategory: 'Дім та Побут', subCategory: 'Паперова продукція', category: 'Паперова продукція' };
      }
      if (rawCat === 'Кухня та Посуд' || hasWord(text, kitchenTriggers, kitchenBrands)) {
        return { mainCategory: 'Дім та Побут', subCategory: 'Кухня та Посуд', category: 'Кухня та Посуд' };
      }
    }

    // STAGE 4: Beauty, Skincare & Personal Care (mainCategory: 'Краса та Гігієна')
    if (!isExplicitFood) {
      const hairTriggers = [
        'шампунь', 'бальзам для волосся', 'бальзам-ополіскувач', 'кондиціонер для волосся',
        'маска для волосся', 'фарба для волосся', 'лак для волосся', 'спрей для волосся', 'олія для волосся'
      ];
      const hairBrands = [
        'head & shoulders', 'head&shoulders', 'pantene', 'elseve', 'syoss',
        'gliss kur', 'schauma', 'tresemme', 'palette', 'fructis'
      ];

      const makeupTriggers = [
        'туш для вій', 'помада', 'блиск для губ', 'тіні для повік', 'пудра',
        'консилер', 'олівець для брів', 'олівець для очей', 'лак для нігтів', 'парфум', 'туалетна вода',
        'хайлайтер', 'рум\'яна', 'тінт для губ', 'кушон', 'палетка тіней'
      ];
      const makeupBrands = [
        'maybelline', 'vivienne sabo', 'bourjois', 'max factor', 'nyx', 'paese', 'it cosmetics',
        'charlotte tilbury', 'juliette has a gun', 'kayali', 'nishane', 'rare beauty', 'billie eilish',
        'gritti', 'lamel', 'milk touch', 'kylie cosmetics', 'a\'pieu', 'make up academy', 'xerjoff'
      ];

      const hygieneTriggers = [
        'гель для душу', 'крем-гель для душу', 'мило рідке', 'мило туалетне', 'крем-мило', 'дезодорант',
        'антиперспірант', 'зубна паста', 'зубна щітка', 'ополіскувач для ротової',
        'прокладки', 'тампони', 'ватні диски', 'ватні палички', 'вологі серветки',
        'пелюшки гігієнічні', 'бритва', 'станок для гоління', 'піна для гоління',
        'гель для гоління', 'підгузки', 'підгузники', 'підгузки-трусики', 'підгузники-трусики'
      ];
      const hygieneBrands = [
        'old spice', 'rexona', 'dove', 'palmolive', 'fa ', 'colgate', 'sensodyne',
        'lacalut', 'oral-b', 'parodontax', 'always', 'kotex', 'libresse', 'discreet',
        'bella', 'gillette', 'bic', 'pampers', 'huggies', 'splat', 'biomed', 'tesori d\'oriente', 'deepfresh'
      ];

      const cosmeticCreamQualifiers = [
        'для обличчя', 'для рук', 'для тіла', 'для ніг', 'для шкіри', 'для повік',
        'навколо очей', 'від зморшок', 'зволожуючий', 'зволожуюча', 'зволожуюче',
        'живильний', 'живильна', 'живильне', 'сонцезахисний', 'сонцезахисна', 'spf',
        'тональний', 'bb-крем', 'bb крем', 'cc-крем', 'cc крем',
        'після гоління', 'для гоління', 'для депіляції', 'дитячий крем'
      ];
      const isCosmeticCream = hasWord(text, ['крем']) && !hasWord(text, ['гель для душу', 'мило']) && (hasWord(text, cosmeticCreamQualifiers) || isBeautyStore);

      const skincareTriggers = [
        'сироватка для обличчя', 'сироватка', 'тонік для обличчя', 'тонік', 'міцелярна',
        'пінка для вмивання', 'гель для вмивання', 'скраб для тіла', 'скраб для обличчя',
        'скраб', 'маска для обличчя', 'патчі', 'лосьйон для тіла', 'лосьйон', 'молочко для тіла',
        'бальзам для губ', 'гігієнічна помада', 'пілінг'
      ];
      const skincareBrands = [
        'nivea', 'garnier', 'l\'oreal', 'loreal', 'cerave', 'la roche', 'vichy',
        'bioderma', 'eveline', 'ziaja', 'zaja', 'біокон', 'heimish', 'christina', 'babor', 'elemis'
      ];

      if (rawCat === 'Волосся' || rawCat === 'Догляд за волоссям' || hasWord(text, hairTriggers, hairBrands)) {
        return { mainCategory: 'Краса та Гігієна', subCategory: 'Волосся', category: 'Волосся' };
      }
      if (rawCat === 'Косметика' || hasWord(text, makeupTriggers, makeupBrands)) {
        return { mainCategory: 'Краса та Гігієна', subCategory: 'Косметика', category: 'Косметика' };
      }
      if (rawCat === 'Гігієна' || rawCat === 'Особиста гігієна' || hasWord(text, hygieneTriggers, hygieneBrands)) {
        return { mainCategory: 'Краса та Гігієна', subCategory: 'Гігієна', category: 'Гігієна' };
      }
      if (rawCat === 'Догляд за шкірою' || isCosmeticCream || hasWord(text, skincareTriggers, skincareBrands)) {
        return { mainCategory: 'Краса та Гігієна', subCategory: 'Догляд за шкірою', category: 'Догляд за шкірою' };
      }
      if (isBeautyStore || rawCat === 'Краса та Гігієна') {
        return { mainCategory: 'Краса та Гігієна', subCategory: 'Гігієна', category: 'Гігієна' };
      }
    }

    // STAGE 5: Groceries Subcategories (mainCategory: 'Продукти')
    // 1. Солодощі
    const sweetsTriggers = [
      'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'кекс', 'мафін',
      'рулет', 'штрудель', 'печиво', 'вафлі', 'вафл', 'пряник', 'зефір', 'мармелад', 'пастила',
      'цукерк', 'шоколад', 'батончик', 'халва', 'козинак', 'драже', 'льодяник', 'жувальна гумка',
      'морозиво', 'десерт', 'мед', 'крем-мед', 'джем', 'варення', 'згущене молоко', 'згущене',
      'паста шоколадна', 'nutella', 'нутелла', 'barni', 'барні', 'рошен', 'roshen', 'milka', 'мілка',
      'ferrero', 'kinder', 'кіндер', 'raffaello', 'рафаелло', 'конті', 'konti', 'авк', 'avk', 'ярич'
    ];
    if (rawCat === 'Солодощі' || hasWord(text, sweetsTriggers)) {
      return { mainCategory: 'Продукти', subCategory: 'Солодощі', category: 'Солодощі' };
    }

    // 2. Молочні та Сири
    const dairyTriggers = [
      'молоко', 'масло солодковершкове', 'масло вершкове', 'масло селянське', 'масло екстра',
      'солодковершкове масло', 'вершкове масло', 'селянське масло', 'маргарин', 'спред',
      'сир ', 'крем-сир', 'крем сир', 'сирок', 'моцарела', 'гауда', 'пармезан', 'чеддер',
      'сулугуні', 'бринза', 'фета', 'сметана', 'вершки', 'йогурт', 'кефір', 'ряжанка',
      'айран', 'закваска', 'плавлений', 'творог', 'кисломолочн', 'комо', 'яготинськ',
      'ферма', 'активіа', 'актимель', 'данон', 'danone', 'президент', 'president',
      'mlekovita', 'spomlek', 'простонаше', 'камамбер', 'брі '
    ];
    if (rawCat === 'Молочні та Сири' || hasWord(text, dairyTriggers)) {
      return { mainCategory: 'Продукти', subCategory: 'Молочні та Сири', category: 'Молочні та Сири' };
    }

    // 3. М'ясо та Риба
    const meatFishTriggers = [
      'м\'яс', 'мяс', 'курк', 'куряч', 'індич', 'свинин', 'яловичин', 'телятин', 'качк', 'гуск',
      'фарш', 'стейк', 'філе', 'крильця', 'гомілк', 'стегно', 'ковбас', 'сосиск', 'сардельк',
      'шинк', 'бекон', 'балик', 'салямі', 'паштет', 'буженин', 'реберц', 'риба', 'лосос',
      'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець', 'скумбрі', 'хек', 'мінтай',
      'креветк', 'мідії', 'кальмар', 'ікра', 'крабові', 'наша ряба', 'ранчо', 'бащинський',
      'глобино', 'м\'ясна гільдія', 'алан', 'водний світ', 'санта бремор'
    ];
    if (rawCat === "М'ясо та Риба" || hasWord(text, meatFishTriggers)) {
      return { mainCategory: 'Продукти', subCategory: "М'ясо та Риба", category: "М'ясо та Риба" };
    }

    // 4. Кава та Чай
    const coffeeTeaTriggers = [
      'кава', 'кавові', 'еспресо', 'капучино', 'лате', 'американо', 'чай ', 'матча', 'какао',
      'гарячий шоколад', 'дріп', 'jacobs', 'lavazza', 'greenfield', 'tess', 'curtis', 'lovare',
      'ліптон', 'lipton', 'paulig', 'чорна карта', 'жокей', 'idealist'
    ];
    if (rawCat === 'Кава та Чай' || hasWord(text, coffeeTeaTriggers)) {
      return { mainCategory: 'Продукти', subCategory: 'Кава та Чай', category: 'Кава та Чай' };
    }

    // 5. Напої
    const drinksTriggers = [
      'вода', 'сік ', 'сок', 'нектар', 'морс', 'лимонад', 'напій', 'кола', 'pepsi', 'coca-cola',
      'fanta', 'sprite', 'schweppes', 'комбуча', 'квас', 'енергетик', 'red bull', 'monster',
      'пиво', 'вино', 'шампанське', 'ігристе', 'сидр', 'моршинськ', 'боржомі', 'borjomi',
      'поляна квасова', 'садочок', 'sandora', 'rich', 'наш сік', 'віскі', 'горілка', 'коньяк', 'ром '
    ];
    if (rawCat === 'Напої' || hasWord(text, drinksTriggers)) {
      return { mainCategory: 'Продукти', subCategory: 'Напої', category: 'Напої' };
    }

    // 6. Овочі та Фрукти
    const isTomatoPasteOrSauce = (hasWord(text, 'томат') && hasWord(text, 'паста')) || hasWord(text, ['томатна паста', 'паста томатна', 'кетчуп', 'соус томатний']);
    const produceTriggers = [
      'яблук', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'ківі', 'авокадо',
      'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник',
      'зелень', 'салат ', 'айсберг', 'рукола', 'шпинат', 'кабачок', 'баклажан', 'буряк',
      'редис', 'печериц', 'гриб', 'ягоди', 'полуниц', 'малин', 'лохина', 'чорниц', 'кавун',
      'диня', 'гранат', 'груш', 'слив', 'персик', 'нектарин', 'броколі', 'чері'
    ];
    if (!isTomatoPasteOrSauce && (rawCat === 'Овочі та Фрукти' || hasWord(text, produceTriggers))) {
      return { mainCategory: 'Продукти', subCategory: 'Овочі та Фрукти', category: 'Овочі та Фрукти' };
    }

    // 7. Бакалія
    return { mainCategory: 'Продукти', subCategory: 'Бакалія', category: 'Бакалія' };
  }

  function normalizeItemPrices(p, cityParam) {
    if (!p) return null;
    const city = cityParam || getSelectedCity();
    const cityConfig = getCityConfig(city);
    let prices = Array.isArray(p.prices) ? p.prices : [];
    if (prices.length === 0 && p.storePrices && typeof p.storePrices === 'object') {
      prices = Object.entries(p.storePrices).map(([s, val]) => ({
        store: s,
        price: Number(val.price),
        oldPrice: val.oldPrice || val.old_price ? Number(val.oldPrice || val.old_price) : null,
        old_price: val.old_price || val.oldPrice ? Number(val.old_price || val.oldPrice) : null,
        discount: val.discount || 0,
        sourceUrl: val.sourceUrl || ''
      }));
    }
    // Filter prices to only those active in the chosen city
    prices = prices.filter(pr => pr && pr.store && typeof pr.price === 'number' && !isNaN(pr.price) && pr.price > 0 && cityConfig.activeStores.includes(String(pr.store).toLowerCase()));
    const storePrices = p.storePrices && typeof p.storePrices === 'object' ? { ...p.storePrices } : {};
    prices.forEach(pr => {
      if (!storePrices[pr.store]) {
        storePrices[pr.store] = {
          price: pr.price,
          oldPrice: pr.oldPrice || pr.old_price,
          old_price: pr.old_price || pr.oldPrice,
          discount: pr.discount || 0,
          sourceUrl: pr.sourceUrl || ''
        };
      }
    });

    const catObj = resolveCategories(p);

    return {
      ...p,
      mainCategory: catObj.mainCategory,
      main_category: catObj.mainCategory,
      subCategory: catObj.subCategory,
      sub_category: catObj.subCategory,
      category: catObj.category,
      prices,
      storePrices
    };
  }

  /* ─── 2. PRODUCTS API ────────────────────────────────────────────────────── */
  const SYNC_TIMESTAMP_KEY = 'aurelia_promos_synced_at';

  async function getProducts(cityParam) {
    const city = cityParam || getSelectedCity();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const res = await fetch(`${API_BASE}/products?city=${encodeURIComponent(city)}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const products = await res.json();
      if (Array.isArray(products) && products.length > 0) {
        const validProducts = products.map(p => normalizeItemPrices(p, city)).filter(p => p && p.prices.length > 0);
        if (validProducts.length > 0) {
          // Strictly overwrite localStorage with server response
          setStorage(STORAGE_KEYS.PRODUCTS, validProducts);
          if (validProducts[0].syncedAt) {
            localStorage.setItem(SYNC_TIMESTAMP_KEY, validProducts[0].syncedAt);
          }
          return validProducts;
        }
      }
      throw new Error('Отримано порожній каталог товарів');
    } catch (err) {
      clearTimeout(timer);
      console.warn('⚠️ [API] Не вдалося з’єднатися з сервером (використовується локальний кеш):', err.message);
      // Only uses fallback data if fetch() throws a network error or aborts
      const cached = getStorage(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      const list = Array.isArray(cached) && cached.length > 0 ? cached : SEED_PRODUCTS;
      return list.map(p => normalizeItemPrices(p, city)).filter(p => p && p.prices.length > 0);
    }
  }

  async function createProduct(prodData) {
    const res = await fetchWithFallback('/products', {
      method: 'POST',
      body: JSON.stringify(prodData)
    }, () => {
      const products = getStorage(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      const newProduct = Object.assign({
        id: 'prod-' + Date.now(),
        createdAt: new Date().toISOString()
      }, prodData);
      products.unshift(newProduct);
      setStorage(STORAGE_KEYS.PRODUCTS, products);
      return newProduct;
    });
    return res && res.product ? res.product : res;
  }

  async function updateProduct(id, prodData) {
    const res = await fetchWithFallback(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(prodData)
    }, () => {
      const products = getStorage(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      const idx = products.findIndex(p => String(p.id) === String(id));
      if (idx === -1) throw new Error('Товар не знайдено.');
      products[idx] = Object.assign({}, products[idx], prodData, {
        updatedAt: new Date().toISOString()
      });
      setStorage(STORAGE_KEYS.PRODUCTS, products);
      return products[idx];
    });
    return res && res.product ? res.product : res;
  }

  async function deleteProduct(id) {
    const res = await fetchWithFallback(`/products/${id}`, {
      method: 'DELETE'
    }, () => {
      let products = getStorage(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      products = products.filter(p => String(p.id) !== String(id));
      setStorage(STORAGE_KEYS.PRODUCTS, products);
      return { success: true, id };
    });
    return res && res.id ? res : { success: true, id };
  }

  async function syncProducts(cityParam) {
    const city = cityParam || getSelectedCity();
    try {
      const res = await fetch(`${API_BASE}/products/sync?city=${encodeURIComponent(city)}`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ city })
      });

      if (!res.ok) {
        throw new Error(`Sync HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      const rawFresh = Array.isArray(data.products) ? data.products : (Array.isArray(data) ? data : []);
      const freshProducts = rawFresh.map(p => normalizeItemPrices(p, city)).filter(p => p && p.prices.length > 0);

      if (freshProducts.length > 0) {
        // Completely overwrite the local cache with fresh server array
        setStorage(STORAGE_KEYS.PRODUCTS, freshProducts);
        const syncedAt = data.syncedAt || freshProducts[0]?.syncedAt || new Date().toISOString();
        localStorage.setItem(SYNC_TIMESTAMP_KEY, syncedAt);
        return freshProducts;
      }
      throw new Error('Синхронізація не повернула товарів');
    } catch (err) {
      console.warn('⚠️ [API] Помилка запиту синхронізації:', err.message);
      const cached = getStorage(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      const list = Array.isArray(cached) && cached.length > 0 ? cached : SEED_PRODUCTS;
      return list.map(p => normalizeItemPrices(p, city)).filter(p => p && p.prices.length > 0);
    }
  }

  function getLastSyncTime() {
    return localStorage.getItem(SYNC_TIMESTAMP_KEY) || null;
  }

  async function getStoresStatus(cityParam) {
    const city = cityParam || getSelectedCity();
    const cityConfig = getCityConfig(city);
    try {
      const res = await fetch(`${API_BASE}/products/stores-status?city=${encodeURIComponent(city)}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.stores)) {
          return data.stores;
        }
      }
    } catch (_) {}

    // Offline / fallback calculation from cached products for this city
    const products = getStorage(STORAGE_KEYS.PRODUCTS, []);
    const countsByStore = {};
    (products || []).forEach(p => {
      (p.prices || []).forEach(pr => {
        const s = String(pr.store || '').toLowerCase().trim();
        countsByStore[s] = (countsByStore[s] || 0) + 1;
      });
    });

    return ALL_STORE_IDS.map(id => {
      const meta = STORE_META[id] || { name: id };
      const inCity = cityConfig.activeStores.includes(id);
      const count = inCity ? (countsByStore[id] || 0) : 0;
      let status = 'blocked_or_empty';
      if (!inCity) {
        status = 'not_in_city';
      } else if (count > 0) {
        status = 'live';
      }

      return {
        store: id,
        name: meta.name,
        inCity,
        status,
        count,
        sourceDomain: ''
      };
    });
  }

  /* ─── 3. BASKET API ──────────────────────────────────────────────────────── */
  async function getBasket() {
    return getStorage(STORAGE_KEYS.BASKET, [
      { productId: 'prod-1', qty: 1 },
      { productId: 'prod-3', qty: 2 },
      { productId: 'prod-4', qty: 1 }
    ]);
  }

  async function toggleBasketItem(productId, qty) {
    const basket = await getBasket();
    const idx = basket.findIndex(item => String(item.productId) === String(productId));

    if (idx > -1) {
      if (qty <= 0) {
        basket.splice(idx, 1);
      } else {
        basket[idx].qty = qty;
      }
    } else if (qty > 0) {
      basket.push({ productId, qty });
    }

    setStorage(STORAGE_KEYS.BASKET, basket);
    return basket;
  }

  async function clearBasket() {
    setStorage(STORAGE_KEYS.BASKET, []);
    return [];
  }

  /* ─── 4. AUTH API ────────────────────────────────────────────────────────── */
  async function login(email, password) {
    const res = await fetchWithFallback('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, () => {
      if (!email || !password) throw new Error('Вкажіть email та пароль.');
      const user = {
        name: email.split('@')[0],
        email: email,
        role: email.includes('admin') ? 'ADMIN' : 'USER',
        token: 'mock-jwt-token-' + Date.now()
      };
      setStorage(STORAGE_KEYS.AUTH, user);
      return { user, token: user.token };
    });

    const userObj = res && res.user
      ? Object.assign({}, res.user, { token: res.token })
      : res;

    if (userObj && (userObj.token || userObj.email)) {
      setStorage(STORAGE_KEYS.AUTH, userObj);
    }
    return userObj;
  }

  async function register(name, email, password) {
    const res = await fetchWithFallback('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    }, () => {
      if (!email || !password) throw new Error('Заповніть усі обов’язкові поля.');
      const user = {
        name: name || email.split('@')[0],
        email: email,
        role: 'USER',
        token: 'mock-jwt-token-' + Date.now()
      };
      setStorage(STORAGE_KEYS.AUTH, user);
      return { user, token: user.token };
    });

    const userObj = res && res.user
      ? Object.assign({}, res.user, { token: res.token })
      : res;

    if (userObj && (userObj.token || userObj.email)) {
      setStorage(STORAGE_KEYS.AUTH, userObj);
    }
    return userObj;
  }

  async function logout() {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    return { success: true };
  }

  function getCurrentUser() {
    return getStorage(STORAGE_KEYS.AUTH, null);
  }

  return {
    // API Configuration
    LOCAL_API_URL,
    PRODUCTION_API_URL,
    API_BASE,
    // Cards
    getCards,
    createCard,
    updateCard,
    deleteCard,
    // Products
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    syncProducts,
    getLastSyncTime,
    getStoresStatus,
    // Basket
    getBasket,
    toggleBasketItem,
    clearBasket,
    // Auth
    login,
    register,
    logout,
    getCurrentUser,
    // Store Personalization & Taxonomy
    STORE_CLUSTERS,
    STORE_META,
    ALL_STORE_IDS,
    CORE_STORE_IDS,
    getSelectedStores,
    setSelectedStores,
    resolveCategories,
    // City Personalization
    DEFAULT_CITY,
    CITIES,
    getSelectedCity,
    setSelectedCity,
    getCityConfig,
    getAllCities,
    isStoreInCurrentCity
  };
});
