const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '..', 'client');
const htmlFiles = ['index.html', 'catalog.html', 'basket.html', 'admin.html', '404.html'];
let hasErrors = false;

htmlFiles.forEach(file => {
  const filePath = path.join(clientDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File ${file} does not exist`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Check style tags
  if (/<style/i.test(content)) {
    console.error(`[FAIL] ${file} contains <style> tag!`);
    hasErrors = true;
  }

  // Check inline style="..."
  const styleMatch = content.match(/style\s*=\s*['"][^'"]*['"]/gi);
  if (styleMatch) {
    console.error(`[FAIL] ${file} contains inline style: ${styleMatch.join(', ')}`);
    hasErrors = true;
  }

  // Check <html lang="uk">
  if (!/<html[^>]*lang=["']uk["']/i.test(content)) {
    console.error(`[FAIL] ${file} missing lang="uk" attribute!`);
    hasErrors = true;
  }

  // Check title
  const titleMatch = content.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) {
    const len = titleMatch[1].length;
    if (len > 60) {
      console.warn(`[WARN] ${file} title length ${len} > 60 chars: "${titleMatch[1]}"`);
    } else {
      console.log(`[OK] ${file} title: ${len} chars`);
    }
  }

  // Check meta description
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (descMatch) {
    const len = descMatch[1].length;
    if (len > 155) {
      console.warn(`[WARN] ${file} description length ${len} > 155 chars: "${descMatch[1]}"`);
    } else {
      console.log(`[OK] ${file} description: ${len} chars`);
    }
  }

  // Check inputs have matching labels
  const inputMatches = [...content.matchAll(/<input[^>]+id=["']([^"']+)["'][^>]*>/gi)];
  inputMatches.forEach(m => {
    const id = m[1];
    const labelMatch = new RegExp(`<label[^>]+for=["']${id}["']`, 'i');
    if (!labelMatch.test(content)) {
      console.error(`[FAIL] ${file} input #${id} has no matching <label for="${id}">`);
      hasErrors = true;
    }
  });
});

if (!hasErrors) {
  console.log('✅ ALL HTML FILES 100% COMPLIANT WITH GEMINI.md RULES!');
} else {
  process.exit(1);
}

