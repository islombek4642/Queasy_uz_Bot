// tgcloud/lib/parsers/math_engine.js
// Mathematical & Chemical Formula Engine: Detection, OMML-to-LaTeX conversion, KaTeX normalization and 300 DPI rendering

/**
 * Detects if a text or snippet contains mathematical/chemical formulas
 * (LaTeX, OMML XML, or standard formula patterns)
 */
export function hasMathFormula(text) {
  if (!text || typeof text !== 'string') return false;

  // 1. Word OMML XML tags
  if (/<m:oMath|<m:f|<m:rad|<m:sSup|<m:sSub/i.test(text)) {
    return true;
  }

  // 2. Explicit LaTeX delimiters
  if (/\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\(|\\\[/i.test(text)) {
    return true;
  }

  // 3. Common LaTeX commands
  const latexCommands = [
    '\\frac', '\\sqrt', '\\sum', '\\int', '\\prod', '\\lim',
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\theta', '\\lambda', '\\pi', '\\omega', '\\sigma',
    '\\pm', '\\mp', '\\times', '\\div', '\\cdot', '\\neq', '\\leq', '\\geq', '\\approx', '\\equiv',
    '\\infty', '\\partial', '\\nabla', '\\to', '\\rightarrow', '\\subset', '\\cup', '\\cap',
    '\\sin', '\\cos', '\\tan', '\\cot', '\\log', '\\ln', '\\exp',
  ];
  for (const cmd of latexCommands) {
    if (text.includes(cmd)) return true;
  }

  // 4. Superscript / subscript math patterns (e.g. x^2, x_1, a^2 + b^2 = c^2)
  if (/[a-zA-Z0-9]\^\{?[0-9a-zA-Z\+\-]+\}?|[a-zA-Z0-9]_\{?[0-9a-zA-Z\+\-]+\}?/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Converts Word OMML XML snippet into clean LaTeX string
 */
export function ommlToLatex(xml) {
  if (!xml || typeof xml !== 'string') return '';

  let res = xml;

  // Helper to extract content of a tag
  const extractInner = (str, tag) => {
    const reg = new RegExp(`<m:${tag}[^>]*>([\\s\\S]*?)<\\/m:${tag}>`, 'gi');
    return reg;
  };

  // 0. N-ary operators (integrals, summations, products): <m:nary>...
  res = res.replace(/<m:nary[^>]*>([\s\S]*?)<\/m:nary>/gi, (_, body) => {
    let op = '\\int';
    const chrMatch = /<m:chr[^>]*m:val="([^"]*)"/i.exec(body);
    if (chrMatch) {
      const val = chrMatch[1];
      if (val === '∑' || val === 'sum') op = '\\sum';
      else if (val === '∏' || val === 'prod') op = '\\prod';
      else if (val === '∬') op = '\\iint';
      else if (val === '∭') op = '\\iiint';
      else if (val === '∮') op = '\\oint';
      else op = '\\int';
    }

    const subMatch = /<m:sub[^>]*>([\s\S]*?)<\/m:sub>/i.exec(body);
    const supMatch = /<m:sup[^>]*>([\s\S]*?)<\/m:sup>/i.exec(body);
    const eMatch = /<m:e[^>]*>([\s\S]*?)<\/m:e>/i.exec(body);

    const sub = subMatch ? cleanOmmlText(subMatch[1]).trim() : '';
    const sup = supMatch ? cleanOmmlText(supMatch[1]).trim() : '';
    const e = eMatch ? cleanOmmlText(eMatch[1]).trim() : '';

    let resOp = op;
    if (sub && sup) {
      resOp = `${op}_{${sub}}^{${sup}}`;
    } else if (sub) {
      resOp = `${op}_{${sub}}`;
    } else if (sup) {
      resOp = `${op}^{${sup}}`;
    }

    return e ? `${resOp} ${e}` : resOp;
  });

  // 1. Fractions: <m:f>...<m:num>...</m:num>...<m:den>...</m:den>...</m:f> -> \frac{num}{den}
  res = res.replace(/<m:f[^>]*>[\s\S]*?<m:num[^>]*>([\s\S]*?)<\/m:num>[\s\S]*?<m:den[^>]*>([\s\S]*?)<\/m:den>[\s\S]*?<\/m:f>/gi, (_, num, den) => {
    return `\\frac{${cleanOmmlText(num)}}{${cleanOmmlText(den)}}`;
  });

  // 2. Radicals: <m:rad>...<m:deg>...</m:deg>...<m:e>...</m:e>...</m:rad> -> \sqrt[deg]{e}
  res = res.replace(/<m:rad[^>]*>[\s\S]*?<m:deg[^>]*>([\s\S]*?)<\/m:deg>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/gi, (_, deg, expr) => {
    const cleanDeg = cleanOmmlText(deg).trim();
    const cleanExpr = cleanOmmlText(expr).trim();
    return cleanDeg ? `\\sqrt[${cleanDeg}]{${cleanExpr}}` : `\\sqrt{${cleanExpr}}`;
  });

  // Simple sqrt without deg
  res = res.replace(/<m:rad[^>]*>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/gi, (_, expr) => {
    return `\\sqrt{${cleanOmmlText(expr).trim()}}`;
  });

  // 3. Superscript & Subscript combo: <m:sSubSup>...<m:e>...</m:e>...<m:sub>...</m:sub>...<m:sup>...</m:sup>
  res = res.replace(/<m:sSubSup[^>]*>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<m:sup[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSubSup>/gi, (_, e, sub, sup) => {
    return `{${cleanOmmlText(e)}}_{${cleanOmmlText(sub)}}^{${cleanOmmlText(sup)}}`;
  });

  // 4. Superscript: <m:sSup>...<m:e>...</m:e>...<m:sup>...</m:sup>
  res = res.replace(/<m:sSup[^>]*>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sup[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSup>/gi, (_, e, sup) => {
    return `{${cleanOmmlText(e)}}^{${cleanOmmlText(sup)}}`;
  });

  // 5. Subscript: <m:sSub>...<m:e>...</m:e>...<m:sub>...</m:sub>
  res = res.replace(/<m:sSub[^>]*>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<\/m:sSub>/gi, (_, e, sub) => {
    return `{${cleanOmmlText(e)}}_{${cleanOmmlText(sub)}}`;
  });

  // 6. Delimiters: <m:d>...<m:e>...</m:e>
  res = res.replace(/<m:d[^>]*>[\s\S]*?<m:e[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:d>/gi, (_, e) => {
    return `\\left(${cleanOmmlText(e)}\\right)`;
  });

  // 7. Text tags: <m:t>...</m:t>
  res = res.replace(/<m:t[^>]*>([\s\S]*?)<\/m:t>/gi, '$1');

  // Strip remaining tags
  res = res.replace(/<[^>]+>/g, ' ');

  // Clean extra spaces
  return res.replace(/\s+/g, ' ').trim();
}

function cleanOmmlText(str) {
  if (!str) return '';
  return str
    .replace(/<m:t[^>]*>([\s\S]*?)<\/m:t>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Normalizes formula string to KaTeX compatible LaTeX
 */
export function normalizeLatex(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let s = raw.trim();

  // Strip surrounding $$ or $
  if (s.startsWith('$$') && s.endsWith('$$')) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('$') && s.endsWith('$') && s.length > 2) {
    s = s.slice(1, -1).trim();
  } else if (s.startsWith('\\(') && s.endsWith('\\)')) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('\\[') && s.endsWith('\\]')) {
    s = s.slice(2, -2).trim();
  }

  // Replace common unicode math symbols with standard LaTeX commands
  const symbolMap = {
    '×': ' \\times ',
    '÷': ' \\div ',
    '±': ' \\pm ',
    '≠': ' \\neq ',
    '≤': ' \\leq ',
    '≥': ' \\geq ',
    '≈': ' \\approx ',
    '∞': ' \\infty ',
    '√': ' \\sqrt ',
    '·': ' \\cdot ',
    'α': ' \\alpha ',
    'β': ' \\beta ',
    'γ': ' \\gamma ',
    'π': ' \\pi ',
    'θ': ' \\theta ',
    'λ': ' \\lambda ',
    'Δ': ' \\Delta ',
  };

  for (const [sym, rep] of Object.entries(symbolMap)) {
    s = s.replaceAll(sym, rep);
  }

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Formats mixed text and math into valid renderable LaTeX for CodeCogs
 */
export function formatLatexForRender(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();

  // If text contains $...$ or $$...$$ delimiters, wrap normal text in \text{...}
  if (s.includes('$')) {
    const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    const converted = parts.map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return normalizeLatex(part.slice(2, -2));
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return normalizeLatex(part.slice(1, -1));
      } else {
        const trimmed = part.trim();
        if (!trimmed) return '';
        // Escape special latex characters in text: \, %, _, &, #, {, }
        const escaped = part
          .replace(/\\/g, '\\textbackslash ')
          .replace(/([%_&#{}])/g, '\\$1');
        return `\\text{${escaped}}`;
      }
    }).filter(Boolean);

    return converted.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Pure formula without delimiters
  return normalizeLatex(s);
}

/**
 * Generates high-resolution 300 DPI PNG image URL using CodeCogs LaTeX service
 */
export function generateLatexImageUrl(latex, dpi = 300) {
  const clean = formatLatexForRender(latex);
  // CodeCogs high-res PNG URL with white background and crisp rendering
  const formulaEncoded = encodeURIComponent(clean);
  return `https://latex.codecogs.com/png.image?\\dpi{${dpi}}\\bg{white}${formulaEncoded}`;
}

/**
 * Renders formula and uploads it to Telegram Media Channel (CDN)
 * Returns the Telegram file_id (or falls back to high-res image URL)
 */
export async function renderAndUploadFormula({ api, mediaChannelId, latexFormula, caption = null }) {
  if (!latexFormula) return null;

  const imageUrl = generateLatexImageUrl(latexFormula, 300);

  if (!mediaChannelId || !api) {
    // Media channel not configured, return direct high-res URL
    return imageUrl;
  }

  try {
    const sent = await api.sendPhoto({
      chat_id: mediaChannelId,
      photo: imageUrl,
      caption: caption ? String(caption).slice(0, 1024) : undefined,
    });

    if (sent && sent.photo && sent.photo.length > 0) {
      // Pick highest resolution photo file_id
      const bestPhoto = sent.photo[sent.photo.length - 1];
      return bestPhoto.file_id;
    }
  } catch (err) {
    console.error('[renderAndUploadFormula] Failed to upload to media channel:', err?.message);
  }

  // Fallback to direct image URL if upload failed
  return imageUrl;
}

export default {
  hasMathFormula,
  ommlToLatex,
  normalizeLatex,
  formatLatexForRender,
  generateLatexImageUrl,
  renderAndUploadFormula,
};
