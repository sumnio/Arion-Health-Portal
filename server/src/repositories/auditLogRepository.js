import { AuditLog } from '../models/AuditLog.js';

function escapedSearch(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const auditLogRepository = Object.freeze({
  create(entry) {
    if (AuditLog.db.readyState !== 1) throw new Error('AUDIT_STORAGE_UNAVAILABLE');
    return AuditLog.create(entry);
  },
  async list({ page, limit, filters }) {
    if (AuditLog.db.readyState !== 1) throw new Error('AUDIT_STORAGE_UNAVAILABLE');
    const query = {};
    if (filters.role) query.actor_role = filters.role;
    if (filters.category) query.category = filters.category;
    if (filters.action) query.action = filters.action;
    if (filters.result) query.result = filters.result;
    if (filters.dateFrom || filters.dateTo) {
      query.created_at = {
        ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
      };
    }
    if (filters.searchActor) {
      query.actor_display_name_snapshot = {
        $regex: escapedSearch(filters.searchActor),
        $options: 'i',
      };
    }
    if (filters.searchTarget) {
      const pattern = { $regex: escapedSearch(filters.searchTarget), $options: 'i' };
      query.$or = [{ target_id: pattern }, { target_display_snapshot: pattern }];
    }
    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ created_at: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    return { items, total };
  },
});
