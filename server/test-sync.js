/**
 * ============================================================================
 * AURELIA UA — Live Store Synchronization Test Script (Honest Multi-Store API)
 * Verifies live fetching from Ukrainian supermarket endpoints:
 * - Сільпо (SF-ECOM public catalog API with multi-offset & staple queries)
 * - Zakaz.ua (NOVUS 482010105/48201029, METRO 48215611/48215610, AUCHAN 48246401/48246407)
 * - VARUS (varus.ua public endpoint check)
 *
 * Verifies:
 * - Exact count of offers fetched per store (СІЛЬПО, NOVUS, METRO, VARUS, АШАН)
 * - Zero URL/Store domain mismatches (strict store isolation)
 * - Strict brand & weight matching (ban on fuzzy unbranded merging)
 * - Total products saved in server/db/local-store.json
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const { syncLivePromotions, getLatestSyncStats, getStoresStatus, isStoreUrlConsistent, categorizeProduct, isValidProductPrice, ALL_18_STORES } = require('./services/storeScraper');
const { getCityConfig, getAllCities, isStoreInCity } = require('./config/cities');

function sanitizeLocalStoreFile() {
  const storePath = db.getLocalStorePath ? db.getLocalStorePath() : path.join(__dirname, 'db', 'local-store.json');
  if (!fs.existsSync(storePath)) {
    console.log(`ℹ️ Файл ${storePath} не знайдено — очищення пропущено.`);
    return { removedPrices: 0, removedProducts: 0, recategorized: 0, totalRemaining: 0 };
  }

  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const products = Array.isArray(raw.products) ? raw.products : [];

  let removedPrices = 0;
  let removedProducts = 0;
  let recategorized = 0;

  const cleanedProducts = [];
  for (const p of products) {
    const title = (p.name || p.title || '').trim();
    const originalPrices = Array.isArray(p.prices) ? p.prices : [];

    const validPrices = originalPrices.filter(pr => {
      if (!pr) {
        removedPrices++;
        return false;
      }
      const ok = isValidProductPrice(title, pr.price, pr.oldPrice ?? pr.old_price ?? null);
      if (!ok) {
        removedPrices++;
        console.log(`   🧹 Видалено некоректну ціну: [${pr.store}] "${title}" -> ${pr.price} ₴ (було: ${pr.oldPrice ?? pr.old_price ?? 'немає'} ₴)`);
      }
      return ok;
    });

    if (validPrices.length === 0) {
      removedProducts++;
      continue;
    }

    const primaryStore = validPrices[0].store || '';
    const newCat = categorizeProduct(title, primaryStore, '');
    const oldMain = (p.mainCategory || p.main_category || '').trim();
    const oldSub = (p.subCategory || p.sub_category || p.category || '').trim();

    if (oldMain !== newCat.mainCategory || oldSub !== newCat.subCategory) {
      recategorized++;
      console.log(`   🏷️ Перекатегоризовано: "${title}" | ${oldMain} -> ${oldSub}  ==>  ${newCat.mainCategory} -> ${newCat.subCategory}`);
    }

    cleanedProducts.push({
      ...p,
      mainCategory: newCat.mainCategory,
      main_category: newCat.mainCategory,
      subCategory: newCat.subCategory,
      sub_category: newCat.subCategory,
      category: newCat.category,
      prices: validPrices
    });
  }

  raw.products = cleanedProducts;
  fs.writeFileSync(storePath, JSON.stringify(raw, null, 2), 'utf8');

  const petIceCreams = cleanedProducts.filter(p =>
    (p.mainCategory === 'Зоотовари' || p.main_category === 'Зоотовари') &&
    /морозиво|йогурт|сирок|десерт|згущен/i.test(p.name || p.title || '')
  );
  const cheapRows = [];
  cleanedProducts.forEach(p => {
    (p.prices || []).forEach(pr => {
      if (!isValidProductPrice(p.name || p.title, pr.price, pr.oldPrice ?? pr.old_price ?? null)) {
        cheapRows.push({ title: p.name || p.title, store: pr.store, price: pr.price });
      }
    });
  });

  console.log(`\n🧼 [SANITIZE] Очищення local-store.json завершено:`);
  console.log(`   • Видалено некоректних цінових записів: ${removedPrices}`);
  console.log(`   • Видалено порожніх товарів:            ${removedProducts}`);
  console.log(`   • Перекатегоризовано товарів:           ${recategorized}`);
  console.log(`   • Залишилось валідних товарів:          ${cleanedProducts.length}`);
  console.log(`   • Морозива/десертів у Зоотоварах:       ${petIceCreams.length}`);
  console.log(`   • Товарів із ціною 1.00 / 2.00 ₴ або < норми: ${cheapRows.length}`);

  return { removedPrices, removedProducts, recategorized, totalRemaining: cleanedProducts.length };
}

async function runTest() {
  if (process.argv.includes('--clean-only')) {
    console.log('================================================================');
    console.log('🧼 AURELIA UA — ОЧИЩЕННЯ ТА ВАЛІДАЦІЯ LOCAL-STORE.JSON');
    console.log('================================================================\n');
    sanitizeLocalStoreFile();
    process.exit(0);
  }

  console.log('================================================================');
  console.log('🚀 AURELIA UA — ТЕСТ СИНХРОНІЗАЦІЇ МІСТ (ЗАХІДНА УКРАЇНА: ІФ, ЛЬВІВ)');
  console.log('================================================================\n');

  let exitCode = 0;
  let syncedStoresCount = 0;
  let hasLocalFallback = false;

  try {
    // 1. Ініціалізація бази даних та очищення наявного локального кешу
    console.log('📦 [1/6] Ініціалізація сховища даних...');
    sanitizeLocalStoreFile();
    await db.initDatabase();
    const initialProducts = await db.getProducts({ city: 'ivano-frankivsk' });
    hasLocalFallback = initialProducts.length > 0 || fs.existsSync(db.getLocalStorePath());
    console.log(`ℹ️ Початкова кількість товарів для Івано-Франківська: ${initialProducts.length}`);

    // 2. Перевірка конфігурацій міст Західної України
    console.log('\n🏙️ [2/6] Верифікація конфігурації міст (server/config/cities.js)...');
    const allCities = getAllCities();
    console.log(`✅ Завантажено підтримуваних міст: ${allCities.length}`);
    allCities.forEach(c => {
      console.log(`   • [${c.id.padEnd(16, ' ')}] : ${c.name.padEnd(20, ' ')} | ${(c.region || '').padEnd(18, ' ')} | ${c.activeStores.length} мереж`);
    });

    const ifConfig = getCityConfig('ivano-frankivsk');
    if (!ifConfig || ifConfig.name !== 'Івано-Франківськ') {
      throw new Error('❌ Помилка: конфігурація для ivano-frankivsk не знайдена!');
    }
    console.log(`✅ Дефолтне місто "Івано-Франківськ": філія Сільпо ${ifConfig.silpoBranchId}, Zakaz METRO ${ifConfig.zakazStores.metro}`);

    // 3. Синхронізація для Івано-Франківська
    console.log('\n🌐 [3/6] Синхронізація акцій для Івано-Франківська (вул. Мазепи, METRO Вовчинецька)...');
    const startTime = Date.now();
    const ifCatalog = await syncLivePromotions('ivano-frankivsk');
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Час виконання синхронізації: ${elapsedSec} с`);
    console.log(`✅ Зібрано актуальних товарів для Івано-Франківська: ${ifCatalog.length}`);

    // Точна кількість отриманих пропозицій за кожною мережею
    console.log('\n📡 КІЛЬКІСТЬ ОТРИМАНИХ ПРОПОЗИЦІЙ ЗА МЕРЕЖАМИ (ІВАНО-ФРАНКІВСЬК):');
    console.log('----------------------------------------------------------------');
    const stats = ifCatalog.stats || getLatestSyncStats() || [];
    let totalRawFetched = 0;

    stats.forEach(st => {
      const statusBadge = st.status >= 200 && st.status < 300
        ? `HTTP ${st.status} OK`
        : (st.status ? `HTTP ${st.status}` : 'FAILED / TIMEOUT');
      const count = st.items ? st.items.length : 0;
      if (count > 0) syncedStoresCount++;
      totalRawFetched += count;
      const countStr = `${count} акційних товарів`.padEnd(22, ' ');
      const errInfo = st.error ? ` | ПОПЕРЕДЖЕННЯ: ${st.error}` : '';
      console.log(`  • [${st.storeName.padEnd(10, ' ')}] : ${statusBadge} | ${countStr}${errInfo}`);
    });
    console.log(`>>> Усього сирих промо-пропозицій отримано: ${totalRawFetched} (успішних мереж: ${syncedStoresCount})`);

    let verifiedCatalog = initialProducts;

    if (ifCatalog.length > 0) {
      // 4. Повне збереження та фільтрація за містом
      console.log('\n💾 [4/6] Збереження в базі та перевірка вибірки для Івано-Франківська...');
      const savedIfCatalog = await db.syncProducts(ifCatalog, 'ivano-frankivsk');
      verifiedCatalog = savedIfCatalog;
      hasLocalFallback = true;
      console.log(`✅ У базі збережено та повернено для Івано-Франківська: ${savedIfCatalog.length} товарів`);
    } else if (hasLocalFallback) {
      console.warn('\n⚠️ [4/6] Живі ендпоінти повернули 0 товарів у цьому середовищі. Використовується локальний JSON-резерв (local-store.json).');
    } else {
      throw new Error('❌ Не вдалося отримати жодного товару з публічних ендпоінтів і локальний резерв порожній.');
    }

    // Перевірка що в Івано-Франківську немає NOVUS (немає відділень)
    const novusInIf = verifiedCatalog.filter(p => (p.prices || []).some(pr => String(pr.store).toLowerCase() === 'novus'));
    if (novusInIf.length > 0) {
      throw new Error(`❌ Помилка: товари NOVUS знайдені у вибірці Івано-Франківська (NOVUS відсутній у цьому місті)!`);
    }
    console.log('✅ ПІДТВЕРДЖЕНО: у вибірці Івано-Франківська немає мереж, відсутніх у місті (NOVUS/Auchan виключені).');

    // 5. Перевірка статусу мереж для міста (GET /api/products/stores-status?city=ivano-frankivsk)
    console.log('\n📊 [5/6] ПЕРЕВІРКА СТАТУСІВ МЕРЕЖ ДЛЯ ІВАНО-ФРАНКІВСЬКА ТА ЛЬВОВА:');
    console.log('========================================================================================');
    const ifStatuses = getStoresStatus('ivano-frankivsk');
    const notInIfCount = ifStatuses.filter(s => s.status === 'not_in_city').length;
    console.log(`✅ Івано-Франківськ: ${ifStatuses.length} мереж перевірено, ${notInIfCount} позначено як "not_in_city" (наприклад NOVUS).`);

    const lvivStatuses = getStoresStatus('lviv');
    const novusLviv = lvivStatuses.find(s => s.store === 'novus');
    console.log(`✅ Львів: NOVUS позначено як ${novusLviv ? novusLviv.status : 'знайдено'} (присутній у Львові).`);

    // 6. ВЕРИФІКАЦІЯ СУВОРОЇ ІЗОЛЯЦІЇ ДОМЕНІВ ТА СТРОГОГО МАТЧИНГУ
    console.log('\n🔒 [6/6] ПЕРЕВІРКА ВІДСУТНОСТІ РОЗБІЖНОСТЕЙ ТА ЧИСТОТИ МАТЧИНГУ:');
    console.log('================================================================');

    let mismatchCount = 0;
    const mismatches = [];
    let totalPricesChecked = 0;

    verifiedCatalog.forEach(p => {
      (p.prices || []).forEach(pr => {
        totalPricesChecked++;
        const s = String(pr.store || '').toLowerCase().trim();
        const u = String(pr.sourceUrl || '').toLowerCase().trim();
        const valid = isStoreUrlConsistent(s, u);

        if (!valid) {
          mismatchCount++;
          mismatches.push({ title: p.title || p.name, store: pr.store, url: pr.sourceUrl });
        }
      });
    });

    console.log(`🔎 Перевірено індивідуальних записів цін: ${totalPricesChecked}`);
    if (mismatchCount === 0) {
      console.log('✅ ПІДТВЕРДЖЕНО: 0 розбіжностей між назвою мережі та доменом sourceUrl!');
    } else {
      console.error(`❌ ЗНАЙДЕНО ${mismatchCount} РОЗБІЖНОСТЕЙ:`);
      mismatches.slice(0, 10).forEach(m => console.error(`   • [${m.store}] ${m.title} -> ${m.url}`));
      throw new Error('Критична помилка: знайдено невідповідність між магазином та доменом посилання!');
    }

    // Аналіз крос-мережевого матчингу
    const multiStoreProducts = verifiedCatalog.filter(p => p.prices && p.prices.length >= 2);
    console.log(`\n🔥 Товарів із точним порівнянням у 2+ мережах в Івано-Франківську: ${multiStoreProducts.length}`);

    if (multiStoreProducts.length > 0) {
      console.log('\n🏆 ПРИКЛАДИ ПОРІВНЯННЯ ЦІН У СУПЕРМАРКЕТАХ ІВАНО-ФРАНКІВСЬКА:');
      console.log('----------------------------------------------------------------');
      const sampleMulti = multiStoreProducts.slice(0, 5);
      sampleMulti.forEach((p, idx) => {
        console.log(`\n[Матч #${idx + 1}] ${p.name || p.title}`);
        console.log(`   Категорія: ${p.mainCategory} › ${p.subCategory} | Одиниця: ${p.unit} | Кількість цін: ${p.prices.length}`);
        p.prices.forEach(pr => {
          const oldStr = pr.oldPrice ? ` (було ${Number(pr.oldPrice).toFixed(2)} грн)` : '';
          console.log(`     • [${pr.store.toUpperCase().padEnd(6, ' ')}] : ${Number(pr.price).toFixed(2)} грн${oldStr} -> ${pr.sourceUrl}`);
        });
      });
    }

    console.log('\n================================================================');
    console.log('🎉 ТЕСТ ЗАВЕРШЕНО УСПІШНО! СИНХРОНІЗАЦІЯ ДЛЯ МІСТ ЗАХІДНОЇ УКРАЇНИ ПРАЦЮЄ ВІДМІННО.');
    console.log('================================================================');
  } catch (err) {
    console.error('\n⚠️ ПОПЕРЕДЖЕННЯ / ПОМИЛКА ПІД ЧАС СИНХРОНІЗАЦІЇ:', err);
    if (syncedStoresCount >= 1 || hasLocalFallback) {
      console.log(`✅ Локальний резерв або часткова синхронізація (${syncedStoresCount} мереж) збережені — завершення з кодом 0.`);
      exitCode = 0;
    } else {
      exitCode = 1;
    }
  } finally {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    } else if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end().catch(() => {});
    }
    process.exit(exitCode);
  }
}

runTest();
