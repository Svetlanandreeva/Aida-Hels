import { canonicalDataLayer } from './canonicalDataLayer';

export interface OnboardingField {
  id: string;
  type: 'text' | 'date' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  showIf?: {
    field: string;
    equals?: any;
    in?: any[];
  };
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  fields: OnboardingField[];
}

export interface OnboardingSchema {
  version: string;
  steps: OnboardingStep[];
}

export interface PuzzleModuleRecommendation {
  moduleId: string;
  title: string;
  description: string;
  category: 'core' | 'vital' | 'specialized' | 'sensitive';
  isSensitive: boolean;
  recommended: boolean;
  enabledByDefault: boolean;
}

export const CURRENT_ONBOARDING_VERSION = '1.0.0';

export const BASE_ONBOARDING_SCHEMA: OnboardingSchema = {
  version: CURRENT_ONBOARDING_VERSION,
  steps: [
    {
      id: 'step_basic_info',
      title: 'Основной профиль здоровья',
      description: 'Введите ваши базовые метаболические и антропометрические данные',
      fields: [
        {
          id: 'fullName',
          type: 'text',
          label: 'Полное имя или псевдоним',
          placeholder: 'Например, Светлана',
          required: true,
        },
        {
          id: 'birthDate',
          type: 'date',
          label: 'Дата рождения',
          required: true,
        },
        {
          id: 'gender',
          type: 'select',
          label: 'Биологический пол (медицинский контекст)',
          required: true,
          options: [
            { value: 'female', label: 'Женский' },
            { value: 'male', label: 'Мужской' },
            { value: 'other', label: 'Другой / Предсказывать по маркерам' },
          ],
        },
        {
          id: 'heightCm',
          type: 'number',
          label: 'Рост (см)',
          placeholder: '170',
          required: false,
        },
        {
          id: 'weightKg',
          type: 'number',
          label: 'Вес (кг)',
          placeholder: '65',
          required: false,
        },
      ],
    },
    {
      id: 'step_health_branches',
      title: 'Специализированные направления',
      description: 'Необязательный шаг. Укажите дополнительные контексты для персонализации',
      fields: [
        {
          id: 'femaleHealthCycle',
          type: 'checkbox',
          label: 'Отслеживать женский цикл и гормональный фон',
          showIf: { field: 'gender', equals: 'female' },
        },
        {
          id: 'isPregnantOrPlanning',
          type: 'checkbox',
          label: 'Беременность или планирование семьи',
          showIf: { field: 'gender', equals: 'female' },
        },
        {
          id: 'hasChildren',
          type: 'checkbox',
          label: 'Есть дети (управление педиатрическими профилями)',
        },
        {
          id: 'childCount',
          type: 'number',
          label: 'Количество детей',
          placeholder: '1',
          showIf: { field: 'hasChildren', equals: true },
        },
      ],
    },
    {
      id: 'step_health_goals',
      title: 'Цели и Приоритеты',
      description: 'Выберите, какие аспекты здоровья вы хотите контролировать в первую очередь',
      fields: [
        {
          id: 'goals',
          type: 'multiselect',
          label: 'Ваши ключевые цели',
          required: false,
          options: [
            { value: 'blood_pressure', label: 'Контроль давления и пульса' },
            { value: 'sleep_energy', label: 'Улучшение сна и дневной энергии' },
            { value: 'female_health', label: 'Женское здоровье и цикл' },
            { value: 'family_care', label: 'Забота о детях и близких' },
            { value: 'mental_wellbeing', label: 'Психоэмоциональный баланс' },
            { value: 'weight_metabolism', label: 'Вес, питание и сахар крови' },
            { value: 'dental_care', label: 'Стоматологическое здоровье' },
          ],
        },
      ],
    },
  ],
};

export class OnboardingService {
  /**
   * Evaluate whether a field should be shown according to conditional logic
   */
  public evaluateCondition(showIf: OnboardingField['showIf'], answers: Record<string, any>): boolean {
    if (!showIf) return true;
    const value = answers[showIf.field];
    if (showIf.equals !== undefined) {
      return value === showIf.equals;
    }
    if (showIf.in !== undefined) {
      return Array.isArray(showIf.in) && showIf.in.includes(value);
    }
    return true;
  }

  /**
   * Compute Recommended Puzzle Modules based on answers
   * Sensitive modules are NOT enabled by default without explicit user selection!
   */
  public computePuzzleRecommendations(answers: Record<string, any>): PuzzleModuleRecommendation[] {
    const goals: string[] = answers.goals || [];
    const isFemale = answers.gender === 'female';
    const isPregnant = Boolean(answers.isPregnantOrPlanning);
    const hasChildren = Boolean(answers.hasChildren);

    return [
      {
        moduleId: 'core_vitals',
        title: 'Мониторинг давления и пульса',
        description: 'Дневник артериального давления и ЧСС с аналитикой динамики',
        category: 'core',
        isSensitive: false,
        recommended: goals.includes('blood_pressure') || true,
        enabledByDefault: true,
      },
      {
        moduleId: 'labs_ocr',
        title: 'Лабораторные анализы и Оцифровка',
        description: 'Распознавание бланков Инвитро/Гемотест и тренды референсов',
        category: 'vital',
        isSensitive: false,
        recommended: true,
        enabledByDefault: true,
      },
      {
        moduleId: 'female_health_cycle',
        title: 'Мониторинг женского здоровья',
        description: 'Календарь цикла, овуляции и симптомов',
        category: 'specialized',
        isSensitive: false,
        recommended: isFemale || goals.includes('female_health'),
        enabledByDefault: isFemale,
      },
      {
        moduleId: 'family_pediatrics',
        title: 'Семейные и педиатрические профили',
        description: 'Управление медицинскими картами детей и пожилых родственников',
        category: 'specialized',
        isSensitive: false,
        recommended: hasChildren || goals.includes('family_care'),
        enabledByDefault: hasChildren,
      },
      {
        moduleId: 'mental_diary',
        title: 'Ментальный чек-ин и дневник настроения',
        description: 'Трекинг уровня стресса, эмоций и психологического состояния (PHQ-9)',
        category: 'sensitive',
        isSensitive: true,
        recommended: goals.includes('mental_wellbeing'),
        enabledByDefault: false, // SENSITIVE: Never enabled by default!
      },
      {
        moduleId: 'pregnancy_tracker',
        title: 'Модуль ведения беременности',
        description: 'Гестационные недели, узи-протоколы и скрининги',
        category: 'sensitive',
        isSensitive: true,
        recommended: isPregnant,
        enabledByDefault: false, // SENSITIVE: Requires explicit opt-in!
      },
      {
        moduleId: 'dental_suite',
        title: 'Стоматологическая карта',
        description: 'Интерактивная зубная формула (11–48), визиты и снимки',
        category: 'specialized',
        isSensitive: false,
        recommended: goals.includes('dental_care'),
        enabledByDefault: goals.includes('dental_care'),
      },
    ];
  }

  /**
   * Save step progress for user
   */
  public async saveStepProgress(userId: string, stepId: string, answers: Record<string, any>) {
    const existingData = await canonicalDataLayer.getUserData(userId);
    const profile = existingData?.profile || {};
    const currentOnboarding = existingData?.onboardingState || {
      version: CURRENT_ONBOARDING_VERSION,
      completedSteps: [],
      answers: {},
      isCompleted: false,
    };

    const updatedAnswers = {
      ...currentOnboarding.answers,
      ...answers,
    };

    const completedSteps = Array.from(new Set([...(currentOnboarding.completedSteps || []), stepId]));

    // Map answers to canonical profile
    const updatedProfile = {
      ...profile,
      fullName: updatedAnswers.fullName || profile.fullName,
      birthDate: updatedAnswers.birthDate || profile.birthDate,
      gender: updatedAnswers.gender || profile.gender,
      heightCm: updatedAnswers.heightCm ? Number(updatedAnswers.heightCm) : profile.heightCm,
      weightKg: updatedAnswers.weightKg ? Number(updatedAnswers.weightKg) : profile.weightKg,
      updatedAt: new Date().toISOString(),
    };

    const puzzleRecommendations = this.computePuzzleRecommendations(updatedAnswers);

    const updatedOnboardingState = {
      version: CURRENT_ONBOARDING_VERSION,
      completedSteps,
      answers: updatedAnswers,
      isCompleted: stepId === 'step_health_goals' || currentOnboarding.isCompleted,
      puzzleRecommendations,
      updatedAt: new Date().toISOString(),
    };

    const payloadToSave = {
      profile: updatedProfile,
      onboardingState: updatedOnboardingState,
    };

    await canonicalDataLayer.saveUserData(userId, payloadToSave);

    return {
      success: true,
      stepId,
      onboardingState: updatedOnboardingState,
      profile: updatedProfile,
    };
  }
}

export const onboardingService = new OnboardingService();
