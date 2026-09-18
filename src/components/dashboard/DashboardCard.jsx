import { useId } from 'react';
import { Link } from 'react-router-dom';

export default function DashboardCard({ title, viewAllTo, children, viewAllLabel }) {
  const id = useId();
  return <section className="dashboard-card rounded-xl border bg-white p-6" aria-labelledby={id}>
    <header className="dashboard-card-heading"><h2 id={id}>{title}</h2>
      <Link to={viewAllTo} aria-label={viewAllLabel ?? ('View all ' + (title === 'Next Appointment' ? 'appointments' : 'medical records'))}>{viewAllLabel ?? 'View All'}</Link>
    </header>
    {children}
  </section>;
}

