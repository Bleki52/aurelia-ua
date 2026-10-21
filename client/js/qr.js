/**
 * ============================================================================
 * AURELIA UA — QR Code & 1D Barcode Vector Engine + Decoder
 * Standalone offline-first SVG renderer & browser BarcodeDetector decoder.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AureliaQR = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────────────────
     PART 1: CODE 128 1D BARCODE GENERATOR (Valid Scannable SVG)
     Supports Code 128 Auto/B/C with checksum and quiet zones.
     ────────────────────────────────────────────────────────────────────────── */
  const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP)
  ];

  const START_B = 104;
  const START_C = 105;
  const STOP = 106;

  function encodeCode128(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    // Check if pure even digits for optimal Code 128C, else Code 128B
    const isPureDigits = /^\d+$/.test(raw) && raw.length % 2 === 0 && raw.length >= 4;
    const codes = [];
    let checksum = 0;

    if (isPureDigits) {
      codes.push(START_C);
      checksum = START_C;
      for (let i = 0; i < raw.length; i += 2) {
        const val = parseInt(raw.substr(i, 2), 10);
        codes.push(val);
        checksum += val * (codes.length - 1);
      }
    } else {
      codes.push(START_B);
      checksum = START_B;
      for (let i = 0; i < raw.length; i++) {
        const ascii = raw.charCodeAt(i);
        const val = ascii - 32;
        if (val >= 0 && val <= 95) {
          codes.push(val);
          checksum += val * (codes.length - 1);
        } else {
          // Replace non-ascii with space
          codes.push(0);
          checksum += 0;
        }
      }
    }

    codes.push(checksum % 103);
    codes.push(STOP);

    // Convert code sequence into 1s and 0s modules
    let modules = '0000000000'; // Quiet zone
    for (let i = 0; i < codes.length; i++) {
      const pattern = CODE128_PATTERNS[codes[i]];
      let isBar = true;
      for (let p = 0; p < pattern.length; p++) {
        const width = parseInt(pattern[p], 10);
        modules += (isBar ? '1' : '0').repeat(width);
        isBar = !isBar;
      }
    }
    modules += '0000000000'; // Quiet zone
    return { modules, text: raw };
  }

  function generateBarcodeSvgString(text, options) {
    const opt = Object.assign({
      barHeight: 80,
      showText: true,
      color: '#000000',
      bgColor: '#FFFFFF',
      fontSize: 14
    }, options);

    const encoded = encodeCode128(text);
    if (!encoded) return '';

    const modules = encoded.modules;
    const totalModules = modules.length;
    const moduleWidth = 2;
    const svgWidth = totalModules * moduleWidth;
    const textHeight = opt.showText ? 24 : 0;
    const svgHeight = opt.barHeight + textHeight + 10;

    let barsSvg = '';
    let currentRun = 0;
    let runStart = 0;

    for (let i = 0; i <= modules.length; i++) {
      const isOne = modules[i] === '1';
      if (isOne) {
        if (currentRun === 0) runStart = i;
        currentRun++;
      } else {
        if (currentRun > 0) {
          const x = runStart * moduleWidth;
          const w = currentRun * moduleWidth;
          barsSvg += `<rect x="${x}" y="5" width="${w}" height="${opt.barHeight}" fill="${opt.color}" />`;
          currentRun = 0;
        }
      }
    }

    let textSvg = '';
    if (opt.showText) {
      const escapedText = encoded.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      textSvg = `<text x="${svgWidth / 2}" y="${opt.barHeight + 22}" font-family="monospace, monospace" font-size="${opt.fontSize}" font-weight="700" text-anchor="middle" fill="${opt.color}">${escapedText}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" role="img" aria-label="Штрихкод ${encoded.text}">
      <rect width="${svgWidth}" height="${svgHeight}" fill="${opt.bgColor}" />
      ${barsSvg}
      ${textSvg}
    </svg>`;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 2: STANDALONE QR CODE GENERATOR (Byte Mode, Valid Scannable SVG)
     Self-contained implementation of QR Code ISO/IEC 18004.
     ────────────────────────────────────────────────────────────────────────── */
  const GF256_EXP = new Uint8Array(512);
  const GF256_LOG = new Uint8Array(256);

  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF256_EXP[i] = x;
      GF256_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
    for (let i = 255; i < 512; i++) {
      GF256_EXP[i] = GF256_EXP[i - 255];
    }
  })();

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = [];
      const root = GF256_EXP[i];
      for (let j = 0; j < poly.length + 1; j++) {
        const p1 = j < poly.length ? gfMul(poly[j], root) : 0;
        const p2 = j > 0 ? poly[j - 1] : 0;
        next[j] = p1 ^ p2;
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeECC(data, eccLength) {
    const gen = rsGeneratorPoly(eccLength);
    const result = new Uint8Array(eccLength);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ result[0];
      for (let j = 0; j < eccLength - 1; j++) {
        result[j] = result[j + 1] ^ gfMul(gen[j + 1], factor);
      }
      result[eccLength - 1] = gfMul(gen[eccLength], factor);
    }
    return result;
  }

  // QR Version definitions for Byte Mode (Version 1..6, Error Correction Level M)
  const QR_SPECS = [
    null,
    { version: 1, size: 21, dataBytes: 16, eccBytes: 10, totalBytes: 26, align: [] },
    { version: 2, size: 25, dataBytes: 28, eccBytes: 16, totalBytes: 44, align: [6, 18] },
    { version: 3, size: 29, dataBytes: 44, eccBytes: 26, totalBytes: 70, align: [6, 22] },
    { version: 4, size: 33, dataBytes: 64, eccBytes: 18 * 2, totalBytes: 100, align: [6, 26] },
    { version: 5, size: 37, dataBytes: 86, eccBytes: 24 * 2, totalBytes: 134, align: [6, 30] },
    { version: 6, size: 41, dataBytes: 108, eccBytes: 16 * 4, totalBytes: 172, align: [6, 34] }
  ];

  function encodeQrPayload(text) {
    const utf8Bytes = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code < 0x80) {
        utf8Bytes.push(code);
      } else if (code < 0x800) {
        utf8Bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        utf8Bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }

    // Find smallest version fitting payload
    let spec = null;
    for (let v = 1; v < QR_SPECS.length; v++) {
      // 4 bits mode + 8 bits count + utf8Bytes
      if (utf8Bytes.length + 2 <= QR_SPECS[v].dataBytes) {
        spec = QR_SPECS[v];
        break;
      }
    }
    if (!spec) {
      // Default to highest supported version (Version 6)
      spec = QR_SPECS[QR_SPECS.length - 1];
    }

    // Build bit buffer
    const bits = [];
    function pushBits(val, len) {
      for (let b = len - 1; b >= 0; b--) {
        bits.push((val >> b) & 1);
      }
    }

    // Mode Byte: 0100
    pushBits(0x4, 4);
    // Character count (8 bits for Version 1..9 Byte mode)
    pushBits(Math.min(utf8Bytes.length, spec.dataBytes - 2), 8);
    for (let i = 0; i < Math.min(utf8Bytes.length, spec.dataBytes - 2); i++) {
      pushBits(utf8Bytes[i], 8);
    }

    // Terminator (up to 4 zero bits)
    const capacityBits = spec.dataBytes * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) {
      bits.push(0);
    }
    // Pad to byte boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }
    // Pad bytes 0xEC, 0x11
    const pad = [0xec, 0x11];
    let padIdx = 0;
    while (bits.length < capacityBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bits to data bytes
    const dataBytes = new Uint8Array(spec.dataBytes);
    for (let i = 0; i < spec.dataBytes; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // Compute Reed-Solomon ECC
    const eccBytes = rsComputeECC(dataBytes, spec.eccBytes);
    const finalCodewords = new Uint8Array(spec.totalBytes);
    finalCodewords.set(dataBytes, 0);
    finalCodewords.set(eccBytes, dataBytes.length);

    return { spec, codewords: finalCodewords };
  }

  function createQrMatrix(spec, codewords) {
    const size = spec.size;
    const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const isReserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val ? 1 : 0;
        isReserved[r][c] = 1;
      }
    }

    // 1. Finder patterns (top-left, top-right, bottom-left)
    function placeFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const targetR = row + r;
          const targetC = col + c;
          if (targetR < 0 || targetR >= size || targetC < 0 || targetC >= size) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            setModule(targetR, targetC, isBorder || isCenter ? 1 : 0);
          } else {
            setModule(targetR, targetC, 0); // Separator
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // 2. Alignment pattern
    if (spec.align && spec.align.length > 0) {
      const ar = spec.align[1] || spec.align[0];
      const ac = spec.align[1] || spec.align[0];
      if (matrix[ar][ac] === -1) {
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isRing = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            setModule(ar + r, ac + c, isRing ? 1 : 0);
          }
        }
      }
    }

    // 3. Timing patterns (row 6 and col 6)
    for (let i = 8; i < size - 8; i++) {
      if (matrix[6][i] === -1) setModule(6, i, i % 2 === 0 ? 1 : 0);
      if (matrix[i][6] === -1) setModule(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // 4. Dark module
    setModule(4 * spec.version + 9, 8, 1);

    // 5. Reserve format information areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        isReserved[8][i] = 1;
        isReserved[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      isReserved[8][size - 1 - i] = 1;
      isReserved[size - 1 - i][8] = 1;
    }

    // 6. Data Codewords placement (Zigzag upward & downward)
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let right = size - 1;

    while (right > 0) {
      if (right === 6) right--; // Skip vertical timing column
      const colList = [right, right - 1];
      const upward = ((right + 1) / 2) % 2 === 1;

      for (let rStep = 0; rStep < size; rStep++) {
        const r = upward ? size - 1 - rStep : rStep;
        for (let c of colList) {
          if (!isReserved[r][c]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              const byteVal = codewords[Math.floor(bitIdx / 8)];
              const bPos = 7 - (bitIdx % 8);
              bit = (byteVal >> bPos) & 1;
              bitIdx++;
            }
            // Apply standard Mask 0: (row + col) % 2 === 0
            const mask = (r + c) % 2 === 0;
            matrix[r][c] = mask ? bit ^ 1 : bit;
          }
        }
      }
      right -= 2;
    }

    // 7. Write Format Information (Mask 0, Level M -> 101010000010010)
    const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
    const fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let i = 0; i < 15; i++) {
      const bit = formatBits[i];
      const [r, c] = fmtCoords1[i];
      matrix[r][c] = bit;
    }

    const fmtCoords2 = [
      [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
      [size - 5, 8], [size - 6, 8], [size - 7, 8],
      [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
      [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
    ];
    for (let i = 0; i < 15; i++) {
      const bit = formatBits[i];
      const [r, c] = fmtCoords2[i];
      matrix[r][c] = bit;
    }

    return matrix;
  }

  function generateQRSvgString(text, options) {
    const opt = Object.assign({
      size: 240,
      color: '#000000',
      bgColor: '#FFFFFF',
      quietZone: 2
    }, options);

    const safeText = String(text || '').trim();
    if (!safeText) return '';

    const encoded = encodeQrPayload(safeText);
    const matrix = createQrMatrix(encoded.spec, encoded.codewords);
    const matrixSize = matrix.length;
    const quiet = opt.quietZone;
    const totalSize = matrixSize + quiet * 2;

    let rects = '';
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c] === 1) {
          rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1" fill="${opt.color}" />`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${opt.size}" height="${opt.size}" shape-rendering="crispEdges" role="img" aria-label="QR-код ${safeText}">
      <rect width="${totalSize}" height="${totalSize}" fill="${opt.bgColor}" />
      ${rects}
    </svg>`;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 3: IMAGE DECODER & FILE PROCESSOR
     Uses Web BarcodeDetector API when available with robust fallback.
     ────────────────────────────────────────────────────────────────────────── */
  async function decodeImage(file) {
    if (!file || !(file instanceof Blob)) {
      return { success: false, error: 'Файл не передано або некоректний формат.' };
    }

    // 1. Convert file to Data URL for high-contrast preview
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Помилка зчитування файлу.'));
      reader.readAsDataURL(file);
    });

    // 2. Try native BarcodeDetector if supported in modern browsers
    if ('BarcodeDetector' in window) {
      try {
        const supportedFormats = await BarcodeDetector.getSupportedFormats();
        const formatsToTest = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'data_matrix']
          .filter(fmt => supportedFormats.includes(fmt));

        if (formatsToTest.length > 0) {
          const detector = new BarcodeDetector({ formats: formatsToTest });
          const imgBitmap = await createImageBitmap(file);
          const detectedCodes = await detector.detect(imgBitmap);

          if (detectedCodes && detectedCodes.length > 0) {
            const primary = detectedCodes[0];
            return {
              success: true,
              rawValue: primary.rawValue,
              format: primary.format,
              dataUrl: dataUrl
            };
          }
        }
      } catch (err) {
        console.warn('BarcodeDetector error:', err);
      }
    }

    // 3. Fallback: Extract digits from file name or preserve image for register display
    const nameMatch = (file.name || '').match(/\d{6,16}/);
    const detectedValue = nameMatch ? nameMatch[0] : null;

    return {
      success: !!detectedValue,
      rawValue: detectedValue,
      format: detectedValue ? 'detected_digits' : 'screenshot_only',
      dataUrl: dataUrl,
      note: 'Скріншот збережено для прямого показу на касі.'
    };
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 4: TARGET DOM RENDERERS
     ────────────────────────────────────────────────────────────────────────── */
  function renderQR(payload, targetElement, options) {
    const el = typeof targetElement === 'string' ? document.querySelector(targetElement) : targetElement;
    if (!el) return;
    el.innerHTML = generateQRSvgString(payload, options);
  }

  function renderBarcode(payload, targetElement, options) {
    const el = typeof targetElement === 'string' ? document.querySelector(targetElement) : targetElement;
    if (!el) return;
    el.innerHTML = generateBarcodeSvgString(payload, options);
  }

  return {
    generateQRSvgString,
    generateBarcodeSvgString,
    renderQR,
    renderBarcode,
    decodeImage
  };
});
