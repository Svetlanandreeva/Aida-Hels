import { canonicalDataLayer } from './canonicalDataLayer';

export interface UserModuleConfigItem {
  moduleId: string;
  title: string;
  category?: 'core' | 'sensitive' | 'ai' | 'medications' | 'specialized' | 'analytics';
  enabled: boolean;
  show_on_home: boolean;
  order: number;
  allow_ai_analytics: boolean;
  notifications: boolean;
  module_settings?: Record<string, any>;
}

/**
 * Baseline catalogue only. This is NOT a recommendation engine.
 * A module is never silently enabled just because profile data makes it relevant.
 * Onboarding/recommendation flow must explicitly persist the user's selection.
 */
export function getDefaultPuzzleConfig(
  gender?: string,
  isPregnant?: boolean,
  hasChildren?: boolean
): UserModuleConfigItem[] {
  const isFemale = gender === 'female';

  return [
    {
      moduleId: 'energy',
      title: 'Энергия и жизненный тонус',
      category: 'core',
      enabled: false,
      show_on_home: false,
      order: 1,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { targetScore: 8, alertBelow: 4 },
    },
    {
      moduleId: 'sleep',
      title: 'Качество сна',
      category: 'core',
      enabled: false,
      show_on_home: false,
      order: 2,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { targetHours: 8, minHoursAlert: 6 },
    },
    {
      moduleId: 'pressure',
      title: 'Артериальное давление и пульс',
      category: 'core',
      enabled: false,
      show_on_home: false,
      order: 3,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { targetSystolic: 120, targetDiastolic: 80, warnSystolicHigh: 140 },
    },
    {
      moduleId: 'mental',
      title: 'Настроение и Ментальный баланс',
      category: 'sensitive',
      enabled: false,
      show_on_home: false,
      order: 4,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { checkinFrequency: 'daily', phq9AlertThreshold: 10 },
    },
    {
      moduleId: 'aida_insights',
      title: 'ИИ-обзор состояния (Аида)',
      category: 'ai',
      enabled: false,
      show_on_home: false,
      order: 5,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { autoRefresh: false },
    },
    {
      moduleId: 'medications',
      title: 'Приём препаратов и витаминов',
      category: 'medications',
      enabled: false,
      show_on_home: false,
      order: 6,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { reminderLeadTimeMin: 15 },
    },
    {
      moduleId: 'female_health',
      title: 'Календарь женского здоровья',
      category: 'specialized',
      enabled: false,
      show_on_home: false,
      order: 7,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: {
        eligible: isFemale,
        pregnancyContextKnown: Boolean(isPregnant),
        cycleLengthDays: 28,
        periodLengthDays: 5,
      },
    },
    {
      moduleId: 'family_pediatrics',
      title: 'Детские и семейные профили',
      category: 'specialized',
      enabled: false,
      show_on_home: false,
      order: 8,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { eligible: Boolean(hasChildren), pediatricAlerts: false },
    },
    {
      moduleId: 'dental_suite',
      title: 'Стоматологическая карта',
      category: 'specialized',
      enabled: false,
      show_on_home: false,
      order: 9,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { checkupIntervalMonths: 6 },
    },
    {
      moduleId: 'extended_analysis',
      title: 'Расширенный медицинский анализ',
      category: 'analytics',
      enabled: false,
      show_on_home: false,
      order: 10,
      allow_ai_analytics: false,
      notifications: false,
      module_settings: { defaultExpanded: false },
    },
  ];
}

export class PuzzleService {
  public async getUserPuzzleConfig(userId: string): Promise<UserModuleConfigItem[]> {
    const userData = await canonicalDataLayer.getUserData(userId);
    if (Array.isArray(userData.puzzleConfig) && userData.puzzleConfig.length > 0) {
      return [...userData.puzzleConfig].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    const profile = userData?.profile || {};
    const catalogue = getDefaultPuzzleConfig(
      profile.gender,
      profile.womenHealth?.isPregnant,
      profile.hasChildren
    );

    // Persist only a neutral catalogue. No module is treated as consented/selected.
    await canonicalDataLayer.saveUserData(userId, { puzzleConfig: catalogue });
    return catalogue;
  }

  public async updateUserPuzzleConfig(
    userId: string,
    newConfig: UserModuleConfigItem[]
  ): Promise<UserModuleConfigItem[]> {
    if (!Array.isArray(newConfig)) throw new Error('Puzzle configuration must be an array');

    const existingConfig = await this.getUserPuzzleConfig(userId);
    const updatedMap = new Map<string, UserModuleConfigItem>();
    for (const item of existingConfig) updatedMap.set(item.moduleId, item);

    for (const newItem of newConfig) {
      if (!newItem?.moduleId) continue;
      const existing = updatedMap.get(newItem.moduleId);
      if (!existing) continue; // unknown modules cannot be injected through the client

      const next: UserModuleConfigItem = {
        ...existing,
        ...newItem,
        moduleId: existing.moduleId,
        title: existing.title,
        category: existing.category,
        order: newItem.order !== undefined ? newItem.order : existing.order,
      };

      // AI analytics and notifications cannot stay enabled when the module itself is disabled.
      if (!next.enabled) {
        next.show_on_home = false;
        next.allow_ai_analytics = false;
        next.notifications = false;
      }

      // Sensitive module AI analytics must be an explicit separate choice.
      if (next.category === 'sensitive' && newItem.allow_ai_analytics !== true) {
        next.allow_ai_analytics = false;
      }

      updatedMap.set(existing.moduleId, next);
    }

    const sortedResult = Array.from(updatedMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
    await canonicalDataLayer.saveUserData(userId, { puzzleConfig: sortedResult });
    return sortedResult;
  }
}

export const puzzleService = new PuzzleService();
