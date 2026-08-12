export type ScreenId =
  | 'auth'
  | 'start'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'dashboard'
  | 'profile'
  | 'settings'
  | 'ai_chat'
  | 'daily_checkin'
  | 'body_map'
  | 'reminders'
  | 'mental_diary'
  | 'pressure_diary'
  | 'timeline'
  | 'integrations'
  | 'permissions';

export interface PressureLogEntry {
  id: string;
  subject_profile_id?: string;
  timestamp: string; // ISO string e.g. "2026-08-01T08:30:00"
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "01 Авг" or "01.08"
  systolic: number; // e.g. 120 (систолическое)
  diastolic: number; // e.g. 80 (диастолическое)
  pulse: number; // e.g. 72 (пульс)
  timeOfDay: 'morning' | 'day' | 'evening' | 'night';
  note?: string;
  tags?: string[];
}

export type DashboardTab = 'main' | 'lab' | 'appointments';

export type ReminderCategory = 'medication' | 'appointment' | 'checkin' | 'custom';
export type ReminderFrequency = 'daily' | 'once' | 'weekly' | 'weekdays';

export interface Reminder {
  id: string;
  subject_profile_id?: string;
  title: string;
  category: ReminderCategory;
  time: string; // HH:MM e.g. "08:00"
  days?: string[]; // e.g., ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  frequency: ReminderFrequency;
  dosage?: string;
  // Structured dosage fields
  doseQuantity?: number; // e.g. 1
  doseForm?: string; // e.g., 'таблетка', 'капсула', 'мл', 'инъекция', 'пакетик', 'капли', 'спрей'
  doseActiveIngredient?: string; // e.g., '100 мг'
  schedule?: MedicationSchedule;
  startDate?: string;
  archivedAt?: string;
  archivedReason?: string;
  notes?: string;
  isEnabled: boolean;
  sound?: 'chime' | 'gentle' | 'pulse';
  lastCompletedDate?: string; // YYYY-MM-DD when marked completed for the day
  linkedId?: string; // optional linked appointment or medication ID
}

export interface WaterTrackerState {
  targetMl: number; // e.g. 2000
  consumedMl: number; // e.g. 1250
  logs: Array<{ id: string; amountMl: number; timestamp: string }>;
  remindersEnabled: boolean;
  schedule?: MedicationSchedule;
}

export interface QuestionnaireSnapshot {
  survey_id: string;
  user_id: string;
  subject_profile_id?: string;
  survey_version: string;
  started_at: string;
  completed_at: string;
  completion_percent: number;
  answers: Record<string, any>;
  skipped_questions: string[];
  ai_summary?: string;
  attention_areas?: string[];
  confidence?: number;
  created_at: string;
}

export type DataMaturityLevel =
  | 'acquaintance' // 0-3 days: Начинаем знакомство
  | 'first_observations' // 4-7 days: Появляются первые наблюдения
  | 'early_dynamics' // 8-14 days: Формируется динамика
  | 'developing_picture' // 15-29 days: Развитие понятной картины
  | 'sufficient_data'; // 30+ days: Данных достаточно для персональной картины

export interface MedicationScheduleSlot {
  enabled: boolean;
  time: string; // "HH:MM" e.g. "08:00"
}

export interface MedicationSchedule {
  morning?: MedicationScheduleSlot;
  afternoon?: MedicationScheduleSlot;
  evening?: MedicationScheduleSlot;
}

export interface ChronicDiagnosisItem {
  id: string;
  name: string;
  medication: string;
  sinceYear: string;
  schedule?: MedicationSchedule;
}

export interface PsychiatricMedication {
  id: string;
  name: string;
  dosage?: string;
  schedule?: MedicationSchedule;
}

export interface UserProfile {
  id?: string;
  isAuthenticated: boolean;
  fullName: string;
  email: string;
  birthDate: string;
  height: number;
  weight: number;
  gender: 'female' | 'male';
  
  // Med Card
  bloodType: string;
  rhFactor: '+' | '-';
  allergies: string[];
  chronicDiagnoses: ChronicDiagnosisItem[];
  orviFrequency: string; // e.g., "1-2 раза в год"
  
  // Women Health
  womenHealth?: {
    cycleLength: number; // days e.g. 28
    periodDuration: number; // days e.g. 5
    isRegular: boolean;
    pmsSymptoms: string[];
    painLevel: number; // 1-10
    lastPeriodDate: string; // YYYY-MM-DD
    partnerSyncCode?: string;
    isPartnerSynced?: boolean;
  };

  // Psychological
  psychology: {
    stressLevel: number; // 1-10
    sleepHours: number;
    mood: 'excellent' | 'good' | 'neutral' | 'anxious' | 'depressed';
    hasPsychiatricHistory: boolean;
    psychiatricData?: {
      diagnoses: string[];
      symptoms: string[];
      medications: string[];
      psychiatricMedications?: PsychiatricMedication[];
      specialistInfo: string;
    };
  };

  consentsAccepted: boolean;
  isQuestionnaireCompleted: boolean;
  password?: string;
  hasCompletedTutorial?: boolean;
  registrationDate?: string; // ISO date string e.g. "2026-08-01"
  introCardSeen?: boolean;
  introCardDismissedAt?: string | null;
  introCardShowAgainAt?: string | null;
  questionnaireHistory?: QuestionnaireSnapshot[];
  lastSurveyUpdatePromptDismissedAt?: string | null;
}

export interface MedicalDocument {
  id: string;
  subject_profile_id?: string;
  title: string;
  date: string;
  category: 'lab' | 'ultrasound' | 'instrumental' | 'consultations';
  categoryLabel: string;
  summary: string;
  fileUrl?: string;
  deviations: Array<{
    marker: string;
    value: string;
    norm: string;
    status: 'Выше' | 'Ниже' | 'Внимание' | 'В норме';
    explanation: string;
  }>;
  allMarkers?: Array<{
    marker: string;
    value: string;
    norm: string;
    status: 'Выше' | 'Ниже' | 'Внимание' | 'В норме';
    explanation?: string;
  }>;
  recommendations: string[];
}

export interface Appointment {
  id: string;
  subject_profile_id?: string;
  specialty: string;
  doctorName: string;
  clinic: string;
  dateTime: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  purpose: string;
  notes?: string;
}

export interface BodySystem {
  id: string;
  name: string;
  iconName: string;
  score: number; // 0 - 100
  status: 'norm' | 'warning' | 'critical' | 'insufficient_data';
  statusText: string;
  description: string;
  attentionLevel: 'Низкий' | 'Умеренный' | 'Высокий';
  deviationsCount: number;
  detailedAnalysis: string;
  lifestyleRecommendations: string[];
  recommendedTests: Array<{ name: string; reason: string; urgency: 'Срочно' | 'Рекомендуется' }>;
}

export interface StateConnection {
  id: string;
  title: string;
  sourceMarker: string;
  affectedSystems: string[];
  severity: 'warning' | 'critical' | 'info';
  mechanism: string; // Объяснение биохимической/физиологической связи
  recommendation: string;
}

export interface RecommendedTest {
  id: string;
  name: string;
  category: 'Лабораторный анализ' | 'УЗИ / МРТ' | 'Консультация' | 'Функциональный тест';
  reason: string;
  urgency: 'Срочно' | 'Рекомендуется' | 'Планово';
  targetSystem: string;
  isCompleted?: boolean;
}

// Structured Medical & Health Analysis Types (Strict Requirements)
export type HealthStatusLevel =
  | 'norm'
  | 'slight_deviation'
  | 'attention'
  | 'consultation_recommended'
  | 'urgent_help'
  | 'insufficient_data';

export type UrgencyLevel = 'planned' | 'soon' | 'urgent' | 'emergency';

export interface PossibleCause {
  title: string;
  description: string;
  category: 'common' | 'lifestyle' | 'medication' | 'doctor_check';
}

export interface DoctorRecommendation {
  specialty: string;
  reason: string;
  urgency: UrgencyLevel;
  urgencyLabel: string;
  timeframe: string;
  prepareItems: string[];
}

export interface HealthAttentionItem {
  id: string;
  markerId?: string;
  title: string;
  value?: string;
  unit?: string;
  reference?: string;
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  statusLevel: HealthStatusLevel;
  shortSummary: string; // 2-3 lines: what, importance, what to do
  plainExplanation: string; // Plain language, terms in brackets
  possibleCauses: PossibleCause[];
  safeActionsNow: string[];
  doctor: DoctorRecommendation;
  emergencySigns?: string;
  confidence: number; // 0 to 1
  reasoningSources: Array<{ label: string; detail: string }>;
}

export interface BodySystemReport {
  id: string;
  name: string;
  status: HealthStatusLevel;
  statusLabel: string;
  score: number; // 0-100
  briefComment: string;
  influencingMarkers: string[];
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  normItems: string[];
  attentionItems: string[];
  nextAction: string;
  hasSufficientData: boolean;
}

export interface UrgentRedFlagAlert {
  id: string;
  title: string;
  description: string;
  criticalSymptoms: string[];
  recommendedAction: string;
  emergencyNumber: string;
}

export interface StructuredHealthAnalysis {
  overallStatus: HealthStatusLevel;
  overallScore: number; // 0 to 10
  summary: string;
  confidence: number; // 0 to 1
  dataCompleteness: number; // 0 to 1
  urgentAlert: UrgentRedFlagAlert | null;
  positiveFactors: string[];
  negativeFactors: string[];
  calculationSources: Array<{ label: string; detail: string }>;
  attentionItems: HealthAttentionItem[];
  systems: BodySystemReport[];
  dailyRecommendations: string[];
  resourceForecast: {
    level: 'high' | 'medium' | 'low' | 'insufficient_data';
    description: string;
    drivers: string[];
  };
  disclaimer: string;
}

export interface DailyLogEntry {
  date: string; // e.g., '27.07'
  subject_profile_id?: string;
  energy: number;
  sleep: number;
  stress: number;
  mood: number;
  comfort: number;
}

// ==========================================
// MENTAL HEALTH DIARY TYPES (ДНЕВНИК ПСИХИЧЕСКОГО СОСТОЯНИЯ)
// ==========================================

export type MoodType =
  | 'спокойствие'
  | 'радость'
  | 'вдохновение'
  | 'уверенность'
  | 'удовлетворение'
  | 'тревога'
  | 'раздражение'
  | 'грусть'
  | 'апатия'
  | 'усталость'
  | 'одиночество'
  | 'чувство вины'
  | 'злость'
  | 'страх'
  | 'эмоциональное перенапряжение';

export type EventCategory =
  | 'работа'
  | 'учёба'
  | 'отношения'
  | 'семья'
  | 'друзья'
  | 'здоровье'
  | 'внешность'
  | 'финансы'
  | 'отдых'
  | 'сон'
  | 'питание'
  | 'физическая активность'
  | 'социальные сети'
  | 'одиночество'
  | 'домашние дела'
  | 'прогулка'
  | 'творчество'
  | 'другое';

export type UserReaction =
  | 'начал работать'
  | 'отложил дела'
  | 'лёг спать'
  | 'поел'
  | 'пошёл гулять'
  | 'поговорил с кем-то'
  | 'остался один'
  | 'начал листать социальные сети'
  | 'заплакал'
  | 'разозлился'
  | 'занялся спортом'
  | 'использовал алкоголь или другие вещества'
  | 'другое';

export type HelpfulAction =
  | 'сон'
  | 'отдых'
  | 'прогулка'
  | 'музыка'
  | 'разговор'
  | 'поддержка близкого'
  | 'еда'
  | 'спорт'
  | 'работа'
  | 'творчество'
  | 'дыхательные упражнения'
  | 'время в одиночестве'
  | 'ничего не помогло'
  | 'другое';

export interface RelatedPerson {
  id: string;
  name: string;
  role: 'партнёр' | 'руководитель' | 'коллега' | 'мама' | 'папа' | 'друг' | 'родственник' | 'знакомый' | 'другое';
}

export interface PhysicalFactors {
  sleepDurationHours?: number;
  sleepQualityScore?: number; // 1-10
  foodStatus?: 'полноценный приём' | 'перекус' | 'пропустил приём' | 'переедание';
  physicalActivityLevel?: 'активная' | 'умеренная' | 'низкая' | 'отсутствовала';
  hasPainOrDiscomfort?: boolean;
  painDescription?: string;
  medicationTaken?: boolean;
  medicationDetails?: string;
  caffeineConsumed?: boolean;
  alcoholConsumed?: boolean;
  menstrualCycleDay?: number;
}

export interface DiaryAIAnalysis {
  id: string;
  entry_id: string;
  detected_emotions: string[];
  detected_topics: string[];
  detected_triggers: string[];
  detected_resource_factors: string[];
  mentioned_people: string[];
  sentiment_score: number; // -1 to 1
  risk_level: 'none' | 'low' | 'moderate' | 'critical';
  risk_categories?: string[];
  model_confidence: 'low' | 'medium' | 'high';
  model_version: string;
  created_at: string;
  summary_insight?: string;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  subject_profile_id?: string;
  created_at: string; // ISO string
  event_datetime: string; // YYYY-MM-DDTHH:mm or ISO
  entry_type: 'quick' | 'full';

  state_score: number; // 1-10
  energy_score: number; // 1-10
  anxiety_score?: number; // 1-10
  stress_score?: number; // 1-10
  tension_score?: number; // 1-10

  moods: string[]; // selected moods + custom string
  event_categories?: EventCategory[];
  event_description?: string;
  related_people?: RelatedPerson[];
  thoughts?: string;
  user_reactions?: string[];
  reaction_comment?: string;
  helpful_actions?: string[];
  helpful_comment?: string;

  physical_factors?: PhysicalFactors;
  additional_note?: string;

  updated_at?: string;

  ai_analysis?: DiaryAIAnalysis;
}

export interface UserMentalPatterns {
  user_id: string;
  positive_triggers: Array<{ text: string; impact: string; confidence: 'low' | 'medium' | 'high' }>;
  negative_triggers: Array<{ text: string; impact: string; confidence: 'low' | 'medium' | 'high' }>;
  resource_actions: string[];
  resource_days: string[]; // e.g., ['Суббота', 'Воскресенье']
  resource_time_periods: string[]; // e.g., ['Утро (08:00 - 12:00)']
  average_state: number;
  average_energy: number;
  average_anxiety: number;
  average_stress: number;
  trend_direction: 'improving' | 'stable' | 'declining' | 'cyclical';
  resource_forecast: 'high' | 'medium' | 'low' | 'insufficient_data';
  forecast_reasoning: string;
  forecast_drivers: string[];
  prediction_confidence: 'low' | 'medium' | 'high';
  recommendations: string[];
  last_recalculated_at: string;
}

export interface WeeklyMentalReport {
  id: string;
  week_range: string; // e.g. "21-27 Июля 2026"
  average_state: number;
  state_change_vs_last_week: number; // e.g. +0.8 or -0.5
  positive_highlights: string[];
  negative_highlights: string[];
  identified_triggers: string[];
  effective_resource_actions: string[];
  next_week_forecast: string;
  recommendations: string[];
  is_enabled: boolean;
}

// ==========================================
// MEDICATION INTAKE & CHECKLIST TYPES (ЛЕКАРСТВА СЕГОДНЯ)
// ==========================================

export type IntakeStatus =
  | 'Запланировано'
  | 'Скоро'
  | 'Пора принять'
  | 'Принято'
  | 'Принято раньше'
  | 'Принято с опозданием'
  | 'Пропущено'
  | 'Отложено'
  | 'Отменено по назначению'
  | 'Не подтверждено';

export type FoodRelation =
  | 'За 30 минут до еды'
  | 'Во время еды'
  | 'После еды'
  | 'Независимо от еды'
  | 'По схеме врача'
  | 'Связь с едой не указана'
  | 'Утренний приём'
  | 'Дневной приём'
  | 'Вечерний приём'
  | 'Напоминание';

export interface MedicationIntake {
  intake_id: string;
  intake_schedule_id: string;
  user_id: string;
  medication_id: string;
  medication_name: string;
  dose: string;
  dose_unit: string;
  quantity: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:mm
  scheduled_datetime: string; // ISO
  taken_at?: string | null; // ISO or local HH:mm string when taken
  original_taken_at?: string | null;
  corrected_taken_at?: string | null;
  corrected_by_user?: boolean;
  correction_created_at?: string | null;
  timezone?: string;
  status: IntakeStatus;
  food_relation: FoodRelation;
  source?: 'dashboard_checkbox' | 'push_notification' | 'manual_edit' | 'ai_chat';
  comment?: string;
  instructionsUrl?: string;
  snooze_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationIntakeAudit {
  event_id: string;
  intake_id: string;
  previous_status: IntakeStatus;
  new_status: IntakeStatus;
  event_datetime: string;
  source: string;
  user_id: string;
  note?: string;
}

// ==========================================
// PUZZLE / USER MODULE CONFIG TYPES
// ==========================================

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


