import { useEffect, useRef } from 'react';

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function ScheduleDialog({ title, description, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    const focusTarget = panel?.querySelector('[data-autofocus]') ?? panel;
    focusTarget?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...panelRef.current.querySelectorAll(focusableSelector)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="schedule-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={panelRef} className="schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" aria-describedby={description ? 'schedule-dialog-description' : undefined} tabIndex={-1} onKeyDown={handleKeyDown}>
      <header><div><h2 id="schedule-dialog-title">{title}</h2>{description && <p id="schedule-dialog-description">{description}</p>}</div><button type="button" className="dialog-close" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>
      {children}
    </section>
  </div>;
}
