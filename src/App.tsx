import React, { Suspense, lazy, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { NotificationToast } from './components/common/NotificationToast';

import { HomePage } from './components/views/HomePage';
import { SupportPage } from './components/views/SupportPage';
const MealPlannerPage = lazy(() => import('./components/views/MealPlannerPage').then((module) => ({ default: module.MealPlannerPage })));
const MenuPage = lazy(() => import('./components/views/MenuPage').then((module) => ({ default: module.MenuPage })));
const SmartMenuPage = lazy(() => import('./components/views/SmartMenuPage').then((module) => ({ default: module.SmartMenuPage })));
const CooksPage = lazy(() => import('./components/views/CooksPage').then((module) => ({ default: module.CooksPage })));
const CookDetailPage = lazy(() => import('./components/views/CookDetailPage').then((module) => ({ default: module.CookDetailPage })));
const PartyBookingPage = lazy(() => import('./components/views/PartyBookingPage').then((module) => ({ default: module.PartyBookingPage })));
const OrdersPage = lazy(() => import('./components/views/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const OrderDetailPage = lazy(() => import('./components/views/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })));
const OrderBillPage = lazy(() => import('./components/views/OrderBillPage').then((module) => ({ default: module.OrderBillPage })));
const QuotationsPage = lazy(() => import('./components/views/QuotationsPage').then((module) => ({ default: module.QuotationsPage })));
const AccountPage = lazy(() => import('./components/views/AccountPage').then((module) => ({ default: module.AccountPage })));
const NotFoundPage = lazy(() => import('./components/views/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const CookDashboardPage = lazy(() => import('./components/views/cook/CookDashboardPage').then((module) => ({ default: module.CookDashboardPage })));
const CookShoppingPage = lazy(() => import('./components/views/cook/CookShoppingPage').then((module) => ({ default: module.CookShoppingPage })));
const CookEarningsPage = lazy(() => import('./components/views/cook/CookEarningsPage').then((module) => ({ default: module.CookEarningsPage })));
const AdminDashboardPage = lazy(() => import('./components/views/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));

const AppContent: React.FC = () => {
  const { currentPath, authUser, authLoading, navigateTo } = useApp();
  const pathname = currentPath.split(/[?#]/)[0] || '/';
  const requiredRole = (pathname === '/admin' || pathname.startsWith('/admin/'))
    ? 'admin'
    : (pathname === '/cook' || pathname.startsWith('/cook/'))
      ? 'cook'
      : pathname === '/orders' || pathname.startsWith('/orders/') || pathname === '/quotations' || pathname === '/party-booking'
        ? 'customer'
        : null;

  useEffect(() => {
    if (!requiredRole || authLoading) return;
    if (!authUser) {
      navigateTo(`/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (authUser.role !== requiredRole) {
      navigateTo(authUser.role === 'admin' ? '/admin' : authUser.role === 'cook' ? '/cook/dashboard' : '/');
    }
  }, [authLoading, authUser, currentPath, navigateTo, requiredRole]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [currentPath]);

  // Route matching
  const renderCurrentView = () => {
    if (requiredRole && authLoading) {
      return <div className="px-4 py-20 text-center text-sm text-muted">Đang kiểm tra quyền truy cập…</div>;
    }
    if (requiredRole && !authUser) {
      return <div className="px-4 py-20 text-center text-sm text-muted">Đang chuyển đến trang đăng nhập…</div>;
    }
    if (requiredRole && authUser?.role !== requiredRole) {
      return <div className="px-4 py-20 text-center text-sm text-muted">Bạn không có quyền truy cập trang này.</div>;
    }

    // 1. Static Exact Routes
    if (pathname === '/') return <HomePage />;
    if (pathname === '/meal-planner') return <MealPlannerPage />;
    if (pathname === '/menu') return <MenuPage />;
    if (pathname === '/smart-menu') return <SmartMenuPage />;
    if (pathname === '/cooks') return <CooksPage />;
    if (pathname === '/party-booking') return <PartyBookingPage />;
    if (pathname === '/quotations') return <QuotationsPage />;
    if (pathname === '/orders') return <OrdersPage />;
    if (pathname === '/account' || pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password') return <AccountPage />;
    if (pathname === '/support') return <SupportPage />;

    // 2. Cook Routes
    if (pathname === '/cook/dashboard' || pathname === '/cook/orders') return <CookDashboardPage />;
    if (pathname === '/cook/shopping') return <CookShoppingPage />;
    if (pathname === '/cook/earnings') return <CookEarningsPage />;

    // 3. Admin Routes
    if (
      pathname === '/admin' ||
      pathname === '/admin/orders' ||
      pathname === '/admin/cooks' ||
      pathname === '/admin/disputes' ||
      pathname === '/admin/payments'
    ) {
      return <AdminDashboardPage />;
    }

    // 4. Dynamic Parameter Routes:
    // /cooks/:id
    if (pathname.startsWith('/cooks/')) {
      const cookId = pathname.replace('/cooks/', '');
      return <CookDetailPage cookId={cookId} />;
    }

    // /orders/:id/bill or /orders/:id/payment
    if (pathname.match(/^\/orders\/[^/]+\/(bill|payment)$/)) {
      const match = pathname.match(/^\/orders\/([^/]+)\/(bill|payment)$/);
      const orderId = match ? match[1] : '';
      return <OrderBillPage orderId={orderId} />;
    }

    // /orders/:id or /cook/orders/:id
    if (pathname.startsWith('/orders/')) {
      const orderId = pathname.replace('/orders/', '').split('/')[0];
      return <OrderDetailPage orderId={orderId} />;
    }
    if (pathname.startsWith('/cook/orders/')) {
      const orderId = pathname.replace('/cook/orders/', '').split('/')[0];
      return <OrderDetailPage orderId={orderId} />;
    }

    // 5. Fallback 404
    return <NotFoundPage />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <a href="#main-content" className="skip-link">Bỏ qua điều hướng</a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Suspense fallback={<div role="status" className="px-4 py-16 text-center text-sm text-muted">Đang mở trang…</div>}>
          {renderCurrentView()}
        </Suspense>
      </main>
      <Footer />
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
