import { expect } from '@playwright/test';

export function observeBrowser(page, { allowedStatuses = [] } = {}) {
  const pageErrors = [];
  const consoleErrors = [];
  const serverErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', response => {
    if (response.status() >= 500 && !allowedStatuses.includes(response.status())) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  return () => {
    expect(pageErrors, 'uncaught browser errors').toEqual([]);
    expect(consoleErrors, 'unexpected browser console errors').toEqual([]);
    expect(serverErrors, 'unexpected API/server failures').toEqual([]);
  };
}
