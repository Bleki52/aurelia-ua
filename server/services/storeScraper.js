/**
 * ============================================================================
 * AURELIA UA — Multi-Source Supermarket Scraper & Smart Matcher
 * Real-time promotional items directly from verified Ukrainian supermarket sources:
 * - СІЛЬПО: sf-ecom-api.silpo.ua (e-commerce REST API)
 * - NOVUS: stores-api.zakaz.ua (482010105 SkyMall, 48201029 Кільцева)
 * - METRO: stores-api.zakaz.ua (48215611 Теремки, 48215610 Позняки)
 * - АШАН: stores-api.zakaz.ua (48246401 Почайна, 48246407 Біличі)
 * - ЕПІЦЕНТР FOOD: stores-api.zakaz.ua (482374007 Полярна)
 * - ТРАШ! (Thrash!): thrash.ua/graphql (Apollo GraphQL promotions)
 * - АВРОРА: avrora.ua (HTML / CS-Cart promotional parser)
 * - РУКАВИЧКА: market.rukavychka.ua/specials/ (HTML OpenCart parser)
 * - Regional & protected chains: ATB, VARUS, Velmart, Simi, Blyzenko, Taistra, Arsen, EVA, Prostor, Epicentr
 *
 * STRICT HONESTY & INTEGRITY RULES:
 * - ZERO simulated fallback generators, Math.random() offsets, or multipliers.
 * - Every price originates exclusively from real HTTP response data.
 * - Zakaz.ua prices are in kopiyky (cents) -> strictly divided by 100.
 * - Every price entry includes { store, price, oldPrice, sourceUrl }.
 * - HARD STORE-URL ISOLATION: A price row's store MUST match its sourceUrl domain.
 * - STRICT MATCHING: No fuzzy unbranded merging. Matches require exact EAN or
 *   exact same brand + weight/volume + fat% + core product nouns.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getCityConfig, DEFAULT_CITY } = require('../config/cities');
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
} catch (_) {
  try {
    puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer-core'));
  } catch (_) {}
}

const REQUEST_TIMEOUT = 7000; // ms per request

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7'
};

/* ─── 26 Supported Ukrainian Supermarket Chains ─────────────────────────── */
const ALL_18_STORES = [
  { store: 'silpo', name: 'Сільпо', defaultDomain: 'silpo.ua' },
  { store: 'atb', name: 'АТБ-Маркет', defaultDomain: 'atbmarket.com' },
  { store: 'novus', name: 'NOVUS', defaultDomain: 'novus.zakaz.ua' },
  { store: 'metro', name: 'METRO', defaultDomain: 'metro.zakaz.ua' },
  { store: 'varus', name: 'VARUS', defaultDomain: 'varus.ua' },
  { store: 'auchan', name: 'АШАН', defaultDomain: 'auchan.zakaz.ua' },
  { store: 'epicentrk_food', name: 'Епіцентр Food', defaultDomain: 'epicentrfood.zakaz.ua' },
  { store: 'velmart', name: 'Велмарт', defaultDomain: 'velmart.ua' },
  { store: 'fora', name: 'Фора', defaultDomain: 'fora.ua' },
  { store: 'eko', name: 'ЕКО-Маркет', defaultDomain: 'eko.zakaz.ua' },
  { store: 'ultramarket', name: 'Ультрамаркет', defaultDomain: 'ultramarket.zakaz.ua' },
  { store: 'megamarket', name: 'МегаМаркет', defaultDomain: 'megamarket.zakaz.ua' },
  { store: 'thrash', name: 'Траш!', defaultDomain: 'thrash.ua' },
  { store: 'simi', name: 'Сімі', defaultDomain: 'simi.ua' },
  { store: 'blyzenko', name: 'Близенько', defaultDomain: 'blyzenko.ua' },
  { store: 'taistra', name: 'Тайстра', defaultDomain: 'taistra.com.ua' },
  { store: 'arsen', name: 'Арсен', defaultDomain: 'arsen.ua' },
  { store: 'rukavychka', name: 'Рукавичка', defaultDomain: 'market.rukavychka.ua' },
  { store: 'torba', name: 'Торба', defaultDomain: 'torba.zakaz.ua' },
  { store: 'sviy_market', name: 'Свій Маркет', defaultDomain: 'sviymarket.com' },
  { store: 'nash_kray', name: 'Наш Край', defaultDomain: 'nashkraj.ua' },
  { store: 'spar', name: 'SPAR', defaultDomain: 'spar.ua' },
  { store: 'eva', name: 'EVA', defaultDomain: 'eva.ua' },
  { store: 'prostor', name: 'Prostor', defaultDomain: 'prostor.ua' },
  { store: 'avrora', name: 'Аврора', defaultDomain: 'avrora.ua' },
  { store: 'epicentr', name: 'Епіцентр', defaultDomain: 'epicentrk.ua' }
];

/* ─── Mixed Cyrillic/Latin Homoglyph Normalizer (ATB / HTML Titles) ─────── */
const HOMOGLYPH_MAP = {
  a: 'а', e: 'е', i: 'і', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х'
};

function normalizeHomoglyphs(str = '') {
  return String(str || '').replace(/\S+/g, word => {
    if (/[а-яіїєґА-ЯІЇЄҐ]/.test(word) && /[a-zA-Z]/.test(word)) {
      return word.replace(/[aeiopcykmthbABCEHIKMOPTX]/g, ch => HOMOGLYPH_MAP[ch] || ch);
    }
    return word;
  });
}

/* ─── URL and Store Identity Enforcement ─────────────────────────────────── */
function isStoreUrlConsistent(store, url) {
  if (!url) return false;
  const s = String(store || '').toLowerCase().trim();
  const u = String(url || '').toLowerCase().trim();

  if (s === 'novus') return u.includes('novus.zakaz.ua');
  if (s === 'metro') return u.includes('metro.zakaz.ua');
  if (s === 'varus') return u.includes('varus.zakaz.ua') || u.includes('varus.ua');
  if (s === 'auchan') return u.includes('auchan.zakaz.ua') || u.includes('auchan.ua');
  if (s === 'silpo') return u.includes('silpo.ua');
  if (s === 'atb') return u.includes('atbmarket.com');
  if (s === 'epicentrk_food') return u.includes('epicentrfood.zakaz.ua') || u.includes('epicentrk.ua');
  if (s === 'fora') return u.includes('fora.ua');
  if (s === 'eko') return u.includes('eko.zakaz.ua') || u.includes('ekomarket.ua');
  if (s === 'ultramarket') return u.includes('ultramarket.zakaz.ua') || u.includes('ultramarket.ua');
  if (s === 'megamarket') return u.includes('megamarket.zakaz.ua') || u.includes('megamarket.ua');
  if (s === 'thrash') return u.includes('thrash.ua');
  if (s === 'avrora') return u.includes('avrora.ua');
  if (s === 'rukavychka') return u.includes('market.rukavychka.ua') || u.includes('rukavychka.ua');
  if (s === 'prostor') return u.includes('prostor.ua');
  if (s === 'simi') return u.includes('simi.ua') || u.includes('sim23.ua');
  if (s === 'blyzenko') return u.includes('blyzenko.ua');
  if (s === 'velmart') return u.includes('velmart.ua');
  if (s === 'eva') return u.includes('eva.ua');
  if (s === 'taistra') return u.includes('taistra.com.ua');
  if (s === 'arsen') return u.includes('arsen.ua');
  if (s === 'torba') return u.includes('torba.zakaz.ua') || u.includes('torba.ua');
  if (s === 'sviy_market') return u.includes('sviymarket.com');
  if (s === 'nash_kray') return u.includes('nashkraj.ua');
  if (s === 'spar') return u.includes('spar.ua');
  if (s === 'epicentr') return u.includes('epicentrk.ua');

  return false;
}

function resolveStoreIdentity(url, expectedStoreKey) {
  const u = String(url || '').toLowerCase().trim();
  let detectedKey = null;
  let detectedName = null;

  if (u.includes('novus.zakaz.ua')) {
    detectedKey = 'novus';
    detectedName = 'NOVUS';
  } else if (u.includes('metro.zakaz.ua')) {
    detectedKey = 'metro';
    detectedName = 'METRO';
  } else if (u.includes('varus.zakaz.ua') || u.includes('varus.ua')) {
    detectedKey = 'varus';
    detectedName = 'VARUS';
  } else if (u.includes('auchan.zakaz.ua') || u.includes('auchan.ua')) {
    detectedKey = 'auchan';
    detectedName = 'АШАН';
  } else if (u.includes('silpo.ua')) {
    detectedKey = 'silpo';
    detectedName = 'Сільпо';
  } else if (u.includes('epicentrfood.zakaz.ua')) {
    detectedKey = 'epicentrk_food';
    detectedName = 'Епіцентр Food';
  } else if (u.includes('fora.ua')) {
    detectedKey = 'fora';
    detectedName = 'Фора';
  } else if (u.includes('eko.zakaz.ua') || u.includes('ekomarket.ua')) {
    detectedKey = 'eko';
    detectedName = 'ЕКО-Маркет';
  } else if (u.includes('ultramarket.zakaz.ua') || u.includes('ultramarket.ua')) {
    detectedKey = 'ultramarket';
    detectedName = 'Ультрамаркет';
  } else if (u.includes('megamarket.zakaz.ua') || u.includes('megamarket.ua')) {
    detectedKey = 'megamarket';
    detectedName = 'МегаМаркет';
  } else if (u.includes('torba.zakaz.ua') || u.includes('torba.ua')) {
    detectedKey = 'torba';
    detectedName = 'Торба';
  } else if (u.includes('sviymarket.com')) {
    detectedKey = 'sviy_market';
    detectedName = 'Свій Маркет';
  } else if (u.includes('nashkraj.ua')) {
    detectedKey = 'nash_kray';
    detectedName = 'Наш Край';
  } else if (u.includes('spar.ua')) {
    detectedKey = 'spar';
    detectedName = 'SPAR';
  } else if (u.includes('thrash.ua')) {
    detectedKey = 'thrash';
    detectedName = 'Траш!';
  } else if (u.includes('avrora.ua')) {
    detectedKey = 'avrora';
    detectedName = 'Аврора';
  } else if (u.includes('market.rukavychka.ua') || u.includes('rukavychka.ua')) {
    detectedKey = 'rukavychka';
    detectedName = 'Рукавичка';
  } else if (u.includes('prostor.ua')) {
    detectedKey = 'prostor';
    detectedName = 'Prostor';
  } else if (u.includes('eva.ua')) {
    detectedKey = 'eva';
    detectedName = 'EVA';
  } else if (u.includes('velmart.ua')) {
    detectedKey = 'velmart';
    detectedName = 'Велмарт';
  } else if (u.includes('simi.ua') || u.includes('sim23.ua')) {
    detectedKey = 'simi';
    detectedName = 'Сімі';
  } else if (u.includes('blyzenko.ua')) {
    detectedKey = 'blyzenko';
    detectedName = 'Близенько';
  } else if (u.includes('taistra.com.ua')) {
    detectedKey = 'taistra';
    detectedName = 'Тайстра';
  } else if (u.includes('arsen.ua')) {
    detectedKey = 'arsen';
    detectedName = 'Арсен';
  } else if (u.includes('epicentrk.ua')) {
    detectedKey = 'epicentr';
    detectedName = 'Епіцентр';
  } else if (u.includes('atbmarket.com')) {
    detectedKey = 'atb';
    detectedName = 'АТБ-Маркет';
  }

  if (!detectedKey) return null;

  if (expectedStoreKey && detectedKey !== String(expectedStoreKey).toLowerCase().trim()) {
    return null;
  }

  return { store: detectedKey, storeName: detectedName };
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

/* ─── Price Parsing & Sanity Validation ──────────────────────────────────── */
function parsePriceValue(rawText = '') {
  if (typeof rawText === 'number') {
    return Number.isFinite(rawText) ? rawText : NaN;
  }
  const cleaned = String(rawText || '')
    .replace(/[\u00A0\u202F\s]+/g, ' ')
    // Ignore loyalty footnotes like "за 1 грн" or "по 0.01 грн"
    .replace(/(?:за|по)\s+\d+(?:[.,]\d+)?\s*(?:грн|₴)/gi, ' ')
    // Collapse space thousand separators e.g. "1 899,00" -> "1899,00"
    .replace(/(\d)\s+(?=\d{3}(?:[.,]\d+|\b))/g, '$1')
    .trim();
  const match = cleaned.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return NaN;
  return parseFloat(match[1].replace(',', '.'));
}

function isValidProductPrice(title = '', price = 0, oldPrice = null) {
  const numPrice = Number(price);
  const hasOld = oldPrice !== null && oldPrice !== undefined && oldPrice !== '' && Number(oldPrice) > 0;
  const numOld = hasOld ? Number(oldPrice) : null;

  if (!Number.isFinite(numPrice) || numPrice <= 0) return false;
  if (numOld !== null && (!Number.isFinite(numOld) || numOld <= numPrice)) return false;

  // Rule A: Classic 1.00 UAH / 2.00 UAH HTML parser artifact
  if (numPrice <= 2.50 && (numOld === null || numOld <= 5.00)) {
    return false;
  }

  const titleLower = String(title || '').toLowerCase();

  // Rule B: Alcoholic beverages & spirits must not appear below 75.00 UAH
  const alcoholStems = [
    'віскі', 'whisky', 'whiskey', 'glenlivet', 'glenfiddich', 'jameson', 'jack daniels',
    'ром ', 'джин ', 'текіла', 'коньяк', 'бренді', 'горілка', 'лікер', 'вино ', 'ігристе', 'шампанське'
  ];
  if (hasWord(titleLower, alcoholStems) && numPrice < 75.00) {
    return false;
  }

  // Rule C: 1 kg ice cream & core staple categories must not appear below 20.00 UAH
  const isBulkIceCream = /морозиво\s*1\s*кг/i.test(titleLower);
  const coreGroceryStems = [
    'кава ', 'кави ', 'масло ', 'масла ', 'сир ', "м'ясо", 'мясо', 'філе', 'ковбаса', 'лосось'
  ];
  if ((isBulkIceCream || hasWord(titleLower, coreGroceryStems)) && numPrice < 20.00) {
    return false;
  }

  return true;
}

/* ─── Strict 5-Stage Product Categorization Engine ───────────────────────── */
function categorizeProduct(title = '', store = '', apiCategory = '') {
  const rawTitle = normalizeHomoglyphs(title).trim();
  const rawCategory = normalizeHomoglyphs(apiCategory).trim();
  const text = (rawTitle + ' ' + rawCategory).toLowerCase();
  const storeStr = String(store || '').toLowerCase().trim();
  const isBeautyStore = ['eva', 'prostor'].includes(storeStr);

  // Guard: Human food/drink stems block pet categorization (e.g. "Чай Great British", "Морозиво ... з наповнювачем")
  const HUMAN_FOOD_BLOCK_PET_STEMS = [
    'морозиво', 'йогурт', 'сирок', 'десерт', 'тістечко', 'круасан', 'пончик', 'донат',
    'торт', 'рулет', 'вафлі', 'вафл', 'печиво', 'шоколад', 'цукерк', 'згущене молоко',
    'згущене', 'варен', 'джем', 'карамель', 'шоколадний', 'пломбір', 'ріжок', 'ескімо',
    'чай ', 'кава ', 'какао', 'напій', 'сир ', 'масло '
  ];
  const isHumanFoodBlockingPet = hasWord(text, HUMAN_FOOD_BLOCK_PET_STEMS);

  // STAGE 1: Pet Products (mainCategory: 'Зоотовари') — Strictly Qualified
  const petIndicators = [
    'для котів', 'для кішок', 'для кошенят', 'для собак', 'для цуценят', 'для гризунів', 'для папуг',
    'корм сухий', 'корм вологий', 'стерилізованих',
    'ласощі для котів', 'ласощі для собак', 'ласощі для тварин', 'для тварин', 'для котиків'
  ];
  const petLitterQualifiers = [
    'для котів', 'для котячого туалету', 'туалету котів', 'для котячого',
    'бентонітовий', 'силікагелевий', 'деревний', 'комкуючий', 'грудкуючий',
    'тофу для котів', 'catsan', 'kotix', 'animall', 'supercat'
  ];
  const isPetLitter = hasWord(text, ['наповнювач']) && hasWord(text, petLitterQualifiers);
  const petBrands = [
    'whiskas', 'віскас', 'felix', 'фелікс', 'purina', 'пуріна', 'gourmet', 'гурме',
    'sheba', 'шеба', 'friskies', 'фріскіс', 'optimeal', 'оптіміл', 'клуб 4 лапи', 'club 4 paws',
    'pedigree', 'педігрі', 'chappi', 'чаппі', 'brit ', 'savory', 'josera'
  ];
  if (!isHumanFoodBlockingPet && (hasWord(text, petIndicators, petBrands) || isPetLitter || (hasWord(text, ['корм ']) && !hasWord(text, ['кормчий'])))) {
    let sub = 'Усі зоотовари';
    if (isPetLitter || hasWord(text, ['кіш', 'кіт', 'кот', 'кошен', 'котяч', 'whiskas', 'віскас', 'felix', 'фелікс', 'gourmet', 'гурме', 'sheba', 'шеба'])) {
      sub = 'Для котів';
    } else if (hasWord(text, ['собак', 'пес', 'пса', 'цуцен', 'педігрі', 'pedigree', 'chappi', 'чаппі'])) {
      sub = 'Для собак';
    }
    return { mainCategory: 'Зоотовари', subCategory: sub, category: sub };
  }

  // Non-food triggers
  const householdLaundryTriggers = [
    'для прання', 'пральний порошок', 'капсули для прання', 'гель для прання', 'засіб миючий',
    'ополіскувач для білизни', 'кондиціонер для білизни', 'кондиціонер для прання', 'відбілювач', 'плямовивідник',
    'для миття посуду', 'миття дитячого посуду', 'миття посуду', 'засіб для посуду', 'гель для посуду',
    'таблетки для посудомийних', 'сіль для посудомийних', 'засіб універсальний',
    'для чищення', 'засіб чистячий', 'чистячий', 'поліроль', 'для унітазу', 'для труб', 'забруднення труб', 'для підлоги', 'для скла',
    'для прибирання', 'освіжувач повітря', 'дифузор', 'антижир', 'антинакип'
  ];
  const householdLaundryBrands = [
    'persil', 'ariel', 'tide', 'perwoll', 'lenor', 'silan', 'coccolino', 'fairy', 'cif ',
    'somat', 'finish', 'domestos', 'breff', 'bref', 'cillit', 'mr. muscle',
    'містер мускул', 'утьонок', 'sano', 'frosch', 'гала', 'gala', 'сарма', 'wash&free', 'savex', 'dr.beckmann'
  ];
  const paperTriggers = [
    'туалетний папір', 'папір туалетний', 'паперові рушники', 'рушники паперові', 'рушники папер', 'рушник папер',
    'рушник кухонний', 'серветки косметичні', 'серветки столові', 'серветки паперові', 'носові хустинки'
  ];
  const paperBrands = [
    'zewa', 'рута', 'ruta', 'сніжна панда', 'обухів', 'кохавинка', 'кохавинська папірня', 'emeka', 'selpak', 'kleenex'
  ];
  const kitchenTriggers = [
    'сковород', 'пательн', 'каструл', 'тарілк', 'чашк', 'склянк', 'келих',
    'термос ', 'контейнер для їжі', 'фольга', 'фольги', 'плівка харчова', 'харчова плівка',
    'пергамент', 'форм для випік', 'рукав для запікання', 'губк', 'губка кухонна', 'губки кухонні', 'губки для посуду',
    'серветка для прибирання', 'серветки для прибирання', 'серветки господарські', 'серветки кухонні',
    'серветки віскозні', 'мікрофібра', 'пакети для сміття', 'мішки для сміття', 'пакети майка',
    'бокс універсальний', 'рукавички господарські', 'рукавичкі господарські'
  ];
  const kitchenBrands = [
    'фрекен бок', 'мельниця', 'luminarc', 'tefal', 'ardesto'
  ];
  const homeComfortTriggers = [
    'взуття', 'капці', 'тапочки', 'калоші', 'шкарпетк', 'клей', 'клей-гель', 'батарей',
    'валик для одягу', 'валик для чищення', 'грілки термохімічні', 'ліхтар', 'свічк', 'плед'
  ];

  const explicitHygieneTriggers = [
    'шампунь', 'гель для душу', 'крем-гель для душу', 'гель-догляд для душу', 'гель-доглад для душу',
    'гель для купання', 'засіб для купання', 'мило ', 'мило тверде', 'мило рідке', 'мило туалетне', 'мило дитяче', 'крем-мило',
    'бальзам для волосся', 'бальзам-ополіскувач', 'експрес-кондиціонер', 'кондиціонер для волосся',
    'фарба для волосся', 'маска для волосся', 'маска-крем для волосся', 'лак для волосся',
    'маска-гель', 'маска для обличчя', 'маска тканинна', 'ліфтинг-маска', 'патчі', 'тональний', 'міцелярна',
    'зубна паста', 'зубна щітка', 'зубна нитка', 'дезодорант', 'антиперспірант', 'антиперспирант',
    'піна для гоління', 'гель для гоління', 'крем для гоління', 'лосьйон після гоління', 'для гоління',
    'станок для гоління', 'станки для гоління', 'станків для гоління', 'бритв', 'презерватив',
    'прокладки', 'тампони', 'підгузки', 'підгузники', 'підгузки-трусики', 'підгузники-трусики',
    'вологі серветки', 'серветки вологі', 'для інтимної гігієни', 'серветки для інтимної', 'пелюшки гігієнічні',
    'ватні диски', 'ватні палички', 'для обличчя', 'для рук', 'для ніг', 'для брів', 'для вій'
  ];
  const explicitHygieneBrands = [
    'head & shoulders', 'head&shoulders', 'pantene', 'fructis', 'syoss', 'gliss',
    'colgate', 'splat', 'biomed', 'oral-b', 'old spice', 'rexona', 'dove', 'palmolive',
    'always', 'kotex', 'libresse', 'discreet', 'huggies', 'pampers', 'tesori d\'oriente', 'deepfresh', 'bubchen', 'paese',
    'nivea', 'garnier', 'eveline', 'via beauty', 'viabeauty', 'farmstay'
  ];

  const isExplicitNonFood = hasWord(
    text,
    householdLaundryTriggers, householdLaundryBrands,
    paperTriggers, paperBrands,
    kitchenTriggers, kitchenBrands,
    homeComfortTriggers,
    explicitHygieneTriggers, explicitHygieneBrands
  );

  // STAGE 2: Hard Food Lock (isExplicitFood)
  const EXPLICIT_FOOD_STEMS = [
    'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'штрудель',
    'рулет', 'кекс', 'мафін', 'булочка', 'пиріг', 'пиріж', 'печиво', 'вафлі', 'вафл', 'пряник',
    'зефір', 'мармелад', 'цукерк', 'шоколад', 'батончик', 'халва', 'морозиво', 'десерт',
    'крем-мед', 'пастила', 'козинак', 'драже', 'льодяник', 'жувальна гумка', 'джем', 'варення',
    'крем-сир', 'крем сир', 'крем-суп', 'вершковий сир', 'сир вершковий', 'плавлений',
    'моцарела', 'гауда', 'чеддер', 'пармезан', 'бринза', 'фета', 'сулугуні', 'кисломолочн',
    'сирок ', 'сметана', 'йогурт', 'кефір', 'ряжанка', 'айран', 'закваска',
    'масло солодковершкове', 'масло селянське', 'масло вершкове', 'масло екстра', 'масло бутербродне',
    'солодковершкове масло', 'селянське масло', 'вершкове масло',
    '73%', '72.5%', '82%', '82.5%', 'маргарин', 'спред',
    'молоко питне', 'молоко ультрапастеризоване', 'молоко пастеризоване', 'згущене',
    'вершки питні', 'вершки кулінарні', 'вершки ',
    'ковбас', 'сосиск', 'сардельк', 'шинк', 'бекон', 'грудинк', 'балик', 'салямі',
    'паштет ', 'курк', 'куряч', 'індич', 'свинин', 'свиняч', 'яловичин', 'ялович', 'телятин',
    'фарш', 'стейк', 'вирізк', 'корейк', 'хамон', 'прошуто', 'крильця',
    'гомілк', 'стегно', 'лосос', 'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець',
    'скумбрі', 'хек', 'мінтай', 'дорадо', 'лящ', 'палтус', 'креветк', 'мідії', 'ікра', 'крабові', 'буженин', 'реберц',
    'хліб ', 'багет', 'лаваш', 'батон', 'тост', 'чіабата', 'макарон', 'спагет', 'локшин', 'рамен',
    'пенне', 'фузіллі', 'вермішель', 'крупа', 'гречк', 'рис ', 'вівсян', 'пластівці', 'борошно',
    'цукор', 'олія соняшникова', 'соняшникова олія', 'олія оливкова', 'оливкова олія',
    'олія кукурудзяна', 'олія рафінована', 'оцет', 'бальзамічний', 'кетчуп', 'майонез',
    'гірчиц', 'соус', 'томатна паста', 'паста томатна', 'арахісова паста', 'паста шоколадна',
    'nutella', 'нутелла', 'кава', 'еспресо', 'американо', 'капучино', 'лате', 'чай ', 'цикорій',
    'матча', 'какао', 'сік ', 'нектар', 'лимонад', 'смузі', 'вода мінеральна', 'вода питна',
    'газован', 'енергетик', 'квас', 'пиво', 'вино ', 'вин ', 'сидр', 'чіпси', 'чипси', 'крекер', 'сухарики',
    'горішки', 'фісташки', 'мигдаль', 'фундук', 'яблук', 'банан', 'апельсин', 'лимон',
    'мандарин', 'виноград', 'ківі', 'авокадо', 'хурма', 'батат', 'гарбуз', 'помело', 'пітахайя', 'кокос',
    'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник', 'зелень', 'салат '
  ];
  const isExplicitFood = !isExplicitNonFood && hasWord(text, EXPLICIT_FOOD_STEMS) && !isBeautyStore;
  const isLaundryOrHome = hasWord(text, ['для прання', 'для білизни', 'кондиціонер для прання', 'посудомийних', 'для унітазу', 'для миття посуду', 'coccolino', 'cif ', 'засіб універсальний']);
  const isCosmeticBrandGuard = !isLaundryOrHome && hasWord(text, ['тональний', 'макіяж', 'пудра', "рум'яна", 'консилер', 'хайлайтер', 'блиск для губ', 'помада', 'paese', 'maybelline', 'vivienne sabo', 'bourjois', 'max factor', 'lamel', 'it cosmetics', 'kylie cosmetics', 'парфуми', 'туалетна вода', 'парфумована вода']);

  // STAGE 3: Household & Home Comfort (mainCategory: 'Дім та Побут')
  if (!isExplicitFood) {
    if (!isCosmeticBrandGuard && hasWord(text, householdLaundryTriggers, householdLaundryBrands)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Побутова хімія', category: 'Побутова хімія' };
    }
    if (hasWord(text, paperTriggers, paperBrands)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Паперова продукція', category: 'Паперова продукція' };
    }
    if (hasWord(text, kitchenTriggers, kitchenBrands)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Кухня та Посуд', category: 'Кухня та Посуд' };
    }
    if (hasWord(text, homeComfortTriggers)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Дім та Затишок', category: 'Дім та Затишок' };
    }
  }

  // STAGE 4: Beauty, Skincare & Personal Care (mainCategory: 'Краса та Гігієна')
  if (!isExplicitFood) {
    const hairTriggers = [
      'шампунь', 'для волосся', 'бальзам для волосся', 'бальзам-ополіскувач', 'кондиціонер для волосся',
      'експрес-кондиціонер', 'маска для волосся', 'маска-крем для волосся', 'фарба для волосся', 'лак для волосся', 'спрей для волосся', 'олія для волосся'
    ];
    const hairBrands = [
      'head & shoulders', 'head&shoulders', 'pantene', 'elseve', 'syoss',
      'gliss', 'schauma', 'tresemme', 'palette', 'fructis', 'got2b', 'fortesse'
    ];

    const makeupTriggers = [
      'туш для вій', 'помада', 'блиск для губ', 'тіні для повік', 'пудра', 'для брів', 'для вій',
      'консилер', 'олівець для брів', 'олівець для очей', 'лак для нігтів', 'парфум', 'туалетна вода',
      'парфумована вода', 'хайлайтер', 'рум\'яна', 'тінт для губ', 'кушон', 'палетка тіней', 'тональний'
    ];
    const makeupBrands = [
      'maybelline', 'vivienne sabo', 'bourjois', 'max factor', 'nyx', 'paese', 'it cosmetics', 'pupa',
      'charlotte tilbury', 'juliette has a gun', 'kayali', 'nishane', 'rare beauty', 'billie eilish',
      'gritti', 'lamel', 'milk touch', 'kylie cosmetics', 'a\'pieu', 'make up academy', 'xerjoff',
      'franck boclet', 'memo paris', 'micallef', 'guerlain', 'tiziana terenzi', 'narciso rodriguez', 'elie saab'
    ];

    const explicitWashOrDeoOrIntimate = hasWord(text, [
      'для душу', 'для купання', 'мило ', 'крем-мило', 'дезодорант', 'антиперспірант', 'антиперспирант',
      'зубна паста', 'зубна щітка', 'зубна нитка', 'ополіскувач для ротової', 'прокладки', 'тампони',
      'ватні диски', 'ватні палички', 'вологі серветки', 'серветки вологі', 'серветки для інтимної', 'для інтимної гігієни',
      'пелюшки гігієнічні', 'бритв', 'станок для гоління', 'станки для гоління', 'станків для гоління',
      'піна для гоління', 'гель для гоління', 'презерватив', 'підгузки', 'підгузники', 'підгузки-трусики', 'підгузники-трусики'
    ]);

    const skincareTriggers = [
      'сироватка', 'тонік', 'міцелярна', 'пінка для вмивання', 'гель для вмивання', 'скраб',
      'маска для обличчя', 'маска тканинна', 'ліфтинг-маска', 'маска-гель', 'патчі',
      'лосьйон для тіла', 'молочко для тіла', 'бальзам для губ', 'гігієнічна помада', 'пілінг',
      'для обличчя', 'для рук', 'для ніг', 'навколо очей', 'від тріщин'
    ];
    const cosmeticCreamQualifiers = [
      'для обличчя', 'для рук', 'для тіла', 'для ніг', 'для шкіри', 'для повік',
      'навколо очей', 'від зморшок', 'від тріщин', 'зволожуючий', 'зволожуюча', 'зволожуюче',
      'живильний', 'живильна', 'живильне', 'сонцезахисний', 'сонцезахисна', 'spf',
      'bb-крем', 'bb крем', 'cc-крем', 'cc крем', 'після гоління', 'для депіляції', 'дитячий крем'
    ];
    const isCosmeticCream = hasWord(text, ['крем', 'бальзам', 'лосьйон']) && !explicitWashOrDeoOrIntimate && (hasWord(text, cosmeticCreamQualifiers) || isBeautyStore);
    const skincareBrands = [
      'nivea', 'garnier', 'l\'oreal', 'loreal', 'cerave', 'la roche', 'vichy',
      'bioderma', 'eveline', 'ziaja', 'zaja', 'біокон', 'heimish', 'christina', 'babor', 'elemis', '3lab', 'hollyskin', 'via beauty', 'viabeauty', 'farmstay', 'arko men'
    ];

    const hygieneBrands = [
      'old spice', 'rexona', 'dove', 'palmolive', 'fa ', 'colgate', 'sensodyne',
      'lacalut', 'oral-b', 'parodontax', 'always', 'kotex', 'libresse', 'discreet',
      'bella', 'gillette', 'bic', 'pampers', 'huggies', 'splat', 'biomed', 'tesori d\'oriente', 'deepfresh', 'bubchen', 'lactacyd', 'younika', 'seni', 'tena'
    ];

    const isShowerGelOnly = hasWord(text, ['для душу', 'для купання', 'шампунь-гель']);
    if (!isShowerGelOnly && hasWord(text, hairTriggers, hairBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Догляд за волоссям', category: 'Догляд за волоссям' };
    }
    if (hasWord(text, makeupTriggers, makeupBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Декоративна косметика', category: 'Декоративна косметика' };
    }
    if (!explicitWashOrDeoOrIntimate && (isCosmeticCream || hasWord(text, skincareTriggers) || (hasWord(text, skincareBrands) && !hasWord(text, ['антиперспірант', 'дезодорант', 'для гоління', 'після гоління'])))) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Догляд за шкірою', category: 'Догляд за шкірою' };
    }
    if (explicitWashOrDeoOrIntimate || hasWord(text, ['для гоління', 'після гоління', 'лосьйон', 'депіляці'], hygieneBrands) || isBeautyStore) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Особиста гігієна', category: 'Особиста гігієна' };
    }
  }

  // STAGE 5: Groceries Subcategories (mainCategory: 'Продукти')
  // 0. Prepared / Savory Grocery Guard (Chips, Crackers, Noodles, Spices, Frozen Meals, Canned) -> Бакалія
  const savoryGroceryTriggers = [
    'приправа', 'перець чорний', 'перець духмяний', 'перець горошок', 'лист лавровий', 'часник сушений', 'гранульован', 'паприка',
    'чипси', 'чіпси', 'попкорн', 'сухарики', 'грінки', 'брускети', 'крекер', 'бурито',
    'вареники', 'пельмені', 'равіолі', 'ньокі', 'хінкалі', 'млинці', 'пампушка',
    'хумус', 'оливки', 'маслини', 'ікра кабачкова', 'ікра баклажанна',
    'готові сніданки', 'сніданок готовий', 'каша ', 'пюре ', 'піца', 'тісто ', 'борошно',
    'макарон', 'спагет', 'локшин', 'рамен', 'вермішель', 'бульйон', 'крупа', 'булгур',
    'кукурудза цукрова', 'кукурудза ', 'горошок ', 'олія ', 'майонез', 'кетчуп', 'заправка', 'консерв',
    'картопля фрі', 'крем-суп', 'по-корейськ', 'по-корейски', 'буряк варений', 'стерилізов', 'різані', 'очищені', 'насіння'
  ];
  if (hasWord(text, savoryGroceryTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Бакалія', category: 'Бакалія' };
  }

  // 1. М'ясо та Риба (checked BEFORE Sweets & Dairy so "Шинка Рулет", "Ковбаса з молоком", "Креветка сира" never misclassify)
  const startsAsCheese = /^\s*(?:крем[- ])?сир\b/i.test(rawTitle);
  const meatFishTriggers = [
    'м\'яс', 'мяс', 'курк', 'куряч', 'індич', 'свинин', 'свиняч', 'яловичин', 'ялович', 'телятин', 'качк', 'гуск',
    'фарш', 'стейк', 'вирізк', 'корейк', 'хамон', 'прошуто', 'філе', 'крильця', 'гомілк', 'стегно', 'ковбас', 'сосиск', 'сардельк',
    'шинк', 'бекон', 'балик', 'салямі', 'паштет ', 'буженин', 'реберц', 'риба', 'лосос',
    'сьомг', 'форел', 'тунец', 'тунець', 'оселедец', 'оселедець', 'скумбрі', 'хек', 'мінтай', 'дорадо', 'лящ', 'палтус', 'судак', 'сібас', 'сибас', 'короп',
    'креветк', 'мідії', 'кальмар', 'ікра', 'крабові', 'наша ряба', 'ранчо', 'бащинський',
    'глобино', 'м\'ясна гільдія', 'алан', 'водний світ', 'санта бремор'
  ];
  if (!startsAsCheese && hasWord(text, meatFishTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'М\'ясо та Риба', category: 'М\'ясо та Риба' };
  }

  // 2. Кава та Чай (checked BEFORE Sweets so flavored coffee/tea with chocolate or honey notes stay Coffee & Tea)
  const isBakeOrCandyNotDrink = hasWord(text, ['цукерк', 'печиво', 'вафл', 'торт', 'тістечк', 'морозив', 'круасан', 'донат', 'рулет', 'батончик', 'паста ', 'горіхов', 'фундук', 'milka', 'nutella', 'нутелла', 'джем', 'варення']);
  const coffeeTeaTriggers = [
    'кава', 'кавові', 'еспресо', 'капучино', 'лате', 'американо', 'чай ', 'цикорій', 'матча', 'какао',
    'гарячий шоколад', 'дріп', 'jacobs', 'lavazza', 'greenfield', 'tess', 'curtis', 'lovare',
    'ліптон', 'lipton', 'paulig', 'чорна карта', 'жокей', 'idealist'
  ];
  if (!isBakeOrCandyNotDrink && hasWord(text, coffeeTeaTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Кава та Чай', category: 'Кава та Чай' };
  }

  // 3. Солодощі (Bakery desserts with cream checked BEFORE Dairy; alcohol guarded out unless candy)
  const isCandyOrConfection = hasWord(text, ['цукерк', 'шоколад', 'батончик', 'торт', 'тістечко', 'праліне']);
  const isAlcoholDrink = !isCandyOrConfection && hasWord(text, ['настоянк', 'вермут', 'віскі', 'горілка', 'лікер', 'вино ', 'вин ', 'ігристе', 'шампанське', 'пиво', 'ром ', 'бренді', 'джин ', 'текіл']);
  const sweetsTriggers = [
    'донат', 'донатс', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'кекс', 'мафін',
    'рулет', 'штрудель', 'сирник', 'пиріж', 'пампухи зі згущ', 'булочка з корицею', 'вафельний лист', 'з фундуком та какао', 'горіхово-шоколадна', 'бат рис',
    'печиво', 'вафлі', 'вафл', 'пряник', 'зефір', 'мармелад', 'пастила',
    'цукерк', 'шоколад', 'батончик', 'халва', 'козинак', 'драже', 'льодяник', 'жувальна гумка',
    'морозиво', 'десерт', 'мед ', 'крем-мед', 'джем', 'варення', 'згущене молоко', 'згущене',
    'паста шоколадна', 'nutella', 'нутелла', 'barni', 'барні', 'рошен', 'roshen', 'milka', 'мілка',
    'ferrero', 'kinder', 'кіндер', 'raffaello', 'рафаелло', 'конті', 'konti', 'авк', 'avk', 'ярич'
  ];
  if (!isAlcoholDrink && hasWord(text, sweetsTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Солодощі', category: 'Солодощі' };
  }

  // 4. Молочні та Сири
  const dairyTriggers = [
    'молоко', 'масло солодковершкове', 'масло вершкове', 'масло селянське', 'масло екстра', 'масло бутербродне',
    'солодковершкове масло', 'вершкове масло', 'селянське масло', 'маргарин', 'спред',
    'сир ', 'крем-сир', 'крем сир', 'сирок ', 'моцарела', 'гауда', 'пармезан', 'чеддер',
    'сулугуні', 'бринза', 'фета', 'сметана', 'вершки', 'йогурт', 'кефір', 'ряжанка',
    'айран', 'закваска', 'плавлений', 'творог', 'кисломолочн', 'комо', 'яготинськ',
    'ферма', 'активіа', 'актимель', 'данон', 'danone', 'президент', 'president',
    'mlekovita', 'spomlek', 'простонаше', 'камамбер', 'брі '
  ];
  const isDairyButter = hasWord(text, ['масло']) && hasWord(text, ['солодковершков', 'вершков', 'селянськ', 'екстра', 'кисловершков', 'бутербродн']);
  if (isDairyButter || hasWord(text, dairyTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Молочні та Сири', category: 'Молочні та Сири' };
  }

  // 5. Напої
  const drinksTriggers = [
    'вода', 'сік ', 'сок', 'нектар', 'морс', 'лимонад', 'смузі', 'напій', 'кола', 'pepsi', 'coca-cola',
    'fanta', 'sprite', 'schweppes', 'комбуча', 'квас', 'енергетик', 'red bull', 'monster',
    'пиво', 'вино ', 'вин ', 'lambrusc', 'sauvign', 'chardonnay', 'шампанське', 'ігристе', 'сидр', 'моршинськ', 'боржомі', 'borjomi',
    'поляна квасова', 'садочок', 'sandora', 'rich', 'наш сік', 'віскі', 'горілка', 'коньяк', 'ром ',
    'лікер', 'вермут', 'джин ', 'бренді', 'текіл', 'настоянк', 'аперитив', 'бітер', 'ромов'
  ];
  if (hasWord(text, drinksTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Напої', category: 'Напої' };
  }

  // 6. Овочі та Фрукти (excludes sauces, chips, spices, canned/pickled goods, and purees)
  const isProcessedFoodNotFreshProduce = hasWord(text, [
    'томатна паста', 'паста томатна', 'кетчуп', 'соус', 'чипс', 'чіпс', 'крекер', 'пиріж',
    'сухарик', 'сушен', 'приправ', 'спеці', 'маринован', 'консерв', 'пюре', 'квашен',
    'по-корейськ', 'по-корейски', 'заморожен', 'картопля фрі', 'варений', 'стерилізов', 'очищені', 'різані', 'гранульован', 'насіння', 'заправка'
  ]) || (hasWord(text, 'томат') && hasWord(text, 'паста'));
  const produceTriggers = [
    'яблук', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'ківі', 'авокадо',
    'хурма', 'батат', 'гарбуз', 'помело', 'пітахайя', 'кокос',
    'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник',
    'зелень', 'салат ', 'айсберг', 'рукола', 'шпинат', 'кабачок', 'баклажан', 'буряк',
    'редис', 'печериц', 'гриб', 'ягоди', 'полуниц', 'малин', 'лохина', 'чорниц', 'кавун',
    'диня', 'гранат', 'груш', 'слив', 'персик', 'нектарин', 'броколі', 'чері'
  ];
  if (!isProcessedFoodNotFreshProduce && hasWord(text, produceTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Овочі та Фрукти', category: 'Овочі та Фрукти' };
  }

  // 7. Бакалія (Default food subcategory)
  return { mainCategory: 'Продукти', subCategory: 'Бакалія', category: 'Бакалія' };
}

// Backward-compatible alias
const mapCategory = categorizeProduct;

/* ─── Zero-Dictionary Brand & Canonical Fingerprint Extraction ───────────── */
const PACKAGING_NOISE_WORDS = new Set([
  'акці', 'акція', 'знижк', 'знижка', 'упаковк', 'упаковка', 'пачк', 'пачка',
  'пляшк', 'пляшка', 'пакет', 'банк', 'банка', 'скл', 'скло', 'пет', 'стакан', 'дойпак', 'коробк',
  'вагов', 'ваговий', 'фасован', 'фасований', 'україн', 'україна', 'тм',
  'солодковершков', 'солодковершкове', 'пастеризован', 'пастеризоване',
  'ультрапастеризован', 'ультрапастеризоване', 'ультрапастеризировані', 'питн', 'питне'
]);

function extractBrandFromTitle(title = '', nativeBrand = null) {
  const nb = typeof nativeBrand === 'string' ? nativeBrand.trim() : '';
  if (nb && !/^(без тм|without-brand|null|none)$/i.test(nb)) return nb;
  const cleanTitle = normalizeHomoglyphs(title).trim();
  const quoted = cleanTitle.match(/[«"„]([^»"“]{2,})[»"“]/);
  if (quoted) return quoted[1].trim();
  const tmMatch = cleanTitle.match(/(?:^|\s)тм\s+[«"„]?([А-ЯІЇЄҐA-Z][\p{L}'-]{1,})/iu);
  if (tmMatch) return tmMatch[1].trim();
  const latinMatch = cleanTitle.match(/\b([a-z]{3,})\b/i);
  if (latinMatch && !/^(pcs|max|pro|bio|eco|pet)$/i.test(latinMatch[1])) return latinMatch[1].trim();
  const capMatch = cleanTitle.match(/\s([А-ЯІЇЄҐ][а-яіїєґ']{2,})/);
  if (capMatch && !PACKAGING_NOISE_WORDS.has(capMatch[1].toLowerCase())) return capMatch[1].trim();
  return null;
}

function normalizeUaToken(word = '') {
  let s = word.toLowerCase();
  if (s.length >= 5) s = s.replace(/(ий|ій|ая|ое|ого|ому|ему|ою|их|іх|ої)$/u, '');
  if (s.length >= 4) s = s.replace(/(а|я|е|є|і|ї|о|у|ю|и)$/u, '');
  return s;
}

function extractNormalizedUnit(text = '') {
  const clean = normalizeHomoglyphs(text).replace(/(\d+),(\d+)/g, '$1.$2');
  const multi = clean.match(/(\d+)\s*[*xх×]\s*(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|g|л|l|мл|ml)(?!\p{L})/iu);
  if (multi) {
    const total = parseInt(multi[1], 10) * parseFloat(multi[2]);
    const u = multi[3].toLowerCase();
    return (u === 'кг' || u === 'kg') ? `${Math.round(total * 1000)}g`
      : (u === 'л' || u === 'l') ? `${Math.round(total * 1000)}ml`
      : (u === 'мл' || u === 'ml') ? `${Math.round(total)}ml` : `${Math.round(total)}g`;
  }
  const comboPcs = clean.match(/(\d+)\s*\+\s*(\d+)\s*(шт|pcs)(?!\p{L})/iu);
  if (comboPcs) return `${parseInt(comboPcs[1], 10) + parseInt(comboPcs[2], 10)}pcs`;
  const single = clean.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|g|л|l|мл|ml|шт|pcs)(?!\p{L})/iu);
  if (!single) return '';
  const val = parseFloat(single[1]);
  const u = single[2].toLowerCase();
  if (u === 'кг' || u === 'kg') return `${Math.round(val * 1000)}g`;
  if (u === 'г' || u === 'гр' || u === 'g') return `${Math.round(val)}g`;
  if (u === 'л' || u === 'l') return `${Math.round(val * 1000)}ml`;
  if (u === 'мл' || u === 'ml') return `${Math.round(val)}ml`;
  return `${Math.round(val)}pcs`;
}

function getCanonicalProductKey(item = {}) {
  const title = normalizeHomoglyphs(item.title || item.name || '').trim();
  const rawEan = item.ean ? String(item.ean).trim() : '';
  const ean = /^\d{8,14}$/.test(rawEan) ? rawEan : null;
  const subCategory = (item.subCategory || item.sub_category || item.category || '').trim();
  const normalizedUnit = extractNormalizedUnit(title) || extractNormalizedUnit(item.unit || item.weight || '');
  const pctMatch = title.replace(/(\d+),(\d+)/g, '$1.$2').match(/(\d+(?:\.\d+)?)\s*%/);
  const normalizedPercent = pctMatch ? `${parseFloat(pctMatch[1])}%` : '';
  const brand = extractBrandFromTitle(title, item.brand || item.producerBrand || null);

  const stripped = title
    .toLowerCase()
    .replace(/(\d+),(\d+)/g, '$1.$2')
    .replace(/\b\d+\s*[*xх×]\s*\d+(?:\.\d+)?\s*(?:кг|kg|г|гр|g|л|l|мл|ml)\b/giu, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:кг|kg|г|гр|g|л|l|мл|ml|шт|pcs|%)/giu, ' ')
    .replace(/(?:^|\s)[пмтжсз]\/(?:ет|е|уп|у|п|б)(?=\s|$)/giu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

  const coreTokens = [...new Set(
    stripped.split(/\s+/)
      .filter(w => w.length >= 2 || /^\d+$/.test(w))
      .map(normalizeUaToken)
      .filter(w => (w.length >= 2 || /^\d+$/.test(w)) && !PACKAGING_NOISE_WORDS.has(w))
  )].sort();

  const canonicalKey = (subCategory && normalizedUnit && brand && coreTokens.length >= 2)
    ? `${subCategory} | ${normalizedUnit} | ${normalizedPercent} | ${coreTokens.join(' ')}`
    : null;

  return { ean, canonicalKey, brand, normalizedUnit, normalizedPercent, coreTokens };
}

function normalizeProductSignature(title = '', ean = null, producerBrand = null, unit = '', subCategory = 'Бакалія') {
  return getCanonicalProductKey({ title, ean, brand: producerBrand, unit, subCategory });
}

function areProductsMatching(sigA, sigB) {
  if (!sigA || !sigB) return false;
  if (sigA.ean && sigB.ean && sigA.ean === sigB.ean) return true;
  return Boolean(sigA.canonicalKey && sigB.canonicalKey && sigA.canonicalKey === sigB.canonicalKey);
}

/* ─── Fast Network Fetch with AbortController ────────────────────────────── */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      ...options
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const DEPARTMENT_SEARCH_SHARDS = [
  'кава', 'шоколад', 'сир', 'масло', 'молоко', 'сметана', 'олія', 'чай',
  'філе', 'ковбаса', 'макарони', 'гель', 'шампунь', 'корм',
  'йогурт', 'сосиски', 'печиво', 'вода', 'сік', 'пиво', 'вино', 'порошок', 'цукор', 'крупа'
];

/* ─── 1. SILPO Public Catalog Scraper ────────────────────────────────────── */
async function fetchSilpoAllPromotions(branchInput) {
  const defaultBranch = '1edb6b5a-55fb-6864-9a0f-d54e0a9fe643';
  const branchIds = (Array.isArray(branchInput) ? branchInput : [branchInput || defaultBranch]).filter(Boolean);
  const uniqueBranches = [...new Set(branchIds.length > 0 ? branchIds : [defaultBranch])].slice(0, 3);

  const SILPO_BATCH_SIZE = 6;
  const SILPO_WAVES = [
    [0, 100, 200, 300],
    [400, 500, 600, 700],
    [800, 900, 1000, 1100]
  ];

  const fetchSilpoUrl = async (url) => {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.items || data.products || data.results || [];
    } catch (_) {
      return null;
    }
  };

  const rawItems = [];

  for (const activeBranch of uniqueBranches) {
    const baseUrl = `https://sf-ecom-api.silpo.ua/v1/uk/branches/${activeBranch}/products`;
    for (const waveOffsets of SILPO_WAVES) {
      const settled = await Promise.allSettled(
        waveOffsets.map(offset =>
          fetchSilpoUrl(`${baseUrl}?limit=100&offset=${offset}&deliveryType=DeliveryHome&mustHavePromotion=true`)
        )
      );
      let waveItemCount = 0;
      let lastOffsetCount = 0;
      settled.forEach((r, idx) => {
        const list = r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];
        rawItems.push(...list);
        waveItemCount += list.length;
        if (idx === settled.length - 1) {
          lastOffsetCount = list.length;
        }
      });
      if (waveItemCount === 0 || lastOffsetCount < 50) break;
    }
  }

  const primaryBranch = uniqueBranches[0];
  const primaryBaseUrl = `https://sf-ecom-api.silpo.ua/v1/uk/branches/${primaryBranch}/products`;
  const shardUrls = DEPARTMENT_SEARCH_SHARDS.map(
    q => `${primaryBaseUrl}?search=${encodeURIComponent(q)}&limit=50&deliveryType=DeliveryHome`
  );

  for (let i = 0; i < shardUrls.length; i += SILPO_BATCH_SIZE) {
    const batch = shardUrls.slice(i, i + SILPO_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(fetchSilpoUrl));
    settled.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        rawItems.push(...r.value);
      }
    });
  }

  const seenKeys = new Set();
  const validItems = [];

  for (const item of rawItems) {
    const slug = item.slug ? item.slug.trim() : '';
    const itemKey = slug || item.id || item.title;
    if (itemKey && seenKeys.has(itemKey)) continue;
    if (itemKey) seenKeys.add(itemKey);

    const title = (item.title || item.name || '').trim();
    if (!title) continue;

    const price = parseFloat(item.price || item.currentPrice || 0);
    if (price <= 0) continue;

    const rawOld = item.oldPrice ? parseFloat(item.oldPrice) : null;
    if (!rawOld || rawOld <= price) continue;

    const oldPrice = Number(rawOld.toFixed(2));
    const formattedPrice = Number(price.toFixed(2));
    if (!isValidProductPrice(title, formattedPrice, oldPrice)) continue;

    const sourceUrl = slug ? `https://silpo.ua/product/${slug}` : 'https://silpo.ua';

    if (!isStoreUrlConsistent('silpo', sourceUrl)) continue;

    const unit = item.displayRatio ? String(item.displayRatio).trim() : (item.ratio ? 'кг' : (item.unit === 'kg' ? 'кг' : 'шт'));
    const catInfo = categorizeProduct(title, 'silpo', item.categoryTitle || '');

    const ean = Array.isArray(item.barcodes) && item.barcodes[0] ? String(item.barcodes[0]).trim() : null;
    const brand = extractBrandFromTitle(title, item.brandTitle || item.brand || null);

    validItems.push({
      sourceStore: 'silpo',
      sourceStoreName: 'Сільпо',
      title,
      brand,
      producerBrand: brand,
      ean,
      mainCategory: catInfo.mainCategory,
      subCategory: catInfo.subCategory,
      category: catInfo.category,
      unit,
      price: formattedPrice,
      oldPrice,
      promoTag: 'Ціна тижня Сільпо',
      sourceUrl
    });
  }

  console.log(`[LIVE SYNC] [Сільпо] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: 'silpo',
    storeName: 'Сільпо',
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 2. ZAKAZ.UA Public Promotion Scraper (NOVUS, METRO, AUCHAN, EPICENTR FOOD, TORBA, EKO, ULTRAMARKET, MEGAMARKET) */
async function resolveDynamicZakazStores(fallbackZakazStores = {}, cityId = 'all') {
  const merged = {};
  Object.entries(fallbackZakazStores || {}).forEach(([k, v]) => {
    merged[k] = Array.isArray(v) ? [...v] : (v ? [v] : []);
  });

  const chainMap = {
    novus: 'novus',
    metro: 'metro',
    auchan: 'auchan',
    epicentr: 'epicentrk_food',
    torba: 'torba',
    ekomarket: 'eko',
    ultramarket: 'ultramarket',
    megamarket: 'megamarket'
  };

  try {
    const res = await fetchWithTimeout('https://stores-api.zakaz.ua/stores/', {}, 6500);
    if (!res.ok) return merged;
    const raw = await res.json();
    const stores = Array.isArray(raw) ? raw : (raw.results || []);
    const cityNorm = String(cityId || '').toLowerCase().trim();
    const cityAliases = {
      'kyiv': ['kiev', 'kyiv'],
      'lviv': ['lviv'],
      'ivano-frankivsk': ['ivano-frankivsk', 'ivano_frankivsk'],
      'odesa': ['odessa', 'odesa'],
      'dnipro': ['dnipro'],
      'kharkiv': ['kharkov', 'kharkiv']
    };
    const preferredCityTokens = cityAliases[cityNorm] || [];

    const collected = {};
    for (const st of stores) {
      if (st.is_active === false || !st.id || !st.retail_chain) continue;
      const key = chainMap[String(st.retail_chain).toLowerCase()];
      if (!key) continue;
      if (!collected[key]) collected[key] = { matched: [], other: [] };
      const stCity = `${st.city || ''} ${st.region_id || ''}`.toLowerCase();
      const matchesCity = cityNorm === 'all' || preferredCityTokens.some(tok => stCity.includes(tok));
      if (matchesCity) {
        collected[key].matched.push(String(st.id));
      } else {
        collected[key].other.push(String(st.id));
      }
    }

    Object.entries(collected).forEach(([key, buckets]) => {
      const existing = merged[key] || [];
      const dynamicIds = buckets.matched.length > 0 ? buckets.matched : buckets.other;
      const combined = [...new Set([...existing, ...dynamicIds])];
      merged[key] = combined.slice(0, cityNorm === 'all' ? 1 : 2);
    });
  } catch (err) {
    console.warn(`[LIVE SYNC] [Zakaz.ua] Dynamic /stores/ fallback (${err.message})`);
  }

  return merged;
}

async function fetchZakazStoreMulti(storeKey, storeName, storeIds) {
  const ids = (Array.isArray(storeIds) ? storeIds : [storeIds]).filter(Boolean);
  if (ids.length === 0) {
    return {
      store: storeKey,
      storeName,
      status: 0,
      items: [],
      error: 'Мережа відсутня в цьому місті'
    };
  }
  const BATCH_SIZE = 6;
  const fetchZakazUrl = async (url) => {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.results || data.items || [];
    } catch (_) {
      return null;
    }
  };

  const rawItems = [];

  for (let idx = 0; idx < ids.length; idx++) {
    const storeId = ids[idx];
    const baseUrl = `https://stores-api.zakaz.ua/stores/${storeId}/products`;
    const pageWaves = idx === 0
      ? [
          [1, 2, 3, 4, 5],
          [6, 7, 8, 9, 10],
          [11, 12, 13, 14, 15]
        ]
      : [[1, 2, 3, 4]];

    for (const wave of pageWaves) {
      const settled = await Promise.allSettled(
        wave.map(p => fetchZakazUrl(`${baseUrl}/promotion/?page=${p}`))
      );
      let anyNonNull = false;
      let shouldStop = false;
      settled.forEach(r => {
        const pageList = r.status === 'fulfilled' ? r.value : null;
        if (Array.isArray(pageList)) {
          anyNonNull = true;
          rawItems.push(...pageList);
          if (pageList.length < 15) shouldStop = true;
        }
      });
      if (!anyNonNull || shouldStop) break;
    }

    if (idx === 0) {
      const shardUrls = DEPARTMENT_SEARCH_SHARDS.map(q => `${baseUrl}/search/?q=${encodeURIComponent(q)}`);
      for (let i = 0; i < shardUrls.length; i += BATCH_SIZE) {
        const batch = shardUrls.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(fetchZakazUrl));
        settled.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            rawItems.push(...r.value);
          }
        });
      }
    }
  }

  const seenKeys = new Set();
  const validItems = [];

  for (const item of rawItems) {
    const itemKey = item.web_url || item.sku || item.ean || (item.slug ? `${storeKey}_${item.slug}` : null);
    if (itemKey && seenKeys.has(itemKey)) continue;
    if (itemKey) seenKeys.add(itemKey);

    const title = (item.title || item.name || '').trim();
    if (!title) continue;

    const rawUrl = item.web_url ? String(item.web_url).trim() : '';

    if (!isStoreUrlConsistent(storeKey, rawUrl)) {
      continue;
    }

    const price = item.price ? Number((item.price / 100).toFixed(2)) : 0;
    if (price <= 0) continue;

    let oldPrice = null;
    if (item.discount && item.discount.old_price) {
      oldPrice = Number((item.discount.old_price / 100).toFixed(2));
    } else if (item.old_price) {
      oldPrice = Number((item.old_price / 100).toFixed(2));
    }

    if (!oldPrice || oldPrice <= price || !isValidProductPrice(title, price, oldPrice)) continue;

    const unit = item.unit === 'kg' ? 'кг' : (item.bundle && item.bundle > 1 ? `${item.bundle} шт` : (item.unit === 'pcs' ? 'шт' : (item.unit || 'шт')));
    const catInfo = categorizeProduct(title, storeKey, item.category?.title || '');
    const brand = extractBrandFromTitle(title, item.producer?.trademark || item.brand || null);
    const ean = item.ean ? String(item.ean).trim() : null;

    validItems.push({
      sourceStore: storeKey,
      sourceStoreName: storeName,
      title,
      brand,
      producerBrand: brand,
      ean,
      mainCategory: catInfo.mainCategory,
      subCategory: catInfo.subCategory,
      category: catInfo.category,
      unit,
      price,
      oldPrice,
      promoTag: 'Акція ' + storeName,
      sourceUrl: rawUrl
    });
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 3. THRASH! Official GraphQL Promotions Scraper ─────────────────────── */
async function fetchThrashPromotions() {
  const storeKey = 'thrash';
  const storeName = 'Траш!';
  const validItems = [];

  try {
    // 1. Fetch active promotion campaigns
    const promoRes = await fetchWithTimeout('https://thrash.ua/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { promotions { slug title } }' })
    }, 4500);

    if (!promoRes.ok) {
      throw new Error(`GraphQL HTTP ${promoRes.status}`);
    }

    const promoData = await promoRes.json();
    const campaigns = promoData.data?.promotions || [];

    const seenIds = new Set();

    for (const cmp of campaigns) {
      if (!cmp.slug) continue;

      const itemsQuery = `
        query {
          offersSplited(pageSlug: "${cmp.slug}", pagingInfo: { offset: 0, limit: 100 }) {
            products {
              items {
                id
                title
                slug
                price
                oldPrice
                weight
              }
            }
          }
        }
      `;

      try {
        const itemsRes = await fetchWithTimeout('https://thrash.ua/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: itemsQuery })
        }, 4500);

        if (!itemsRes.ok) continue;
        const itemsData = await itemsRes.json();
        const rawProds = itemsData.data?.offersSplited?.products?.items || [];

        for (const prod of rawProds) {
          if (!prod.title || !prod.price || !prod.oldPrice) continue;
          if (seenIds.has(prod.id || prod.slug)) continue;
          seenIds.add(prod.id || prod.slug);

          const price = parsePriceValue(prod.price);
          const oldPrice = parsePriceValue(prod.oldPrice);
          if (!isValidProductPrice(prod.title, price, oldPrice)) continue;

          const slug = prod.slug ? prod.slug.trim() : '';
          const sourceUrl = slug ? `https://thrash.ua/product/${slug}` : 'https://thrash.ua/promotions/campaigns';
          const catInfo = categorizeProduct(prod.title, storeKey);

          const thrashBrand = extractBrandFromTitle(prod.title, null);
          validItems.push({
            sourceStore: storeKey,
            sourceStoreName: storeName,
            title: prod.title.trim(),
            brand: thrashBrand,
            producerBrand: thrashBrand,
            ean: null,
            mainCategory: catInfo.mainCategory,
            subCategory: catInfo.subCategory,
            category: catInfo.category,
            unit: prod.weight || 'шт',
            price: Number(price.toFixed(2)),
            oldPrice: Number(oldPrice.toFixed(2)),
            promoTag: cmp.title ? `Акція: ${cmp.title}` : 'Суперціна Траш!',
            sourceUrl
          });
        }
      } catch (_) {}
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка запиту GraphQL (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 4. AVRORA Official Web Storefront Parser ───────────────────────────── */
async function fetchAvroraPromotions() {
  const storeKey = 'avrora';
  const storeName = 'Аврора';
  const validItems = [];

  try {
    const res = await fetchWithTimeout('https://avrora.ua/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'uk-UA,uk;q=0.9'
      }
    }, 5000);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const seenUrls = new Set();

      $('.ty-grid-list__item').each((i, el) => {
        const title = $(el).find('.ty-grid-list__item-name a').text().trim() ||
                      $(el).find('a[href*="avrora.ua/"]').attr('title') ||
                      $(el).find('img').attr('alt') || '';
        const href = $(el).find('a').attr('href') || '';
        const price = parsePriceValue($(el).find('.ty-price-num').first().text());
        const oldPrice = parsePriceValue($(el).find('.ty-strike .ty-price-num, .ty-list-price, [id*="old_price"]').first().text());

        if (title && href && href.startsWith('https://avrora.ua/') && isValidProductPrice(title, price, oldPrice)) {
          if (!seenUrls.has(href)) {
            seenUrls.add(href);
            const catInfo = categorizeProduct(title, storeKey);
            const avroraTitle = title.replace(/\s+/g, ' ').trim();
            const avroraBrand = extractBrandFromTitle(avroraTitle, null);
            validItems.push({
              sourceStore: storeKey,
              sourceStoreName: storeName,
              title: avroraTitle,
              brand: avroraBrand,
              producerBrand: avroraBrand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: 'шт',
              price: Number(price.toFixed(2)),
              oldPrice: Number(oldPrice.toFixed(2)),
              promoTag: 'Суперціна Аврора',
              sourceUrl: href
            });
          }
        }
      });
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка парсингу (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 5. RUKAVYCHKA Official Market Catalog Specials Parser ──────────────── */
async function fetchRukavychkaPromotions() {
  const storeKey = 'rukavychka';
  const storeName = 'Рукавичка';
  const validItems = [];
  const seenUrls = new Set();

  try {
    const rukHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'uk-UA,uk;q=0.9'
    };
    const fetchRukPage = (p) => fetchWithTimeout(`https://market.rukavychka.ua/specials/?page=${p}`, {
      headers: rukHeaders
    }, 4500).then(res => (res.ok ? res.text() : null)).catch(() => null);

    const wave1 = await Promise.allSettled([1, 2, 3].map(fetchRukPage));
    const fetchResults = [...wave1];
    const page3Html = wave1[2]?.status === 'fulfilled' ? wave1[2].value : null;
    if (page3Html && (page3Html.includes('fm-module-item') || page3Html.includes('product-layout'))) {
      const wave2 = await Promise.allSettled([4, 5].map(fetchRukPage));
      fetchResults.push(...wave2);
    }

    for (const settled of fetchResults) {
      if (settled.status !== 'fulfilled' || !settled.value) continue;
      try {
        const html = settled.value;
        const $ = cheerio.load(html);

        $('.fm-module-item, .product-layout, .fm-category-product-caption').each((i, el) => {
          const titleEl = $(el)
            .find('.fm-module-title a, .caption h4 a, .fm-category-product-title a, a[href*="market.rukavychka.ua/"]')
            .filter((_, a) => $(a).text().trim().length > 2)
            .first();
          const title = titleEl.text().trim();
          const href = titleEl.attr('href') || $(el).find('a[href*="market.rukavychka.ua/"]').first().attr('href') || '';
          const pNewText = $(el).find('.new-special-price, .fm-module-price-new, .price-new').first().text().trim();
          const pOldText = $(el).find('.old-special-price, .fm-module-price-old, .price-old').first().text().trim();

          const price = parsePriceValue(pNewText);
          const oldPrice = parsePriceValue(pOldText);

          if (title && href && isValidProductPrice(title, price, oldPrice) && !seenUrls.has(href)) {
            seenUrls.add(href);
            const catInfo = categorizeProduct(title, storeKey);
            const rukTitle = title.replace(/\s+/g, ' ').trim();
            const rukBrand = extractBrandFromTitle(rukTitle, null);
            validItems.push({
              sourceStore: storeKey,
              sourceStoreName: storeName,
              title: rukTitle,
              brand: rukBrand,
              producerBrand: rukBrand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: 'шт',
              price: Number(price.toFixed(2)),
              oldPrice: Number(oldPrice.toFixed(2)),
              promoTag: 'Акція Рукавичка',
              sourceUrl: href
            });
          }
        });
      } catch (_) {}
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка парсингу (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 5b. FORA Official EcomCatalogGlobal API Parser ──────────────────────── */
async function fetchForaPromotions() {
  const storeKey = 'fora';
  const storeName = 'Фора';
  const validItems = [];
  const seenKeys = new Set();

  try {
    const endpoint = 'https://api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal';
    const baseData = { merchantId: 2, filialId: 310, deliveryType: 1 };
    const payloads = [
      { ...baseData, From: 1, To: 150 },
      { ...baseData, From: 151, To: 300 },
      { ...baseData, From: 301, To: 450 },
      { ...baseData, From: 451, To: 600 },
      { ...baseData, From: 601, To: 750 },
      { ...baseData, From: 751, To: 900 },
      { ...baseData, From: 901, To: 1050 },
      { ...baseData, From: 1051, To: 1200 },
      { ...baseData, From: 1, To: 80, customFilter: 'promo' }
    ];
    DEPARTMENT_SEARCH_SHARDS.slice(0, 12).forEach(q => {
      payloads.push({ ...baseData, From: 1, To: 60, FindText: q });
    });

    const FORA_BATCH_SIZE = 6;
    const rawItems = [];
    for (let i = 0; i < payloads.length; i += FORA_BATCH_SIZE) {
      const batch = payloads.slice(i, i + FORA_BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map(data =>
          fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'GetSimpleCatalogItems', data })
          }, 5500).then(res => (res.ok ? res.json() : null)).catch(() => null)
        )
      );
      settled.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value?.items)) {
          rawItems.push(...r.value.items);
        }
      });
    }

    for (const item of rawItems) {
      const slug = item.slug ? String(item.slug).trim() : '';
      const key = slug || item.id;
      if (key && seenKeys.has(key)) continue;
      if (key) seenKeys.add(key);

      const title = (item.name || item.title || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;

      const price = parsePriceValue(item.price);
      const oldPrice = parsePriceValue(item.oldPrice);
      if (!oldPrice || !isValidProductPrice(title, price, oldPrice)) continue;

      const sourceUrl = slug ? `https://fora.ua/product/${slug}` : 'https://fora.ua/actions';
      if (!isStoreUrlConsistent(storeKey, sourceUrl)) continue;

      const apiCategory = Array.isArray(item.categories) && item.categories[0]?.name ? item.categories[0].name : '';
      const catInfo = categorizeProduct(title, storeKey, apiCategory);
      const brand = extractBrandFromTitle(title, item.brand || null);

      validItems.push({
        sourceStore: storeKey,
        sourceStoreName: storeName,
        title,
        brand,
        producerBrand: brand,
        ean: null,
        mainCategory: catInfo.mainCategory,
        subCategory: catInfo.subCategory,
        category: catInfo.category,
        unit: item.unit ? String(item.unit).trim() : 'шт',
        price: Number(price.toFixed(2)),
        oldPrice: Number(oldPrice.toFixed(2)),
        promoTag: item.promoTitle ? String(item.promoTitle).trim() : 'Акція Фора',
        sourceUrl
      });
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка API (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 5c. PROSTOR Magento 2 Promotion Scraper ────────────────────────────── */
async function fetchProstorPromotions() {
  const storeKey = 'prostor';
  const storeName = 'Prostor';
  const validItems = [];
  const seenUrls = new Set();

  try {
    const pageUrls = [
      'https://prostor.ua/ua/aktsii/supertseny/',
      'https://prostor.ua/ua/aktsii/supertseny/?p=2',
      'https://prostor.ua/ua/aktsii/supertseny/?p=3',
      'https://prostor.ua/ua/aktsii/supertseny/?p=4',
      'https://prostor.ua/ua/aktsii/supertseny/?p=5',
      'https://prostor.ua/ua/aktsii/supertseny/?p=6'
    ];
    const settled = await Promise.allSettled(
      pageUrls.map(u =>
        fetchWithTimeout(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'uk-UA,uk;q=0.9'
          }
        }, 5500).then(res => (res.ok ? res.text() : null))
      )
    );

    for (const res of settled) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      try {
        const $ = cheerio.load(res.value);
        $('.product-item').each((_, el) => {
          const linkEl = $(el).find('.product-item-link').first();
          const title = linkEl.text().replace(/\s+/g, ' ').trim();
          let href = (linkEl.attr('href') || '').trim();
          if (href && !href.startsWith('http')) href = 'https://prostor.ua' + href;

          const pNewText = $(el).find('.special-price .price, [data-price-type="finalPrice"] .price, [data-price-type="finalPrice"]').first().text().trim();
          const pOldText = $(el).find('.old-price .price, [data-price-type="oldPrice"] .price, [data-price-type="oldPrice"]').first().text().trim();
          const price = parsePriceValue(pNewText);
          const oldPrice = parsePriceValue(pOldText);

          if (title && href && !seenUrls.has(href) && isStoreUrlConsistent(storeKey, href) && isValidProductPrice(title, price, oldPrice)) {
            seenUrls.add(href);
            const catInfo = categorizeProduct(title, storeKey);
            const brand = extractBrandFromTitle(title, null);
            validItems.push({
              sourceStore: storeKey,
              sourceStoreName: storeName,
              title,
              brand,
              producerBrand: brand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: extractNormalizedUnit(title) || 'шт',
              price: Number(price.toFixed(2)),
              oldPrice: Number(oldPrice.toFixed(2)),
              promoTag: 'Суперціна Prostor',
              sourceUrl: href
            });
          }
        });
      } catch (_) {}
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка парсингу (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 5d. VARUS Official Promo & JSON-LD / SSR Scraper ────────────────────── */
async function fetchVarusPromotions() {
  const storeKey = 'varus';
  const storeName = 'VARUS';
  const validItems = [];
  const seenUrls = new Set();

  try {
    const urls = ['https://varus.ua/price-of-the-week', 'https://varus.ua/promotions'];
    const settled = await Promise.allSettled(
      urls.map(u =>
        fetchWithTimeout(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'uk-UA,uk;q=0.9'
          }
        }, 6000).then(res => (res.ok ? res.text() : null))
      )
    );

    const decodeJsonStr = s => {
      try {
        return JSON.parse('"' + String(s || '').replace(/"/g, '\\"') + '"');
      } catch (_) {
        return String(s || '');
      }
    };

    for (const res of settled) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const html = res.value;
      const priceMapBySlug = new Map();

      // Capture SSR product prices {"slug": ..., "regular_price": ..., "final_price": ...}
      const ssrPriceRegex = /"slug":"([a-z0-9-]+)"[^}]{0,600}"regular_price":([\d.]+),"final_price":([\d.]+)/gi;
      let m;
      while ((m = ssrPriceRegex.exec(html)) !== null) {
        const slug = m[1];
        const reg = parseFloat(m[2]);
        const fin = parseFloat(m[3]);
        if (slug && fin > 0 && reg > fin) {
          priceMapBySlug.set(slug, { price: fin, oldPrice: reg });
        }
      }

      // Parse JSON-LD ItemList products
      try {
        const $ = cheerio.load(html);
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsed = JSON.parse($(el).html() || '{}');
            const list = parsed?.itemListElement;
            if (!Array.isArray(list)) return;
            list.forEach(entry => {
              const prod = entry?.item || entry;
              const title = (prod?.name || '').replace(/\s+/g, ' ').trim();
              const href = (prod?.url || '').trim();
              if (!title || !href || seenUrls.has(href) || !isStoreUrlConsistent(storeKey, href)) return;

              const slug = href.replace(/^https?:\/\/varus\.ua\//i, '').replace(/\/$/, '');
              const ssrPrices = priceMapBySlug.get(slug);
              const price = ssrPrices ? ssrPrices.price : parsePriceValue(prod?.offers?.price);
              const oldPrice = ssrPrices ? ssrPrices.oldPrice : null;

              if (!isValidProductPrice(title, price, oldPrice)) return;
              seenUrls.add(href);

              const catInfo = categorizeProduct(title, storeKey);
              const brand = extractBrandFromTitle(title, prod?.brand?.name || null);
              validItems.push({
                sourceStore: storeKey,
                sourceStoreName: storeName,
                title,
                brand,
                producerBrand: brand,
                ean: null,
                mainCategory: catInfo.mainCategory,
                subCategory: catInfo.subCategory,
                category: catInfo.category,
                unit: extractNormalizedUnit(title) || 'шт',
                price: Number(price.toFixed(2)),
                oldPrice: oldPrice ? Number(oldPrice.toFixed(2)) : null,
                promoTag: 'Ціна тижня VARUS',
                sourceUrl: href
              });
            });
          } catch (_) {}
        });
      } catch (_) {}

      // Also capture additional SSR promo products that have name + slug + regular_price > final_price
      const slugAnchorRegex = /"slug":"([a-z0-9-]+)"/gi;
      while ((m = slugAnchorRegex.exec(html)) !== null) {
        const slug = m[1];
        const href = `https://varus.ua/${slug}`;
        if (!slug || seenUrls.has(href)) continue;
        const ahead = html.slice(m.index, m.index + 800);
        const priceMatch = ahead.match(/"regular_price":([\d.]+),"final_price":([\d.]+)/);
        if (!priceMatch) continue;
        const reg = parseFloat(priceMatch[1]);
        const fin = parseFloat(priceMatch[2]);
        if (reg <= fin) continue;

        const behind = html.slice(Math.max(0, m.index - 3000), m.index);
        const nameMatches = [...behind.matchAll(/"name":"((?:\\.|[^"\\]){4,180})"/g)];
        if (nameMatches.length === 0) continue;
        const rawTitle = nameMatches[nameMatches.length - 1][1];
        const title = decodeJsonStr(rawTitle).replace(/\s+/g, ' ').trim();
        if (!title || !isValidProductPrice(title, fin, reg)) continue;

        seenUrls.add(href);
        const catInfo = categorizeProduct(title, storeKey);
        const brand = extractBrandFromTitle(title, null);
        validItems.push({
          sourceStore: storeKey,
          sourceStoreName: storeName,
          title,
          brand,
          producerBrand: brand,
          ean: null,
          mainCategory: catInfo.mainCategory,
          subCategory: catInfo.subCategory,
          category: catInfo.category,
          unit: extractNormalizedUnit(title) || 'шт',
          price: Number(fin.toFixed(2)),
          oldPrice: Number(reg.toFixed(2)),
          promoTag: 'Ціна тижня VARUS',
          sourceUrl: href
        });
      }
    }
  } catch (err) {
    console.log(`[LIVE SYNC] [${storeName}] Помилка парсингу (${err.message})`);
  }

  console.log(`[LIVE SYNC] [${storeName}] Отримано ${validItems.length} акційних позицій із реальними знижками.`);
  return {
    store: storeKey,
    storeName,
    status: validItems.length > 0 ? 200 : 0,
    items: validItems,
    error: validItems.length > 0 ? null : 'Немає позицій'
  };
}

/* ─── 6. Additional Regional Chains (Graceful Public Check) ──────────────── */
async function fetchAdditionalPublicPromos(storeKey, storeName, testUrl) {
  try {
    const res = await fetchWithTimeout(testUrl, {}, 3500);
    if (!res.ok) {
      return { store: storeKey, storeName, status: res.status, items: [], error: `HTTP ${res.status}` };
    }
    return { store: storeKey, storeName, status: 200, items: [], error: null };
  } catch (err) {
    return { store: storeKey, storeName, status: 0, items: [], error: err.message };
  }
}

/* ─── 6b. Stealth Browser Context (Cloudflare Bypass via Puppeteer-Core) ─ */
function findLocalBrowserExecutable() {
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidatePaths = [
    // Windows paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux / GitHub Actions / Cloud paths
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ].filter(Boolean);

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

async function scrapeStealthBrowserStores(fastScraperStats = [], cityId = 'ivano-frankivsk', options = {}) {
  const browserResults = {
    atb: { store: 'atb', storeName: 'АТБ-Маркет', status: 0, items: [], error: null },
    eva: { store: 'eva', storeName: 'EVA', status: 0, items: [], error: null }
  };

  const thrashStat = fastScraperStats.find(s => s.store === 'thrash');
  const avroraStat = fastScraperStats.find(s => s.store === 'avrora');
  const needThrashFallback = !thrashStat || (thrashStat.error !== 'Немає в цьому місті' && (!thrashStat.items || thrashStat.items.length === 0));
  const needAvroraFallback = !avroraStat || (avroraStat.error !== 'Немає в цьому місті' && (!avroraStat.items || avroraStat.items.length === 0));

  if (options.skipAtb && options.skipEva && !needThrashFallback && !needAvroraFallback) {
    return browserResults;
  }

  if (!puppeteer) {
    console.log('[Puppeteer] Модуль puppeteer-core не знайдено, пропускаємо браузерні скрапери.');
    browserResults.atb.error = 'puppeteer-core не інстальовано';
    browserResults.eva.error = 'puppeteer-core не інстальовано';
    return browserResults;
  }

  const exePath = findLocalBrowserExecutable();
  if (!exePath) {
    console.log('[Puppeteer] Локальний браузер Chrome/Edge не виявлено, браузерний обхід пропущено.');
    browserResults.atb.error = 'Браузер не виявлено';
    browserResults.eva.error = 'Браузер не виявлено';
    return browserResults;
  }

  console.log(`[Puppeteer] Запуск прихованого браузера (${path.basename(exePath)}) для обходу Cloudflare...`);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      executablePath: exePath,
      headless: 'new',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1366,768'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // ── a) АТБ-МАРКЕТ (Обхід Cloudflare та вилучення .catalog-item) ──
    if (!options.skipAtb) {
      try {
        console.log('[Puppeteer] [АТБ-Маркет] Отримання акційних пропозицій (economy, sale_tovari, znyzhky)...');
        const atbUrls = [
          'https://www.atbmarket.com/promo/economy',
          'https://www.atbmarket.com/promo/economy?page=2',
          'https://www.atbmarket.com/promo/sale_tovari',
          'https://www.atbmarket.com/promo/sale_tovari?page=2',
          'https://www.atbmarket.com/promo/znyzhky'
        ];
        const seenAtb = new Set();
        const atbItems = [];

        for (const u of atbUrls) {
          try {
            await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForSelector('.catalog-item', { timeout: 4000 }).catch(() => {});
            const extracted = await page.evaluate(() => {
              const list = [];
              document.querySelectorAll('.catalog-item').forEach(el => {
                const titleEl = el.querySelector('.catalog-item__title a');
                const topPrice = el.querySelector('.product-price__top');
                const btmPrice = el.querySelector('.product-price__bottom');
                if (titleEl && topPrice) {
                  const title = titleEl.textContent.trim();
                  const pClean = topPrice.textContent.replace(/[^\d.]/g, '');
                  const oldClean = btmPrice ? btmPrice.textContent.replace(/[^\d.]/g, '') : null;
                  const price = parseFloat(pClean);
                  const oldPrice = oldClean ? parseFloat(oldClean) : null;
                  let href = titleEl.getAttribute('href') || '';
                  if (href && !href.startsWith('http')) href = 'https://www.atbmarket.com' + href;
                  if (title && price > 0 && oldPrice > price && href) {
                    list.push({ title, price, oldPrice, sourceUrl: href });
                  }
                }
              });
              return list;
            });

            extracted.forEach(it => {
              if (!seenAtb.has(it.sourceUrl) && it.sourceUrl.includes('atbmarket.com') && isValidProductPrice(it.title, it.price, it.oldPrice)) {
                seenAtb.add(it.sourceUrl);
                const catInfo = categorizeProduct(it.title, 'atb');
                const atbTitle = it.title.replace(/\s+/g, ' ').trim();
                const atbBrand = extractBrandFromTitle(atbTitle, null);
                atbItems.push({
                  sourceStore: 'atb',
                  sourceStoreName: 'АТБ-Маркет',
                  title: atbTitle,
                  brand: atbBrand,
                  producerBrand: atbBrand,
                  ean: null,
                  mainCategory: catInfo.mainCategory,
                  subCategory: catInfo.subCategory,
                  category: catInfo.category,
                  unit: 'шт',
                  price: Number(it.price.toFixed(2)),
                  oldPrice: Number(it.oldPrice.toFixed(2)),
                  promoTag: 'Економія АТБ',
                  sourceUrl: it.sourceUrl
                });
              }
            });
          } catch (err) {
            console.warn(`[Puppeteer] [АТБ] Помилка на ${u}:`, err.message);
          }
        }

        console.log(`[LIVE SYNC] [АТБ-Маркет] Отримано ${atbItems.length} акційних позицій через Puppeteer-обхід Cloudflare.`);
        browserResults.atb = {
          store: 'atb',
          storeName: 'АТБ-Маркет',
          status: atbItems.length > 0 ? 200 : 0,
          items: atbItems,
          error: atbItems.length > 0 ? null : 'Не знайдено карток'
        };
      } catch (err) {
        console.warn('[Puppeteer] [АТБ-Маркет] Загальна помилка:', err.message);
        browserResults.atb.error = err.message;
      }
    }

    // ── b) EVA (Вилучення реальних акційних позицій [data-testid="product-card"]) ──
    if (!options.skipEva) {
      try {
        console.log('[Puppeteer] [EVA] Отримання акційних пропозицій (cat-garage-sale)...');
        await page.goto('https://eva.ua/ua/cat-garage-sale/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 4000));
        const evaExtracted = await page.evaluate(() => {
          const cards = document.querySelectorAll('[data-testid*="product-card"]');
          const res = [];
          cards.forEach(c => {
            const brand = c.querySelector('[data-testid="product-brand"]')?.textContent.trim() || '';
            const name = c.querySelector('[data-testid="product-name"]')?.textContent.trim() || '';
            const oldPriceText = c.querySelector('[data-testid="product-price"]')?.textContent.trim() || '';
            const priceText = c.querySelector('[data-testid="product-final-price"]')?.textContent.trim() || '';
            const link = c.querySelector('a[href*="/ua/pr"]')?.getAttribute('href') || '';
            
            const cleanNum = t => parseFloat(t.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
            const oldPrice = cleanNum(oldPriceText);
            const price = cleanNum(priceText);
            const title = (brand ? brand + ' ' + name : name).trim();
            let sourceUrl = link;
            if (sourceUrl && !sourceUrl.startsWith('http')) sourceUrl = 'https://eva.ua' + sourceUrl;

            if (title && price > 0 && oldPrice > price && sourceUrl && sourceUrl.includes('eva.ua')) {
              res.push({ title, brand, price, oldPrice, sourceUrl });
            }
          });
          return res;
        });

        const seenEva = new Set();
        const evaItems = [];
        evaExtracted.forEach(it => {
          if (!seenEva.has(it.sourceUrl) && it.sourceUrl.includes('eva.ua') && isValidProductPrice(it.title, it.price, it.oldPrice)) {
            seenEva.add(it.sourceUrl);
            const evaTitle = it.title.replace(/\s+/g, ' ').trim();
            const evaBrand = extractBrandFromTitle(evaTitle, it.brand || null);
            const catInfo = categorizeProduct(evaTitle, 'eva');
            evaItems.push({
              sourceStore: 'eva',
              sourceStoreName: 'EVA',
              title: evaTitle,
              brand: evaBrand,
              producerBrand: evaBrand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: 'шт',
              price: Number(it.price.toFixed(2)),
              oldPrice: Number(it.oldPrice.toFixed(2)),
              promoTag: 'Зіркові знахідки EVA',
              sourceUrl: it.sourceUrl
            });
          }
        });

        console.log(`[LIVE SYNC] [EVA] Отримано ${evaItems.length} акційних позицій через Puppeteer-обхід Cloudflare.`);
        browserResults.eva = {
          store: 'eva',
          storeName: 'EVA',
          status: evaItems.length > 0 ? 200 : 0,
          items: evaItems,
          error: evaItems.length > 0 ? null : 'Не знайдено карток'
        };
      } catch (err) {
        console.warn('[Puppeteer] [EVA] Загальна помилка:', err.message);
        browserResults.eva.error = err.message;
      }
    }

    // ── c) Траш! Fallback (якщо GraphQL не повернув акцій) ──
    if (needThrashFallback) {
      try {
        console.log('[Puppeteer] [Траш!] Запуск fallback браузерного парсингу https://thrash.ua/promotions/campaigns ...');
        await page.goto('https://thrash.ua/promotions/campaigns', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        const thrashExtracted = await page.evaluate(() => {
          const list = [];
          document.querySelectorAll('a[href*="/product/"], [class*="product-card"]').forEach(el => {
            const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href*="/product/"]');
            const titleEl = el.querySelector('[class*="title"], [class*="name"]') || linkEl;
            const priceEl = el.querySelector('[class*="price-new"], [class*="current"]');
            const oldPriceEl = el.querySelector('[class*="price-old"], [class*="old"], s, del');
            if (linkEl && titleEl && priceEl && oldPriceEl) {
              const title = titleEl.textContent.trim();
              const price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, ''));
              const oldPrice = parseFloat(oldPriceEl.textContent.replace(/[^\d.]/g, ''));
              let href = linkEl.getAttribute('href') || '';
              if (href && !href.startsWith('http')) href = 'https://thrash.ua' + href;
              if (title && price > 0 && oldPrice > price && href) {
                list.push({ title, price, oldPrice, sourceUrl: href });
              }
            }
          });
          return list;
        });

        const cleanThrash = thrashExtracted.filter(it => isValidProductPrice(it.title, it.price, it.oldPrice));
        if (cleanThrash.length > 0) {
          const items = cleanThrash.map(it => {
            const catInfo = categorizeProduct(it.title, 'thrash');
            const fbThrashBrand = extractBrandFromTitle(it.title, null);
            return {
              sourceStore: 'thrash',
              sourceStoreName: 'Траш!',
              title: it.title,
              brand: fbThrashBrand,
              producerBrand: fbThrashBrand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: 'шт',
              price: Number(it.price.toFixed(2)),
              oldPrice: Number(it.oldPrice.toFixed(2)),
              promoTag: 'Суперціна Траш!',
              sourceUrl: it.sourceUrl
            };
          });
          browserResults.thrashFallback = {
            store: 'thrash',
            storeName: 'Траш!',
            status: 200,
            items,
            error: null
          };
        }
      } catch (e) {
        console.warn('[Puppeteer] [Траш!] Fallback warning:', e.message);
      }
    }

    // ── d) Аврора Fallback (якщо Cheerio HTML повернув 0) ──
    if (needAvroraFallback) {
      try {
        console.log('[Puppeteer] [Аврора] Запуск fallback браузерного парсингу https://avrora.ua/ ...');
        await page.goto('https://avrora.ua/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        const avroraExtracted = await page.evaluate(() => {
          const list = [];
          document.querySelectorAll('.ty-grid-list__item').forEach(el => {
            const titleEl = el.querySelector('.ty-grid-list__item-name a, a[title]');
            const curPriceEl = el.querySelector('.ty-price-num');
            const oldPriceEl = el.querySelector('.ty-strike .ty-price-num, .ty-list-price');
            if (titleEl && curPriceEl && oldPriceEl) {
              const title = titleEl.textContent.trim();
              const price = parseFloat(curPriceEl.textContent.replace(/[^\d.]/g, ''));
              const oldPrice = parseFloat(oldPriceEl.textContent.replace(/[^\d.]/g, ''));
              let href = titleEl.getAttribute('href') || '';
              if (href && !href.startsWith('http')) href = 'https://avrora.ua' + href;
              if (title && price > 0 && oldPrice > price && href) {
                list.push({ title, price, oldPrice, sourceUrl: href });
              }
            }
          });
          return list;
        });

        const cleanAvrora = avroraExtracted.filter(it => isValidProductPrice(it.title, it.price, it.oldPrice));
        if (cleanAvrora.length > 0) {
          const items = cleanAvrora.map(it => {
            const catInfo = categorizeProduct(it.title, 'avrora');
            const fbAvroraBrand = extractBrandFromTitle(it.title, null);
            return {
              sourceStore: 'avrora',
              sourceStoreName: 'Аврора',
              title: it.title,
              brand: fbAvroraBrand,
              producerBrand: fbAvroraBrand,
              ean: null,
              mainCategory: catInfo.mainCategory,
              subCategory: catInfo.subCategory,
              category: catInfo.category,
              unit: 'шт',
              price: Number(it.price.toFixed(2)),
              oldPrice: Number(it.oldPrice.toFixed(2)),
              promoTag: 'Суперціна Аврора',
              sourceUrl: it.sourceUrl
            };
          });
          browserResults.avroraFallback = {
            store: 'avrora',
            storeName: 'Аврора',
            status: 200,
            items,
            error: null
          };
        }
      } catch (e) {
        console.warn('[Puppeteer] [Аврора] Fallback warning:', e.message);
      }
    }

  } catch (err) {
    console.error('[Puppeteer] Загальна помилка під час виконання сесії браузера:', err.message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }

  return browserResults;
}

/* ─── 7. Smart Cross-Store Matching & Deduplication Engine ───────────────── */
function computeBestPromoTag(prices = [], fallbackTag = 'Акція') {
  let maxDiscount = 0;
  for (const pr of prices) {
    const p = parseFloat(pr.price);
    const oldP = parseFloat(pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price);
    if (p > 0 && oldP > p) {
      const pct = Math.round(((oldP - p) / oldP) * 100);
      if (pct > maxDiscount) maxDiscount = pct;
    }
  }
  return maxDiscount > 0 ? `-${maxDiscount}% Акція` : (fallbackTag || 'Акція');
}

function groupAndMatchLiveProducts(scrapedItems, activeStores = null) {
  const groups = [];
  const byEan = new Map();
  const byKey = new Map();

  for (const item of scrapedItems) {
    const title = (item.title || item.name || '').trim();
    const storeStr = String(item.sourceStore || '').toLowerCase().trim();
    if (!title || !storeStr || !item.sourceUrl || !isValidProductPrice(title, item.price, item.oldPrice)) continue;
    if (activeStores && !activeStores.includes(storeStr)) continue;
    if (!isStoreUrlConsistent(storeStr, item.sourceUrl)) continue;

    const sigItem = getCanonicalProductKey({ ...item, title });
    let matchedGroup = (sigItem.ean && byEan.get(sigItem.ean)) ||
                       (sigItem.canonicalKey && byKey.get(sigItem.canonicalKey)) ||
                       null;

    if (matchedGroup) {
      if (sigItem.ean && !byEan.has(sigItem.ean)) byEan.set(sigItem.ean, matchedGroup);
      if (sigItem.canonicalKey && !byKey.has(sigItem.canonicalKey)) byKey.set(sigItem.canonicalKey, matchedGroup);
      if (title.length > matchedGroup.title.length && !title.includes('  ')) {
        matchedGroup.title = title;
      }
      if (sigItem.normalizedUnit && (!matchedGroup.unit || matchedGroup.unit === 'шт')) {
        matchedGroup.unit = sigItem.normalizedUnit;
      }
      const existing = matchedGroup.storePrices.get(storeStr);
      if (!existing || item.price < existing.price) {
        matchedGroup.storePrices.set(storeStr, {
          store: storeStr,
          price: item.price,
          oldPrice: item.oldPrice,
          sourceUrl: item.sourceUrl
        });
      }
    } else {
      const storePrices = new Map();
      storePrices.set(storeStr, {
        store: storeStr,
        price: item.price,
        oldPrice: item.oldPrice,
        sourceUrl: item.sourceUrl
      });

      const newGroup = {
        title,
        sig: sigItem,
        ean: sigItem.ean || null,
        brand: sigItem.brand || item.brand || null,
        city: item.city || null,
        mainCategory: item.mainCategory || 'Продукти',
        subCategory: item.subCategory || item.category || 'Бакалія',
        category: item.category || item.subCategory || 'Бакалія',
        unit: sigItem.normalizedUnit || item.unit || 'шт',
        promoTag: item.promoTag || 'Суперціна',
        storePrices
      };
      groups.push(newGroup);
      if (sigItem.ean) byEan.set(sigItem.ean, newGroup);
      if (sigItem.canonicalKey) byKey.set(sigItem.canonicalKey, newGroup);
    }
  }

  const now = new Date().toISOString();

  const finalProducts = groups
    .map(g => {
      const verifiedPrices = [];

      for (const p of g.storePrices.values()) {
        const storeStr = String(p.store || '').toLowerCase().trim();
        const urlStr = p.sourceUrl ? String(p.sourceUrl).trim() : '';
        const numPrice = Number((parseFloat(p.price) || 0).toFixed(2));
        const numOld = (p.oldPrice && !isNaN(parseFloat(p.oldPrice)))
          ? Number(parseFloat(p.oldPrice).toFixed(2))
          : null;

        if (!storeStr || isNaN(numPrice) || numPrice <= 0 || !urlStr) continue;
        if (!isValidProductPrice(g.title, numPrice, numOld)) continue;
        if (activeStores && !activeStores.includes(storeStr)) continue;
        if (!isStoreUrlConsistent(storeStr, urlStr)) {
          console.warn(`[DROPPED INCONSISTENT PRICE] Store: ${storeStr}, URL: ${urlStr}`);
          continue;
        }

        verifiedPrices.push({
          store: storeStr,
          price: numPrice,
          oldPrice: (numOld && numOld > numPrice) ? numOld : null,
          old_price: (numOld && numOld > numPrice) ? numOld : null,
          sourceUrl: urlStr
        });
      }

      verifiedPrices.sort((a, b) => a.price - b.price);
      const promoTag = computeBestPromoTag(verifiedPrices, g.promoTag);

      return {
        name: g.title,
        title: g.title,
        ...(g.brand ? { brand: g.brand } : {}),
        ...(g.ean ? { ean: g.ean } : {}),
        ...(g.city ? { city: g.city } : {}),
        mainCategory: g.mainCategory || 'Продукти',
        main_category: g.mainCategory || 'Продукти',
        subCategory: g.subCategory || g.category || 'Бакалія',
        sub_category: g.subCategory || g.category || 'Бакалія',
        category: g.category || g.subCategory || 'Бакалія',
        unit: g.unit,
        promoTag,
        promo_tag: promoTag,
        syncedAt: now,
        updated_at: now,
        prices: verifiedPrices
      };
    })
    .filter(prod => Array.isArray(prod.prices) && prod.prices.length > 0);

  return finalProducts;
}

function mergeCatalogProducts(products = [], activeStores = null) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const flatOffers = [];
  for (const p of products) {
    const title = (p.name || p.title || '').trim();
    if (!title) continue;
    for (const pr of (p.prices || [])) {
      if (!pr || !pr.store || !pr.sourceUrl) continue;
      const storeKey = String(pr.store).toLowerCase().trim();
      const catInfo = categorizeProduct(title, storeKey, '');
      flatOffers.push({
        sourceStore: storeKey,
        title,
        brand: p.brand || p.producerBrand || extractBrandFromTitle(title, null),
        ean: p.ean || null,
        city: p.city || null,
        mainCategory: catInfo.mainCategory,
        subCategory: catInfo.subCategory,
        category: catInfo.category,
        unit: p.unit || 'шт',
        price: Number(parseFloat(pr.price).toFixed(2)),
        oldPrice: (pr.oldPrice ?? pr.old_price) ? Number(parseFloat(pr.oldPrice ?? pr.old_price).toFixed(2)) : null,
        promoTag: p.promoTag || p.promo_tag || 'Акція',
        sourceUrl: pr.sourceUrl || pr.source_url
      });
    }
  }
  return groupAndMatchLiveProducts(flatOffers, activeStores);
}

let latestSyncStats = [];
const storeSyncCache = new Map();
const STORE_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Main live promotion sync coordinator with City-Specific Local Store Price Sync.
 * Prioritizes Western Ukraine (default: ivano-frankivsk)
 */
async function syncLivePromotions(cityId = 'ivano-frankivsk', options = {}) {
  const cityConfig = getCityConfig(cityId);
  console.log(`>>> [LIVE SYNC] Початок синхронізації цін для міста: ${cityConfig.name} (${cityConfig.region})...`);
  latestSyncStats = [];

  const resolvedZakazStores = await resolveDynamicZakazStores(cityConfig.zakazStores, cityId);
  const storeTasks = [];

  // 1. СІЛЬПО (Local Branch or multi-city branches for 'all')
  if (cityConfig.activeStores.includes('silpo')) {
    const silpoBranchInput = cityId === 'all'
      ? (cityConfig.silpoBranches || [cityConfig.silpoBranchId, '1edb7f8c-b411-6470-9b48-35b9d501aa1b'])
      : cityConfig.silpoBranchId;
    storeTasks.push(fetchSilpoAllPromotions(silpoBranchInput));
  } else {
    latestSyncStats.push({ store: 'silpo', storeName: 'Сільпо', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 2–9. Zakaz.ua Chains (NOVUS, METRO, AUCHAN, EPICENTR FOOD, TORBA, EKO, ULTRAMARKET, MEGAMARKET)
  const zakazChains = [
    { key: 'novus', name: 'NOVUS' },
    { key: 'metro', name: 'METRO' },
    { key: 'auchan', name: 'АШАН' },
    { key: 'epicentrk_food', name: 'Епіцентр Food' },
    { key: 'torba', name: 'Торба' },
    { key: 'eko', name: 'ЕКО-Маркет' },
    { key: 'ultramarket', name: 'Ультрамаркет' },
    { key: 'megamarket', name: 'МегаМаркет' }
  ];

  const activeZakazQueue = [];
  zakazChains.forEach(chain => {
    const rawIds = resolvedZakazStores[chain.key] || [];
    const storeIds = cityId === 'all' ? rawIds.slice(0, 1) : rawIds.slice(0, 2);
    if (cityConfig.activeStores.includes(chain.key) && storeIds.length > 0) {
      activeZakazQueue.push({ key: chain.key, name: chain.name, storeIds });
    } else if (!cityConfig.activeStores.includes(chain.key)) {
      latestSyncStats.push({ store: chain.key, storeName: chain.name, status: 0, items: [], error: 'Немає в цьому місті' });
    } else {
      latestSyncStats.push({ store: chain.key, storeName: chain.name, status: 0, items: [], error: 'Філію Zakaz не знайдено' });
    }
  });

  // Pace Zakaz.ua chains in pairs to prevent anti-burst 429/connection drops when syncing all cities
  activeZakazQueue.forEach((chain, idx) => {
    const pairDelayMs = Math.floor(idx / 2) * 350;
    storeTasks.push((async () => {
      if (pairDelayMs > 0) await new Promise(r => setTimeout(r, pairDelayMs));
      return fetchZakazStoreMulti(chain.key, chain.name, chain.storeIds);
    })());
  });

  // 10. ФОРА (EcomCatalogGlobal JSON API)
  if (cityConfig.activeStores.includes('fora')) {
    storeTasks.push(fetchForaPromotions());
  } else {
    latestSyncStats.push({ store: 'fora', storeName: 'Фора', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 11. ТРАШ! (Thrash! GraphQL)
  if (cityConfig.activeStores.includes('thrash')) {
    storeTasks.push(fetchThrashPromotions());
  } else {
    latestSyncStats.push({ store: 'thrash', storeName: 'Траш!', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 12. АВРОРА (CS-Cart storefront)
  if (cityConfig.activeStores.includes('avrora')) {
    storeTasks.push(fetchAvroraPromotions());
  } else {
    latestSyncStats.push({ store: 'avrora', storeName: 'Аврора', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 13. РУКАВИЧКА (OpenCart specials)
  if (cityConfig.activeStores.includes('rukavychka')) {
    storeTasks.push(fetchRukavychkaPromotions());
  } else {
    latestSyncStats.push({ store: 'rukavychka', storeName: 'Рукавичка', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 14. PROSTOR (Magento 2 HTML)
  if (cityConfig.activeStores.includes('prostor')) {
    storeTasks.push(fetchProstorPromotions());
  } else {
    latestSyncStats.push({ store: 'prostor', storeName: 'Prostor', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 15. VARUS (JSON-LD & SSR Promo State)
  if (cityConfig.activeStores.includes('varus')) {
    storeTasks.push(fetchVarusPromotions());
  } else {
    latestSyncStats.push({ store: 'varus', storeName: 'VARUS', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 16. Regional / Protected chains (graceful check)
  const remainingRegional = [
    { store: 'velmart', name: 'Велмарт', url: 'https://velmart.ua/aktsijni-propozytsiyi/' },
    { store: 'simi', name: 'Сімі', url: 'https://simi.ua/' },
    { store: 'blyzenko', name: 'Близенько', url: 'https://blyzenko.ua/wp-json/' },
    { store: 'taistra', name: 'Тайстра', url: 'https://taistra.com.ua/' },
    { store: 'arsen', name: 'Арсен', url: 'https://arsen.ua/' },
    { store: 'sviy_market', name: 'Свій Маркет', url: 'https://sviymarket.com/' },
    { store: 'nash_kray', name: 'Наш Край', url: 'https://nashkraj.ua/' },
    { store: 'spar', name: 'SPAR', url: 'https://spar.ua/' },
    { store: 'epicentr', name: 'Епіцентр', url: 'https://epicentrk.ua/' }
  ];

  remainingRegional.forEach(r => {
    if (cityConfig.activeStores.includes(r.store)) {
      storeTasks.push(fetchAdditionalPublicPromos(r.store, r.name, r.url));
    } else {
      latestSyncStats.push({ store: r.store, storeName: r.name, status: 0, items: [], error: 'Немає в цьому місті' });
    }
  });

  const settled = await Promise.allSettled(storeTasks);

  settled.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      latestSyncStats.push(res.value);
    }
  });

  const fastMode = Boolean(options && options.fastMode);
  const nowTs = Date.now();
  const cachedAtb = storeSyncCache.get(`${cityId}:atb`);
  const cachedEva = storeSyncCache.get(`${cityId}:eva`);
  const hasFreshAtb = Boolean(fastMode && cachedAtb && Array.isArray(cachedAtb.items) && cachedAtb.items.length > 0 && (nowTs - cachedAtb.ts) < STORE_CACHE_TTL_MS);
  const hasFreshEva = Boolean(fastMode && cachedEva && Array.isArray(cachedEva.items) && cachedEva.items.length > 0 && (nowTs - cachedEva.ts) < STORE_CACHE_TTL_MS);
  const skipAtb = !cityConfig.activeStores.includes('atb') || hasFreshAtb;
  const skipEva = !cityConfig.activeStores.includes('eva') || hasFreshEva;

  // 10. Stealth Browser Context (Cloudflare Bypass for АТБ, EVA, and fallbacks)
  const browserResults = await scrapeStealthBrowserStores(latestSyncStats, cityId, { skipAtb, skipEva });

  if (!cityConfig.activeStores.includes('atb')) {
    latestSyncStats.push({ store: 'atb', storeName: 'АТБ-Маркет', status: 0, items: [], error: 'Немає в цьому місті' });
  } else if (hasFreshAtb) {
    latestSyncStats.push({ store: 'atb', storeName: 'АТБ-Маркет', status: 200, items: cachedAtb.items, error: null, fromCache: true });
  } else if (browserResults.atb) {
    latestSyncStats.push(browserResults.atb);
  }

  if (!cityConfig.activeStores.includes('eva')) {
    latestSyncStats.push({ store: 'eva', storeName: 'EVA', status: 0, items: [], error: 'Немає в цьому місті' });
  } else if (hasFreshEva) {
    latestSyncStats.push({ store: 'eva', storeName: 'EVA', status: 200, items: cachedEva.items, error: null, fromCache: true });
  } else if (browserResults.eva) {
    latestSyncStats.push(browserResults.eva);
  }

  if (browserResults.thrashFallback && browserResults.thrashFallback.items.length > 0 && cityConfig.activeStores.includes('thrash')) {
    const existingThrashIdx = latestSyncStats.findIndex(s => s.store === 'thrash');
    if (existingThrashIdx >= 0) {
      latestSyncStats[existingThrashIdx] = browserResults.thrashFallback;
    } else {
      latestSyncStats.push(browserResults.thrashFallback);
    }
  }

  if (browserResults.avroraFallback && browserResults.avroraFallback.items.length > 0 && cityConfig.activeStores.includes('avrora')) {
    const existingAvrIdx = latestSyncStats.findIndex(s => s.store === 'avrora');
    if (existingAvrIdx >= 0) {
      latestSyncStats[existingAvrIdx] = browserResults.avroraFallback;
    } else {
      latestSyncStats.push(browserResults.avroraFallback);
    }
  }

  // Reconcile per-store cache: save fresh >0 results and fall back to fresh cache if an active store returns 0
  const liveScraped = [];
  const cacheTs = Date.now();
  latestSyncStats.forEach(stat => {
    if (!stat || !stat.store) return;
    const cacheKey = `${cityId}:${stat.store}`;
    if (Array.isArray(stat.items) && stat.items.length > 0) {
      if (!stat.fromCache) {
        storeSyncCache.set(cacheKey, { items: stat.items, ts: cacheTs });
      }
      liveScraped.push(...stat.items);
    } else if (cityConfig.activeStores.includes(stat.store)) {
      const cached = storeSyncCache.get(cacheKey);
      if (cached && Array.isArray(cached.items) && cached.items.length > 0 && (cacheTs - cached.ts) < STORE_CACHE_TTL_MS) {
        stat.items = cached.items;
        stat.status = 200;
        stat.fromCache = true;
        stat.error = null;
        liveScraped.push(...cached.items);
      }
    }
  });

  console.log(`>>> [LIVE SYNC] [${cityConfig.name}] Загалом отримано ${liveScraped.length} живих акційних пропозицій.`);

  if (liveScraped.length > 0) {
    const finalCatalog = groupAndMatchLiveProducts(liveScraped, cityConfig.activeStores);
    finalCatalog.stats = latestSyncStats;
    finalCatalog.city = cityId;

    const multiStoreCount = finalCatalog.filter(p => p.prices && p.prices.length >= 2).length;
    console.log(`>>> [LIVE SYNC] [${cityConfig.name}] Каталог успішно сформовано: ${finalCatalog.length} унікальних товарів.`);
    console.log(`>>> [LIVE SYNC] [${cityConfig.name}] Знайдено перетинів цін між різними супермаркетами (2+ мережі): ${multiStoreCount} товарів.`);

    return finalCatalog;
  }

  console.error(`❌ [LIVE SYNC] [${cityConfig.name}] Жоден супермаркет не повернув даних з публічних API.`);
  const emptyCatalog = [];
  emptyCatalog.stats = latestSyncStats;
  emptyCatalog.city = cityId;
  return emptyCatalog;
}

function getLatestSyncStats() {
  return latestSyncStats;
}

/**
 * Returns live status and product counts for all 26 supported retail chains in the given city.
 */
let localStoreStatusCache = { mtimeMs: -1, products: [] };

function getStoresStatus(cityId = 'ivano-frankivsk') {
  const cityConfig = getCityConfig(cityId);
  const countsByStore = {};
  try {
    const localStorePath = path.resolve(__dirname, '..', 'db', 'local-store.json');
    if (fs.existsSync(localStorePath)) {
      const stat = fs.statSync(localStorePath);
      if (stat.mtimeMs !== localStoreStatusCache.mtimeMs) {
        const data = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
        localStoreStatusCache = {
          mtimeMs: stat.mtimeMs,
          products: Array.isArray(data.products) ? data.products : []
        };
      }
      localStoreStatusCache.products.forEach(p => {
        (p.prices || []).forEach(pr => {
          const s = String(pr.store || '').toLowerCase().trim();
          if (cityConfig.activeStores.includes(s)) {
            countsByStore[s] = (countsByStore[s] || 0) + 1;
          }
        });
      });
    }
  } catch (_) {}

  return ALL_18_STORES.map(s => {
    const inCity = cityConfig.activeStores.includes(s.store);
    const statItem = latestSyncStats.find(st => st.store === s.store);
    const count = inCity ? (countsByStore[s.store] || (statItem?.items ? statItem.items.length : 0)) : 0;
    let status = 'blocked_or_empty';
    if (!inCity) {
      status = 'not_in_city';
    } else if (count > 0) {
      status = 'live';
    }

    return {
      store: s.store,
      name: s.name,
      inCity,
      status,
      count,
      sourceDomain: s.defaultDomain
    };
  });
}

module.exports = {
  syncLivePromotions,
  getLatestSyncStats,
  getStoresStatus,
  findLocalBrowserExecutable,
  scrapeStealthBrowserStores,
  categorizeProduct,
  mapCategory,
  hasWord,
  normalizeHomoglyphs,
  extractBrandFromTitle,
  getCanonicalProductKey,
  normalizeProductSignature,
  areProductsMatching,
  groupAndMatchLiveProducts,
  mergeCatalogProducts,
  isStoreUrlConsistent,
  resolveStoreIdentity,
  isValidProductPrice,
  parsePriceValue,
  ALL_18_STORES,
  ALL_26_STORES: ALL_18_STORES
};
