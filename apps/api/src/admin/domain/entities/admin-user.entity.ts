import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { AdminId } from '../value-objects/admin-id.vo.js';
import { AdminEmail } from '../value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../value-objects/admin-password-hash.vo.js';
import { AdminCreatedEvent } from '../events/admin-created.event.js';
import { AdminRoleChangedEvent } from '../events/admin-role-changed.event.js';
import { AdminDeactivatedEvent } from '../events/admin-deactivated.event.js';
import { AdminActivatedEvent } from '../events/admin-activated.event.js';
import { AdminDomainException } from '../exceptions/admin-domain.exception.js';

export interface AdminUserProps {
  id: AdminId;
  email: AdminEmail;
  passwordHash: AdminPasswordHash;
  firstName: string;
  lastName: string;
  role: AdminRoleVO;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  version: number;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdBy: AdminId | null;
  deactivatedAt: Date | null;
  deactivatedBy: AdminId | null;
  deactivationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserProps {
  email: AdminEmail;
  passwordHash: AdminPasswordHash;
  firstName: string;
  lastName: string;
  role: AdminRoleVO;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
  createdBy?: AdminId | null;
}

export interface UpdateAdminProfileProps {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
}

export class AdminUser extends AggregateRoot {
  private _id: AdminId;
  private _email: AdminEmail;
  private _passwordHash: AdminPasswordHash;
  private _firstName: string;
  private _lastName: string;
  private _role: AdminRoleVO;
  private _phoneNumber: string | null;
  private _avatarUrl: string | null;
  private _isActive: boolean;
  private _mustChangePassword: boolean;
  private _version: number;
  private _lastLoginAt: Date | null;
  private _lastLoginIp: string | null;
  private _createdBy: AdminId | null;
  private _deactivatedAt: Date | null;
  private _deactivatedBy: AdminId | null;
  private _deactivationReason: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AdminUserProps) {
    super();
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._role = props.role;
    this._phoneNumber = props.phoneNumber;
    this._avatarUrl = props.avatarUrl;
    this._isActive = props.isActive;
    this._mustChangePassword = props.mustChangePassword;
    this._version = props.version;
    this._lastLoginAt = props.lastLoginAt;
    this._lastLoginIp = props.lastLoginIp;
    this._createdBy = props.createdBy;
    this._deactivatedAt = props.deactivatedAt;
    this._deactivatedBy = props.deactivatedBy;
    this._deactivationReason = props.deactivationReason;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateAdminUserProps): AdminUser {
    if (!props.firstName || props.firstName.trim().length === 0) {
      throw new AdminDomainException('First name cannot be empty');
    }
    if (!props.lastName || props.lastName.trim().length === 0) {
      throw new AdminDomainException('Last name cannot be empty');
    }

    const now = new Date();
    const id = AdminId.create();

    const admin = new AdminUser({
      id,
      email: props.email,
      passwordHash: props.passwordHash,
      firstName: props.firstName.trim(),
      lastName: props.lastName.trim(),
      role: props.role,
      phoneNumber: props.phoneNumber ?? null,
      avatarUrl: props.avatarUrl ?? null,
      isActive: true,
      mustChangePassword: props.mustChangePassword ?? false,
      version: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      createdBy: props.createdBy ?? null,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
      createdAt: now,
      updatedAt: now,
    });

    admin.apply(
      new AdminCreatedEvent(
        admin.id.value,
        admin.email.value,
        admin.role.value,
        admin.createdBy?.value ?? null,
        admin.mustChangePassword,
        now,
      ),
    );

    return admin;
  }

  static reconstitute(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  get id(): AdminId {
    return this._id;
  }

  get email(): AdminEmail {
    return this._email;
  }

  get passwordHash(): AdminPasswordHash {
    return this._passwordHash;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get fullName(): string {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  get role(): AdminRoleVO {
    return this._role;
  }

  get phoneNumber(): string | null {
    return this._phoneNumber;
  }

  get avatarUrl(): string | null {
    return this._avatarUrl;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get mustChangePassword(): boolean {
    return this._mustChangePassword;
  }

  get version(): number {
    return this._version;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get lastLoginIp(): string | null {
    return this._lastLoginIp;
  }

  get createdBy(): AdminId | null {
    return this._createdBy;
  }

  get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  get deactivatedBy(): AdminId | null {
    return this._deactivatedBy;
  }

  get deactivationReason(): string | null {
    return this._deactivationReason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  updateProfile(props: UpdateAdminProfileProps): void {
    if (!this._isActive) {
      throw new AdminDomainException(
        'Cannot update profile of a deactivated administrator.',
      );
    }
    if (!props.firstName || props.firstName.trim().length === 0) {
      throw new AdminDomainException('First name cannot be empty');
    }
    if (!props.lastName || props.lastName.trim().length === 0) {
      throw new AdminDomainException('Last name cannot be empty');
    }

    this._firstName = props.firstName.trim();
    this._lastName = props.lastName.trim();
    if (props.phoneNumber !== undefined) {
      this._phoneNumber = props.phoneNumber;
    }
    if (props.avatarUrl !== undefined) {
      this._avatarUrl = props.avatarUrl;
    }
    this._updatedAt = new Date();
    this.incrementVersion();
  }

  changeRole(newRole: AdminRoleVO, operator: AdminUser): void {
    if (!this._isActive) {
      throw new AdminDomainException(
        'Cannot change role of a deactivated administrator.',
      );
    }
    if (operator.id.equals(this._id)) {
      throw new AdminDomainException(
        'Administrators cannot modify their own role.',
      );
    }
    if (!operator.role.canManage(this._role)) {
      throw new AdminDomainException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot modify a ${this._role.value}.`,
      );
    }
    if (!operator.role.canAssignRole(newRole)) {
      throw new AdminDomainException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot assign the role ${newRole.value}.`,
      );
    }

    if (this._role.equals(newRole)) {
      return;
    }

    const oldRole = this._role.value;
    this._role = newRole;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.apply(
      new AdminRoleChangedEvent(
        this._id.value,
        oldRole,
        newRole.value,
        operator.id.value,
        this._updatedAt,
      ),
    );
  }

  changePassword(newHash: AdminPasswordHash): void {
    if (!this._isActive) {
      throw new AdminDomainException(
        'Cannot change password of a deactivated administrator.',
      );
    }

    this._passwordHash = newHash;
    this._mustChangePassword = false;
    this._updatedAt = new Date();
    this.incrementVersion();
  }

  deactivate(operator: AdminUser, reason: string): void {
    if (!this._isActive) {
      throw new AdminDomainException(
        'Administrator account is already deactivated.',
      );
    }
    if (operator.id.equals(this._id)) {
      throw new AdminDomainException(
        'Administrators cannot deactivate their own account.',
      );
    }
    if (!operator.role.canManage(this._role)) {
      throw new AdminDomainException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot deactivate a ${this._role.value}.`,
      );
    }
    if (!reason || reason.trim().length === 0) {
      throw new AdminDomainException('A deactivation reason must be provided.');
    }

    this._isActive = false;
    this._deactivatedAt = new Date();
    this._deactivatedBy = operator.id;
    this._deactivationReason = reason.trim();
    this._updatedAt = this._deactivatedAt;
    this.incrementVersion();

    this.apply(
      new AdminDeactivatedEvent(
        this._id.value,
        operator.id.value,
        this._deactivationReason,
        this._deactivatedAt,
      ),
    );
  }

  activate(operator: AdminUser): void {
    if (this._isActive) {
      throw new AdminDomainException(
        'Administrator account is already active.',
      );
    }
    if (!operator.role.canManage(this._role)) {
      throw new AdminDomainException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot activate a ${this._role.value}.`,
      );
    }

    this._isActive = true;
    this._deactivatedAt = null;
    this._deactivatedBy = null;
    this._deactivationReason = null;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.apply(
      new AdminActivatedEvent(
        this._id.value,
        operator.id.value,
        this._updatedAt,
      ),
    );
  }

  private incrementVersion(): void {
    this._version += 1;
  }
}
