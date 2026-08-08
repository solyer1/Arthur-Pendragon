import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DescriptionList from './DescriptionList';

/* ===== Single Tooltip Popover ===== */
const Tooltip = ({ term, description, children, uniqueStatuses }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState('top');
  const ref = useRef(null);

  useEffect(() => {
    if (isVisible && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.top < 250) setPos('bottom');
      else setPos('top');
    }
  }, [isVisible]);

  const tooltipStyle = pos === 'top'
    ? { bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' }
    : { top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="status-ref">{children}</span>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: pos === 'top' ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos === 'top' ? 6 : -6, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="tooltip-card"
            style={{ ...tooltipStyle, pointerEvents: 'none' }}
          >
            <div className="tooltip-title">
              <span>✦</span> {term}
            </div>
            <div className="tooltip-body">
              <DescriptionList description={description} uniqueStatuses={uniqueStatuses} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

/* ===== Parse text and replace [Status] with tooltips ===== */
const TooltipText = ({ text, uniqueStatuses }) => {
  if (!text) return null;

  const statusMap = {};
  (uniqueStatuses || []).forEach(s => {
    statusMap[s.name.toLowerCase()] = { name: s.name, description: s.description };
  });

  const regex = /\[(.*?)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    const term = match[1];
    const termLower = term.toLowerCase();
    if (statusMap[termLower]) {
      parts.push({ type: 'tooltip', term: statusMap[termLower].name, description: statusMap[termLower].description });
    } else {
      parts.push({ type: 'text', content: `[${term}]` });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'tooltip' ? (
          <Tooltip key={i} term={part.term} description={part.description} uniqueStatuses={uniqueStatuses}>
            [{part.term}]
          </Tooltip>
        ) : (
          <React.Fragment key={i}>{part.content}</React.Fragment>
        )
      )}
    </>
  );
};

export default TooltipText;
