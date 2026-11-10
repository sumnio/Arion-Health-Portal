export function createAuditLogController({ auditLogService }) {
  return {
    async list(request, response) {
      response.json(await auditLogService.listAuditEvents(request.query));
    },
  };
}
