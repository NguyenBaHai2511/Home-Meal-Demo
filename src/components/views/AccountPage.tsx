import React, { FormEvent, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, ChefHat, Shield, LogOut, KeyRound } from 'lucide-react';
import { apiUrl } from '../../utils/appPath';

const roleLabel = (role: string) => role === 'admin' ? 'Quản trị viên' : role === 'cook' ? 'Đầu bếp' : 'Khách hàng';

export const AccountPage: React.FC = () => {
  const { authUser, authLoading, login, register, logout, navigateTo, currentPath } = useApp();
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
  const [totpCode, setTotpCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(authUser?.mfaEnabled));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => { setMfaEnabled(Boolean(authUser?.mfaEnabled)); }, [authUser?.mfaEnabled]);

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
        const user = await login(email, password, totpCode);
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

  const startMfa = async () => {
    setMfaBusy(true); setError('');
    try {
      const response = await fetch(apiUrl('resource=auth&action=mfa-setup'), { method: 'POST', credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không bắt đầu được thiết lập MFA.');
      setMfaSecret(result.secret);
      setNotice('Thêm khóa bí mật vào ứng dụng xác thực, rồi nhập mã 6 chữ số để bật MFA.');
    } catch (mfaError) { setError(mfaError instanceof Error ? mfaError.message : 'Không bắt đầu được thiết lập MFA.'); }
    finally { setMfaBusy(false); }
  };

  const finishMfa = async (action: 'mfa-enable' | 'mfa-disable') => {
    setMfaBusy(true); setError('');
    try {
      const response = await fetch(apiUrl(`resource=auth&action=${action}`), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: mfaCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không cập nhật được MFA.');
      setMfaEnabled(Boolean(result.mfaEnabled)); setMfaSecret(''); setMfaCode('');
      setNotice(result.mfaEnabled ? 'MFA đã được bật cho tài khoản quản trị.' : 'MFA đã được tắt.');
    } catch (mfaError) { setError(mfaError instanceof Error ? mfaError.message : 'Không cập nhật được MFA.'); }
    finally { setMfaBusy(false); }
  };

  if (authLoading) return <div className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-[#738078]">Đang kiểm tra phiên đăng nhập…</div>;

  if (authUser && !isVerify && !isForgot && !isReset && !isRegister) {
    const RoleIcon = authUser.role === 'admin' ? Shield : authUser.role === 'cook' ? ChefHat : User;
    return (
      <section className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-[#E5ECE7] p-7 sm:p-9 shadow-sm">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-14 h-14 rounded-full bg-[#E7F5EF] text-[#285E56] flex items-center justify-center"><RoleIcon className="w-6 h-6" /></div>
            <div><h1 className="text-2xl font-bold text-[#263B35]">Tài khoản HomeMeal</h1><p className="text-sm text-[#738078]">{roleLabel(authUser.role)}</p></div>
          </div>
          <dl className="space-y-4 border-y border-[#E5ECE7] py-5 text-sm">
            <div><dt className="text-[#738078]">Họ và tên</dt><dd className="font-semibold">{authUser.name}</dd></div>
            <div><dt className="text-[#738078]">Email</dt><dd className="font-semibold">{authUser.email}</dd></div>
          </dl>
          {authUser.role === 'admin' && (
            <div className="mt-6 rounded-2xl border border-[#E5ECE7] p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Xác thực nhiều lớp (MFA)</h2>
              <p className="text-xs text-[#738078]">MFA yêu cầu mã từ ứng dụng xác thực mỗi lần đăng nhập admin.</p>
              {!mfaEnabled && !mfaSecret && <button disabled={mfaBusy} onClick={() => void startMfa()} className="px-4 py-2 rounded-lg bg-[#285E56] text-white text-sm font-semibold disabled:opacity-60">Thiết lập MFA</button>}
              {mfaSecret && <div className="space-y-2"><p className="text-xs">Nhập khóa này thủ công vào ứng dụng Authenticator:</p><code className="block break-all rounded bg-stone-50 p-3 text-xs">{mfaSecret}</code><p className="text-xs text-[#738078]">Ứng dụng: Google Authenticator, Microsoft Authenticator hoặc tương thích TOTP.</p></div>}
              {(mfaSecret || mfaEnabled) && <div className="flex gap-2"><input aria-label="Mã MFA" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Mã 6 chữ số" className="min-w-0 flex-1 rounded-lg border border-[#E5ECE7] px-3 py-2 text-sm" /><button disabled={mfaBusy || mfaCode.length !== 6} onClick={() => void finishMfa(mfaEnabled ? 'mfa-disable' : 'mfa-enable')} className="px-4 py-2 rounded-lg border border-[#285E56] text-[#285E56] text-sm font-semibold disabled:opacity-50">{mfaEnabled ? 'Tắt MFA' : 'Xác nhận bật'}</button></div>}
            </div>
          )}
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={() => navigateTo(roleHome(authUser.role))} className="px-5 py-2.5 bg-[#285E56] text-white rounded-xl text-sm font-semibold">Vào trang {authUser.role === 'admin' ? 'quản trị' : authUser.role === 'cook' ? 'đầu bếp' : 'chủ'}</button>
            <button onClick={async () => { await logout().catch(() => undefined); navigateTo('/'); }} className="px-5 py-2.5 border border-[#E5ECE7] rounded-xl text-sm font-semibold inline-flex items-center gap-2"><LogOut className="w-4 h-4" /> Đăng xuất</button>
          </div>
        </div>
      </section>
    );
  }

  const title = isVerify ? 'Xác minh email' : isForgot ? 'Quên mật khẩu' : isReset ? 'Đặt lại mật khẩu' : isRegister ? 'Tạo tài khoản khách hàng' : 'Đăng nhập HomeMeal';
  const showPassword = !isForgot && !isVerify;
  return (
    <section className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-[#E5ECE7] p-7 sm:p-9 shadow-sm">
        <h1 className="text-2xl font-bold text-[#263B35]">{title}</h1>
        <p className="mt-2 text-sm text-[#738078]">
          {isRegister ? 'Tài khoản mới mặc định có quyền Khách hàng. Xác minh email trước khi đăng nhập.' : isVerify ? 'Đang kiểm tra liên kết xác minh của bạn.' : isForgot ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.' : isReset ? 'Đặt mật khẩu mới từ 12 đến 128 ký tự.' : 'Đăng nhập để tiếp tục sử dụng tài khoản của bạn.'}
        </p>
        {isVerify ? <div className="mt-6 space-y-3">{notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}<button onClick={() => navigateTo('/login')} className="font-semibold text-[#285E56]">Đến trang đăng nhập</button></div> : (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-7 space-y-4">
            {isRegister && <label className="block text-sm font-medium">Họ và tên<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" /></label>}
            {!isReset && <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" /></label>}
            {showPassword && <label className="block text-sm font-medium">Mật khẩu<input required type="password" minLength={isRegister || isReset ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister || isReset ? 'new-password' : 'current-password'} className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" /></label>}
            {!isRegister && !isReset && !isForgot && <label className="block text-sm font-medium">Mã Authenticator (nếu admin đã bật MFA)<input inputMode="numeric" maxLength={6} value={totpCode} onChange={(event) => setTotpCode(event.target.value)} autoComplete="one-time-code" className="mt-1.5 w-full rounded-xl border border-[#E5ECE7] px-3.5 py-3 outline-none focus:ring-2 focus:ring-[#285E56]" /></label>}
            {isRegister && <p className="-mt-2 text-xs text-[#738078]">Mật khẩu cần từ 12 đến 128 ký tự.</p>}
            {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
            {error.includes('Verify your email') && <button type="button" onClick={() => void resendVerification()} className="text-sm font-semibold text-[#285E56]">Gửi lại email xác minh</button>}
            <button disabled={submitting} className="w-full rounded-xl bg-[#285E56] px-4 py-3 text-sm font-bold text-white hover:bg-[#1f4b44] disabled:opacity-60">{submitting ? 'Đang xử lý…' : isRegister ? 'Đăng ký khách hàng' : isForgot ? 'Gửi liên kết' : isReset ? 'Đổi mật khẩu' : 'Đăng nhập'}</button>
          </form>
        )}
        {!isVerify && <p className="mt-6 text-center text-sm text-[#738078]">
          {isRegister ? 'Đã có tài khoản?' : isForgot || isReset ? 'Nhớ mật khẩu?' : 'Chưa có tài khoản?'}{' '}
          <button onClick={() => navigateTo(isRegister ? '/login' : isForgot || isReset ? '/login' : '/register')} className="font-semibold text-[#285E56] hover:underline">{isRegister || isForgot || isReset ? 'Đăng nhập' : 'Đăng ký'}</button>
          {!isRegister && !isForgot && !isReset && <><span className="mx-2">·</span><button onClick={() => navigateTo('/forgot-password')} className="font-semibold text-[#285E56] hover:underline">Quên mật khẩu?</button></>}
        </p>}
      </div>
    </section>
  );
};
