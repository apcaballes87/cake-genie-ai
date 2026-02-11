'use client';

import React from 'react';

interface BlogContentProps {
  content: string;
}

function parseMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // Bold + italic combined
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br/>');

  // Ordered lists
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<li data-ordered="true">$2</li>'
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive ordered list items
  html = html.replace(
    /(<li data-ordered="true">[\s\S]*?<\/li>)(?=\n(?!<li data-ordered)|\n*$)/g,
    (match) => {
      return match;
    }
  );

  // Tables
  html = html.replace(
    /^\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/gm,
    (_, header, body) => {
      const headerCells = header
        .split('|')
        .map((c: string) => c.trim())
        .filter(Boolean);
      const rows = body
        .trim()
        .split('\n')
        .map((row: string) =>
          row
            .split('|')
            .map((c: string) => c.trim())
            .filter(Boolean)
        );

      let table = '<div class="table-wrapper"><table><thead><tr>';
      headerCells.forEach((cell: string) => {
        table += `<th>${cell}</th>`;
      });
      table += '</tr></thead><tbody>';
      rows.forEach((row: string[]) => {
        table += '<tr>';
        row.forEach((cell: string) => {
          table += `<td>${cell}</td>`;
        });
        table += '</tr>';
      });
      table += '</tbody></table></div>';
      return table;
    }
  );

  // Paragraphs - wrap remaining text blocks
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('<li data-ordered="true">')) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(line.replace(' data-ordered="true"', ''));
    } else if (line.startsWith('<li>')) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(line);
    } else {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }

      if (
        line === '' ||
        line.startsWith('<h') ||
        line.startsWith('<hr') ||
        line.startsWith('<blockquote') ||
        line.startsWith('<div') ||
        line.startsWith('<table') ||
        line.startsWith('<ol') ||
        line.startsWith('<ul')
      ) {
        result.push(line);
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }
  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  // Remove empty paragraphs
  return result
    .join('\n')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>\s*<\/p>/g, '');
}

export function BlogContent({ content }: BlogContentProps) {
  const html = parseMarkdownToHtml(content);

  return (
    <div
      className="blog-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
