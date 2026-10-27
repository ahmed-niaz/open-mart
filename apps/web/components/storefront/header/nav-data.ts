export interface NavSubItem {
  id: string;
  label: string;
  href: string;
  badge?: string;
  isNew?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  href?: string;
  isDanger?: boolean; // Highlighted in red (e.g., 'Last Chance' / 'Sale')
  items: NavSubItem[];
}

export interface NavPromoCard {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  href: string;
}

export interface TopNavItem {
  id: string;
  label: string;
  href: string;
  groups: NavGroup[];
  promos?: NavPromoCard[];
}

export const DEFAULT_NAV_ITEMS: TopNavItem[] = [];
