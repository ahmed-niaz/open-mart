import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { count } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminUsersSchema } from '../../../shared/infrastructure/database/postgres/schema/admin.schema.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../../shared/application/ports/password-hasher.port.js';

@Injectable()
export class InitialAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminSeeder.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedInitialSuperAdmin();
  }

  async seedInitialSuperAdmin(): Promise<void> {
    try {
      // Rule: Table-Empty check strictly (COUNT === 0)
      const result = await this.db
        .select({ total: count() })
        .from(adminUsersSchema);

      const total = Number(result[0]?.total ?? 0);
      if (total > 0) {
        return;
      }

      this.logger.log(
        'admin_users table is empty. Bootstrapping initial super-admin...',
      );

      const email = (
        this.configService.get<string>('INITIAL_ADMIN_EMAIL') ??
        'admin@openmart.com'
      )
        .trim()
        .toLowerCase();

      const rawPassword =
        this.configService.get<string>('INITIAL_ADMIN_PASSWORD') ??
        'Admin123!@#';

      const firstName =
        this.configService.get<string>('INITIAL_ADMIN_FIRST_NAME') ?? 'Super';

      const lastName =
        this.configService.get<string>('INITIAL_ADMIN_LAST_NAME') ?? 'Admin';

      const passwordHash = await this.passwordHasher.hash(rawPassword);

      const now = new Date();
      await this.db.insert(adminUsersSchema).values({
        id: randomUUID(),
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'super-admin',
        phoneNumber: null,
        avatarUrl: null,
        isActive: true,
        mustChangePassword: false,
        version: 1,
        lastLoginAt: null,
        lastLoginIp: null,
        createdBy: null,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        createdAt: now,
        updatedAt: now,
      });

      this.logger.log(
        `[InitialAdminSeeder] Successfully seeded initial super-admin: ${email}`,
      );
    } catch (error: any) {
      // 23505 is PostgreSQL unique_violation (another replica completed the insert)
      if (error?.code === '23505') {
        this.logger.log(
          '[InitialAdminSeeder] Another replica already seeded the initial super-admin (race handled safely).',
        );
        return;
      }
      this.logger.error(
        '[InitialAdminSeeder] Failed to seed initial super-admin:',
        error,
      );
    }
  }
}
