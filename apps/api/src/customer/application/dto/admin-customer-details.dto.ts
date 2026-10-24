export interface AdminCustomerAddressDto {
  recipientName: string;
  recipientPhone: string;
  altPhone?: string | null;
  division: string;
  district: string;
  city: string;
  area: string;
  addressLine: string;
  postalCode?: string | null;
  country: string;
  lastUsedAt: string;
}

export interface AdminCustomerOrderSummaryDto {
  id: string;
  status: string;
  totalAmount: number;
  totalAmountBDT: number;
  totalCurrency: string;
  itemsCount: number;
  createdAt: string;
}

export interface AdminCustomerStatsDto {
  totalOrders: number;
  totalSpentCents: number;
  totalSpentBDT: number;
  currency: string;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValueBDT: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerDetailsDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isGoogleLinked: boolean;
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: AdminCustomerStatsDto;
  addresses: AdminCustomerAddressDto[];
  recentOrders: AdminCustomerOrderSummaryDto[];
}
