import { addDays, appointmentLocalParts, clinicDate, dateOnlyToUtc, zonedDateTimeToUtc } from '../utils/schedulingTime.js';

export const STANDARD_VISIT_REASONS = Object.freeze([
  'General health concern',
  'Fever, cough, or cold symptoms',
  'Headache or dizziness',
  'Stomach pain or digestive concern',
  'Blood pressure concern',
  'Follow-up consultation',
  'Routine health check',
  'Laboratory results discussion',
  'Medical clearance consultation',
  'Other concern',
]);

const STATUS_VALUES = Object.freeze(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const PERIOD_LABELS = Object.freeze({ today: 'Today', week: 'This Week', month: 'This Month' });

function id(value) {
  const result = value?._id ?? value?.id ?? value;
  return result == null ? null : String(result);
}

function nextMonth(date) {
  const value = dateOnlyToUtc(date);
  value.setUTCMonth(value.getUTCMonth() + 1, 1);
  return value.toISOString().slice(0, 10);
}

export function analyticsPeriodRange(period, current, timeZone) {
  const today = clinicDate(current, timeZone);
  let startDate = today;
  let endDate = addDays(today, 1);
  if (period === 'week') {
    const day = dateOnlyToUtc(today).getUTCDay();
    startDate = addDays(today, -((day + 6) % 7));
    endDate = addDays(startDate, 7);
  } else if (period === 'month') {
    startDate = `${today.slice(0, 7)}-01`;
    endDate = nextMonth(startDate);
  }
  return {
    key: period,
    label: PERIOD_LABELS[period],
    start_date: startDate,
    end_date_exclusive: endDate,
    time_zone: timeZone,
    start: zonedDateTimeToUtc(startDate, '00:00', timeZone),
    end: zonedDateTimeToUtc(endDate, '00:00', timeZone),
  };
}

function ageOn(dob, date) {
  const birth = new Date(dob);
  const current = dateOnlyToUtc(date);
  let age = current.getUTCFullYear() - birth.getUTCFullYear();
  if (current.getUTCMonth() < birth.getUTCMonth() || (current.getUTCMonth() === birth.getUTCMonth() && current.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function increment(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }
function counts(map, order = []) {
  const keys = order.length ? [...order, ...[...map.keys()].filter((key) => !order.includes(key)).sort()] : [...map.keys()].sort();
  return keys.map((key) => ({ key, count: map.get(key) ?? 0 }));
}
function peak(map, order = []) {
  if (!map.size) return null;
  const position = (key) => order.includes(key) ? order.indexOf(key) : Number.MAX_SAFE_INTEGER;
  const [key, count] = [...map.entries()].sort((left, right) => right[1] - left[1] || position(left[0]) - position(right[0]) || left[0].localeCompare(right[0]))[0];
  return { key, count };
}

export function createAnalyticsService({ repository, clinic, now = () => new Date() }) {
  return {
    async get(period) {
      const range = analyticsPeriodRange(period, now(), clinic.timeZone);
      const [appointments, doctors] = await Promise.all([
        repository.listAppointmentsBetween(range.start, range.end),
        repository.listDoctors(),
      ]);
      const status = new Map(STATUS_VALUES.map((value) => [value, 0]));
      const visitTypes = new Map();
      const reasons = new Map(STANDARD_VISIT_REASONS.map((value) => [value, 0]));
      const doctorMetrics = new Map();
      const weekday = new Map();
      const timeSlots = new Map();
      const urgentPatientAppointments = new Set();
      const completedSenior = new Set();
      const completedPwd = new Set();
      const completedSeniorPwd = new Set();

      for (const doctor of doctors) {
        const doctorId = id(doctor);
        if (!doctorId || doctor.user_profile_id?.status !== 'active') continue;
        doctorMetrics.set(doctorId, {
          doctor_id: doctorId,
          doctor_name: doctor.user_profile_id?.display_name ?? 'Doctor',
          total_appointments: 0,
          completed: 0,
          cancelled: 0,
          no_show: 0,
          urgent: 0,
          uniquePatients: new Set(),
          servedPatients: new Set(),
        });
      }

      for (const appointment of appointments) {
        increment(status, appointment.status);
        increment(visitTypes, appointment.visit_type);
        increment(reasons, STANDARD_VISIT_REASONS.includes(appointment.reason) ? appointment.reason : 'Other / legacy');
        const local = appointmentLocalParts(appointment.appointment_at, clinic.timeZone);
        const weekdayName = WEEKDAYS[dateOnlyToUtc(local.date).getUTCDay()];
        increment(weekday, weekdayName);
        increment(timeSlots, local.time);

        const doctorId = id(appointment.doctor_id);
        let metric = doctorMetrics.get(doctorId);
        if (!metric) {
          metric = {
            doctor_id: doctorId,
            doctor_name: appointment.doctor_id?.user_profile_id?.display_name ?? 'Unavailable Doctor',
            total_appointments: 0, completed: 0, cancelled: 0, no_show: 0, urgent: 0,
            uniquePatients: new Set(), servedPatients: new Set(),
          };
          doctorMetrics.set(doctorId, metric);
        }
        metric.total_appointments += 1;
        if (appointment.status === 'completed') metric.completed += 1;
        if (appointment.status === 'cancelled') metric.cancelled += 1;
        if (appointment.status === 'no_show') metric.no_show += 1;
        if (appointment.priority === 'urgent') metric.urgent += 1;
        const patientId = id(appointment.patient_id);
        if (patientId) metric.uniquePatients.add(patientId);
        if (appointment.status === 'completed' && patientId) metric.servedPatients.add(patientId);
        if (appointment.priority === 'urgent') urgentPatientAppointments.add(id(appointment));

        if (appointment.status === 'completed' && patientId && appointment.patient_id) {
          const senior = ageOn(appointment.patient_id.dob, local.date) >= 60;
          const pwd = appointment.patient_id.is_pwd === true;
          if (senior) completedSenior.add(patientId);
          if (pwd) completedPwd.add(patientId);
          if (senior || pwd) completedSeniorPwd.add(patientId);
        }
      }

      const workload = [...doctorMetrics.values()].map((item) => ({
        doctor_name: item.doctor_name,
        total_appointments: item.total_appointments,
        unique_patients: item.uniquePatients.size,
        patients_served: item.servedPatients.size,
        completed: item.completed,
        cancelled: item.cancelled,
        no_show: item.no_show,
        urgent: item.urgent,
      })).sort((left, right) => right.total_appointments - left.total_appointments || left.doctor_name.localeCompare(right.doctor_name));

      const summary = Object.fromEntries(STATUS_VALUES.map((value) => [value, status.get(value) ?? 0]));
      return {
        period: {
          key: range.key, label: range.label, start_date: range.start_date,
          end_date_exclusive: range.end_date_exclusive, time_zone: range.time_zone,
        },
        summary: { total_appointments: appointments.length, ...summary },
        doctor_workload: workload,
        status_breakdown: counts(status, STATUS_VALUES),
        visit_types: counts(visitTypes),
        visit_reasons: counts(reasons, [...STANDARD_VISIT_REASONS, 'Other / legacy']),
        urgent: { appointments: urgentPatientAppointments.size },
        senior_pwd: {
          metric: 'unique patients with completed appointments',
          senior: completedSenior.size,
          pwd: completedPwd.size,
          combined: completedSeniorPwd.size,
        },
        busiest_day: peak(weekday, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
        busiest_time: peak(timeSlots),
      };
    },
  };
}
