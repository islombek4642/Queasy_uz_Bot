import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { extractLinesFromDocx } from '../tgcloud/lib/parsers/docx_reader.js';

const CACHE_DIR = path.join(process.cwd(), 'scratch/media_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REQUEST_DELAY_MS = 250; // Serverni asrash uchun 250ms tanaffus

function getImageDimensions(buf) {
  try {
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch {}
  return { width: 300, height: 150 };
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replaceAll('&amp;apos;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;quot;', '"')
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildDocxWithEmbeddedImages(paragraphsWithImages, mediaFiles) {
  let drawingId = 1;
  const pList = [];

  for (const p of paragraphsWithImages) {
    if (!p.runs || p.runs.length === 0) {
      pList.push('<w:p/>');
      continue;
    }

    const rList = [];
    for (const r of p.runs) {
      if (r.type === 'text') {
        if (r.text) {
          rList.push(`<w:r><w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`);
        }
      } else if (r.type === 'image') {
        const docPrId = drawingId++;
        let cx = (r.width || 200) * 9525;
        let cy = (r.height || 100) * 9525;
        const maxCx = 5029200; // max 5.5 inches width
        if (cx > maxCx) {
          const ratio = maxCx / cx;
          cx = maxCx;
          cy = Math.round(cy * ratio);
        }

        const drawingXml = 
          `<w:drawing>` +
            `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
              `<wp:extent cx="${cx}" cy="${cy}"/>` +
              `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
              `<wp:docPr id="${docPrId}" name="Picture ${docPrId}"/>` +
              `<wp:cNvGraphicFramePr>` +
                `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
              `</wp:cNvGraphicFramePr>` +
              `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
                `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                  `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                    `<pic:nvPicPr>` +
                      `<pic:cNvPr id="${docPrId}" name="Picture ${docPrId}"/>` +
                      `<pic:cNvPicPr/>` +
                    `</pic:nvPicPr>` +
                    `<pic:blipFill>` +
                      `<a:blip r:embed="${r.rId}"/>` +
                      `<a:stretch><a:fillRect/></a:stretch>` +
                    `</pic:blipFill>` +
                    `<pic:spPr>` +
                      `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
                      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
                    `</pic:spPr>` +
                  `</pic:pic>` +
                `</a:graphicData>` +
              `</a:graphic>` +
            `</wp:inline>` +
          `</w:drawing>`;

        rList.push(`<w:r>${drawingXml}</w:r>`);
      }
    }
    pList.push(`<w:p>${rList.join('')}</w:p>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>` +
    pList.join('') +
    `</w:body></w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const docRelsList = [];
  for (const m of mediaFiles) {
    docRelsList.push(`<Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.fileName}"/>`);
  }

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    docRelsList.join('') +
    `</Relationships>`;

  const zipFiles = [
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', content: Buffer.from(relsXml, 'utf8') },
    { name: 'word/document.xml', content: Buffer.from(documentXml, 'utf8') },
    { name: 'word/_rels/document.xml.rels', content: Buffer.from(documentRelsXml, 'utf8') },
  ];

  for (const m of mediaFiles) {
    zipFiles.push({ name: `word/media/${m.fileName}`, content: m.buffer });
  }

  const lfhList = [];
  const cdhList = [];
  let offset = 0;

  for (const f of zipFiles) {
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

  const cdhConcat = Buffer.concat(cdhList);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(zipFiles.length, 8);
  eocd.writeUInt16LE(zipFiles.length, 10);
  eocd.writeUInt32LE(cdhConcat.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...lfhList, cdhConcat, eocd]);
}

function getDocXml(buf) {
  let offset = 0;
  while (offset < buf.length - 30) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const fnLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const compSize = buf.readUInt32LE(offset + 18);
    const name = buf.slice(offset + 30, offset + 30 + fnLen).toString('utf8');
    const dataOffset = offset + 30 + fnLen + extraLen;
    if (name === 'word/document.xml') {
      const comp = buf.slice(dataOffset, dataOffset + compSize);
      return zlib.inflateRawSync(comp).toString('utf8');
    }
    offset = dataOffset + compSize;
  }
  return '';
}

function walk(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + f.name;
    if (f.isDirectory()) results = results.concat(walk(full));
    else if (f.name.endsWith('.docx')) results.push(full);
  }
  return results;
}

async function fetchImageWithCache(canonicalRelPath, fileName, tagPath) {
  const cacheKey = crypto.createHash('md5').update(`${canonicalRelPath}_${fileName}`).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.png`);

  if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 100) {
    return fs.readFileSync(cacheFile);
  }

  const urlsToTry = [
    `https://kiut-nm-test.uz/api/media?path=${encodeURIComponent(canonicalRelPath)}&file=${encodeURIComponent(fileName)}`,
  ];
  if (tagPath && tagPath !== canonicalRelPath) {
    urlsToTry.push(`https://kiut-nm-test.uz/api/media?path=${encodeURIComponent(tagPath)}&file=${encodeURIComponent(fileName)}`);
  }

  for (const url of urlsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await sleep(REQUEST_DELAY_MS);
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(10000),
        });

        if (resp.status === 429) {
          console.log('\n      ⚠️ Server 429 berdi, 4 soniya kutilmoqda...');
          await sleep(4000);
          continue;
        }

        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 50) {
            fs.writeFileSync(cacheFile, buf);
            return buf;
          }
        } else if (resp.status === 404) {
          break; // Don't retry 404 on same url, try next url
        }
      } catch (err) {
        if (attempt === 3) break;
        await sleep(1500 * attempt);
      }
    }
  }

  return null;
}

async function main() {
  console.log('===========================================================');
  console.log('🖼️ BARCHA DOCX FAYLLARGA RASMLARNI YUKLAB JOYLASH (EMBEDDING)');
  console.log('===========================================================\n');

  const files = walk('KIUT_TEST');
  console.log(`Barcha tekshirilayotgan docx fayllar: ${files.length} ta`);

  const filesWithImgs = [];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const xml = getDocXml(buf);
    if (xml.includes('/api/media')) {
      filesWithImgs.push(f);
    }
  }

  console.log(`✅ Rasmli fayllar soni: ${filesWithImgs.length} ta\n`);

  const imgRegex = /(?:&lt;|<)img[\s\S]*?src=(?:&quot;|["'])([\s\S]*?)(?:&quot;|["'])[\s\S]*?(?:\/&gt;|\/?>)/i;

  let totalImagesProcessed = 0;
  let totalFilesUpdated = 0;
  let failedImagesCount = 0;

  for (let i = 0; i < filesWithImgs.length; i++) {
    const filePath = filesWithImgs[i];
    const relPath = filePath.replace(/^KIUT_TEST\//, '').replace(/\\/g, '/');

    try {
      const buf = fs.readFileSync(filePath);
      const lines = await extractLinesFromDocx(buf);

      const paragraphs = [];
      const mediaMap = new Map();
      let imgSeq = 1;

      for (const line of lines) {
        if (!line.includes('/api/media')) {
          paragraphs.push({ runs: [{ type: 'text', text: line }] });
          continue;
        }

        const tokens = line.split(/((?:&lt;|<)img[\s\S]*?(?:\/&gt;|\/?>))/i);
        const runs = [];

        for (const tok of tokens) {
          if (!tok) continue;
          const m = tok.match(imgRegex);
          if (m) {
            const rawSrc = m[1].replace(/&amp;/g, '&');
            const fileParamMatch = rawSrc.match(/file=([^&]+)/);
            const fileName = fileParamMatch ? fileParamMatch[1] : `image${imgSeq}.png`;

            const pathParamMatch = rawSrc.match(/path=([^&]+)/);
            const tagPath = pathParamMatch ? decodeURIComponent(pathParamMatch[1]) : null;

            const imgBuf = await fetchImageWithCache(relPath, fileName, tagPath);
            if (imgBuf) {
              const dims = getImageDimensions(imgBuf);
              const rId = `rId${imgSeq + 1}`;
              const mediaFileName = `image_${imgSeq}.png`;
              imgSeq++;
              totalImagesProcessed++;

              mediaMap.set(mediaFileName, {
                rId,
                fileName: mediaFileName,
                buffer: imgBuf,
                width: dims.width,
                height: dims.height,
              });

              runs.push({
                type: 'image',
                rId,
                width: dims.width,
                height: dims.height,
              });
            } else {
              failedImagesCount++;
              runs.push({ type: 'text', text: tok });
            }
          } else {
            runs.push({ type: 'text', text: tok });
          }
        }

        paragraphs.push({ runs });
      }

      if (mediaMap.size > 0) {
        const newDocxBuf = buildDocxWithEmbeddedImages(paragraphs, Array.from(mediaMap.values()));
        fs.writeFileSync(filePath, newDocxBuf);

        // Also update QUIZLARIM if file exists there
        const quizlarimFile = path.join('D:/Serverless/QUIZLARIM/TESTLAR_DOCX', relPath);
        if (fs.existsSync(path.dirname(quizlarimFile))) {
          fs.writeFileSync(quizlarimFile, newDocxBuf);
        }

        totalFilesUpdated++;
      }

      process.stdout.write(`\r[${i + 1}/${filesWithImgs.length}] (${Math.round(((i + 1) / filesWithImgs.length) * 100)}%) ✅ Yangilandi: ${path.basename(relPath).slice(0, 35)}... (${mediaMap.size} rasm)`);
    } catch (err) {
      console.error(`\n❌ Faylni qayta ishlashda xatolik: ${relPath} -> ${err.message}`);
    }
  }

  console.log('\n\n===========================================================');
  console.log('🎉 BARCHA RASMLAR DOCX FAYLLARGA BIRIKTIRILDI!');
  console.log(`   ✅ Yangilangan docx fayllar: ${totalFilesUpdated} / ${filesWithImgs.length}`);
  console.log(`   🖼️ Joylashtirilgan jami rasmlar: ${totalImagesProcessed} ta`);
  console.log(`   ⚠️ Yuklab bo'lmagan rasmlar: ${failedImagesCount} ta`);
  console.log('===========================================================');
}

main().catch(console.error);
