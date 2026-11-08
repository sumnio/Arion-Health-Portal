import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RescheduleReviewPanel from '../../components/schedule/RescheduleReviewPanel.jsx';
import ScheduleDialog from '../../components/schedule/ScheduleDialog.jsx';
import { affectedCountLabel } from '../../components/schedule/schedulePresentation.js';
import WeeklyScheduleCalendar, { startOfClinicWeek, weekRangeLabel } from '../../components/schedule/WeeklyScheduleCalendar.jsx';
import { clinicDateTimeParts, clinicToday, formatBookingDate, formatSlot, shiftCalendarDate } from '../../services/dateTimeService.js';
import { staffApiErrorMessage, staffApiService, staffPublicationWindow, staffWeekDays } from '../../services/staffApiService.js';
import '../../styles/staff-doctors.css';

const blankRange = { start_time: '09:00', end_time: '12:00' };

function WorkingHoursForm({ draft, setDraft, busy, editing, onSave, onClose, onToggle, onDelete }) {
  return <form className="schedule-dialog-form" onSubmit={onSave}>
    {!editing && <label>Day<select data-autofocus value={draft.day_of_week} onChange={event => setDraft(current => ({ ...current, day_of_week: Number(event.target.value) }))}>{staffWeekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
    <div className="dialog-form-row"><label>Start<input data-autofocus={editing || undefined} type="time" step="1800" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></label><label>End<input type="time" step="1800" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></label></div>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button>{editing && <><button type="button" className="secondary-button" disabled={busy} onClick={onToggle}>{draft.is_active ? 'Disable' : 'Enable'}</button><button type="button" className="danger-button" disabled={busy} onClick={onDelete}>Delete</button></>}<button type="submit" disabled={busy}>{editing ? 'Save Changes' : 'Add Working Hours'}</button></div>
  </form>;
}

function SpecialAvailabilityForm({ draft, setDraft, window, busy, onSave, onClose }) {
  return <form className="schedule-dialog-form" onSubmit={onSave}><label>Date<input data-autofocus type="date" min={window.start} max={window.end} value={draft.availability_date} onChange={event => setDraft(current => ({ ...current, availability_date: event.target.value }))} /></label><div className="dialog-form-row"><label>Start<input type="time" step="1800" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></label><label>End<input type="time" step="1800" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></label></div><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Publish Availability</button></div></form>;
}

function TimeOffForm({ draft, setDraft, busy, onSave, onClose }) {
  return <form className="schedule-dialog-form" onSubmit={onSave}><label>Date<input data-autofocus type="date" value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} /></label><label className="dialog-check"><input type="checkbox" checked={draft.whole_day} onChange={event => setDraft(current => ({ ...current, whole_day: event.target.checked }))} /> Whole day</label>{!draft.whole_day && <div className="dialog-form-row"><label>Start<input type="time" step="1800" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></label><label>End<input type="time" step="1800" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></label></div>}<label>Operational reason<input value={draft.reason} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} /></label><p className="dialog-help">This reason is visible to Staff only and is not shown to Patients.</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>Add Time Off</button></div></form>;
}

function CalendarEventDetails({ event, busy, onClose, onEditWorking, onRemove }) {
  const typeTitle = event.type === 'working' ? 'Working Hours' : event.type === 'special' ? 'Published for booking' : 'Time Off';
  return <div className="calendar-event-details"><dl><div><dt>Date</dt><dd>{event.type === 'working' ? staffWeekDays[event.source.day_of_week] : formatBookingDate(event.date)}</dd></div><div><dt>Time</dt><dd>{event.wholeDay ? 'Whole day' : `${formatSlot(event.start)} – ${formatSlot(event.end)}`}</dd></div><div><dt>Type</dt><dd>{typeTitle}{event.disabled ? ' · Disabled' : ''}</dd></div>{event.type === 'timeoff' && event.source.reason && <div><dt>Operational reason</dt><dd>{event.source.reason}</dd></div>}</dl><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button>{event.type === 'working' ? <button type="button" onClick={onEditWorking}>Edit Working Hours</button> : <button type="button" className="danger-button" disabled={busy} onClick={onRemove}>Remove {typeTitle}</button>}</div></div>;
}

function RescheduleConfirmation({ value, busy, onCancel, onConfirm }) {
  const original = clinicDateTimeParts(value.item.appointment_at);
  const replacement = clinicDateTimeParts(value.appointmentAt);
  return <ScheduleDialog title="Reschedule appointment?" description="Confirm the original and replacement schedule before saving." onClose={onCancel}><div className="reschedule-confirmation"><dl><div><dt>Patient</dt><dd>{value.item.patient.full_name}</dd></div><div><dt>Original schedule</dt><dd>{formatBookingDate(original.date)} · {formatSlot(original.time)}</dd></div><div><dt>New schedule</dt><dd>{formatBookingDate(replacement.date)} · {formatSlot(replacement.time)}</dd></div></dl><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" data-autofocus disabled={busy} onClick={onConfirm}>Confirm Reschedule</button></div></div></ScheduleDialog>;
}

export default function StaffDoctorSchedule() {
  const { id } = useParams(); const publicationWindow = staffPublicationWindow();
  const [state, setState] = useState({ loading: true, doctor: null, schedule: { recurring_availability: [], published_availability: [], blocked_times: [], affected_appointments: [] }, error: '' });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [actionError, setActionError] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfClinicWeek());
  const [dialog, setDialog] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rescheduleConfirmation, setRescheduleConfirmation] = useState(null);
  const [staleSuggestion, setStaleSuggestion] = useState(false);
  const [workingDraft, setWorkingDraft] = useState({ day_of_week: 1, ...blankRange, is_active: true });
  const [specialDraft, setSpecialDraft] = useState({ availability_date: publicationWindow.start, ...blankRange });
  const [timeOffDraft, setTimeOffDraft] = useState({ date: publicationWindow.start, whole_day: false, start_time: '12:00', end_time: '13:00', reason: '' });
  const load = useCallback(async () => {
    setState(old => ({ ...old, loading: true, error: '' }));
    try { const result = await staffApiService.getDoctorSchedule(id); setState({ loading: false, ...result, error: result.doctor ? '' : 'Doctor not found.' }); return result; }
    catch (error) { setState(old => ({ ...old, loading: false, error: staffApiErrorMessage(error, 'Unable to load this Doctor schedule.') })); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function run(action, success) {
    if (busy) return false;
    setBusy(true); setMessage(''); setActionError(''); setStaleSuggestion(false);
    try { await action(); await load(); setMessage(success); return true; }
    catch (error) { setActionError(staffApiErrorMessage(error, 'The schedule change could not be saved.')); return false; }
    finally { setBusy(false); }
  }
  function openAddWorking() { setWorkingDraft({ day_of_week: 1, ...blankRange, is_active: true }); setDialog({ type: 'working-add' }); }
  function openCalendarEvent(event) { setDialog({ type: 'event', event }); }
  function openWorkingEdit(event) { setWorkingDraft({ day_of_week: event.source.day_of_week, start_time: event.source.start_time, end_time: event.source.end_time, is_active: event.source.is_active, id: event.source.id }); setDialog({ type: 'working-edit', event }); }
  async function saveWorking(event) { event.preventDefault(); const editing = dialog.type === 'working-edit'; const success = await run(() => editing ? staffApiService.updateDoctorAvailability(id, workingDraft.id, { start_time: workingDraft.start_time, end_time: workingDraft.end_time }) : staffApiService.createDoctorAvailability(id, { day_of_week: workingDraft.day_of_week, start_time: workingDraft.start_time, end_time: workingDraft.end_time }), editing ? `${staffWeekDays[workingDraft.day_of_week]} hours updated.` : `${staffWeekDays[workingDraft.day_of_week]} time range added.`); if (success) setDialog(null); }
  async function toggleWorking() { const success = await run(() => staffApiService.updateDoctorAvailability(id, workingDraft.id, { is_active: !workingDraft.is_active }), `${staffWeekDays[workingDraft.day_of_week]} hours ${workingDraft.is_active ? 'disabled' : 'enabled'}.`); if (success) setDialog(null); }
  async function deleteWorking() { const success = await run(() => staffApiService.deleteDoctorAvailability(id, workingDraft.id), `${staffWeekDays[workingDraft.day_of_week]} time range deleted.`); if (success) setDialog(null); }
  async function saveSpecial(event) { event.preventDefault(); const success = await run(() => staffApiService.createPublishedAvailability(id, specialDraft), `Availability published for ${formatBookingDate(specialDraft.availability_date)}.`); if (success) setDialog(null); }
  async function saveTimeOff(event) { event.preventDefault(); const success = await run(() => staffApiService.createBlockedTime(id, timeOffDraft), `Time off added for ${formatBookingDate(timeOffDraft.date)}.`); if (success) setDialog(null); }
  async function removeCalendarEvent(event) { const success = await run(() => event.type === 'special' ? staffApiService.deletePublishedAvailability(id, event.source.id) : staffApiService.deleteBlockedTime(id, event.source.id), `${event.type === 'special' ? 'Published availability' : 'Time off'} removed.`); if (success) setDialog(null); }
  function requestReschedule(item, appointmentAt) { setReviewOpen(false); setRescheduleConfirmation({ item, appointmentAt }); }
  async function confirmReschedule() {
    if (!rescheduleConfirmation || busy) return;
    const { item, appointmentAt } = rescheduleConfirmation;
    setBusy(true); setMessage(''); setActionError(''); setStaleSuggestion(false);
    try {
      await staffApiService.rescheduleAffectedAppointment(item.id, appointmentAt);
      const result = await load();
      setRescheduleConfirmation(null);
      setReviewOpen((result?.schedule?.affected_appointments?.length ?? 0) > 0);
      setMessage(`${item.patient.full_name} appointment rescheduled.`);
    } catch (error) {
      const stale = ['APPOINTMENT_SLOT_UNAVAILABLE', 'APPOINTMENT_SLOT_CONFLICT'].includes(error?.code);
      setActionError(stale ? 'That time is no longer available. Please choose another slot.' : staffApiErrorMessage(error, 'Unable to reschedule this appointment.'));
      setStaleSuggestion(stale);
      await load();
      setRescheduleConfirmation(null);
      setReviewOpen(true);
    } finally { setBusy(false); }
  }
  if (state.loading && !state.doctor) return <div className="staff-schedule"><Link to="/staff/doctors">← Back to Doctors</Link><p role="status">Loading schedule…</p></div>;
  if (state.error || !state.doctor) return <div className="staff-schedule"><Link to="/staff/doctors">← Back to Doctors</Link><p role="alert" className="schedule-error">{state.error || 'Doctor not found.'}</p></div>;
  return <div className="staff-schedule">
    <Link className="schedule-back" to="/staff/doctors">← Back to Doctors</Link>
    <div className="schedule-page-header"><div><h1>Doctor Schedule</h1><div className="schedule-doctor"><span className="doctor-avatar" aria-hidden="true">{state.doctor.display_name?.charAt(0) ?? 'D'}</span><div><h2>{state.doctor.display_name}</h2><p>{state.doctor.specialty}</p></div></div></div><nav className="schedule-week-navigation" aria-label="Week navigation"><span className="calendar-view-control">Week</span><div className="week-stepper"><button type="button" aria-label="Previous week" onClick={() => setWeekStart(current => shiftCalendarDate(current, -7))}>‹</button><strong aria-live="polite">{weekRangeLabel(weekStart)}</strong><button type="button" aria-label="Next week" onClick={() => setWeekStart(current => shiftCalendarDate(current, 7))}>›</button></div><button type="button" className="today-button" onClick={() => setWeekStart(startOfClinicWeek(clinicToday()))}>Today</button></nav></div>
    {message && <p role="status" className="schedule-success">{message}</p>}{actionError && <div className="schedule-error-row"><p role="alert" className="schedule-error">{actionError}</p>{staleSuggestion && <button type="button" className="secondary-button" onClick={async () => { await load(); setReviewOpen(true); }}>Reload suggestions</button>}</div>}
    <section className="schedule-calendar-panel"><div className="schedule-primary-actions"><button type="button" onClick={openAddWorking}><span aria-hidden="true">▣</span> Add Working Hours</button><button type="button" className="secondary-button special-action" onClick={() => { setSpecialDraft({ availability_date: publicationWindow.start, ...blankRange }); setDialog({ type: 'special-add' }); }}><span aria-hidden="true">★</span> Publish Availability</button><button type="button" className="secondary-button" onClick={() => { setTimeOffDraft({ date: publicationWindow.start, whole_day: false, start_time: '12:00', end_time: '13:00', reason: '' }); setDialog({ type: 'timeoff-add' }); }}><span aria-hidden="true">⊘</span> Add Time Off</button></div><WeeklyScheduleCalendar weekStart={weekStart} schedule={state.schedule} onSelectEvent={openCalendarEvent} /></section>
    {state.schedule.affected_appointments.length ? <section className="reschedule-summary is-warning" aria-labelledby="reschedule-summary-title"><span className="reschedule-summary-icon" aria-hidden="true">!</span><div><h2 id="reschedule-summary-title">{affectedCountLabel(state.schedule.affected_appointments.length)}</h2><p>Some appointments overlap with a Doctor time-off or unavailable period.</p></div><button type="button" aria-label={`Review ${state.schedule.affected_appointments.length} ${state.schedule.affected_appointments.length === 1 ? 'appointment' : 'appointments'} needing rescheduling`} onClick={() => setReviewOpen(true)}>Review Appointments <span aria-hidden="true">→</span></button></section> : <section className="reschedule-summary is-clear" aria-labelledby="reschedule-summary-title"><span className="reschedule-summary-icon" aria-hidden="true">✓</span><div><h2 id="reschedule-summary-title">No appointments need rescheduling</h2><p>All current appointments have no Doctor-unavailability conflict.</p></div></section>}
    <section className="schedule-legend" aria-label="Calendar legend"><h2>Legend</h2><div><span><i className="legend-swatch is-working" /> <strong>Working Hours</strong><small>Recurring hours</small></span><span><i className="legend-swatch is-special" /> <strong>Published for booking</strong><small>Specific booking date</small></span><span><i className="legend-swatch is-timeoff" /> <strong>Time Off</strong><small>Doctor unavailable</small></span></div></section>
    {dialog?.type === 'working-add' && <ScheduleDialog title="Add Working Hours" description="Add a recurring time range to the Doctor’s weekly schedule." onClose={() => setDialog(null)}><WorkingHoursForm draft={workingDraft} setDraft={setWorkingDraft} busy={busy} onSave={saveWorking} onClose={() => setDialog(null)} /></ScheduleDialog>}
    {dialog?.type === 'working-edit' && <ScheduleDialog title="Working Hours" description={`${staffWeekDays[workingDraft.day_of_week]} recurring schedule`} onClose={() => setDialog(null)}><WorkingHoursForm draft={workingDraft} setDraft={setWorkingDraft} busy={busy} editing onSave={saveWorking} onClose={() => setDialog(null)} onToggle={toggleWorking} onDelete={deleteWorking} /></ScheduleDialog>}
    {dialog?.type === 'special-add' && <ScheduleDialog title="Publish Availability" description="Make one specific date and time available for Patient booking." onClose={() => setDialog(null)}><SpecialAvailabilityForm draft={specialDraft} setDraft={setSpecialDraft} window={publicationWindow} busy={busy} onSave={saveSpecial} onClose={() => setDialog(null)} /></ScheduleDialog>}
    {dialog?.type === 'timeoff-add' && <ScheduleDialog title="Add Time Off" description="Mark the Doctor unavailable for a whole day or a specific period." onClose={() => setDialog(null)}><TimeOffForm draft={timeOffDraft} setDraft={setTimeOffDraft} busy={busy} onSave={saveTimeOff} onClose={() => setDialog(null)} /></ScheduleDialog>}
    {dialog?.type === 'event' && <ScheduleDialog title={dialog.event.label} onClose={() => setDialog(null)}><CalendarEventDetails event={dialog.event} busy={busy} onClose={() => setDialog(null)} onEditWorking={() => openWorkingEdit(dialog.event)} onRemove={() => removeCalendarEvent(dialog.event)} /></ScheduleDialog>}
    {reviewOpen && <RescheduleReviewPanel appointments={state.schedule.affected_appointments} busy={busy} onClose={() => setReviewOpen(false)} onRequestReschedule={requestReschedule} />}
    {rescheduleConfirmation && <RescheduleConfirmation value={rescheduleConfirmation} busy={busy} onCancel={() => { setRescheduleConfirmation(null); setReviewOpen(true); }} onConfirm={confirmReschedule} />}
  </div>;
}
