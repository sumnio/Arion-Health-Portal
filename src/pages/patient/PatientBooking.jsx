import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import BookingStep from '../../components/booking/BookingStep.jsx';
import BookingCalendar from '../../components/booking/BookingCalendar.jsx';
import { bookingService, formatBookingDate, formatSlot, slotRange } from '../../services/bookingService.js';
import '../../styles/patient-booking.css';

export default function PatientBooking() {
  const [values, setValues] = useState({ service: '', doctor: '', date: '', time: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const errorRef = useRef(null);
  const { services, doctors } = bookingService.getOptions();
  const slots = bookingService.getSlots(values.doctor, values.date);
  const doctor = doctors.find(item => item.id === values.doctor);
  const service = services.find(item => item.id === values.service);
  function update(field, value) {
    setValues(current => ({ ...current, [field]: value, ...(['doctor', 'date'].includes(field) ? { time: '' } : {}), ...(field === 'doctor' ? { date: '' } : {}) }));
    setErrors({});
  }
  function submit(event) {
    event.preventDefault();
    const result = bookingService.confirm(values);
    if (result.errors) {
      setErrors(result.errors);
      requestAnimationFrame(() => errorRef.current?.focus());
    } else {
      setConfirmation(result.confirmation);
      requestAnimationFrame(() => document.getElementById('booking-success')?.focus());
    }
  }
  const error = field => errors[field] && <p className="booking-error" id={field + '-error'}>{errors[field]}</p>;
  if (confirmation) return <div className="patient-booking">
    <section className="booking-card booking-success rounded-xl border bg-white p-6" aria-labelledby="booking-success">
      <span className="success-check" aria-hidden="true">✓</span>
      <h1 id="booking-success" tabIndex="-1">Mock appointment confirmed</h1>
      <p>Your selected slot is reserved for this preview session only. No real appointment was created; reloading clears the reservation.</p>
      <StatusBadge status={confirmation.status} />
      <dl><div><dt>Service</dt><dd>{confirmation.service}</dd></div><div><dt>Doctor</dt><dd>{confirmation.doctor}</dd></div><div><dt>Date</dt><dd>{formatBookingDate(confirmation.date)}</dd></div><div><dt>Time</dt><dd>{slotRange(confirmation.time)} · Philippine time</dd></div><div><dt>Reason</dt><dd>{confirmation.reason}</dd></div></dl>
      <div className="booking-success-actions"><Link className="action-link booking-primary" to="/patient/appointments">View My Appointments</Link><Link className="action-link" to="/patient/dashboard">Back to Dashboard</Link></div>
    </section>
  </div>;
  return <div className="patient-booking">
    <Link className="booking-back" to="/patient/dashboard">← Back to Dashboard</Link>
    <form className="booking-layout" onSubmit={submit} noValidate>
      <div className="booking-main">
        <header className="booking-intro"><div><h1>Book Appointment</h1><p>Schedule a consultation with your healthcare provider.</p><p>Choose a service, doctor, date, and time for your next visit.</p></div><span aria-hidden="true"><DashboardIcon name="calendar" /></span></header>
        <p className="booking-notice">Routine consultations only. Emergency visits cannot be booked here.</p>
        {Object.keys(errors).length > 0 && <div className="booking-errors" role="alert" tabIndex="-1" ref={errorRef}><strong>Please complete your appointment details.</strong><ul>{Object.entries(errors).map(([field, message]) => <li key={field}>{message}</li>)}</ul></div>}
        <div className="booking-steps">
          <BookingStep number="1" title="Select Visit Type or Service" description="Choose the type of consultation you need.">
            <FormField label="Visit type / service" name="booking-service" value={values.service} onChange={e => update('service', e.target.value)} required aria-invalid={!!errors.service} aria-describedby={errors.service ? 'service-error' : undefined}><option value="">Select a service</option>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormField>{error('service')}
          </BookingStep>
          <BookingStep number="2" title="Select Doctor" description="Choose your preferred doctor.">
            <FormField label="Doctor" name="booking-doctor" value={values.doctor} onChange={e => update('doctor', e.target.value)} required aria-invalid={!!errors.doctor} aria-describedby={errors.doctor ? 'doctor-error' : undefined}><option value="">Select a doctor</option>{doctors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormField>{doctor && <p className="booking-hint">{doctor.specialty}</p>}{error('doctor')}
          </BookingStep>
          <BookingStep number="3" title="Select Date" description="Choose an available date from today through the next 60 days.">
            <BookingCalendar value={values.date} doctorId={values.doctor} onChange={date => update('date', date)} invalid={!!errors.date} />{error('date')}
          </BookingStep>
          <BookingStep number="4" title="Select Time Slot" description="Fixed 30-minute slots · Philippine time.">
            <fieldset className="booking-slots" aria-describedby={errors.time ? 'time-error' : 'slot-help'}><legend className="booking-sr-only">Available appointment time</legend>
              {slots.map(slot => <label key={slot.time} className={'booking-slot' + (!slot.available ? ' unavailable' : '')}><input type="radio" name="booking-time" value={slot.time} disabled={!slot.available} checked={values.time === slot.time} onChange={() => update('time', slot.time)} /><span>{formatSlot(slot.time)}{!slot.available && <small>Unavailable</small>}</span></label>)}
            </fieldset>
            <p className="booking-hint" id="slot-help" aria-live="polite">{!values.doctor || !values.date ? 'Select a doctor and date to see available times.' : !slots.some(slot => slot.available) ? 'No available slots on this date. Please choose another date.' : 'Unavailable slots cannot be selected. One patient per doctor per slot.'}</p>{error('time')}
          </BookingStep>
          <BookingStep number="5" title="Reason for Visit" description="Briefly describe the reason for your consultation." className="booking-reason">
            <label className="booking-sr-only" htmlFor="booking-reason">Reason for visit</label><textarea id="booking-reason" name="reason" rows="3" placeholder="e.g. Routine check-up or follow-up consultation" value={values.reason} onChange={e => update('reason', e.target.value)} required aria-invalid={!!errors.reason} aria-describedby={errors.reason ? 'reason-error' : undefined} />{error('reason')}
          </BookingStep>
        </div>
      </div>
      <aside className="booking-summary booking-card rounded-xl border bg-white p-6" aria-labelledby="booking-summary-title">
        <h2 id="booking-summary-title">Booking Summary</h2><p>Please review your appointment details before confirming.</p>
        <dl>
          <div><dt><DashboardIcon name="record" />Service</dt><dd>{service?.name ?? 'Not selected'}</dd></div>
          <div><dt><DashboardIcon name="profile" />Doctor</dt><dd>{doctor?.name ?? 'Not selected'}</dd></div>
          <div><dt><DashboardIcon name="calendar" />Date</dt><dd>{formatBookingDate(values.date)}</dd></div>
          <div><dt><DashboardIcon name="clock" />Time</dt><dd>{values.time ? slotRange(values.time) : 'Not selected'}<small>Philippine time</small></dd></div>
          <div><dt><DashboardIcon name="location" />Location</dt><dd>Arion Health Clinic</dd></div>
          <div><dt>Reason for visit</dt><dd>{values.reason.trim() || 'Not provided'}</dd></div>
        </dl>
        <p className="booking-mock-note">Mock booking only. No information is sent to a clinic or saved to a database.</p>
        <button className="action-link booking-primary" type="submit">Confirm Appointment</button>
        <Link className="action-link booking-cancel" to="/patient/dashboard">Cancel</Link>
      </aside>
    </form>
  </div>;
}
