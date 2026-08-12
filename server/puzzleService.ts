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
      enabled: true,
      show_on_home: true,
      order: 1,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { targetScore: 8, alertBelow: 4 },
    },
    {
      moduleId: 'sleep',
      title: 'Качество сна',
      category: 'core',
      enabled: true,
      show_on_home: true,
      order: 2,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { targetHours: 8, minHoursAlert: 6 },
    },
    {
      moduleId: 'pressure',
      title: 'Артериальное давление и пульс',
      category: 'core',
      enabled: true,
      show_on_home: true,
      order: 3,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { targetSystolic: 120, targetDiastolic: 80, warnSystolicHigh: 140 },
    },
    {
      moduleId: 'mental',
      title: 'Настроение и Ментальный баланс',
      category: 'sensitive',
      enabled: true,
      show_on_home: true,
      order: 4,
      allow_ai_analytics: false, // Sensitive by default!
      notifications: true,
      module_settings: { checkinFrequency: 'daily', phq9AlertThreshold: 10 },
    },
    {
      moduleId: 'aida_insights',
      title: 'ИИ-обзор состояния (Аида)',
      category: 'ai',
      enabled: true,
      show_on_home: true,
      order: 5,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { autoRefresh: true },
    },
    {
      moduleId: 'medications',
      title: 'Приём препаратов и витаминов',
      category: 'medications',
      enabled: true,
      show_on_home: true,
      order: 6,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { reminderLeadTimeMin: 15 },
    },
    {
      moduleId: 'female_health',
      title: 'Календарь женского здоровья',
      category: 'specialized',
      enabled: isFemale,
      show_on_home: isFemale,
      order: 7,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { cycleLengthDays: 28, periodLengthDays: 5, isPregnant: Boolean(isPregnant) },
    },
    {
      moduleId: 'family_pediatrics',
      title: 'Детские и семейные профили',
      category: 'specialized',
      enabled: Boolean(hasChildren),
      show_on_home: Boolean(hasChildren),
      order: 8,
      allow_ai_analytics: true,
      notifications: true,
      module_settings: { pediatricAlerts: true },
    },
    {
      moduleId: 'dental_suite',
      title: 'Стоматологическая карта',
      category: 'specialized',
      enabled: false,
      show_on_home: false,
      order: 9,
      allow_ai_analytics: true,
      notifications: false,
      module_settings: { checkupIntervalMonths: 6 },
    },
    {
      moduleId: 'extended_analysis',
      title: 'Расширенный медицинский анализ',
      category: 'analytics',
      enabled: true,
      show_on_home: true,
      order: 10,
      allow_ai_analytics: true,
      notifications: false,
      module_settings: { defaultExpanded: false },
    },
  ];
}

export class PuzzleService {
  /**
   * Get user's module configuration
   */
  public async getUserPuzzleConfig(userId: string): Promise<UserModuleConfigItem[]> {
    const userData = await canonicalDataLayer.getUserData(userId);
    if (userData && Array.isArray(userData.puzzleConfig) && userData.puzzleConfig.length > 0) {
      // Sort by position / order
      return userData.puzzleConfig.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // Generate default based on user profile
    const profile = userData?.profile || {};
    const defaultConfig = getDefaultPuzzleConfig(
      profile.gender,
      profile.womenHealth?.isPregnant,
      profile.hasChildren
    );

    // Save initial default
    if (userData) {
      await canonicalDataLayer.saveUserData(userId, { puzzleConfig: defaultConfig });
    }

    return defaultConfig;
  }

  /**
   * Update full or partial puzzle configuration
   */
  public async updateUserPuzzleConfig(
    userId: string,
    newConfig: UserModuleConfigItem[]
  ): Promise<UserModuleConfigItem[]> {
    const existingConfig = await this.getUserPuzzleConfig(userId);

    // Merge or replace
    const updatedMap = new Map<string, UserModuleConfigItem>();
    for (const item of existingConfig) {
      updatedMap.set(item.moduleId, item);
    }

    for (const newItem of newConfig) {
      const existing = updatedMap.get(newItem.moduleId);
      updatedMap.set(newItem.moduleId, {
        ...(existing || {
          title: newItem.moduleId,
          category: 'core',
          enabled: true,
          show_on_home: true,
          order: updatedMap.size + 1,
          allow_ai_analytics: true,
          notifications: true,
        }),
        ...newItem,
        order: newItem.order !== undefined ? newItem.order : existing?.order ?? updatedMap.size + 1,
      });
    }

    const sortedResult = Array.from(updatedMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

    await canonicalDataLayer.saveUserData(userId, { puzzleConfig: sortedResult });

    return sortedResult;
  }
}

export const puzzleService = new PuzzleService();
