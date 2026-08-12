/**
 * CANONICAL MEDICAL DOMAIN SCHEMA DEFINITIONS & TABLE STATEMENTS
 * 
 * Required for all clinical entities:
 * - provenance: source detail, author, institution, document/device reference
 * - timestamps: recordedAt, createdAt, updatedAt
 * - source: origin type ('manual', 'ocr_scan', 'lab_api', 'wearable', 'ehr_import', 'doctor_note')
 * - verification_status: ('unverified', 'patient_reported', 'verified_by_doctor', 'lab_certified')
 */

export type SourceType =
  | 'patient_manual'
  | 'ocr_scan'
  | 'lab_integration'
  | 'ehr_import'
  | 'wearable_device'
  | 'doctor_entry'
  | 'ai_derived';

export type VerificationStatus =
  | 'unverified'
  | 'patient_reported'
  | 'verified_by_doctor'
  | 'lab_certified'
  | 'disputed';

export interface MedicalProvenance {
  authorId?: string;
  authorName?: string;
  institutionId?: string;
  institutionName?: string;
  deviceModel?: string;
  serialNumber?: string;
  documentId?: string;
  rawTextSnippet?: string;
  notes?: string;
}

export interface MedicalTimestamps {
  recordedAt: string; // ISO string
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
}

// Common Medical Entity Metadata Mixin
export interface BaseMedicalEntity {
  id: string;
  accountId: string;
  subjectProfileId: string;
  source: SourceType;
  verificationStatus: VerificationStatus;
  provenance: MedicalProvenance;
  timestamps: MedicalTimestamps;
}

// 1. Accounts
export interface AccountEntity {
  id: string;
  email: string;
  fullName?: string;
  passwordHash: string;
  isVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 2. Profiles
export interface ProfileEntity {
  id: string;
  accountId: string;
  type: 'self' | 'child' | 'relative' | 'elder' | 'pet';
  fullName: string;
  relationship: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  bloodType?: string;
  heightCm?: number;
  weightKg?: number;
  colorTag?: string;
  avatarUrl?: string;
  allergies?: string[];
  chronicDiagnoses?: string[];
  createdAt: string;
  updatedAt: string;
}

// 3. ProfileRelationships
export interface ProfileRelationshipEntity {
  id: string;
  accountId: string;
  subjectProfileId: string;
  relationshipType: 'parent' | 'guardian' | 'spouse' | 'adult_child' | 'legal_proxy' | 'self';
  permissions: ('read' | 'write' | 'admin' | 'emergency')[];
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// 4. AccessGrants
export interface AccessGrantEntity {
  id: string;
  accountId: string;
  subjectProfileId: string;
  granteeEmail: string;
  granteeRole: 'doctor' | 'family' | 'carer' | 'researcher';
  scopes: string[]; // e.g. ['labs', 'prescriptions', 'vitals']
  expiresAt?: string;
  status: 'active' | 'revoked' | 'expired';
  provenance: MedicalProvenance;
  timestamps: MedicalTimestamps;
}

// 5. Consents
export interface ConsentEntity {
  id: string;
  accountId: string;
  subjectProfileId: string;
  consentType: 'data_processing' | 'ai_analysis' | 'telemetry' | 'anonymized_research' | 'emergency_access';
  isAgreed: boolean;
  agreedAt: string;
  revokedAt?: string;
  policyVersion: string;
  ipAddress?: string;
  provenance: MedicalProvenance;
  timestamps: MedicalTimestamps;
}

// 6. Measurements
export interface MeasurementEntity extends BaseMedicalEntity {
  type: 'bp_systolic' | 'bp_diastolic' | 'pulse' | 'glucose' | 'weight' | 'height' | 'temperature' | 'spo2' | 'body_fat';
  value: number;
  unit: string;
  notes?: string;
}

// 7. LabReports
export interface LabReportEntity extends BaseMedicalEntity {
  title: string;
  labName: string;
  reportDate: string;
  category: string;
  documentUrl?: string;
  rawOcrText?: string;
}

// 8. LabResults
export interface LabResultEntity extends BaseMedicalEntity {
  labReportId: string;
  markerName: string;
  codeLOINC?: string;
  value: string;
  valueNumeric?: number;
  unit?: string;
  referenceRangeMin?: number;
  referenceRangeMax?: number;
  referenceRangeString?: string;
  status: 'normal' | 'low' | 'high' | 'critical';
}

// 9. Symptoms
export interface SymptomEntity extends BaseMedicalEntity {
  symptomName: string;
  bodySite?: string;
  severity: number; // 1-10
  onsetAt: string;
  durationMinutes?: number;
  triggers?: string[];
  notes?: string;
}

// 10. Conditions / Diagnoses
export interface ConditionEntity extends BaseMedicalEntity {
  conditionName: string;
  icd10Code?: string;
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'remission' | 'resolved';
  diagnosedAt?: string;
  diagnosingDoctor?: string;
  notes?: string;
}

// 11. Allergies
export interface AllergyEntity extends BaseMedicalEntity {
  allergen: string;
  allergenCategory: 'drug' | 'food' | 'environment' | 'biologic';
  reaction?: string;
  reactionSeverity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  onsetAt?: string;
}

// 12. Medications
export interface MedicationEntity extends BaseMedicalEntity {
  drugName: string;
  genericName?: string;
  atcCode?: string;
  dosage: string;
  route: 'oral' | 'injection' | 'topical' | 'inhalation' | 'sublingual';
  frequency: string;
  startDate?: string;
  endDate?: string;
  prescribingDoctor?: string;
  reason?: string;
}

// 13. MedicationEvents
export interface MedicationEventEntity extends BaseMedicalEntity {
  medicationId: string;
  scheduledAt: string;
  takenAt?: string;
  status: 'taken' | 'missed' | 'skipped' | 'late';
  actualDosage?: string;
  notes?: string;
}

// 14. Procedures
export interface ProcedureEntity extends BaseMedicalEntity {
  procedureName: string;
  codeCPT?: string;
  performingDoctor?: string;
  facility?: string;
  performedAt: string;
  outcomeNotes?: string;
}

// 15. Hospitalizations
export interface HospitalizationEntity extends BaseMedicalEntity {
  hospitalName: string;
  admissionReason: string;
  admissionDate: string;
  dischargeDate?: string;
  dischargeSummary?: string;
  attendingDoctor?: string;
}

// 16. Infections
export interface InfectionEntity extends BaseMedicalEntity {
  infectionName: string;
  pathogenCategory: 'viral' | 'bacterial' | 'fungal' | 'parasitic';
  onsetAt: string;
  resolutionAt?: string;
  status: 'acute' | 'chronic' | 'resolved';
}

// 17. Vaccinations
export interface VaccinationEntity extends BaseMedicalEntity {
  vaccineName: string;
  targetPathogen: string;
  doseNumber?: number;
  lotNumber?: string;
  administeredAt: string;
  facility?: string;
  adverseReactions?: string;
}

// 18. FamilyHistory
export interface FamilyHistoryEntity extends BaseMedicalEntity {
  relativeRelationship: 'mother' | 'father' | 'grandmother_maternal' | 'grandfather_paternal' | 'sibling' | 'child' | 'other';
  conditionName: string;
  onsetAge?: number;
  notes?: string;
}

// 19. SleepSessions
export interface SleepSessionEntity extends BaseMedicalEntity {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;
  sleepScore?: number;
}

// 20. ActivityDaily
export interface ActivityDailyEntity extends BaseMedicalEntity {
  date: string;
  stepCount: number;
  distanceMeters?: number;
  activeCalories?: number;
  totalCalories?: number;
  standingHours?: number;
}

// 21. Workouts
export interface WorkoutEntity extends BaseMedicalEntity {
  workoutType: 'running' | 'swimming' | 'cycling' | 'strength' | 'yoga' | 'walking' | 'other';
  startTime: string;
  durationMinutes: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  notes?: string;
}

// 22. MentalCheckins
export interface MentalCheckinEntity extends BaseMedicalEntity {
  moodScore: number;    // 1-10
  energyScore: number;  // 1-10
  stressScore: number;  // 1-10
  anxietyScore?: number;// 1-10
  phq9Score?: number;
  gad7Score?: number;
  journalText?: string;
}

// 23. CycleEvents
export interface CycleEventEntity extends BaseMedicalEntity {
  date: string;
  eventType: 'period_start' | 'period_end' | 'ovulation' | 'spotting';
  flowIntensity?: 'light' | 'medium' | 'heavy';
  symptomsList?: string[];
  notes?: string;
}

// 24. Pregnancies
export interface PregnancyEntity extends BaseMedicalEntity {
  estimatedDueDate: string;
  lmpDate?: string;
  gestationalAgeWeeks?: number;
  currentStatus: 'ongoing' | 'delivered' | 'terminated';
  deliveryDate?: string;
  complications?: string;
}

// 25. ImagingStudies
export interface ImagingStudyEntity extends BaseMedicalEntity {
  modality: 'xray' | 'mri' | 'ct' | 'ultrasound' | 'pet';
  bodyRegion: string;
  studyDate: string;
  facility?: string;
  radiologistName?: string;
  impressionText?: string;
  dicomStudyUid?: string;
}

// 26. ECGStudies
export interface ECGStudyEntity extends BaseMedicalEntity {
  studyDate: string;
  leadCount: 1 | 6 | 12;
  heartRate?: number;
  rhythm: 'sinus_rhythm' | 'atrial_fibrillation' | 'arrhythmia' | 'tachycardia' | 'bradycardia';
  prIntervalMs?: number;
  qrsDurationMs?: number;
  qtcMs?: number;
  interpretationText?: string;
}

// 27. DeviceSources / ConnectedSources
export interface DeviceSourceEntity {
  id: string;
  accountId: string;
  subjectProfileId: string;
  providerName: 'apple_health' | 'google_fit' | 'garmin' | 'whoop' | 'yandex_health' | 'invitro_api' | 'generic';
  deviceModel?: string;
  serialNumber?: string;
  authStatus: 'active' | 'expired' | 'revoked';
  lastSyncAt?: string;
  provenance: MedicalProvenance;
  timestamps: MedicalTimestamps;
}

// 28. SafetyEvents
export interface SafetyEventEntity extends BaseMedicalEntity {
  eventType: 'critical_lab' | 'hypertensive_crisis' | 'drug_interaction' | 'adverse_drug_reaction' | 'fall_detected';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  description: string;
  actionTaken?: string;
}

// 29. Locations
export interface LocationEntity {
  id: string;
  accountId: string;
  facilityName: string;
  facilityType: 'hospital' | 'clinic' | 'lab' | 'pharmacy' | 'dentistry';
  address?: string;
  phone?: string;
  website?: string;
  provenance: MedicalProvenance;
  timestamps: MedicalTimestamps;
}

// 30. AuditLog
export interface AuditLogEntity {
  id: string;
  accountId: string;
  subjectProfileId?: string;
  actorId: string;
  actorType: 'user' | 'doctor' | 'system' | 'ai_agent' | 'api_client';
  action: 'read' | 'create' | 'update' | 'delete' | 'export' | 'ai_analyze';
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// 31. AIInsights + EvidenceLinks
export interface EvidenceLinkEntity {
  id: string;
  insightId: string;
  targetEntityType: 'lab_result' | 'measurement' | 'condition' | 'medication' | 'symptom' | 'document';
  targetEntityId: string;
  snippet?: string;
  relevanceScore?: number;
}

export interface AIInsightEntity extends BaseMedicalEntity {
  insightType: 'risk_alert' | 'trend_summary' | 'medication_interaction' | 'preventive_recommendation';
  title: string;
  summary: string;
  confidenceScore: number; // 0.0 - 1.0
  status: 'active' | 'dismissed' | 'reviewed_by_doctor';
  evidenceLinks: EvidenceLinkEntity[];
}

// 32. Dental Suite Entities
export interface DentalProfileEntity extends BaseMedicalEntity {
  primaryDentistName?: string;
  dentalClinic?: string;
  lastCleaningDate?: string;
  notes?: string;
}

export interface ToothEntity extends BaseMedicalEntity {
  toothNumber: number; // FDI notation 11-48 / 51-85 or Universal 1-32
  status: 'healthy' | 'carious' | 'filled' | 'crowned' | 'missing' | 'implant' | 'root_canal';
  surfaceNotes?: string;
}

export interface DentalFindingEntity extends BaseMedicalEntity {
  toothNumber: number;
  findingType: 'caries' | 'pulpitis' | 'periodontitis' | 'gingivitis' | 'calculus' | 'malocclusion';
  severity: 'mild' | 'moderate' | 'severe';
  detectedAt: string;
}

export interface DentalProcedureEntity extends BaseMedicalEntity {
  toothNumber?: number;
  procedureType: 'filling' | 'root_canal' | 'crown' | 'extraction' | 'implant' | 'hygiene_cleaning' | 'orthodontic_adjustment';
  dentistName?: string;
  performedAt: string;
  cost?: number;
}

export interface DentalVisitEntity extends BaseMedicalEntity {
  visitDate: string;
  dentistName?: string;
  clinicName?: string;
  chiefComplaint?: string;
  diagnosisSummary?: string;
  treatmentPlan?: string;
}

export interface DentalImagingLinkEntity extends BaseMedicalEntity {
  toothNumber?: number;
  imagingType: 'panoramic_xray' | 'periapical_xray' | 'cbct_3d' | 'intraoral_photo';
  imageUrl: string;
  radiologistReport?: string;
  takenAt: string;
}

/**
 * YDB / SQL DDL Table Definitions for all 32 Clinical Entities
 */
export const CLINICAL_YQL_TABLE_DEFS: string[] = [
  // 1. Accounts
  `CREATE TABLE accounts (
    id Utf8,
    email Utf8,
    full_name Utf8,
    password_hash Utf8,
    is_verified Bool,
    mfa_enabled Bool,
    created_at Utf8,
    updated_at Utf8,
    PRIMARY KEY (id)
  );`,

  // 2. Profiles
  `CREATE TABLE subject_profiles (
    account_id Utf8,
    id Utf8,
    type Utf8,
    full_name Utf8,
    relationship Utf8,
    birth_date Utf8,
    gender Utf8,
    blood_type Utf8,
    height_cm Double,
    weight_kg Double,
    color_tag Utf8,
    avatar_url Utf8,
    data_json JsonDocument,
    created_at Utf8,
    updated_at Utf8,
    PRIMARY KEY (account_id, id)
  );`,

  // 3. ProfileRelationships
  `CREATE TABLE profile_relationships (
    account_id Utf8,
    id Utf8,
    subject_profile_id Utf8,
    relationship_type Utf8,
    permissions_json JsonDocument,
    is_primary Bool,
    created_at Utf8,
    PRIMARY KEY (account_id, id)
  );`,

  // 4. AccessGrants
  `CREATE TABLE access_grants (
    account_id Utf8,
    id Utf8,
    subject_profile_id Utf8,
    grantee_email Utf8,
    grantee_role Utf8,
    scopes_json JsonDocument,
    status Utf8,
    expires_at Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (account_id, id)
  );`,

  // 5. Consents
  `CREATE TABLE consents (
    account_id Utf8,
    id Utf8,
    subject_profile_id Utf8,
    consent_type Utf8,
    is_agreed Bool,
    agreed_at Utf8,
    revoked_at Utf8,
    policy_version Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (account_id, id)
  );`,

  // 6. Measurements
  `CREATE TABLE measurements (
    account_id Utf8,
    subject_profile_id Utf8,
    id Utf8,
    type Utf8,
    value Double,
    unit Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    recorded_at Utf8,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 7. LabReports
  `CREATE TABLE lab_reports (
    account_id Utf8,
    subject_profile_id Utf8,
    id Utf8,
    title Utf8,
    lab_name Utf8,
    report_date Utf8,
    category Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    data_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 8. LabResults
  `CREATE TABLE lab_results (
    subject_profile_id Utf8,
    id Utf8,
    lab_report_id Utf8,
    marker_name Utf8,
    code_loinc Utf8,
    value Utf8,
    value_numeric Double,
    unit Utf8,
    status Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    recorded_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 9. Symptoms
  `CREATE TABLE symptoms (
    subject_profile_id Utf8,
    id Utf8,
    symptom_name Utf8,
    body_site Utf8,
    severity Int32,
    onset_at Utf8,
    duration_minutes Int32,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 10. Conditions
  `CREATE TABLE conditions (
    subject_profile_id Utf8,
    id Utf8,
    condition_name Utf8,
    icd10_code Utf8,
    clinical_status Utf8,
    diagnosed_at Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 11. Allergies
  `CREATE TABLE allergies (
    subject_profile_id Utf8,
    id Utf8,
    allergen Utf8,
    allergen_category Utf8,
    reaction Utf8,
    reaction_severity Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 12. Medications
  `CREATE TABLE medications (
    subject_profile_id Utf8,
    id Utf8,
    drug_name Utf8,
    dosage Utf8,
    route Utf8,
    frequency Utf8,
    start_date Utf8,
    end_date Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 13. MedicationEvents
  `CREATE TABLE medication_events (
    subject_profile_id Utf8,
    id Utf8,
    medication_id Utf8,
    scheduled_at Utf8,
    taken_at Utf8,
    status Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 14. Procedures
  `CREATE TABLE procedures (
    subject_profile_id Utf8,
    id Utf8,
    procedure_name Utf8,
    code_cpt Utf8,
    performed_at Utf8,
    facility Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 15. Hospitalizations
  `CREATE TABLE hospitalizations (
    subject_profile_id Utf8,
    id Utf8,
    hospital_name Utf8,
    admission_reason Utf8,
    admission_date Utf8,
    discharge_date Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 16. Infections
  `CREATE TABLE infections (
    subject_profile_id Utf8,
    id Utf8,
    infection_name Utf8,
    pathogen_category Utf8,
    status Utf8,
    onset_at Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 17. Vaccinations
  `CREATE TABLE vaccinations (
    subject_profile_id Utf8,
    id Utf8,
    vaccine_name Utf8,
    target_pathogen Utf8,
    dose_number Int32,
    administered_at Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 18. FamilyHistory
  `CREATE TABLE family_history (
    subject_profile_id Utf8,
    id Utf8,
    relative_relationship Utf8,
    condition_name Utf8,
    onset_age Int32,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 19. SleepSessions
  `CREATE TABLE sleep_sessions (
    subject_profile_id Utf8,
    id Utf8,
    start_time Utf8,
    end_time Utf8,
    duration_minutes Int32,
    sleep_score Int32,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 20. ActivityDaily
  `CREATE TABLE activity_daily (
    subject_profile_id Utf8,
    id Utf8,
    date Utf8,
    step_count Int32,
    active_calories Int32,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 21. Workouts
  `CREATE TABLE workouts (
    subject_profile_id Utf8,
    id Utf8,
    workout_type Utf8,
    start_time Utf8,
    duration_minutes Int32,
    calories_burned Int32,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 22. MentalCheckins
  `CREATE TABLE mental_checkins (
    subject_profile_id Utf8,
    id Utf8,
    mood_score Int32,
    energy_score Int32,
    stress_score Int32,
    journal_text Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 23. CycleEvents
  `CREATE TABLE cycle_events (
    subject_profile_id Utf8,
    id Utf8,
    date Utf8,
    event_type Utf8,
    flow_intensity Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 24. Pregnancies
  `CREATE TABLE pregnancies (
    subject_profile_id Utf8,
    id Utf8,
    estimated_due_date Utf8,
    gestational_age_weeks Int32,
    current_status Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 25. ImagingStudies
  `CREATE TABLE imaging_studies (
    subject_profile_id Utf8,
    id Utf8,
    modality Utf8,
    body_region Utf8,
    study_date Utf8,
    impression_text Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 26. ECGStudies
  `CREATE TABLE ecg_studies (
    subject_profile_id Utf8,
    id Utf8,
    study_date Utf8,
    lead_count Int32,
    heart_rate Int32,
    rhythm Utf8,
    interpretation_text Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 27. DeviceSources
  `CREATE TABLE device_sources (
    account_id Utf8,
    id Utf8,
    subject_profile_id Utf8,
    provider_name Utf8,
    device_model Utf8,
    auth_status Utf8,
    last_sync_at Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (account_id, id)
  );`,

  // 28. SafetyEvents
  `CREATE TABLE safety_events (
    subject_profile_id Utf8,
    id Utf8,
    event_type Utf8,
    severity Utf8,
    title Utf8,
    description Utf8,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 29. Locations
  `CREATE TABLE locations (
    account_id Utf8,
    id Utf8,
    facility_name Utf8,
    facility_type Utf8,
    address Utf8,
    phone Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (account_id, id)
  );`,

  // 30. AuditLog
  `CREATE TABLE audit_logs (
    account_id Utf8,
    id Utf8,
    subject_profile_id Utf8,
    actor_id Utf8,
    actor_type Utf8,
    action Utf8,
    resource_type Utf8,
    timestamp Utf8,
    PRIMARY KEY (account_id, id)
  );`,

  // 31. AIInsights
  `CREATE TABLE ai_insights (
    subject_profile_id Utf8,
    id Utf8,
    insight_type Utf8,
    title Utf8,
    summary Utf8,
    confidence_score Double,
    status Utf8,
    evidence_json JsonDocument,
    source Utf8,
    verification_status Utf8,
    provenance_json JsonDocument,
    created_at Utf8,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  // 32. Dental Suite Tables
  `CREATE TABLE dental_profiles (
    subject_profile_id Utf8,
    id Utf8,
    primary_dentist Utf8,
    dental_clinic Utf8,
    last_cleaning_date Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  `CREATE TABLE dental_teeth (
    subject_profile_id Utf8,
    id Utf8,
    tooth_number Int32,
    status Utf8,
    surface_notes Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  `CREATE TABLE dental_findings (
    subject_profile_id Utf8,
    id Utf8,
    tooth_number Int32,
    finding_type Utf8,
    severity Utf8,
    detected_at Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  `CREATE TABLE dental_procedures (
    subject_profile_id Utf8,
    id Utf8,
    tooth_number Int32,
    procedure_type Utf8,
    dentist_name Utf8,
    performed_at Utf8,
    cost Double,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  `CREATE TABLE dental_visits (
    subject_profile_id Utf8,
    id Utf8,
    visit_date Utf8,
    dentist_name Utf8,
    clinic_name Utf8,
    chief_complaint Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,

  `CREATE TABLE dental_imaging_links (
    subject_profile_id Utf8,
    id Utf8,
    tooth_number Int32,
    imaging_type Utf8,
    image_url Utf8,
    taken_at Utf8,
    provenance_json JsonDocument,
    PRIMARY KEY (subject_profile_id, id)
  );`,
];
