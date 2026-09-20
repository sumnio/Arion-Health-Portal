import test from 'node:test';
import assert from 'node:assert/strict';
import { staffCalendarService, staffActions } from '../src/services/staffCalendarService.js';
import { staffDashboardService } from '../src/services/staffDashboardService.js';
const now = new Date('2026-09-20T02:00:00Z');
const date = '2026-09-20';
test('staff calendar shares dashboard appointments and excludes clinical details', () => {
 const items = staffCalendarService.getDay(date, now);
 assert.deepEqual(items.map(x=>x.id), staffDashboardService.getDashboard(now).appointments.map(x=>x.id));
 assert.ok(items.every(x=>!('diagnosis' in x) && !('prescriptions' in x)));
 assert.equal(staffCalendarService.getDay('2026-09-22',now).length,0);
 assert.deepEqual(staffCalendarService.getDay('2026-09-19',now).map(x=>x.status),['completed','cancelled','no_show']);
});
test('staff mock transitions stay shared and reject terminal or checked-in appointments', () => {
 const items = staffCalendarService.getDay(date,now);
 const pending = items.find(x=>x.status==='pending');
 staffCalendarService.updateStatus(date,pending.id,'confirmed',now);
 assert.equal(staffDashboardService.getDashboard(now).appointments.find(x=>x.id===pending.id).status,'confirmed');
 assert.throws(()=>staffCalendarService.updateStatus(date,pending.id,'confirmed',now));
 staffCalendarService.updateStatus(date,pending.id,'cancelled',now);
 assert.throws(()=>staffCalendarService.updateStatus(date,pending.id,'confirmed',now));
 for(const item of items.filter(x=>x.check_in_at || x.status==='completed')) {
  assert.equal(staffActions(item,date).cancel,false);
  assert.throws(()=>staffCalendarService.updateStatus(date,item.id,'cancelled',now));
 }
 assert.throws(()=>staffCalendarService.updateStatus(date,'missing','confirmed',now));
});
