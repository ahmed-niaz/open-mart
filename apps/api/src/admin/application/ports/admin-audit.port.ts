export const ADMIN_AUDIT_PORT = Symbol('ADMIN_AUDIT_PORT');

export interface AuditLogEntry {
  adminId: string;
  action: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditPort {
  recordLog(entry: AuditLogEntry): Promise<void>;
}
