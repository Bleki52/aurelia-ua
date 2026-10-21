const BRAND_MAP = {
  'jacobs': 'jacobs', 'якобз': 'jacobs',
  'prostokvashyno': 'prostokvashyno', 'простоквашино': 'prostokvashyno',
  'galychyna': 'galychyna', 'галичина': 'galychyna',
  'yagotynske': 'yagotynske', 'яготинське': 'yagotynske', 'яготинська': 'yagotynske', 'яготинський': 'yagotynske', 'яготин': 'yagotynske',
  'ferma': 'ferma', 'ферма': 'ferma',
  'molokiya': 'molokiya', 'молокія': 'molokiya',
  'president': 'president', 'президент': 'president',
  'roshen': 'roshen', 'рошен': 'roshen',
  'milka': 'milka', 'мілка': 'milka',
  'lavazza': 'lavazza', 'лавацца': 'lavazza',
  'monini': 'monini', 'моніні': 'monini',
  'persil': 'persil', 'персіл': 'persil',
  'ariel': 'ariel', 'аріель': 'ariel',
  'fairy': 'fairy', 'фейрі': 'fairy',
  'nivea': 'nivea', 'нівеа': 'nivea',
  'felix': 'felix', 'фелікс': 'felix',
  'purina': 'purina', 'пуріна': 'purina',
  'whiskas': 'whiskas', 'віскас': 'whiskas',
  'pedigree': 'pedigree', 'педігрі': 'pedigree',
  'domestos': 'domestos', 'доместос': 'domestos',
  'perwoll': 'perwoll', 'перволь': 'perwoll',
  'millennium': 'millennium', 'milenium': 'millennium', 'міленіум': 'millennium'
};

const NOISE_WORDS = new Set([
  'акція', 'знижка', 'упаковка', 'пе', 'му', 'тп', 'зп', 'пляшка', 'пачка', 'ваговий',
  'вагова', 'україна', 'тм', 'новинка', 'пак', 'пл', 'скло', 'жб', 'зб', 'дп', 'ба',
  'см', 'гк', 'вґ', 'вг', 'хк', 'кв', 'ск', 'св', 'шт', 'г', 'кг', 'мл', 'л'
]);

function normalizeProductSignature(title = '') {
  if (!title) return { raw: '', brand: null, weight: null, fat: null, tokens: [], cleanKey: '' };
  
  let s = title.toLowerCase()
    .replace(/(\d+),(\d+)/g, '$1.$2')
    .replace(/[«»""''„“]/g, '')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract fat percentage
  let fat = null;
  const fatMatch = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (fatMatch) {
    fat = parseFloat(fatMatch[1]) + '%';
  }

  // Extract weight/volume
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

  // Identify brand
  let brand = null;
  for (const [key, b] of Object.entries(BRAND_MAP)) {
    const regex = new RegExp('(?:^|\\s|[\\(\\-«])' + key + '(?:$|\\s|[\\)\\-»])', 'i');
    if (regex.test(s)) {
      brand = b;
      break;
    }
  }

  // Strip units and numbers from token string
  const tokenString = s
    .replace(/\b\d+(?:\.\d+)?\s*(?:кг|г|мл|л|шт|%)\b/gi, ' ')
    .replace(/[^\p{L}\s]/gu, ' ');

  const cleanTokens = tokenString
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !NOISE_WORDS.has(w));

  return {
    raw: title,
    brand,
    weight,
    fat,
    tokens: cleanTokens,
    cleanKey: `${brand || 'nobrand'}_${weight || 'noweight'}_${fat || 'nofat'}`
  };
}

function areProductsMatching(sigA, sigB, subCatA, subCatB) {
  // 1. Must belong to the same subcategory
  if (subCatA && subCatB && subCatA !== subCatB) return false;

  // 2. If both have weights/volumes, they MUST match
  if (sigA.weight && sigB.weight && sigA.weight !== sigB.weight) return false;

  // 3. If dairy/fat is present, fat percentage MUST match
  if (sigA.fat && sigB.fat && sigA.fat !== sigB.fat) return false;

  // 4. If both have identified brands, brands MUST match
  if (sigA.brand && sigB.brand && sigA.brand !== sigB.brand) return false;

  // 5. Compare tokens with Jaccard similarity or Brand + Key Nouns
  if (sigA.tokens.length === 0 || sigB.tokens.length === 0) return false;

  const setA = new Set(sigA.tokens);
  const setB = new Set(sigB.tokens);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) {
      intersection++;
    } else {
      // Partial prefix matching for Ukrainian inflections (stemming)
      for (const tb of setB) {
        if ((t.length >= 4 && tb.startsWith(t.slice(0, -1))) || (tb.length >= 4 && t.startsWith(tb.slice(0, -1)))) {
          intersection++;
          break;
        }
      }
    }
  }

  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // High similarity threshold or same brand + same weight + substantial token overlap
  if (jaccard >= 0.50) return true;
  if (sigA.brand && sigA.brand === sigB.brand && sigA.weight && sigA.weight === sigB.weight && intersection >= 2) return true;

  return false;
}

const p1 = 'Шоколад молочний Millennium Golden Nut з цільним мигдалем 100г';
const p2 = 'Шоколад Millennium Golden Nut молочний з мигдалем 100 г';
const sig1 = normalizeProductSignature(p1);
const sig2 = normalizeProductSignature(p2);
console.log('p1:', sig1);
console.log('p2:', sig2);
console.log('Matches Millennium?', areProductsMatching(sig1, sig2, 'Солодощі', 'Солодощі'));

const b1 = 'Масло солодковершкове Селянське Ферма 73% 180г';
const b2 = 'Масло Ферма Селянське 73% 0,18 кг';
const sigB1 = normalizeProductSignature(b1);
const sigB2 = normalizeProductSignature(b2);
console.log('b1:', sigB1);
console.log('b2:', sigB2);
console.log('Matches Ferma Butter?', areProductsMatching(sigB1, sigB2, 'Молочні та Сири', 'Молочні та Сири'));

const b3 = 'Масло Ферма 82.5% 180г';
const sigB3 = normalizeProductSignature(b3);
console.log('Matches 73% with 82.5%?', areProductsMatching(sigB1, sigB3, 'Молочні та Сири', 'Молочні та Сири'));
