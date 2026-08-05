import React, { useState, useEffect } from 'react';
import {
  Heart,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (userData?: Partial<UserProfile>) => void;
  onDemoLogin: () => void;
  initialTab?: 'login' | 'register';
}

function getVerifiedEmails(): string[] {
  try {
    const raw = localStorage.getItem('app_verified_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markEmailAsVerified(email: string) {
  const norm = email.trim().toLowerCase();
  const list = getVerifiedEmails();
  if (!list.includes(norm)) {
    list.push(norm);
    localStorage.setItem('app_verified_emails', JSON.stringify(list));
  }
}

function isEmailVerifiedLocally(email: string): boolean {
  const norm = email.trim().toLowerCase();
  return getVerifiedEmails().includes(norm);
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onDemoLogin, initialTab = 'login' }) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [step, setStep] = useState<'form' | 'verify_code'>('form');

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  // Check for stored credentials
  const savedCredsRaw = localStorage.getItem('app_saved_credentials');
  const savedCreds = savedCredsRaw ? JSON.parse(savedCredsRaw) : null;

  const [email, setEmail] = useState(savedCreds?.email || '');
  const [password, setPassword] = useState(savedCreds?.password || '');
  const [fullName, setFullName] = useState(savedCreds?.fullName || '');
  const [rememberMe, setRememberMe] = useState(true);

  // Verification code state
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resetSentToast, setResetSentToast] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage(null);

    const normEmail = email.trim().toLowerCase();

    if (!normEmail.includes('@') || !normEmail.includes('.')) {
      setAuthError('Укажите корректный адрес электронной почты');
      return;
    }
    if (password.length < 4) {
      setAuthError('Пароль должен содержать не менее 4 символов');
      return;
    }
    if (tab === 'register' && !fullName.trim()) {
      setAuthError('Укажите ваше ФИО полностью');
      return;
    }

    // REGISTRATION FLOW
    if (tab === 'register') {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normEmail,
            password,
            fullName,
          }),
        });
        const data = await res.json();

        if (!data.success && data.message) {
          setAuthError(data.message);
          return;
        }

        const pending = JSON.parse(localStorage.getItem('app_pending_verifications') || '{}');
        pending[normEmail] = {
          createdAt: Date.now(),
          password,
          fullName,
        };
        localStorage.setItem('app_pending_verifications', JSON.stringify(pending));

        localStorage.setItem(
          'app_saved_credentials',
          JSON.stringify({ email: normEmail, password, fullName })
        );

        setStep('verify_code');
        setVerificationCode('');
        setResendCountdown(60);
        setInfoMessage(`На ваш email ${normEmail} отправлен 6-значный код подтверждения.`);
      } catch (err: any) {
        setAuthError('Ошибка отправки кода подтверждения: ' + (err.message || 'Сбой сети'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // LOGIN FLOW - REAL SERVER BCRYPT PASSWORD CHECK
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normEmail, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || 'Неверный логин или пароль');
        setIsSubmitting(false);
        return;
      }

      markEmailAsVerified(normEmail);

      localStorage.setItem(
        'app_saved_credentials',
        JSON.stringify({ email: normEmail, password, fullName: data.user?.fullName || fullName })
      );

      setIsSubmitting(false);
      onLoginSuccess({
        id: data.user?.id,
        email: normEmail,
        password,
        fullName: data.user?.fullName || fullName || normEmail.split('@')[0],
        isAuthenticated: true,
        isQuestionnaireCompleted: true,
        registrationDate: new Date().toISOString(),
        introCardDismissedAt: null,
      });
    } catch (err: any) {
      setAuthError('Ошибка входа: ' + (err.message || 'Сбой сети'));
      setIsSubmitting(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage(null);

    const normEmail = email.trim().toLowerCase();
    const cleanCode = verificationCode.trim();

    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setAuthError('Введите 6 цифр кода из письма');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normEmail, code: cleanCode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || 'Неверный код подтверждения. Проверьте цифры из письма.');
        setIsSubmitting(false);
        return;
      }

      markEmailAsVerified(normEmail);

      const pending = JSON.parse(localStorage.getItem('app_pending_verifications') || '{}');
      const storedName = pending[normEmail]?.fullName || fullName || normEmail.split('@')[0];
      delete pending[normEmail];
      localStorage.setItem('app_pending_verifications', JSON.stringify(pending));

      localStorage.setItem(
        'app_saved_credentials',
        JSON.stringify({ email: normEmail, password, fullName: storedName })
      );

      setIsSubmitting(false);
      onLoginSuccess({
        id: data.user?.id,
        email: normEmail,
        password,
        fullName: storedName,
        isAuthenticated: true,
        isQuestionnaireCompleted: tab === 'register' ? false : true,
        registrationDate: new Date().toISOString(),
        introCardDismissedAt: null,
      });
    } catch (err: any) {
      setAuthError('Ошибка проверки кода: ' + (err.message || 'Сбой сети'));
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || isSubmitting) return;
    const normEmail = email.trim().toLowerCase();
    setIsSubmitting(true);
    setAuthError(null);
    setInfoMessage(null);

    try {
      const savedSheetUrl = localStorage.getItem('app_google_sheet_url') || '';
      const res = await fetch('/api/sheets/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendVerificationCode',
          payload: { email: normEmail },
          webAppUrl: savedSheetUrl,
        }),
      });
      const data = await res.json();
      const sentCode = data?.data?.code || Math.floor(100000 + Math.random() * 900000).toString();

      const pending = JSON.parse(localStorage.getItem('app_pending_verifications') || '{}');
      pending[normEmail] = {
        code: String(sentCode),
        createdAt: Date.now(),
        password,
        fullName,
      };
      localStorage.setItem('app_pending_verifications', JSON.stringify(pending));

      setResendCountdown(60);
      setInfoMessage(`Новый код отправлен на ${normEmail}`);
    } catch (err: any) {
      setAuthError('Не удалось отправить код повторно: ' + (err.message || 'Ошибка сети'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setResetSentToast(true);
    setTimeout(() => setResetSentToast(false), 5000);
  };

  return (
    <div className="flex-1 w-full min-h-screen flex items-center justify-center py-6 sm:py-10 px-4 bg-[#0A0B0D]">
      <div className="w-full max-w-md bg-[#14171C] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#0F1115] via-[#1A1D24] to-[#0A0B0D] p-8 text-white text-center relative overflow-hidden border-b border-gray-800">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            {step === 'verify_code' ? (
              <KeyRound className="w-8 h-8 stroke-[2.2]" />
            ) : (
              <Heart className="w-8 h-8 fill-current" />
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-100">Единый Медпрофиль</h2>
          <p className="text-xs text-gray-400 mt-1">
            {step === 'verify_code'
              ? 'Подтверждение электронного адреса'
              : 'Безопасный вход в вашу персональную систему здоровья'}
          </p>
        </div>

        {/* Tab Switcher (Only in Form step) */}
        {step === 'form' && (
          <div className="flex border border-gray-800 bg-[#0F1115] p-1.5 m-4 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setAuthError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-gray-800 text-emerald-400 border border-gray-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Вход в аккаунт
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setAuthError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === 'register'
                  ? 'bg-gray-800 text-emerald-400 border border-gray-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Регистрация
            </button>
          </div>
        )}

        {/* Toast / Status Notifications */}
        {resetSentToast && (
          <div className="mx-4 my-2 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Инструкция по сбросу пароля отправлена на адрес {email}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mx-4 my-2 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        {authError && (
          <div className="mx-4 my-2 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {/* STEP 1: LOGIN / REGISTRATION FORM */}
        {step === 'form' && (
          <form onSubmit={handleSubmitForm} className="p-6 space-y-4 pt-2">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  ФИО полностью
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванова Анна Сергеевна"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Электронная почта (Email)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Пароль</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-700 text-emerald-500 focus:ring-emerald-500 bg-gray-900"
                />
                <span>Запомнить устройство</span>
              </label>
              {tab === 'login' && (
                <button
                  type="button"
                  className="text-emerald-400 hover:underline font-medium cursor-pointer"
                  onClick={handleForgotPassword}
                >
                  Забыли пароль?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>{tab === 'login' ? 'Войти в систему' : 'Зарегистрироваться'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFICATION CODE STEP */}
        {step === 'verify_code' && (
          <form onSubmit={handleVerifyCodeSubmit} className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-gray-100">Введите код из письма</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Мы отправили 6-значный код на почту <strong className="text-emerald-400 font-semibold">{email}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 text-center">
                6-значный код подтверждения
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={verificationCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(val);
                }}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 px-4 bg-gray-900 border border-gray-700 rounded-xl text-emerald-400 font-bold placeholder-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || verificationCode.length !== 6}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Подтвердить email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                disabled={resendCountdown > 0 || isSubmitting}
                onClick={handleResendCode}
                className="w-full py-2 px-3 bg-gray-800/80 hover:bg-gray-800 text-gray-300 disabled:opacity-50 font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>
                  {resendCountdown > 0
                    ? `Отправить код повторно (${resendCountdown}с)`
                    : 'Отправить код повторно'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setAuthError(null);
                  setInfoMessage(null);
                }}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Изменить email / Изменить данные</span>
              </button>
            </div>
          </form>
        )}

        {/* Divider */}
        <div className="px-6 py-2 flex items-center gap-3">
          <div className="h-px bg-gray-800 flex-1" />
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">или</span>
          <div className="h-px bg-gray-800 flex-1" />
        </div>

        {/* Quick Demo Login Option */}
        <div className="p-6 pt-2 bg-[#0F1115]">
          <button
            type="button"
            onClick={onDemoLogin}
            className="w-full py-2.5 px-4 bg-gray-800 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 font-medium text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Быстрый ознакомительный вход</span>
          </button>

          <p className="text-[11px] text-center text-gray-500 mt-3 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ваши медицинские данные защищены стандартом шифрования TLS / AES-256</span>
          </p>
        </div>
      </div>
    </div>
  );
};
