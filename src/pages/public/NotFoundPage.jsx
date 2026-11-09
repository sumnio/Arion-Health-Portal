import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <section className="not-found-page" aria-labelledby="not-found-title">
    <h1 id="not-found-title">Page not found</h1>
    <Link className="public-button primary" to="/">Back Home</Link>
  </section>;
}
