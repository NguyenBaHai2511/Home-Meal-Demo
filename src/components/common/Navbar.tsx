import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ChefHat, ShoppingBag, User, Shield, Menu, X, RefreshCw, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { authUser, currentPath, navigateTo, orders, resetToInitialDemoData, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pendingActionsCount = orders.filter((order) =>
    ['service_completed', 'awaiting_budget_approval', 'quotation_submitted', 'disputed'].includes(order.status),
  ).length;

  const isActive = (path: string) => path === '/' ? currentPath === '/' : currentPath.startsWith(path);
  const navLinks = [
    { label: 'Trang chủ', path: '/' },
    { label: 'Đặt bữa ăn', path: '/meal-planner' },
    { label: 'Thực đơn', path: '/menu' },
    { label: 'AI Gợi Ý Thực Đơn', path: '/smart-menu' },
    { label: 'Đầu bếp', path: '/cooks' },
    { label: 'Tiệc & Mâm cỗ', path: '/party-booking' },
    { label: 'Đơn hàng', path: '/orders', badge: pendingActionsCount || undefined },
  ];

  const roleAction = authUser?.role === 'cook'
    ? { label: 'Góc Đầu Bếp', path: '/cook/dashboard', icon: <ChefHat className="w-4 h-4" /> }
    : authUser?.role === 'admin'
      ? { label: 'Trang Quản Trị', path: '/admin', icon: <Shield className="w-4 h-4" /> }
      : authUser
        ? { label: 'Đặt đầu bếp tới nhà', path: '/meal-planner', icon: <ShoppingBag className="w-4 h-4" /> }
        : { label: 'Đăng nhập', path: '/login', icon: <User className="w-4 h-4" /> };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF7]/95 backdrop-blur-md border-b border-[#E5ECE7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-5">
        <button onClick={() => navigateTo('/')} className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#285E56] whitespace-nowrap shrink-0 text-left">
          <span className="w-9 h-9 rounded-lg bg-[#285E56] text-[#FFFDF7] flex items-center justify-center text-lg">H</span>
          <span className="flex flex-col"><span className="leading-none">HomeMeal</span><span className="text-[10px] font-normal text-[#738078] hidden sm:block">Nấu cơm & Đi chợ minh bạch</span></span>
        </button>

        <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-[#263B35]">
          {navLinks.map((link) => (
            <button key={link.path} onClick={() => navigateTo(link.path)} className={`relative whitespace-nowrap py-1 hover:text-[#285E56] ${isActive(link.path) ? 'text-[#285E56] font-semibold border-b-2 border-[#285E56]' : ''}`}>
              {link.label}{link.badge ? <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[#F2AD72] rounded-full">{link.badge}</span> : null}
            </button>
          ))}
          <button onClick={() => navigateTo('/support')} className="whitespace-nowrap text-[#738078] hover:text-[#285E56]">Hỗ trợ & Chính sách</button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigateTo(roleAction.path)} className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#285E56] rounded-lg hover:bg-[#1f4b44]">
            {roleAction.icon}<span>{roleAction.label}</span>
          </button>
          <button onClick={() => navigateTo('/account')} title={authUser ? `Tài khoản: ${authUser.name}` : 'Đăng nhập'} className="p-2 rounded-lg border border-[#E5ECE7] bg-white hover:text-[#285E56]">
            <User className="w-4 h-4" />
          </button>
          {authUser && <button onClick={() => { void logout().catch(() => undefined).finally(() => navigateTo('/')); }} title="Đăng xuất" className="hidden sm:inline-flex p-2 rounded-lg border border-[#E5ECE7] bg-white hover:text-[#285E56]"><LogOut className="w-4 h-4" /></button>}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="xl:hidden p-2 rounded-lg hover:bg-[#E7F5EF]" aria-label="Mở menu">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-[#E5ECE7] bg-[#FFFDF7] px-4 pt-3 pb-5 space-y-1">
          {navLinks.map((link) => (
            <button key={link.path} onClick={() => { navigateTo(link.path); closeMobileMenu(); }} className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between ${isActive(link.path) ? 'bg-[#E7F5EF] text-[#285E56] font-semibold' : 'hover:bg-stone-50'}`}>
              <span>{link.label}</span>{link.badge ? <span className="px-2 py-0.5 text-xs bg-[#F2AD72] rounded-full">{link.badge}</span> : null}
            </button>
          ))}
          <button onClick={() => { navigateTo('/support'); closeMobileMenu(); }} className="w-full text-left px-3 py-2.5 text-sm text-[#738078] rounded-lg hover:bg-stone-50">Hỗ trợ & Chính sách</button>
          <button onClick={() => { navigateTo(roleAction.path); closeMobileMenu(); }} className="w-full text-left px-3 py-2.5 text-sm font-semibold text-[#285E56] rounded-lg hover:bg-[#E7F5EF]">{roleAction.label}</button>
          {authUser && <button onClick={() => { void logout().catch(() => undefined).finally(() => { navigateTo('/'); closeMobileMenu(); }); }} className="w-full text-left px-3 py-2.5 text-sm text-[#738078] rounded-lg hover:bg-stone-50">Đăng xuất</button>}
          <button onClick={resetToInitialDemoData} className="inline-flex items-center gap-2 px-3 py-2 text-xs text-[#738078]"><RefreshCw className="w-3.5 h-3.5" /> Khôi phục dữ liệu mẫu</button>
        </div>
      )}
    </header>
  );
};
