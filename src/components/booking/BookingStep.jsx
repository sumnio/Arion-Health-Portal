export default function BookingStep({ number, title, description, children, className = '' }) {
  return <section className={'booking-card booking-step rounded-xl border bg-white p-6 ' + className}>
    <header><span className="step-number" aria-hidden="true">{number}</span><div><h2>{title}</h2><p>{description}</p></div></header>
    {children}
  </section>;
}

