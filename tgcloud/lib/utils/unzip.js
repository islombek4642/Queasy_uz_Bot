// tgcloud/lib/utils/unzip.js
// Pure JavaScript synchronous ZIP & Deflate extractor for .docx and .xlsx
// Zero external dependencies, runs in any V8 Isolate / browser / Node environment.

/**
 * Pure JavaScript Inflate (RFC 1951 Deflate decompression).
 * Handles raw deflate streams (no zlib/gzip headers).
 */
function inflateRaw(input) {
  let bitBuf = 0;
  let bitCount = 0;
  let inPos = 0;

  function getBits(n) {
    while (bitCount < n) {
      if (inPos >= input.length) return 0;
      bitBuf |= input[inPos++] << bitCount;
      bitCount += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCount -= n;
    return val;
  }

  // Huffman tree decoder builder
  function buildTree(lengths) {
    const maxLen = Math.max(...lengths, 0);
    const blCount = new Uint16Array(maxLen + 1);
    for (let i = 0; i < lengths.length; i++) {
      if (lengths[i] > 0) blCount[lengths[i]]++;
    }

    const nextCode = new Uint16Array(maxLen + 1);
    let code = 0;
    for (let bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const tree = {};
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i];
      if (len !== 0) {
        let c = nextCode[len]++;
        // Reverse bits for reading LSB first
        let rev = 0;
        for (let b = 0; b < len; b++) {
          rev = (rev << 1) | ((c >>> b) & 1);
        }
        tree[(len << 16) | rev] = i;
      }
    }
    return { tree, maxLen };
  }

  function decodeSymbol(treeObj) {
    let code = 0;
    for (let len = 1; len <= treeObj.maxLen; len++) {
      code |= getBits(1) << (len - 1);
      const sym = treeObj.tree[(len << 16) | code];
      if (sym !== undefined) return sym;
    }
    return -1;
  }

  // Length bases and extra bits (RFC 1951 Table)
  const lengthBases = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
    67, 83, 99, 115, 131, 163, 195, 227, 258,
  ];
  const lengthExtraBits = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4,
    5, 5, 5, 5, 0,
  ];

  // Distance bases and extra bits
  const distBases = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
    769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ];
  const distExtraBits = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13,
  ];

  const clCodeOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  // Fixed Huffman tables
  const fixedLitLengths = new Uint8Array(288);
  for (let i = 0; i <= 143; i++) fixedLitLengths[i] = 8;
  for (let i = 144; i <= 255; i++) fixedLitLengths[i] = 9;
  for (let i = 256; i <= 279; i++) fixedLitLengths[i] = 7;
  for (let i = 280; i <= 287; i++) fixedLitLengths[i] = 8;
  const fixedLitTree = buildTree(fixedLitLengths);

  const fixedDistLengths = new Uint8Array(32);
  for (let i = 0; i < 32; i++) fixedDistLengths[i] = 5;
  const fixedDistTree = buildTree(fixedDistLengths);

  const output = [];

  let isFinal = 0;
  while (!isFinal) {
    isFinal = getBits(1);
    const bType = getBits(2);

    if (bType === 0) {
      // Uncompressed
      bitBuf = 0;
      bitCount = 0;
      const len = input[inPos++] | (input[inPos++] << 8);
      inPos += 2; // skip nlen
      for (let i = 0; i < len; i++) {
        output.push(input[inPos++]);
      }
    } else if (bType === 1 || bType === 2) {
      let litTree = fixedLitTree;
      let distTree = fixedDistTree;

      if (bType === 2) {
        // Dynamic Huffman
        const hLit = getBits(5) + 257;
        const hDist = getBits(5) + 1;
        const hCLen = getBits(4) + 4;

        const clLengths = new Uint8Array(19);
        for (let i = 0; i < hCLen; i++) {
          clLengths[clCodeOrder[i]] = getBits(3);
        }
        const clTree = buildTree(clLengths);

        const totalCodes = hLit + hDist;
        const codeLengths = new Uint8Array(totalCodes);
        let idx = 0;
        while (idx < totalCodes) {
          const sym = decodeSymbol(clTree);
          if (sym < 16) {
            codeLengths[idx++] = sym;
          } else if (sym === 16) {
            const rep = getBits(2) + 3;
            const prev = codeLengths[idx - 1];
            for (let r = 0; r < rep; r++) codeLengths[idx++] = prev;
          } else if (sym === 17) {
            const rep = getBits(3) + 3;
            for (let r = 0; r < rep; r++) codeLengths[idx++] = 0;
          } else if (sym === 18) {
            const rep = getBits(7) + 11;
            for (let r = 0; r < rep; r++) codeLengths[idx++] = 0;
          }
        }

        litTree = buildTree(codeLengths.subarray(0, hLit));
        distTree = buildTree(codeLengths.subarray(hLit));
      }

      // Decode compressed data
      while (true) {
        const sym = decodeSymbol(litTree);
        if (sym === 256 || sym === -1) {
          break; // End of block
        }
        if (sym < 256) {
          output.push(sym);
        } else {
          // Length & distance
          const lenCode = sym - 257;
          const length = lengthBases[lenCode] + getBits(lengthExtraBits[lenCode]);
          const distCode = decodeSymbol(distTree);
          const distance = distBases[distCode] + getBits(distExtraBits[distCode]);

          const start = output.length - distance;
          for (let l = 0; l < length; l++) {
            output.push(output[start + l]);
          }
        }
      }
    }
  }

  return new Uint8Array(output);
}

/**
 * Pure JavaScript Inflate for zlib streams (RFC 1950).
 */
export function inflateZlib(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > 6 && bytes[0] === 0x78) {
    return inflateRaw(bytes.subarray(2, bytes.length - 4));
  }
  return inflateRaw(bytes);
}

export { inflateRaw };

/**
 * Extracts a specific file by path from a ZIP archive.
 * Returns UTF-8 string or null.
 */
export function extractFileFromZip(zipBuffer, targetPath) {
  const bytes = zipBuffer instanceof Uint8Array ? zipBuffer : new Uint8Array(zipBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const fileNameStart = offset + 30;
    const fileNameBytes = bytes.subarray(fileNameStart, fileNameStart + fileNameLength);
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (fileName === targetPath || fileName.endsWith(targetPath)) {
      const compressedData = bytes.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) {
        return new TextDecoder('utf-8').decode(compressedData);
      } else if (compressionMethod === 8) {
        const decompressed = inflateRaw(compressedData);
        return new TextDecoder('utf-8').decode(decompressed);
      }
    }

    offset = dataEnd;
  }

  return null;
}

export default { extractFileFromZip };
