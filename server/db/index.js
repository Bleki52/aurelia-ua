/**
 * ============================================================================
 * AURELIA UA — Database Layer (PostgreSQL with Local JSON Fallback)
 * Works out-of-the-box with zero configuration using local-store.json,
 * and seamlessly connects to PostgreSQL when DATABASE_URL is provided.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let pgPool = null;
let isPostgres = false;

const LOCAL_STORE_PATH = path.join(__dirname, 'local-store.json');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/* ─── Seed Data Constants ─────────────────────────────────────────────────── */
const DEFAULT_ADMIN = {
  id: 1,
  name: 'Головний Адміністратор',
  email: 'admin@aurelia.ua',
  password_hash: bcrypt.hashSync('Admin123!', 10),
  role: 'ADMIN',
  created_at: new Date().toISOString()
};

const SEED_CARDS = [
  {
    id: 1,
    user_id: 1,
    store: 'silpo',
    program: 'Власний Рахунок',
    card_number: '990001248831',
    qr_payload: '990001248831',
    points: '142.50 балів',
    cashback: 'Преміум гість',
    screenshot_data: null,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    user_id: 1,
    store: 'atb',
    program: 'Картка АТБ',
    card_number: '414949910023',
    qr_payload: '414949910023',
    points: 'Знижка до 5%',
    cashback: 'Екстра Знижка',
    screenshot_data: null,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    user_id: 1,
    store: 'novus',
    program: 'Ваша Картка',
    card_number: '290000418552',
    qr_payload: '290000418552',
    points: '85.00 грн',
    cashback: 'VIP Покупець',
    screenshot_data: null,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    user_id: 1,
    store: 'varus',
    program: 'VARUS Poshuk',
    card_number: '770089231104',
    qr_payload: '770089231104',
    points: '230 бонусів',
    cashback: 'VARUS Family',
    screenshot_data: null,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    user_id: 1,
    store: 'metro',
    program: 'METRO Club',
    card_number: '500291103381',
    qr_payload: '500291103381',
    points: 'Партнерська ціна',
    cashback: 'Бізнес Клієнт',
    screenshot_data: null,
    created_at: new Date().toISOString()
  }
];

const SEED_PRODUCTS = [
  {
    id: 1,
    name: 'Кава Lavazza Crema e Gusto мелена 250 г',
    category: 'Кава та Чай',
    promo_tag: 'Хіт продажу',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 149.90, old_price: 199.00 },
      { store: 'atb', price: 139.50, old_price: 189.00 },
      { store: 'novus', price: 154.00, old_price: 205.00 },
      { store: 'varus', price: 145.00, old_price: 195.00 },
      { store: 'metro', price: 142.00, old_price: 185.00 }
    ]
  },
  {
    id: 2,
    name: 'Чай Greenfield Golden Ceylon чорний 100 пакетиків',
    category: 'Кава та Чай',
    promo_tag: 'Знижка тижня',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 129.00, old_price: 175.00 },
      { store: 'atb', price: 135.00, old_price: 180.00 },
      { store: 'novus', price: 124.90, old_price: 169.00 },
      { store: 'varus', price: 128.00, old_price: 172.00 },
      { store: 'metro', price: 126.00, old_price: 170.00 }
    ]
  },
  {
    id: 3,
    name: 'Молоко Яготинське 2.6% пастеризоване 900 г',
    category: 'Молочні',
    promo_tag: 'Соціальна ціна',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 38.99, old_price: 47.90 },
      { store: 'atb', price: 36.40, old_price: 44.50 },
      { store: 'novus', price: 39.50, old_price: 48.00 },
      { store: 'varus', price: 37.90, old_price: 46.00 },
      { store: 'metro', price: 37.00, old_price: 45.00 }
    ]
  },
  {
    id: 4,
    name: 'Сир твердий КОМО Тенеро 50% брус 180 г',
    category: 'Молочні',
    promo_tag: 'Краща ціна',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 64.99, old_price: 89.90 },
      { store: 'atb', price: 67.50, old_price: 91.00 },
      { store: 'novus', price: 69.90, old_price: 94.00 },
      { store: 'varus', price: 66.00, old_price: 89.00 },
      { store: 'metro', price: 65.50, old_price: 88.00 }
    ]
  },
  {
    id: 5,
    name: 'Філе індички охолоджене фермерське 1 кг',
    category: "М'ясо та Риба",
    promo_tag: 'Свіже м’ясо',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 219.00, old_price: 289.00 },
      { store: 'atb', price: 215.00, old_price: 279.00 },
      { store: 'novus', price: 225.00, old_price: 295.00 },
      { store: 'varus', price: 209.90, old_price: 275.00 },
      { store: 'metro', price: 212.00, old_price: 280.00 }
    ]
  },
  {
    id: 6,
    name: 'Лосось слабосолений філе Norven 180 г',
    category: "М'ясо та Риба",
    promo_tag: 'Делікатес',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 179.00, old_price: 239.00 },
      { store: 'atb', price: 169.90, old_price: 229.00 },
      { store: 'novus', price: 185.00, old_price: 245.00 },
      { store: 'varus', price: 174.00, old_price: 230.00 },
      { store: 'metro', price: 172.00, old_price: 228.00 }
    ]
  },
  {
    id: 7,
    name: 'Шоколад Roshen екстрачорний з цілим ліщиною 85 г',
    category: 'Солодощі',
    promo_tag: 'Суперціна',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 34.50, old_price: 48.00 },
      { store: 'atb', price: 31.90, old_price: 45.00 },
      { store: 'novus', price: 36.00, old_price: 49.00 },
      { store: 'varus', price: 33.50, old_price: 47.00 },
      { store: 'metro', price: 32.50, old_price: 46.00 }
    ]
  },
  {
    id: 8,
    name: 'Цукерки Ferrero Rocher хрусткі з горіхом 200 г',
    category: 'Солодощі',
    promo_tag: 'Преміум',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 199.00, old_price: 265.00 },
      { store: 'atb', price: 195.00, old_price: 259.00 },
      { store: 'novus', price: 189.90, old_price: 255.00 },
      { store: 'varus', price: 196.00, old_price: 260.00 },
      { store: 'metro', price: 192.00, old_price: 258.00 }
    ]
  },
  {
    id: 9,
    name: 'Олія соняшникова Чумак рафінована 850 мл',
    category: 'Бакалія',
    promo_tag: 'Топ вибір',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 54.90, old_price: 68.00 },
      { store: 'atb', price: 49.90, old_price: 64.00 },
      { store: 'novus', price: 56.00, old_price: 69.00 },
      { store: 'varus', price: 52.50, old_price: 66.00 },
      { store: 'metro', price: 51.00, old_price: 65.00 }
    ]
  },
  {
    id: 10,
    name: 'Макарони Barilla Spaghetti n.5 спагеті 500 г',
    category: 'Бакалія',
    promo_tag: 'Італія',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 59.90, old_price: 85.00 },
      { store: 'atb', price: 58.50, old_price: 82.00 },
      { store: 'novus', price: 54.90, old_price: 79.00 },
      { store: 'varus', price: 61.00, old_price: 86.00 },
      { store: 'metro', price: 56.00, old_price: 80.00 }
    ]
  },
  {
    id: 11,
    name: 'Вода мінеральна Borjomi лікувальна 0.5 л скло',
    category: 'Напої',
    promo_tag: 'Знижка',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 39.90, old_price: 52.00 },
      { store: 'atb', price: 37.50, old_price: 49.00 },
      { store: 'novus', price: 41.00, old_price: 54.00 },
      { store: 'varus', price: 38.90, old_price: 50.00 },
      { store: 'metro', price: 38.00, old_price: 49.50 }
    ]
  },
  {
    id: 12,
    name: 'Сік Sandora Гранатовий 100% преміум 0.95 л',
    category: 'Напої',
    promo_tag: '100% Сік',
    updated_at: new Date().toISOString(),
    prices: [
      { store: 'silpo', price: 68.00, old_price: 89.00 },
      { store: 'atb', price: 69.50, old_price: 91.00 },
      { store: 'novus', price: 66.90, old_price: 88.00 },
      { store: 'varus', price: 67.50, old_price: 89.00 },
      { store: 'metro', price: 65.00, old_price: 85.00 }
    ]
  }
];

/* ─── Local JSON Database Driver ─────────────────────────────────────────── */
function buildSeedProductPrices(prods) {
  const list = [];
  let prId = 1;
  (prods || []).forEach(p => {
    (p.prices || []).forEach(pr => {
      list.push({
        id: prId++,
        product_id: p.id,
        productId: p.id,
        store: pr.store,
        price: Number(pr.price),
        old_price: pr.old_price !== undefined ? pr.old_price : (pr.oldPrice || null),
        oldPrice: pr.oldPrice !== undefined ? pr.oldPrice : (pr.old_price || null),
        source_url: pr.sourceUrl || pr.source_url || null,
        sourceUrl: pr.sourceUrl || pr.source_url || null
      });
    });
  });
  return list;
}

function loadLocalStore() {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    const initialData = {
      users: [DEFAULT_ADMIN],
      loyalty_cards: SEED_CARDS,
      products: SEED_PRODUCTS,
      product_prices: buildSeedProductPrices(SEED_PRODUCTS)
    };
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.product_prices || !Array.isArray(parsed.product_prices)) {
      parsed.product_prices = buildSeedProductPrices(parsed.products);
    }
    return parsed;
  } catch (err) {
    console.error('Помилка зчитування local-store.json:', err);
    return {
      users: [DEFAULT_ADMIN],
      loyalty_cards: SEED_CARDS,
      products: SEED_PRODUCTS,
      product_prices: buildSeedProductPrices(SEED_PRODUCTS)
    };
  }
}

function saveLocalStore(data) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Помилка запису в local-store.json:', err);
  }
}

/* ─── Database Initialization ────────────────────────────────────────────── */
async function seedProductsFromLocalStore() {
  if (!fs.existsSync(LOCAL_STORE_PATH)) return false;
  try {
    const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8');
    const store = JSON.parse(raw);
    const localProds = (Array.isArray(store.products) ? store.products : []).filter(
      p => p && (p.title || p.name) && Array.isArray(p.prices) && p.prices.length > 0
    );

    if (localProds.length === 0) return false;

    console.log(`🚀 Імпорт ${localProds.length} реальних товарів з local-store.json до PostgreSQL...`);
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      for (const p of localProds) {
        const name = (p.title || p.name).trim();
        const city = p.city || 'ivano-frankivsk';
        const mainCat = p.mainCategory || p.main_category || 'Продукти';
        const subCat = p.subCategory || p.sub_category || p.category || 'Бакалія';
        const cat = p.category || subCat;
        const promoTag = p.promoTag || p.promo_tag || 'Акція';
        const syncedAt = p.syncedAt || p.synced_at || p.updated_at || new Date().toISOString();

        const insProd = await client.query(
          `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [name, city, cat, mainCat, subCat, promoTag, syncedAt]
        );
        const prodId = insProd.rows[0].id;

        for (const pr of p.prices) {
          const storeSlug = String(pr.store || '').toLowerCase().trim();
          const price = parseFloat(pr.price);
          if (!storeSlug || isNaN(price) || price <= 0) continue;
          const oldPrice = parseFloat(pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price) || null;
          const sourceUrl = pr.sourceUrl || pr.source_url || null;

          await client.query(
            `INSERT INTO product_prices (product_id, store, price, old_price, source_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [prodId, storeSlug, price, oldPrice, sourceUrl]
          );
        }
      }
      await client.query('COMMIT');
      console.log(`✅ ${localProds.length} товарів успішно завантажено в хмарну базу PostgreSQL!`);
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Помилка імпорту товарів до PostgreSQL:', err);
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Помилка зчитування local-store.json:', err);
    return false;
  }
}

async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && !dbUrl.includes('host:5432')) {
    try {
      const { Pool } = require('pg');
      const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: isLocalHost ? false : { rejectUnauthorized: false }
      });

      // Test connection
      await pgPool.query('SELECT NOW()');
      isPostgres = true;
      console.log('✅ Успішно підключено до PostgreSQL.');

      // Run schema
      if (fs.existsSync(SCHEMA_PATH)) {
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        await pgPool.query(schemaSql);
        console.log('✅ Реляційну схему PostgreSQL перевірено.');
      }

      // Auto-migrations: ensure new columns and indexes exist
      await pgPool.query(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS city VARCHAR(60) DEFAULT 'ivano-frankivsk';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS main_category VARCHAR(80) DEFAULT 'Продукти';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category VARCHAR(80) DEFAULT 'Бакалія';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_tag VARCHAR(80);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT NOW();
        ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS source_url TEXT;
        CREATE INDEX IF NOT EXISTS idx_products_city ON products(city);
        CREATE INDEX IF NOT EXISTS idx_products_main_category ON products(main_category);
        CREATE INDEX IF NOT EXISTS idx_products_sub_category ON products(sub_category);
      `);

      // Seed admin if not present
      const adminRes = await pgPool.query('SELECT id FROM users WHERE email = $1', [DEFAULT_ADMIN.email]);
      if (adminRes.rowCount === 0) {
        await pgPool.query(
          `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
          [DEFAULT_ADMIN.name, DEFAULT_ADMIN.email, DEFAULT_ADMIN.password_hash, 'ADMIN']
        );
        console.log('✅ Адміністратора admin@aurelia.ua додано до бази.');
      }

      // Seed loyalty cards if empty
      const cardRes = await pgPool.query('SELECT id FROM loyalty_cards LIMIT 1');
      if (cardRes.rowCount === 0) {
        for (const c of SEED_CARDS) {
          await pgPool.query(
            `INSERT INTO loyalty_cards (user_id, store, program, card_number, qr_payload, points, cashback, screenshot_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [1, c.store, c.program, c.card_number, c.qr_payload, c.points, c.cashback, c.screenshot_data]
          );
        }
        console.log('✅ Картки лояльності заповнено.');
      }

      // Seed products if empty (prioritize bulk-inserting real products from local-store.json)
      const prodRes = await pgPool.query('SELECT id FROM products LIMIT 1');
      if (prodRes.rowCount === 0) {
        const seededFromLocal = await seedProductsFromLocalStore();
        if (!seededFromLocal) {
          for (const p of SEED_PRODUCTS) {
            const ins = await pgPool.query(
              `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
              [p.name, 'ivano-frankivsk', p.category, 'Продукти', 'Бакалія', p.promo_tag]
            );
            const newId = ins.rows[0].id;
            for (const sp of p.prices) {
              await pgPool.query(
                `INSERT INTO product_prices (product_id, store, price, old_price, source_url) VALUES ($1, $2, $3, $4, $5)`,
                [newId, sp.store, sp.price, sp.old_price, null]
              );
            }
          }
          console.log('✅ Базовий каталог акційних товарів заповнено.');
        }
      }

      return;
    } catch (err) {
      console.warn('⚠️ Не вдалося підключитися до PostgreSQL (працюємо в автономному режимі):', err.message);
      isPostgres = false;
    }
  }

  // Fallback to local JSON database
  console.log('📁 Працюємо в режимі локальної БД: server/db/local-store.json');
  loadLocalStore();
}

/* ─── Unified Data Access Methods ────────────────────────────────────────── */

// 1. Користувачі (Users)
async function findUserByEmail(email) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  return store.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findUserById(id) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const u = store.users.find(user => String(user.id) === String(id));
  if (!u) return null;
  const { password_hash, ...safeUser } = u;
  return safeUser;
}

async function createUser({ name, email, password_hash, role }) {
  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
      [name, email, password_hash, role || 'USER']
    );
    return res.rows[0];
  }
  const store = loadLocalStore();
  const maxId = store.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
  const newUser = {
    id: maxId + 1,
    name: name || email.split('@')[0],
    email,
    password_hash,
    role: role || 'USER',
    created_at: new Date().toISOString()
  };
  store.users.push(newUser);
  saveLocalStore(store);
  const { password_hash: _, ...safeUser } = newUser;
  return safeUser;
}

/* ─── Normalization Helpers for Universal Client Compatibility ──────────── */
const STORE_NAMES = {
  silpo: 'Сільпо',
  atb: 'АТБ-Маркет',
  novus: 'NOVUS',
  varus: 'VARUS',
  metro: 'METRO',
  auchan: 'АШАН'
};

function formatCard(c) {
  if (!c) return null;
  const store = c.store || 'silpo';
  const num = c.card_number || c.number || '';
  const qr = c.qr_payload || c.qrPayload || num;
  const pts = c.points || c.note || '';
  const cb = c.cashback || c.privilegeBadge || '';
  return {
    ...c,
    store,
    storeName: c.storeName || STORE_NAMES[store] || store,
    number: num,
    card_number: num,
    qrPayload: qr,
    qr_payload: qr,
    points: pts,
    note: pts,
    cashback: cb,
    privilegeBadge: cb,
    logo: c.logo || `logo-${store}`,
    format: c.format || (store === 'atb' || store === 'varus' ? 'barcode' : 'qr')
  };
}

const CATEGORY_SLUGS = {
  'Кава та Чай': 'coffee',
  'Молочні': 'dairy',
  "М'ясо та Риба": 'meat',
  'Солодощі': 'sweets',
  'Бакалія': 'grocery',
  'Напої': 'drinks'
};

function isStoreUrlConsistent(store, url) {
  if (!url) return true;
  const s = String(store || '').toLowerCase().trim();
  const u = String(url || '').toLowerCase().trim();

  if (s === 'novus') return u.includes('novus.zakaz.ua');
  if (s === 'metro') return u.includes('metro.zakaz.ua');
  if (s === 'varus') return u.includes('varus.zakaz.ua') || u.includes('varus.ua');
  if (s === 'auchan') return u.includes('auchan.zakaz.ua') || u.includes('auchan.ua');
  if (s === 'silpo') return u.includes('silpo.ua');
  if (s === 'atb') return u.includes('atbmarket.com');
  if (s === 'epicentrk_food') return u.includes('epicentrfood.zakaz.ua') || u.includes('epicentrk.ua');
  if (s === 'epicentr') return u.includes('epicentrk.ua');
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

  return true;
}

function formatProduct(p) {
  if (!p) return null;
  let rawPrices = Array.isArray(p.prices) && p.prices.length > 0 ? p.prices : [];
  const initialStorePrices = Object.assign({}, p.storePrices || {});

  // If prices array was missing but storePrices existed, restore prices from storePrices
  if (rawPrices.length === 0 && Object.keys(initialStorePrices).length > 0) {
    rawPrices = Object.entries(initialStorePrices).map(([store, val]) => ({
      store,
      price: val.price,
      oldPrice: val.oldPrice || val.old_price,
      old_price: val.old_price || val.oldPrice,
      sourceUrl: val.sourceUrl || val.source_url
    }));
  }

  const prices = [];
  const finalStorePrices = {};

  for (const pr of rawPrices) {
    const storeSlug = String(pr.store || '').toLowerCase().trim();
    if (!storeSlug) continue;

    const sourceUrl = pr.sourceUrl || pr.source_url || null;
    if (sourceUrl && !isStoreUrlConsistent(storeSlug, sourceUrl)) {
      continue;
    }

    const numPrice = Number((parseFloat(pr.price) || 0).toFixed(2));
    if (isNaN(numPrice) || numPrice <= 0) continue;

    const rawOld = pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price;
    const numOld = (rawOld && !isNaN(parseFloat(rawOld)) && parseFloat(rawOld) > numPrice)
      ? Number(parseFloat(rawOld).toFixed(2))
      : null;
    const discount = numOld && numOld > numPrice ? Math.round(((numOld - numPrice) / numOld) * 100) : 0;

    prices.push({
      store: storeSlug,
      price: numPrice,
      oldPrice: numOld,
      old_price: numOld,
      sourceUrl
    });

    finalStorePrices[storeSlug] = {
      price: numPrice,
      oldPrice: numOld,
      old_price: numOld,
      discount,
      sourceUrl
    };
  }

  const title = (p.title || p.name || '').trim();
  const mainCategory = p.mainCategory || p.main_category || 'Продукти';
  const subCategory = p.subCategory || p.sub_category || p.category || 'Бакалія';
  const category = p.category || subCategory;
  const promoTag = p.promoTag || p.promo_tag || 'Акція';
  const syncedAt = p.syncedAt || p.synced_at || p.updated_at || new Date().toISOString();

  return {
    id: p.id,
    name: title,
    title,
    mainCategory,
    main_category: mainCategory,
    subCategory,
    sub_category: subCategory,
    category,
    categorySlug: CATEGORY_SLUGS[subCategory] || CATEGORY_SLUGS[category] || 'grocery',
    promoTag,
    promo_tag: promoTag,
    unit: p.unit || 'шт',
    syncedAt,
    updated_at: syncedAt,
    prices,
    storePrices: finalStorePrices
  };
}

// 2. Картки лояльності (Loyalty Cards)
async function getCards(userId) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM loyalty_cards WHERE user_id = $1 OR user_id = 1 ORDER BY id DESC',
      [userId || 1]
    );
    return res.rows.map(formatCard);
  }
  const store = loadLocalStore();
  return store.loyalty_cards.map(formatCard);
}

async function getCardById(id) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM loyalty_cards WHERE id = $1', [id]);
    return res.rows[0] ? formatCard(res.rows[0]) : null;
  }
  const store = loadLocalStore();
  const card = store.loyalty_cards.find(c => String(c.id) === String(id)) || null;
  return formatCard(card);
}

async function createCard(cardData, userId) {
  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO loyalty_cards (user_id, store, program, card_number, qr_payload, points, cashback, screenshot_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        userId || 1,
        cardData.store,
        cardData.program || '',
        cardData.card_number || cardData.number,
        cardData.qr_payload || cardData.number,
        cardData.points || cardData.note || '',
        cardData.cashback || '',
        cardData.screenshot_data || cardData.screenshotDataUrl || null
      ]
    );
    return formatCard(res.rows[0]);
  }
  const store = loadLocalStore();
  const maxId = store.loyalty_cards.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0);
  const newCard = {
    id: maxId + 1,
    user_id: userId || 1,
    store: cardData.store,
    program: cardData.program || '',
    card_number: cardData.card_number || cardData.number,
    qr_payload: cardData.qr_payload || cardData.number,
    points: cardData.points || cardData.note || '',
    cashback: cardData.cashback || '',
    screenshot_data: cardData.screenshot_data || cardData.screenshotDataUrl || null,
    created_at: new Date().toISOString()
  };
  store.loyalty_cards.unshift(newCard);
  saveLocalStore(store);
  return formatCard(newCard);
}

async function updateCard(id, cardData) {
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE loyalty_cards SET
        store = COALESCE($1, store),
        program = COALESCE($2, program),
        card_number = COALESCE($3, card_number),
        qr_payload = COALESCE($4, qr_payload),
        points = COALESCE($5, points),
        cashback = COALESCE($6, cashback),
        screenshot_data = COALESCE($7, screenshot_data)
       WHERE id = $8 RETURNING *`,
      [
        cardData.store,
        cardData.program,
        cardData.card_number || cardData.number,
        cardData.qr_payload || cardData.number,
        cardData.points || cardData.note,
        cardData.cashback,
        cardData.screenshot_data || cardData.screenshotDataUrl,
        id
      ]
    );
    return res.rows[0] ? formatCard(res.rows[0]) : null;
  }
  const store = loadLocalStore();
  const idx = store.loyalty_cards.findIndex(c => String(c.id) === String(id));
  if (idx === -1) return null;
  store.loyalty_cards[idx] = {
    ...store.loyalty_cards[idx],
    ...cardData,
    card_number: cardData.card_number || cardData.number || store.loyalty_cards[idx].card_number,
    qr_payload: cardData.qr_payload || cardData.number || store.loyalty_cards[idx].qr_payload
  };
  saveLocalStore(store);
  return formatCard(store.loyalty_cards[idx]);
}

async function deleteCard(id) {
  if (isPostgres) {
    const res = await pgPool.query('DELETE FROM loyalty_cards WHERE id = $1 RETURNING id', [id]);
    return res.rowCount > 0;
  }
  const store = loadLocalStore();
  const initLen = store.loyalty_cards.length;
  store.loyalty_cards = store.loyalty_cards.filter(c => String(c.id) !== String(id));
  saveLocalStore(store);
  return store.loyalty_cards.length < initLen;
}

// 3. Акційні товари (Products & Prices)
async function getProducts({ category, search, sort, city } = {}) {
  let products = [];

  if (isPostgres) {
    let query = 'SELECT * FROM products';
    const params = [];
    if (city && city !== 'all') {
      params.push(city);
      query += ' WHERE (city = $1 OR city = \'all\' OR city IS NULL)';
    }
    query += ' ORDER BY id DESC';

    const prodRes = await pgPool.query(query, params);
    const priceRes = await pgPool.query('SELECT * FROM product_prices');

    const pricesByProd = {};
    for (const pr of priceRes.rows) {
      const pId = String(pr.product_id);
      if (!pricesByProd[pId]) pricesByProd[pId] = [];
      const numPrice = parseFloat(pr.price);
      if (isNaN(numPrice) || numPrice <= 0) continue;
      pricesByProd[pId].push({
        store: String(pr.store || '').toLowerCase().trim(),
        price: numPrice,
        old_price: pr.old_price ? parseFloat(pr.old_price) : null,
        oldPrice: pr.old_price ? parseFloat(pr.old_price) : null,
        sourceUrl: pr.source_url || null,
        source_url: pr.source_url || null
      });
    }

    products = prodRes.rows.map(p => {
      const existingPrices = (Array.isArray(p.prices) && p.prices.length > 0)
        ? p.prices
        : (pricesByProd[String(p.id)] || []);
      const mainCat = p.main_category || 'Продукти';
      const subCat = p.sub_category || p.category || 'Бакалія';
      const cat = p.category || subCat;
      const tag = p.promo_tag || 'Акція';
      const syncedAt = p.synced_at || p.updated_at || new Date().toISOString();

      return {
        id: p.id,
        name: p.name,
        title: p.name,
        city: p.city || 'ivano-frankivsk',
        category: cat,
        mainCategory: mainCat,
        main_category: mainCat,
        subCategory: subCat,
        sub_category: subCat,
        promoTag: tag,
        promo_tag: tag,
        syncedAt,
        updated_at: syncedAt,
        prices: existingPrices
      };
    });
  } else {
    const store = loadLocalStore();
    const pricesByProd = {};
    if (Array.isArray(store.product_prices) && store.product_prices.length > 0) {
      for (const pr of store.product_prices) {
        const pId = String(pr.product_id || pr.productId);
        if (!pricesByProd[pId]) pricesByProd[pId] = [];
        const numPrice = parseFloat(pr.price);
        if (isNaN(numPrice) || numPrice <= 0) continue;
        pricesByProd[pId].push({
          store: String(pr.store || '').toLowerCase().trim(),
          price: numPrice,
          old_price: pr.old_price !== undefined ? pr.old_price : (pr.oldPrice || null),
          oldPrice: pr.oldPrice !== undefined ? pr.oldPrice : (pr.old_price || null),
          sourceUrl: pr.sourceUrl || pr.source_url || null
        });
      }
    }

    products = (store.products || []).map(p => {
      // PRESERVE p.prices if it already exists on p and is non-empty
      const existingPrices = (Array.isArray(p.prices) && p.prices.length > 0)
        ? p.prices
        : (pricesByProd[String(p.id)] || pricesByProd[Number(p.id)] || []);
      return {
        ...p,
        title: p.name || p.title,
        prices: existingPrices
      };
    });
  }

  // City-Specific Local Store Price Filtering
  if (city) {
    try {
      const { getCityConfig } = require('../config/cities');
      const cityConfig = getCityConfig(city);
      if (cityConfig && Array.isArray(cityConfig.activeStores)) {
        products = products.map(p => {
          const cityPrices = (p.prices || []).filter(pr => {
            const s = String(pr.store || '').toLowerCase().trim();
            return cityConfig.activeStores.includes(s);
          });
          return {
            ...p,
            prices: cityPrices
          };
        }).filter(p => p.prices.length > 0);
      }
    } catch (_) {}
  }

  // Filters
  if (category && category !== 'all') {
    products = products.filter(p => p.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (sort === 'cheap') {
    products.sort((a, b) => {
      const getMin = (item) => {
        const prs = (Array.isArray(item.prices) ? item.prices : [])
          .map(x => parseFloat(x.price))
          .filter(x => !isNaN(x) && x > 0);
        return prs.length > 0 ? Math.min(...prs) : Infinity;
      };
      return getMin(a) - getMin(b);
    });
  } else if (sort === 'title') {
    products.sort((a, b) => (a.name || a.title).localeCompare(b.name || b.title, 'uk'));
  }

  // Format products and strictly filter out any product whose prices array is empty
  return products
    .map(formatProduct)
    .filter(p => p && Array.isArray(p.prices) && p.prices.length > 0);
}

async function getProductById(id) {
  const products = await getProducts();
  return products.find(p => String(p.id) === String(id)) || null;
}

async function createProduct(prodData) {
  const name = prodData.name || prodData.title;
  const category = prodData.category;
  const promo_tag = prodData.promo_tag || 'Акція';
  const prices = prodData.prices || [];

  if (isPostgres) {
    const mainCat = prodData.mainCategory || prodData.main_category || 'Продукти';
    const subCat = prodData.subCategory || prodData.sub_category || category || 'Бакалія';
    const cityVal = prodData.city || 'ivano-frankivsk';
    const res = await pgPool.query(
      `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [name, cityVal, subCat || category, mainCat, subCat, promo_tag]
    );
    const newProd = res.rows[0];
    const insertedPrices = [];

    for (const p of prices) {
      const prRes = await pgPool.query(
        `INSERT INTO product_prices (product_id, store, price, old_price, source_url) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [newProd.id, p.store, p.price, p.old_price || p.oldPrice || null, p.sourceUrl || p.source_url || null]
      );
      insertedPrices.push({
        store: prRes.rows[0].store,
        price: parseFloat(prRes.rows[0].price),
        old_price: prRes.rows[0].old_price ? parseFloat(prRes.rows[0].old_price) : null,
        oldPrice: prRes.rows[0].old_price ? parseFloat(prRes.rows[0].old_price) : null,
        sourceUrl: prRes.rows[0].source_url || null
      });
    }

    return formatProduct({
      ...newProd,
      title: newProd.name,
      prices: insertedPrices
    });
  }

  const store = loadLocalStore();
  const maxId = store.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
  const mainCategory = prodData.mainCategory || prodData.main_category || 'Продукти';
  const subCategory = prodData.subCategory || prodData.sub_category || category || 'Бакалія';
  const promoTag = prodData.promoTag || prodData.promo_tag || 'Акція';
  const unit = prodData.unit || 'шт';
  const city = prodData.city || 'ivano-frankivsk';

  const newProduct = {
    id: maxId + 1,
    name,
    title: name,
    mainCategory,
    main_category: mainCategory,
    subCategory,
    sub_category: subCategory,
    category: subCategory || category,
    city,
    unit,
    promoTag,
    promo_tag: promoTag,
    updated_at: new Date().toISOString(),
    prices
  };
  store.products.unshift(newProduct);
  saveLocalStore(store);
  return formatProduct(newProduct);
}

async function updateProduct(id, prodData) {
  const name = prodData.name || prodData.title;
  const category = prodData.category;
  const promo_tag = prodData.promoTag || prodData.promo_tag;
  const prices = prodData.prices;

  if (isPostgres) {
    const mainCat = prodData.mainCategory || prodData.main_category;
    const subCat = prodData.subCategory || prodData.sub_category;
    const cityVal = prodData.city;
    const res = await pgPool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        promo_tag = COALESCE($3, promo_tag),
        city = COALESCE($4, city),
        main_category = COALESCE($5, main_category),
        sub_category = COALESCE($6, sub_category),
        synced_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, category, promo_tag, cityVal, mainCat, subCat, id]
    );
    if (res.rowCount === 0) return null;

    if (prices && Array.isArray(prices)) {
      await pgPool.query('DELETE FROM product_prices WHERE product_id = $1', [id]);
      for (const p of prices) {
        await pgPool.query(
          `INSERT INTO product_prices (product_id, store, price, old_price, source_url) VALUES ($1, $2, $3, $4, $5)`,
          [id, p.store, p.price, p.old_price || p.oldPrice || null, p.sourceUrl || p.source_url || null]
        );
      }
    }
    return getProductById(id);
  }

  const store = loadLocalStore();
  const idx = store.products.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;

  const current = store.products[idx];
  const mainCategory = prodData.mainCategory || prodData.main_category || current.mainCategory || 'Продукти';
  const subCategory = prodData.subCategory || prodData.sub_category || prodData.category || current.subCategory || 'Бакалія';
  const promoTag = prodData.promoTag || prodData.promo_tag || current.promoTag || 'Акція';
  const unit = prodData.unit || current.unit || 'шт';
  const city = prodData.city || current.city || 'ivano-frankivsk';

  store.products[idx] = {
    ...current,
    ...prodData,
    name: name || current.name,
    title: name || current.title,
    mainCategory,
    main_category: mainCategory,
    subCategory,
    sub_category: subCategory,
    category: subCategory,
    city,
    unit,
    promoTag,
    promo_tag: promoTag,
    prices: prices || current.prices,
    updated_at: new Date().toISOString()
  };
  saveLocalStore(store);
  return formatProduct(store.products[idx]);
}

async function deleteProduct(id) {
  if (isPostgres) {
    const res = await pgPool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    return res.rowCount > 0;
  }
  const store = loadLocalStore();
  const initLen = store.products.length;
  store.products = store.products.filter(p => String(p.id) !== String(id));
  saveLocalStore(store);
  return store.products.length < initLen;
}

async function syncProducts(scrapedProducts, city) {
  if (!scrapedProducts || !Array.isArray(scrapedProducts) || scrapedProducts.length === 0) {
    return getProducts({ city });
  }

  const now = new Date().toISOString();

  // Validate every product and its prices before saving
  const validProducts = scrapedProducts
    .map(item => {
      const title = (item.name || item.title || '').trim();
      const promoTag = item.promoTag || item.promo_tag || 'Жива акція';
      const prices = (item.prices || [])
        .map(pr => {
          const numPrice = Number((parseFloat(pr.price) || 0).toFixed(2));
          const rawOld = pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price;
          const numOld = (rawOld && !isNaN(parseFloat(rawOld)) && parseFloat(rawOld) > numPrice)
            ? Number(parseFloat(rawOld).toFixed(2))
            : null;
          const store = String(pr.store || '').toLowerCase().trim();
          const sourceUrl = pr.sourceUrl || pr.source_url || '';
          if (sourceUrl && !isStoreUrlConsistent(store, sourceUrl)) {
            return null;
          }
          return {
            store,
            price: numPrice,
            oldPrice: numOld,
            old_price: numOld,
            sourceUrl
          };
        })
        .filter(pr => pr && pr.store && typeof pr.price === 'number' && !isNaN(pr.price) && pr.price > 0 && pr.sourceUrl);

      const cat = item.category || item.subCategory || 'Бакалія';
      const mainCat = item.mainCategory || item.main_category || 'Продукти';
      const subCat = item.subCategory || item.sub_category || cat;
      return {
        ...item,
        name: title,
        title,
        mainCategory: mainCat,
        main_category: mainCat,
        subCategory: subCat,
        sub_category: subCat,
        category: cat,
        promoTag,
        promo_tag: promoTag,
        unit: item.unit || 'шт',
        syncedAt: item.syncedAt || now,
        updated_at: item.updated_at || now,
        prices
      };
    })
    .filter(item => item.title && Array.isArray(item.prices) && item.prices.length > 0);

  if (isPostgres) {
    // 1. Completely purge existing products and prices
    await pgPool.query('TRUNCATE TABLE product_prices, products RESTART IDENTITY CASCADE;');

    const insertedList = [];
    for (const item of validProducts) {
      const name = item.title;
      const cat = item.category;
      const mainCat = item.mainCategory || item.main_category || 'Продукти';
      const subCat = item.subCategory || item.sub_category || cat;
      const tag = item.promo_tag;
      const itemCity = item.city || city || 'ivano-frankivsk';
      const syncedAt = item.syncedAt || now;

      const prodRes = await pgPool.query(
        `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, itemCity, cat, mainCat, subCat, tag, syncedAt]
      );
      const newProd = prodRes.rows[0];
      const insertedPrices = [];

      for (const pr of item.prices) {
        const prRes = await pgPool.query(
          `INSERT INTO product_prices (product_id, store, price, old_price, source_url) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [newProd.id, pr.store, pr.price, pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price, pr.sourceUrl || pr.source_url || null]
        );
        insertedPrices.push({
          store: prRes.rows[0].store,
          price: parseFloat(prRes.rows[0].price),
          old_price: prRes.rows[0].old_price ? parseFloat(prRes.rows[0].old_price) : null,
          oldPrice: prRes.rows[0].old_price ? parseFloat(prRes.rows[0].old_price) : null,
          sourceUrl: prRes.rows[0].source_url || null
        });
      }

      insertedList.push(formatProduct({
        ...newProd,
        syncedAt,
        prices: insertedPrices
      }));
    }

    // Dual Sync: mirror into local-store.json so both databases stay 100% in sync
    const store = loadLocalStore();
    store.products = validProducts;
    store.product_prices = buildSeedProductPrices(validProducts);
    saveLocalStore(store);

    return insertedList.filter(p => p && Array.isArray(p.prices) && p.prices.length > 0);
  }

  // Local JSON Mode: Populate BOTH data.products AND data.product_prices!
  const store = loadLocalStore();
  let nextId = 1;
  let nextPriceId = 1;
  const allProductPrices = [];

  store.products = validProducts.map(item => {
    const prodId = nextId++;
    const formattedPrices = item.prices.map(pr => {
      const priceEntry = {
        id: nextPriceId++,
        product_id: prodId,
        productId: prodId,
        store: pr.store,
        price: pr.price,
        oldPrice: pr.oldPrice,
        old_price: pr.oldPrice,
        sourceUrl: pr.sourceUrl,
        source_url: pr.sourceUrl
      };
      allProductPrices.push(priceEntry);

      return {
        store: pr.store,
        price: pr.price,
        oldPrice: pr.oldPrice,
        old_price: pr.oldPrice,
        sourceUrl: pr.sourceUrl
      };
    });

    return {
      id: prodId,
      name: item.title,
      title: item.title,
      mainCategory: item.mainCategory || 'Продукти',
      main_category: item.mainCategory || 'Продукти',
      subCategory: item.subCategory || item.category || 'Бакалія',
      sub_category: item.subCategory || item.category || 'Бакалія',
      category: item.category || 'Бакалія',
      promoTag: item.promoTag,
      promo_tag: item.promoTag,
      unit: item.unit,
      syncedAt: item.syncedAt,
      updated_at: item.updated_at,
      prices: formattedPrices
    };
  });

  store.product_prices = allProductPrices;
  saveLocalStore(store);
  return getProducts({ city });
}

module.exports = {
  initDatabase,
  query: (text, params) => (isPostgres ? pgPool.query(text, params) : null),
  isPostgresConnected: () => isPostgres,
  getLocalStorePath: () => LOCAL_STORE_PATH,
  // Users
  findUserByEmail,
  findUserById,
  createUser,
  // Cards
  getCards,
  getCardById,
  createCard,
  updateCard,
  deleteCard,
  // Products
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  syncProducts
};
