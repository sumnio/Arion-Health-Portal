import { routeGroups } from './routes.js';
import { portalService } from '../services/portalService.js';

export function getPageLinks(path) {
  const role = path.split('/')[1];
  // Contextual placeholders make every approved detail route reachable without list UI.
  return routeGroups[role].filter(route => route.path !== path).map(route => ({
    to: portalService.getExamplePath(route.path),
    label: route.title + (route.path.includes(':id') ? ' (mock example)' : ''),
  }));
}

