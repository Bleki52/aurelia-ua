/**
 * ============================================================================
 * AURELIA UA — Database Re-Categorization & Quality Verification Script
 * Updates server/db/local-store.json using the upgraded categorizeProduct engine.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { categorizeProduct, hasWord } = require('./services/storeScraper');

const localStorePath = path.resolve(__dirname, 'db', 'local-store.json');

function migrateAndVerify() {
  console.log('================================================================');
  console.log('🚀 AURELIA UA — МІГРАЦІЯ ТА ВЕРИФІКАЦІЯ КАТЕГОРИЗАЦІЇ ТОВАРІВ');
  console.log('================================================================\n');

  if (!fs.existsSync(localStorePath)) {
    throw new Error(`Файл не знайдено: ${localStorePath}`);
  }

  const raw = fs.readFileSync(localStorePath, 'utf8');
  const dbData = JSON.parse(raw);

  if (!Array.isArray(dbData.products)) {
    throw new Error('dbData.products не є масивом!');
  }

  console.log(`📦 Завантажено товарів для перекласифікації: ${dbData.products.length}`);

  let updatedCount = 0;
  const beforeStats = {};
  const afterStats = {};

  dbData.products.forEach(p => {
    const oldKey = `${p.mainCategory || 'unknown'} › ${p.subCategory || 'unknown'}`;
    beforeStats[oldKey] = (beforeStats[oldKey] || 0) + 1;

    const title = p.title || p.name || '';
    const store = (p.prices && p.prices[0] ? p.prices[0].store : '') ||
                  (p.storePrices ? Object.keys(p.storePrices)[0] : '') || '';
    const apiCat = p.category || '';

    const newCat = categorizeProduct(title, store, apiCat);

    p.mainCategory = newCat.mainCategory;
    p.main_category = newCat.mainCategory;
    p.subCategory = newCat.subCategory;
    p.sub_category = newCat.subCategory;
    p.category = newCat.category;

    const newKey = `${newCat.mainCategory} › ${newCat.subCategory}`;
    afterStats[newKey] = (afterStats[newKey] || 0) + 1;
    updatedCount++;
  });

  // Save updated local-store.json
  fs.writeFileSync(localStorePath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log(`✅ Успішно оновлено та збережено на диску: ${updatedCount} товарів у ${localStorePath}\n`);

  console.log('📊 РОЗПОДІЛ КАТЕГОРІЙ ПІСЛЯ МІГРАЦІЇ:');
  console.log('----------------------------------------------------------------');
  Object.keys(afterStats).sort().forEach(k => {
    console.log(`  • ${k.padEnd(38, ' ')} : ${afterStats[k]} товарів`);
  });

  // Verification checks for false friends
  console.log('\n🔒 ПЕРЕВІРКА ВІДСУТНОСТІ "ХИБНИХ ДРУЗІВ" (ДОНАТИ, КРЕМ-СИРИ, ПАСТА):');
  console.log('================================================================');

  const foodInBeauty = dbData.products.filter(p => {
    if (p.mainCategory !== 'Краса та Гігієна') return false;
    const t = (p.title || p.name || '').toLowerCase();
    return hasWord(t, [
      'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'круасан', 'крем-сир', 'крем сир',
      'ковбас', 'сосиск', 'шоколад', 'томатна паста', 'nutella', 'нутелла', 'паста томатна',
      'сир 73%', 'сир 55%', 'сир 50%', 'молоко'
    ]);
  });

  const foodInHome = dbData.products.filter(p => {
    if (p.mainCategory !== 'Дім та Побут') return false;
    const t = (p.title || p.name || '').toLowerCase();
    return hasWord(t, [
      'донат', 'пончик', 'тістечко', 'торт', 'еклер', 'круасан', 'крем-сир', 'крем сир',
      'ковбас', 'сосиск', 'шоколад', 'томатна паста', 'nutella', 'нутелла'
    ]);
  });

  if (foodInBeauty.length === 0) {
    console.log('✅ 100% ЧИСТО: 0 харчових продуктів у категорії "Краса та Гігієна"!');
  } else {
    console.error(`❌ ЗНАЙДЕНО ${foodInBeauty.length} ХАРЧОВИХ ТОВАРІВ У BEAUTY:`);
    foodInBeauty.forEach(p => console.error('  •', p.title || p.name));
    throw new Error('Помилка валідації: харчові товари знайдено у Краса та Гігієна!');
  }

  if (foodInHome.length === 0) {
    console.log('✅ 100% ЧИСТО: 0 харчових продуктів у категорії "Дім та Побут"!');
  } else {
    console.error(`❌ ЗНАЙДЕНО ${foodInHome.length} ХАРЧОВИХ ТОВАРІВ У ДІМ ТА ПОБУТ:`);
    foodInHome.forEach(p => console.error('  •', p.title || p.name));
    throw new Error('Помилка валідації: харчові товари знайдено у Дім та Побут!');
  }

  // Print full list of Beauty items
  console.log('\n💄 ВСІ ТОВАРИ В КАТЕГОРІЇ "Краса та Гігієна" (перевірка відповідності):');
  console.log('----------------------------------------------------------------');
  const beautyList = dbData.products.filter(p => p.mainCategory === 'Краса та Гігієна');
  console.log(`Загалом: ${beautyList.length} товарів`);
  beautyList.forEach((p, idx) => {
    console.log(`  [${String(idx + 1).padStart(3, ' ')}] ${p.subCategory.padEnd(18, ' ')} | ${p.title || p.name}`);
  });

  // Print full list of Pet items
  console.log('\n🐾 ВСІ ТОВАРИ В КАТЕГОРІЇ "Зоотовари" (перевірка відповідності):');
  console.log('----------------------------------------------------------------');
  const petList = dbData.products.filter(p => p.mainCategory === 'Зоотовари');
  console.log(`Загалом: ${petList.length} товарів`);
  petList.forEach((p, idx) => {
    console.log(`  [${String(idx + 1).padStart(3, ' ')}] ${p.subCategory.padEnd(14, ' ')} | ${p.title || p.name}`);
  });

  // Check specific test cases
  console.log('\n🔍 ВЕРИФІКАЦІЯ КОНКРЕТНИХ ПРОБЛЕМНИХ ПОЗИЦІЙ:');
  console.log('----------------------------------------------------------------');
  const testQueries = [
    'донат',
    'тістечко',
    'крем-сир',
    'томатна',
    'nutella',
    'ковбаса',
    'ласощі для котів'
  ];

  testQueries.forEach(q => {
    const matches = dbData.products.filter(p => (p.title || p.name || '').toLowerCase().includes(q));
    console.log(`\nЗапит "${q}" (знайдено ${matches.length} товарів):`);
    matches.slice(0, 4).forEach(m => {
      console.log(`  • ${m.title || m.name} -> [${m.mainCategory} › ${m.subCategory}]`);
    });
  });

  console.log('\n================================================================');
  console.log('🎉 МІГРАЦІЮ ЗАВЕРШЕНО УСПІШНО! ВСІ ХИБНІ КАТЕГОРИЗАЦІЇ ВИПРАВЛЕНО.');
  console.log('================================================================');
}

migrateAndVerify();

