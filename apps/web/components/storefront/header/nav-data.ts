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

export const DEFAULT_NAV_ITEMS: TopNavItem[] = [
  {
    id: 'women',
    label: 'Women',
    href: '/category/women',
    groups: [
      {
        id: 'trending',
        label: 'Trending',
        href: '/category/women?sort=trending',
        items: [
          { id: 'new-drops', label: 'New Product Drops', href: '/category/women?collection=new', isNew: true },
          { id: 'best-sellers', label: 'Best Sellers', href: '/category/women?sort=best-sellers' },
          { id: 'softsense', label: 'SoftSense™', href: '/category/women?collection=softsense' },
          { id: 'edge', label: 'Edge', href: '/category/women?collection=edge' },
          { id: 'burgundy-sets', label: 'Burgundy Gym Sets', href: '/category/women?color=burgundy' },
          { id: 'adapt-whitney', label: 'Adapt X Whitney', href: '/category/women?collection=adapt-whitney' },
          { id: 'loungewear', label: 'Loungewear', href: '/category/women?type=loungewear' },
        ],
      },
      {
        id: 'leggings',
        label: 'Leggings',
        href: '/category/women?type=leggings',
        items: [
          { id: 'all-leggings', label: 'All Leggings', href: '/category/women?type=leggings' },
          { id: 'high-waisted', label: 'High-Waisted Leggings', href: '/category/women?type=high-waisted' },
          { id: 'scrunch-bum', label: 'Scrunch Bum Leggings', href: '/category/women?type=scrunch-bum' },
          { id: 'seamless-leg', label: 'Seamless Leggings', href: '/category/women?type=seamless' },
          { id: 'black-leggings', label: 'Black Leggings', href: '/category/women?color=black' },
          { id: 'flared-leggings', label: 'Flared Leggings', href: '/category/women?type=flared' },
          { id: 'pocket-leggings', label: 'Pocket Leggings', href: '/category/women?feature=pocket' },
        ],
      },
      {
        id: 'products',
        label: 'Products',
        href: '/category/women',
        items: [
          { id: 'all-products', label: 'All Products', href: '/category/women' },
          { id: 'sports-bras', label: 'Sports Bras', href: '/category/women?type=sports-bras' },
          { id: 't-shirts-tops', label: 'T-Shirts & Tops', href: '/category/women?type=tops' },
          { id: 'crop-tops', label: 'Crop Tops', href: '/category/women?type=crop-tops' },
          { id: 'hoodies-jackets', label: 'Hoodies & Jackets', href: '/category/women?type=hoodies' },
          { id: 'shorts', label: 'Shorts', href: '/category/women?type=shorts' },
          { id: 'joggers', label: 'Joggers & Sweatpants', href: '/category/women?type=joggers' },
          { id: 'underwear', label: 'Underwear', href: '/category/women?type=underwear' },
        ],
      },
      {
        id: 'shop-by-collection',
        label: 'Shop by Collection',
        href: '/category/women?type=collections',
        items: [
          { id: 'vital-seamless', label: 'Vital Seamless', href: '/category/women?collection=vital-seamless' },
          { id: 'adapt', label: 'Adapt', href: '/category/women?collection=adapt' },
          { id: 'sweat', label: 'Sweat', href: '/category/women?collection=sweat' },
          { id: 'elevate', label: 'Elevate', href: '/category/women?collection=elevate' },
          { id: 'legacy', label: 'Legacy', href: '/category/women?collection=legacy' },
          { id: 'rest-day', label: 'Rest Day', href: '/category/women?collection=rest-day' },
        ],
      },
      {
        id: 'shop-by-activity',
        label: 'Shop by Activity',
        href: '/category/women?type=activities',
        items: [
          { id: 'lifting-gym', label: 'Lifting & Gym', href: '/category/women?activity=lifting' },
          { id: 'running', label: 'Running', href: '/category/women?activity=running' },
          { id: 'rest-recovery', label: 'Rest & Recovery', href: '/category/women?activity=rest' },
          { id: 'yoga-studio', label: 'Yoga & Studio', href: '/category/women?activity=yoga' },
        ],
      },
      {
        id: 'accessories',
        label: 'Accessories',
        href: '/category/accessories',
        items: [
          { id: 'bags-backpacks', label: 'Bags & Backpacks', href: '/category/accessories?type=bags' },
          { id: 'socks', label: 'Socks', href: '/category/accessories?type=socks' },
          { id: 'hats-beanies', label: 'Hats & Beanies', href: '/category/accessories?type=hats' },
          { id: 'water-bottles', label: 'Water Bottles', href: '/category/accessories?type=bottles' },
          { id: 'lifting-straps', label: 'Lifting Straps', href: '/category/accessories?type=straps' },
        ],
      },
      {
        id: 'last-chance',
        label: 'Last Chance',
        href: '/category/women?sale=true',
        isDanger: true,
        items: [
          { id: 'up-to-50', label: 'Up to 50% Off', href: '/category/women?discount=50', badge: 'SALE' },
          { id: 'all-sale', label: 'All Sale Products', href: '/category/women?sale=true' },
          { id: 'under-1500', label: 'Under ৳ 1,500', href: '/category/women?maxPrice=150000' },
        ],
      },
    ],
    promos: [
      {
        id: 'promo-softsense',
        title: 'SOFTSENSE™',
        subtitle: 'Buttery Soft Touch',
        imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
        href: '/category/women?collection=softsense',
      },
      {
        id: 'promo-dipped',
        title: 'DIPPED WAISTBAND',
        subtitle: 'Sculpt & Support',
        imageUrl: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&w=600&q=80',
        href: '/category/women?type=leggings',
      },
    ],
  },
  {
    id: 'men',
    label: 'Men',
    href: '/category/men',
    groups: [
      {
        id: 'men-trending',
        label: 'Trending',
        href: '/category/men?sort=trending',
        items: [
          { id: 'men-new', label: 'New Product Drops', href: '/category/men?collection=new', isNew: true },
          { id: 'men-best', label: 'Best Sellers', href: '/category/men?sort=best-sellers' },
          { id: 'power-collection', label: 'Power Collection', href: '/category/men?collection=power' },
          { id: 'oversized-fits', label: 'Oversized Fits', href: '/category/men?fit=oversized' },
          { id: 'gym-sets', label: 'Gym Sets', href: '/category/men?type=sets' },
        ],
      },
      {
        id: 'men-tops',
        label: 'T-Shirts & Tops',
        href: '/category/men?type=tops',
        items: [
          { id: 'all-tops', label: 'All Tops', href: '/category/men?type=tops' },
          { id: 'oversized-tees', label: 'Oversized T-Shirts', href: '/category/men?type=oversized-tees' },
          { id: 'stringers-tanks', label: 'Stringers & Tanks', href: '/category/men?type=tanks' },
          { id: 'long-sleeves', label: 'Long Sleeve Shirts', href: '/category/men?type=long-sleeves' },
          { id: 'seamless-tops', label: 'Seamless Tops', href: '/category/men?type=seamless-tops' },
        ],
      },
      {
        id: 'men-shorts',
        label: 'Shorts',
        href: '/category/men?type=shorts',
        items: [
          { id: '5-inch-shorts', label: '5" Inseam Shorts', href: '/category/men?type=shorts-5inch' },
          { id: '7-inch-shorts', label: '7" Training Shorts', href: '/category/men?type=shorts-7inch' },
          { id: 'running-shorts', label: 'Running Shorts', href: '/category/men?type=running-shorts' },
          { id: '2in1-shorts', label: '2-in-1 Shorts', href: '/category/men?type=2in1-shorts' },
        ],
      },
      {
        id: 'men-hoodies',
        label: 'Hoodies & Jackets',
        href: '/category/men?type=hoodies',
        items: [
          { id: 'all-hoodies', label: 'All Hoodies', href: '/category/men?type=hoodies' },
          { id: 'zip-jackets', label: 'Zip-Up Jackets', href: '/category/men?type=zip-jackets' },
          { id: 'pullovers', label: 'Pullover Hoodies', href: '/category/men?type=pullovers' },
          { id: 'pump-covers', label: 'Pump Covers', href: '/category/men?type=pump-covers' },
        ],
      },
      {
        id: 'men-pants',
        label: 'Pants & Joggers',
        href: '/category/men?type=pants',
        items: [
          { id: 'tapered-joggers', label: 'Tapered Joggers', href: '/category/men?type=joggers' },
          { id: 'cargo-pants', label: 'Cargo Pants', href: '/category/men?type=cargos' },
          { id: 'track-pants', label: 'Track Pants', href: '/category/men?type=track-pants' },
        ],
      },
      {
        id: 'men-last-chance',
        label: 'Last Chance',
        href: '/category/men?sale=true',
        isDanger: true,
        items: [
          { id: 'men-up-to-50', label: 'Up to 50% Off', href: '/category/men?discount=50', badge: 'SALE' },
          { id: 'men-all-sale', label: 'All Sale Products', href: '/category/men?sale=true' },
        ],
      },
    ],
    promos: [
      {
        id: 'promo-power',
        title: 'POWER COLLECTION',
        subtitle: 'Built For Heavy Lifting',
        imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80',
        href: '/category/men?collection=power',
      },
      {
        id: 'promo-oversized',
        title: 'OVERSIZED FITS',
        subtitle: 'Comfort First Fit',
        imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80',
        href: '/category/men?fit=oversized',
      },
    ],
  },
  {
    id: 'accessories',
    label: 'Accessories',
    href: '/category/accessories',
    groups: [
      {
        id: 'acc-equipment',
        label: 'Equipment',
        href: '/category/accessories?type=equipment',
        items: [
          { id: 'belts', label: 'Lifting Belts', href: '/category/accessories?type=belts' },
          { id: 'straps', label: 'Lifting Straps', href: '/category/accessories?type=straps' },
          { id: 'wraps', label: 'Wrist Wraps', href: '/category/accessories?type=wraps' },
          { id: 'sleeves', label: 'Knee Sleeves', href: '/category/accessories?type=sleeves' },
          { id: 'bands', label: 'Resistance Bands', href: '/category/accessories?type=bands' },
        ],
      },
      {
        id: 'acc-bags',
        label: 'Bags & Backpacks',
        href: '/category/accessories?type=bags',
        items: [
          { id: 'holdalls', label: 'Holdalls & Duffels', href: '/category/accessories?type=holdalls' },
          { id: 'backpacks', label: 'Backpacks', href: '/category/accessories?type=backpacks' },
          { id: 'crossbody', label: 'Crossbody Bags', href: '/category/accessories?type=crossbody' },
        ],
      },
      {
        id: 'acc-essentials',
        label: 'Essentials',
        href: '/category/accessories?type=essentials',
        items: [
          { id: 'crew-socks', label: 'Crew Socks', href: '/category/accessories?type=socks' },
          { id: 'caps', label: 'Caps & Beanies', href: '/category/accessories?type=caps' },
          { id: 'bottles', label: 'Stainless Bottles', href: '/category/accessories?type=bottles' },
          { id: 'shakers', label: 'Protein Shakers', href: '/category/accessories?type=shakers' },
        ],
      },
    ],
    promos: [
      {
        id: 'promo-training-gear',
        title: 'TRAINING GEAR',
        subtitle: 'Engineered For Performance',
        imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
        href: '/category/accessories',
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    href: '/explore',
    groups: [
      {
        id: 'exp-brand',
        label: 'About Open-Mart',
        href: '/about',
        items: [
          { id: 'our-mission', label: 'Our Story & Mission', href: '/about' },
          { id: 'sustainability', label: 'Direct-to-Consumer Model', href: '/about#model' },
          { id: 'craft', label: 'Material & Craftsmanship', href: '/about#materials' },
        ],
      },
      {
        id: 'exp-community',
        label: 'Community',
        href: '/community',
        items: [
          { id: 'athletes', label: 'Athlete Spotlights', href: '/community#athletes' },
          { id: 'guides', label: 'Workout & Sizing Guides', href: '/guides' },
        ],
      },
    ],
    promos: [
      {
        id: 'promo-explore',
        title: 'CRAFTED WITH CARE',
        subtitle: 'Single-Vendor Authenticity',
        imageUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80',
        href: '/about',
      },
    ],
  },
];
