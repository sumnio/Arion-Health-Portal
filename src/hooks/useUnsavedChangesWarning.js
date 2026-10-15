import { useEffect } from 'react';

const UNSAVED_CHANGES_MESSAGE = 'You have unsaved certificate changes. Leave without issuing?';

export default function useUnsavedChangesWarning(active) {
  useEffect(() => {
    if (!active) return undefined;

    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const confirmLinkNavigation = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', confirmLinkNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', confirmLinkNavigation, true);
    };
  }, [active]);
}

export { UNSAVED_CHANGES_MESSAGE };
