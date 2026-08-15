import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "ru" | "en";

const LANG_KEY = "aida.lang";

type Dict = Record<string, { ru: string; en: string }>;

const D: Dict = {
  // Tabs
  tab_home: { ru: "Пазл", en: "Puzzle" },
  tab_timeline: { ru: "Хронология", en: "Timeline" },
  tab_chat: { ru: "Аида", en: "Aida" },
  tab_profile: { ru: "Профиль", en: "Profile" },

  // Common
  cancel: { ru: "Отмена", en: "Cancel" },
  save: { ru: "Сохранить", en: "Save" },
  add: { ru: "Добавить", en: "Add" },
  delete: { ru: "Удалить", en: "Delete" },
  close: { ru: "Закрыть", en: "Close" },
  retry: { ru: "Повторить", en: "Retry" },
  loading: { ru: "Загрузка…", en: "Loading…" },
  today: { ru: "Сегодня", en: "Today" },
  done: { ru: "Готово", en: "Done" },
  optional: { ru: "необязательно", en: "optional" },

  // Profiles
  my_profile: { ru: "Я", en: "Me" },
  child: { ru: "Ребёнок", en: "Child" },
  relative: { ru: "Близкий", en: "Relative" },
  switch_profile: { ru: "Профиль", en: "Profile" },
  add_profile: { ru: "Новый профиль", en: "New profile" },
  profile_name: { ru: "Имя", en: "Name" },
  profile_kind: { ru: "Тип профиля", en: "Profile type" },

  // Home
  hello: { ru: "Привет", en: "Hi" },
  home_subtitle: { ru: "Собираем картину вашего здоровья", en: "Building your health picture" },
  readiness: { ru: "Готовность аналитики", en: "Analytics readiness" },
  readiness_hint: { ru: "Чем больше данных, тем точнее наблюдения Аиды", en: "More data means better observations from Aida" },
  next_medication: { ru: "Ближайшее лекарство", en: "Next medication" },
  recent_symptom: { ru: "Последний симптом", en: "Recent symptom" },
  latest_lab: { ru: "Последний анализ", en: "Latest lab result" },
  quests: { ru: "Квесты", en: "Quests" },
  companion: { ru: "Спутник Аида", en: "Aida companion" },
  level: { ru: "Уровень", en: "Level" },
  xp_to_next: { ru: "XP до уровня", en: "XP to next level" },
  customize: { ru: "Настроить пазл", en: "Customize puzzle" },
  customize_hint: { ru: "Включайте и выключайте виджеты", en: "Toggle widgets on and off" },
  log_data: { ru: "Записать данные", en: "Log new data" },
  none_yet: { ru: "Пока нет данных", en: "No data yet" },
  no_active_meds: { ru: "Нет активных лекарств", en: "No active medications" },
  quick_note: { ru: "Быстрая заметка", en: "Quick note" },

  // Timeline
  timeline_title: { ru: "Хронология здоровья", en: "Health timeline" },
  all: { ru: "Все", en: "All" },
  labs: { ru: "Анализы", en: "Labs" },
  symptoms: { ru: "Симптомы", en: "Symptoms" },
  medications: { ru: "Лекарства", en: "Medications" },
  timeline_empty: { ru: "Загрузите первый анализ или запишите симптом", en: "Upload your first lab or log a symptom" },
  biomarkers: { ru: "показателей", en: "biomarkers" },
  reference: { ru: "Норма", en: "Reference" },
  ai_note: { ru: "Наблюдение Аиды", en: "Aida's note" },

  // Upload
  upload_lab: { ru: "Загрузить анализ", en: "Upload lab test" },
  add_lab: { ru: "Добавить анализ", en: "Add lab test" },
  from_camera: { ru: "Сделать фото", en: "Take a photo" },
  from_gallery: { ru: "Выбрать из галереи", en: "Pick from gallery" },
  from_file: { ru: "Выбрать файл (PDF)", en: "Pick a file (PDF)" },
  recognizing: { ru: "Аида распознаёт анализ…", en: "Aida is reading the test…" },
  whose_lab: { ru: "Чей это анализ?", en: "Whose test is this?" },
  whose_lab_hint: { ru: "Данные сохранятся в выбранный профиль", en: "Data will be saved to the selected profile" },

  // Symptom / med add
  add_symptom: { ru: "Записать симптом", en: "Log symptom" },
  symptom_name: { ru: "Что беспокоит", en: "What bothers you" },
  severity: { ru: "Выраженность", en: "Severity" },
  note: { ru: "Заметка", en: "Note" },
  add_medication: { ru: "Добавить лекарство", en: "Add medication" },
  med_name: { ru: "Название", en: "Name" },
  dose: { ru: "Дозировка", en: "Dose" },
  schedule: { ru: "Расписание", en: "Schedule" },
  active: { ru: "Принимается сейчас", en: "Currently taking" },
  lab_title: { ru: "Название анализа", en: "Test title" },
  lab_date: { ru: "Дата", en: "Date" },

  // Chat
  aida_greeting: {
    ru: "Здравствуйте! Я Аида, ваш помощник по здоровью. Я вижу ваши данные и помогу их понять. О чём поговорим?",
    en: "Hello! I'm Aida, your health companion. I can see your data and help you understand it. What shall we talk about?",
  },
  chat_placeholder: { ru: "Спросите Аиду…", en: "Ask Aida…" },
  chat_disclaimer: { ru: "Аида не заменяет врача", en: "Aida does not replace a doctor" },
  starter_1: { ru: "Что показывает мой последний анализ?", en: "What does my latest lab show?" },
  starter_2: { ru: "Что изменилось за последние 2 недели?", en: "What changed in the last 2 weeks?" },
  starter_3: { ru: "Каких данных не хватает?", en: "What data is missing?" },
  clear_chat: { ru: "Очистить чат", en: "Clear chat" },
  aida_thinking: { ru: "Аида думает…", en: "Aida is thinking…" },

  // Profile
  health_card: { ru: "Карта здоровья", en: "Health card" },
  allergies: { ru: "Аллергии", en: "Allergies" },
  chronic: { ru: "Хронические состояния", en: "Chronic conditions" },
  none: { ru: "Нет", en: "None" },
  edit: { ru: "Редактировать", en: "Edit" },
  height: { ru: "Рост", en: "Height" },
  weight: { ru: "Вес", en: "Weight" },
  blood_type: { ru: "Группа крови", en: "Blood type" },
  age: { ru: "Возраст", en: "Age" },
  years: { ru: "лет", en: "y.o." },
  generate_report: { ru: "Отчёт для врача", en: "Doctor report" },
  settings: { ru: "Настройки", en: "Settings" },
  language: { ru: "Язык", en: "Language" },

  // Report
  report_title: { ru: "Отчёт для врача", en: "Doctor report" },
  period: { ru: "Период", en: "Period" },
  days_30: { ru: "30 дней", en: "30 days" },
  days_90: { ru: "90 дней", en: "90 days" },
  days_365: { ru: "1 год", en: "1 year" },
  facts: { ru: "Фактические данные", en: "Recorded data" },
  ai_observations: { ru: "Наблюдения Аиды (не диагноз)", en: "Aida's observations (not a diagnosis)" },
  report_generating: { ru: "Формируем отчёт…", en: "Generating report…" },
  no_records: { ru: "Нет записей за период", en: "No records in this period" },

  // Health hub / modules
  tab_health: { ru: "Здоровье", en: "Health" },
  tab_tasks: { ru: "Задачи", en: "Tasks" },
  health_modules: { ru: "Модули здоровья", en: "Health modules" },
  m_labs: { ru: "Анализы", en: "Lab tests" },
  m_pressure: { ru: "Давление", en: "Blood pressure" },
  m_mind: { ru: "Психика", en: "Mind & mood" },
  m_meds: { ru: "Лекарства", en: "Medications" },
  m_measures: { ru: "Измерения", en: "Measurements" },
  m_history: { ru: "История здоровья", en: "Health history" },
  back: { ru: "Назад", en: "Back" },

  // Overview / home extras
  today_state: { ru: "Общее состояние сегодня", en: "Today's overview" },
  ai_day: { ru: "ИИ-итог дня", en: "AI daily summary" },
  needs_attention: { ru: "Требует внимания", en: "Needs attention" },
  all_good: { ru: "Всё спокойно — тревожных сигналов нет", en: "All calm — no alerts" },
  quick_checkin: { ru: "Быстрый чек-ин", en: "Quick check-in" },
  view_details: { ru: "Подробнее", en: "Details" },
  not_enough_data: { ru: "Недостаточно данных", en: "Not enough data" },

  // Pressure
  add_pressure: { ru: "Добавить измерение", en: "Add measurement" },
  systolic: { ru: "Систолическое (верхнее)", en: "Systolic (upper)" },
  diastolic: { ru: "Диастолическое (нижнее)", en: "Diastolic (lower)" },
  pulse: { ru: "Пульс", en: "Pulse" },
  avg: { ru: "Среднее", en: "Average" },
  min: { ru: "Мин", en: "Min" },
  max: { ru: "Макс", en: "Max" },
  last_7: { ru: "7 дней", en: "7 days" },
  last_30: { ru: "30 дней", en: "30 days" },
  pressure_empty: { ru: "Пока нет измерений давления", en: "No blood pressure readings yet" },

  // Mind check-in
  mood: { ru: "Настроение", en: "Mood" },
  energy: { ru: "Энергия", en: "Energy" },
  stress: { ru: "Стресс", en: "Stress" },
  anxiety: { ru: "Тревога", en: "Anxiety" },
  sleep_q: { ru: "Качество сна", en: "Sleep quality" },
  triggers: { ru: "Триггеры / события", en: "Triggers / events" },
  save_checkin: { ru: "Сохранить чек-ин", en: "Save check-in" },
  mind_empty: { ru: "Записывайте самочувствие, чтобы видеть динамику", en: "Log how you feel to see trends" },
  checkin_saved: { ru: "Чек-ин сохранён", en: "Check-in saved" },

  // Tasks
  tasks_today: { ru: "Сегодня", en: "Today" },
  tasks_upcoming: { ru: "Предстоящие", en: "Upcoming" },
  tasks_done: { ru: "Выполнено", en: "Done" },
  add_task: { ru: "Добавить задачу", en: "Add task" },
  task_title: { ru: "Название задачи", en: "Task title" },
  task_type: { ru: "Тип", en: "Type" },
  tasks_empty: { ru: "Задач пока нет", en: "No tasks yet" },
  measure_pressure: { ru: "Измерить давление", en: "Measure pressure" },
  fill_diary: { ru: "Заполнить дневник", en: "Fill diary" },
};

export const t = (key: keyof typeof D | string, lang: Lang): string => {
  const entry = (D as Dict)[key];
  if (!entry) return String(key);
  return entry[lang];
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const I18nContext = createContext<Ctx>({
  lang: "ru",
  setLang: () => {},
  toggleLang: () => {},
  t: (k) => k,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    storage.getItem<Lang>(LANG_KEY, "ru").then((v) => {
      if (v === "ru" || v === "en") setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(LANG_KEY, l);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "ru" ? "en" : "ru";
      storage.setItem(LANG_KEY, next);
      return next;
    });
  }, []);

  const translate = useCallback((k: string) => t(k, lang), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t: translate }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
