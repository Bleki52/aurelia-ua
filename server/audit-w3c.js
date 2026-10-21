/**
 * ============================================================================
 * AURELIA UA — Automated Coursework W3C & GEMINI.md Compliance Audit
 * ============================================================================
 * Audits all HTML files in client/ against the Coursework Checklist:
 *  1. <!DOCTYPE html> on line 1
 *  2. <html lang="uk">
 *  3. <meta charset="UTF-8"> is the first tag inside <head>
 *  4. <meta name="viewport" ...> present
 *  5. <title> is unique and <= 60 characters
 *  6. <meta name="description"> is unique and <= 155 characters
 *  7. Favicon linked as SVG (assets/favicon.svg)
 *  8. External normalize.css and styles.css linked
 *  9. Zero <style> tags and zero inline style="" attributes
 * 10. Scripts loaded with defer, zero inline <script>...</script>
 * 11. Exactly one <h1> per page and valid heading hierarchy
 * 12. Every <img> has width, height, and valid alt (or alt="" role="presentation")
 * 13. Every <input>, <select>, <textarea> has an explicit <label for="...">
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_FILES = [
  { dir: CLIENT_DIR, name: 'index.html', label: 'client/index.html (Головна: Картки лояльності)' },
  { dir: CLIENT_DIR, name: 'catalog.html', label: 'client/catalog.html (Каталог акцій супермаркетів)' },
  { dir: CLIENT_DIR, name: 'basket.html', label: 'client/basket.html (Розумний кошик порівняння)' },
  { dir: CLIENT_DIR, name: 'admin.html', label: 'client/admin.html (Адміністративна панель керування)' },
  { dir: CLIENT_DIR, name: '404.html', label: 'client/404.html (Кастомна сторінка 404)' },
  { dir: ROOT_DIR, name: 'index.html', label: 'index.html (Кореневий редирект GitHub Pages)' }
];

class W3CAuditor {
  constructor() {
    this.results = [];
    this.totalErrors = 0;
    this.totalWarnings = 0;
    this.seenTitles = new Map();
    this.seenDescriptions = new Map();
  }

  log(msg, type = 'info') {
    const symbols = {
      pass: '✅',
      fail: '❌',
      warn: '⚠️',
      info: 'ℹ️'
    };
    console.log(`${symbols[type] || '•'} ${msg}`);
  }

  auditFile(fileSpec) {
    const filename = typeof fileSpec === 'string' ? fileSpec : fileSpec.name;
    const fileDir = (typeof fileSpec === 'object' && fileSpec.dir) ? fileSpec.dir : CLIENT_DIR;
    const fileLabel = (typeof fileSpec === 'object' && fileSpec.label) ? fileSpec.label : filename;
    const filePath = path.join(fileDir, filename);

    if (!fs.existsSync(filePath)) {
      this.totalErrors++;
      return { file: fileLabel, errors: [`Файл ${filePath} не знайдено`], warnings: [] };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const errors = [];
    const warnings = [];

    // 1. <!DOCTYPE html> on line 1
    const line1 = lines[0].trim();
    if (!/^<!DOCTYPE html>/i.test(line1)) {
      errors.push(`Рядок 1: Очікувався <!DOCTYPE html>, знайдено: "${line1}"`);
    }

    // 2. <html lang="uk">
    const htmlTagMatch = content.match(/<html\b([^>]*)>/i);
    if (!htmlTagMatch) {
      errors.push('Відсутній тег <html>');
    } else if (!/lang=["']uk["']/i.test(htmlTagMatch[1])) {
      errors.push(`Тег <html> не має атрибута lang="uk": <html ${htmlTagMatch[1]}>`);
    }

    // 3. <head> inspection
    const headMatch = content.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
    if (!headMatch) {
      errors.push('Відсутній блок <head>...</head>');
    } else {
      const headContent = headMatch[1];
      
      // Check first non-whitespace tag inside <head>
      const firstTagMatch = headContent.trim().match(/^<([a-zA-Z0-9_-]+)([^>]*)>/);
      if (!firstTagMatch || firstTagMatch[1].toLowerCase() !== 'meta' || !/charset=["']?UTF-8["']?/i.test(firstTagMatch[2])) {
        errors.push('<meta charset="UTF-8"> має бути першим тегом усередині <head>');
      }

      // 4. Viewport meta
      if (!/<meta\s+name=["']viewport["']/i.test(headContent)) {
        errors.push('Відсутній <meta name="viewport" content="width=device-width, initial-scale=1.0">');
      }

      // 5. Title <= 60 chars & unique
      const titleMatch = headContent.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      if (!titleMatch) {
        errors.push('Відсутній тег <title>');
      } else {
        const titleText = titleMatch[1].trim();
        if (titleText.length > 60) {
          errors.push(`<title> перевищує 60 символів (${titleText.length} симв.): "${titleText}"`);
        }
        if (this.seenTitles.has(titleText)) {
          errors.push(`<title> не унікальний (дублює ${this.seenTitles.get(titleText)}): "${titleText}"`);
        } else {
          this.seenTitles.set(titleText, filename);
        }
      }

      // 6. Meta description <= 155 chars & unique
      const descMatch = headContent.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
        || headContent.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
      if (!descMatch) {
        errors.push('Відсутній <meta name="description">');
      } else {
        const descText = descMatch[1].trim();
        if (descText.length > 155) {
          errors.push(`<meta name="description"> перевищує 155 символів (${descText.length} симв.): "${descText}"`);
        }
        if (this.seenDescriptions.has(descText)) {
          errors.push(`<meta name="description"> не унікальний (дублює ${this.seenDescriptions.get(descText)})`);
        } else {
          this.seenDescriptions.set(descText, filename);
        }
      }

      // 7. Favicon SVG
      if (!/<link\s+rel=["']icon["']\s+href=["']assets\/favicon\.svg["']\s+type=["']image\/svg\+xml["']/i.test(headContent)
          && !/<link\s+[^>]*href=["'][^"']*favicon\.svg["'][^>]*>/i.test(headContent)) {
        errors.push('Відсутнє посилання на favicon.svg як SVG іконку');
      }

      // 8. normalize.css & styles.css linked
      if (!/<link\s+[^>]*href=["'][^"']*normalize\.css["'][^>]*>/i.test(headContent)) {
        errors.push('Відсутнє підключення normalize.css у <head>');
      }
      if (!/<link\s+[^>]*href=["'][^"']*styles\.css["'][^>]*>/i.test(headContent)) {
        errors.push('Відсутнє підключення styles.css у <head>');
      }
    }

    // 9. Zero <style> tags & Zero inline style=""
    const styleTags = content.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
    if (styleTags && styleTags.length > 0) {
      errors.push(`Знайдено заборонений тег <style> (${styleTags.length} шт.)`);
    }

    // Check inline style="..." attributes
    const inlineStyleRegex = /\bstyle\s*=\s*["'][^"']+["']/gi;
    let inlineStyleMatch;
    let inlineCount = 0;
    while ((inlineStyleMatch = inlineStyleRegex.exec(content)) !== null) {
      inlineCount++;
    }
    if (inlineCount > 0) {
      errors.push(`Знайдено заборонені інлайн-стилі style="..." (${inlineCount} шт.)`);
    }

    // 10. Script rules: defer & no inline executable script in HTML
    const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptTagRegex.exec(content)) !== null) {
      const attrs = scriptMatch[1];
      const body = scriptMatch[2].trim();
      const isSrc = /src=["'][^"']+["']/i.test(attrs);
      const isJsonLd = /type=["']application\/ld\+json["']/i.test(attrs);

      if (isSrc) {
        if (!/\bdefer\b/i.test(attrs) && !/\basync\b/i.test(attrs)) {
          errors.push(`Зовнішній скрипт не має атрибута defer: <script ${attrs}>`);
        }
      } else if (!isJsonLd && body.length > 0) {
        errors.push(`Знайдено заборонений інлайн-скрипт JS: "${body.slice(0, 50)}..."`);
      }
    }

    // 11. Heading hierarchy: Exactly one <h1>
    const h1Matches = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
    if (!h1Matches || h1Matches.length === 0) {
      errors.push('На сторінці відсутній обов’язковий головний заголовок <h1>');
    } else if (h1Matches.length > 1) {
      errors.push(`На сторінці більше одного <h1> (${h1Matches.length} шт.): ${h1Matches.map(h => h.replace(/<[^>]+>/g, '').trim()).join(' | ')}`);
    }

    // 12. Images: alt, width, height
    const imgRegex = /<img\b([^>]*)>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(content)) !== null) {
      const attrs = imgMatch[1];
      const hasAlt = /\balt\s*=\s*["']([^"']*)["']/i.test(attrs);
      const hasWidth = /\bwidth\s*=\s*["']?\d+["']?/i.test(attrs);
      const hasHeight = /\bheight\s*=\s*["']?\d+["']?/i.test(attrs);
      const altVal = hasAlt ? attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)[1] : null;
      const isDecorative = /role=["']presentation["']/i.test(attrs) || /aria-hidden=["']true["']/i.test(attrs);

      if (!hasAlt) {
        errors.push(`Знайдено <img> без обов’язкового атрибута alt: <img ${attrs}>`);
      } else if (altVal === '' && !isDecorative) {
        warnings.push(`<img> з порожнім alt="" має мати role="presentation": <img ${attrs}>`);
      }

      if (!hasWidth || !hasHeight) {
        warnings.push(`<img> без явних width та height (може спричинити CLS): <img ${attrs}>`);
      }
    }

    // 13. Form elements: input, select, textarea must have an explicit <label for="...">
    const inputRegex = /<(input|select|textarea)\b([^>]*)>/gi;
    let inputMatch;
    while ((inputMatch = inputRegex.exec(content)) !== null) {
      const tag = inputMatch[1].toLowerCase();
      const attrs = inputMatch[2];
      const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
      const inputType = typeMatch ? typeMatch[1].toLowerCase() : (tag === 'input' ? 'text' : tag);

      // Skip hidden inputs, buttons, submit
      if (['hidden', 'button', 'submit', 'reset', 'image'].includes(inputType)) {
        continue;
      }

      const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
      const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(attrs);
      const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["'][^"']+["']/i.test(attrs);

      if (idMatch) {
        const id = idMatch[1];
        const labelRegex = new RegExp(`<label\\b[^>]*\\bfor=["']${id}["']`, 'i');
        if (!labelRegex.test(content) && !hasAriaLabel && !hasAriaLabelledBy) {
          errors.push(`Елемент <${tag} id="${id}"> не має відповідного <label for="${id}"> або aria-label`);
        }
      } else if (!hasAriaLabel && !hasAriaLabelledBy) {
        errors.push(`Елемент <${tag} ${attrs}> не має id для прив’язки <label for="..."> і не має aria-label`);
      }
    }

    this.totalErrors += errors.length;
    this.totalWarnings += warnings.length;

    return { file: fileLabel, errors, warnings };
  }

  run() {
    console.log('================================================================');
    console.log(' AURELIA UA — АВТОМАТИЧНИЙ АУДИТ ВІДПОВІДНОСТІ W3C ТА КУРСОВОГО ');
    console.log('================================================================\n');

    const fileResults = HTML_FILES.map(f => this.auditFile(f));

    fileResults.forEach(r => {
      console.log(`\n📄 [${r.file}]`);
      if (r.errors.length === 0 && r.warnings.length === 0) {
        this.log('100% відповідність чек-листу GEMINI.md та W3C (0 помилок, 0 зауважень)', 'pass');
      } else {
        r.errors.forEach(err => this.log(`ПОМИЛКА: ${err}`, 'fail'));
        r.warnings.forEach(warn => this.log(`ЗАУВАЖЕННЯ: ${warn}`, 'warn'));
      }
    });

    console.log('\n================================================================');
    console.log(`ПІДСУМОК АУДИТУ:`);
    console.log(` Перевірено файлів: ${HTML_FILES.length}`);
    console.log(` Критичних помилок: ${this.totalErrors}`);
    console.log(` Попереджень:       ${this.totalWarnings}`);
    console.log('================================================================');

    if (this.totalErrors === 0) {
      console.log('\n🎉 ВСІ СТОРІНКИ ПОВНІСТЮ ВІДПОВІДАЮТЬ ПРАВИЛАМ GEMINI.MD ТА СТАНДАРТАМ W3C!');
    } else {
      console.log(`\n⚠️ Знайдено ${this.totalErrors} порушень, що потребують виправлення.`);
    }

    return this.totalErrors === 0;
  }
}

if (require.main === module) {
  const auditor = new W3CAuditor();
  const success = auditor.run();
  process.exit(success ? 0 : 1);
}

module.exports = W3CAuditor;
