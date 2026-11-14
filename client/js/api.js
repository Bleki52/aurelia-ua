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
  const PRODUCTION_API_URL = localStorage.getItem('@aurelia_api_url') || 'https://aurelia-ua.onrender.com/api';
  const API_BASE = (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? LOCAL_API_URL
    : PRODUCTION_API_URL;

  const REQUEST_TIMEOUT = 3000; // 3000ms before falling back to local offline storage
  const AUTH_REQUEST_TIMEOUT = 10000; // 10s for email OTP / auth cold starts

  const STORAGE_KEYS = {
    CARDS: 'aurelia_cards_data',
    PRODUCTS: 'aurelia_products_data',
    BASKET: 'aurelia_basket_data',
    AUTH: 'aurelia_auth_data'
  };
  const BASKET_CLEARED_ACK_KEY = '@aurelia_basket_cleared_ack';
  const ADMIN_RETURN_TOKEN_KEY = '@aurelia_admin_return_token';

  // Clear legacy unauthenticated global cards cache so demo cards never leak
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CARDS);
    }
  } catch (_) {}

  function getUserCardsStorageKey(user) {
    const activeUser = user || getCurrentUser();
    if (!activeUser || activeUser.id === undefined || activeUser.id === null || activeUser.id === '') {
      return null;
    }
    return `@aurelia_cards_user_${activeUser.id}`;
  }

  const SELECTED_STORES_KEY = '@aurelia_selected_stores';
  const DEFAULT_CITY = 'ivano-frankivsk';
  const SELECTED_CITY_KEY = '@aurelia_selected_city';

  const CITIES = Object.fromEntries([
    ['ivano-frankivsk', 'Івано-Франківськ', 'Західна Україна', ['silpo', 'atb', 'metro', 'velmart', 'epicentrk_food', 'arsen', 'rukavychka', 'thrash', 'simi', 'blyzenko', 'taistra', 'eva', 'prostor', 'avrora']],
    ['lviv', 'Львів', 'Західна Україна', ['silpo', 'atb', 'metro', 'auchan', 'epicentrk_food', 'arsen', 'rukavychka', 'blyzenko', 'simi', 'thrash', 'eva', 'prostor', 'avrora', 'novus']],
    ['ternopil', 'Тернопіль', 'Західна Україна', ['silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi', 'blyzenko', 'thrash', 'taistra', 'eva', 'prostor', 'avrora']],
    ['lutsk', 'Луцьк', 'Західна Україна', ['silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi', 'blyzenko', 'thrash', 'eva', 'prostor', 'avrora']],
    ['chernivtsi', 'Чернівці', 'Західна Україна', ['silpo', 'atb', 'metro', 'epicentrk_food', 'rukavychka', 'taistra', 'thrash', 'eva', 'prostor', 'avrora']],
    ['rivne', 'Рівне', 'Західна Україна', ['silpo', 'atb', 'metro', 'novus', 'epicentrk_food', 'rukavychka', 'simi', 'thrash', 'eva', 'prostor', 'avrora']],
    ['uzhhorod', 'Ужгород', 'Західна Україна', ['silpo', 'atb', 'epicentrk_food', 'rukavychka', 'simi', 'thrash', 'eva', 'prostor', 'avrora']],
    ['khmelnytskyi', 'Хмельницький', 'Західна Україна', ['silpo', 'atb', 'epicentrk_food', 'rukavychka', 'taistra', 'thrash', 'eva', 'prostor', 'avrora']],
    ['kyiv', 'Київ', 'Центральна Україна', ['silpo', 'atb', 'novus', 'metro', 'varus', 'auchan', 'epicentrk_food', 'velmart', 'thrash', 'simi', 'eva', 'prostor', 'avrora', 'epicentr']]
  ].map(([id, name, region, activeStores]) => [id, { id, name, region, activeStores }]));

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

  const CATEGORY_META = {
    groceries: { key: 'groceries', icon: 'cat-groceries', label: 'Продукти' },
    beauty:    { key: 'beauty',    icon: 'cat-beauty',    label: 'Краса та Гігієна' },
    home:      { key: 'home',      icon: 'cat-home',      label: 'Дім та Побут' },
    pets:      { key: 'pets',      icon: 'cat-pets',      label: 'Зоотовари' }
  };

  const STORE_META = {
    // 1. Національні супермаркети (Продукти)
    silpo:           { name: 'Сільпо', program: 'Власний Рахунок', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'балів' },
    atb:             { name: 'АТБ-Маркет', program: 'Картка АТБ', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'знижка' },
    novus:           { name: 'NOVUS', program: 'Ваша Картка', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'бонусів' },
    metro:           { name: 'METRO', program: 'METRO Club', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'клуб' },
    varus:           { name: 'VARUS', program: 'VARUS Poshuk', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'бонусів' },
    auchan:          { name: 'АШАН', program: 'Auchan Club', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'бонусів' },
    epicentrk_food:  { name: 'Епіцентр Food', program: 'Food Market', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'балів' },
    velmart:         { name: 'Велмарт', program: 'Велмарт Клуб', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'national', badgeText: 'бонусів' },

    // 2. Локальні та біля дому (Продукти)
    thrash:          { name: 'Траш! (Thrash!)', program: 'Траш Клуб', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'балів' },
    simi:            { name: 'Сімі', program: 'Сімі Клуб', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'бонусів' },
    blyzenko:        { name: 'Близенько', program: 'Близенько Поруч', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'знижка' },
    taistra:         { name: 'Тайстра', program: 'Тайстра Клуб', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'балів' },
    arsen:           { name: 'Арсен', program: 'Арсен Сім’я', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'бонусів' },
    rukavychka:      { name: 'Рукавичка', program: 'Родина Рукавичка', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'бонусів' },

    // 3. Краса, Дім та Щоденні
    eva:             { name: 'EVA', program: 'EVA Мозаїка', categoryKey: 'beauty', logo: 'cat-beauty', cluster: 'daily', badgeText: 'мозаїка' },
    prostor:         { name: 'Prostor', program: 'Prostor Club', categoryKey: 'beauty', logo: 'cat-beauty', cluster: 'daily', badgeText: 'бонусів' },
    avrora:          { name: 'Аврора', program: 'Аврора Мультимаркет', categoryKey: 'home', logo: 'cat-home', cluster: 'daily', badgeText: 'знижки' },
    epicentr:        { name: 'Епіцентр', program: 'Вигода', categoryKey: 'home', logo: 'cat-home', cluster: 'daily', badgeText: 'балів' },

    other:           { name: 'Інша мережа', program: 'Картка лояльності', categoryKey: 'groceries', logo: 'cat-groceries', cluster: 'local', badgeText: 'картка' }
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

  /* ─── Rich Seed Data: Ukrainian Supermarket Loyalty Cards ──────────────── */
  const SEED_CARDS = [
    ['card-silpo', 'silpo', 'Сільпо', 'Власний Рахунок', '990001248831', '142.50 балів', 'Преміум гість', 'qr', 'groceries', '2026-10-19T10:00:00.000Z'],
    ['card-atb', 'atb', 'АТБ-Маркет', 'Картка АТБ', '414949910023', 'Знижка до 5%', 'Екстра Знижка', 'barcode', 'groceries', '2026-10-19T10:05:00.000Z'],
    ['card-novus', 'novus', 'NOVUS', 'Програма Ваша Картка', '290000418552', '85.00 грн бонусів', 'VIP Покупець', 'qr', 'groceries', '2026-10-19T10:10:00.000Z'],
    ['card-varus', 'varus', 'VARUS', 'VARUS Poshuk', '770089231104', '230 бонусів', 'VARUS Family', 'barcode', 'groceries', '2026-10-19T10:15:00.000Z'],
    ['card-metro', 'metro', 'METRO', 'METRO Club', '500291103381', 'Партнерська ціна', 'Бізнес Клієнт', 'qr', 'groceries', '2026-10-19T10:20:00.000Z'],
    ['card-eva', 'eva', 'EVA', 'EVA Мозаїка', '260019481230', '315 бонусів', 'Преміум Клуб', 'qr', 'beauty', '2026-10-19T10:25:00.000Z'],
    ['card-epicentr', 'epicentr', 'Епіцентр', 'Картка Вигода', '280011492001', '180 балів', 'Майстер', 'barcode', 'home', '2026-10-19T10:30:00.000Z']
  ].map(([id, store, storeName, program, num, note, privilegeBadge, format, categoryKey, createdAt]) => ({
    id, store, storeName, program, number: num, qrPayload: num, note, privilegeBadge, format, categoryKey, logo: `cat-${categoryKey}`, createdAt
  }));

  /* ─── Rich Seed Data: 23 Ukrainian Supermarket Promotional Products ──────── */
  const mkSeedProd = (id, title, mainCategory, subCategory, category, categorySlug, unit, pricesList) => ({
    id, title, mainCategory, subCategory, category, categorySlug, unit,
    storePrices: Object.fromEntries(pricesList.map(([s, price, oldPrice, discount]) => [s, { price, oldPrice, discount }]))
  });

  const SEED_PRODUCTS = [
    mkSeedProd('prod-1', 'Кава Lavazza Crema e Gusto мелена 250 г', 'Продукти', 'Кава та Чай', 'Кава та Чай', 'coffee', 'шт', [['silpo', 149.90, 199, 25], ['atb', 139.50, 189, 26], ['novus', 154, 205, 25], ['varus', 145, 195, 26], ['metro', 142, 185, 23]]),
    mkSeedProd('prod-2', 'Чай Greenfield Golden Ceylon чорний 100 пакетиків', 'Продукти', 'Кава та Чай', 'Кава та Чай', 'coffee', 'шт', [['silpo', 129, 175, 26], ['atb', 135, 180, 25], ['novus', 124.90, 169, 26], ['varus', 128, 172, 25], ['metro', 126, 170, 26]]),
    mkSeedProd('prod-3', 'Молоко Яготинське 2.6% пастеризоване 900 г', 'Продукти', 'Молочні та Сири', 'Молочні', 'dairy', 'шт', [['silpo', 38.99, 47.90, 19], ['atb', 36.40, 44.50, 18], ['novus', 39.50, 48, 18], ['varus', 37.90, 46, 18], ['metro', 37, 45, 18]]),
    mkSeedProd('prod-4', 'Сир твердий КОМО Тенеро 50% брус 180 г', 'Продукти', 'Молочні та Сири', 'Молочні', 'dairy', 'шт', [['silpo', 64.99, 89.90, 28], ['atb', 67.50, 91, 26], ['novus', 69.90, 94, 26], ['varus', 66, 89, 26], ['metro', 65.50, 88, 25]]),
    mkSeedProd('prod-5', 'Філе індички охолоджене фермерське 1 кг', 'Продукти', "М'ясо та Риба", "М'ясо та Риба", 'meat', 'кг', [['silpo', 219, 289, 24], ['atb', 215, 279, 23], ['novus', 225, 295, 24], ['varus', 209.90, 275, 24], ['metro', 212, 280, 24]]),
    mkSeedProd('prod-6', 'Лосось слабосолений філе Norven 180 г', 'Продукти', "М'ясо та Риба", "М'ясо та Риба", 'meat', 'шт', [['silpo', 179, 239, 25], ['atb', 169.90, 229, 26], ['novus', 185, 245, 24], ['varus', 174, 230, 24], ['metro', 172, 228, 25]]),
    mkSeedProd('prod-7', 'Шоколад Roshen екстрачорний з цілим ліщиною 85 г', 'Продукти', 'Солодощі', 'Солодощі', 'sweets', 'шт', [['silpo', 34.50, 48, 28], ['atb', 31.90, 45, 29], ['novus', 36, 49, 27], ['varus', 33.50, 47, 29], ['metro', 32.50, 46, 29]]),
    mkSeedProd('prod-8', 'Цукерки Ferrero Rocher хрусткі з горіхом 200 г', 'Продукти', 'Солодощі', 'Солодощі', 'sweets', 'шт', [['silpo', 199, 265, 25], ['atb', 195, 259, 25], ['novus', 189.90, 255, 25], ['varus', 196, 260, 25], ['metro', 192, 258, 26]]),
    mkSeedProd('prod-9', 'Олія соняшникова Чумак рафінована 850 мл', 'Продукти', 'Бакалія', 'Бакалія', 'grocery', 'пляшка', [['silpo', 54.90, 68, 19], ['atb', 49.90, 64, 22], ['novus', 56, 69, 19], ['varus', 52.50, 66, 20], ['metro', 51, 65, 22]]),
    mkSeedProd('prod-10', 'Макарони Barilla Spaghetti n.5 спагеті 500 г', 'Продукти', 'Бакалія', 'Бакалія', 'grocery', 'упак', [['silpo', 59.90, 85, 30], ['atb', 58.50, 82, 29], ['novus', 54.90, 79, 30], ['varus', 61, 86, 29], ['metro', 56, 80, 30]]),
    mkSeedProd('prod-11', 'Вода мінеральна Borjomi природна лікувальна 0.5 л скло', 'Продукти', 'Напої', 'Напої', 'drinks', 'пляшка', [['silpo', 39.90, 52, 23], ['atb', 37.50, 49, 23], ['novus', 41, 54, 24], ['varus', 38.90, 50, 22], ['metro', 38, 49.50, 23]]),
    mkSeedProd('prod-12', 'Сік Sandora Гранатовий 100% преміум 0.95 л', 'Продукти', 'Напої', 'Напої', 'drinks', 'упак', [['silpo', 68, 89, 24], ['atb', 69.50, 91, 24], ['novus', 66.90, 88, 24], ['varus', 67.50, 89, 24], ['metro', 65, 85, 24]]),
    mkSeedProd('prod-13', 'Банани свіжі добірні преміум 1 кг', 'Продукти', 'Овочі та Фрукти', 'Овочі та Фрукти', 'produce', 'кг', [['silpo', 64.99, 79.99, 19], ['atb', 59.90, 74.50, 20], ['novus', 63.50, 78, 19], ['varus', 61.90, 76, 19]]),
    mkSeedProd('prod-14', 'Яблука сорт Симиренка соковиті 1 кг', 'Продукти', 'Овочі та Фрукти', 'Овочі та Фрукти', 'produce', 'кг', [['silpo', 29.90, 39.90, 25], ['atb', 27.50, 36, 24], ['novus', 31, 42, 26], ['metro', 28.90, 38, 24]]),
    mkSeedProd('prod-15', 'Гель для душу Palmolive Натурэль Олива 500 мл', 'Краса та Гігієна', 'Гігієна', 'Гігієна', 'beauty', 'шт', [['eva', 119, 169, 30], ['prostor', 124, 175, 29], ['silpo', 132, 185, 29], ['novus', 129.90, 179, 27]]),
    mkSeedProd('prod-16', 'Шампунь Head & Shoulders Основний догляд 400 мл', 'Краса та Гігієна', 'Волосся', 'Волосся', 'beauty', 'шт', [['eva', 169, 239, 29], ['prostor', 165, 235, 30], ['atb', 172, 245, 30], ['metro', 164.50, 230, 28]]),
    mkSeedProd('prod-17', 'Крем для обличчя Nivea Care зволожувальний 100 мл', 'Краса та Гігієна', 'Догляд за шкірою', 'Догляд за шкірою', 'beauty', 'шт', [['eva', 145, 199, 27], ['prostor', 149, 205, 27], ['silpo', 154, 210, 27]]),
    mkSeedProd('prod-18', 'Бальзам для губ Carmex Classic вишня 10 г', 'Краса та Гігієна', 'Косметика', 'Косметика', 'beauty', 'шт', [['eva', 129, 169, 24], ['prostor', 132, 175, 25], ['avrora', 125, 160, 22]]),
    mkSeedProd('prod-19', 'Капсули для прання Ariel All-in-1 Pods Color 24 шт', 'Дім та Побут', 'Побутова хімія', 'Побутова хімія', 'home', 'упак', [['epicentr', 349, 489, 29], ['eva', 355, 495, 28], ['metro', 339, 479, 29], ['silpo', 369, 519, 29]]),
    mkSeedProd('prod-20', 'Засіб для миття посуду Fairy Соковитий лимон 500 мл', 'Дім та Побут', 'Кухня та Посуд', 'Кухня та Посуд', 'home', 'шт', [['avrora', 69, 95, 27], ['atb', 72.50, 98, 26], ['eva', 71, 96, 26], ['epicentr', 68, 92, 26]]),
    mkSeedProd('prod-21', 'Свічка ароматична WoodWick Ваніль та морська сіль 275 г', 'Дім та Побут', 'Дім та Декор', 'Дім та Декор', 'home', 'шт', [['epicentr', 489, 650, 25], ['prostor', 499, 670, 26]]),
    mkSeedProd('prod-22', 'Корм сухий для котів Purina Pro Plan Sterilised з лососем 1.5 кг', 'Зоотовари', 'Для котів', 'Для котів', 'pets', 'упак', [['silpo', 489, 649, 25], ['metro', 479, 635, 25], ['epicentr', 485, 640, 24]]),
    mkSeedProd('prod-23', 'Ласощі для собак Pedigree DentaStix для середніх порід 7 шт', 'Зоотовари', 'Для собак', 'Для собак', 'pets', 'упак', [['atb', 74.90, 99, 24], ['silpo', 79, 105, 25], ['novus', 76.50, 102, 25], ['avrora', 72, 95, 24]])
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
        const errData = await res.json().catch(() => ({}));
        const err = new Error(errData.error || `HTTP Error: ${res.status}`);
        err.status = res.status;
        err.code = errData.code || 'HTTP_ERROR';
        err.isHttpError = true;
        throw err;
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (!fallbackFn || (err && err.isHttpError && options && options.throwOnHttpError)) {
        throw err;
      }
      // Seamlessly execute offline/network fallback
      return await fallbackFn();
    }
  }

  /* ─── 1. CARDS API (Strictly Per-User Isolated) ──────────────────────────── */
  async function getCards() {
    const user = getCurrentUser();
    const userKey = getUserCardsStorageKey(user);
    if (!user || !user.token || !userKey) {
      return [];
    }

    try {
      const cards = await fetchWithFallback('/cards', {
        method: 'GET',
        throwOnHttpError: true
      }, () => {
        return getStorage(userKey, []);
      });
      const list = Array.isArray(cards) ? cards : [];
      setStorage(userKey, list);
      return list;
    } catch (err) {
      if (err && err.isHttpError && err.status === 401) {
        await logout();
        return [];
      }
      return getStorage(userKey, []);
    }
  }

  async function createCard(cardData) {
    const user = getCurrentUser();
    const userKey = getUserCardsStorageKey(user);
    if (!user || !user.token || !userKey) {
      throw new Error('Будь ласка, увійдіть в акаунт для збереження карток.');
    }

    const res = await fetchWithFallback('/cards', {
      method: 'POST',
      body: JSON.stringify(cardData),
      throwOnHttpError: true
    }, () => {
      const cards = getStorage(userKey, []);
      const newCard = Object.assign({
        id: 'card-' + Date.now(),
        user_id: user.id,
        createdAt: new Date().toISOString()
      }, cardData);
      cards.unshift(newCard);
      setStorage(userKey, cards);
      return newCard;
    });

    const created = res && res.card ? res.card : res;
    if (created && created.id) {
      const cached = getStorage(userKey, []);
      const filtered = cached.filter(c => String(c.id) !== String(created.id));
      filtered.unshift(created);
      setStorage(userKey, filtered);
    }
    return created;
  }

  async function updateCard(id, cardData) {
    const user = getCurrentUser();
    const userKey = getUserCardsStorageKey(user);
    if (!user || !user.token || !userKey) {
      throw new Error('Будь ласка, увійдіть в акаунт для редагування карток.');
    }

    const res = await fetchWithFallback(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cardData),
      throwOnHttpError: true
    }, () => {
      const cards = getStorage(userKey, []);
      const idx = cards.findIndex(c => String(c.id) === String(id));
      if (idx === -1) throw new Error('Картку не знайдено.');
      cards[idx] = Object.assign({}, cards[idx], cardData, {
        updatedAt: new Date().toISOString()
      });
      setStorage(userKey, cards);
      return cards[idx];
    });

    const updated = res && res.card ? res.card : res;
    if (updated && updated.id) {
      const cached = getStorage(userKey, []);
      const idx = cached.findIndex(c => String(c.id) === String(updated.id));
      if (idx !== -1) {
        cached[idx] = updated;
        setStorage(userKey, cached);
      }
    }
    return updated;
  }

  async function deleteCard(id) {
    const user = getCurrentUser();
    const userKey = getUserCardsStorageKey(user);
    if (!user || !user.token || !userKey) {
      throw new Error('Будь ласка, увійдіть в акаунт для видалення карток.');
    }

    const res = await fetchWithFallback(`/cards/${id}`, {
      method: 'DELETE',
      throwOnHttpError: true
    }, () => {
      let cards = getStorage(userKey, []);
      cards = cards.filter(c => String(c.id) !== String(id));
      setStorage(userKey, cards);
      return { success: true, id };
    });

    const cached = getStorage(userKey, []);
    setStorage(userKey, cached.filter(c => String(c.id) !== String(id)));
    return res && res.id ? res : { success: true, id };
  }

  /* ─── Word-Boundary Stem Matching Helper (Memoized RegExp) ───────────────── */
  const WORD_REGEX_CACHE = new Map();

  function hasWord(text = '', ...stemArgs) {
    if (!text) return false;
    const t = String(text).toLowerCase();
    const stems = stemArgs.flat(Infinity);
    for (const s of stems) {
      if (!s) continue;
      const requireExact = s.endsWith(' ');
      const trimmed = s.trim().toLowerCase();
      if (!trimmed) continue;
      const cacheKey = `${requireExact ? 'E:' : 'S:'}${trimmed}`;
      let regex = WORD_REGEX_CACHE.get(cacheKey);
      if (!regex) {
        const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
        regex = requireExact
          ? new RegExp('(?:^|[^а-яіїєґa-z0-9])' + escaped + '(?:[аеєиіїоуюя]|ом|ем|ям|ів|ей|ами|ями|ах|ях)?(?:$|[^а-яіїєґa-z0-9])', 'i')
          : new RegExp('(?:^|[^а-яіїєґa-z0-9])' + escaped, 'i');
        WORD_REGEX_CACHE.set(cacheKey, regex);
      }
      if (regex.test(t)) return true;
    }
    return false;
  }

  function isValidProductPrice(title = '', price = 0, oldPrice = null) {
    const numPrice = Number(price);
    const hasOld = oldPrice !== null && oldPrice !== undefined && oldPrice !== '' && Number(oldPrice) > 0;
    const numOld = hasOld ? Number(oldPrice) : null;

    if (!Number.isFinite(numPrice) || numPrice <= 0) return false;
    if (numOld !== null && (!Number.isFinite(numOld) || numOld <= numPrice)) return false;

    if (numPrice <= 2.50 && (numOld === null || numOld <= 5.00)) {
      return false;
    }

    const titleLower = String(title || '').toLowerCase();
    const alcoholStems = [
      'віскі', 'whisky', 'whiskey', 'glenlivet', 'glenfiddich', 'jameson', 'jack daniels',
      'ром ', 'джин ', 'текіла', 'коньяк', 'бренді', 'горілка', 'лікер', 'вино ', 'ігристе', 'шампанське'
    ];
    if (hasWord(titleLower, alcoholStems) && numPrice < 75.00) {
      return false;
    }

    const isBulkIceCream = /морозиво\s*1\s*кг/i.test(titleLower);
    const coreGroceryStems = [
      'кава ', 'кави ', 'масло ', 'масла ', 'сир ', "м'ясо", 'мясо', 'філе', 'ковбаса', 'лосось'
    ];
    if ((isBulkIceCream || hasWord(titleLower, coreGroceryStems)) && numPrice < 20.00) {
      return false;
    }

    return true;
  }

  /* ─── Category Normalization & Resolution Utility ────────────────────────── */
  const CAT_RULES = {
    humanBlockPet: ['морозиво', 'йогурт', 'сирок ', 'десерт', 'тістечко', 'круасан', 'пончик', 'донат', 'торт', 'рулет', 'вафлі', 'вафл', 'печиво', 'шоколад', 'цукерк', 'згущене молоко', 'згущене', 'варен', 'джем', 'карамель', 'шоколадний', 'пломбір', 'ріжок', 'ескімо'],
    petIndicators: ['для котів', 'для кішок', 'для кошенят', 'для собак', 'для цуценят', 'для гризунів', 'для папуг', 'корм сухий', 'корм вологий', 'стерилізованих', 'ласощі для котів', 'ласощі для собак', 'ласощі для тварин', 'для тварин'],
    petLitter: ['для котів', 'для котячого туалету', 'туалету котів', 'для котячого', 'бентонітовий', 'силікагелевий', 'деревний', 'комкуючий', 'грудкуючий', 'тофу для котів', 'catsan', 'kotix', 'animall', 'supercat'],
    petBrands: ['whiskas', 'віскас', 'felix', 'фелікс', 'purina', 'пуріна', 'gourmet', 'гурме', 'sheba', 'шеба', 'friskies', 'фріскіс', 'optimeal', 'оптіміл', 'клуб 4 лапи', 'club 4 paws', 'pedigree', 'педігрі', 'chappi', 'чаппі', 'brit', 'savory', 'josera'],
    household: ['для прання', 'пральний порошок', 'капсули для прання', 'гель для прання', 'ополіскувач для білизни', 'кондиціонер для білизни', 'відбілювач', 'плямовивідник', 'для миття посуду', 'миття дитячого посуду', 'миття посуду', 'засіб для посуду', 'гель для посуду', 'таблетки для посудомийних', 'сіль для посудомийних', 'для чищення', 'засіб чистячий', 'чистячий', 'для унітазу', 'для труб', 'забруднення труб', 'для підлоги', 'для скла', 'для прибирання', 'освіжувач повітря', 'дифузор', 'антижир', 'антинакип', 'persil', 'ariel', 'tide', 'perwoll', 'lenor', 'silan', 'fairy', 'somat', 'finish', 'domestos', 'breff', 'bref', 'cillit', 'mr. muscle', 'містер мускул', 'утьонок', 'sano', 'frosch', 'гала', 'gala', 'сарма', 'wash&free', 'savex', 'dr.beckmann'],
    paper: ['туалетний папір', 'паперові рушники', 'рушники паперові', 'рушник кухонний', 'серветки косметичні', 'серветки столові', 'серветки паперові', 'носові хустинки', 'zewa', 'рута', 'ruta', 'сніжна панда', 'обухів', 'selpak', 'kleenex'],
    kitchen: ['сковород', 'пательн', 'каструл', 'тарілк', 'чашк', 'склянк', 'келих', 'термос', 'контейнер для їжі', 'фольга', 'фольги', 'плівка харчова', 'харчова плівка', 'пергамент', 'рукав для запікання', 'губк', 'губка кухонна', 'губки для посуду', 'серветка для прибирання', 'серветки для прибирання', 'пакети для сміття', 'мішки для сміття', 'бокс універсальний', 'фрекен бок', 'мельниця', 'luminarc', 'tefal', 'ardesto', 'взуття', 'капці', 'тапочки', 'шкарпетк', 'клей', 'клей-гель', 'батарей', 'пакети майка', 'грілки термохімічні', 'рукавички господарські', 'рукавичкі господарські'],
    hair: ['шампунь', 'бальзам для волосся', 'бальзам-ополіскувач', 'кондиціонер для волосся', 'маска для волосся', 'фарба для волосся', 'лак для волосся', 'спрей для волосся', 'олія для волосся', 'head & shoulders', 'head&shoulders', 'pantene', 'elseve', 'syoss', 'gliss kur', 'schauma', 'tresemme', 'palette', 'fructis'],
    makeup: ['туш для вій', 'помада', 'блиск для губ', 'тіні для повік', 'пудра', 'консилер', 'олівець для брів', 'олівець для очей', 'лак для нігтів', 'парфум', 'туалетна вода', 'парфумована вода', 'хайлайтер', "рум'яна", 'тінт для губ', 'кушон', 'палетка тіней', 'тональний', 'maybelline', 'vivienne sabo', 'bourjois', 'max factor', 'nyx', 'paese', 'it cosmetics', 'charlotte tilbury', 'juliette has a gun', 'kayali', 'nishane', 'rare beauty', 'billie eilish', 'gritti', 'lamel', 'milk touch', 'kylie cosmetics', "a'pieu", 'make up academy', 'xerjoff'],
    hygiene: ['гель для душу', 'крем-гель для душу', 'гель для купання', 'засіб для купання', 'мило рідке', 'мило туалетне', 'крем-мило', 'дезодорант', 'антиперспірант', 'зубна паста', 'зубна щітка', 'ополіскувач для ротової', 'прокладки', 'тампони', 'ватні диски', 'ватні палички', 'вологі серветки', 'серветки вологі', 'пелюшки гігієнічні', 'бритва', 'станок для гоління', 'станки для гоління', 'станків для гоління', 'піна для гоління', 'гель для гоління', 'презерватив', 'підгузки', 'підгузники', 'підгузки-трусики', 'підгузники-трусики', 'old spice', 'rexona', 'dove', 'palmolive', 'fa ', 'colgate', 'sensodyne', 'lacalut', 'oral-b', 'parodontax', 'always', 'kotex', 'libresse', 'discreet', 'bella', 'gillette', 'bic', 'pampers', 'huggies', 'splat', 'biomed', "tesori d'oriente", 'deepfresh', 'bubchen'],
    creamQualifiers: ['для обличчя', 'для рук', 'для тіла', 'для ніг', 'для шкіри', 'для повік', 'навколо очей', 'від зморшок', 'зволожуючий', 'зволожуюча', 'зволожуюче', 'живильний', 'живильна', 'живильне', 'сонцезахисний', 'сонцезахисна', 'spf', 'тональний', 'bb-крем', 'bb крем', 'cc-крем', 'cc крем', 'після гоління', 'для гоління', 'для депіляції', 'дитячий крем'],
    skincare: ['сироватка для обличчя', 'сироватка', 'тонік для обличчя', 'тонік', 'міцелярна', 'пінка для вмивання', 'гель для вмивання', 'скраб для тіла', 'скраб для обличчя', 'скраб', 'маска для обличчя', 'маска-гель', 'патчі', 'лосьйон для тіла', 'лосьйон', 'молочко для тіла', 'бальзам для губ', 'гігієнічна помада', 'пілінг', 'nivea', 'garnier', "l'oreal", 'loreal', 'cerave', 'la roche', 'vichy', 'bioderma', 'eveline', 'ziaja', 'zaja', 'біокон', 'heimish', 'christina', 'babor', 'elemis'],
    foodLock: ['донат', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'штрудель', 'рулет', 'кекс', 'мафін', 'булочка', 'пиріг', 'печиво', 'вафлі', 'вафл', 'пряник', 'зефір', 'мармелад', 'цукерк', 'шоколад', 'батончик', 'халва', 'морозиво', 'десерт', 'крем-мед', 'пастила', 'козинак', 'драже', 'льодяник', 'жувальна гумка', 'джем', 'варення', 'крем-сир', 'крем сир', 'крем-суп', 'вершковий сир', 'сир вершковий', 'плавлений', 'моцарела', 'гауда', 'чеддер', 'пармезан', 'бринза', 'фета', 'сулугуні', 'кисломолочн', 'сирок ', 'сметана', 'йогурт', 'кефір', 'ряжанка', 'айран', 'закваска', 'масло солодковершкове', 'масло селянське', 'масло вершкове', 'масло екстра', 'солодковершкове масло', 'селянське масло', 'вершкове масло', '73%', '72.5%', '82%', '82.5%', 'маргарин', 'спред', 'молоко питне', 'молоко ультрапастеризоване', 'молоко пастеризоване', 'згущене', 'вершки питні', 'вершки кулінарні', 'ковбас', 'сосиск', 'сардельк', 'шинк', 'бекон', 'грудинк', 'балик', 'салямі', 'паштет печінковий', 'паштет м', 'паштет мясний', 'паштет печінк', 'паштет курячий', 'курк', 'куряч', 'індич', 'свинин', 'свиняч', 'яловичин', 'ялович', 'телятин', 'фарш', 'стейк', 'вирізк', 'корейк', 'хамон', 'прошуто', 'крильця', 'гомілк', 'стегно', 'лосос', 'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець', 'скумбрі', 'хек', 'мінтай', 'дорадо', 'лящ', 'палтус', 'креветк', 'мідії', 'ікра', 'крабові', 'буженин', 'реберц', 'хліб ', 'багет', 'лаваш', 'батон', 'тост', 'чіабата', 'макарон', 'спагет', 'локшин', 'пенне', 'фузіллі', 'вермішель', 'крупа', 'гречк', 'рис басматі', 'рис круглозернистий', 'рис довгозернистий', 'рис пропарений', 'рис жасмин', 'вівсян', 'пластівці', 'борошно', 'цукор', 'олія соняшникова', 'соняшникова олія', 'олія оливкова', 'оливкова олія', 'олія кукурудзяна', 'олія рафінована', 'оцет', 'бальзамічний', 'кетчуп', 'майонез', 'гірчиц', 'соус', 'томатна паста', 'паста томатна', 'арахісова паста', 'паста шоколадна', 'nutella', 'нутелла', 'кава', 'еспресо', 'американо', 'капучино', 'лате', 'чай ', 'цикорій', 'матча', 'какао', 'сік ', 'нектар', 'лимонад', 'смузі', 'вода мінеральна', 'вода питна', 'газован', 'енергетик', 'квас', 'пиво', 'вино ', 'вин ', 'сидр', 'чіпси', 'чипси', 'сухарики', 'сухарик', 'горішки', 'фісташки', 'мигдаль', 'фундук', 'яблук', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'ківі', 'авокадо', 'хурма', 'батат', 'гарбуз', 'помело', 'пітахайя', 'кокос', 'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник', 'зелень', 'салат '],
    savoryGrocery: ['приправа', 'перець чорний', 'перець духмяний', 'перець горошок', 'лист лавровий', 'часник сушений', 'паприка', 'чипси', 'чіпси', 'попкорн', 'сухарики', 'грінки', 'брускети', 'крекери', 'вареники', 'пельмені', 'равіолі', 'ньокі', 'хінкалі', 'млинці', 'пампушка', 'хумус', 'оливки', 'маслини', 'ікра кабачкова', 'ікра баклажанна', 'готові сніданки', 'сніданок готовий', 'каша ', 'пюре ', 'піца', 'тісто ', 'борошно', 'макарон', 'спагет', 'крупа', 'булгур', 'кукурудза цукрова', 'кукурудза ', 'горошок ', 'олія ', 'майонез', 'кетчуп'],
    sweets: ['донат', 'донатс', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'кекс', 'мафін', 'рулет', 'штрудель', 'сирник', 'пампухи зі згущ', 'булочка з корицею', 'вафельний лист', 'з фундуком та какао', 'горіхово-шоколадна', 'бат рис', 'печиво', 'вафлі', 'вафл', 'пряник', 'зефір', 'мармелад', 'пастила', 'цукерк', 'шоколад', 'батончик', 'халва', 'козинак', 'драже', 'льодяник', 'жувальна гумка', 'морозиво', 'десерт', 'мед ', 'крем-мед', 'джем', 'варення', 'згущене молоко', 'згущене', 'паста шоколадна', 'nutella', 'нутелла', 'barni', 'барні', 'рошен', 'roshen', 'milka', 'мілка', 'ferrero', 'kinder', 'кіндер', 'raffaello', 'рафаелло', 'конті', 'konti', 'авк', 'avk', 'ярич'],
    dairy: ['молоко', 'масло солодковершкове', 'масло вершкове', 'масло селянське', 'масло екстра', 'солодковершкове масло', 'вершкове масло', 'селянське масло', 'маргарин', 'спред', 'сир ', 'крем-сир', 'крем сир', 'сирок ', 'моцарела', 'гауда', 'пармезан', 'чеддер', 'сулугуні', 'бринза', 'фета', 'сметана', 'вершки', 'йогурт', 'кефір', 'ряжанка', 'айран', 'закваска', 'плавлений', 'творог', 'кисломолочн', 'комо', 'яготинськ', 'ферма', 'активіа', 'актимель', 'данон', 'danone', 'президент', 'president', 'mlekovita', 'spomlek', 'простонаше', 'камамбер', 'брі '],
    meatFish: ["м'яс", 'мяс', 'курк', 'куряч', 'індич', 'свинин', 'свиняч', 'яловичин', 'ялович', 'телятин', 'качк', 'гуск', 'фарш', 'стейк', 'вирізк', 'корейк', 'хамон', 'прошуто', 'філе', 'крильця', 'гомілк', 'стегно', 'ковбас', 'сосиск', 'сардельк', 'шинк', 'бекон', 'балик', 'салямі', 'паштет', 'буженин', 'реберц', 'риба', 'лосос', 'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець', 'скумбрі', 'хек', 'мінтай', 'дорадо', 'лящ', 'палтус', 'судак', 'сібас', 'сибас', 'короп', 'креветк', 'мідії', 'кальмар', 'ікра', 'крабові', 'наша ряба', 'ранчо', 'бащинський', 'глобино', "м'ясна гільдія", 'алан', 'водний світ', 'санта бремор'],
    coffeeTea: ['кава', 'кавові', 'еспресо', 'капучино', 'лате', 'американо', 'чай ', 'цикорій', 'матча', 'какао', 'гарячий шоколад', 'дріп', 'jacobs', 'lavazza', 'greenfield', 'tess', 'curtis', 'lovare', 'ліптон', 'lipton', 'paulig', 'чорна карта', 'жокей', 'idealist'],
    drinks: ['вода', 'сік ', 'сок', 'нектар', 'морс', 'лимонад', 'смузі', 'напій', 'кола', 'pepsi', 'coca-cola', 'fanta', 'sprite', 'schweppes', 'комбуча', 'квас', 'енергетик', 'red bull', 'monster', 'пиво', 'вино ', 'вин ', 'lambrusc', 'sauvign', 'chardonnay', 'шампанське', 'ігристе', 'сидр', 'моршинськ', 'боржомі', 'borjomi', 'поляна квасова', 'садочок', 'sandora', 'rich', 'наш сік', 'віскі', 'горілка', 'коньяк', 'ром ', 'лікер', 'вермут', 'джин ', 'бренді', 'текіл', 'настоянк', 'аперитив', 'бітер', 'ромов'],
    notFreshProduce: ['томатна паста', 'паста томатна', 'кетчуп', 'соус', 'чипс', 'чіпс', 'сухарик', 'сушен', 'приправ', 'спеці', 'маринован', 'консерв', 'пюре', 'квашен'],
    produce: ['яблук', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'ківі', 'авокадо', 'хурма', 'батат', 'гарбуз', 'помело', 'пітахайя', 'кокос', 'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник', 'зелень', 'салат ', 'айсберг', 'рукола', 'шпинат', 'кабачок', 'баклажан', 'буряк', 'редис', 'печериц', 'гриб', 'ягоди', 'полуниц', 'малин', 'лохина', 'чорниц', 'кавун', 'диня', 'гранат', 'груш', 'слив', 'персик', 'нектарин', 'броколі', 'чері']
  };

  const HOMOGLYPH_MAP = { a: 'а', e: 'е', i: 'і', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х' };
  function normalizeHomoglyphs(str = '') {
    return String(str || '').replace(/\S+/g, w => (/[а-яіїєґА-ЯІЇЄҐ]/.test(w) && /[a-zA-Z]/.test(w) ? w.replace(/[aeiopcykmthbABCEHIKMOPTX]/g, ch => HOMOGLYPH_MAP[ch] || ch) : w));
  }

  function resolveCategories(p) {
    const rawMain = (p.mainCategory || p.main_category || '').trim();
    const rawSub = (p.subCategory || p.sub_category || '').trim();
    const rawCat = normalizeHomoglyphs(p.category || '').trim();
    const title = normalizeHomoglyphs(p.title || p.name || '').trim();
    const store = (p.store || (p.prices && p.prices[0] ? p.prices[0].store : '') || '').toLowerCase().trim();
    const isBeautyStore = ['eva', 'prostor'].includes(store);
    const text = (title + ' ' + rawCat).toLowerCase();
    const isHumanFoodBlockingPet = hasWord(text, CAT_RULES.humanBlockPet);

    if (rawMain && rawSub && !(rawMain === 'Зоотовари' && isHumanFoodBlockingPet)) {
      return { mainCategory: rawMain, subCategory: rawSub, category: rawSub };
    }

    const catObj = (main, sub) => ({ mainCategory: main, subCategory: sub, category: sub });
    const isPetLitter = hasWord(text, ['наповнювач']) && hasWord(text, CAT_RULES.petLitter);
    if (!isHumanFoodBlockingPet && (rawCat === 'Зоотовари' || rawCat === 'Для котів' || rawCat === 'Для собак' || hasWord(text, CAT_RULES.petIndicators, CAT_RULES.petBrands) || isPetLitter || (hasWord(text, ['корм ']) && !hasWord(text, ['кормчий'])))) {
      if (rawCat === 'Для котів' || isPetLitter || hasWord(text, ['кіш', 'кіт', 'кот', 'кошен', 'котяч', 'whiskas', 'віскас', 'felix', 'фелікс', 'gourmet', 'гурме', 'sheba', 'шеба'])) return catObj('Зоотовари', 'Для котів');
      if (rawCat === 'Для собак' || hasWord(text, ['собак', 'пес', 'пса', 'цуцен', 'педігрі', 'pedigree', 'chappi', 'чаппі'])) return catObj('Зоотовари', 'Для собак');
      return catObj('Зоотовари', 'Усі зоотовари');
    }

    const isExplicitNonFood = hasWord(text, CAT_RULES.household, CAT_RULES.paper, CAT_RULES.kitchen, CAT_RULES.hair, CAT_RULES.hygiene, ['маска-гель', 'маска для обличчя', 'патчі', 'тональний', 'paese']);
    const isExplicitFood = !isExplicitNonFood && hasWord(text, CAT_RULES.foodLock) && !isBeautyStore;
    const isLaundryOrHome = hasWord(text, ['для прання', 'для білизни', 'кондиціонер для прання', 'посудомийних', 'для унітазу', 'для миття посуду']);
    const isCosmeticBrandGuard = !isLaundryOrHome && hasWord(text, ['тональний', 'макіяж', 'пудра', "рум'яна", 'консилер', 'хайлайтер', 'блиск для губ', 'помада', 'paese', 'maybelline', 'vivienne sabo', 'bourjois', 'max factor', 'lamel', 'it cosmetics', 'kylie cosmetics', 'парфуми', 'туалетна вода', 'парфумована вода']);

    if (!isExplicitFood) {
      if (!isCosmeticBrandGuard && (rawCat === 'Побутова хімія' || hasWord(text, CAT_RULES.household))) return catObj('Дім та Побут', 'Побутова хімія');
      if (rawCat === 'Паперова продукція' || hasWord(text, CAT_RULES.paper)) return catObj('Дім та Побут', 'Паперова продукція');
      if (rawCat === 'Кухня та Посуд' || hasWord(text, CAT_RULES.kitchen)) return catObj('Дім та Побут', 'Кухня та Посуд');

      const isCosmeticCream = hasWord(text, ['крем']) && !hasWord(text, ['гель для душу', 'мило']) && (hasWord(text, CAT_RULES.creamQualifiers) || isBeautyStore);
      if (rawCat === 'Волосся' || rawCat === 'Догляд за волоссям' || hasWord(text, CAT_RULES.hair)) return catObj('Краса та Гігієна', 'Волосся');
      if (rawCat === 'Косметика' || hasWord(text, CAT_RULES.makeup)) return catObj('Краса та Гігієна', 'Косметика');
      if (rawCat === 'Гігієна' || rawCat === 'Особиста гігієна' || hasWord(text, CAT_RULES.hygiene)) return catObj('Краса та Гігієна', 'Гігієна');
      if (rawCat === 'Догляд за шкірою' || isCosmeticCream || hasWord(text, CAT_RULES.skincare)) return catObj('Краса та Гігієна', 'Догляд за шкірою');
      if (isBeautyStore || rawCat === 'Краса та Гігієна') return catObj('Краса та Гігієна', 'Гігієна');
    }

    if (rawCat === 'Бакалія' || hasWord(text, CAT_RULES.savoryGrocery)) return catObj('Продукти', 'Бакалія');
    const startsAsCheese = /^\s*(?:крем[- ])?сир\b/i.test(title);
    if (!startsAsCheese && (rawCat === "М'ясо та Риба" || hasWord(text, CAT_RULES.meatFish))) return catObj('Продукти', "М'ясо та Риба");
    const isCandyOrConfection = hasWord(text, ['цукерк', 'шоколад', 'батончик', 'торт', 'тістечко', 'праліне']);
    const isAlcoholDrink = !isCandyOrConfection && hasWord(text, ['настоянк', 'вермут', 'віскі', 'горілка', 'лікер', 'вино ', 'вин ', 'ігристе', 'шампанське', 'пиво', 'ром ', 'бренді', 'джин ', 'текіл']);
    if (!isAlcoholDrink && (rawCat === 'Солодощі' || hasWord(text, CAT_RULES.sweets))) return catObj('Продукти', 'Солодощі');
    const isDairyButter = hasWord(text, ['масло']) && hasWord(text, ['солодковершков', 'вершков', 'селянськ', 'екстра', 'кисловершков']);
    if (rawCat === 'Молочні та Сири' || isDairyButter || hasWord(text, CAT_RULES.dairy)) return catObj('Продукти', 'Молочні та Сири');
    if (rawCat === 'Кава та Чай' || hasWord(text, CAT_RULES.coffeeTea)) return catObj('Продукти', 'Кава та Чай');
    if (rawCat === 'Напої' || hasWord(text, CAT_RULES.drinks)) return catObj('Продукти', 'Напої');
    const isNotProduce = hasWord(text, CAT_RULES.notFreshProduce) || (hasWord(text, 'томат') && hasWord(text, 'паста'));
    if (!isNotProduce && (rawCat === 'Овочі та Фрукти' || hasWord(text, CAT_RULES.produce))) return catObj('Продукти', 'Овочі та Фрукти');
    return catObj('Продукти', 'Бакалія');
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
    const title = (p.title || p.name || '').trim();
    // Filter prices to only those active in the chosen city and passing price sanity checks
    prices = prices.filter(pr =>
      pr && pr.store && typeof pr.price === 'number' && !isNaN(pr.price) && pr.price > 0
      && cityConfig.activeStores.includes(String(pr.store).toLowerCase())
      && isValidProductPrice(title, pr.price, pr.oldPrice || pr.old_price)
    );
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

  function isStaffDomainEmail(email) {
    return String(email || '').trim().toLowerCase().endsWith('@aurelia.ua');
  }

  function assertOfflineAdminWritePermission() {
    const user = getCurrentUser();
    if (!user || !isStaffDomainEmail(user.email)) {
      throw new Error('Доступ лише для авторизованого персоналу @aurelia.ua.');
    }
    if (user.role === 'QA') {
      throw new Error('Режим QA (тільки перегляд): редагування та видалення заборонено');
    }
    if (user.role !== 'ADMIN') {
      throw new Error('Недостатньо прав для зміни каталогу.');
    }
  }

  async function createProduct(prodData) {
    const res = await fetchWithFallback('/products', {
      method: 'POST',
      body: JSON.stringify(prodData),
      throwOnHttpError: true
    }, () => {
      assertOfflineAdminWritePermission();
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
      body: JSON.stringify(prodData),
      throwOnHttpError: true
    }, () => {
      assertOfflineAdminWritePermission();
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
      method: 'DELETE',
      throwOnHttpError: true
    }, () => {
      assertOfflineAdminWritePermission();
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
      const auth = getStorage(STORAGE_KEYS.AUTH, null);
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      if (auth && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }

      const res = await fetch(`${API_BASE}/products/sync?city=${encodeURIComponent(city)}`, {
        method: 'POST',
        cache: 'no-store',
        headers,
        body: JSON.stringify({ city })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const httpErr = new Error(errData.error || `Sync HTTP Error: ${res.status}`);
        httpErr.status = res.status;
        httpErr.code = errData.code || 'HTTP_ERROR';
        httpErr.isHttpError = true;
        throw httpErr;
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
      if (err && (err.status === 401 || err.status === 403 || err.isHttpError)) {
        throw err;
      }
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

  /* ─── 3. BASKET & HEARTBEAT API ────────────────────────────────────────── */
  const LEGACY_SEED_BASKET_IDS = new Set(['prod-1', 'prod-3', 'prod-4']);

  async function getBasket() {
    const raw = getStorage(STORAGE_KEYS.BASKET, []);
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const catalog = getStorage(STORAGE_KEYS.PRODUCTS, []);
    if (Array.isArray(catalog) && catalog.length > 0) {
      const cleaned = raw.filter(item => {
        if (!item || item.productId === undefined || item.productId === null) return false;
        const pid = String(item.productId);
        if (LEGACY_SEED_BASKET_IDS.has(pid) && !item.title && !catalog.some(p => String(p.id) === pid)) {
          return false;
        }
        return Number(item.qty) > 0;
      });
      if (cleaned.length !== raw.length) {
        setStorage(STORAGE_KEYS.BASKET, cleaned);
      }
      return cleaned;
    }
    return raw.filter(item => item && Number(item.qty) > 0);
  }

  async function toggleBasketItem(productId, qty, meta) {
    const basket = await getBasket();
    const pid = String(productId);
    let itemTitle = (meta && meta.title) || '';
    let itemUnit = (meta && meta.unit) || '';

    if (!itemTitle && qty > 0) {
      const catalog = getStorage(STORAGE_KEYS.PRODUCTS, []);
      const matchedProd = Array.isArray(catalog)
        ? catalog.find(p => String(p.id) === pid)
        : null;
      itemTitle = (matchedProd && (matchedProd.title || matchedProd.name)) || '';
      if (!itemUnit) itemUnit = (matchedProd && matchedProd.unit) || '';
    }

    const idx = basket.findIndex(item =>
      String(item.productId) === pid ||
      (itemTitle && item.title && String(item.title).trim().toLowerCase() === String(itemTitle).trim().toLowerCase())
    );

    if (idx > -1) {
      if (qty <= 0) {
        basket.splice(idx, 1);
      } else {
        basket[idx].productId = productId;
        basket[idx].qty = qty;
        if (itemTitle) basket[idx].title = itemTitle;
        if (itemUnit) basket[idx].unit = itemUnit;
      }
    } else if (qty > 0) {
      basket.push({
        productId,
        qty,
        ...(itemTitle ? { title: itemTitle } : {}),
        ...(itemUnit ? { unit: itemUnit } : {})
      });
    }

    setStorage(STORAGE_KEYS.BASKET, basket);
    try {
      localStorage.setItem('@aurelia_basket', JSON.stringify(basket));
    } catch (_) {}
    sendHeartbeat().catch(() => {});
    return basket;
  }

  async function clearBasket() {
    setStorage(STORAGE_KEYS.BASKET, []);
    try {
      localStorage.removeItem('@aurelia_basket');
    } catch (_) {}
    sendHeartbeat().catch(() => {});
    return [];
  }

  async function sendHeartbeat() {
    const current = getCurrentUser();
    if (!current || !current.token) return null;

    const basket = await getBasket();
    const lastClearedAckAt = localStorage.getItem(BASKET_CLEARED_ACK_KEY) || null;

    try {
      const res = await fetchWithFallback('/auth/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ basket, lastClearedAckAt }),
        throwOnHttpError: true
      });

      if (res && res.basketClearedAt) {
        const serverClearedMs = new Date(res.basketClearedAt).getTime();
        const clientAckMs = lastClearedAckAt ? new Date(lastClearedAckAt).getTime() : 0;
        if (serverClearedMs > 0 && (!clientAckMs || isNaN(clientAckMs) || serverClearedMs > clientAckMs)) {
          setStorage(STORAGE_KEYS.BASKET, []);
          try {
            localStorage.removeItem('@aurelia_basket');
            localStorage.setItem(BASKET_CLEARED_ACK_KEY, res.basketClearedAt);
          } catch (_) {}
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('aurelia:basket-cleared', {
              detail: { basketClearedAt: res.basketClearedAt }
            }));
          }
        }
      }
      return res;
    } catch (_) {
      return null;
    }
  }

  /* ─── 4. AUTH API ────────────────────────────────────────────────────────── */
  function resolveOfflineStaffAccount(identifier, password, requirePasswordMatch = true) {
    const cleanId = String(identifier || '').trim().toLowerCase();
    const staffList = [
      { id: 'staff_bleki', name: 'bleki', email: 'bleki@aurelia.ua', role: 'ADMIN', pass: 'Bleki123!' },
      { id: 'staff_qa1', name: 'Qa1', email: 'qa1@aurelia.ua', role: 'QA', pass: 'Qa1123!' },
      { id: 'staff_qa2', name: 'Qa2', email: 'qa2@aurelia.ua', role: 'QA', pass: 'Qa2123!' }
    ];
    const match = staffList.find(s => s.email === cleanId || s.name.toLowerCase() === cleanId);
    if (!match) return null;
    if (requirePasswordMatch && match.pass !== password) {
      throw new Error('Невірний логін або пароль.');
    }
    return {
      id: match.id,
      name: match.name,
      email: match.email,
      role: match.role,
      is_verified: true,
      token: 'mock-jwt-token-' + Date.now()
    };
  }

  function postAuthEndpoint(endpoint, payload, fallbackFn) {
    return fetchWithFallback(endpoint, {
      method: 'POST',
      timeout: AUTH_REQUEST_TIMEOUT,
      body: JSON.stringify(payload),
      throwOnHttpError: true
    }, fallbackFn);
  }

  function persistAuthResponse(res) {
    if (res && res.requiresVerification) {
      return res;
    }
    const userObj = res && res.user
      ? Object.assign({}, res.user, { token: res.token })
      : res;

    if (userObj && (userObj.token || userObj.email)) {
      setStorage(STORAGE_KEYS.AUTH, userObj);
    }
    return userObj;
  }

  async function login(identifier, password) {
    const cleanId = String(identifier || '').trim();
    const lowerId = cleanId.toLowerCase();
    const res = await postAuthEndpoint('/auth/login', { identifier: cleanId, email: lowerId, password }, () => {
      if (!cleanId || !password) throw new Error('Вкажіть email або ім’я користувача та пароль.');
      const staffUser = resolveOfflineStaffAccount(cleanId, password, true);
      if (staffUser) {
        setStorage(STORAGE_KEYS.AUTH, staffUser);
        return { user: staffUser, token: staffUser.token };
      }
      if (isStaffDomainEmail(lowerId)) {
        throw new Error('Невірний логін або пароль.');
      }
      const fallbackEmail = lowerId.includes('@') ? lowerId : `${lowerId.replace(/[^a-z0-9._-]/gi, '') || 'user'}@aurelia.local`;
      const user = {
        id: 'local_' + fallbackEmail.replace(/[^a-z0-9]/gi, '_'),
        name: cleanId.includes('@') ? cleanId.split('@')[0] : cleanId,
        email: fallbackEmail,
        role: 'USER',
        is_verified: true,
        token: 'mock-jwt-token-' + Date.now()
      };
      setStorage(STORAGE_KEYS.AUTH, user);
      return { user, token: user.token };
    });

    return persistAuthResponse(res);
  }

  async function register(name, email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];
    const res = await postAuthEndpoint('/auth/register', { name: cleanName, email: cleanEmail, password }, () => {
      if (!cleanEmail || !password) throw new Error('Заповніть усі обов’язкові поля.');
      if (password.length < 6) throw new Error('Пароль повинен містити щонайменше 6 символів.');
      if (isStaffDomainEmail(cleanEmail)) {
        throw new Error('Реєстрація з доменом @aurelia.ua заборонена.');
      }
      if (['bleki', 'qa1', 'qa2'].includes(cleanName.toLowerCase())) {
        throw new Error('Це ім’я користувача зарезервоване.');
      }
      const devCode = '123456';
      return {
        requiresVerification: true,
        email: cleanEmail,
        name: cleanName,
        message: 'Код підтвердження надіслано на ваш Email',
        devCode
      };
    });

    return persistAuthResponse(res);
  }

  async function verifyEmail(email, code) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const res = await postAuthEndpoint('/auth/verify-email', { email: cleanEmail, code: cleanCode }, () => {
      if (!cleanEmail || !/^\d{6}$/.test(cleanCode)) {
        throw new Error('Вкажіть коректний 6-значний код підтвердження.');
      }
      if (isStaffDomainEmail(cleanEmail)) {
        throw new Error('Підтвердження персоналу @aurelia.ua виконується адміністратором.');
      }
      const user = {
        id: 'local_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'USER',
        is_verified: true,
        token: 'mock-jwt-token-' + Date.now()
      };
      setStorage(STORAGE_KEYS.AUTH, user);
      return { user, token: user.token };
    });

    return persistAuthResponse(res);
  }

  async function resendVerification(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    return postAuthEndpoint('/auth/resend-verification', { email: cleanEmail }, () => ({
      requiresVerification: true,
      email: cleanEmail,
      message: 'Новий 6-значний код підтвердження надіслано на ваш Email',
      devCode: '123456'
    }));
  }

  async function forgotPassword(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    return postAuthEndpoint('/auth/forgot-password', { email: cleanEmail }, () => ({
      success: true,
      email: cleanEmail,
      message: 'Код для відновлення пароля надіслано на Email',
      devCode: '123456'
    }));
  }

  async function resetPassword(email, code, newPassword) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const res = await postAuthEndpoint('/auth/reset-password', { email: cleanEmail, code: cleanCode, newPassword }, () => {
      if (!cleanEmail || !/^\d{6}$/.test(cleanCode)) {
        throw new Error('Вкажіть коректний 6-значний код.');
      }
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Новий пароль повинен містити щонайменше 6 символів.');
      }
      const staffUser = resolveOfflineStaffAccount(cleanEmail, newPassword, false);
      const user = staffUser || {
        id: 'local_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'USER',
        is_verified: true,
        token: 'mock-jwt-token-' + Date.now()
      };
      setStorage(STORAGE_KEYS.AUTH, user);
      return { user, token: user.token };
    });

    return persistAuthResponse(res);
  }

  async function getMe() {
    const current = getCurrentUser();
    if (!current || !current.token) return null;
    try {
      const res = await fetchWithFallback('/auth/me', {
        method: 'GET',
        throwOnHttpError: true
      });
      if (res && res.user) {
        const updated = Object.assign({}, res.user, { token: current.token });
        setStorage(STORAGE_KEYS.AUTH, updated);
        return updated;
      }
      return current;
    } catch (err) {
      if (err && err.isHttpError && err.status === 401) {
        await logout();
        return null;
      }
      return current;
    }
  }

  async function logout() {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      localStorage.removeItem(STORAGE_KEYS.CARDS);
      localStorage.removeItem(ADMIN_RETURN_TOKEN_KEY);
    } catch (_) {}
    return { success: true };
  }

  function getCurrentUser() {
    return getStorage(STORAGE_KEYS.AUTH, null);
  }

  /* ─── 5. ADMIN CUSTOMER MANAGEMENT & IMPERSONATION API ───────────────────── */
  async function getAdminUsers() {
    const res = await fetchWithFallback('/admin/users', {
      method: 'GET',
      throwOnHttpError: true
    });
    return Array.isArray(res) ? res : (Array.isArray(res?.users) ? res.users : []);
  }

  async function updateAdminUser(userId, payload) {
    return fetchWithFallback(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      throwOnHttpError: true
    });
  }

  async function deleteAdminUserCard(userId, cardId) {
    return fetchWithFallback(`/admin/users/${encodeURIComponent(userId)}/cards/${encodeURIComponent(cardId)}`, {
      method: 'DELETE',
      throwOnHttpError: true
    });
  }

  async function clearAdminUserBasket(userId) {
    return fetchWithFallback(`/admin/users/${encodeURIComponent(userId)}/clear-basket`, {
      method: 'POST',
      throwOnHttpError: true
    });
  }

  async function impersonateUser(userId) {
    const currentAdmin = getCurrentUser();
    const res = await fetchWithFallback(`/admin/users/${encodeURIComponent(userId)}/impersonate`, {
      method: 'POST',
      timeout: AUTH_REQUEST_TIMEOUT,
      throwOnHttpError: true
    });

    if (!res || !res.token || !res.user) {
      throw new Error('Сервер не повернув токен імперсонації.');
    }

    try {
      if (!localStorage.getItem(ADMIN_RETURN_TOKEN_KEY) && currentAdmin && currentAdmin.token) {
        localStorage.setItem(ADMIN_RETURN_TOKEN_KEY, JSON.stringify(currentAdmin));
      }
    } catch (_) {}

    const impersonatedSession = Object.assign({}, res.user, {
      token: res.token,
      impersonatedBy: currentAdmin?.name || 'bleki'
    });
    setStorage(STORAGE_KEYS.AUTH, impersonatedSession);
    return impersonatedSession;
  }

  function getAdminReturnSession() {
    try {
      const raw = localStorage.getItem(ADMIN_RETURN_TOKEN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && parsed.token) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function returnFromImpersonation() {
    const adminSession = getAdminReturnSession();
    try {
      localStorage.removeItem(ADMIN_RETURN_TOKEN_KEY);
    } catch (_) {}
    if (adminSession) {
      setStorage(STORAGE_KEYS.AUTH, adminSession);
      return { restored: true, user: adminSession };
    }
    return { restored: false, user: null };
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
    // Basket & Activity Sync
    getBasket,
    toggleBasketItem,
    clearBasket,
    sendHeartbeat,
    // Admin Customer Management
    getAdminUsers,
    updateAdminUser,
    deleteAdminUserCard,
    clearAdminUserBasket,
    impersonateUser,
    getAdminReturnSession,
    returnFromImpersonation,
    // Auth
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    getMe,
    logout,
    getCurrentUser,
    // Store Personalization & Taxonomy
    CATEGORY_META,
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
