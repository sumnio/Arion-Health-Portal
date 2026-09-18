const options = { timeZone: 'Asia/Manila' };
export default function DateTile({ value }) {
  const date = new Date(value);
  return <time className="dashboard-date" dateTime={value} aria-label={date.toLocaleDateString('en-US', { ...options, dateStyle: 'long' })}>
    <span>{date.toLocaleDateString('en-US', { ...options, month: 'short' })}</span>
    <strong>{date.toLocaleDateString('en-US', { ...options, day: '2-digit' })}</strong>
    <span>{date.toLocaleDateString('en-US', { ...options, year: 'numeric' })}</span>
  </time>;
}

