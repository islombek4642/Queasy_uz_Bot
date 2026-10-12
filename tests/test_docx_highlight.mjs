// tests/test_docx_highlight.mjs
import assert from 'node:assert';
import zlib from 'node:zlib';
import { extractLinesFromDocx } from '../tgcloud/lib/parsers/docx_reader.js';
import { parseAbcFormat } from '../tgcloud/lib/parsers/abc_parser.js';

console.log('--- Testing DOCX Highlight & Bold Detection ---');

// Helper to create a minimal in-memory ZIP buffer with word/document.xml
function createZipWithDocumentXml(xmlContent) {
  const fileName = 'word/document.xml';
  const fileBytes = Buffer.from(xmlContent, 'utf8');
  const compressed = zlib.deflateRawSync(fileBytes);

  // Local File Header
  const lfh = Buffer.alloc(30 + fileName.length);
  lfh.writeUInt32LE(0x04034b50, 0); // signature
  lfh.writeUInt16LE(20, 4); // version
  lfh.writeUInt16LE(0, 6); // flags
  lfh.writeUInt16LE(8, 8); // compression method (deflate)
  lfh.writeUInt16LE(0, 10); // mod time
  lfh.writeUInt16LE(0, 12); // mod date
  lfh.writeUInt32LE(0, 14); // crc32 (unused by our reader)
  lfh.writeUInt32LE(compressed.length, 18); // comp size
  lfh.writeUInt32LE(fileBytes.length, 22); // uncomp size
  lfh.writeUInt16LE(fileName.length, 26);
  lfh.writeUInt16LE(0, 28); // extra len
  lfh.write(fileName, 30);

  // Central Directory Header
  const cdh = Buffer.alloc(46 + fileName.length);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(0, 8);
  cdh.writeUInt16LE(8, 10);
  cdh.writeUInt16LE(0, 12);
  cdh.writeUInt16LE(0, 14);
  cdh.writeUInt32LE(0, 16);
  cdh.writeUInt32LE(compressed.length, 20);
  cdh.writeUInt32LE(fileBytes.length, 24);
  cdh.writeUInt16LE(fileName.length, 28);
  cdh.writeUInt16LE(0, 30);
  cdh.writeUInt16LE(0, 32);
  cdh.writeUInt16LE(0, 34);
  cdh.writeUInt16LE(0, 36);
  cdh.writeUInt32LE(0, 38);
  cdh.writeUInt32LE(0, 42); // offset
  cdh.write(fileName, 46);

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdh.length, 12);
  eocd.writeUInt32LE(lfh.length + compressed.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([lfh, compressed, cdh, eocd]);
}

// XML with highlighted option B (yellow highlight)
const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>1. Alisher Navoiy qachon tug'ilgan?</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>A) 1437-yil</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:highlight w:val="yellow"/></w:rPr>
        <w:t>B) 1441-yil</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:t>C) 1450-yil</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

const docxBuf = createZipWithDocumentXml(sampleXml);
const lines = extractLinesFromDocx(docxBuf);

assert.ok(lines.some((l) => l.includes('1441-yil') && (l.startsWith('#') || l.includes('#'))), 'Option B with highlight must have correct marker #');

const parsed = parseAbcFormat(lines);
assert.strictEqual(parsed.length, 1, 'Must parse 1 question');
assert.strictEqual(parsed[0].correctOptionId, 1, 'Option B (index 1) must be marked correct because of highlight');

console.log('✅ DOCX Highlight test passed perfectly!');
