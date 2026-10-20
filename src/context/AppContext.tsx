import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Order, Dish, Cook, UserProfile, OrderStatus, ShoppingEvidenceItem, BudgetChangeRequest, Quotation } from '../types';
import { MOCK_ORDERS, MOCK_DISHES, MOCK_COOKS, MOCK_USERS } from '../data/mockData';
import { getEarliestDeliveryDate, formatDateForInput, formatTimeForInput } from '../utils/dateTimeValidation';
import { apiUrl, currentAppPath, toAppPath } from '../utils/appPath';

interface AppContextType {
  currentUser: UserProfile;
  authUser: UserProfile | null;
  authLoading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<UserProfile>;
  register: (name: string, email: string, password: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  
  orders: Order[];
  cooks: Cook[];
  dishes: Dish[];
  
  // Draft order builder
  draftOrder: Partial<Order>;
  updateDraftOrder: (data: Partial<Order>) => void;
  resetDraftOrder: () => void;
  submitDraftOrder: () => Promise<string>;
  
  // Order actions
  getOrderById: (id: string) => Order | undefined;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  
  // Budget & evidence
  approveBudgetChange: (orderId: string, requestId: string) => void;
  rejectBudgetChange: (orderId: string, requestId: string, responseNote?: string) => void;
  requestBudgetChange: (orderId: string, request: Omit<BudgetChangeRequest, 'id' | 'status' | 'requestedAt'>) => void;
  addShoppingEvidenceItem: (orderId: string, item: Omit<ShoppingEvidenceItem, 'id'>) => void;
  uploadPrivateEvidence: (orderId: string, file: File) => Promise<string>;
  deleteShoppingEvidenceItem: (orderId: string, itemId: string) => void;
  
  // Quotations
  acceptQuotation: (orderId: string) => void;
  rejectQuotation: (orderId: string) => void;
  submitCookQuotation: (orderId: string, quotationData: Omit<Quotation, 'id' | 'orderId' | 'status' | 'submittedAt'>) => void;
  
  // Dispute & Payment
  fileDispute: (orderId: string, reason: string, description: string, reportedAmount: number) => void;
  resolveDispute: (orderId: string, adminResolution: string) => void;
  processPayment: (orderId: string, paymentMethod: string) => void;
  submitReview: (orderId: string, review: { rating: number; foodQuality: number; transparency: number; professionalism: number; punctuality: number; comment: string }) => void;
  
  // Reset demo
  resetToInitialDemoData: () => void;
  
  // Active route helper
  currentPath: string;
  navigateTo: (path: string) => void;
  
  // Global toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS.customer);
  const [orders, setOrders] = useState<Order[]>([]);

  const [currentPath, setCurrentPath] = useState<string>(() => currentAppPath());

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const applyAuthenticatedUser = (user: UserProfile) => {
    setAuthUser(user);
    setCurrentUser({ ...MOCK_USERS.customer, ...user });
  };

  useEffect(() => {
    let mounted = true;
    fetch(apiUrl('resource=auth&action=me'), { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not restore the sign-in session.');
        const result: { user: UserProfile | null } = await response.json();
        if (!mounted) return;
        if (result.user) applyAuthenticatedUser(result.user);
        else setOrders(MOCK_ORDERS);
      })
      .catch(() => { if (mounted) setOrders(MOCK_ORDERS); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let mounted = true;
    fetch(apiUrl('resource=orders'), { credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không tải được đơn hàng.');
        if (mounted) setOrders(result.orders as Order[]);
      })
      .catch((error) => { if (mounted) showToast(error instanceof Error ? error.message : 'Không tải được đơn hàng.'); });
    return () => { mounted = false; };
  }, [authUser?.id]);

  const submitAuth = async (action: 'login' | 'register', payload: Record<string, string>) => {
    const response = await fetch(apiUrl('resource=auth'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    return result as { user: UserProfile; message?: string };
  };

  const login = async (email: string, password: string, totpCode?: string) => {
    const result = await submitAuth('login', { email, password, ...(totpCode ? { totpCode } : {}) });
    const user = result.user as UserProfile;
    applyAuthenticatedUser(user);
    return user;
  };
  const register = async (name: string, email: string, password: string) => {
    const result = await submitAuth('register', { name, email, password });
    return { message: result.message || 'Kiểm tra email để xác minh tài khoản.' };
  };

  const logout = async () => {
    try {
      await fetch(apiUrl('resource=auth'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } finally {
      setAuthUser(null);
      setCurrentUser(MOCK_USERS.customer);
      setOrders(MOCK_ORDERS);
    }
  };

  // Sync route with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(currentAppPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', toAppPath(path));
    setCurrentPath(currentAppPath());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const persistOrderAction = async (orderId: string, action: string, payload: Record<string, unknown> = {}) => {
    try {
      const response = await fetch(apiUrl(`resource=orders&action=${encodeURIComponent(action)}`), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không cập nhật được đơn hàng.');
      const updatedOrder = result.order as Order;
      setOrders((current) => [updatedOrder, ...current.filter((order) => order.id !== updatedOrder.id)]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không cập nhật được đơn hàng.');
    }
  };

  const uploadPrivateEvidence = async (orderId: string, file: File) => {
    if (!authUser || authUser.role !== 'cook') throw new Error('Chỉ đầu bếp được tải chứng từ.');
    if (file.size < 1 || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Chọn ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 5 MB.');
    }
    const prepareResponse = await fetch(apiUrl('resource=evidence&action=prepare-upload'), {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, fileName: file.name, contentType: file.type, byteSize: file.size }),
    });
    const prepared = await prepareResponse.json();
    if (!prepareResponse.ok) throw new Error(prepared.error || 'Không tạo được liên kết tải ảnh.');
    const uploadResponse = await fetch(prepared.uploadUrl, { method: 'PUT', headers: prepared.headers, body: file });
    if (!uploadResponse.ok) throw new Error('Không tải được ảnh lên kho riêng tư. Kiểm tra cấu hình CORS của bucket.');
    const finalizeResponse = await fetch(apiUrl('resource=evidence&action=finalize-upload'), {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: prepared.fileId }),
    });
    const finalized = await finalizeResponse.json();
    if (!finalizeResponse.ok) throw new Error(finalized.error || 'Không xác nhận được ảnh đã tải lên.');
    return finalized.fileUrl as string;
  };

  // Draft order initial state with 4-hour advance constraint
  const earliestDelivery = getEarliestDeliveryDate();
  const initialDraftOrder: Partial<Order> = {
    serviceType: 'cook_and_deliver',
    guestCount: 4,
    date: formatDateForInput(earliestDelivery),
    servingTime: formatTimeForInput(earliestDelivery),
    mealOccasion: 'Bữa cơm gia đình',
    items: [
      { dish: MOCK_DISHES[0], quantity: 1 },
      { dish: MOCK_DISHES[1], quantity: 1 },
      { dish: MOCK_DISHES[2], quantity: 1 },
    ],
    allergies: [],
    generalPreferences: '',
    estimatedGroceryBudget: 400000,
    customerName: currentUser.name,
    customerPhone: currentUser.phone,
    customerAddress: currentUser.address,
  };

  const [draftOrder, setDraftOrder] = useState<Partial<Order>>(initialDraftOrder);
  const draftOrderRef = useRef(draftOrder);

  useEffect(() => {
    if (!authUser) return;
    const updatedDraftOrder = {
      ...draftOrderRef.current,
      customerName: authUser.name,
      customerPhone: authUser.phone,
      customerAddress: authUser.address,
    };
    draftOrderRef.current = updatedDraftOrder;
    setDraftOrder(updatedDraftOrder);
  }, [authUser]);

  const updateDraftOrder = (data: Partial<Order>) => {
    const updatedDraftOrder = { ...draftOrderRef.current, ...data };
    draftOrderRef.current = updatedDraftOrder;
    setDraftOrder(updatedDraftOrder);
  };

  const resetDraftOrder = () => {
    const resetDraft = {
      ...initialDraftOrder,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      customerAddress: currentUser.address,
    };
    draftOrderRef.current = resetDraft;
    setDraftOrder(resetDraft);
  };

  const submitDraftOrder = async (): Promise<string> => {
    if (!authUser || authUser.role !== 'customer') {
      showToast('Vui lòng đăng nhập tài khoản khách hàng để gửi đơn.');
      navigateTo(`/login?next=${encodeURIComponent(currentPath)}`);
      return '';
    }
    try {
      const draft = draftOrderRef.current;
      const response = await fetch(apiUrl('resource=orders&action=create'), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: { ...draft, items: (draft.items || []).map((item) => ({
          ...item,
          dish: /^(custom|bulk)_/.test(item.dish.id) ? item.dish : { id: item.dish.id },
        })) } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không tạo được đơn hàng.');
      const order = result.order as Order;
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
      resetDraftOrder();
      showToast(`Đã tạo đơn ${order.orderCode} thành công!`);
      return order.id;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tạo được đơn hàng.');
      return '';
    }
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find((o) => o.id === id || o.orderCode === id);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) => {
    if (authUser) { void persistOrderAction(orderId, 'update-status', { status, note }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const newHistory = [
          ...ord.statusHistory,
          {
            status,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            note: note || `Trạng thái chuyển sang: ${status}`,
          },
        ];
        return {
          ...ord,
          status,
          statusHistory: newHistory,
        };
      })
    );
  };

  // Grocery budget change approvals
  const approveBudgetChange = (orderId: string, requestId: string) => {
    if (authUser) { void persistOrderAction(orderId, 'approve-budget-change', { requestId }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const req = ord.budgetChangeRequests.find((r) => r.id === requestId);
        if (!req) return ord;

        const updatedRequests = ord.budgetChangeRequests.map((r) =>
          r.id === requestId ? { ...r, status: 'approved' as const } : r
        );

        // Adjust approved budget
        const newBudget = req.requestedBudget;
        return {
          ...ord,
          estimatedGroceryBudget: newBudget,
          status: 'shopping_in_progress',
          budgetChangeRequests: updatedRequests,
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'shopping_in_progress',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Khách hàng đã đồng ý tăng ngân sách lên ${new Intl.NumberFormat('vi-VN').format(newBudget)} đ (+${new Intl.NumberFormat('vi-VN').format(req.difference)} đ). Tiếp tục đi chợ.`,
            },
          ],
        };
      })
    );
    showToast('Đã phê duyệt điều chỉnh ngân sách đi chợ!');
  };

  const rejectBudgetChange = (orderId: string, requestId: string, responseNote?: string) => {
    if (authUser) { void persistOrderAction(orderId, 'reject-budget-change', { requestId, responseNote }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const updatedRequests = ord.budgetChangeRequests.map((r) =>
          r.id === requestId
            ? { ...r, status: 'alternative_requested' as const, responseNote: responseNote || 'Khách yêu cầu thay thế nguyên liệu tương đương để giữ nguyên ngân sách ban đầu.' }
            : r
        );
        return {
          ...ord,
          budgetChangeRequests: updatedRequests,
          status: 'shopping_in_progress',
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'shopping_in_progress',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: 'Khách hàng yêu cầu tìm giải pháp thay thế, giữ nguyên định mức ngân sách cũ.',
            },
          ],
        };
      })
    );
    showToast('Đã yêu cầu đầu bếp đổi nguyên liệu để giữ đúng ngân sách!');
  };

  const requestBudgetChange = (
    orderId: string,
    requestData: Omit<BudgetChangeRequest, 'id' | 'status' | 'requestedAt'>
  ) => {
    if (authUser) { void persistOrderAction(orderId, 'request-budget-change', requestData as unknown as Record<string, unknown>); return; }
    const newReq: BudgetChangeRequest = {
      ...requestData,
      id: 'bcr_' + Date.now(),
      status: 'pending',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          status: 'awaiting_budget_approval',
          budgetChangeRequests: [...ord.budgetChangeRequests, newReq],
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'awaiting_budget_approval',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Đầu bếp yêu cầu duyệt tăng thêm ${new Intl.NumberFormat('vi-VN').format(requestData.difference)} đ do giá "${requestData.affectedItem}" tăng.`,
            },
          ],
        };
      })
    );
    showToast('Đã gửi yêu cầu điều chỉnh ngân sách tới khách hàng!');
  };

  const addShoppingEvidenceItem = (orderId: string, itemData: Omit<ShoppingEvidenceItem, 'id'>) => {
    if (authUser) { void persistOrderAction(orderId, 'add-evidence-item', { item: itemData as unknown as Record<string, unknown> }); return; }
    const newItem: ShoppingEvidenceItem = {
      ...itemData,
      id: 'shop_' + Date.now(),
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const updatedList = [...ord.shoppingList, newItem];
        const actualGroceryTotal = updatedList.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const finalPayableAmount = actualGroceryTotal + ord.totalLaborFee + ord.deliveryFee + ord.additionalServiceFee;

        return {
          ...ord,
          shoppingList: updatedList,
          actualGroceryTotal,
          finalPayableAmount,
        };
      })
    );
    showToast(`Đã thêm nguyên liệu: ${itemData.name}`);
  };

  const deleteShoppingEvidenceItem = (orderId: string, itemId: string) => {
    if (authUser) { void persistOrderAction(orderId, 'delete-evidence-item', { itemId }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const updatedList = ord.shoppingList.filter((item) => item.id !== itemId);
        const actualGroceryTotal = updatedList.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const finalPayableAmount = actualGroceryTotal + ord.totalLaborFee + ord.deliveryFee + ord.additionalServiceFee;

        return {
          ...ord,
          shoppingList: updatedList,
          actualGroceryTotal,
          finalPayableAmount,
        };
      })
    );
    showToast('Đã xóa món khỏi danh sách đi chợ');
  };

  // Quotation workflows
  const acceptQuotation = (orderId: string) => {
    if (authUser) { void persistOrderAction(orderId, 'accept-quotation'); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId || !ord.quotation) return ord;
        const acceptedQuote = { ...ord.quotation, status: 'accepted' as const };
        const totalLaborFee = acceptedQuote.laborFee;
        const additionalServiceFee = acceptedQuote.assistantFee + acceptedQuote.equipmentFee;
        const totalServiceFee = totalLaborFee + additionalServiceFee;
        const finalPayableAmount =
          ord.actualGroceryTotal + totalLaborFee + ord.deliveryFee + additionalServiceFee;

        return {
          ...ord,
          quotation: acceptedQuote,
          totalLaborFee,
          additionalServiceFee,
          finalPayableAmount,
          status: 'confirmed',
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'confirmed',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Khách hàng đã đồng ý bảng báo giá (${new Intl.NumberFormat('vi-VN').format(totalServiceFee)} đ). Đơn hàng đã chính thức được chốt!`,
            },
          ],
        };
      })
    );
    showToast('Đã chấp thuận báo giá tiệc thành công!');
  };

  const rejectQuotation = (orderId: string) => {
    if (authUser) { void persistOrderAction(orderId, 'reject-quotation'); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId || !ord.quotation) return ord;
        return {
          ...ord,
          quotation: { ...ord.quotation, status: 'rejected' as const },
          status: 'cancelled',
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'cancelled',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: 'Khách hàng từ chối báo giá. Đơn hàng kết thúc.',
            },
          ],
        };
      })
    );
    showToast('Đã từ chối báo giá.');
  };

  const submitCookQuotation = (
    orderId: string,
    quotationData: Omit<Quotation, 'id' | 'orderId' | 'status' | 'submittedAt'>
  ) => {
    if (authUser) { void persistOrderAction(orderId, 'submit-quotation', { quotation: quotationData as unknown as Record<string, unknown> }); return; }
    const newQuote: Quotation = {
      ...quotationData,
      id: 'quote_' + Date.now(),
      orderId,
      status: 'pending',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          quotation: newQuote,
          status: 'quotation_submitted',
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'quotation_submitted',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Đầu bếp ${quotationData.cookName} đã gửi bảng báo giá chi tiết gồm ${quotationData.assistantCount} phụ bếp và công nấu.`,
            },
          ],
        };
      })
    );
    showToast('Đã gửi báo giá tới khách hàng!');
  };

  // Disputes & payments
  const fileDispute = (
    orderId: string,
    reason: string,
    description: string,
    reportedAmount: number
  ) => {
    if (authUser) { void persistOrderAction(orderId, 'file-dispute', { reason, description, reportedAmount }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          status: 'disputed',
          dispute: {
            id: 'disp_' + Date.now(),
            reason,
            description,
            reportedAmount,
            status: 'open',
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          },
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'disputed',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Khách hàng khiếu nại khoản tiền: ${new Intl.NumberFormat('vi-VN').format(reportedAmount)} đ. Lý do: ${reason}. Hệ thống tạm khóa thanh toán.`,
            },
          ],
        };
      })
    );
    showToast('Đã ghi nhận khiếu nại. HomeMeal và đầu bếp sẽ phản hồi trong 30 phút.');
  };

  const resolveDispute = (orderId: string, adminResolution: string) => {
    if (authUser) { void persistOrderAction(orderId, 'resolve-dispute', { resolution: adminResolution }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId || !ord.dispute) return ord;
        const adjustedActualGrocery = Math.max(0, ord.actualGroceryTotal - (ord.dispute.reportedAmount || 0));
        const newTotal =
          adjustedActualGrocery + ord.totalLaborFee + ord.deliveryFee + ord.additionalServiceFee;

        return {
          ...ord,
          actualGroceryTotal: adjustedActualGrocery,
          finalPayableAmount: newTotal,
          status: 'awaiting_payment',
          dispute: {
            ...ord.dispute,
            status: 'resolved',
          },
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'awaiting_payment',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Admin giải quyết: ${adminResolution}. Đã khấu trừ khoản không rõ chứng từ. Mời khách thanh toán số tiền còn lại.`,
            },
          ],
        };
      })
    );
    showToast('Đã xử lý tranh chấp và cập nhật hóa đơn!');
  };

  const processPayment = (orderId: string, paymentMethod: string) => {
    if (authUser) { void persistOrderAction(orderId, 'process-payment', { paymentMethod }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          status: 'paid',
          statusHistory: [
            ...ord.statusHistory,
            {
              status: 'paid',
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
              note: `Thanh toán thành công qua phương thức: ${paymentMethod}. Toàn bộ dịch vụ hoàn tất tốt đẹp!`,
            },
          ],
        };
      })
    );
    showToast('Thanh toán thành công! Cảm ơn bạn đã tin dùng HomeMeal.');
  };

  const submitReview = (
    orderId: string,
    review: { rating: number; foodQuality: number; transparency: number; professionalism: number; punctuality: number; comment: string }
  ) => {
    if (authUser) { void persistOrderAction(orderId, 'submit-review', { review: review as unknown as Record<string, unknown> }); return; }
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          review: {
            ...review,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          },
        };
      })
    );
    showToast('Cảm ơn bạn đã gửi đánh giá bữa ăn!');
  };

  const resetToInitialDemoData = () => {
    if (authUser) { showToast('Dữ liệu production được quản lý ở server.'); return; }
    setOrders(MOCK_ORDERS);
    showToast('Đã khôi phục dữ liệu mẫu ban đầu!');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authUser,
        authLoading,
        login,
        register,
        logout,
        orders,
        cooks: MOCK_COOKS,
        dishes: MOCK_DISHES,
        draftOrder,
        updateDraftOrder,
        resetDraftOrder,
        submitDraftOrder,
        getOrderById,
        updateOrderStatus,
        approveBudgetChange,
        rejectBudgetChange,
        requestBudgetChange,
        addShoppingEvidenceItem,
        uploadPrivateEvidence,
        deleteShoppingEvidenceItem,
        acceptQuotation,
        rejectQuotation,
        submitCookQuotation,
        fileDispute,
        resolveDispute,
        processPayment,
        submitReview,
        resetToInitialDemoData,
        currentPath,
        navigateTo,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
