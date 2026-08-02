import React, { useState } from 'react';
import { Heart, Lock, Mail, User, ShieldCheck, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (userData?: Partial<UserProfile>) => void;
  onDemoLogin: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onDemoLogin }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Check for stored credentials
  const savedCredsRaw = localStorage.getItem('app_saved_credentials');
  const savedCreds = savedCredsRaw ? JSON.parse(savedCredsRaw) : null;

  const [email, setEmail] = useState(savedCreds?.email || 'anna.ivanova@health.ru');
  const [password, setPassword] = useState(savedCreds?.password || '123456');
  const [fullName, setFullName] = useState(savedCreds?.fullName || 'Анна Сергеевна Иванова');
  const [rememberMe, setRememberMe] = useState(true);
  const [resetSentToast, setResetSentToast] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.includes('@')) {
      setAuthError('Укажите корректный email');
      return;
    }
    if (password.length < 4) {
      setAuthError('Пароль слишком короткий');
      return;
    }

    // Save newly created or logged credentials
    localStorage.setItem(
      'app_saved_credentials',
      JSON.stringify({ email, password, fullName })
    );

    onLoginSuccess({
      email,
      password,
      fullName: tab === 'register' ? fullName : (fullName || email.split('@')[0]),
      isAuthenticated: true,
      isQuestionnaireCompleted: tab === 'register' ? false : true,
      registrationDate: tab === 'register' ? new Date().toISOString() : '2026-06-20T10:00:00.000Z',
      introCardDismissedAt: null,
    });
  };

  const handleForgotPassword = () => {
    setResetSentToast(true);
    setTimeout(() => setResetSentToast(false), 5000);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 bg-[#0A0B0D]">
      <div className="w-full max-w-md bg-[#14171C] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#0F1115] via-[#1A1D24] to-[#0A0B0D] p-8 text-white text-center relative overflow-hidden border-b border-gray-800">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-100">Единый Медпрофиль</h2>
          <p className="text-xs text-gray-400 mt-1">
            Безопасный вход в вашу персональную систему здоровья
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border border-gray-800 bg-[#0F1115] p-1.5 m-4 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setAuthError(null);
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

        {/* Toast Notification */}
        {resetSentToast && (
          <div className="mx-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Инструкция по сбросу пароля отправлена на адрес {email}</span>
          </div>
        )}

        {authError && (
          <div className="mx-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-2">
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
            className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            <span>{tab === 'login' ? 'Войти в систему' : 'Создать аккаунт'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

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
            <span>Ваши медицинские данные защищены методом end-to-end шифрования</span>
          </p>
        </div>
      </div>
    </div>
  );
};
