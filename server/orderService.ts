import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { BudgetChangeRequest, Dish, DishCategory, DishComplexity, Order, OrderItem, OrderStatus, Quotation, ShoppingEvidenceItem, UserProfile } from '../src/types/index.js';
import { SERVER_COOKS, SERVER_DISHES } from './catalog.js';
import { calculateLaborFee } from '../src/utils/pricing.js';
import { canCookTransition, canReadOrder } from './orderPolicy.js';
import { appPath } from './appPaths.js';

export type OrderActor = Pick<UserProfile, 'id' | 'name' | 'role'>;

export class OrderError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function number(value: unknown, fallback = Number.NaN) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedAmount(value: unknown, label: string, maximum = 100_000_000) {
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) throw new OrderError(`${label} is outside the allowed range.`);
  return Math.round(parsed);
}

function zonedDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return undefined;
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return undefined;
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const timeZone = process.env.APP_TIME_ZONE || 'Asia/Ho_Chi_Minh';
  let guess = naive;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    for (let i = 0; i < 3; i += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      guess += naive - represented;
    }
  } catch {
    throw new OrderError('APP_TIME_ZONE is invalid.', 500);
  }
  return new Date(guess);
}

function appendStatus(order: Order, status: OrderStatus, note: string) {
  order.status = status;
  order.statusHistory = [...(order.statusHistory || []), { status, timestamp: new Date().toISOString(), note: string(note, 500) }];
}

const dishCategories: DishCategory[] = ['meat', 'fish', 'seafood', 'vegetable', 'soup', 'tofu', 'vegetarian', 'dessert', 'banquet'];

function customDish(value: Record<string, unknown>, id: string): Dish | undefined {
  if (!/^(custom|bulk)_[a-zA-Z0-9_-]{1,76}$/.test(id)) return undefined;
  const name = string(value.name, 120);
  const category = string(value.category, 20) as DishCategory;
  if (!name || !dishCategories.includes(category)) return undefined;

  const complexity: DishComplexity = category === 'seafood' || category === 'banquet'
    ? 'complex'
    : category === 'soup' || category === 'vegetable' || category === 'vegetarian' || category === 'tofu'
      ? 'simple'
      : 'moderate';
  const estimatedCosts: Record<DishCategory, number> = {
    meat: 85000,
    fish: 85000,
    seafood: 120000,
    vegetable: 30000,
    soup: 45000,
    tofu: 40000,
    vegetarian: 40000,
    dessert: 35000,
    banquet: 120000,
  };

  return {
    id,
    name,
    vietnameseName: name,
    category,
    description: string(value.description, 300) || 'Món ăn do khách yêu cầu nấu theo khẩu vị riêng',
    suggestedPortion: string(value.suggestedPortion, 100) || 'Theo số khách trong đơn',
    complexity,
    estimatedCost: estimatedCosts[category],
    prepTimeMinutes: 30,
    dietaryTags: ['Nấu theo yêu cầu'],
    ingredients: [],
    imageUrl: '',
  };
}

function catalogItem(raw: unknown): OrderItem {
  const value = object(raw);
  const requestedDish = object(value.dish);
  const dishId = string(requestedDish.id, 100);
  const dish = SERVER_DISHES.find((candidate) => candidate.id === dishId) || customDish(requestedDish, dishId);
  if (!dish) throw new OrderError('One or more selected dishes are unavailable.');
  const quantity = number(value.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) throw new OrderError('Each dish quantity must be between 1 and 30.');
  const excluded = Array.isArray(value.excludedIngredients)
    ? value.excludedIngredients.map((item) => string(item, 100)).filter((item) => dish.ingredients.some((ingredient) => ingredient.id === item))
    : [];
  return {
    dish,
    quantity,
    excludedIngredients: excluded,
    specialNotes: string(value.specialNotes, 300),
  };
}

function cookSummary(order: Order, cookId: string | null, cookName: string | null): Order {
  if (!cookId || !cookName) {
    const { cook: _cook, cookId: _cookId, ...withoutCook } = order;
    return withoutCook;
  }
  const base = SERVER_COOKS[0];
  return {
    ...order,
    cookId,
    cook: { ...base, id: cookId, name: cookName, avatar: '', rating: 0, reviewCount: 0, verified: false, hygieneCertificate: false },
  };
}

function hydrate(row: { payload: Order; assigned_cook_id: string | null; cook_name?: string | null }): Order {
  return cookSummary(row.payload, row.assigned_cook_id, row.cook_name || null);
}

function forActor(order: Order, actor: OrderActor, assignedCookId: string | null): Order {
  if (actor.role === 'cook' && assignedCookId !== actor.id) {
    return { ...order, customerName: 'Khách HomeMeal', customerPhone: '', customerAddress: '' };
  }
  return order;
}

export async function listOrders(actor: OrderActor, client: PoolClient): Promise<Order[]> {
  const result = actor.role === 'admin'
    ? await client.query('SELECT o.payload, o.assigned_cook_id, c.full_name AS cook_name FROM orders o LEFT JOIN app_users c ON c.id = o.assigned_cook_id ORDER BY o.created_at DESC LIMIT 500')
    : actor.role === 'cook'
      ? await client.query("SELECT o.payload, o.assigned_cook_id, c.full_name AS cook_name FROM orders o LEFT JOIN app_users c ON c.id = o.assigned_cook_id WHERE o.assigned_cook_id = $1 OR (o.assigned_cook_id IS NULL AND o.status IN ('awaiting_cook', 'awaiting_quotation')) ORDER BY o.created_at DESC LIMIT 500", [actor.id])
      : await client.query('SELECT o.payload, o.assigned_cook_id, c.full_name AS cook_name FROM orders o LEFT JOIN app_users c ON c.id = o.assigned_cook_id WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT 500', [actor.id]);
  return result.rows.map((row) => forActor(hydrate(row), actor, row.assigned_cook_id));
}

export async function getOrder(orderId: string, actor: OrderActor, client: PoolClient): Promise<Order> {
  const result = await client.query(
    'SELECT o.payload, o.customer_id, o.assigned_cook_id, o.status, c.full_name AS cook_name FROM orders o LEFT JOIN app_users c ON c.id = o.assigned_cook_id WHERE o.id = $1',
    [orderId],
  );
  const row = result.rows[0];
  if (!row) throw new OrderError('Order not found.', 404);
  if (!canReadOrder(actor.role, actor.id, row.customer_id, row.assigned_cook_id, row.status)) throw new OrderError('Order not found.', 404);
  return forActor(hydrate(row), actor, row.assigned_cook_id);
}

export async function createOrder(actor: OrderActor, draftValue: unknown, client: PoolClient, requestId?: string) {
  if (actor.role !== 'customer') throw new OrderError('Only customers can place orders.', 403);
  const draft = object(draftValue);
  const guestCount = number(draft.guestCount);
  if (!Number.isInteger(guestCount) || guestCount < 3 || guestCount > 100) throw new OrderError('Guest count must be between 3 and 100.');
  const serviceType = guestCount > 10 ? 'party_at_home' : 'cook_at_home';
  if (!Array.isArray(draft.items) || draft.items.length < 1 || draft.items.length > 20) throw new OrderError('Choose between 1 and 20 dishes.');
  const items = draft.items.map(catalogItem);
  const date = string(draft.date, 10);
  const servingTime = string(draft.servingTime, 5);
  const delivery = zonedDateTime(date, servingTime);
  if (!delivery || delivery.getTime() - Date.now() < 4 * 60 * 60 * 1000) throw new OrderError('Orders must be scheduled at least four hours in advance.');
  const budget = boundedAmount(draft.estimatedGroceryBudget, 'Grocery budget');
  if (budget < 1) throw new OrderError('Grocery budget must be greater than zero.');

  const fee = calculateLaborFee(guestCount, items.map((item) => item.dish), serviceType);
  const requiresQuotation = fee.requiresQuotation;
  const status: OrderStatus = requiresQuotation ? 'awaiting_quotation' : 'awaiting_cook';
  const id = `ord_${randomUUID()}`;
  let orderCode = `HM-${randomInt(100000, 1_000_000)}`;
  const collision = await client.query('SELECT 1 FROM orders WHERE order_code = $1', [orderCode]);
  if (collision.rowCount) orderCode = `HM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const order: Order = {
    id,
    orderCode,
    customerId: actor.id,
    customerName: actor.name,
    customerPhone: string(draft.customerPhone, 32),
    customerAddress: string(draft.customerAddress, 300),
    date,
    servingTime,
    guestCount,
    mealOccasion: string(draft.mealOccasion, 120) || 'Bữa cơm gia đình',
    serviceType,
    items,
    allergies: Array.isArray(draft.allergies) ? draft.allergies.map((item) => string(item, 100)).filter(Boolean).slice(0, 20) : [],
    generalPreferences: string(draft.generalPreferences, 1000),
    estimatedGroceryBudget: budget,
    actualGroceryTotal: 0,
    shoppingList: [],
    budgetChangeRequests: [],
    baseLaborFee: fee.baseLaborFee,
    complexityAdjustment: fee.complexityAdjustment,
    guestCountAdjustment: fee.guestAdjustment,
    additionalServiceFee: fee.additionalServiceFee,
    totalLaborFee: fee.totalLaborFee,
    finalPayableAmount: fee.totalLaborFee,
    status,
    statusHistory: [{ status, timestamp: new Date().toISOString(), note: requiresQuotation ? 'Đã gửi yêu cầu tiệc lớn. Đầu bếp sẽ gửi bảng báo giá chi tiết.' : 'Đã gửi yêu cầu đặt bữa. Đang chờ đầu bếp xác nhận.' }],
    createdAt: new Date().toISOString(),
  };
  await client.query('BEGIN');
  try {
    await client.query(
      'INSERT INTO orders(id, order_code, customer_id, status, payload) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [id, orderCode, actor.id, status, JSON.stringify(order)],
    );
    await client.query(
      "INSERT INTO audit_events(actor_user_id, entity_type, entity_id, action, details, request_id) VALUES ($1, 'order', $2, 'order.created', $3::jsonb, $4)",
      [actor.id, id, JSON.stringify({ status, orderCode }), requestId || null],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return order;
}

function requireRole(actor: OrderActor, role: OrderActor['role']) {
  if (actor.role !== role) throw new OrderError('You do not have permission to change this order.', 403);
}

function requireAssignedCook(actor: OrderActor, assignedCookId: string | null) {
  requireRole(actor, 'cook');
  if (assignedCookId !== actor.id) throw new OrderError('This order is assigned to another cook.', 403);
}

function appendAudit(client: PoolClient, actor: OrderActor, orderId: string, action: string, requestId?: string, details: Record<string, unknown> = {}) {
  return client.query(
    'INSERT INTO audit_events(actor_user_id, entity_type, entity_id, action, details, request_id) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
    [actor.id, 'order', orderId, action, JSON.stringify(details), requestId || null],
  );
}

async function fileBelongsToCook(client: PoolClient, fileUrl: string, orderId: string, userId: string) {
  let parsed: URL;
  try { parsed = new URL(fileUrl, 'https://homemeal.invalid'); } catch { return false; }
  const fileId = parsed.searchParams.get('id');
  if (parsed.pathname !== appPath('/api') || parsed.searchParams.get('resource') !== 'evidence' || !fileId) return false;
  const result = await client.query(
    "SELECT 1 FROM order_files WHERE id = $1 AND order_id = $2 AND uploader_user_id = $3 AND state = 'ready'",
    [fileId, orderId, userId],
  );
  return Boolean(result.rowCount);
}

export async function mutateOrder(
  actor: OrderActor,
  orderId: string,
  action: string,
  payloadValue: unknown,
  client: PoolClient,
  requestId?: string,
): Promise<Order> {
  await client.query('BEGIN');
  try {
    const selected = await client.query(
      'SELECT o.payload, o.customer_id, o.assigned_cook_id FROM orders o WHERE o.id = $1 FOR UPDATE',
      [orderId],
    );
    const row = selected.rows[0];
    if (!row) throw new OrderError('Order not found.', 404);
    if (!canReadOrder(actor.role, actor.id, row.customer_id, row.assigned_cook_id, row.payload.status)) throw new OrderError('Order not found.', 404);
    const assignedCookId: string | null = row.assigned_cook_id;
    const order = row.payload as Order;
    const payload = object(payloadValue);
    let auditAction = `order.${action}`;

    if (action === 'update-status') {
      requireRole(actor, 'cook');
      const nextStatus = string(payload.status, 40) as OrderStatus;
      const claiming = order.status === 'awaiting_cook' && nextStatus === 'confirmed' && !assignedCookId;
      if (!canCookTransition(order.status, nextStatus, assignedCookId === actor.id, claiming)) throw new OrderError('That order status transition is not allowed.', 409);
      if (!claiming) requireAssignedCook(actor, assignedCookId);
      const note = string(payload.note, 500) || `Trạng thái chuyển sang: ${nextStatus}`;
      appendStatus(order, nextStatus, note);
      if (claiming) {
        await client.query('UPDATE orders SET assigned_cook_id = $2 WHERE id = $1', [orderId, actor.id]);
        order.cookId = actor.id;
      }
    } else if (action === 'request-budget-change') {
      requireAssignedCook(actor, assignedCookId);
      if (order.status !== 'shopping_in_progress') throw new OrderError('Budget changes can only be requested while shopping.', 409);
      const difference = boundedAmount(payload.difference, 'Budget difference');
      if (difference < 1) throw new OrderError('Budget difference must be greater than zero.');
      const request: BudgetChangeRequest = {
        id: `bcr_${randomUUID()}`,
        originalBudget: order.estimatedGroceryBudget,
        requestedBudget: boundedAmount(order.estimatedGroceryBudget + difference, 'Requested budget'),
        difference,
        reason: string(payload.reason, 500),
        affectedItem: string(payload.affectedItem, 160),
        evidencePhotoUrl: string(payload.evidencePhotoUrl, 500) || undefined,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      if (!request.reason || !request.affectedItem) throw new OrderError('Describe the reason and affected ingredient.');
      order.budgetChangeRequests = [...order.budgetChangeRequests, request];
      appendStatus(order, 'awaiting_budget_approval', `Đầu bếp yêu cầu duyệt tăng thêm ${difference} đ do giá "${request.affectedItem}" tăng.`);
    } else if (action === 'approve-budget-change' || action === 'reject-budget-change') {
      requireRole(actor, 'customer');
      if (row.customer_id !== actor.id || order.status !== 'awaiting_budget_approval') throw new OrderError('This budget request is not available to this customer.', 403);
      const requestId = string(payload.requestId, 100);
      const request = order.budgetChangeRequests.find((item) => item.id === requestId && item.status === 'pending');
      if (!request) throw new OrderError('Budget request not found.', 404);
      order.budgetChangeRequests = order.budgetChangeRequests.map((item) => item.id !== requestId ? item : {
        ...item,
        status: action === 'approve-budget-change' ? 'approved' : 'alternative_requested',
        responseNote: action === 'reject-budget-change' ? string(payload.responseNote, 500) || 'Khách yêu cầu thay thế nguyên liệu tương đương để giữ nguyên ngân sách ban đầu.' : item.responseNote,
      });
      if (action === 'approve-budget-change') order.estimatedGroceryBudget = request.requestedBudget;
      appendStatus(order, 'shopping_in_progress', action === 'approve-budget-change'
        ? `Khách hàng đã đồng ý tăng ngân sách lên ${request.requestedBudget} đ.`
        : 'Khách hàng yêu cầu tìm giải pháp thay thế, giữ nguyên định mức ngân sách cũ.');
    } else if (action === 'add-evidence-item') {
      requireAssignedCook(actor, assignedCookId);
      if (order.status !== 'shopping_in_progress') throw new OrderError('Shopping evidence can only be added while shopping.', 409);
      const value = object(payload.item);
      const receiptImageUrl = string(value.receiptImageUrl, 500);
      if (!(await fileBelongsToCook(client, receiptImageUrl, orderId, actor.id))) throw new OrderError('Upload a private receipt image before adding this item.');
      const estimatedPrice = boundedAmount(value.estimatedPrice, 'Estimated price');
      const actualPrice = boundedAmount(value.actualPrice, 'Actual price');
      if (actualPrice < 1) throw new OrderError('Actual price must be greater than zero.');
      const item: ShoppingEvidenceItem = {
        id: `shop_${randomUUID()}`,
        name: string(value.name, 160), quantity: string(value.quantity, 60), unit: string(value.unit, 40),
        estimatedPrice, actualPrice, subtotal: actualPrice,
        storeName: string(value.storeName, 160), purchaseTime: new Date().toISOString(),
        receiptImageUrl, notes: string(value.notes, 500),
        status: actualPrice > estimatedPrice ? 'price_increased' : 'purchased', approvedByCustomer: false,
      };
      if (!item.name || !item.quantity || !item.storeName) throw new OrderError('Ingredient, quantity, and store are required.');
      order.shoppingList = [...order.shoppingList, item];
      order.actualGroceryTotal = order.shoppingList.reduce((sum, current) => sum + current.subtotal, 0);
      order.finalPayableAmount = order.actualGroceryTotal + order.totalLaborFee + order.additionalServiceFee;
    } else if (action === 'delete-evidence-item') {
      requireAssignedCook(actor, assignedCookId);
      if (order.status !== 'shopping_in_progress') throw new OrderError('Shopping evidence cannot be changed after submission.', 409);
      const itemId = string(payload.itemId, 100);
      order.shoppingList = order.shoppingList.filter((item) => item.id !== itemId);
      order.actualGroceryTotal = order.shoppingList.reduce((sum, current) => sum + current.subtotal, 0);
      order.finalPayableAmount = order.actualGroceryTotal + order.totalLaborFee + order.additionalServiceFee;
    } else if (action === 'submit-quotation') {
      requireRole(actor, 'cook');
      if (order.status !== 'awaiting_quotation' || assignedCookId) throw new OrderError('This order is not waiting for a quotation.', 409);
      const value = object(payload.quotation);
      const laborFee = boundedAmount(value.laborFee, 'Labor fee');
      const assistantCount = number(value.assistantCount, 0);
      const assistantFee = boundedAmount(value.assistantFee, 'Assistant fee');
      const equipmentFee = boundedAmount(value.equipmentFee, 'Equipment fee');
      const estimatedPrepTimeHours = number(value.estimatedPrepTimeHours);
      if (laborFee < 1 || assistantCount < 0 || assistantCount > 20 || !Number.isInteger(assistantCount) || estimatedPrepTimeHours <= 0 || estimatedPrepTimeHours > 72) {
        throw new OrderError('Quotation values are outside the allowed range.');
      }
      const quotation: Quotation = {
        id: `quote_${randomUUID()}`, cookId: actor.id, cookName: actor.name, orderId,
        laborFee, assistantCount, assistantFee, equipmentFee, estimatedPrepTimeHours,
        proposedSubstitutions: string(value.proposedSubstitutions, 1000), surchargeNotes: string(value.surchargeNotes, 1000),
        totalLaborAndServices: laborFee + assistantFee + equipmentFee, status: 'pending', submittedAt: new Date().toISOString(),
      };
      order.quotation = quotation;
      order.cookId = actor.id;
      appendStatus(order, 'quotation_submitted', `Đầu bếp ${actor.name} đã gửi bảng báo giá chi tiết.`);
      await client.query('UPDATE orders SET assigned_cook_id = $2 WHERE id = $1', [orderId, actor.id]);
    } else if (action === 'accept-quotation' || action === 'reject-quotation') {
      requireRole(actor, 'customer');
      if (row.customer_id !== actor.id || !order.quotation || order.quotation.status !== 'pending') throw new OrderError('Quotation is not available to this customer.', 403);
      if (action === 'reject-quotation') {
        order.quotation = { ...order.quotation, status: 'rejected' };
        appendStatus(order, 'cancelled', 'Khách hàng từ chối báo giá. Đơn hàng kết thúc.');
      } else {
        const quotation = order.quotation;
        quotation.status = 'accepted';
        order.totalLaborFee = quotation.laborFee;
        order.additionalServiceFee = quotation.assistantFee + quotation.equipmentFee;
        order.finalPayableAmount = order.actualGroceryTotal + order.totalLaborFee + order.additionalServiceFee;
        appendStatus(order, 'confirmed', `Khách hàng đã đồng ý bảng báo giá (${quotation.totalLaborAndServices} đ).`);
      }
    } else if (action === 'file-dispute') {
      requireRole(actor, 'customer');
      if (row.customer_id !== actor.id || !['service_completed', 'awaiting_payment'].includes(order.status) || order.dispute) throw new OrderError('This order cannot accept a new dispute.', 409);
      const reportedAmount = boundedAmount(payload.reportedAmount, 'Disputed amount');
      if (reportedAmount < 1 || reportedAmount > order.actualGroceryTotal) throw new OrderError('Disputed amount must be within the grocery total.');
      const reason = string(payload.reason, 180);
      const description = string(payload.description, 1000);
      if (!reason || !description) throw new OrderError('A reason and description are required.');
      order.dispute = { id: `disp_${randomUUID()}`, reason, description, reportedAmount, status: 'open', createdAt: new Date().toISOString() };
      appendStatus(order, 'disputed', `Khách hàng gửi khiếu nại khoản tiền ${reportedAmount} đ: ${reason}.`);
    } else if (action === 'resolve-dispute') {
      requireRole(actor, 'admin');
      if (order.status !== 'disputed' || !order.dispute || order.dispute.status === 'resolved') throw new OrderError('No open dispute exists for this order.', 409);
      const resolution = string(payload.resolution, 1000);
      if (!resolution) throw new OrderError('Describe the resolution.');
      order.actualGroceryTotal = Math.max(0, order.actualGroceryTotal - order.dispute.reportedAmount);
      order.finalPayableAmount = order.actualGroceryTotal + order.totalLaborFee + order.additionalServiceFee;
      order.dispute.status = 'resolved';
      appendStatus(order, 'awaiting_payment', `Admin giải quyết: ${resolution}. Mời khách thanh toán số tiền còn lại.`);
    } else if (action === 'submit-review') {
      requireRole(actor, 'customer');
      if (row.customer_id !== actor.id || !['paid', 'completed'].includes(order.status) || order.review) throw new OrderError('This order is not available for a review.', 409);
      const value = object(payload.review);
      const scores = ['rating', 'foodQuality', 'transparency', 'professionalism', 'punctuality'].map((key) => number(value[key]));
      if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new OrderError('Review scores must be between 1 and 5.');
      order.review = {
        rating: scores[0], foodQuality: scores[1], transparency: scores[2], professionalism: scores[3], punctuality: scores[4],
        comment: string(value.comment, 1000), createdAt: new Date().toISOString(),
      };
    } else if (action === 'process-payment') {
      throw new OrderError('Online payments are not configured. The order has not been marked as paid.', 503);
    } else {
      throw new OrderError('Unsupported order action.', 404);
    }

    await client.query('UPDATE orders SET status = $2, payload = $3::jsonb, version = version + 1, updated_at = NOW() WHERE id = $1', [orderId, order.status, JSON.stringify(order)]);
    await appendAudit(client, actor, orderId, auditAction, requestId, { status: order.status });
    await client.query('COMMIT');
    return order;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
