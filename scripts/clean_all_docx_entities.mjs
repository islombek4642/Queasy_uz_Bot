import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function unpackZip(buf) {
  let offset = 0;
  const entries = [];
  while (offset < buf.length - 30) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const compMethod = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let content;
    if (compMethod === 0) content = compData;
    else if (compMethod === 8) content = zlib.inflateRawSync(compData);
    else return null;

    entries.push({ name, content });
    offset = dataStart + compSize;
  }
  return entries;
}

function packZip(entries) {
  const lfhList = [];
  const cdhList = [];
  let offset = 0;

  for (const f of entries) {
    const compressed = zlib.deflateRawSync(f.content);
    const crc = zlib.crc32(f.content);
    const nameBuf = Buffer.from(f.name, 'utf8');

    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(8, 8);
    lfh.writeUInt32LE(0, 10);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(f.content.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    lfhList.push(lfh, compressed);

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt32LE(0, 12);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(f.content.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    cdhList.push(cdh);
    offset += lfh.length + compressed.length;
  }

  const cdhTotal = Buffer.concat(cdhList);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdhTotal.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...lfhList, cdhTotal, eocd]);
}

function cleanXmlText(xml) {
  return xml.replace(/(<[wm]:t(?:\s[^>]*)?>)([\s\S]*?)(<\/[wm]:t>)/g, (match, open, text, close) => {
    let clean = text
      .replaceAll('&amp;apos;', "'")
      .replaceAll('&apos;', "'")
      .replaceAll('&#39;', "'")
      .replaceAll('&amp;#39;', "'")
      .replaceAll('&amp;quot;', '"')
      .replaceAll('&quot;', '"')
      .replaceAll('&#34;', '"')
      .replaceAll('&amp;#34;', '"')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;nbsp;', ' ')
      .replaceAll('&laquo;', '«')
      .replaceAll('&raquo;', '»')
      .replaceAll('&ndash;', '-')
      .replaceAll('&mdash;', '-')
      .replaceAll('&amp;amp;', '&')
      // Strip broken HTML tags found in raw crawl texts
      .replace(/&lt;\/?(?:span|div|p|b|i|u|font|br|strong|em)(?:\s[^&]*)?&gt;/gi, '');
    return open + clean + close;
  });
}

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) results = results.concat(walk(full));
    else if (f.name.endsWith('.docx') && !f.name.startsWith('~$')) results.push(full);
  }
  return results;
}

async function main() {
  console.log('===========================================================');
  console.log('🧹 BARCHA DOCX FAYLLARNI HTML ENTITIES VA NOANIQ BELGILARDAN TOZALASH');
  console.log('===========================================================\n');

  const baseDir = path.resolve('KIUT_TEST');
  const allDocx = walk(baseDir);
  console.log(`🔍 Jami topilgan docx fayllar: ${allDocx.length} ta\n`);

  let cleanedFilesCount = 0;
  let skippedCleanCount = 0;
  let errorsCount = 0;

  for (let i = 0; i < allDocx.length; i++) {
    const filePath = allDocx[i];
    const relPath = filePath.replace(baseDir + path.sep, '').replace(/\\/g, '/');

    try {
      const originalBuf = fs.readFileSync(filePath);
      const entries = unpackZip(originalBuf);
      if (!entries) {
        skippedCleanCount++;
        continue;
      }

      let fileModified = false;
      for (const entry of entries) {
        if (entry.name === 'word/document.xml') {
          const docXml = entry.content.toString('utf8');
          if (
            docXml.includes('&apos;') ||
            docXml.includes('&quot;') ||
            docXml.includes('&#39;') ||
            docXml.includes('&#34;') ||
            docXml.includes('&amp;amp;') ||
            docXml.includes('&nbsp;') ||
            docXml.includes('&lt;span') ||
            docXml.includes('&lt;br') ||
            docXml.includes('&lt;font')
          ) {
            const cleanedXml = cleanXmlText(docXml);
            if (cleanedXml !== docXml) {
              entry.content = Buffer.from(cleanedXml, 'utf8');
              fileModified = true;
            }
          }
        }
      }

      if (fileModified) {
        const newDocxBuf = packZip(entries);
        fs.writeFileSync(filePath, newDocxBuf);

        // Also update QUIZLARIM/TESTLAR_DOCX if it exists
        const quizlarimPath = path.join('D:/Serverless/QUIZLARIM/TESTLAR_DOCX', relPath);
        if (fs.existsSync(path.dirname(quizlarimPath))) {
          fs.writeFileSync(quizlarimPath, newDocxBuf);
        }

        cleanedFilesCount++;
      } else {
        skippedCleanCount++;
      }

      if ((i + 1) % 100 === 0 || i === allDocx.length - 1) {
        process.stdout.write(`\r   ├── ${i + 1} / ${allDocx.length} fayl tekshirildi (${cleanedFilesCount} ta tozalandi)...\r`);
      }
    } catch (err) {
      errorsCount++;
      console.error(`\n❌ Xato faylda: ${relPath} -> ${err.message}`);
    }
  }

  console.log('\n\n===========================================================');
  console.log('🎉 BARCHA DOCX FAYLLAR TOZALANDI!');
  console.log(`   ✅ Tozalangan fayllar: ${cleanedFilesCount} ta`);
  console.log(`   ⚡ Allaqachon toza bo'lganlar: ${skippedCleanCount} ta`);
  console.log(`   ⚠️ Xatoliklar: ${errorsCount} ta`);
  console.log('===========================================================');
}

main().catch(console.error);
