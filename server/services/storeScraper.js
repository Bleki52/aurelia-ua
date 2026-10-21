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

/* ─── 18 Supported Ukrainian Supermarket Chains ─────────────────────────── */
const ALL_18_STORES = [
  { store: 'silpo', name: 'Сільпо', defaultDomain: 'silpo.ua' },
  { store: 'atb', name: 'АТБ-Маркет', defaultDomain: 'atbmarket.com' },
  { store: 'novus', name: 'NOVUS', defaultDomain: 'novus.zakaz.ua' },
  { store: 'metro', name: 'METRO', defaultDomain: 'metro.zakaz.ua' },
  { store: 'varus', name: 'VARUS', defaultDomain: 'varus.ua' },
  { store: 'auchan', name: 'АШАН', defaultDomain: 'auchan.zakaz.ua' },
  { store: 'epicentrk_food', name: 'Епіцентр Food', defaultDomain: 'epicentrfood.zakaz.ua' },
  { store: 'velmart', name: 'Велмарт', defaultDomain: 'velmart.ua' },
  { store: 'thrash', name: 'Траш!', defaultDomain: 'thrash.ua' },
  { store: 'simi', name: 'Сімі', defaultDomain: 'simi.ua' },
  { store: 'blyzenko', name: 'Близенько', defaultDomain: 'blyzenko.ua' },
  { store: 'taistra', name: 'Тайстра', defaultDomain: 'taistra.com.ua' },
  { store: 'arsen', name: 'Арсен', defaultDomain: 'arsen.ua' },
  { store: 'rukavychka', name: 'Рукавичка', defaultDomain: 'market.rukavychka.ua' },
  { store: 'eva', name: 'EVA', defaultDomain: 'eva.ua' },
  { store: 'prostor', name: 'Prostor', defaultDomain: 'prostor.ua' },
  { store: 'avrora', name: 'Аврора', defaultDomain: 'avrora.ua' },
  { store: 'epicentr', name: 'Епіцентр', defaultDomain: 'epicentrk.ua' }
];

/* ─── Canonical Brand Dictionary (Ukrainian / Latin Equivalents) ─────────── */
const BRAND_MAP = {
  // Coffee & Tea
  'jacobs': 'jacobs', 'якобз': 'jacobs',
  'lavazza': 'lavazza', 'лавацца': 'lavazza',
  'nescafe': 'nescafe', 'нескафе': 'nescafe',
  'greenfield': 'greenfield', 'грінфілд': 'greenfield',
  'tess': 'tess', 'тесс': 'tess',
  'lovare': 'lovare', 'ловаре': 'lovare',
  'curtis': 'curtis', 'кертіс': 'curtis',
  'idealist': 'idealist', 'ідеаліст': 'idealist',
  'monomakh': 'monomakh', 'мономах': 'monomakh',
  'ambassador': 'ambassador', 'амбасадор': 'ambassador',
  'paulig': 'paulig', 'пауліг': 'paulig',
  'illy': 'illy', 'іллі': 'illy',
  'tchibo': 'tchibo', 'чібо': 'tchibo',

  // Dairy & Cheese
  'ferma': 'ferma', 'ферма': 'ferma',
  'yagotynske': 'yagotynske', 'яготинське': 'yagotynske', 'яготинська': 'yagotynske', 'яготин': 'yagotynske',
  'galychyna': 'galychyna', 'галичина': 'galychyna',
  'prostonashe': 'prostonashe', 'простонаше': 'prostonashe', 'просто наше': 'prostonashe',
  'prostokvashyno': 'prostokvashyno', 'простоквашино': 'prostokvashyno',
  'molokiya': 'molokiya', 'молокія': 'molokiya',
  'president': 'president', 'президент': 'president',
  'komo': 'komo', 'комо': 'komo',
  'danone': 'danone', 'данон': 'danone',
  'actimel': 'actimel', 'актімель': 'actimel', 'актимель': 'actimel',
  'activia': 'activia', 'активіа': 'activia',
  'chudo': 'chudo', 'чудо': 'chudo',
  'mlekovita': 'mlekovita', 'млековіта': 'mlekovita',
  'spomlek': 'spomlek', 'спомлек': 'spomlek',
  'serenada': 'serenada', 'серенада': 'serenada',
  'slavia': 'slavia', 'славія': 'slavia',
  'bilyacerkva': 'bilyacerkva', 'білоцерківське': 'bilyacerkva',
  'deliq': 'deliq', 'deli-q': 'deliq', 'deli q': 'deliq',
  'novus': 'novus', 'metro chef': 'metrochef', 'aro': 'aro',

  // Sweets & Chocolate
  'roshen': 'roshen', 'рошен': 'roshen',
  'milka': 'milka', 'мілка': 'milka',
  'millennium': 'millennium', 'milenium': 'millennium', 'міленіум': 'millennium',
  'svitoch': 'svitoch', 'світоч': 'svitoch',
  'korona': 'korona', 'корона': 'korona',
  'nutella': 'nutella', 'нутелла': 'nutella',
  'ferrero': 'ferrero', 'ферреро': 'ferrero',
  'raffaello': 'raffaello', 'рафаелло': 'raffaello',
  'kinder': 'kinder', 'кіндер': 'kinder',
  'barni': 'barni', 'барні': 'barni',
  'lubimov': 'lubimov', 'любимов': 'lubimov', 'любімов': 'lubimov',
  'avk': 'avk', 'авк': 'avk',
  'konti': 'konti', 'конті': 'konti',

  // Grocery & Oils
  'monini': 'monini', 'моніні': 'monini',
  'oleina': 'oleina', 'олейна': 'oleina',
  'shedryidar': 'shedryidar', 'щедрий дар': 'shedryidar',
  'chumak': 'chumak', 'чумак': 'chumak',
  'torchin': 'torchin', 'торчин': 'torchin',
  'barilla': 'barilla', 'барілла': 'barilla',
  'veres': 'veres', 'верес': 'veres',
  'grinvil': 'grinvil', 'грінвіль': 'grinvil',
  'harkivmlyn': 'harkivmlyn', 'харківмлин': 'harkivmlyn',
  'makfa': 'makfa', 'макфа': 'makfa',

  // Meat & Fish
  'bashchynsky': 'bashchynsky', 'бащинський': 'bashchynsky',
  'nasharyaba': 'nasharyaba', 'наша ряба': 'nasharyaba',
  'garmash': 'garmash', 'гармаш': 'garmash',
  'alan': 'alan', 'алан': 'alan',
  'yatran': 'yatran', 'ятрань': 'yatran',
  'rancho': 'rancho', 'ранчо': 'rancho',
  'sytyidvir': 'sytyidvir', 'ситий двір': 'sytyidvir',
  'norven': 'norven', 'норвен': 'norven',
  'vodnyimir': 'vodnyimir', 'водний світ': 'vodnyimir',

  // Drinks & Water
  'coca-cola': 'cocacola', 'coca cola': 'cocacola', 'кока-кола': 'cocacola', 'кола': 'cocacola',
  'pepsi': 'pepsi', 'пепсі': 'pepsi',
  'fanta': 'fanta', 'фанта': 'fanta',
  'sprite': 'sprite', 'спрайт': 'sprite',
  'borjomi': 'borjomi', 'боржомі': 'borjomi',
  'morshynska': 'morshynska', 'моршинська': 'morshynska',
  'mirgorodska': 'mirgorodska', 'миргородська': 'mirgorodska',
  'sandora': 'sandora', 'сандора': 'sandora',
  'rich': 'rich', 'річ': 'rich',
  'sadochok': 'sadochok', 'садочок': 'sadochok',
  'chudo-chado': 'chudochado', 'чудо-чадо': 'chudochado',

  // Home & Cleaning
  'fairy': 'fairy', 'фейрі': 'fairy',
  'ariel': 'ariel', 'аріель': 'ariel',
  'persil': 'persil', 'персіл': 'persil',
  'perwoll': 'perwoll', 'перволь': 'perwoll',
  'tide': 'tide', 'тайд': 'tide',
  'domestos': 'domestos', 'доместос': 'domestos',
  'frosch': 'frosch', 'фрош': 'frosch',
  'zewa': 'zewa', 'зева': 'zewa',
  'selpak': 'selpak', 'селпак': 'selpak',
  'ruta': 'ruta', 'рута': 'ruta',
  'silan': 'silan', 'сілан': 'silan',
  'wash&free': 'washfree', 'wash & free': 'washfree',
  'ms helen': 'mshelen',

  // Beauty & Care
  'nivea': 'nivea', 'нівеа': 'nivea',
  'dove': 'dove', 'дав': 'dove',
  'palmolive': 'palmolive', 'палмолів': 'palmolive',
  'colgate': 'colgate', 'колгейт': 'colgate',
  'blend-a-med': 'blendamed', 'блендамед': 'blendamed',
  'head&shoulders': 'headshoulders', 'хеденшолдерс': 'headshoulders',
  'pantene': 'pantene', 'пантін': 'pantene',
  'garnier': 'garnier', 'гарньєр': 'garnier',
  'loreal': 'loreal', 'лореаль': 'loreal',
  'splat': 'splat', 'сплат': 'splat',
  'biomed': 'biomed', 'біомед': 'biomed',

  // Pets
  'purina': 'purina', 'пуріна': 'purina',
  'proplan': 'proplan', 'проплан': 'proplan',
  'felix': 'felix', 'фелікс': 'felix',
  'whiskas': 'whiskas', 'віскас': 'whiskas',
  'pedigree': 'pedigree', 'педігрі': 'pedigree',
  'gourmet': 'gourmet', 'гурме': 'gourmet',
  'sheba': 'sheba', 'шеба': 'sheba',
  'kitekat': 'kitekat', 'кітікет': 'kitekat'
};

const NOISE_WORDS = new Set([
  'акція', 'знижка', 'новинка', 'хіт', 'пропозиція', 'ціна', 'тижня', 'день',
  'супер', 'вигідно', 'краща', 'топ', 'пакет', 'упаковка', 'пач', 'пляшка',
  'банка', 'вакуум', 'скло', 'пет', 'плів', 'коробка', 'стакан', 'дойпак',
  'фасовка', 'ваговий', 'вагова', 'штука', 'штучний', 'штучне', 'україна',
  'класичний', 'традиційний', 'екстра', 'добірний', 'домашній', 'преміум'
]);

const CONFLICT_VARIANTS = [
  'сулугуні', 'моцарела', 'моцарелла', 'гауда', 'маасдам', 'тильзитер', 'чеддер', 'радамер', 'камамбер', 'брі', 'пармезан', 'фета',
  'російський', 'голландський',
  'молочний', 'чорний', 'темний', 'білий', 'пористий',
  'розчинна', 'мелена', 'зернова', 'зерно', 'дріп', 'капсули',
  'зелений', 'травяний', 'яловичина', 'свинина', 'курка', 'індичка', 'лосось', 'форель', 'тунець'
];

const CORE_PRODUCT_NOUNS = new Set([
  'масло', 'сир', 'молоко', 'сметана', 'кефір', 'йогурт', 'вершки', 'ряжанка',
  'кава', 'чай', 'шоколад', 'цукерки', 'печиво', 'вафлі', 'батончик',
  'олія', 'макарони', 'спагеті', 'гречка', 'рис', 'борошно', 'цукор', 'сіль',
  'ковбаса', 'сосиски', 'салямі', 'філе', 'фарш', 'лосось', 'форель', 'тунець',
  'шампунь', 'гель', 'мило', 'порошок', 'паста', 'корм', 'відбілювач', 'плямовивідник', 'рушник'
]);

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
  } else if (u.includes('thrash.ua')) {
    detectedKey = 'thrash';
    detectedName = 'Траш!';
  } else if (u.includes('avrora.ua')) {
    detectedKey = 'avrora';
    detectedName = 'Аврора';
  } else if (u.includes('market.rukavychka.ua') || u.includes('rukavychka.ua')) {
    detectedKey = 'rukavychka';
    detectedName = 'Рукавичка';
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

/* ─── Strict 5-Stage Product Categorization Engine ───────────────────────── */
function categorizeProduct(title = '', store = '', apiCategory = '') {
  const rawTitle = String(title || '').trim();
  const rawCategory = String(apiCategory || '').trim();
  const text = (rawTitle + ' ' + rawCategory).toLowerCase();
  const storeStr = String(store || '').toLowerCase().trim();
  const isBeautyStore = ['eva', 'prostor'].includes(storeStr);

  // STAGE 1: Pet Products (mainCategory: 'Зоотовари') — Must Run First!
  const petIndicators = [
    'для котів', 'для кішок', 'для кошенят', 'для собак', 'для цуценят', 'для гризунів', 'для папуг',
    'корм сухий', 'корм вологий', 'наповнювач для котячого', 'наповнювач', 'стерилізованих',
    'ласощі для котів', 'ласощі для собак', 'ласощі для тварин', 'для тварин', 'для котиків'
  ];
  const petBrands = [
    'whiskas', 'віскас', 'felix', 'фелікс', 'purina', 'пуріна', 'gourmet', 'гурме',
    'sheba', 'шеба', 'friskies', 'фріскіс', 'optimeal', 'оптіміл', 'клуб 4 лапи', 'club 4 paws',
    'pedigree', 'педігрі', 'chappi', 'чаппі', 'brit', 'savory', 'josera'
  ];
  if (hasWord(text, petIndicators, petBrands) || (hasWord(text, ['корм ']) && !hasWord(text, ['кормчий']))) {
    let sub = 'Усі зоотовари';
    if (hasWord(text, ['кіш', 'кіт', 'кот', 'кошен', 'котяч', 'whiskas', 'віскас', 'felix', 'фелікс', 'gourmet', 'гурме', 'sheba', 'шеба', 'наповнювач'])) {
      sub = 'Для котів';
    } else if (hasWord(text, ['собак', 'пес', 'пса', 'цуцен', 'педігрі', 'pedigree', 'chappi', 'чаппі'])) {
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
    if (hasWord(text, householdLaundryTriggers, householdLaundryBrands)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Побутова хімія', category: 'Побутова хімія' };
    }
    if (hasWord(text, paperTriggers, paperBrands)) {
      return { mainCategory: 'Дім та Побут', subCategory: 'Паперова продукція', category: 'Паперова продукція' };
    }
    if (hasWord(text, kitchenTriggers, kitchenBrands)) {
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

    if (hasWord(text, hairTriggers, hairBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Волосся', category: 'Волосся' };
    }
    if (hasWord(text, makeupTriggers, makeupBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Косметика', category: 'Косметика' };
    }
    if (hasWord(text, hygieneTriggers, hygieneBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Гігієна', category: 'Гігієна' };
    }
    if (isCosmeticCream || hasWord(text, skincareTriggers, skincareBrands)) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Догляд за шкірою', category: 'Догляд за шкірою' };
    }
    if (isBeautyStore) {
      return { mainCategory: 'Краса та Гігієна', subCategory: 'Гігієна', category: 'Гігієна' };
    }
  }

  // STAGE 5: Groceries Subcategories (mainCategory: 'Продукти')
  // 1. Солодощі (Bakery desserts with cream checked BEFORE Dairy!)
  const sweetsTriggers = [
    'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'профітролі', 'круасан', 'кекс', 'мафін',
    'рулет', 'штрудель', 'печиво', 'вафлі', 'вафл', 'пряник', 'зефір', 'мармелад', 'пастила',
    'цукерк', 'шоколад', 'батончик', 'халва', 'козинак', 'драже', 'льодяник', 'жувальна гумка',
    'морозиво', 'десерт', 'мед', 'крем-мед', 'джем', 'варення', 'згущене молоко', 'згущене',
    'паста шоколадна', 'nutella', 'нутелла', 'barni', 'барні', 'рошен', 'roshen', 'milka', 'мілка',
    'ferrero', 'kinder', 'кіндер', 'raffaello', 'рафаелло', 'конті', 'konti', 'авк', 'avk', 'ярич'
  ];
  if (hasWord(text, sweetsTriggers)) {
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
  if (hasWord(text, dairyTriggers)) {
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
  if (hasWord(text, meatFishTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'М\'ясо та Риба', category: 'М\'ясо та Риба' };
  }

  // 4. Кава та Чай
  const coffeeTeaTriggers = [
    'кава', 'кавові', 'еспресо', 'капучино', 'лате', 'американо', 'чай ', 'матча', 'какао',
    'гарячий шоколад', 'дріп', 'jacobs', 'lavazza', 'greenfield', 'tess', 'curtis', 'lovare',
    'ліптон', 'lipton', 'paulig', 'чорна карта', 'жокей', 'idealist'
  ];
  if (hasWord(text, coffeeTeaTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Кава та Чай', category: 'Кава та Чай' };
  }

  // 5. Напої
  const drinksTriggers = [
    'вода', 'сік ', 'сок', 'нектар', 'морс', 'лимонад', 'напій', 'кола', 'pepsi', 'coca-cola',
    'fanta', 'sprite', 'schweppes', 'комбуча', 'квас', 'енергетик', 'red bull', 'monster',
    'пиво', 'вино', 'шампанське', 'ігристе', 'сидр', 'моршинськ', 'боржомі', 'borjomi',
    'поляна квасова', 'садочок', 'sandora', 'rich', 'наш сік', 'віскі', 'горілка', 'коньяк', 'ром '
  ];
  if (hasWord(text, drinksTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Напої', category: 'Напої' };
  }

  // 6. Овочі та Фрукти (excludes tomato paste and sauces)
  const isTomatoPasteOrSauce = (hasWord(text, 'томат') && hasWord(text, 'паста')) || hasWord(text, ['томатна паста', 'паста томатна', 'кетчуп', 'соус томатний']);
  const produceTriggers = [
    'яблук', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'ківі', 'авокадо',
    'помідор', 'томат', 'огірок', 'картопл', 'моркв', 'цибул', 'капуст', 'перець', 'часник',
    'зелень', 'салат ', 'айсберг', 'рукола', 'шпинат', 'кабачок', 'баклажан', 'буряк',
    'редис', 'печериц', 'гриб', 'ягоди', 'полуниц', 'малин', 'лохина', 'чорниц', 'кавун',
    'диня', 'гранат', 'груш', 'слив', 'персик', 'нектарин', 'броколі', 'чері'
  ];
  if (!isTomatoPasteOrSauce && hasWord(text, produceTriggers)) {
    return { mainCategory: 'Продукти', subCategory: 'Овочі та Фрукти', category: 'Овочі та Фрукти' };
  }

  // 7. Бакалія (Default food subcategory)
  return { mainCategory: 'Продукти', subCategory: 'Бакалія', category: 'Бакалія' };
}

// Backward-compatible alias
const mapCategory = categorizeProduct;

/* ─── Product Signature Normalization ────────────────────────────────────── */
function normalizeProductSignature(title = '', ean = null, producerBrand = null) {
  if (!title) return { raw: '', brand: null, weight: null, fat: null, tokens: [], cleanKey: '', ean: null };

  let s = String(title).toLowerCase()
    .replace(/(\d+),(\d+)/g, '$1.$2')
    .replace(/[«»""''„“]/g, '')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Extract fat percentage (e.g. 73%, 82.5%, 2.5%, 15%, 20%)
  let fat = null;
  const fatMatch = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (fatMatch) {
    fat = parseFloat(fatMatch[1]) + '%';
  }

  // 2. Extract weight/volume into canonical unit (g, ml, pcs)
  let weight = null;
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*кг/);
  if (kgMatch) {
    weight = Math.round(parseFloat(kgMatch[1]) * 1000) + 'g';
  } else {
    const gMatch = s.match(/(\d+(?:\.\d+)?)\s*г(?!\w)/);
    if (gMatch) {
      weight = Math.round(parseFloat(gMatch[1])) + 'g';
    } else {
      const lMatch = s.match(/(\d+(?:\.\d+)?)\s*л(?!\w)/);
      if (lMatch) {
        weight = Math.round(parseFloat(lMatch[1]) * 1000) + 'ml';
      } else {
        const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*мл/);
        if (mlMatch) {
          weight = Math.round(parseFloat(mlMatch[1])) + 'ml';
        } else {
          const pcsMatch = s.match(/(\d+)\s*шт/);
          if (pcsMatch) weight = pcsMatch[1] + 'pcs';
        }
      }
    }
  }

  // 3. Identify canonical brand name
  let brand = null;
  if (producerBrand && typeof producerBrand === 'string') {
    const pb = producerBrand.toLowerCase().trim();
    if (pb && pb !== 'без тм' && pb !== 'without-brand' && pb !== 'null') {
      for (const [key, b] of Object.entries(BRAND_MAP)) {
        if (pb.includes(key)) {
          brand = b;
          break;
        }
      }
      if (!brand && pb.length >= 3) {
        brand = pb.replace(/[^\p{L}\p{N}]/gu, '');
      }
    }
  }

  if (!brand) {
    for (const [key, b] of Object.entries(BRAND_MAP)) {
      const regex = new RegExp('(?:^|\\s|[\\(\\-«])' + key + '(?:$|\\s|[\\)\\-»])', 'i');
      if (regex.test(s)) {
        brand = b;
        break;
      }
    }
  }

  // 4. Tokenize and clean word tokens (stripping units, brand and noise)
  const tokenString = s
    .replace(/\b\d+(?:\.\d+)?\s*(?:кг|г|мл|л|шт|%)\b/gi, ' ')
    .replace(/[^\p{L}\s]/gu, ' ');

  const cleanTokens = tokenString
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !NOISE_WORDS.has(w));

  // Extract clean barcode (only standard numeric 8-14 digits)
  const cleanEan = (ean && /^\d{8,14}$/.test(String(ean).trim())) ? String(ean).trim() : null;

  return {
    raw: title,
    brand,
    weight,
    fat,
    tokens: cleanTokens,
    ean: cleanEan
  };
}

function areProductsMatching(sigA, sigB, subCatA, subCatB) {
  // CRITERION 1: Strict numeric EAN barcode match
  if (sigA.ean && sigB.ean && sigA.ean === sigB.ean) {
    return true;
  }

  // CRITERION 2: Exact brand + weight + fat% + core nouns match
  if (subCatA && subCatB && subCatA !== subCatB) return false;

  if (!sigA.brand || !sigB.brand || sigA.brand !== sigB.brand) {
    return false;
  }

  if (!sigA.weight || !sigB.weight || sigA.weight !== sigB.weight) {
    return false;
  }

  if (sigA.fat || sigB.fat) {
    if (sigA.fat !== sigB.fat) return false;
  }

  const setA = new Set(sigA.tokens);
  const setB = new Set(sigB.tokens);

  for (const v of CONFLICT_VARIANTS) {
    const hasA = setA.has(v) || sigA.raw.toLowerCase().includes(v);
    const hasB = setB.has(v) || sigB.raw.toLowerCase().includes(v);
    if (hasA !== hasB) {
      return false;
    }
  }

  let hasCoreMatch = false;
  for (const noun of CORE_PRODUCT_NOUNS) {
    if ((setA.has(noun) || sigA.raw.toLowerCase().includes(noun)) &&
        (setB.has(noun) || sigB.raw.toLowerCase().includes(noun))) {
      hasCoreMatch = true;
      break;
    }
  }

  if (hasCoreMatch) return true;

  let commonCount = 0;
  for (const t of setA) {
    if (setB.has(t)) {
      commonCount++;
    } else {
      for (const tb of setB) {
        if ((t.length >= 4 && tb.startsWith(t.slice(0, -1))) || (tb.length >= 4 && t.startsWith(tb.slice(0, -1)))) {
          commonCount++;
          break;
        }
      }
    }
  }

  return commonCount >= 2;
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

/* ─── 1. SILPO Public Catalog Scraper ────────────────────────────────────── */
async function fetchSilpoAllPromotions(branchId) {
  const activeBranch = branchId || '1edb6b5a-55fb-6864-9a0f-d54e0a9fe643';
  const baseUrl = `https://sf-ecom-api.silpo.ua/v1/uk/branches/${activeBranch}/products`;

  const urls = [
    `${baseUrl}?limit=50&offset=0&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=50&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=100&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=150&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=200&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=250&deliveryType=DeliveryHome&mustHavePromotion=true`,
    `${baseUrl}?limit=50&offset=300&deliveryType=DeliveryHome&mustHavePromotion=true`
  ];

  const stapleQueries = ['кава', 'шоколад', 'сир', 'масло', 'молоко', 'сметана', 'олія', 'чай', 'філе', 'ковбаса', 'макарони', 'гель', 'шампунь', 'корм'];
  stapleQueries.forEach(q => {
    urls.push(`${baseUrl}?search=${encodeURIComponent(q)}&limit=30&deliveryType=DeliveryHome`);
  });

  const promises = urls.map(async url => {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || data.products || data.results || [];
    } catch (_) {
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  const rawItems = [];
  settled.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      rawItems.push(...r.value);
    }
  });

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
    const sourceUrl = slug ? `https://silpo.ua/product/${slug}` : 'https://silpo.ua';

    if (!isStoreUrlConsistent('silpo', sourceUrl)) continue;

    const unit = item.displayRatio ? String(item.displayRatio).trim() : (item.ratio ? 'кг' : (item.unit === 'kg' ? 'кг' : 'шт'));
    const catInfo = categorizeProduct(title, 'silpo', item.categoryTitle || '');

    validItems.push({
      sourceStore: 'silpo',
      sourceStoreName: 'Сільпо',
      title,
      producerBrand: item.brandTitle || null,
      ean: null,
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

/* ─── 2. ZAKAZ.UA Public Promotion Scraper (NOVUS, METRO, AUCHAN, EPICENTR FOOD) */
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
  const urls = [];

  for (let idx = 0; idx < ids.length; idx++) {
    const storeId = ids[idx];
    const baseUrl = `https://stores-api.zakaz.ua/stores/${storeId}/products`;

    const maxPages = idx === 0 ? 6 : 4;
    for (let p = 1; p <= maxPages; p++) {
      urls.push(`${baseUrl}/promotion/?page=${p}`);
    }

    if (idx === 0) {
      const stapleQueries = ['кава', 'шоколад', 'сир', 'масло', 'молоко', 'сметана', 'олія', 'чай', 'філе', 'ковбаса', 'макарони', 'гель', 'шампунь', 'корм'];
      stapleQueries.forEach(q => {
        urls.push(`${baseUrl}/search/?q=${encodeURIComponent(q)}`);
      });
    }
  }

  const promises = urls.map(async url => {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || data.items || [];
    } catch (_) {
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  const rawItems = [];
  settled.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      rawItems.push(...r.value);
    }
  });

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

    if (!oldPrice || oldPrice <= price) continue;

    const unit = item.unit === 'kg' ? 'кг' : (item.bundle && item.bundle > 1 ? `${item.bundle} шт` : (item.unit === 'pcs' ? 'шт' : (item.unit || 'шт')));
    const catInfo = categorizeProduct(title, storeKey, item.category?.title || '');
    const producerBrand = item.producer?.trademark || item.producer?.name || null;
    const ean = item.ean ? String(item.ean).trim() : null;

    validItems.push({
      sourceStore: storeKey,
      sourceStoreName: storeName,
      title,
      producerBrand,
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

          const price = parseFloat(prod.price);
          const oldPrice = parseFloat(prod.oldPrice);
          if (isNaN(price) || isNaN(oldPrice) || price <= 0 || oldPrice <= price) continue;

          const slug = prod.slug ? prod.slug.trim() : '';
          const sourceUrl = slug ? `https://thrash.ua/product/${slug}` : 'https://thrash.ua/promotions/campaigns';
          const catInfo = categorizeProduct(prod.title, storeKey);

          validItems.push({
            sourceStore: storeKey,
            sourceStoreName: storeName,
            title: prod.title.trim(),
            producerBrand: null,
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
        const priceNum = $(el).find('.ty-price-num').first().text().replace(/[^\d\.]/g, '');
        const oldPriceNum = $(el).find('.ty-strike .ty-price-num, .ty-list-price, [id*="old_price"]').first().text().replace(/[^\d\.]/g, '');

        const price = parseFloat(priceNum);
        const oldPrice = parseFloat(oldPriceNum);

        if (title && href && href.startsWith('https://avrora.ua/') && !isNaN(price) && price > 0 && !isNaN(oldPrice) && oldPrice > price) {
          if (!seenUrls.has(href)) {
            seenUrls.add(href);
            const catInfo = categorizeProduct(title, storeKey);
            validItems.push({
              sourceStore: storeKey,
              sourceStoreName: storeName,
              title: title.replace(/\s+/g, ' ').trim(),
              producerBrand: null,
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
    const pages = [1, 2, 3];
    for (const p of pages) {
      const url = `https://market.rukavychka.ua/specials/?page=${p}`;
      try {
        const res = await fetchWithTimeout(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'uk-UA,uk;q=0.9'
          }
        }, 4500);

        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);

        $('.fm-module-item, .product-layout, .fm-category-product-caption').each((i, el) => {
          const title = $(el).find('a[href*="market.rukavychka.ua/"]').first().text().trim();
          const href = $(el).find('a[href*="market.rukavychka.ua/"]').first().attr('href') || '';
          const pNewText = $(el).find('.new-special-price, [class*="price-new"]').first().text().trim();
          const pOldText = $(el).find('.old-special-price, [class*="price-old"]').first().text().trim();

          const mNew = pNewText.match(/(\d+(?:[\.,]\d+)?)/);
          const mOld = pOldText.match(/(\d+(?:[\.,]\d+)?)/);
          const price = mNew ? parseFloat(mNew[1].replace(',', '.')) : 0;
          const oldPrice = mOld ? parseFloat(mOld[1].replace(',', '.')) : 0;

          if (title && href && price > 0 && oldPrice > price && !seenUrls.has(href)) {
            seenUrls.add(href);
            const catInfo = categorizeProduct(title, storeKey);
            validItems.push({
              sourceStore: storeKey,
              sourceStoreName: storeName,
              title: title.replace(/\s+/g, ' ').trim(),
              producerBrand: null,
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

async function scrapeStealthBrowserStores(fastScraperStats = []) {
  const browserResults = {
    atb: { store: 'atb', storeName: 'АТБ-Маркет', status: 0, items: [], error: null },
    eva: { store: 'eva', storeName: 'EVA', status: 0, items: [], error: null }
  };

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
    try {
      console.log('[Puppeteer] [АТБ-Маркет] Отримання акційних пропозицій (economy, sale_tovari, znyzhky)...');
      const atbUrls = [
        'https://www.atbmarket.com/promo/economy',
        'https://www.atbmarket.com/promo/sale_tovari',
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
            if (!seenAtb.has(it.sourceUrl) && it.sourceUrl.includes('atbmarket.com')) {
              seenAtb.add(it.sourceUrl);
              const catInfo = categorizeProduct(it.title, 'atb');
              atbItems.push({
                sourceStore: 'atb',
                sourceStoreName: 'АТБ-Маркет',
                title: it.title.replace(/\s+/g, ' ').trim(),
                producerBrand: null,
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

    // ── b) EVA (Вилучення реальних акційних позицій [data-testid="product-card"]) ──
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
            res.push({ title, price, oldPrice, sourceUrl });
          }
        });
        return res;
      });

      const seenEva = new Set();
      const evaItems = [];
      evaExtracted.forEach(it => {
        if (!seenEva.has(it.sourceUrl) && it.sourceUrl.includes('eva.ua')) {
          seenEva.add(it.sourceUrl);
          const catInfo = categorizeProduct(it.title, 'eva');
          evaItems.push({
            sourceStore: 'eva',
            sourceStoreName: 'EVA',
            title: it.title.replace(/\s+/g, ' ').trim(),
            producerBrand: null,
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

    // ── c) Траш! Fallback (якщо GraphQL не повернув акцій) ──
    const thrashStat = fastScraperStats.find(s => s.store === 'thrash');
    if (!thrashStat || !thrashStat.items || thrashStat.items.length === 0) {
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

        if (thrashExtracted.length > 0) {
          const items = thrashExtracted.map(it => {
            const catInfo = categorizeProduct(it.title, 'thrash');
            return {
              sourceStore: 'thrash',
              sourceStoreName: 'Траш!',
              title: it.title,
              producerBrand: null,
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
    const avroraStat = fastScraperStats.find(s => s.store === 'avrora');
    if (!avroraStat || !avroraStat.items || avroraStat.items.length === 0) {
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

        if (avroraExtracted.length > 0) {
          const items = avroraExtracted.map(it => {
            const catInfo = categorizeProduct(it.title, 'avrora');
            return {
              sourceStore: 'avrora',
              sourceStoreName: 'Аврора',
              title: it.title,
              producerBrand: null,
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
function groupAndMatchLiveProducts(scrapedItems, activeStores = null) {
  const groups = [];

  for (const item of scrapedItems) {
    if (!item.title || !item.price || item.price <= 0 || !item.sourceUrl) continue;

    if (activeStores && !activeStores.includes(item.sourceStore)) continue;

    if (!isStoreUrlConsistent(item.sourceStore, item.sourceUrl)) continue;

    const sigItem = normalizeProductSignature(item.title, item.ean, item.producerBrand);

    let matchedGroup = null;
    for (const g of groups) {
      if (areProductsMatching(g.sig, sigItem, g.subCategory, item.subCategory)) {
        matchedGroup = g;
        break;
      }
    }

    if (matchedGroup) {
      if (item.title.length > matchedGroup.title.length && !item.title.includes('  ')) {
        matchedGroup.title = item.title;
      }
      if (matchedGroup.storePrices.has(item.sourceStore)) {
        const existing = matchedGroup.storePrices.get(item.sourceStore);
        if (item.price < existing.price) {
          matchedGroup.storePrices.set(item.sourceStore, {
            store: item.sourceStore,
            price: item.price,
            oldPrice: item.oldPrice,
            sourceUrl: item.sourceUrl
          });
        }
      } else {
        matchedGroup.storePrices.set(item.sourceStore, {
          store: item.sourceStore,
          price: item.price,
          oldPrice: item.oldPrice,
          sourceUrl: item.sourceUrl
        });
      }
    } else {
      const storePrices = new Map();
      storePrices.set(item.sourceStore, {
        store: item.sourceStore,
        price: item.price,
        oldPrice: item.oldPrice,
        sourceUrl: item.sourceUrl
      });

      groups.push({
        title: item.title,
        sig: sigItem,
        mainCategory: item.mainCategory || 'Продукти',
        subCategory: item.subCategory || item.category || 'Бакалія',
        category: item.category || item.subCategory || 'Бакалія',
        unit: sigItem.weight || item.unit || 'шт',
        promoTag: item.promoTag || 'Суперціна',
        storePrices
      });
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

      return {
        name: g.title,
        title: g.title,
        mainCategory: g.mainCategory || 'Продукти',
        main_category: g.mainCategory || 'Продукти',
        subCategory: g.subCategory || g.category || 'Бакалія',
        sub_category: g.subCategory || g.category || 'Бакалія',
        category: g.category || g.subCategory || 'Бакалія',
        unit: g.unit,
        promoTag: verifiedPrices.length > 1 ? `Порівняння в ${verifiedPrices.length} мережах` : g.promoTag,
        promo_tag: verifiedPrices.length > 1 ? `Порівняння в ${verifiedPrices.length} мережах` : g.promoTag,
        syncedAt: now,
        updated_at: now,
        prices: verifiedPrices
      };
    })
    .filter(prod => Array.isArray(prod.prices) && prod.prices.length > 0);

  return finalProducts;
}

let latestSyncStats = [];

/**
 * Main live promotion sync coordinator with City-Specific Local Store Price Sync.
 * Prioritizes Western Ukraine (default: ivano-frankivsk)
 */
async function syncLivePromotions(cityId = 'ivano-frankivsk') {
  const cityConfig = getCityConfig(cityId);
  console.log(`>>> [LIVE SYNC] Початок синхронізації цін для міста: ${cityConfig.name} (${cityConfig.region})...`);
  latestSyncStats = [];

  const storeTasks = [];

  // 1. СІЛЬПО (Local Branch)
  if (cityConfig.activeStores.includes('silpo')) {
    storeTasks.push(fetchSilpoAllPromotions(cityConfig.silpoBranchId));
  } else {
    latestSyncStats.push({ store: 'silpo', storeName: 'Сільпо', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 2. NOVUS
  if (cityConfig.activeStores.includes('novus') && cityConfig.zakazStores.novus && cityConfig.zakazStores.novus.length > 0) {
    storeTasks.push(fetchZakazStoreMulti('novus', 'NOVUS', cityConfig.zakazStores.novus));
  } else {
    latestSyncStats.push({ store: 'novus', storeName: 'NOVUS', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 3. METRO
  if (cityConfig.activeStores.includes('metro') && cityConfig.zakazStores.metro && cityConfig.zakazStores.metro.length > 0) {
    storeTasks.push(fetchZakazStoreMulti('metro', 'METRO', cityConfig.zakazStores.metro));
  } else {
    latestSyncStats.push({ store: 'metro', storeName: 'METRO', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 4. АШАН
  if (cityConfig.activeStores.includes('auchan') && cityConfig.zakazStores.auchan && cityConfig.zakazStores.auchan.length > 0) {
    storeTasks.push(fetchZakazStoreMulti('auchan', 'АШАН', cityConfig.zakazStores.auchan));
  } else {
    latestSyncStats.push({ store: 'auchan', storeName: 'АШАН', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 5. ЕПІЦЕНТР FOOD
  if (cityConfig.activeStores.includes('epicentrk_food')) {
    if (cityConfig.zakazStores.epicentrk_food && cityConfig.zakazStores.epicentrk_food.length > 0) {
      storeTasks.push(fetchZakazStoreMulti('epicentrk_food', 'Епіцентр Food', cityConfig.zakazStores.epicentrk_food));
    }
  }

  // 6. ТРАШ! (Thrash! GraphQL)
  if (cityConfig.activeStores.includes('thrash')) {
    storeTasks.push(fetchThrashPromotions());
  } else {
    latestSyncStats.push({ store: 'thrash', storeName: 'Траш!', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 7. АВРОРА (CS-Cart storefront)
  if (cityConfig.activeStores.includes('avrora')) {
    storeTasks.push(fetchAvroraPromotions());
  } else {
    latestSyncStats.push({ store: 'avrora', storeName: 'Аврора', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 8. РУКАВИЧКА (OpenCart specials)
  if (cityConfig.activeStores.includes('rukavychka')) {
    storeTasks.push(fetchRukavychkaPromotions());
  } else {
    latestSyncStats.push({ store: 'rukavychka', storeName: 'Рукавичка', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  // 9. Regional / Protected chains (graceful check)
  const remainingRegional = [
    { store: 'varus', name: 'VARUS', url: 'https://varus.ua/api/promotions' },
    { store: 'velmart', name: 'Велмарт', url: 'https://velmart.ua/aktsijni-propozytsiyi/' },
    { store: 'simi', name: 'Сімі', url: 'https://simi.ua/' },
    { store: 'blyzenko', name: 'Близенько', url: 'https://blyzenko.ua/wp-json/' },
    { store: 'taistra', name: 'Тайстра', url: 'https://taistra.com.ua/' },
    { store: 'arsen', name: 'Арсен', url: 'https://arsen.ua/' },
    { store: 'prostor', name: 'Prostor', url: 'https://prostor.ua/ua/aktsii/' },
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
  const liveScraped = [];

  settled.forEach(res => {
    if (res.status === 'fulfilled') {
      const outcome = res.value;
      if (outcome) {
        latestSyncStats.push(outcome);
        if (Array.isArray(outcome.items) && outcome.items.length > 0) {
          liveScraped.push(...outcome.items);
        }
      }
    }
  });

  // 10. Stealth Browser Context (Cloudflare Bypass for АТБ, EVA, and fallbacks)
  const browserResults = await scrapeStealthBrowserStores(latestSyncStats, cityId);

  if (cityConfig.activeStores.includes('atb') && browserResults.atb) {
    latestSyncStats.push(browserResults.atb);
    if (browserResults.atb.items.length > 0) {
      liveScraped.push(...browserResults.atb.items);
    }
  } else if (!cityConfig.activeStores.includes('atb')) {
    latestSyncStats.push({ store: 'atb', storeName: 'АТБ-Маркет', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  if (cityConfig.activeStores.includes('eva') && browserResults.eva) {
    latestSyncStats.push(browserResults.eva);
    if (browserResults.eva.items.length > 0) {
      liveScraped.push(...browserResults.eva.items);
    }
  } else if (!cityConfig.activeStores.includes('eva')) {
    latestSyncStats.push({ store: 'eva', storeName: 'EVA', status: 0, items: [], error: 'Немає в цьому місті' });
  }

  if (browserResults.thrashFallback && browserResults.thrashFallback.items.length > 0 && cityConfig.activeStores.includes('thrash')) {
    const existingThrashIdx = latestSyncStats.findIndex(s => s.store === 'thrash');
    if (existingThrashIdx >= 0) {
      latestSyncStats[existingThrashIdx] = browserResults.thrashFallback;
    } else {
      latestSyncStats.push(browserResults.thrashFallback);
    }
    liveScraped.push(...browserResults.thrashFallback.items);
  }

  if (browserResults.avroraFallback && browserResults.avroraFallback.items.length > 0 && cityConfig.activeStores.includes('avrora')) {
    const existingAvrIdx = latestSyncStats.findIndex(s => s.store === 'avrora');
    if (existingAvrIdx >= 0) {
      latestSyncStats[existingAvrIdx] = browserResults.avroraFallback;
    } else {
      latestSyncStats.push(browserResults.avroraFallback);
    }
    liveScraped.push(...browserResults.avroraFallback.items);
  }

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
 * Returns live status and product counts for all 18 supported retail chains in the given city.
 */
function getStoresStatus(cityId = 'ivano-frankivsk') {
  const cityConfig = getCityConfig(cityId);
  const countsByStore = {};
  try {
    const localStorePath = path.resolve(__dirname, '..', 'db', 'local-store.json');
    if (fs.existsSync(localStorePath)) {
      const data = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
      (data.products || []).forEach(p => {
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
  normalizeProductSignature,
  areProductsMatching,
  groupAndMatchLiveProducts,
  isStoreUrlConsistent,
  resolveStoreIdentity,
  ALL_18_STORES
};
