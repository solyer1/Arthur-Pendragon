import React from 'react';
import TooltipText from './TooltipText';

/**
 * Renders bold markdown (**text**) and italic (*text*) within a string.
 */
function renderInlineMarkdown(text) {
  if (!text) return null;
  // Split by **bold** and *italic* patterns
  const parts = [];
  let remaining = text;
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    if (match[2]) {
      // Bold **text**
      parts.push({ type: 'bold', content: match[2] });
    } else if (match[3]) {
      // Italic *text*
      parts.push({ type: 'italic', content: match[3] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  if (parts.length === 0) return text;

  return parts.map((p, i) => {
    if (p.type === 'bold') return <strong key={i}>{p.content}</strong>;
    if (p.type === 'italic') return <em key={i}>{p.content}</em>;
    return <React.Fragment key={i}>{p.content}</React.Fragment>;
  });
}

/**
 * Wraps inline markdown rendering with TooltipText for [Status] references.
 * Process order: first parse [Status] brackets, then bold/italic within each text segment.
 */
const RichText = ({ text, uniqueStatuses }) => {
  if (!text) return null;

  const statusMap = {};
  (uniqueStatuses || []).forEach(s => {
    statusMap[s.name.toLowerCase()] = { name: s.name, description: s.description };
  });

  // First pass: split by [StatusName]
  const regex = /\[(.*?)\]/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    const term = match[1];
    const termLower = term.toLowerCase();
    if (statusMap[termLower]) {
      segments.push({ type: 'status', term: statusMap[termLower].name, description: statusMap[termLower].description });
    } else {
      segments.push({ type: 'text', content: `[${term}]` });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.substring(lastIndex) });
  }

  // We need the Tooltip component from TooltipText
  // Instead of re-importing, we'll use TooltipText for status and renderInlineMarkdown for text
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'status') {
          // Use TooltipText just for this bracket
          return <TooltipText key={i} text={`[${seg.term}]`} uniqueStatuses={uniqueStatuses} />;
        }
        return <React.Fragment key={i}>{renderInlineMarkdown(seg.content)}</React.Fragment>;
      })}
    </>
  );
};

/**
 * DescriptionList - renders hierarchical description data as Notion-style bullet lists.
 * 
 * Accepts either:
 * - A string (legacy flat format, rendered as pre-wrap text with TooltipText)
 * - An array of items where each item is:
 *   - A string (simple bullet)
 *   - An object { text: "...", children: [...] } (bullet with sub-bullets)
 */
const DescriptionList = ({ description, uniqueStatuses, depth = 0 }) => {
  // Legacy string format — fall back to flat rendering
  if (typeof description === 'string') {
    return (
      <div className="desc-legacy">
        <TooltipText text={description} uniqueStatuses={uniqueStatuses} />
      </div>
    );
  }

  if (!Array.isArray(description) || description.length === 0) return null;

  return (
    <ul className={`desc-list depth-${Math.min(depth, 3)}`}>
      {description.map((item, i) => {
        if (typeof item === 'string') {
          return (
            <li key={i} className="desc-item">
              <RichText text={item} uniqueStatuses={uniqueStatuses} />
            </li>
          );
        }
        if (typeof item === 'object' && item.text) {
          return (
            <li key={i} className="desc-item">
              <RichText text={item.text} uniqueStatuses={uniqueStatuses} />
              {item.children && (
                <DescriptionList description={item.children} uniqueStatuses={uniqueStatuses} depth={depth + 1} />
              )}
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
};

export default DescriptionList;
export { RichText };
