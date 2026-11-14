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
const STAFF_ACCOUNTS = [
  {
    id: 1,
    name: 'bleki',
    email: 'bleki@aurelia.ua',
    password_hash: bcrypt.hashSync('Bleki123!', 10),
    role: 'ADMIN',
    is_verified: true,
    verification_code: null,
    verification_expires: null,
    reset_code: null,
    reset_expires: null,
    last_seen_at: null,
    basket_data: [],
    basket_cleared_at: null,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Qa1',
    email: 'Qa1@aurelia.ua',
    password_hash: bcrypt.hashSync('Qa1123!', 10),
    role: 'QA',
    is_verified: true,
    verification_code: null,
    verification_expires: null,
    reset_code: null,
    reset_expires: null,
    last_seen_at: null,
    basket_data: [],
    basket_cleared_at: null,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Qa2',
    email: 'Qa2@aurelia.ua',
    password_hash: bcrypt.hashSync('Qa2123!', 10),
    role: 'QA',
    is_verified: true,
    verification_code: null,
    verification_expires: null,
    reset_code: null,
    reset_expires: null,
    last_seen_at: null,
    basket_data: [],
    basket_cleared_at: null,
    created_at: new Date().toISOString()
  }
];

const DEFAULT_ADMIN = STAFF_ACCOUNTS[0];

function isStaffDomainEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith('@aurelia.ua');
}

function getEffectiveUserRole(user) {
  if (!user) return 'USER';
  if (!isStaffDomainEmail(user.email)) return 'USER';
  const r = String(user.role || 'USER').toUpperCase();
  return (r === 'ADMIN' || r === 'QA') ? r : 'USER';
}

const SEED_TS = new Date().toISOString();
const SEED_CARDS = [
  [1, 'silpo', 'Власний Рахунок', '990001248831', '142.50 балів', 'Преміум гість'],
  [2, 'atb',   'Картка АТБ',     '414949910023', 'Знижка до 5%', 'Екстра Знижка'],
  [3, 'novus', 'Ваша Картка',    '290000418552', '85.00 грн',    'VIP Покупець'],
  [4, 'varus', 'VARUS Poshuk',   '770089231104', '230 бонусів',  'VARUS Family'],
  [5, 'metro', 'METRO Club',     '500291103381', 'Партнерська ціна', 'Бізнес Клієнт']
].map(([id, store, program, num, points, cashback]) => ({
  id, user_id: 1, store, program, card_number: num, qr_payload: num, points, cashback, screenshot_data: null, created_at: SEED_TS
}));

const mkSeedProd = (id, name, category, promo_tag, prices) => ({
  id, name, category, promo_tag, updated_at: SEED_TS,
  prices: prices.map(([store, price, old_price]) => ({ store, price, old_price }))
});

const SEED_PRODUCTS = [
  mkSeedProd(1, 'Кава Lavazza Crema e Gusto мелена 250 г', 'Кава та Чай', 'Хіт продажу', [['silpo', 149.90, 199], ['atb', 139.50, 189], ['novus', 154, 205], ['varus', 145, 195], ['metro', 142, 185]]),
  mkSeedProd(2, 'Чай Greenfield Golden Ceylon чорний 100 пакетиків', 'Кава та Чай', 'Знижка тижня', [['silpo', 129, 175], ['atb', 135, 180], ['novus', 124.90, 169], ['varus', 128, 172], ['metro', 126, 170]]),
  mkSeedProd(3, 'Молоко Яготинське 2.6% пастеризоване 900 г', 'Молочні', 'Соціальна ціна', [['silpo', 38.99, 47.90], ['atb', 36.40, 44.50], ['novus', 39.50, 48], ['varus', 37.90, 46], ['metro', 37, 45]]),
  mkSeedProd(4, 'Сир твердий КОМО Тенеро 50% брус 180 г', 'Молочні', 'Краща ціна', [['silpo', 64.99, 89.90], ['atb', 67.50, 91], ['novus', 69.90, 94], ['varus', 66, 89], ['metro', 65.50, 88]]),
  mkSeedProd(5, 'Філе індички охолоджене фермерське 1 кг', "М'ясо та Риба", 'Свіже м’ясо', [['silpo', 219, 289], ['atb', 215, 279], ['novus', 225, 295], ['varus', 209.90, 275], ['metro', 212, 280]]),
  mkSeedProd(6, 'Лосось слабосолений філе Norven 180 г', "М'ясо та Риба", 'Делікатес', [['silpo', 179, 239], ['atb', 169.90, 229], ['novus', 185, 245], ['varus', 174, 230], ['metro', 172, 228]]),
  mkSeedProd(7, 'Шоколад Roshen екстрачорний з цілим ліщиною 85 г', 'Солодощі', 'Суперціна', [['silpo', 34.50, 48], ['atb', 31.90, 45], ['novus', 36, 49], ['varus', 33.50, 47], ['metro', 32.50, 46]]),
  mkSeedProd(8, 'Цукерки Ferrero Rocher хрусткі з горіхом 200 г', 'Солодощі', 'Преміум', [['silpo', 199, 265], ['atb', 195, 259], ['novus', 189.90, 255], ['varus', 196, 260], ['metro', 192, 258]]),
  mkSeedProd(9, 'Олія соняшникова Чумак рафінована 850 мл', 'Бакалія', 'Топ вибір', [['silpo', 54.90, 68], ['atb', 49.90, 64], ['novus', 56, 69], ['varus', 52.50, 66], ['metro', 51, 65]]),
  mkSeedProd(10, 'Макарони Barilla Spaghetti n.5 спагеті 500 г', 'Бакалія', 'Італія', [['silpo', 59.90, 85], ['atb', 58.50, 82], ['novus', 54.90, 79], ['varus', 61, 86], ['metro', 56, 80]]),
  mkSeedProd(11, 'Вода мінеральна Borjomi лікувальна 0.5 л скло', 'Напої', 'Знижка', [['silpo', 39.90, 52], ['atb', 37.50, 49], ['novus', 41, 54], ['varus', 38.90, 50], ['metro', 38, 49.50]]),
  mkSeedProd(12, 'Сік Sandora Гранатовий 100% преміум 0.95 л', 'Напої', '100% Сік', [['silpo', 68, 89], ['atb', 69.50, 91], ['novus', 66.90, 88], ['varus', 67.50, 89], ['metro', 65, 85]])
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

function reconcileLocalUsers(rawUsers) {
  let changed = false;
  const users = Array.isArray(rawUsers) ? rawUsers.filter(Boolean).map(u => {
    const staffMatch = STAFF_ACCOUNTS.find(s => s.email.toLowerCase() === String(u.email || '').toLowerCase());
    if (staffMatch) {
      const needsUpdate =
        u.name !== staffMatch.name ||
        u.email !== staffMatch.email ||
        u.role !== staffMatch.role ||
        u.is_verified !== true ||
        !u.password_hash;
      if (needsUpdate) changed = true;
      return {
        ...u,
        name: staffMatch.name,
        email: staffMatch.email,
        role: staffMatch.role,
        password_hash: u.password_hash || staffMatch.password_hash,
        is_verified: true,
        verification_code: null,
        verification_expires: null,
        last_seen_at: u.last_seen_at !== undefined ? u.last_seen_at : null,
        basket_data: Array.isArray(u.basket_data) ? u.basket_data : [],
        basket_cleared_at: u.basket_cleared_at !== undefined ? u.basket_cleared_at : null
      };
    }

    const safeRole = getEffectiveUserRole(u);
    const verifiedVal = u.is_verified === undefined ? true : Boolean(u.is_verified);
    if (
      u.role !== safeRole ||
      u.is_verified === undefined ||
      u.verification_code === undefined ||
      u.verification_expires === undefined ||
      u.reset_code === undefined ||
      u.reset_expires === undefined ||
      u.last_seen_at === undefined ||
      u.basket_data === undefined ||
      u.basket_cleared_at === undefined
    ) {
      changed = true;
    }

    return {
      ...u,
      role: safeRole,
      is_verified: verifiedVal,
      verification_code: u.verification_code !== undefined ? u.verification_code : null,
      verification_expires: u.verification_expires !== undefined ? u.verification_expires : null,
      reset_code: u.reset_code !== undefined ? u.reset_code : null,
      reset_expires: u.reset_expires !== undefined ? u.reset_expires : null,
      last_seen_at: u.last_seen_at !== undefined ? u.last_seen_at : null,
      basket_data: Array.isArray(u.basket_data) ? u.basket_data : [],
      basket_cleared_at: u.basket_cleared_at !== undefined ? u.basket_cleared_at : null
    };
  }) : [];

  for (const staff of STAFF_ACCOUNTS) {
    const existsIdx = users.findIndex(u => String(u.email || '').toLowerCase() === staff.email.toLowerCase());
    if (existsIdx === -1) {
      const maxId = users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
      users.push({
        ...staff,
        id: users.some(u => Number(u.id) === staff.id) ? maxId + 1 : staff.id
      });
      changed = true;
    } else if (
      (staff.email === 'bleki@aurelia.ua' && !bcrypt.compareSync('Bleki123!', users[existsIdx].password_hash)) ||
      (staff.email === 'Qa1@aurelia.ua' && !bcrypt.compareSync('Qa1123!', users[existsIdx].password_hash)) ||
      (staff.email === 'Qa2@aurelia.ua' && !bcrypt.compareSync('Qa2123!', users[existsIdx].password_hash))
    ) {
      users[existsIdx].password_hash = staff.password_hash;
      changed = true;
    }
  }

  return { users, changed };
}

function loadLocalStore() {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    const initialData = {
      users: STAFF_ACCOUNTS.map(u => ({ ...u })),
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
    const { users, changed } = reconcileLocalUsers(parsed.users);
    parsed.users = users;
    if (!Array.isArray(parsed.loyalty_cards)) {
      parsed.loyalty_cards = [];
    }
    if (!parsed.product_prices || !Array.isArray(parsed.product_prices)) {
      parsed.product_prices = buildSeedProductPrices(parsed.products);
    }
    if (changed) {
      saveLocalStore(parsed);
    }
    return parsed;
  } catch (err) {
    console.error('Помилка зчитування local-store.json:', err);
    return {
      users: STAFF_ACCOUNTS.map(u => ({ ...u })),
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
      const priceRowsQueue = [];
      const PRODUCT_BATCH_SIZE = 200;

      for (let i = 0; i < localProds.length; i += PRODUCT_BATCH_SIZE) {
        const chunk = localProds.slice(i, i + PRODUCT_BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((p, idx) => {
          const base = idx * 7;
          const mainCat = p.mainCategory || p.main_category || 'Продукти';
          const subCat = p.subCategory || p.sub_category || p.category || 'Бакалія';
          values.push(
            (p.title || p.name).trim(),
            p.city || 'ivano-frankivsk',
            p.category || subCat,
            mainCat,
            subCat,
            p.promoTag || p.promo_tag || 'Акція',
            p.syncedAt || p.synced_at || p.updated_at || new Date().toISOString()
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        });

        const insRes = await client.query(
          `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
           VALUES ${placeholders.join(', ')} RETURNING id`,
          values
        );

        insRes.rows.forEach((row, idx) => {
          for (const pr of chunk[idx].prices) {
            const storeSlug = String(pr.store || '').toLowerCase().trim();
            const price = parseFloat(pr.price);
            if (!storeSlug || isNaN(price) || price <= 0) continue;
            const oldPrice = parseFloat(pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price) || null;
            const sourceUrl = pr.sourceUrl || pr.source_url || null;
            priceRowsQueue.push([row.id, storeSlug, price, oldPrice, sourceUrl]);
          }
        });
      }

      const PRICE_BATCH_SIZE = 400;
      for (let i = 0; i < priceRowsQueue.length; i += PRICE_BATCH_SIZE) {
        const chunk = priceRowsQueue.slice(i, i + PRICE_BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((r, idx) => {
          const base = idx * 5;
          values.push(r[0], r[1], r[2], r[3], r[4]);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        });
        await client.query(
          `INSERT INTO product_prices (product_id, store, price, old_price, source_url)
           VALUES ${placeholders.join(', ')}`,
          values
        );
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
        ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'USER';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(12);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(12);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS basket_data JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS basket_cleared_at TIMESTAMP DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user_id ON loyalty_cards(user_id);
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

      // Enforce @aurelia.ua domain restriction & ensure existing users created before OTP migration stay verified
      await pgPool.query(
        `UPDATE users
         SET role = 'USER'
         WHERE LOWER(email) NOT LIKE '%@aurelia.ua'
           AND role IN ('ADMIN', 'QA')`
      );
      await pgPool.query(
        `UPDATE users
         SET is_verified = TRUE
         WHERE LOWER(email) LIKE '%@aurelia.ua'
            OR (is_verified IS NOT TRUE AND verification_code IS NULL)`
      );

      // Auto-seed / upsert staff accounts (ADMIN: bleki, QA: Qa1, Qa2)
      for (const staff of STAFF_ACCOUNTS) {
        const existingStaff = await pgPool.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [staff.email]
        );
        if (existingStaff.rowCount === 0) {
          await pgPool.query(
            `INSERT INTO users (name, email, password_hash, role, is_verified, verification_code, verification_expires)
             VALUES ($1, $2, $3, $4, TRUE, NULL, NULL)`,
            [staff.name, staff.email, staff.password_hash, staff.role]
          );
        } else {
          await pgPool.query(
            `UPDATE users
             SET name = $1,
                 email = $2,
                 password_hash = $3,
                 role = $4,
                 is_verified = TRUE,
                 verification_code = NULL,
                 verification_expires = NULL
             WHERE id = $5`,
            [staff.name, staff.email, staff.password_hash, staff.role, existingStaff.rows[0].id]
          );
        }
      }
      console.log('✅ Персонал @aurelia.ua (bleki [ADMIN], Qa1 [QA], Qa2 [QA]) синхронізовано у PostgreSQL.');

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
    const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  return store.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

async function findUserByIdentifier(identifier) {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) return null;
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1',
      [cleanId]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const lower = cleanId.toLowerCase();
  return store.users.find(u =>
    String(u.email || '').toLowerCase() === lower ||
    String(u.name || '').toLowerCase() === lower
  ) || null;
}

async function findUserById(id) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT id, name, email, role, is_verified, last_seen_at, basket_data, basket_cleared_at, created_at FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const u = store.users.find(user => String(user.id) === String(id));
  if (!u) return null;
  const { password_hash, verification_code, verification_expires, reset_code, reset_expires, ...safeUser } = u;
  return safeUser;
}

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function computeIsUserOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const ts = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return (Date.now() - ts) <= ONLINE_WINDOW_MS;
}

function sanitizeBasketArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map(item => ({
      productId: String(item.productId || item.id || ''),
      qty: Math.max(1, parseInt(item.qty, 10) || 1)
    }))
    .filter(item => item.productId.length > 0);
}

async function touchUserActivity(userId, options = {}) {
  if (!userId) return null;
  const { basket, lastClearedAckAt } = options || {};
  const hasBasketUpdate = Array.isArray(basket);
  const nowIso = new Date().toISOString();

  if (isPostgres) {
    const existingRes = await pgPool.query(
      'SELECT id, basket_data, basket_cleared_at FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (existingRes.rowCount === 0) return null;
    const row = existingRes.rows[0];
    const clearedMs = row.basket_cleared_at ? new Date(row.basket_cleared_at).getTime() : 0;
    const ackMs = lastClearedAckAt ? new Date(lastClearedAckAt).getTime() : 0;
    const clientOutdatedAfterClear = Boolean(clearedMs > 0 && (!ackMs || isNaN(ackMs) || clearedMs > ackMs));

    if (hasBasketUpdate && !clientOutdatedAfterClear) {
      const normalizedBasket = sanitizeBasketArray(basket);
      const upd = await pgPool.query(
        `UPDATE users
         SET last_seen_at = NOW(), basket_data = $2::jsonb
         WHERE id = $1
         RETURNING last_seen_at, basket_data, basket_cleared_at`,
        [userId, JSON.stringify(normalizedBasket)]
      );
      return upd.rows[0];
    }

    const upd = await pgPool.query(
      `UPDATE users
       SET last_seen_at = NOW()
       WHERE id = $1
       RETURNING last_seen_at, basket_data, basket_cleared_at`,
      [userId]
    );
    return upd.rows[0];
  }

  const store = loadLocalStore();
  const idx = store.users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) return null;

  store.users[idx].last_seen_at = nowIso;
  const clearedMs = store.users[idx].basket_cleared_at ? new Date(store.users[idx].basket_cleared_at).getTime() : 0;
  const ackMs = lastClearedAckAt ? new Date(lastClearedAckAt).getTime() : 0;
  const clientOutdatedAfterClear = Boolean(clearedMs > 0 && (!ackMs || isNaN(ackMs) || clearedMs > ackMs));

  if (hasBasketUpdate && !clientOutdatedAfterClear) {
    store.users[idx].basket_data = sanitizeBasketArray(basket);
  } else if (!Array.isArray(store.users[idx].basket_data)) {
    store.users[idx].basket_data = [];
  }

  saveLocalStore(store);
  return {
    last_seen_at: store.users[idx].last_seen_at,
    basket_data: store.users[idx].basket_data,
    basket_cleared_at: store.users[idx].basket_cleared_at || null
  };
}

async function getAllUsersForAdmin() {
  if (isPostgres) {
    const usersRes = await pgPool.query(
      `SELECT id, name, email, role, is_verified, last_seen_at, basket_data, basket_cleared_at, created_at
       FROM users
       ORDER BY id ASC`
    );
    const cardsRes = await pgPool.query(
      `SELECT id, user_id, store, card_number, created_at
       FROM loyalty_cards
       ORDER BY id DESC`
    );

    const cardsByUser = {};
    for (const c of cardsRes.rows) {
      const uid = String(c.user_id);
      if (!cardsByUser[uid]) cardsByUser[uid] = [];
      const storeSlug = String(c.store || 'silpo').toLowerCase().trim();
      cardsByUser[uid].push({
        id: c.id,
        store: storeSlug,
        storeName: STORE_NAMES[storeSlug] || storeSlug.toUpperCase(),
        number: c.card_number || ''
      });
    }

    return usersRes.rows.map(u => {
      const basketArr = Array.isArray(u.basket_data) ? u.basket_data : [];
      const basketCount = basketArr.reduce((sum, item) => sum + Math.max(1, parseInt(item?.qty, 10) || 1), 0);
      return {
        id: u.id,
        name: u.name || (u.email ? u.email.split('@')[0] : 'Користувач'),
        email: u.email,
        role: getEffectiveUserRole(u),
        is_verified: Boolean(u.is_verified),
        created_at: u.created_at,
        last_seen_at: u.last_seen_at || null,
        is_online: computeIsUserOnline(u.last_seen_at),
        basket_count: basketCount,
        basket_cleared_at: u.basket_cleared_at || null,
        cards: cardsByUser[String(u.id)] || []
      };
    });
  }

  const store = loadLocalStore();
  const cardsByUser = {};
  (store.loyalty_cards || []).forEach(c => {
    const uid = String(c.user_id);
    if (!cardsByUser[uid]) cardsByUser[uid] = [];
    const storeSlug = String(c.store || 'silpo').toLowerCase().trim();
    cardsByUser[uid].push({
      id: c.id,
      store: storeSlug,
      storeName: STORE_NAMES[storeSlug] || storeSlug.toUpperCase(),
      number: c.card_number || c.number || ''
    });
  });

  return [...(store.users || [])]
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
    .map(u => {
      const basketArr = Array.isArray(u.basket_data) ? u.basket_data : [];
      const basketCount = basketArr.reduce((sum, item) => sum + Math.max(1, parseInt(item?.qty, 10) || 1), 0);
      return {
        id: u.id,
        name: u.name || (u.email ? u.email.split('@')[0] : 'Користувач'),
        email: u.email,
        role: getEffectiveUserRole(u),
        is_verified: Boolean(u.is_verified),
        created_at: u.created_at || null,
        last_seen_at: u.last_seen_at || null,
        is_online: computeIsUserOnline(u.last_seen_at),
        basket_count: basketCount,
        basket_cleared_at: u.basket_cleared_at || null,
        cards: cardsByUser[String(u.id)] || []
      };
    });
}

async function updateUserByAdmin(userId, updates = {}) {
  const existing = await findUserById(userId);
  if (!existing) return null;

  const isPrimaryAdmin = String(existing.email || '').trim().toLowerCase() === 'bleki@aurelia.ua';
  const nextName = updates.name !== undefined ? String(updates.name).trim() : existing.name;
  const nextEmail = updates.email !== undefined ? String(updates.email).trim().toLowerCase() : String(existing.email).toLowerCase();
  const requestedRole = updates.role !== undefined ? String(updates.role).trim().toUpperCase() : getEffectiveUserRole(existing);
  const nextVerified = updates.is_verified !== undefined ? Boolean(updates.is_verified) : Boolean(existing.is_verified);

  if (!nextName || nextName.length < 2) {
    const err = new Error('Ім’я користувача повинно містити щонайменше 2 символи.');
    err.status = 400;
    err.code = 'INVALID_NAME';
    throw err;
  }

  if (!nextEmail || !nextEmail.includes('@')) {
    const err = new Error('Вкажіть коректну адресу електронної пошти.');
    err.status = 400;
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  if (!['USER', 'QA', 'ADMIN'].includes(requestedRole)) {
    const err = new Error('Недопустима роль користувача.');
    err.status = 400;
    err.code = 'INVALID_ROLE';
    throw err;
  }

  if (isPrimaryAdmin && requestedRole !== 'ADMIN') {
    const err = new Error('Неможливо зняти роль ADMIN з головного адміністратора bleki@aurelia.ua.');
    err.status = 400;
    err.code = 'PROTECTED_ADMIN_ROLE';
    throw err;
  }

  if (isPrimaryAdmin && nextEmail !== 'bleki@aurelia.ua') {
    const err = new Error('Неможливо змінити системний Email головного адміністратора bleki@aurelia.ua.');
    err.status = 400;
    err.code = 'PROTECTED_ADMIN_EMAIL';
    throw err;
  }

  if ((requestedRole === 'ADMIN' || requestedRole === 'QA') && !isStaffDomainEmail(nextEmail)) {
    const err = new Error('Ролі ADMIN та QA доступні лише для корпоративних адрес @aurelia.ua.');
    err.status = 400;
    err.code = 'STAFF_DOMAIN_REQUIRED';
    throw err;
  }

  const dupEmailUser = await findUserByEmail(nextEmail);
  if (dupEmailUser && String(dupEmailUser.id) !== String(existing.id)) {
    const err = new Error('Користувач із таким Email уже існує.');
    err.status = 409;
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  if (isPostgres) {
    if (updates.password_hash) {
      const res = await pgPool.query(
        `UPDATE users
         SET name = $2, email = $3, role = $4, is_verified = $5, password_hash = $6
         WHERE id = $1
         RETURNING id, name, email, role, is_verified, last_seen_at, basket_cleared_at, created_at`,
        [userId, nextName, nextEmail, requestedRole, nextVerified, updates.password_hash]
      );
      return res.rows[0] || null;
    }
    const res = await pgPool.query(
      `UPDATE users
       SET name = $2, email = $3, role = $4, is_verified = $5
       WHERE id = $1
       RETURNING id, name, email, role, is_verified, last_seen_at, basket_cleared_at, created_at`,
      [userId, nextName, nextEmail, requestedRole, nextVerified]
    );
    return res.rows[0] || null;
  }

  const store = loadLocalStore();
  const idx = store.users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) return null;
  store.users[idx].name = nextName;
  store.users[idx].email = nextEmail;
  store.users[idx].role = requestedRole;
  store.users[idx].is_verified = nextVerified;
  if (updates.password_hash) {
    store.users[idx].password_hash = updates.password_hash;
  }
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = store.users[idx];
  return safeUser;
}

async function deleteUserCardByAdmin(userId, cardId) {
  return deleteCard(userId, cardId);
}

async function clearUserBasketByAdmin(userId) {
  if (!userId) return null;
  const nowIso = new Date().toISOString();
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE users
       SET basket_data = '[]'::jsonb, basket_cleared_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, basket_cleared_at`,
      [userId]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const idx = store.users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) return null;
  store.users[idx].basket_data = [];
  store.users[idx].basket_cleared_at = nowIso;
  saveLocalStore(store);
  return {
    id: store.users[idx].id,
    name: store.users[idx].name,
    email: store.users[idx].email,
    basket_cleared_at: store.users[idx].basket_cleared_at
  };
}

async function createUser({
  name,
  email,
  password_hash,
  role,
  is_verified = false,
  verification_code = null,
  verification_expires = null
}) {
  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO users (name, email, password_hash, role, is_verified, verification_code, verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, is_verified, created_at`,
      [name, email, password_hash, role || 'USER', Boolean(is_verified), verification_code, verification_expires]
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
    is_verified: Boolean(is_verified),
    verification_code: verification_code || null,
    verification_expires: verification_expires || null,
    reset_code: null,
    reset_expires: null,
    last_seen_at: null,
    basket_data: [],
    basket_cleared_at: null,
    created_at: new Date().toISOString()
  };
  store.users.push(newUser);
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = newUser;
  return safeUser;
}

async function setVerificationCode(email, code, expiresAt) {
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE users
       SET verification_code = $2, verification_expires = $3
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, name, email, role, is_verified, created_at`,
      [email, code, expiresAt]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const idx = store.users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return null;
  store.users[idx].verification_code = code;
  store.users[idx].verification_expires = expiresAt;
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = store.users[idx];
  return safeUser;
}

async function verifyUserEmail(email) {
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE users
       SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, name, email, role, is_verified, created_at`,
      [email]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const idx = store.users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return null;
  store.users[idx].is_verified = true;
  store.users[idx].verification_code = null;
  store.users[idx].verification_expires = null;
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = store.users[idx];
  return safeUser;
}

async function setPasswordResetCode(email, code, expiresAt) {
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE users
       SET reset_code = $2, reset_expires = $3
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, name, email, role, is_verified, created_at`,
      [email, code, expiresAt]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const idx = store.users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return null;
  store.users[idx].reset_code = code;
  store.users[idx].reset_expires = expiresAt;
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = store.users[idx];
  return safeUser;
}

async function resetUserPassword(email, password_hash) {
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE users
       SET password_hash = $2,
           reset_code = NULL,
           reset_expires = NULL,
           is_verified = TRUE,
           verification_code = NULL,
           verification_expires = NULL
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, name, email, role, is_verified, created_at`,
      [email, password_hash]
    );
    return res.rows[0] || null;
  }
  const store = loadLocalStore();
  const idx = store.users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return null;
  store.users[idx].password_hash = password_hash;
  store.users[idx].reset_code = null;
  store.users[idx].reset_expires = null;
  store.users[idx].is_verified = true;
  store.users[idx].verification_code = null;
  store.users[idx].verification_expires = null;
  saveLocalStore(store);
  const { password_hash: _, verification_code: _vc, verification_expires: _ve, reset_code: _rc, reset_expires: _re, ...safeUser } = store.users[idx];
  return safeUser;
}

/* ─── Normalization Helpers for Universal Client Compatibility ──────────── */
const STORE_NAMES = {
  silpo: 'Сільпо',
  atb: 'АТБ-Маркет',
  novus: 'NOVUS',
  varus: 'VARUS',
  metro: 'METRO',
  auchan: 'АШАН',
  epicentrk_food: 'Епіцентр Food',
  velmart: 'Велмарт',
  thrash: 'ТРАШ!',
  simi: 'Сімі',
  blyzenko: 'Близенько',
  taistra: 'Тайстра',
  arsen: 'Арсен',
  rukavychka: 'Рукавичка',
  eva: 'EVA',
  prostor: 'Prostor',
  avrora: 'Аврора',
  epicentr: 'Епіцентр К'
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

// 2. Картки лояльності (Loyalty Cards — Strict Per-User Isolation)
async function getCardsByUser(userId) {
  if (!userId) return [];
  try {
    await touchUserActivity(userId);
  } catch (_) {}
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM loyalty_cards WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    return res.rows.map(formatCard);
  }
  const store = loadLocalStore();
  return store.loyalty_cards
    .filter(c => String(c.user_id) === String(userId))
    .map(formatCard);
}

async function getCards(userId) {
  return getCardsByUser(userId);
}

async function getCardById(userId, cardId) {
  if (!userId || !cardId) return null;
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM loyalty_cards WHERE user_id = $1 AND id = $2',
      [userId, cardId]
    );
    return res.rows[0] ? formatCard(res.rows[0]) : null;
  }
  const store = loadLocalStore();
  const card = store.loyalty_cards.find(
    c => String(c.user_id) === String(userId) && String(c.id) === String(cardId)
  ) || null;
  return formatCard(card);
}

async function createCard(userIdArg, cardDataArg) {
  let userId = userIdArg;
  let cardData = cardDataArg;
  if (userIdArg && typeof userIdArg === 'object' && cardDataArg !== undefined) {
    cardData = userIdArg;
    userId = cardDataArg;
  }
  if (!userId || !cardData) {
    throw new Error('Потрібен ідентифікатор користувача та дані картки.');
  }

  const persistedQr = cardData.qr_payload || cardData.qrPayload || cardData.card_number || cardData.number;
  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO loyalty_cards (user_id, store, program, card_number, qr_payload, points, cashback, screenshot_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        userId,
        cardData.store,
        cardData.program || '',
        cardData.card_number || cardData.number,
        persistedQr,
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
    user_id: userId,
    store: cardData.store,
    program: cardData.program || '',
    card_number: cardData.card_number || cardData.number,
    qr_payload: persistedQr,
    points: cardData.points || cardData.note || '',
    cashback: cardData.cashback || '',
    screenshot_data: cardData.screenshot_data || cardData.screenshotDataUrl || null,
    created_at: new Date().toISOString()
  };
  store.loyalty_cards.unshift(newCard);
  saveLocalStore(store);
  return formatCard(newCard);
}

async function updateCard(userId, cardId, cardData) {
  if (!userId || !cardId || !cardData) return null;
  const persistedQr = cardData.qr_payload || cardData.qrPayload || cardData.card_number || cardData.number;
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE loyalty_cards SET
        store = COALESCE($2, store),
        program = COALESCE($3, program),
        card_number = COALESCE($4, card_number),
        qr_payload = COALESCE($5, qr_payload),
        points = COALESCE($6, points),
        cashback = COALESCE($7, cashback),
        screenshot_data = COALESCE($8, screenshot_data)
       WHERE user_id = $1 AND id = $9 RETURNING *`,
      [
        userId,
        cardData.store,
        cardData.program,
        cardData.card_number || cardData.number,
        persistedQr,
        cardData.points || cardData.note,
        cardData.cashback,
        cardData.screenshot_data || cardData.screenshotDataUrl,
        cardId
      ]
    );
    return res.rows[0] ? formatCard(res.rows[0]) : null;
  }
  const store = loadLocalStore();
  const idx = store.loyalty_cards.findIndex(
    c => String(c.user_id) === String(userId) && String(c.id) === String(cardId)
  );
  if (idx === -1) return null;
  store.loyalty_cards[idx] = {
    ...store.loyalty_cards[idx],
    ...cardData,
    user_id: store.loyalty_cards[idx].user_id,
    card_number: cardData.card_number || cardData.number || store.loyalty_cards[idx].card_number,
    qr_payload: persistedQr || store.loyalty_cards[idx].qr_payload
  };
  saveLocalStore(store);
  return formatCard(store.loyalty_cards[idx]);
}

async function deleteCard(userId, cardId) {
  if (!userId || !cardId) return false;
  if (isPostgres) {
    const res = await pgPool.query(
      'DELETE FROM loyalty_cards WHERE user_id = $1 AND id = $2 RETURNING id',
      [userId, cardId]
    );
    return res.rowCount > 0;
  }
  const store = loadLocalStore();
  const initLen = store.loyalty_cards.length;
  store.loyalty_cards = store.loyalty_cards.filter(
    c => !(String(c.user_id) === String(userId) && String(c.id) === String(cardId))
  );
  saveLocalStore(store);
  return store.loyalty_cards.length < initLen;
}

const SHORT_SEARCH_EXCLUDED_STEMS = {
  'рис': ['рисун', 'рисовк'],
  'сир': ['сироп', 'сироватк', 'сирник'],
  'мед': ['медич', 'медаль', 'медіа'],
  'сік': ['сікатор']
};

function normalizeUkText(str) {
  return String(str || '').toLowerCase().replace(/['’ʼ`]/g, "'").trim();
}

function tokenizeUkWords(text) {
  const norm = normalizeUkText(text);
  const rawTokens = norm.split(/[^а-яіїєґa-z0-9']+/i).filter(Boolean);
  const words = [];
  rawTokens.forEach((tok) => {
    const noApos = tok.replace(/'/g, '');
    if (noApos) words.push(noApos);
  });
  return words;
}

function matchesSearchToken(word, q, isShortToken) {
  if (!word || !q) return false;
  if (isShortToken) {
    if (!word.startsWith(q)) return false;
    const excluded = SHORT_SEARCH_EXCLUDED_STEMS[q];
    if (excluded && excluded.some((stem) => word.startsWith(stem))) {
      return false;
    }
    return true;
  }
  const stem = q.slice(0, -1);
  return word.startsWith(q) || word.startsWith(stem);
}

function matchesUkrainianSearch(productName, subCategory, rawQuery) {
  const queryTokens = normalizeUkText(rawQuery)
    .split(/\s+/)
    .map((t) => t.replace(/'/g, ''))
    .filter(Boolean);
  if (queryTokens.length === 0) return true;

  const productWords = tokenizeUkWords(productName);
  const subNorm = normalizeUkText(subCategory).replace(/'/g, '');
  const subWords = tokenizeUkWords(subCategory);

  return queryTokens.every((q) => {
    const isShort = q.length <= 4;
    if (productWords.some((w) => matchesSearchToken(w, q, isShort))) {
      return true;
    }
    if (!isShort) {
      const stem = q.slice(0, -1);
      if (subNorm.startsWith(q) || subNorm.startsWith(stem)) return true;
      if (subWords.some((w) => matchesSearchToken(w, q, false))) return true;
    }
    return false;
  });
}

function getUkrainianSearchRank(productName, rawQuery) {
  const queryTokens = normalizeUkText(rawQuery)
    .split(/\s+/)
    .map((t) => t.replace(/'/g, ''))
    .filter(Boolean);
  if (queryTokens.length === 0) return 0;

  const firstQ = queryTokens[0];
  const isShort = firstQ.length <= 4;
  const productWords = tokenizeUkWords(productName);
  if (productWords.length === 0) return 2;

  const firstWord = productWords[0];
  if (firstWord === firstQ) return -1;
  if (matchesSearchToken(firstWord, firstQ, isShort)) return 0;
  if (productWords.slice(1).some((w) => matchesSearchToken(w, firstQ, isShort))) return 1;
  return 2;
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
    products = products.filter(p =>
      matchesUkrainianSearch(p.name || p.title || '', p.subCategory || p.sub_category || p.category || '', search)
    );
  }

  // Sorting
  if (search && (!sort || sort === 'default')) {
    products.sort((a, b) => {
      const rankDiff = getUkrainianSearchRank(a.name || a.title || '', search)
        - getUkrainianSearchRank(b.name || b.title || '', search);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || a.title || '').localeCompare(b.name || b.title || '', 'uk');
    });
  } else if (sort === 'cheap' || sort === 'price-asc') {
    products.sort((a, b) => {
      const getMin = (item) => {
        const prs = (Array.isArray(item.prices) ? item.prices : [])
          .map(x => parseFloat(x.price))
          .filter(x => !isNaN(x) && x > 0);
        return prs.length > 0 ? Math.min(...prs) : Infinity;
      };
      return getMin(a) - getMin(b);
    });
  } else if (sort === 'price-desc') {
    products.sort((a, b) => {
      const getMin = (item) => {
        const prs = (Array.isArray(item.prices) ? item.prices : [])
          .map(x => parseFloat(x.price))
          .filter(x => !isNaN(x) && x > 0);
        return prs.length > 0 ? Math.min(...prs) : 0;
      };
      return getMin(b) - getMin(a);
    });
  } else if (sort === 'title' || sort === 'name-asc') {
    products.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || '', 'uk'));
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

  const { mergeCatalogProducts } = require('../services/storeScraper');
  const mergedProducts = typeof mergeCatalogProducts === 'function'
    ? mergeCatalogProducts(validProducts)
    : validProducts;
  const productsToPersist = mergedProducts.length > 0 ? mergedProducts : validProducts;

  if (isPostgres) {
    const client = await pgPool.connect();
    const insertedProducts = [];
    const priceRowsQueue = [];

    try {
      await client.query('BEGIN');
      // 1. Purge ONLY catalog tables (never touch users or loyalty_cards)
      await client.query('TRUNCATE TABLE product_prices, products RESTART IDENTITY CASCADE;');

      const PRODUCT_BATCH_SIZE = 200;
      for (let i = 0; i < productsToPersist.length; i += PRODUCT_BATCH_SIZE) {
        const chunk = productsToPersist.slice(i, i + PRODUCT_BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((item, idx) => {
          const base = idx * 7;
          const cat = item.category;
          const mainCat = item.mainCategory || item.main_category || 'Продукти';
          const subCat = item.subCategory || item.sub_category || cat;
          values.push(
            item.title,
            item.city || city || 'ivano-frankivsk',
            cat,
            mainCat,
            subCat,
            item.promo_tag,
            item.syncedAt || now
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        });

        const prodRes = await client.query(
          `INSERT INTO products (name, city, category, main_category, sub_category, promo_tag, synced_at)
           VALUES ${placeholders.join(', ')} RETURNING *`,
          values
        );

        prodRes.rows.forEach((newProd, idx) => {
          const sourceItem = chunk[idx];
          const prodEntry = { newProd, syncedAt: sourceItem.syncedAt || now, prices: [] };
          insertedProducts.push(prodEntry);

          for (const pr of sourceItem.prices) {
            priceRowsQueue.push({
              prodEntry,
              productId: newProd.id,
              store: pr.store,
              price: pr.price,
              oldPrice: pr.oldPrice !== undefined ? pr.oldPrice : pr.old_price,
              sourceUrl: pr.sourceUrl || pr.source_url || null
            });
          }
        });
      }

      const PRICE_BATCH_SIZE = 400;
      for (let i = 0; i < priceRowsQueue.length; i += PRICE_BATCH_SIZE) {
        const chunk = priceRowsQueue.slice(i, i + PRICE_BATCH_SIZE);
        const values = [];
        const placeholders = chunk.map((row, idx) => {
          const base = idx * 5;
          values.push(row.productId, row.store, row.price, row.oldPrice, row.sourceUrl);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        });

        const prRes = await client.query(
          `INSERT INTO product_prices (product_id, store, price, old_price, source_url)
           VALUES ${placeholders.join(', ')} RETURNING *`,
          values
        );

        prRes.rows.forEach((savedPr, idx) => {
          chunk[idx].prodEntry.prices.push({
            store: savedPr.store,
            price: parseFloat(savedPr.price),
            old_price: savedPr.old_price ? parseFloat(savedPr.old_price) : null,
            oldPrice: savedPr.old_price ? parseFloat(savedPr.old_price) : null,
            sourceUrl: savedPr.source_url || null
          });
        });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const insertedList = insertedProducts.map(entry => formatProduct({
      ...entry.newProd,
      syncedAt: entry.syncedAt,
      prices: entry.prices
    }));

    // Dual Sync: mirror into local-store.json while preserving users & loyalty_cards
    const store = loadLocalStore();
    store.users = Array.isArray(store.users) ? store.users : [];
    store.loyalty_cards = Array.isArray(store.loyalty_cards) ? store.loyalty_cards : [];
    store.products = productsToPersist;
    store.product_prices = buildSeedProductPrices(productsToPersist);
    saveLocalStore(store);

    return insertedList.filter(p => p && Array.isArray(p.prices) && p.prices.length > 0);
  }

  // Local JSON Mode: Populate BOTH data.products AND data.product_prices (users & loyalty_cards untouched)
  const store = loadLocalStore();
  store.users = Array.isArray(store.users) ? store.users : [];
  store.loyalty_cards = Array.isArray(store.loyalty_cards) ? store.loyalty_cards : [];
  let nextId = 1;
  let nextPriceId = 1;
  const allProductPrices = [];

  store.products = productsToPersist.map(item => {
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

async function closeDatabase() {
  if (pgPool) {
    try {
      await pgPool.end();
    } catch (_) {}
    pgPool = null;
    isPostgres = false;
  }
}

module.exports = {
  initDatabase,
  closeDatabase,
  get pool() {
    return pgPool;
  },
  query: (text, params) => (isPostgres ? pgPool.query(text, params) : null),
  isPostgresConnected: () => isPostgres,
  getLocalStorePath: () => LOCAL_STORE_PATH,
  // Users
  STAFF_ACCOUNTS,
  isStaffDomainEmail,
  getEffectiveUserRole,
  findUserByEmail,
  findUserByIdentifier,
  findUserById,
  createUser,
  setVerificationCode,
  verifyUserEmail,
  setPasswordResetCode,
  resetUserPassword,
  touchUserActivity,
  getAllUsersForAdmin,
  updateUserByAdmin,
  deleteUserCardByAdmin,
  clearUserBasketByAdmin,
  // Cards
  getCardsByUser,
  getCards,
  getCardById,
  createCard,
  updateCard,
  deleteCard,
  // Products
  getProducts,
  getProductById,
  matchesUkrainianSearch,
  getUkrainianSearchRank,
  createProduct,
  updateProduct,
  deleteProduct,
  syncProducts
};
