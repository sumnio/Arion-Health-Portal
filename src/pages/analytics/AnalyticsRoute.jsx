import { lazy, Suspense } from 'react';

const ClinicAnalytics = lazy(() => import('./ClinicAnalytics.jsx'));

export default function AnalyticsRoute() {
  return <Suspense fallback={<p role="status">Loading Analytics page…</p>}><ClinicAnalytics /></Suspense>;
}
