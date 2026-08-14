import React from 'react';
import { Bell, ChevronRight, LayoutGrid, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { ScreenId, UserProfile } from '../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, user, onClose, onNavigate }) => {
  if (!isOpen) return null;

  const open = (screen: ScreenId) => {
    onClose();
    onNavigate(screen);
  };

  const rows = [
    { label: 'Личные данные', icon: UserRound, screen: 'profile' as ScreenId },
    { label: 'Медицинская карта', icon: Stethoscope, screen: 'profile' as ScreenId },
    { label: 'Модули на Главной', icon: LayoutGrid, screen: 'dashboard' as ScreenId },
    { label: 'Уведомления', icon: Bell, screen: 'reminders' as ScreenId },
    { label: 'Конфиденциальность', icon: ShieldCheck, screen: 'permissions' as ScreenId },
  ];

  return (
    <div className="aida-settings-overlay" role="dialog" aria-modal="true" aria-label="Настройки">
      <button className="aida-settings-backdrop" aria-label="Закрыть настройки" onClick={onClose} />
      <aside className="aida-settings-drawer">
        <div className="aida-settings-heading">
          <div><span>Профиль</span><h2>Настройки</h2></div>
          <button className="aida-settings-close" onClick={onClose} aria-label="Закрыть"><X /></button>
        </div>

        <button className="aida-settings-status" onClick={() => open('profile')}>
          <span className="aida-settings-status-icon"><UserRound /></span>
          <span>
            <strong>{user.fullName ? 'Профиль пользователя' : 'Профиль не заполнен'}</strong>
            <small>{user.fullName ? 'Проверьте личные и медицинские данные.' : 'Добавьте основные данные, чтобы адаптировать приложение под ваши цели.'}</small>
          </span>
        </button>

        <nav className="aida-settings-list">
          {rows.map(({ label, icon: Icon, screen }) => (
            <button key={label} onClick={() => open(screen)}>
              <span><Icon />{label}</span><ChevronRight />
            </button>
          ))}
        </nav>

        <div className="aida-settings-privacy">
          <ShieldCheck />
          <span>Вы управляете тем, какие данные используются в аналитике Аиды.</span>
        </div>
      </aside>
    </div>
  );
};
