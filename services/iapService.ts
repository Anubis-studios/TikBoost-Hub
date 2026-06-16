/**
 * In-App Purchase Service
 * 
 * Provides IAP configuration and a purchase flow stub.
 * In production, integrate react-native-iap or expo-in-app-purchases
 * and replace purchaseProduct() with the real store API.
 */
import { Platform, Alert } from 'react-native';

// ─── IAP Product IDs ─────────────────────────────────────────────────────────
// These must match the product IDs configured in Google Play Console & App Store Connect

export const IAP_PRODUCT_IDS = {
  STARS_500:      'com.tikboost.stars.500',
  STARS_1000:     'com.tikboost.stars.1000',
  STARS_2500:     'com.tikboost.stars.2500',
  STARS_5000:     'com.tikboost.stars.5000',
  STARS_10000:    'com.tikboost.stars.10000',
  VIP_30:         'com.tikboost.vip.30days',
  LUCKY_SPIN:     'com.tikboost.wheel.spin',
  BUNDLE_STARTER: 'com.tikboost.bundle.starter',
  BUNDLE_GROWTH:  'com.tikboost.bundle.growth',
  BUNDLE_VIRAL:   'com.tikboost.bundle.viral',
} as const;

export type IAPProductId = typeof IAP_PRODUCT_IDS[keyof typeof IAP_PRODUCT_IDS];

// ─── Star Package Config ──────────────────────────────────────────────────────

export interface StarPackageConfig {
  productId: IAPProductId;
  stars: number;
  bonusStars: number;
  price: string;
  label?: string;
  badge?: string;
  badgeColor?: string;
}

export const STAR_PACKAGES: StarPackageConfig[] = [
  {
    productId: IAP_PRODUCT_IDS.STARS_500,
    stars: 500,
    bonusStars: 0,
    price: '£9.99',
  },
  {
    productId: IAP_PRODUCT_IDS.STARS_1000,
    stars: 1000,
    bonusStars: 100,
    price: '£17.99',
    badge: 'Most Popular',
    badgeColor: '#0A84FF',
  },
  {
    productId: IAP_PRODUCT_IDS.STARS_2500,
    stars: 2500,
    bonusStars: 250,
    price: '£34.99',
  },
  {
    productId: IAP_PRODUCT_IDS.STARS_5000,
    stars: 5000,
    bonusStars: 600,
    price: '£59.99',
    badge: 'Best Value',
    badgeColor: '#00D97E',
  },
  {
    productId: IAP_PRODUCT_IDS.STARS_10000,
    stars: 10000,
    bonusStars: 1500,
    price: '£99.99',
    badge: 'Super Saver',
    badgeColor: '#FF2D55',
  },
];

export interface VIPConfig {
  productId: IAPProductId;
  price: string;
  days: number;
  bonusStars: number;
}

export const VIP_PLAN: VIPConfig = {
  productId: IAP_PRODUCT_IDS.VIP_30,
  price: '£7.49',
  days: 30,
  bonusStars: 500,
};

export const LUCKY_SPIN_CONFIG = {
  productId: IAP_PRODUCT_IDS.LUCKY_SPIN,
  price: '£9.99',
  minWin: 200,
  maxWin: 3000,
  segments: [200, 300, 500, 800, 1000, 1500, 3000],
};

export interface BundleConfig {
  productId: IAPProductId;
  id: string;
  title: string;
  stars: number;
  vipDays: number;
  price: string;
  originalPrice: string;
  isFeatured?: boolean;
}

export const BUNDLE_PLANS: BundleConfig[] = [
  {
    productId: IAP_PRODUCT_IDS.BUNDLE_STARTER,
    id: 'starter',
    title: 'Starter Pack',
    stars: 500,
    vipDays: 7,
    price: '£11.99',
    originalPrice: '£17.49',
  },
  {
    productId: IAP_PRODUCT_IDS.BUNDLE_GROWTH,
    id: 'growth',
    title: 'Growth Pack',
    stars: 2000,
    vipDays: 30,
    price: '£37.49',
    originalPrice: '£59.99',
  },
  {
    productId: IAP_PRODUCT_IDS.BUNDLE_VIRAL,
    id: 'viral',
    title: 'Viral Pack',
    stars: 10000,
    vipDays: 60,
    price: '£119.99',
    originalPrice: '£209.99',
    isFeatured: true,
  },
];

// ─── Mock purchase result ─────────────────────────────────────────────────────

export interface MockPurchase {
  productId: string;
  transactionId: string;
  purchaseToken: string;
  platform: string;
}

// ─── IAP Connection & Purchase ────────────────────────────────────────────────

/**
 * Initialize IAP connection.
 * Replace with real react-native-iap initConnection() when publishing.
 */
export async function connectIAP(): Promise<boolean> {
  // In production: await initConnection() from react-native-iap
  return true;
}

/**
 * Request an in-app purchase.
 * Returns null if user cancels, throws on error.
 * 
 * In production: replace with requestPurchase({ sku: productId }) from react-native-iap
 */
export async function purchaseProduct(productId: IAPProductId): Promise<MockPurchase | null> {
  // Stub: simulate a successful purchase for development/demo
  // In production this opens the real store payment sheet
  return {
    productId,
    transactionId: `txn_${Date.now()}`,
    purchaseToken: `token_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    platform: Platform.OS,
  };
}

/**
 * Finish/consume a purchase so it doesn't re-queue.
 * In production: await finishTransaction({ purchase, isConsumable: true })
 */
export async function completePurchase(purchase: MockPurchase): Promise<void> {
  // In production: finishTransaction({ purchase, isConsumable: true })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStarsForProduct(productId: IAPProductId): number {
  const pkg = STAR_PACKAGES.find(p => p.productId === productId);
  if (pkg) return pkg.stars + pkg.bonusStars;
  const bundle = BUNDLE_PLANS.find(b => b.productId === productId);
  if (bundle) return bundle.stars;
  if (productId === IAP_PRODUCT_IDS.VIP_30) return VIP_PLAN.bonusStars;
  return 0;
}

export function isVIPProduct(productId: IAPProductId): boolean {
  return productId === IAP_PRODUCT_IDS.VIP_30 || BUNDLE_PLANS.some(b => b.productId === productId);
}

export function getVIPDaysForProduct(productId: IAPProductId): number {
  if (productId === IAP_PRODUCT_IDS.VIP_30) return VIP_PLAN.days;
  const bundle = BUNDLE_PLANS.find(b => b.productId === productId);
  return bundle ? bundle.vipDays : 0;
}
