import { Link, useParams } from 'react-router-dom';
export default function PlaceholderPage({ title, links = [] }) {
  const { id } = useParams();
  return <>
    <header className="page-heading"><p className="eyebrow">Arion Health Portal</p><h1>{title}</h1></header>
    <section className="placeholder rounded-xl border bg-white p-6" aria-label={title + ' placeholder'}>
      <span className="badge">Milestone 1 · Placeholder</span>
      <h2>This page is ready for the next milestone.</h2>
      <p>Navigation is available. Page features will be added in a later milestone.</p>
      {id && <p className="record-id">Reference: {id}</p>}
      {links.length > 0 && <nav className="context-links" aria-label="Related pages">{links.map(({ to, label }) => <Link className="action-link" key={to} to={to}>{label}<span aria-hidden="true"> →</span></Link>)}</nav>}
    </section>
  </>;
}

