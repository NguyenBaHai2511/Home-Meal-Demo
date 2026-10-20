import React, { FormEvent, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, ChefHat, Shield, LogOut } from 'lucide-react';

const roleLabel = (role: string) =>
  role === 'admin' ? 'Quản trị viên' : role === 'cook' ? 'Đầu bếp' : 'Khách hàng';

export const AccountPage: React.FC = () => {
  const { authUser, authLoading, login, register, logout, navigateTo, currentPath } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegister = currentPath.split(/[?#]/)[0] === '/register';

  const roleHome = (role: string) => role === 'admin' ? '/admin' : role === 'cook' ? '/cook/dashboard' : '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = isRegister
        ? await register(name, email, password)
        : await login(email, password);
      const next = new URLSearchParams(window.location.search).get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      navigateTo(safeNext || roleHome(user.role));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-[#738078]">Đang kiểm tra phiên đăng nhập…</div>;
  }

  if (authUser) {
    const RoleIcon = authUser.role === 'admin' ? Shield : authUser.role === 'cook' ? ChefHat : User;
    return (
      <section className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-[#E5ECE7] p-7 sm:p-9 shadow-sm">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-14 h-14 rounded-full bg-[#E7F5EF] text-[#285E56] flex items-center justify-center">
              <RoleIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#263B35]">Tài khoản HomeMeal</h1>
              <p className="text-sm text-[#738078]">{roleLabel(authUser.role)}</p>
            </div>
          </div>
          <dl className="space-y-4 border-y border-[#E5ECE7] py-5 text-sm">
            <div><dt className="text-[#738078]">Họ và tên</dt><dd className="font-semibold">{authUser.name}</dd></div>
            <div><dt className="text-[#738078]">Email</dt><dd className="font-semibold">{authUser.email}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={() => navigateTo(roleHome(authUser.role))} className="px-5 py-2.5 bg-[#285E56] text-white rounded-xl text-sm font-semibold">
              Vào trang {authUser.role === 'admin' ? 'quản trị' : authUser.role === 'cook' ? 'đầu bếp' : 'chủ'}
            </button>
            <button onClick={async () => { await logout().catch(() => undefined); navigateTo('/'); }} className="px-5 py-2.5 border border-[#E5ECE7] rounded-xl text-sm font-semibold inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-[#E5ECE7] p-7 sm:p-9 shadow-sm">
        <h1 className="text-2xl font-bold text-[#263B35]">{isRegister ? 'Tạo tài khoản khách hàng' : 'Đăng nhập HomeMeal'}</h1>
        <p className="mt-2 text-sm text-[#738078]">
          {isRegister ? 'Tài khoản mới mặc định có quyền Khách hàng.' : 'Đăng nhập để tiếp tục sử dụng tài khoản của bạn.'}
        </p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {isRegister && (
            <label className="block text-sm font-medium">Họ và tên
              <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" />
            </label>
          )}
          <label className="block text-sm font-medium">Email
            <input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" />
          </label>
          <label className="block text-sm font-medium">Mật khẩu
            <input required type="password" minLength={isRegister ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" />
          </label>
          {isRegister && <p className="-mt-2 text-xs text-[#738078]">Mật khẩu cần từ 12 đến 128 ký tự.</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={submitting} className="w-full rounded-xl bg-[#285E56] px-4 py-3 text-sm font-bold text-white hover:bg-[#1f4b44] disabled:opacity-60">
            {submitting ? 'Đang xử lý…' : isRegister ? 'Đăng ký khách hàng' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[#738078]">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <button onClick={() => navigateTo(isRegister ? '/login' : '/register')} className="font-semibold text-[#285E56] hover:underline">
            {isRegister ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </p>
      </div>
    </section>
  );
};
