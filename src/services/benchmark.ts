import { performance } from 'perf_hooks';

// Mock CakeGenieCartItem
interface CakeGenieCartItem {
  id: string;
  merchant_id?: string;
}

// Current
function groupCartItemsByMerchantCurrent(
  cartItems: CakeGenieCartItem[]
): Map<string, CakeGenieCartItem[]> {
  const grouped = new Map<string, CakeGenieCartItem[]>();

  for (const item of cartItems) {
    const merchantId = item.merchant_id || 'unknown';
    const existing = grouped.get(merchantId) || [];
    existing.push(item);
    grouped.set(merchantId, existing);
  }

  return grouped;
}

// Optimized
function groupCartItemsByMerchantOptimized(
  cartItems: CakeGenieCartItem[]
): Map<string, CakeGenieCartItem[]> {
  const grouped = new Map<string, CakeGenieCartItem[]>();

  for (const item of cartItems) {
    const merchantId = item.merchant_id || 'unknown';
    const existing = grouped.get(merchantId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(merchantId, [item]);
    }
  }

  return grouped;
}

// Data Gen
const items: CakeGenieCartItem[] = Array.from({ length: 1000000 }, (_, i) => ({
  id: String(i),
  merchant_id: String(i % 100), // 100 different merchants
}));

// Warmup
for (let i = 0; i < 10; i++) {
  groupCartItemsByMerchantCurrent(items);
  groupCartItemsByMerchantOptimized(items);
}

// Benchmark
const t0 = performance.now();
for (let i = 0; i < 50; i++) {
  groupCartItemsByMerchantCurrent(items);
}
const t1 = performance.now();

const t2 = performance.now();
for (let i = 0; i < 50; i++) {
  groupCartItemsByMerchantOptimized(items);
}
const t3 = performance.now();

console.log(`Current: ${t1 - t0} ms`);
console.log(`Optimized: ${t3 - t2} ms`);
