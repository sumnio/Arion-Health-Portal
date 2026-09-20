import { staffDashboardService } from './staffDashboardService.js';
import { clinicToday } from './bookingService.js';
import { setStaffCheckIn, setStaffAppointmentStatus } from '../mocks/staffAppointmentStore.js';

export function queueActions(item, now = new Date()) {
  const today = item?.appointment_at?.slice(0, 10) === clinicToday(now);
  const active = today && ['pending', 'confirmed'].includes(item?.status);
  return {
    checkIn: Boolean(active && !item.check_in_at),
    complete: Boolean(active && item.check_in_at),
    noShow: Boolean(active && !item.check_in_at && new Date(item.appointment_at) <= now),
  };
}
export const staffQueueService = {
  getQueue(now = new Date()) {
    const data = staffDashboardService.getDashboard(now);
    return { ...data,
      notCheckedIn: data.appointments.filter(item => !item.check_in_at && ['pending', 'confirmed'].includes(item.status)),
      finished: data.appointments.filter(item => ['completed', 'cancelled', 'no_show'].includes(item.status)),
    };
  },
  act(id, action, now = new Date()) {
    const item = this.getQueue(now).appointments.find(item => item.id === id);
    if (!item || !['checkIn', 'complete', 'noShow'].includes(action) || !queueActions(item, now)[action]) {
      throw new Error('This appointment is no longer eligible for that action. Refresh your selection.');
    }
    if (action === 'checkIn') setStaffCheckIn(item, now.toISOString());
    else setStaffAppointmentStatus(item, action === 'complete' ? 'completed' : 'no_show');
  },
};
