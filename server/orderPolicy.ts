import type { OrderStatus } from '../src/types/index.js';

const cookTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  awaiting_cook: ['confirmed'],
  confirmed: ['shopping_in_progress'],
  shopping_in_progress: ['evidence_submitted'],
  evidence_submitted: ['preparing_meal'],
  preparing_meal: ['delivering_or_serving'],
  delivering_or_serving: ['service_completed'],
};

export function canCookTransition(current: OrderStatus, next: OrderStatus, isAssigned: boolean, canClaim: boolean) {
  if (current === 'awaiting_cook' && next === 'confirmed') return canClaim && !isAssigned;
  return isAssigned && Boolean(cookTransitions[current]?.includes(next));
}

export function canReadOrder(role: 'customer' | 'cook' | 'admin', actorId: string, ownerId: string, assignedCookId: string | null, status: OrderStatus) {
  if (role === 'admin') return true;
  if (role === 'customer') return actorId === ownerId;
  return actorId === assignedCookId || (assignedCookId === null && ['awaiting_cook', 'awaiting_quotation'].includes(status));
}
