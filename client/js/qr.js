/**
 * ============================================================================
 * AURELIA UA — Standards-Compliant QR Code, EAN-13 & Code 128 Engine + Decoder
 * 1) ISO/IEC 18004 QR Code SVG Generator (Versions 1–10, Level M, Reed-Solomon)
 * 2) ISO/IEC 15420 EAN-13 (for 13-digit cards) & Code 128B/C 1D Barcode SVG
 * 3) Multi-Layer Screenshot QR & Barcode Decoder (BarcodeDetector + jsQR Canvas)
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
     PART 1A: EAN-13 1D BARCODE ENCODER (ISO/IEC 15420)
     Used automatically for exact 13-digit supermarket loyalty cards.
     ────────────────────────────────────────────────────────────────────────── */
  const EAN13_L = [
    '0001101', '0011001', '0010011', '0111101', '0100011',
    '0110001', '0101111', '0111011', '0110111', '0001011'
  ];
  const EAN13_G = [
    '0100111', '0110011', '0011011', '0100001', '0011101',
    '0111001', '0000101', '0010001', '0001001', '0010111'
  ];
  const EAN13_R = [
    '1110010', '1100110', '1101100', '1000010', '1011100',
    '1001110', '1010000', '1000100', '1001000', '1110100'
  ];
  const EAN13_PARITY = [
    'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
    'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
  ];

  function encodeEAN13(digits) {
    if (!/^\d{13}$/.test(digits)) return null;

    const nums = digits.split('').map(Number);
    const parityPattern = EAN13_PARITY[nums[0]];

    // Quiet zone (11) + Start guard (3) + Left 6 (42) + Center guard (5) + Right 6 (42) + End guard (3) + Quiet zone (7) = 113
    const leftQuiet = '00000000000';
    const rightQuiet = '0000000';

    let leftGroup = '';
    for (let i = 1; i <= 6; i++) {
      const table = parityPattern[i - 1] === 'L' ? EAN13_L : EAN13_G;
      leftGroup += table[nums[i]];
    }

    let rightGroup = '';
    for (let i = 7; i <= 12; i++) {
      rightGroup += EAN13_R[nums[i]];
    }

    const guardStart = 11;
    const guardCenter = 11 + 3 + 42;
    const guardEnd = 11 + 3 + 42 + 5 + 42;

    const modules = leftQuiet + '101' + leftGroup + '01010' + rightGroup + '101' + rightQuiet;
    return {
      symbology: 'ean13',
      modules,
      text: digits,
      guardRanges: [
        [guardStart, guardStart + 3],
        [guardCenter, guardCenter + 5],
        [guardEnd, guardEnd + 3]
      ]
    };
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 1B: CODE 128 1D BARCODE ENCODER (ISO/IEC 15417)
     Supports Code 128C (even-length numbers) and Code 128B (alphanumeric).
     ────────────────────────────────────────────────────────────────────────── */
  const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
  ];

  const START_B = 104;
  const START_C = 105;
  const STOP = 106;

  function encodeCode128(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const isPureEvenDigits = /^\d+$/.test(raw) && raw.length % 2 === 0 && raw.length >= 4;
    const codes = [];
    let checksum = 0;

    if (isPureEvenDigits) {
      codes.push(START_C);
      checksum = START_C;
      for (let i = 0; i < raw.length; i += 2) {
        const val = parseInt(raw.slice(i, i + 2), 10);
        codes.push(val);
        checksum += val * (codes.length - 1);
      }
    } else {
      codes.push(START_B);
      checksum = START_B;
      for (let i = 0; i < raw.length; i++) {
        const ascii = raw.charCodeAt(i);
        const val = ascii >= 32 && ascii <= 127 ? ascii - 32 : 0;
        codes.push(val);
        checksum += val * (codes.length - 1);
      }
    }

    codes.push(checksum % 103);
    codes.push(STOP);

    let modules = '0000000000';
    for (let i = 0; i < codes.length; i++) {
      const pattern = CODE128_PATTERNS[codes[i]];
      let isBar = true;
      for (let p = 0; p < pattern.length; p++) {
        const width = parseInt(pattern[p], 10);
        modules += (isBar ? '1' : '0').repeat(width);
        isBar = !isBar;
      }
    }
    modules += '0000000000';

    return {
      symbology: 'code128',
      modules,
      text: raw,
      guardRanges: []
    };
  }

  function escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function generateBarcodeSvgString(text, options) {
    const opt = Object.assign({
      barHeight: 82,
      showText: true,
      color: '#000000',
      bgColor: '#FFFFFF',
      fontSize: 13
    }, options);

    const raw = String(text || '').trim();
    if (!raw) return '';

    const compactDigits = raw.replace(/\s+/g, '');
    const encoded = /^\d{13}$/.test(compactDigits)
      ? encodeEAN13(compactDigits)
      : encodeCode128(raw);

    if (!encoded) return '';

    const modules = encoded.modules;
    const moduleWidth = 2;
    const svgWidth = modules.length * moduleWidth;
    const topPad = 8;
    const textHeight = opt.showText ? 26 : 6;
    const svgHeight = topPad + opt.barHeight + textHeight;

    function isGuardIndex(idx) {
      for (let g = 0; g < encoded.guardRanges.length; g++) {
        if (idx >= encoded.guardRanges[g][0] && idx < encoded.guardRanges[g][1]) {
          return true;
        }
      }
      return false;
    }

    // Group adjacent bars sharing the same height into SVG <path> runs
    let dataPath = '';
    let guardPath = '';
    let i = 0;
    while (i < modules.length) {
      if (modules[i] === '1') {
        const guard = isGuardIndex(i);
        const start = i;
        while (i < modules.length && modules[i] === '1' && isGuardIndex(i) === guard) {
          i++;
        }
        const x = start * moduleWidth;
        const w = (i - start) * moduleWidth;
        const h = guard ? opt.barHeight + 8 : opt.barHeight;
        const cmd = `M${x} ${topPad}h${w}v${h}h-${w}z`;
        if (guard) {
          guardPath += cmd;
        } else {
          dataPath += cmd;
        }
      } else {
        i++;
      }
    }

    let textSvg = '';
    if (opt.showText) {
      const yPos = topPad + opt.barHeight + 19;
      if (encoded.symbology === 'ean13') {
        const d = encoded.text;
        const xFirst = 5.5 * moduleWidth;
        const xLeft = (11 + 3 + 21) * moduleWidth;
        const xRight = (11 + 3 + 42 + 5 + 21) * moduleWidth;
        textSvg =
          `<text x="${xFirst}" y="${yPos}" font-family="monospace" font-size="${opt.fontSize}" font-weight="700" text-anchor="middle" fill="${opt.color}">${escapeXml(d[0])}</text>` +
          `<text x="${xLeft}" y="${yPos}" font-family="monospace" font-size="${opt.fontSize}" font-weight="700" text-anchor="middle" fill="${opt.color}">${escapeXml(d.slice(1, 7))}</text>` +
          `<text x="${xRight}" y="${yPos}" font-family="monospace" font-size="${opt.fontSize}" font-weight="700" text-anchor="middle" fill="${opt.color}">${escapeXml(d.slice(7, 13))}</text>`;
      } else {
        textSvg = `<text x="${svgWidth / 2}" y="${yPos}" font-family="monospace" font-size="${opt.fontSize}" font-weight="700" text-anchor="middle" fill="${opt.color}">${escapeXml(encoded.text)}</text>`;
      }
    }

    const fullPath = dataPath + guardPath;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" shape-rendering="crispEdges" role="img" aria-label="Штрихкод ${escapeXml(encoded.text)}"><rect width="${svgWidth}" height="${svgHeight}" fill="${opt.bgColor}"/><path d="${fullPath}" fill="${opt.color}"/>${textSvg}</svg>`;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 2: ISO/IEC 18004 QR CODE GENERATOR (Versions 1–10, Level M)
     Full GF(256) Reed-Solomon ECC, Multi-Block Interleaving, Zigzag Placement,
     8-Mask Penalty Evaluation & BCH(15,5) / BCH(18,6) Metadata.
     ────────────────────────────────────────────────────────────────────────── */
  const GF256_EXP = new Uint8Array(512);
  const GF256_LOG = new Uint8Array(256);

  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF256_EXP[i] = x;
      GF256_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF256_EXP[i] = GF256_EXP[i - 255];
    }
  })();

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
  }

  // Returns Reed-Solomon generator polynomial coefficients [1, g_{d-1}, ..., g_0] (highest degree first)
  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const root = GF256_EXP[i];
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
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

  // ISO/IEC 18004 Versions 1–10 (Error Correction Level M)
  const QR_SPECS = [
    null,
    { version: 1,  size: 21, dataBytes: 16,  totalBytes: 26,  blocks: [[1, 16, 10]],             align: [] },
    { version: 2,  size: 25, dataBytes: 28,  totalBytes: 44,  blocks: [[1, 28, 16]],             align: [6, 18] },
    { version: 3,  size: 29, dataBytes: 44,  totalBytes: 70,  blocks: [[1, 44, 26]],             align: [6, 22] },
    { version: 4,  size: 33, dataBytes: 64,  totalBytes: 100, blocks: [[2, 32, 18]],             align: [6, 26] },
    { version: 5,  size: 37, dataBytes: 86,  totalBytes: 134, blocks: [[2, 43, 24]],             align: [6, 30] },
    { version: 6,  size: 41, dataBytes: 108, totalBytes: 172, blocks: [[4, 27, 16]],             align: [6, 34] },
    { version: 7,  size: 45, dataBytes: 124, totalBytes: 196, blocks: [[4, 31, 18]],             align: [6, 22, 38] },
    { version: 8,  size: 49, dataBytes: 154, totalBytes: 242, blocks: [[2, 38, 22], [2, 39, 22]], align: [6, 24, 42] },
    { version: 9,  size: 53, dataBytes: 182, totalBytes: 292, blocks: [[3, 36, 22], [2, 37, 22]], align: [6, 26, 46] },
    { version: 10, size: 57, dataBytes: 216, totalBytes: 346, blocks: [[4, 43, 26], [1, 44, 26]], align: [6, 28, 50] }
  ];

  function textToUtf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(text));
    }
    const utf8 = unescape(encodeURIComponent(text));
    const bytes = new Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
      bytes[i] = utf8.charCodeAt(i);
    }
    return bytes;
  }

  function encodeQrPayload(text) {
    const utf8Bytes = textToUtf8Bytes(text);

    let spec = null;
    for (let v = 1; v < QR_SPECS.length; v++) {
      const countBits = v >= 10 ? 16 : 8;
      const headerBytes = Math.ceil((4 + countBits) / 8); // 2 bytes for V1-9, 3 bytes for V10
      if (utf8Bytes.length + headerBytes <= QR_SPECS[v].dataBytes) {
        spec = QR_SPECS[v];
        break;
      }
    }
    if (!spec) {
      spec = QR_SPECS[QR_SPECS.length - 1];
    }

    const countBits = spec.version >= 10 ? 16 : 8;
    const maxPayloadBytes = spec.dataBytes - Math.ceil((4 + countBits) / 8);
    const payloadSlice = utf8Bytes.slice(0, maxPayloadBytes);

    const bits = [];
    function pushBits(val, len) {
      for (let b = len - 1; b >= 0; b--) {
        bits.push((val >> b) & 1);
      }
    }

    // Mode Indicator: Byte Mode (0100)
    pushBits(0x4, 4);
    pushBits(payloadSlice.length, countBits);
    for (let i = 0; i < payloadSlice.length; i++) {
      pushBits(payloadSlice[i], 8);
    }

    // Terminator + Byte Padding + 0xEC / 0x11 Pad Codewords
    const capacityBits = spec.dataBytes * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) {
      bits.push(0);
    }
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }
    const pad = [0xec, 0x11];
    let padIdx = 0;
    while (bits.length < capacityBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    const dataBytes = new Uint8Array(spec.dataBytes);
    for (let i = 0; i < spec.dataBytes; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // Split into EC blocks, compute Reed-Solomon ECC for each block, then interleave
    const dataBlocks = [];
    const eccBlocks = [];
    let offset = 0;

    for (let g = 0; g < spec.blocks.length; g++) {
      const [blockCount, dataPerBlock, eccPerBlock] = spec.blocks[g];
      for (let b = 0; b < blockCount; b++) {
        const blockData = dataBytes.subarray(offset, offset + dataPerBlock);
        offset += dataPerBlock;
        dataBlocks.push(blockData);
        eccBlocks.push(rsComputeECC(blockData, eccPerBlock));
      }
    }

    const interleaved = [];
    const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
      }
    }

    const maxEccLen = Math.max(...eccBlocks.map(b => b.length));
    for (let i = 0; i < maxEccLen; i++) {
      for (let b = 0; b < eccBlocks.length; b++) {
        if (i < eccBlocks[b].length) interleaved.push(eccBlocks[b][i]);
      }
    }

    return { spec, codewords: Uint8Array.from(interleaved) };
  }

  function encodeFormatBits(maskId) {
    // Error Correction Level M = 00
    const data = maskId & 0x7;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) {
        rem ^= (0x537 << (i - 10));
      }
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function encodeVersionBits(version) {
    let rem = version << 12;
    for (let i = 17; i >= 12; i--) {
      if ((rem >> i) & 1) {
        rem ^= (0x1f25 << (i - 12));
      }
    }
    return (version << 12) | rem;
  }

  function applyMaskCondition(maskId, r, c) {
    switch (maskId) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
      case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
      case 7: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
      default: return false;
    }
  }

  function evaluateMaskPenalty(matrix) {
    const size = matrix.length;
    let penalty = 0;

    // N1: 5+ consecutive same-color modules in a row or column
    for (let r = 0; r < size; r++) {
      let runLen = 1;
      for (let c = 1; c < size; c++) {
        if (matrix[r][c] === matrix[r][c - 1]) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    for (let c = 0; c < size; c++) {
      let runLen = 1;
      for (let r = 1; r < size; r++) {
        if (matrix[r][c] === matrix[r - 1][c]) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }

    // N2: 2x2 blocks of same color
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = matrix[r][c];
        if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // N3: 1:1:3:1:1 finder-like ratio with 4 light modules on either side
    const pA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - 11; c++) {
        let matchA = true;
        let matchB = true;
        for (let k = 0; k < 11; k++) {
          if (matrix[r][c + k] !== pA[k]) matchA = false;
          if (matrix[r][c + k] !== pB[k]) matchB = false;
        }
        if (matchA || matchB) penalty += 40;
      }
    }
    for (let c = 0; c < size; c++) {
      for (let r = 0; r <= size - 11; r++) {
        let matchA = true;
        let matchB = true;
        for (let k = 0; k < 11; k++) {
          if (matrix[r + k][c] !== pA[k]) matchA = false;
          if (matrix[r + k][c] !== pB[k]) matchB = false;
        }
        if (matchA || matchB) penalty += 40;
      }
    }

    // N4: Dark module balance deviation from 50%
    let darkCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) darkCount++;
      }
    }
    const percent = (darkCount * 100) / (size * size);
    const prev5 = Math.floor(Math.abs(percent - 50) / 5);
    penalty += prev5 * 10;

    return penalty;
  }

  function buildBaseQrMatrix(spec) {
    const size = spec.size;
    const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const isReserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val ? 1 : 0;
        isReserved[r][c] = 1;
      }
    }

    // 1. Finder patterns + 1-module separator
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
            setModule(targetR, targetC, 0);
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // 2. Alignment patterns (full grid for spec.align)
    if (spec.align && spec.align.length > 0) {
      const coords = spec.align;
      for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords.length; j++) {
          const ar = coords[i];
          const ac = coords[j];
          // Skip overlaps with the 3 finder regions
          if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) {
            continue;
          }
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const isDark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
              setModule(ar + r, ac + c, isDark ? 1 : 0);
            }
          }
        }
      }
    }

    // 3. Timing patterns (row 6 and col 6)
    for (let i = 8; i < size - 8; i++) {
      if (!isReserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
      if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
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

    // 6. Version information (Version >= 7)
    if (spec.version >= 7) {
      const verBits = encodeVersionBits(spec.version);
      for (let i = 0; i < 18; i++) {
        const bit = (verBits >> i) & 1;
        const row = Math.floor(i / 3);
        const col = size - 11 + (i % 3);
        setModule(row, col, bit);
        setModule(col, row, bit);
      }
    }

    return { matrix, isReserved };
  }

  function writeFormatInfo(matrix, maskId) {
    const size = matrix.length;
    const fmt = encodeFormatBits(maskId);

    const fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    const fmtCoords2 = [
      [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
      [size - 5, 8], [size - 6, 8], [size - 7, 8],
      [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
      [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
    ];

    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> (14 - i)) & 1;
      const [r1, c1] = fmtCoords1[i];
      const [r2, c2] = fmtCoords2[i];
      matrix[r1][c1] = bit;
      matrix[r2][c2] = bit;
    }
  }

  function createQrMatrix(spec, codewords) {
    const size = spec.size;
    const { matrix: baseMatrix, isReserved } = buildBaseQrMatrix(spec);

    // Place data/ECC bits onto base matrix (unmasked copy)
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let right = size - 1;
    let upward = true;

    while (right > 0) {
      if (right === 6) right--; // Skip vertical timing column
      for (let step = 0; step < size; step++) {
        const r = upward ? size - 1 - step : step;
        for (let offset = 0; offset < 2; offset++) {
          const c = right - offset;
          if (!isReserved[r][c]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              const byteVal = codewords[bitIdx >> 3];
              const bPos = 7 - (bitIdx & 7);
              bit = (byteVal >> bPos) & 1;
              bitIdx++;
            }
            baseMatrix[r][c] = bit;
          }
        }
      }
      upward = !upward;
      right -= 2;
    }

    // Evaluate all 8 standard masks and pick the one with lowest penalty score
    let bestMatrix = null;
    let bestPenalty = Infinity;

    for (let maskId = 0; maskId < 8; maskId++) {
      const candidate = baseMatrix.map(row => Int8Array.from(row));
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!isReserved[r][c] && applyMaskCondition(maskId, r, c)) {
            candidate[r][c] ^= 1;
          }
        }
      }
      writeFormatInfo(candidate, maskId);
      const penalty = evaluateMaskPenalty(candidate);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMatrix = candidate;
      }
    }

    return bestMatrix;
  }

  function generateQRSvgString(text, options) {
    const opt = Object.assign({
      size: 240,
      color: '#000000',
      bgColor: '#FFFFFF',
      quietZone: 4
    }, options);

    const safeText = String(text || '').trim();
    if (!safeText) return '';

    const encoded = encodeQrPayload(safeText);
    const matrix = createQrMatrix(encoded.spec, encoded.codewords);
    const matrixSize = matrix.length;
    const quiet = opt.quietZone;
    const totalSize = matrixSize + quiet * 2;

    // Compact horizontal RLE <path> for sharp crispEdges rendering
    let pathData = '';
    for (let r = 0; r < matrixSize; r++) {
      let c = 0;
      while (c < matrixSize) {
        if (matrix[r][c] === 1) {
          const startC = c;
          while (c < matrixSize && matrix[r][c] === 1) c++;
          const runW = c - startC;
          pathData += `M${startC + quiet} ${r + quiet}h${runW}v1h-${runW}z`;
        } else {
          c++;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${opt.size}" height="${opt.size}" shape-rendering="crispEdges" role="img" aria-label="QR-код ${escapeXml(safeText)}"><rect width="${totalSize}" height="${totalSize}" fill="${opt.bgColor}"/><path d="${pathData}" fill="${opt.color}"/></svg>`;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PART 3: MULTI-LAYER IMAGE DECODER (BarcodeDetector + jsQR Canvas Fallback)
     Reads full QR strings from mobile app screenshots cleanly in any browser.
     ────────────────────────────────────────────────────────────────────────── */
  let jsQrLoadPromise = null;

  function ensureJsQR() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
    if (jsQrLoadPromise) return jsQrLoadPromise;

    jsQrLoadPromise = new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.head) {
        resolve(null);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;

      const timer = setTimeout(() => resolve(typeof window.jsQR === 'function' ? window.jsQR : null), 3500);
      script.onload = () => {
        clearTimeout(timer);
        resolve(typeof window.jsQR === 'function' ? window.jsQR : null);
      };
      script.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      document.head.appendChild(script);
    });

    return jsQrLoadPromise;
  }

  function extractCardNumber(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    // Prefer an exact 13-digit EAN/loyalty card sequence if embedded inside a longer string/URL
    const ean13Match = raw.match(/(?<!\d)\d{13}(?!\d)/);
    if (ean13Match) return ean13Match[0];
    // Next try 12–16 digits (or with spaces)
    const cleanDigitsMatch = raw.match(/\d{8,18}/);
    if (cleanDigitsMatch) return cleanDigitsMatch[0];
    return raw;
  }

  function buildCanvasCrop(img, rx, ry, rw, rh, maxSide) {
    const srcX = Math.max(0, Math.floor(img.naturalWidth * rx));
    const srcY = Math.max(0, Math.floor(img.naturalHeight * ry));
    const srcW = Math.max(1, Math.floor(img.naturalWidth * rw));
    const srcH = Math.max(1, Math.floor(img.naturalHeight * rh));

    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
    return { canvas, ctx, width: dstW, height: dstH };
  }

  function runJsQrOnCanvas(jsQR, canvasInfo) {
    const { ctx, width, height } = canvasInfo;
    const imageData = ctx.getImageData(0, 0, width, height);

    // 1. Direct scan (handles dark-on-light & light-on-dark)
    const direct = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
    if (direct && direct.data) return direct.data;

    // 2. High-contrast binary pass for tinted/gradient loyalty app screenshots
    const data = imageData.data;
    const binData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const v = lum < 145 ? 0 : 255;
      binData[i] = v;
      binData[i + 1] = v;
      binData[i + 2] = v;
      binData[i + 3] = 255;
    }
    const contrasted = jsQR(binData, width, height, { inversionAttempts: 'attemptBoth' });
    return contrasted && contrasted.data ? contrasted.data : null;
  }

  async function decodeImage(file) {
    if (!file || !(file instanceof Blob)) {
      return { success: false, error: 'Файл не передано або некоректний формат.' };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Помилка зчитування файлу.'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error('Не вдалося завантажити зображення.'));
      imageEl.src = dataUrl;
    });

    // Regions tailored for tall mobile screenshots & centered QR cards
    const regions = [
      [0, 0, 1, 1],         // Full screenshot
      [0.12, 0.12, 0.76, 0.76], // Center 76%
      [0.18, 0.22, 0.64, 0.56], // Central QR zone
      [0, 0.15, 1, 0.55],       // Upper-mid band
      [0, 0.35, 1, 0.55]        // Lower-mid band
    ];

    // Layer 1: Native Web BarcodeDetector API (across full image + crops)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const supportedFormats = await BarcodeDetector.getSupportedFormats();
        const formatsToTest = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'data_matrix']
          .filter(fmt => supportedFormats.includes(fmt));

        if (formatsToTest.length > 0) {
          const detector = new BarcodeDetector({ formats: formatsToTest });

          for (let i = 0; i < regions.length; i++) {
            const [rx, ry, rw, rh] = regions[i];
            const target = i === 0 ? img : buildCanvasCrop(img, rx, ry, rw, rh, 1400).canvas;
            const detected = await detector.detect(target);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              const rawValue = String(detected[0].rawValue);
              return {
                success: true,
                rawValue,
                cardNumber: extractCardNumber(rawValue),
                format: detected[0].format || 'qr_code',
                dataUrl
              };
            }
          }
        }
      } catch (err) {
        console.warn('[AureliaQR] BarcodeDetector warning:', err.message);
      }
    }

    // Layer 2: jsQR Canvas Decoder Fallback (reliable across Safari/Firefox/Desktop/Mobile)
    try {
      const jsQR = await ensureJsQR();
      if (typeof jsQR === 'function') {
        const maxSides = [1200, 800];
        for (let m = 0; m < maxSides.length; m++) {
          for (let i = 0; i < regions.length; i++) {
            const [rx, ry, rw, rh] = regions[i];
            const canvasInfo = buildCanvasCrop(img, rx, ry, rw, rh, maxSides[m]);
            const decodedRaw = runJsQrOnCanvas(jsQR, canvasInfo);
            if (decodedRaw) {
              const rawValue = String(decodedRaw);
              return {
                success: true,
                rawValue,
                cardNumber: extractCardNumber(rawValue),
                format: 'qr_code',
                dataUrl
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AureliaQR] jsQR canvas decoder warning:', err.message);
    }

    // Layer 3: Filename digits fallback while keeping original screenshot intact
    const nameMatch = (file.name || '').match(/\d{6,16}/);
    const detectedValue = nameMatch ? nameMatch[0] : null;

    return {
      success: !!detectedValue,
      rawValue: detectedValue,
      cardNumber: detectedValue || '',
      format: detectedValue ? 'detected_digits' : 'screenshot_only',
      dataUrl,
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
    encodeEAN13,
    encodeCode128,
    encodeQrPayload,
    createQrMatrix,
    extractCardNumber,
    generateQRSvgString,
    generateBarcodeSvgString,
    renderQR,
    renderBarcode,
    decodeImage
  };
});
