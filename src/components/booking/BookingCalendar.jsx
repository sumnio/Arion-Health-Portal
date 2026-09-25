import { useState } from 'react';
import { bookingWindow, formatBookingDate } from '../../services/dateTimeService.js';

export default function BookingCalendar({ value, onChange, invalid, doctorId, availableDates = new Set(), loading = false }) {
  const now = new Date();
  const { start: today, end } = bookingWindow(now);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  function shift(amount) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    setMonth(next.toISOString().slice(0, 7));
  }
  return <div className="booking-calendar" role="group" aria-label="Appointment date" aria-invalid={invalid || undefined} aria-describedby={invalid ? 'date-error' : undefined}>
    <div className="calendar-heading"><button type="button" aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => shift(-1)}>‹</button><strong aria-live="polite">{first.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next month" disabled={month >= end.slice(0, 7)} onClick={() => shift(1)}>›</button></div>
    <div className="calendar-grid">
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span className="weekday" key={day}>{day}</span>)}
      {Array.from({ length: first.getUTCDay() }, (_, i) => <span key={'blank-' + i} />)}
      {Array.from({ length: count }, (_, i) => {
        const day = month + '-' + String(i + 1).padStart(2, '0');
        return <button type="button" key={day} disabled={loading || !availableDates.has(day)} aria-label={formatBookingDate(day)} aria-pressed={value === day} aria-current={day === today ? 'date' : undefined} onClick={() => onChange(day)}>{i + 1}</button>;
      })}
    </div>
    <p className="booking-hint">{!doctorId ? 'Select a doctor to enable available dates.' : loading ? 'Loading the doctor’s published availability…' : 'Only dates with available appointments are selectable.'} Booking closes on {formatBookingDate(end)}.</p>
  </div>;
}
