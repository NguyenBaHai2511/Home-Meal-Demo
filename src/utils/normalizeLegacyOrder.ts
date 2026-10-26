import type { Order } from '../types';

/**
 * Normalize old browser snapshots for read-only display. This function is not an
 * import path: PostgreSQL order creation always uses the authenticated API.
 */
export function normalizeLegacyOrder(value: unknown): Order | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<Order> & { deliveryFee?: unknown; statusHistory?: unknown };
  if (typeof row.id !== 'string' || typeof row.orderCode !== 'string' || !Array.isArray(row.items)) return null;
  if (typeof row.status !== 'string' || !Array.isArray(row.statusHistory)) return null;
  const { deliveryFee: _retiredDeliveryFee, ...order } = row;
  return order as Order;
}

/** Parse legacy localStorage safely without treating it as authoritative data. */
export function readLegacyOrders(storageValue: string | null): Order[] {
  if (!storageValue) return [];
  try {
    const parsed: unknown = JSON.parse(storageValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLegacyOrder).filter((order): order is Order => order !== null);
  } catch {
    return [];
  }
}
