import { useId } from 'react';

export default function RecordSection({ title, children }) {
  const id = useId();
  return <section className="record-card" aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}
