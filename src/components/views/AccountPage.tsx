import React, { FormEvent, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, ChefHat, Shield, LogOut, Pencil, Save, X } from 'lucide-react';
import { apiUrl } from '../../utils/appPath';

const roleLabel = (role: string) => role === 'admin' ? 'Quản trị viên' : role === 'cook' ? 'Đầu bếp' : 'Khách hàng';

export const AccountPage: React.FC = () => {
  const { authUser, authLoading, login, register, logout, updateProfile, navigateTo, currentPath } = useApp();
  const pathname = currentPath.split(/[?#]/)[0] || '/account';
  const query = new URLSearchParams(currentPath.split('?')[1]?.split('#')[0] || '');
  const isRegister = pathname === '/register';
  const isForgot = pathname === '/forgot-password';
  const isReset = pathname === '/reset-password';
  const isVerify = pathname === '/verify-email';
  const resetToken = query.get('token') || '';
  const verifyToken = query.get('token') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');

  useEffect(() => {
    if (!authUser) return;
    setProfileName(authUser.name || '');
    setProfilePhone(authUser.phone || '');
    setProfileAddress(authUser.address || '');
  }, [authUser]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setSubmitting(true);
    try {
      await updateProfile({ name: profileName.trim(), phone: profilePhone.trim(), address: profileAddress.trim() });
      setEditingProfile(false); setNotice('Đã lưu thông tin tài khoản.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được hồ sơ.'); }
    finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (!isVerify || !verifyToken) return;
    let mounted = true;
    fetch(apiUrl('resource=auth&action=verify-email'), {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không xác minh được email.');
      if (mounted) { setNotice('Email đã được xác minh. Bạn có thể đăng nhập.'); navigateTo('/login'); }
    }).catch((verifyError) => { if (mounted) setError(verifyError instanceof Error ? verifyError.message : 'Liên kết xác minh không hợp lệ.'); });
    return () => { mounted = false; };
  }, [isVerify, verifyToken, navigateTo]);

  const roleHome = (role: string) => role === 'admin' ? '/admin' : role === 'cook' ? '/cook/dashboard' : '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (isRegister) {
        const result = await register(name, email, password);
        setPassword('');
        setNotice(result.message);
      } else if (isForgot) {
        const response = await fetch(apiUrl('resource=auth&action=request-password-reset'), {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không gửi được yêu cầu.');
        setNotice(result.message);
      } else if (isReset) {
        const response = await fetch(apiUrl('resource=auth&action=reset-password'), {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không đặt lại được mật khẩu.');
        setPassword('');
        setNotice('Mật khẩu đã được đổi. Đăng nhập bằng mật khẩu mới.');
        navigateTo('/login');
      } else {
        const user = await login(email, password);
        const next = new URLSearchParams(window.location.search).get('next');
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
        navigateTo(safeNext || roleHome(user.role));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    setError('');
    try {
      const response = await fetch(apiUrl('resource=auth&action=resend-verification'), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không gửi lại được email.');
      setNotice(result.message);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Không gửi lại được email.');
    }
  };

  if (authLoading) return <div className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-muted">Đang kiểm tra phiên đăng nhập…</div>;

  if (authUser && !isVerify && !isForgot && !isReset && !isRegister) {
    const RoleIcon = authUser.role === 'admin' ? Shield : authUser.role === 'cook' ? ChefHat : User;
    return (
      <section className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-xl border border-border-soft p-7 sm:p-9">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-14 h-14 rounded-full bg-surface-alt text-accent flex items-center justify-center"><RoleIcon className="w-6 h-6" /></div>
            <div className="min-w-0"><h1 className="editorial-title text-3xl text-ink">Tài khoản HomeMeal</h1><p className="text-sm text-muted">{roleLabel(authUser.role)}</p></div>
          </div>
          <div className="border-y border-border-soft py-5">
            {editingProfile ? <form onSubmit={(event) => void saveProfile(event)} className="space-y-4 text-sm">
              <label className="block font-medium">Họ và tên<input required minLength={2} maxLength={100} value={profileName} onChange={(event) => setProfileName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3" /></label>
              <label className="block font-medium">Số điện thoại<input maxLength={32} value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3" /></label>
              <label className="block font-medium">Địa chỉ<input maxLength={300} value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} autoComplete="street-address" className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3" /></label>
              <div className="flex gap-2"><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />Lưu thay đổi</button><button type="button" onClick={() => { setEditingProfile(false); setError(''); }} className="inline-flex items-center gap-2 rounded-xl border border-border-soft px-4 py-2.5 font-semibold"><X className="h-4 w-4" />Hủy</button></div>
            </form> : <dl className="space-y-4 text-sm break-words">
              <div><dt className="text-muted">Họ và tên</dt><dd className="font-semibold">{authUser.name}</dd></div>
              <div><dt className="text-muted">Email</dt><dd className="font-semibold">{authUser.email}</dd></div>
              <div><dt className="text-muted">Số điện thoại</dt><dd className="font-semibold">{authUser.phone || 'Chưa cập nhật'}</dd></div>
              <div><dt className="text-muted">Địa chỉ</dt><dd className="font-semibold">{authUser.address || 'Chưa cập nhật'}</dd></div>
            </dl>}
          </div>
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3 mt-6">
            {!editingProfile && <button onClick={() => { setError(''); setNotice(''); setEditingProfile(true); }} className="px-5 py-2.5 border border-border-soft rounded-xl text-sm font-semibold inline-flex items-center gap-2"><Pencil className="w-4 h-4" />Chỉnh sửa hồ sơ</button>}
            <button onClick={() => navigateTo(roleHome(authUser.role))} className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold">Vào trang {authUser.role === 'admin' ? 'quản trị' : authUser.role === 'cook' ? 'đầu bếp' : 'chủ'}</button>
            <button onClick={async () => { await logout().catch(() => undefined); navigateTo('/'); }} className="px-5 py-2.5 border border-border-soft rounded-xl text-sm font-semibold inline-flex items-center gap-2"><LogOut className="w-4 h-4" /> Đăng xuất</button>
          </div>
        </div>
      </section>
    );
  }

  const title = isVerify ? 'Xác minh email' : isForgot ? 'Quên mật khẩu' : isReset ? 'Đặt lại mật khẩu' : isRegister ? 'Tạo tài khoản khách hàng' : 'Đăng nhập HomeMeal';
  const showPassword = !isForgot && !isVerify;
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid md:grid-cols-2 gap-8 lg:gap-16 items-start">
      <aside className="py-4 md:py-10">
        <p className="eyebrow text-detail">HomeMeal · Bữa cơm chân tình</p>
        <h2 className="editorial-title page-title text-accent mt-5">Về nhà,<br /> có bữa cơm ngon.</h2>
        <p className="mt-5 text-sm text-muted max-w-sm">Lưu thông tin của bạn, lên kế hoạch bữa ăn và theo dõi từng bước chuẩn bị ngay tại HomeMeal.</p>
        <div className="hidden md:block mt-10 pt-6 border-t border-border-soft text-sm text-muted space-y-3"><p>01 · Chọn món theo khẩu vị gia đình</p><p>02 · Chủ động ngân sách đi chợ</p><p>03 · Theo dõi hóa đơn minh bạch</p></div>
      </aside>
      <div className="min-w-0 bg-white rounded-xl border border-border-soft p-6 sm:p-9">
        <h1 className="editorial-title text-3xl text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {isRegister ? 'Tài khoản mới mặc định có quyền Khách hàng. Xác minh email trước khi đăng nhập.' : isVerify ? 'Đang kiểm tra liên kết xác minh của bạn.' : isForgot ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.' : isReset ? 'Đặt mật khẩu mới từ 12 đến 128 ký tự.' : 'Đăng nhập để tiếp tục sử dụng tài khoản của bạn.'}
        </p>
        {isVerify ? <div className="mt-6 space-y-3">{notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}<button onClick={() => navigateTo('/login')} className="font-semibold text-accent">Đến trang đăng nhập</button></div> : (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-7 space-y-4">
            {isRegister && <label className="block text-sm font-medium">Họ và tên<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent" /></label>}
            {!isReset && <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent" /></label>}
            {showPassword && <label className="block text-sm font-medium">Mật khẩu<input required type="password" minLength={isRegister || isReset ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister || isReset ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-border-soft px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent" /></label>}
            {isRegister && <p className="-mt-2 text-xs text-muted">Mật khẩu cần từ 12 đến 128 ký tự.</p>}
            {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
            {error.includes('Verify your email') && <button type="button" onClick={() => void resendVerification()} className="text-sm font-semibold text-accent">Gửi lại email xác minh</button>}
            <button disabled={submitting} className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-60">{submitting ? 'Đang xử lý…' : isRegister ? 'Đăng ký khách hàng' : isForgot ? 'Gửi liên kết' : isReset ? 'Đổi mật khẩu' : 'Đăng nhập'}</button>
          </form>
        )}
        {!isVerify && <p className="mt-6 text-center text-sm text-muted">
          {isRegister ? 'Đã có tài khoản?' : isForgot || isReset ? 'Nhớ mật khẩu?' : 'Chưa có tài khoản?'}{' '}
          <button onClick={() => navigateTo(isRegister ? '/login' : isForgot || isReset ? '/login' : '/register')} className="font-semibold text-accent hover:underline">{isRegister || isForgot || isReset ? 'Đăng nhập' : 'Đăng ký'}</button>
          {!isRegister && !isForgot && !isReset && <><span className="mx-2">·</span><button onClick={() => navigateTo('/forgot-password')} className="font-semibold text-accent hover:underline">Quên mật khẩu?</button></>}
        </p>}
      </div>
    </section>
  );
};
