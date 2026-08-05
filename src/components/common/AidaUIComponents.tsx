import React from 'react';
import { ScreenId, DashboardTab } from '../../types';
import { Sparkles, ArrowLeft, LayoutDashboard, Brain, Activity, User, FileText, CheckSquare, Heart } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* 1. GLASS CARD                                                              */
/* -------------------------------------------------------------------------- */
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
  accent?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  hoverEffect = false,
  accent,
  style,
  ...props
}) => {
  const combinedStyle: React.CSSProperties = {
    ...style,
    ...(accent ? { borderColor: accent } : {}),
  };

  return (
    <div
      onClick={onClick}
      style={combinedStyle}
      className={`glass-card p-5 rounded-3xl backdrop-blur-2xl bg-[#0F142A]/80 border border-[#99AEFF]/15 shadow-2xl transition-all duration-300 ${
        hoverEffect ? 'hover:border-[#977EFF]/40 hover:bg-[#141932]/90 hover:-translate-y-0.5 cursor-pointer' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. STATUS BADGE                                                            */
/* -------------------------------------------------------------------------- */
export type StatusTone = 'good' | 'warning' | 'critical' | 'norm' | 'slight_deviation' | 'attention' | 'urgent_help';

interface StatusBadgeProps {
  status?: StatusTone | string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'good',
  label,
  size = 'md',
  className = '',
}) => {
  const isGood = status === 'good' || status === 'norm';
  const isWarning = status === 'warning' || status === 'slight_deviation' || status === 'attention';
  const isCritical = status === 'critical' || status === 'urgent_help';

  let toneClass = 'bg-[#65F4C0]/15 border-[#65F4C0]/30 text-[#65F4C0]';
  let dotClass = 'bg-[#65F4C0] shadow-[0_0_8px_#65F4C0]';

  if (isWarning) {
    toneClass = 'bg-[#FFB957]/15 border-[#FFB957]/30 text-[#FFB957]';
    dotClass = 'bg-[#FFB957] shadow-[0_0_8px_#FFB957]';
  } else if (isCritical) {
    toneClass = 'bg-[#FF6685]/15 border-[#FF6685]/30 text-[#FF6685]';
    dotClass = 'bg-[#FF6685] shadow-[0_0_8px_#FF6685]';
  }

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-bold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-sans tracking-wide ${toneClass} ${sizeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. SCORE RING                                                              */
/* -------------------------------------------------------------------------- */
interface ScoreRingProps {
  value: number;
  maxValue?: number;
  color?: string;
  size?: number;
  label?: string;
  sublabel?: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  value,
  maxValue = 100,
  color = '#65F4C0',
  size = 118,
  label = 'из 100',
  sublabel,
}) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(maxValue, Math.max(0, value));
  const offset = circumference - (clamped / maxValue) * circumference;

  return (
    <div className="aida-ring shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
        <defs>
          <filter id={`ringGlow-${color.replace('#', '')}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="56" cy="56" r={radius} className="fill-none stroke-white/10 stroke-[8]" />

        <circle
          cx="56"
          cy="56"
          r={radius}
          className="fill-none stroke-[8] stroke-round transition-all duration-700"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter={`url(#ringGlow-${color.replace('#', '')})`}
        />
      </svg>

      <div className="aida-ring__content absolute inset-0 flex flex-col items-center justify-center text-center">
        <strong className="text-2xl font-extrabold text-white tracking-tight leading-none">{value}</strong>
        {label && <span className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</span>}
        {sublabel && <span className="text-[9px] text-gray-400">{sublabel}</span>}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. METRIC BAR                                                              */
/* -------------------------------------------------------------------------- */
interface MetricBarProps {
  label: string;
  value: string | number;
  progress: number;
  accentColor?: string;
  subtext?: string;
  className?: string;
}

export const MetricBar: React.FC<MetricBarProps> = ({
  label,
  value,
  progress,
  accentColor = '#65F4C0',
  subtext,
  className = '',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3.5 space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs text-gray-300">
        <span className="font-medium text-gray-400">{label}</span>
        <strong className="font-bold text-white">{value}</strong>
      </div>

      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
      </div>

      {subtext && <p className="text-[11px] text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. PAGE HEADER                                                             */
/* -------------------------------------------------------------------------- */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badgeText,
  onBack,
  actions,
  className = '',
}) => {
  return (
    <div className={`space-y-3 mb-6 ${className}`}>
      {onBack && (
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer mb-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </button>
      )}

      {badgeText && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8968FF]/10 border border-[#8968FF]/30 text-[#C7B9FF] text-xs font-bold">
          <span className="text-[#47D8FF]">✦</span>
          <span>{badgeText}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. AIDA INSIGHT                                                            */
/* -------------------------------------------------------------------------- */
interface AidaInsightProps {
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const AidaInsight: React.FC<AidaInsightProps> = ({
  title = 'Вывод Аиды',
  text,
  actionLabel,
  onAction,
  icon = <Sparkles className="w-5 h-5 text-[#D0C4FF]" />,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden p-5 rounded-3xl bg-gradient-to-r from-[#1A183A]/90 to-[#0A0F22]/90 border border-[#815FFF]/30 shadow-[0_0_32px_rgba(119,87,255,0.19)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-[#815FFF]/15 border border-[#AE91FF]/30 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#9F8DFF] block">
            {title}
          </span>
          <p className="text-xs sm:text-sm font-semibold text-gray-100 leading-relaxed">{text}</p>
        </div>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#A06CFF] to-[#4F9CFF] text-[#08101D] font-extrabold text-xs shadow-lg hover:brightness-110 transition-all cursor-pointer shrink-0 self-stretch sm:self-auto text-center"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. FLOATING BOTTOM NAVIGATION                                             */
/* -------------------------------------------------------------------------- */
interface BottomNavigationProps {
  currentScreen: ScreenId;
  setCurrentScreen: (screen: ScreenId) => void;
  dashboardTab: DashboardTab;
  setDashboardTab: (tab: DashboardTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentScreen,
  setCurrentScreen,
  dashboardTab,
  setDashboardTab,
}) => {
  const items = [
    {
      id: 'main',
      label: 'Главная',
      icon: LayoutDashboard,
      isActive: currentScreen === 'dashboard' && dashboardTab === 'main',
      onClick: () => {
        setCurrentScreen('dashboard');
        setDashboardTab('main');
      },
    },
    {
      id: 'analytics',
      label: 'Анализы',
      icon: FileText,
      isActive: currentScreen === 'dashboard' && dashboardTab === 'lab',
      onClick: () => {
        setCurrentScreen('dashboard');
        setDashboardTab('lab');
      },
    },
    {
      id: 'body_map',
      label: 'Организм',
      icon: User,
      isActive: currentScreen === 'body_map',
      onClick: () => setCurrentScreen('body_map'),
    },
    {
      id: 'diary',
      label: 'Состояние',
      icon: Brain,
      isActive: currentScreen === 'mental_diary' || currentScreen === 'pressure_diary',
      onClick: () => setCurrentScreen('mental_diary'),
    },
    {
      id: 'ai_chat',
      label: 'ИИ Чат',
      icon: Sparkles,
      isActive: currentScreen === 'ai_chat',
      onClick: () => setCurrentScreen('ai_chat'),
    },
  ];

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-[620px] bg-[#0A0E1D]/90 backdrop-blur-2xl border border-[#98AEEB]/20 rounded-3xl p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex items-center justify-around gap-1 select-none"
    >
      {items.map((item) => {
        const IconComponent = item.icon;
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            type="button"
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl text-xs transition-all cursor-pointer min-h-[48px] ${
              item.isActive
                ? 'bg-gradient-to-r from-[#A474FF] to-[#58D9FF] text-[#0A1020] font-bold shadow-lg shadow-[#686CFF]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <IconComponent className="w-5 h-5 shrink-0" />
            <span className="text-[10px] mt-0.5 hidden sm:inline font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
