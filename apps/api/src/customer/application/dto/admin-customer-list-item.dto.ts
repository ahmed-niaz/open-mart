export interface AdminCustomerListItemDto {
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
  totalOrders: number;
  totalSpentCents: number;
  totalSpentBDT: number;
  currency: string;
  lastOrderAt: string | null;
  createdAt: string;
}
