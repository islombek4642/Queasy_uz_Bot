// src/components/quiz/MathText.jsx
import React, { useMemo } from 'react';
import katex from 'katex';

export function MathText({ text = '', className = '', style = {} }) {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return '';

    // Sanitize text: decode HTML entities, strip broken img tags, normalize double backslashes
    const cleanText = text
      .replace(/&lt;img[\s\S]*?&gt;/gi, '')
      .replace(/<img[\s\S]*?>/gi, '')
      .replaceAll('&apos;', "'")
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&#34;', '"')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&laquo;', '«')
      .replaceAll('&raquo;', '»')
      .replaceAll('&ndash;', '-')
      .replaceAll('&mdash;', '-')
      .replace(/\\\\([a-zA-Z])/g, '\\$1')
      .trim();

    // Auto-wrap raw LaTeX if not wrapped in $ (e.g. \frac{1}{2}, \sqrt{x}, \int...)
    let preparedText = cleanText;
    if (!preparedText.includes('$') && /\\(frac|sqrt|int|sum|prod|alpha|beta|gamma|partial|infty|pm|times|div)/.test(preparedText)) {
      preparedText = `$${preparedText}$`;
    }

    // Normalize negative sign right before dollar: "- $..." -> "$-..."
    preparedText = preparedText.replace(/(^|\s)-\s*\$([^\$]+)\$/g, '$1$- $2$');

    // Split text by $$...$$ or $...$ math blocks
    const parts = preparedText.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
          return (
            <div
              key={index}
              style={{ margin: '8px 0', overflowX: 'auto', textAlign: 'center' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                margin: '0 2px',
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  }, [text]);

  return (
    <span className={className} style={{ wordBreak: 'break-word', ...style }}>
      {renderedContent}
    </span>
  );
}
