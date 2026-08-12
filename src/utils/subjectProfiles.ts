import { UserProfile, ChronicDiagnosisItem } from '../types';

export type SubjectProfileType = 'self' | 'child' | 'relative';

export interface SubjectProfile {
  id: string; // subject_profile_id e.g. "sp-self-usr-1", "sp-child-101", "sp-relative-202"
  accountId: string; // account_id (owner account user id)
  type: SubjectProfileType;
  fullName: string;
  relationship: string; // e.g. "Я", "Сын Александр", "Дочь Мария", "Мама Елена", "Муж Андрей"
  birthDate?: string;
  gender?: 'female' | 'male';
  height?: number;
  weight?: number;
  avatarColor?: string;
  isPrimary?: boolean;
  permissions?: ('view' | 'edit' | 'manage')[];
  bloodType?: string;
  rhFactor?: '+' | '-';
  allergies?: string[];
  chronicDiagnoses?: ChronicDiagnosisItem[];
}

export function getPrimarySubjectProfileId(accountId: string = 'usr-1'): string {
  const cleanAccountId = accountId || 'usr-1';
  return `sp-self-${cleanAccountId}`;
}

export function getDefaultSubjectProfiles(account: UserProfile): SubjectProfile[] {
  const accountId = account.id || 'usr-1';
  const primaryId = getPrimarySubjectProfileId(accountId);

  return [
    {
      id: primaryId,
      accountId,
      type: 'self',
      fullName: account.fullName || 'Я (Собственный профиль)',
      relationship: 'Я',
      birthDate: account.birthDate,
      gender: account.gender || 'female',
      height: account.height,
      weight: account.weight,
      avatarColor: '#8968FF',
      isPrimary: true,
      permissions: ['view', 'edit', 'manage'],
      bloodType: account.bloodType,
      rhFactor: account.rhFactor,
      allergies: account.allergies,
      chronicDiagnoses: account.chronicDiagnoses,
    },
  ];
}

export function loadSubjectProfiles(account: UserProfile): SubjectProfile[] {
  const accountId = account.id || 'usr-1';
  const key = `app_subject_profiles_${accountId}`;
  const primaryId = getPrimarySubjectProfileId(accountId);

  let profiles: SubjectProfile[] = [];
  const saved = localStorage.getItem(key) || localStorage.getItem('app_subject_profiles');
  
  if (saved) {
    try {
      profiles = JSON.parse(saved);
    } catch {
      profiles = [];
    }
  }

  // Ensure primary profile exists and is updated with current account data
  const primaryIdx = profiles.findIndex((p) => p.isPrimary || p.type === 'self' || p.id === primaryId);
  const primaryProfile: SubjectProfile = {
    id: primaryId,
    accountId,
    type: 'self',
    fullName: account.fullName || 'Я (Собственный профиль)',
    relationship: 'Я',
    birthDate: account.birthDate,
    gender: account.gender || 'female',
    height: account.height,
    weight: account.weight,
    avatarColor: '#8968FF',
    isPrimary: true,
    permissions: ['view', 'edit', 'manage'],
    bloodType: account.bloodType,
    rhFactor: account.rhFactor,
    allergies: account.allergies,
    chronicDiagnoses: account.chronicDiagnoses,
  };

  if (primaryIdx >= 0) {
    profiles[primaryIdx] = {
      ...profiles[primaryIdx],
      ...primaryProfile,
      fullName: account.fullName || profiles[primaryIdx].fullName || 'Я (Собственный профиль)',
    };
  } else {
    profiles.unshift(primaryProfile);
  }

  return profiles;
}

export function saveSubjectProfiles(accountId: string, profiles: SubjectProfile[]): void {
  const cleanAccountId = accountId || 'usr-1';
  const key = `app_subject_profiles_${cleanAccountId}`;
  localStorage.setItem(key, JSON.stringify(profiles));
  localStorage.setItem('app_subject_profiles', JSON.stringify(profiles));
}

export function getStoredActiveSubjectProfileId(accountId: string): string {
  const cleanAccountId = accountId || 'usr-1';
  const primaryId = getPrimarySubjectProfileId(cleanAccountId);
  const key = `app_active_subject_profile_id_${cleanAccountId}`;
  
  return localStorage.getItem(key) || localStorage.getItem('app_active_subject_profile_id') || primaryId;
}

export function saveStoredActiveSubjectProfileId(accountId: string, subjectProfileId: string): void {
  const cleanAccountId = accountId || 'usr-1';
  const key = `app_active_subject_profile_id_${cleanAccountId}`;
  localStorage.setItem(key, subjectProfileId);
  localStorage.setItem('app_active_subject_profile_id', subjectProfileId);
}

/**
 * Filters a list of medical items so that only items belonging to activeSubjectProfileId are returned.
 * If an item lacks subject_profile_id, it is assumed to belong to primarySubjectProfileId for backward compatibility.
 */
export function filterBySubjectProfile<T extends { subject_profile_id?: string }>(
  items: T[],
  activeSubjectProfileId: string,
  primarySubjectProfileId: string
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    const itemSubjectId = item.subject_profile_id || primarySubjectProfileId;
    return itemSubjectId === activeSubjectProfileId;
  });
}

/**
 * Utility to construct a virtual UserProfile targeting the active subject profile
 * so health analysis and organism age algorithms run specifically for that subject.
 */
export function getSubjectUserProfile(
  accountUser: UserProfile,
  activeSubjectProfile: SubjectProfile
): UserProfile {
  if (activeSubjectProfile.isPrimary || activeSubjectProfile.type === 'self') {
    return accountUser;
  }

  return {
    ...accountUser,
    id: activeSubjectProfile.id,
    fullName: activeSubjectProfile.fullName,
    birthDate: activeSubjectProfile.birthDate || '',
    gender: activeSubjectProfile.gender || 'female',
    height: activeSubjectProfile.height || accountUser.height || 170,
    weight: activeSubjectProfile.weight || accountUser.weight || 65,
    bloodType: activeSubjectProfile.bloodType || '1 (0)',
    rhFactor: activeSubjectProfile.rhFactor || '+',
    allergies: activeSubjectProfile.allergies || [],
    chronicDiagnoses: activeSubjectProfile.chronicDiagnoses || [],
  };
}
