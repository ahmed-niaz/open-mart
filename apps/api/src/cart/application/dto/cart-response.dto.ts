export interface CartItemResponseDto {
  id: string;
  productId: string;
  title: string;
  sku: string;
  thumbnailUrl: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  lineTotalCents: number;
  availableStock: number;
  isAvailable: boolean;
}

export interface CartResponseDto {
  id: string;
  customerId: string | null;
  guestId: string | null;
  status: string;
  currency: string;
  items: CartItemResponseDto[];
  totalQuantity: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
  updatedAt: string;
}
