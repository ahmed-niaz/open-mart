import { describe, expect, it } from 'vitest';
import {
  AdminPermission,
  ROLE_PERMISSIONS_MAP,
} from '../../src/shared/infrastructure/guards/admin-permissions.js';

describe('Admin Permission Matrix Tests', () => {
  it('super-admin has universal permissions (all permissions defined)', () => {
    const superAdminPerms = ROLE_PERMISSIONS_MAP['super-admin'];
    const allPermissions = Object.values(AdminPermission);

    expect(superAdminPerms.size).toBe(allPermissions.length);
    for (const perm of allPermissions) {
      expect(superAdminPerms.has(perm)).toBe(true);
    }
  });

  it('admin has operational permissions but cannot manage system settings', () => {
    const adminPerms = ROLE_PERMISSIONS_MAP['admin'];

    // Can manage staff and operations
    expect(adminPerms.has(AdminPermission.STAFF_READ)).toBe(true);
    expect(adminPerms.has(AdminPermission.STAFF_CREATE)).toBe(true);
    expect(adminPerms.has(AdminPermission.STAFF_UPDATE)).toBe(true);
    expect(adminPerms.has(AdminPermission.STAFF_DEACTIVATE)).toBe(true);
    expect(adminPerms.has(AdminPermission.PRODUCTS_WRITE)).toBe(true);
    expect(adminPerms.has(AdminPermission.INVENTORY_RESTOCK)).toBe(true);
    expect(adminPerms.has(AdminPermission.INVENTORY_SETTINGS)).toBe(true);
    expect(adminPerms.has(AdminPermission.ORDERS_FULFILL)).toBe(true);
    expect(adminPerms.has(AdminPermission.CUSTOMERS_DEACTIVATE)).toBe(true);
    expect(adminPerms.has(AdminPermission.CUSTOMERS_READ_PII)).toBe(true);
    expect(adminPerms.has(AdminPermission.AUDIT_READ)).toBe(true);
    expect(adminPerms.has(AdminPermission.ANALYTICS_READ)).toBe(true);
    expect(adminPerms.has(AdminPermission.ANALYTICS_FINANCIAL_READ)).toBe(true);

    // Cannot modify system-level configurations
    expect(adminPerms.has(AdminPermission.SYSTEM_SETTINGS)).toBe(false);
  });

  it('manager has catalog, inventory replenishment, and fulfillment permissions', () => {
    const managerPerms = ROLE_PERMISSIONS_MAP['manager'];

    expect(managerPerms.has(AdminPermission.PRODUCTS_READ)).toBe(true);
    expect(managerPerms.has(AdminPermission.PRODUCTS_WRITE)).toBe(true);
    expect(managerPerms.has(AdminPermission.INVENTORY_READ)).toBe(true);
    expect(managerPerms.has(AdminPermission.INVENTORY_RESTOCK)).toBe(true);
    expect(managerPerms.has(AdminPermission.INVENTORY_STOCKTAKE)).toBe(true);
    expect(managerPerms.has(AdminPermission.ORDERS_READ)).toBe(true);
    expect(managerPerms.has(AdminPermission.ORDERS_FULFILL)).toBe(true);
    expect(managerPerms.has(AdminPermission.CUSTOMERS_READ)).toBe(true);
    expect(managerPerms.has(AdminPermission.ANALYTICS_READ)).toBe(true);

    // Forbidden for manager:
    expect(managerPerms.has(AdminPermission.STAFF_READ)).toBe(false);
    expect(managerPerms.has(AdminPermission.STAFF_CREATE)).toBe(false);
    expect(managerPerms.has(AdminPermission.INVENTORY_SETTINGS)).toBe(false);
    expect(managerPerms.has(AdminPermission.CUSTOMERS_DEACTIVATE)).toBe(false);
    expect(managerPerms.has(AdminPermission.CUSTOMERS_READ_PII)).toBe(false);
    expect(managerPerms.has(AdminPermission.AUDIT_READ)).toBe(false);
    expect(managerPerms.has(AdminPermission.ANALYTICS_FINANCIAL_READ)).toBe(
      false,
    );
    expect(managerPerms.has(AdminPermission.SYSTEM_SETTINGS)).toBe(false);
  });

  it('support has read-only catalog/inventory and policy-bounded order actions', () => {
    const supportPerms = ROLE_PERMISSIONS_MAP['support'];

    expect(supportPerms.has(AdminPermission.PRODUCTS_READ)).toBe(true);
    expect(supportPerms.has(AdminPermission.INVENTORY_READ)).toBe(true);
    expect(supportPerms.has(AdminPermission.ORDERS_READ)).toBe(true);
    expect(supportPerms.has(AdminPermission.ORDERS_CANCEL)).toBe(true);
    expect(supportPerms.has(AdminPermission.ORDERS_RETURN)).toBe(true);
    expect(supportPerms.has(AdminPermission.CUSTOMERS_READ)).toBe(true);
    expect(supportPerms.has(AdminPermission.ANALYTICS_READ)).toBe(true);

    // Forbidden for support:
    expect(supportPerms.has(AdminPermission.PRODUCTS_WRITE)).toBe(false);
    expect(supportPerms.has(AdminPermission.PRODUCTS_DELETE)).toBe(false);
    expect(supportPerms.has(AdminPermission.INVENTORY_RESTOCK)).toBe(false);
    expect(supportPerms.has(AdminPermission.INVENTORY_ADJUST)).toBe(false);
    expect(supportPerms.has(AdminPermission.INVENTORY_STOCKTAKE)).toBe(false);
    expect(supportPerms.has(AdminPermission.INVENTORY_SETTINGS)).toBe(false);
    expect(supportPerms.has(AdminPermission.ORDERS_FULFILL)).toBe(false);
    expect(supportPerms.has(AdminPermission.STAFF_READ)).toBe(false);
    expect(supportPerms.has(AdminPermission.STAFF_CREATE)).toBe(false);
    expect(supportPerms.has(AdminPermission.CUSTOMERS_READ_PII)).toBe(false);
    expect(supportPerms.has(AdminPermission.AUDIT_READ)).toBe(false);
    expect(supportPerms.has(AdminPermission.ANALYTICS_FINANCIAL_READ)).toBe(
      false,
    );
    expect(supportPerms.has(AdminPermission.SYSTEM_SETTINGS)).toBe(false);
  });
});
