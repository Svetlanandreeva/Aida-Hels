import {
  UserProfile,
  MedicalDocument,
  DailyLogEntry,
  PressureLogEntry,
} from '../types';

export interface OrganismSystemAgeMarker {
  name: string;
  value: string;
  norm: string;
  status: 'norm' | 'attention' | 'warning';
}

export interface OrganismSystemAge {
  id: string;
  name: string;
  age: number;
  diffYears: number;
  status: 'better' | 'same' | 'worse';
  iconName: string;
  explanation: string;
  markers: OrganismSystemAgeMarker[];
  recommendations: string[];
}

export interface OrganismFactorImpact {
  id: string;
  name: string;
  impactYears: number;
  category: 'inflammation' | 'sleep' | 'deficits' | 'pressure' | 'activity' | 'metabolism' | 'other';
  isNegativeForHealth: boolean;
}

export interface OrganismAgeResult {
  passportAge: number;
  organismAge: number;
  differenceYears: number;
  confidenceLevel: 'Высокая точность' | 'Средняя точность' | 'Предварительная оценка';
  confidenceScore: number;
  evaluatedMetricsCount: number;
  hasSufficientData: boolean;
  missingMetricsCount: number;
  scores: {
    cardiovascularScore: number;
    metabolicScore: number;
    bloodScore: number;
    liverScore: number;
    kidneyScore: number;
    inflammationScore: number;
    recoveryScore: number;
    lifestyleScore: number;
  };
  systemAges: OrganismSystemAge[];
  factors: OrganismFactorImpact[];
  differenceText: string;
}

export function formatYearsRussian(val: number): string {
  const abs = Math.abs(Math.round(val));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${abs} лет`;
  if (mod10 === 1) return `${abs} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${abs} года`;
  return `${abs} лет`;
}

export function formatYearsDiffRussian(diff: number): string {
  if (diff === 0) return '0';
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(Math.round(diff));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let word = 'лет';
  if (!(mod100 >= 11 && mod100 <= 19)) {
    if (mod10 === 1) word = 'год';
    else if (mod10 >= 2 && mod10 <= 4) word = 'года';
  }
  return `${sign}${abs} ${word}`;
}

function getPassportAge(user?: UserProfile | null): number {
  if (!user?.birthDate) return 0;
  const birth = new Date(user.birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age > 0 && age < 130 ? age : 0;
}

function countRealLabMarkers(documents: MedicalDocument[]): number {
  return documents.reduce((count, doc) => {
    if (Array.isArray(doc.allMarkers) && doc.allMarkers.length > 0) return count + doc.allMarkers.length;
    if (Array.isArray(doc.deviations) && doc.deviations.length > 0) return count + doc.deviations.length;
    return count;
  }, 0);
}

export function calculateOrganismAge(
  user?: UserProfile | null,
  documents: MedicalDocument[] = [],
  pressureLogs: PressureLogEntry[] = [],
  dailyLogs: DailyLogEntry[] = []
): OrganismAgeResult {
  const passportAge = getPassportAge(user);
  const labMarkersCount = countRealLabMarkers(documents);
  const validPressureCount = pressureLogs.filter((p) => p?.systolic != null && p?.diastolic != null).length;
  const validDailyCount = dailyLogs.filter((d) => d && (d.sleep != null || d.energy != null || d.stress != null)).length;
  const hasAnthropometrics = Boolean(user?.height && user?.weight && user.height > 0 && user.weight > 0);
  const evaluatedMetricsCount = labMarkersCount + validPressureCount + validDailyCount + (hasAnthropometrics ? 1 : 0);

  return {
    passportAge,
    organismAge: 0,
    differenceYears: 0,
    confidenceLevel: 'Предварительная оценка',
    confidenceScore: 0,
    evaluatedMetricsCount,
    hasSufficientData: false,
    missingMetricsCount: Math.max(0, 5 - evaluatedMetricsCount),
    scores: {
      cardiovascularScore: 0,
      metabolicScore: 0,
      bloodScore: 0,
      liverScore: 0,
      kidneyScore: 0,
      inflammationScore: 0,
      recoveryScore: 0,
      lifestyleScore: 0,
    },
    systemAges: [],
    factors: [],
    differenceText: evaluatedMetricsCount === 0
      ? 'Пока нет данных для расчёта'
      : 'Расчётный возраст организма пока недоступен: нужна утверждённая методика и достаточный набор подтверждённых данных',
  };
}