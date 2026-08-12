import { auditProvenanceService } from './auditProvenanceService';

export type DentitionType = 'permanent' | 'primary' | 'mixed';

export type ToothStatus =
  | 'unexamined' // IMPORTANT Rule 21: Default unexamined tooth (Empty map ≠ healthy)
  | 'healthy'
  | 'carious'
  | 'filled'
  | 'crowned'
  | 'missing'
  | 'implant'
  | 'root_canal_treated'
  | 'impacted'
  | 'prosthesis';

export interface ToothSurfaces {
  mesial?: boolean;
  distal?: boolean;
  occlusal?: boolean;
  buccal?: boolean;
  lingual?: boolean;
}

export interface ToothRecord {
  toothNumber: number; // FDI notation (11-48 permanent, 51-85 primary)
  dentition: 'permanent' | 'primary';
  status: ToothStatus;
  surfaces: ToothSurfaces;
  mobilityGrade: 0 | 1 | 2 | 3; // Periodontal mobility 0 (normal) to 3 (severe)
  examinationStatus: 'UNEXAMINED' | 'EXAMINED';
  notes?: string;
  updatedAt: string;
}

export interface DentalFinding {
  id: string;
  userId: string;
  toothNumber?: number;
  surface?: keyof ToothSurfaces;
  findingType:
    | 'caries'
    | 'pulpitis'
    | 'periodontitis'
    | 'gingivitis'
    | 'calculus'
    | 'malocclusion'
    | 'enamel_erosion'
    | 'periapical_lesion';
  severity: 'mild' | 'moderate' | 'severe';
  detectedAt: string;
  notes?: string;
}

export interface DentalProcedure {
  id: string;
  userId: string;
  toothNumber?: number;
  procedureType:
    | 'filling'
    | 'root_canal'
    | 'crown'
    | 'extraction'
    | 'implant'
    | 'hygiene_cleaning'
    | 'orthodontic_adjustment'
    | 'fluoridation'
    | 'whitening';
  dentistName?: string;
  clinicName?: string;
  cost?: number;
  performedAt: string;
  notes?: string;
}

export interface DentalSymptom {
  id: string;
  userId: string;
  toothNumber?: number;
  symptomType:
    | 'toothache'
    | 'bleeding_gums'
    | 'cold_hot_sensitivity'
    | 'sweet_sensitivity'
    | 'jaw_clicking_pain'
    | 'bad_breath_halitosis'
    | 'gum_swelling';
  severity: 'mild' | 'moderate' | 'severe';
  durationDays?: number;
  reportedAt: string;
  notes?: string;
}

export interface PeriodontalRecord {
  id: string;
  userId: string;
  toothNumber: number;
  probingDepthMm: number; // Normal <= 3mm, > 4mm pocket
  bleedingOnProbing: boolean;
  recessionMm: number;
  plaqueIndex: number; // 0 (none) to 3 (heavy)
  recordedAt: string;
}

export interface OrthodonticEpisode {
  id: string;
  userId: string;
  episodeType: 'braces' | 'aligners' | 'retainer' | 'palatal_expander' | 'functional_appliance';
  status: 'planned' | 'active' | 'completed' | 'paused';
  arch: 'upper' | 'lower' | 'both';
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  orthodontistName?: string;
  notes?: string;
}

export interface DentalVisit {
  id: string;
  userId: string;
  visitDate: string;
  dentistName?: string;
  clinicName?: string;
  chiefComplaint?: string;
  diagnosisSummary?: string;
  treatmentPlan?: string;
  nextVisitRecommendedDate?: string;
}

export interface DentalImagingLink {
  id: string;
  userId: string;
  toothNumber?: number;
  imagingType: 'panoramic_xray' | 'periapical_xray' | 'cbct_3d' | 'intraoral_photo' | 'bitewing_xray';
  imageUrl: string;
  protectedStorageRef: string; // Uses protected imaging pipeline with 'dental' scope check
  radiologistReport?: string;
  takenAt: string;
}

export interface DentalChartSummary {
  userId: string;
  dentitionType: DentitionType;
  overallExaminationStatus: 'NOT_EXAMINED' | 'PARTIALLY_EXAMINED' | 'FULLY_EXAMINED';
  unexaminedNotice: string; // Requirement 21: "Пустая dental карта ≠ все зубы здоровы"
  teethCount: {
    total: number;
    unexamined: number;
    healthy: number;
    carious: number;
    filled: number;
    crowned: number;
    missing: number;
    implant: number;
  };
  activeFindingsCount: number;
  activeOrthodonticEpisode?: OrthodonticEpisode;
  lastVisit?: DentalVisit;
  teethMap: Record<number, ToothRecord>;
  findings: DentalFinding[];
  procedures: DentalProcedure[];
  symptoms: DentalSymptom[];
  periodontalRecords: PeriodontalRecord[];
  orthodonticEpisodes: OrthodonticEpisode[];
  visits: DentalVisit[];
  imagingLinks: DentalImagingLink[];
}

// FDI Standard Tooth Number Lists
export const PERMANENT_TEETH_FDI = [
  // Upper Right (18-11)
  18, 17, 16, 15, 14, 13, 12, 11,
  // Upper Left (21-28)
  21, 22, 23, 24, 25, 26, 27, 28,
  // Lower Left (31-38)
  31, 32, 33, 34, 35, 36, 37, 38,
  // Lower Right (41-48)
  41, 42, 43, 44, 45, 46, 47, 48,
];

export const PRIMARY_TEETH_FDI = [
  // Upper Right (55-51)
  55, 54, 53, 52, 51,
  // Upper Left (61-65)
  61, 62, 63, 64, 65,
  // Lower Left (71-75)
  71, 72, 73, 74, 75,
  // Lower Right (81-85)
  81, 82, 83, 84, 85,
];

export class DentalService {
  private userToothMaps = new Map<string, Map<number, ToothRecord>>(); // userId -> (toothNumber -> ToothRecord)
  private userFindings = new Map<string, DentalFinding[]>();
  private userProcedures = new Map<string, DentalProcedure[]>();
  private userSymptoms = new Map<string, DentalSymptom[]>();
  private userPeriodontal = new Map<string, PeriodontalRecord[]>();
  private userOrthodontic = new Map<string, OrthodonticEpisode[]>();
  private userVisits = new Map<string, DentalVisit[]>();
  private userImaging = new Map<string, DentalImagingLink[]>();

  constructor() {
    this.seedDemoDentalData('user_demo_me');
  }

  private seedDemoDentalData(userId: string) {
    const teeth = new Map<number, ToothRecord>();
    const nowIso = new Date().toISOString();

    // Initialize permanent teeth - default UNEXAMINED per Requirement 21
    for (const tNum of PERMANENT_TEETH_FDI) {
      teeth.set(tNum, {
        toothNumber: tNum,
        dentition: 'permanent',
        status: 'unexamined',
        surfaces: {},
        mobilityGrade: 0,
        examinationStatus: 'UNEXAMINED',
        updatedAt: nowIso,
      });
    }

    // Examine a couple of teeth for demo
    teeth.set(16, {
      toothNumber: 16,
      dentition: 'permanent',
      status: 'filled',
      surfaces: { occlusal: true, mesial: true },
      mobilityGrade: 0,
      examinationStatus: 'EXAMINED',
      notes: 'Светоотверждаемая пломба 2024г.',
      updatedAt: nowIso,
    });

    teeth.set(26, {
      toothNumber: 26,
      dentition: 'permanent',
      status: 'carious',
      surfaces: { occlusal: true },
      mobilityGrade: 0,
      examinationStatus: 'EXAMINED',
      notes: 'Поверхностный кариес эмали',
      updatedAt: nowIso,
    });

    teeth.set(46, {
      toothNumber: 46,
      dentition: 'permanent',
      status: 'crowned',
      surfaces: { mesial: true, distal: true, occlusal: true, buccal: true, lingual: true },
      mobilityGrade: 0,
      examinationStatus: 'EXAMINED',
      notes: 'Циркониевая коронка на вкладке',
      updatedAt: nowIso,
    });

    this.userToothMaps.set(userId, teeth);

    // Seed Finding
    this.userFindings.set(userId, [
      {
        id: 'finding-01',
        userId,
        toothNumber: 26,
        surface: 'occlusal',
        findingType: 'caries',
        severity: 'mild',
        detectedAt: '2026-02-10T11:00:00Z',
        notes: 'Кариес фиссур зуба 26',
      },
    ]);

    // Seed Procedure
    this.userProcedures.set(userId, [
      {
        id: 'proc-01',
        userId,
        toothNumber: 16,
        procedureType: 'filling',
        dentistName: 'Д-р Соколова Е.А.',
        clinicName: 'Стоматология Дента-Плюс',
        cost: 6500,
        performedAt: '2024-11-15T14:30:00Z',
        notes: 'Лечение кариеса, пломба Filtek Z350',
      },
    ]);

    // Seed Visit
    this.userVisits.set(userId, [
      {
        id: 'visit-01',
        userId,
        visitDate: '2026-02-10T11:00:00Z',
        dentistName: 'Д-р Соколова Е.А.',
        clinicName: 'Стоматология Дента-Плюс',
        chiefComplaint: 'Профилактический осмотр и гигиена',
        diagnosisSummary: 'К02.1 Кариес дентина зуба 26. Гигиена удовлетворительная.',
        treatmentPlan: 'Лечение кариеса зуба 26, ультразвуковая чистка AirFlow',
        nextVisitRecommendedDate: '2026-08-10',
      },
    ]);

    // Seed Imaging Link
    this.userImaging.set(userId, [
      {
        id: 'img-dental-01',
        userId,
        imagingType: 'panoramic_xray',
        imageUrl: '/api/protected-media/dental-optg-demo.jpg',
        protectedStorageRef: 'protected://dental/optg-2026-02.dcm',
        radiologistReport: 'ОПТГ: Костная ткань альвеолярного отростка без признаков деструкции. Зубы мудрости 18, 28, 38, 48 полуретинированы.',
        takenAt: '2026-02-10T10:30:00Z',
      },
    ]);

    // Seed Orthodontic
    this.userOrthodontic.set(userId, [
      {
        id: 'ortho-01',
        userId,
        episodeType: 'aligners',
        status: 'active',
        arch: 'both',
        startDate: '2025-09-01',
        expectedEndDate: '2026-12-01',
        orthodontistName: 'Д-р Волков И.П.',
        notes: 'Курс элайнеров 3D Smile (капа 12 из 24)',
      },
    ]);
  }

  /**
   * Requirement 21: Get Tooth Chart & Summary
   * Enforces rule: "Пустая dental карта ≠ все зубы здоровы" (NOT_EXAMINED status)
   */
  public getDentalSummary(userId: string, dentitionType: DentitionType = 'permanent'): DentalChartSummary {
    let toothMap = this.userToothMaps.get(userId);

    // If map does not exist, initialize all teeth as UNEXAMINED
    if (!toothMap) {
      toothMap = new Map<number, ToothRecord>();
      const list = dentitionType === 'primary' ? PRIMARY_TEETH_FDI : PERMANENT_TEETH_FDI;
      const nowIso = new Date().toISOString();

      for (const tNum of list) {
        toothMap.set(tNum, {
          toothNumber: tNum,
          dentition: dentitionType === 'primary' ? 'primary' : 'permanent',
          status: 'unexamined',
          surfaces: {},
          mobilityGrade: 0,
          examinationStatus: 'UNEXAMINED',
          updatedAt: nowIso,
        });
      }
      this.userToothMaps.set(userId, toothMap);
    }

    const teethObj: Record<number, ToothRecord> = {};
    const teethCount = {
      total: toothMap.size,
      unexamined: 0,
      healthy: 0,
      carious: 0,
      filled: 0,
      crowned: 0,
      missing: 0,
      implant: 0,
    };

    for (const [tNum, tooth] of toothMap.entries()) {
      teethObj[tNum] = tooth;
      if (tooth.status === 'unexamined' || tooth.examinationStatus === 'UNEXAMINED') {
        teethCount.unexamined++;
      } else if (tooth.status === 'healthy') teethCount.healthy++;
      else if (tooth.status === 'carious') teethCount.carious++;
      else if (tooth.status === 'filled') teethCount.filled++;
      else if (tooth.status === 'crowned') teethCount.crowned++;
      else if (tooth.status === 'missing') teethCount.missing++;
      else if (tooth.status === 'implant') teethCount.implant++;
    }

    let overallExamStatus: 'NOT_EXAMINED' | 'PARTIALLY_EXAMINED' | 'FULLY_EXAMINED' = 'PARTIALLY_EXAMINED';
    if (teethCount.unexamined === teethCount.total) {
      overallExamStatus = 'NOT_EXAMINED';
    } else if (teethCount.unexamined === 0) {
      overallExamStatus = 'FULLY_EXAMINED';
    }

    const unexaminedNotice =
      overallExamStatus === 'NOT_EXAMINED'
        ? 'ВНИМАНИЕ: Стоматологическая карта пуста. По медицинским правилам пустая карта НЕ означает, что все зубы здоровы (Status: NOT_EXAMINED). Требуется прохождение осмотра у стоматолога.'
        : `Карта содержит ${teethCount.unexamined} необследованных зубов (Статус: ${overallExamStatus}).`;

    const findings = this.userFindings.get(userId) || [];
    const procedures = this.userProcedures.get(userId) || [];
    const symptoms = this.userSymptoms.get(userId) || [];
    const periodontalRecords = this.userPeriodontal.get(userId) || [];
    const orthodonticEpisodes = this.userOrthodontic.get(userId) || [];
    const visits = this.userVisits.get(userId) || [];
    const imagingLinks = this.userImaging.get(userId) || [];

    const activeOrtho = orthodonticEpisodes.find((e) => e.status === 'active');
    const lastVisit = visits.length > 0 ? visits[visits.length - 1] : undefined;

    return {
      userId,
      dentitionType,
      overallExaminationStatus: overallExamStatus,
      unexaminedNotice,
      teethCount,
      activeFindingsCount: findings.length,
      activeOrthodonticEpisode: activeOrtho,
      lastVisit,
      teethMap: teethObj,
      findings,
      procedures,
      symptoms,
      periodontalRecords,
      orthodonticEpisodes,
      visits,
      imagingLinks,
    };
  }

  /**
   * Update Tooth status & surfaces
   */
  public updateTooth(
    userId: string,
    toothNumber: number,
    updates: Partial<ToothRecord>
  ): ToothRecord {
    let toothMap = this.userToothMaps.get(userId);
    if (!toothMap) {
      this.getDentalSummary(userId);
      toothMap = this.userToothMaps.get(userId)!;
    }

    const current = toothMap.get(toothNumber) || {
      toothNumber,
      dentition: toothNumber >= 51 ? 'primary' : 'permanent',
      status: 'unexamined' as ToothStatus,
      surfaces: {},
      mobilityGrade: 0 as const,
      examinationStatus: 'UNEXAMINED' as const,
      updatedAt: new Date().toISOString(),
    };

    const updated: ToothRecord = {
      ...current,
      ...updates,
      toothNumber,
      examinationStatus: 'EXAMINED', // Marked examined on explicit edit
      updatedAt: new Date().toISOString(),
    };

    toothMap.set(toothNumber, updated);

    auditProvenanceService.recordCriticalChange({
      userId,
      resourceType: 'measurement',
      resourceId: `tooth-${toothNumber}`,
      action: 'UPDATE',
      oldValue: current,
      newValue: updated,
      actor: { id: userId, role: 'user', name: 'Пользователь / Врач' },
      reasonSource: 'DENTAL_CHART_TOOTH_UPDATE',
    });

    return updated;
  }

  // --- ENTITY RECORDERS ---

  public addFinding(userId: string, finding: Omit<DentalFinding, 'id' | 'userId'>): DentalFinding {
    const list = this.userFindings.get(userId) || [];
    const newFinding: DentalFinding = {
      ...finding,
      id: `finding-${Date.now()}`,
      userId,
    };
    list.unshift(newFinding);
    this.userFindings.set(userId, list);

    // Auto update tooth status if caries detected
    if (finding.toothNumber && finding.findingType === 'caries') {
      this.updateTooth(userId, finding.toothNumber, { status: 'carious' });
    }

    return newFinding;
  }

  public addProcedure(userId: string, procedure: Omit<DentalProcedure, 'id' | 'userId'>): DentalProcedure {
    const list = this.userProcedures.get(userId) || [];
    const newProc: DentalProcedure = {
      ...procedure,
      id: `proc-${Date.now()}`,
      userId,
    };
    list.unshift(newProc);
    this.userProcedures.set(userId, list);

    // Auto update tooth status
    if (procedure.toothNumber) {
      if (procedure.procedureType === 'filling') {
        this.updateTooth(userId, procedure.toothNumber, { status: 'filled' });
      } else if (procedure.procedureType === 'crown') {
        this.updateTooth(userId, procedure.toothNumber, { status: 'crowned' });
      } else if (procedure.procedureType === 'extraction') {
        this.updateTooth(userId, procedure.toothNumber, { status: 'missing' });
      } else if (procedure.procedureType === 'implant') {
        this.updateTooth(userId, procedure.toothNumber, { status: 'implant' });
      } else if (procedure.procedureType === 'root_canal') {
        this.updateTooth(userId, procedure.toothNumber, { status: 'root_canal_treated' });
      }
    }

    return newProc;
  }

  public addSymptom(userId: string, symptom: Omit<DentalSymptom, 'id' | 'userId'>): DentalSymptom {
    const list = this.userSymptoms.get(userId) || [];
    const newSymp: DentalSymptom = {
      ...symptom,
      id: `symptom-dental-${Date.now()}`,
      userId,
    };
    list.unshift(newSymp);
    this.userSymptoms.set(userId, list);
    return newSymp;
  }

  public addPeriodontalRecord(userId: string, record: Omit<PeriodontalRecord, 'id' | 'userId'>): PeriodontalRecord {
    const list = this.userPeriodontal.get(userId) || [];
    const newPerio: PeriodontalRecord = {
      ...record,
      id: `perio-${Date.now()}`,
      userId,
    };
    list.unshift(newPerio);
    this.userPeriodontal.set(userId, list);
    return newPerio;
  }

  public addOrthodonticEpisode(userId: string, episode: Omit<OrthodonticEpisode, 'id' | 'userId'>): OrthodonticEpisode {
    const list = this.userOrthodontic.get(userId) || [];
    const newOrtho: OrthodonticEpisode = {
      ...episode,
      id: `ortho-${Date.now()}`,
      userId,
    };
    list.unshift(newOrtho);
    this.userOrthodontic.set(userId, list);
    return newOrtho;
  }

  public addVisit(userId: string, visit: Omit<DentalVisit, 'id' | 'userId'>): DentalVisit {
    const list = this.userVisits.get(userId) || [];
    const newVisit: DentalVisit = {
      ...visit,
      id: `visit-dental-${Date.now()}`,
      userId,
    };
    list.unshift(newVisit);
    this.userVisits.set(userId, list);
    return newVisit;
  }

  public addImagingLink(userId: string, img: Omit<DentalImagingLink, 'id' | 'userId'>): DentalImagingLink {
    const list = this.userImaging.get(userId) || [];
    const newImg: DentalImagingLink = {
      ...img,
      id: `img-dental-${Date.now()}`,
      userId,
    };
    list.unshift(newImg);
    this.userImaging.set(userId, list);
    return newImg;
  }
}

export const dentalService = new DentalService();
