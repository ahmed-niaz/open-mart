export interface StorefrontLinkItem {
  label: string;
  href: string;
}

export interface StorefrontDepartment {
  id: string;
  name: string;
  slug: string;
  href: string;
  description: string;
  imageUrl?: string;
  children: StorefrontDepartment[];
}

export const FALLBACK_DEPARTMENTS: StorefrontDepartment[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    slug: 'electronics',
    href: '/category/electronics',
    description: 'Audio, TVs, cameras, wearables, and everyday tech.',
    children: [],
  },
  {
    id: 'computers',
    name: 'Computers',
    slug: 'computers',
    href: '/category/computers',
    description: 'Laptops, desktops, monitors, components, and peripherals.',
    children: [],
  },
  {
    id: 'smart-home',
    name: 'Smart Home',
    slug: 'smart-home',
    href: '/category/smart-home',
    description: 'Connected lighting, security cameras, locks, and climate.',
    children: [],
  },
  {
    id: 'arts-and-crafts',
    name: 'Arts & Crafts',
    slug: 'arts-and-crafts',
    href: '/category/arts-and-crafts',
    description: 'Fine art materials, DIY craft kits, paper, and studio tools.',
    children: [],
  },
  {
    id: 'automotive',
    name: 'Automotive',
    slug: 'automotive',
    href: '/category/automotive',
    description:
      'Car tech, detailing gear, interior upgrades, and garage tools.',
    children: [],
  },
];

export const SECONDARY_QUICK_LINKS: StorefrontLinkItem[] = [
  { label: "Today's Deals", href: '/deals' },
  { label: 'New Arrivals', href: '/new-arrivals' },
  { label: 'Best Sellers', href: '/best-sellers' },
];

export const DRAWER_TRENDING_LINKS: StorefrontLinkItem[] = [
  { label: 'Best Sellers', href: '/best-sellers' },
  { label: 'New Releases', href: '/new-arrivals' },
  { label: "Today's Deals", href: '/deals' },
];

export const DRAWER_HELP_LINKS: StorefrontLinkItem[] = [
  { label: 'Your Account', href: '/account' },
  { label: 'Orders & Returns', href: '/orders' },
  { label: 'Saved Items', href: '/wishlist' },
  { label: 'Customer Service', href: '/help' },
];
