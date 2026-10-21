export const ADMIN_ROLES = [
  'super-admin',
  'admin',
  'manager',
  'support',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export enum AdminPermission {
  // Staff & Identity Management
  STAFF_READ = 'staff:read',
  STAFF_CREATE = 'staff:create',
  STAFF_UPDATE = 'staff:update',
  STAFF_MANAGE_ROLES = 'staff:manage_roles',
  STAFF_DEACTIVATE = 'staff:deactivate',
  STAFF_ACTIVATE = 'staff:activate',

  // Catalog Management
  PRODUCTS_READ = 'products:read',
  PRODUCTS_WRITE = 'products:write',
  PRODUCTS_DELETE = 'products:delete',

  // Inventory Management
  INVENTORY_READ = 'inventory:read',
  INVENTORY_RESTOCK = 'inventory:restock',
  INVENTORY_ADJUST = 'inventory:adjust',
  INVENTORY_STOCKTAKE = 'inventory:stocktake',
  INVENTORY_SETTINGS = 'inventory:settings',

  // Order Management & Fulfillment
  ORDERS_READ = 'orders:read',
  ORDERS_FULFILL = 'orders:fulfill',
  ORDERS_CANCEL = 'orders:cancel',
  ORDERS_RETURN = 'orders:return',

  // Customer Moderation
  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_READ_PII = 'customers:read_pii',
  CUSTOMERS_DEACTIVATE = 'customers:deactivate',

  // Business Analytics & Reporting
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_FINANCIAL_READ = 'analytics:financial_read',

  // Marketing Promotions & Discounts
  DISCOUNTS_READ = 'discounts:read',
  DISCOUNTS_WRITE = 'discounts:write',
  DISCOUNTS_DELETE = 'discounts:delete',

  // System & Auditing
  AUDIT_READ = 'audit:read',
  SYSTEM_SETTINGS = 'system:settings',
}

export const ROLE_PERMISSIONS_MAP: Record<
  AdminRole,
  ReadonlySet<AdminPermission>
> = {
  // super-admin has ALL permissions
  'super-admin': new Set(Object.values(AdminPermission)),

  // admin has operational permissions
  admin: new Set([
    AdminPermission.STAFF_READ,
    AdminPermission.STAFF_CREATE,
    AdminPermission.STAFF_UPDATE,
    AdminPermission.STAFF_DEACTIVATE,
    AdminPermission.STAFF_ACTIVATE,
    AdminPermission.PRODUCTS_READ,
    AdminPermission.PRODUCTS_WRITE,
    AdminPermission.PRODUCTS_DELETE,
    AdminPermission.INVENTORY_READ,
    AdminPermission.INVENTORY_RESTOCK,
    AdminPermission.INVENTORY_ADJUST,
    AdminPermission.INVENTORY_STOCKTAKE,
    AdminPermission.INVENTORY_SETTINGS,
    AdminPermission.ORDERS_READ,
    AdminPermission.ORDERS_FULFILL,
    AdminPermission.ORDERS_CANCEL,
    AdminPermission.ORDERS_RETURN,
    AdminPermission.CUSTOMERS_READ,
    AdminPermission.CUSTOMERS_READ_PII,
    AdminPermission.CUSTOMERS_DEACTIVATE,
    AdminPermission.AUDIT_READ,
    AdminPermission.ANALYTICS_READ,
    AdminPermission.ANALYTICS_FINANCIAL_READ,
    AdminPermission.DISCOUNTS_READ,
    AdminPermission.DISCOUNTS_WRITE,
    AdminPermission.DISCOUNTS_DELETE,
  ]),

  // manager manages catalog, stock replenishment, and order fulfillment
  manager: new Set([
    AdminPermission.PRODUCTS_READ,
    AdminPermission.PRODUCTS_WRITE,
    AdminPermission.INVENTORY_READ,
    AdminPermission.INVENTORY_RESTOCK,
    AdminPermission.INVENTORY_STOCKTAKE,
    AdminPermission.ORDERS_READ,
    AdminPermission.ORDERS_FULFILL,
    AdminPermission.CUSTOMERS_READ,
    AdminPermission.ANALYTICS_READ,
    AdminPermission.DISCOUNTS_READ,
    AdminPermission.DISCOUNTS_WRITE,
  ]),

  // support has read-only catalog/stock, policy-bounded order actions, and operational analytics
  support: new Set([
    AdminPermission.PRODUCTS_READ,
    AdminPermission.INVENTORY_READ,
    AdminPermission.ORDERS_READ,
    AdminPermission.ORDERS_CANCEL,
    AdminPermission.ORDERS_RETURN,
    AdminPermission.CUSTOMERS_READ,
    AdminPermission.ANALYTICS_READ,
    AdminPermission.DISCOUNTS_READ,
  ]),
};
