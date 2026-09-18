export default function AuthCard({ title, subtitle, children, wide = false }) {
  return <section className={'auth-card' + (wide ? ' auth-card-wide' : '')}>
    <header className="auth-heading"><span className="auth-symbol" aria-hidden="true">✚</span><h1>{title}</h1><p>{subtitle}</p></header>
    {children}
  </section>;
}

