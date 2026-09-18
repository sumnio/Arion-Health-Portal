import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchRoutes } from 'react-router-dom';
import { routeGroups } from '../src/app/routes.js';
import { getPageLinks } from '../src/app/pageLinks.js';
import { portalService } from '../src/services/portalService.js';

const routes = Object.values(routeGroups).flat();
test('route definitions exactly match the approved sitemap', () => {
  const approved = readFileSync(new URL('../SITEMAP.md', import.meta.url), 'utf8')
    .split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('/'));
  assert.deepEqual(routes.map(route => route.path).sort(), approved.sort());
  assert.equal(new Set(routes.map(route => route.path)).size, 27);
});
test('every example and contextual link resolves to the intended approved route', () => {
  for (const route of routes) {
    const path = portalService.getExamplePath(route.path);
    assert.equal(matchRoutes(routes, path)?.at(-1).route.path, route.path);
    if (!routeGroups.public.includes(route)) {
      for (const link of getPageLinks(route.path)) {
        assert.ok(matchRoutes(routes, link.to), link.to);
        assert.ok(link.to.startsWith('/' + route.path.split('/')[1] + '/'));
      }
    }
  }
});
