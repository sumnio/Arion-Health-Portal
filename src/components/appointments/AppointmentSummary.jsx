import DateTile from '../dashboard/DateTile.jsx';
import StatusBadge from '../dashboard/StatusBadge.jsx';
import { formatBookingDate } from '../../services/bookingService.js';

export default function AppointmentSummary({ appointment }) {
  return <div className="appointment-summary">
    <DateTile value={appointment.appointment_at} />
    <div><div className="appointment-title"><h2>{appointment.service}</h2><StatusBadge status={appointment.status} /></div>
      <p><strong>{appointment.doctor}</strong><br />{appointment.specialty}</p>
      <p>{formatBookingDate(appointment.date)}<br />{appointment.timeLabel} · Philippine time</p>
      <p>{appointment.location}</p>
    </div>
  </div>;
}
