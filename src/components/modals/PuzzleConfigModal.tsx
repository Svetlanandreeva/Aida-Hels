import React, { useState } from 'react';
import {
  X,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Bell,
  BellOff,
  ArrowUp,
  ArrowDown,
  Brain,
  ShieldAlert,
  Save,
  RotateCcw,
} from 'lucide-react';
import { UserModuleConfigItem } from '../../types';

interface PuzzleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserModuleConfigItem[];
  onSaveConfig: (newConfig: UserModuleConfigItem[]) => Promise<void>;
}

export const PuzzleConfigModal: React.FC<PuzzleConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [items, setItems] = useState<UserModuleConfigItem[]>(config);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);

  // Sync state if modal reopens with updated config
  React.useEffect(() => {
    setItems(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleToggle = (moduleId: string, field: keyof UserModuleConfigItem) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.moduleId === moduleId) {
          return { ...item, [field]: !item[field] };
        }
        return item;
      })
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalculate order positions
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx + 1 }));
    setItems(reordered);
  };

  const handleSettingChange = (moduleId: string, settingKey: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.moduleId === moduleId) {
          return {
            ...item,
            module_settings: {
              ...(item.module_settings || {}),
              [settingKey]: value,
            },
          };
        }
        return item;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveConfig(items);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Failed to save module config:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0D1117] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#111827]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3DD9C5] flex items-center justify-center text-black font-bold">
              <Sliders className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Конструктор «Пазл здоровья»
              </h2>
              <p className="text-[11px] text-gray-400">
                Настройте видимость, порядок и поведение модулей главной страницы
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (MODULE LIST) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 font-sans">
          {items.map((item, index) => {
            const isExpanded = expandedSettingsId === item.moduleId;

            return (
              <div
                key={item.moduleId}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.enabled && item.show_on_home
                    ? 'bg-[#161B22] border-white/10 text-white'
                    : 'bg-[#0F1318] border-white/5 text-gray-400 opacity-75'
                }`}
              >
                {/* ITEM HEADER / ROW */}
                <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  {/* REORDER & TITLE */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Поднять выше"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={index === items.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Опустить ниже"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-gray-100">{item.title}</span>
                        {item.category === 'sensitive' && (
                          <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> Sensitive
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">ID: {item.moduleId}</span>
                    </div>
                  </div>

                  {/* CONTROL TOGGLES */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* ENABLED SWITCH */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.moduleId, 'enabled')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                        item.enabled
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-gray-800/60 text-gray-500 border-gray-700/50'
                      }`}
                      title={item.enabled ? 'Модуль включён' : 'Модуль выключен'}
                    >
                      <Check className="w-3 h-3" />
                      <span>{item.enabled ? 'Вкл' : 'Выкл'}</span>
                    </button>

                    {/* SHOW ON HOME SWITCH */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.moduleId, 'show_on_home')}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        item.show_on_home
                          ? 'bg-[#3DD9C5]/15 text-[#3DD9C5] border-[#3DD9C5]/30'
                          : 'bg-gray-800/60 text-gray-500 border-gray-700/50'
                      }`}
                      title={item.show_on_home ? 'Показывать на Главной' : 'Скрыто с Главной'}
                    >
                      {item.show_on_home ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* ALLOW AI ANALYTICS SWITCH */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.moduleId, 'allow_ai_analytics')}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        item.allow_ai_analytics
                          ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30'
                          : 'bg-gray-800/60 text-gray-500 border-gray-700/50'
                      }`}
                      title={item.allow_ai_analytics ? 'Разрешен ИИ-анализ' : 'ИИ-анализ отключен'}
                    >
                      <Brain className="w-3.5 h-3.5" />
                    </button>

                    {/* NOTIFICATIONS SWITCH */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.moduleId, 'notifications')}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        item.notifications
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : 'bg-gray-800/60 text-gray-500 border-gray-700/50'
                      }`}
                      title={item.notifications ? 'Уведомления включены' : 'Уведомления отключены'}
                    >
                      {item.notifications ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* EXPAND SETTINGS BUTTON */}
                    <button
                      type="button"
                      onClick={() => setExpandedSettingsId(isExpanded ? null : item.moduleId)}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 text-[11px] font-bold cursor-pointer"
                      title="Настройки параметров"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* EXPANDED SETTINGS FORM */}
                {isExpanded && item.module_settings && (
                  <div className="mt-3 pt-3 border-t border-white/10 bg-black/40 p-3 rounded-xl space-y-2 text-xs text-gray-300">
                    <div className="font-bold text-emerald-400 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Параметры модуля
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(item.module_settings).map(([sKey, sVal]) => (
                        <div key={sKey} className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono">{sKey}</label>
                          <input
                            type={typeof sVal === 'number' ? 'number' : 'text'}
                            value={sVal}
                            onChange={(e) =>
                              handleSettingChange(
                                item.moduleId,
                                sKey,
                                typeof sVal === 'number' ? Number(e.target.value) : e.target.value
                              )
                            }
                            className="bg-[#111827] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:border-[#3DD9C5] outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#111827] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setItems(config)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#3DD9C5] text-black font-extrabold text-xs shadow-lg hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-black" />
                  <span>Сохранено!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-black" />
                  <span>{saving ? 'Сохранение...' : 'Сохранить Пазл'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
