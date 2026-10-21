/**
 * ============================================================================
 * AURELIA UA — Database Layer Verification Script
 * Checks PostgreSQL connection (if DATABASE_URL is set in server/.env)
 * or inspects the active server/db/local-store.json fallback storage.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

const LOCAL_STORE_PATH = path.join(__dirname, 'db', 'local-store.json');

async function testDatabase() {
  console.log('================================================================');
  console.log('🔍 AURELIA UA — ВЕРИФІКАЦІЯ БАЗИ ДАНИХ (POSTGRESQL / LOCAL JSON)');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && !dbUrl.includes('host:5432')) {
    console.log('🌐 Виявлено конфігурацію DATABASE_URL у server/.env');
    const hostInfo = dbUrl.split('@')[1] ? dbUrl.split('@')[1].split('/')[0] : 'хмарний хост';
    console.log(`📡 Підключення до PostgreSQL (${hostInfo})...\n`);

    try {
      // Initialize database schema and auto-migrations
      console.log('⚙️ Ініціалізація та перевірка схеми бази даних...');
      await db.initDatabase();

      if (db.isPostgresConnected()) {
        const { Pool } = require('pg');
        const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
        const pool = new Pool({
          connectionString: dbUrl,
          ssl: isLocalHost ? false : { rejectUnauthorized: false }
        });

        const timeRes = await pool.query('SELECT NOW() AS current_time');
        console.log(`✅ З'єднання з PostgreSQL активне. Час сервера: ${timeRes.rows[0].current_time}`);

        // Count table rows
        const usersRes = await pool.query('SELECT count(*) AS count FROM users');
        const cardsRes = await pool.query('SELECT count(*) AS count FROM loyalty_cards');
        const prodsRes = await pool.query('SELECT count(*) AS count FROM products');
        const pricesRes = await pool.query('SELECT count(*) AS count FROM product_prices');

        console.log('\n📊 СТАТИСТИКА РЕЛЯЦІЙНИХ ТАБЛИЦЬ (POSTGRESQL):');
        console.log('----------------------------------------------------------------');
        console.log(`  • users          : ${usersRes.rows[0].count} записів`);
        console.log(`  • loyalty_cards  : ${cardsRes.rows[0].count} записів`);
        console.log(`  • products       : ${prodsRes.rows[0].count} позицій`);
        console.log(`  • product_prices : ${pricesRes.rows[0].count} актуальних цін`);

        // City breakdown
        const cityRes = await pool.query('SELECT city, count(*) AS count FROM products GROUP BY city ORDER BY count DESC');
        if (cityRes.rowCount > 0) {
          console.log('\n🏙️ РОЗПОДІЛ ТОВАРІВ ЗА МІСТАМИ (POSTGRESQL):');
          cityRes.rows.forEach(r => {
            console.log(`   • ${String(r.city || 'ivano-frankivsk').padEnd(20, ' ')} : ${r.count} товарів`);
          });
        }

        await pool.end();
        console.log('\n✅ Перевірку бази даних PostgreSQL успішно завершено!');
        return;
      }
    } catch (err) {
      console.error('❌ Помилка з\'єднання з PostgreSQL:', err.message);
      console.log('ℹ️ Переходимо до перевірки локального сховища...\n');
    }
  } else {
    console.log('ℹ️ Змінна DATABASE_URL не задана або закоментована в server/.env.');
    console.log('ℹ️ Сервер працює у швидкому автономному режимі Local JSON Fallback.\n');
  }

  // Local JSON inspection
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    console.error(`❌ Файл сховища не знайдено за шляхом: ${LOCAL_STORE_PATH}`);
    process.exitCode = 1;
    return;
  }

  try {
    const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8');
    const store = JSON.parse(raw);

    const usersCount = Array.isArray(store.users) ? store.users.length : 0;
    const cardsCount = Array.isArray(store.loyalty_cards) ? store.loyalty_cards.length : 0;
    const prodsCount = Array.isArray(store.products) ? store.products.length : 0;
    const pricesCount = Array.isArray(store.product_prices)
      ? store.product_prices.length
      : (store.products || []).reduce((sum, p) => sum + (Array.isArray(p.prices) ? p.prices.length : 0), 0);

    console.log('📁 СТАТИСТИКА СХОВИЩА (server/db/local-store.json):');
    console.log('----------------------------------------------------------------');
    console.log(`  • users          : ${usersCount} користувачів`);
    console.log(`  • loyalty_cards  : ${cardsCount} карток лояльності`);
    console.log(`  • products       : ${prodsCount} акційних товарів`);
    console.log(`  • product_prices : ${pricesCount} актуальних цін мереж`);

    // Category breakdown in local store
    const catMap = {};
    (store.products || []).forEach(p => {
      const cat = p.mainCategory || p.main_category || 'Продукти';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    console.log('\n📦 РОЗПОДІЛ ЗА ГОЛОВНИМИ КАТЕГОРІЯМИ:');
    Object.entries(catMap).forEach(([cat, count]) => {
      console.log(`   • ${cat.padEnd(20, ' ')} : ${count} товарів`);
    });

    console.log('\n💡 Для підключення до Supabase/PostgreSQL додайте рядок у server/.env:');
    console.log('   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres');
    console.log('\n✅ Перевірку локального сховища успішно завершено!');
  } catch (err) {
    console.error('❌ Помилка зчитування local-store.json:', err.message);
    process.exitCode = 1;
  }
}

testDatabase().catch(err => {
  console.error('Непередбачена помилка:', err);
  process.exit(1);
});
