// src/components/quiz/MathText.jsx
import React, { useMemo } from 'react';
import katex from 'katex';

export function MathText({ text = '', className = '', style = {} }) {
  const renderedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return '';

    // Check if contains math indicators ($...$ or $$...$$ or LaTeX tags)
    if (!text.includes('$') && !text.includes('\\')) {
      return text;
    }

    // Split text by $...$ math blocks
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$.+?\$)/g);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
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
