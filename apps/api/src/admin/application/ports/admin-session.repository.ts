export const ADMIN_SESSION_REPOSITORY = Symbol('ADMIN_SESSION_REPOSITORY');

export interface CreateSessionDto {
  adminId: string;
  tokenHash: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

export interface AdminSessionRecord {
  id: string;
  adminId: string;
  tokenHash: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AdminSessionRepositoryPort {
  create(dto: CreateSessionDto): Promise<AdminSessionRecord>;
  findByTokenHash(hash: string): Promise<AdminSessionRecord | null>;
  revokeByTokenHash(hash: string): Promise<void>;
  revokeAllByAdminId(adminId: string): Promise<void>;
}
