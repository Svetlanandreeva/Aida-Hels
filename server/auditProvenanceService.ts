import { canonicalDataLayer } from './canonicalDataLayer';

export interface AuditActor {
  id: string;
  email?: string;
  role: 'user' | 'doctor' | 'system' | 'ai_agent' | 'api_client';
  name?: string;
}

export interface CriticalChangeAuditRecord {
  id: string;
  userId: string;
  subjectProfileId?: string;
  resourceType: 'measurement' | 'lab_result' | 'condition' | 'medication' | 'symptom' | 'diary_entry' | 'subject_profile' | 'document';
  resourceId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValue: any | null;
  newValue: any | null;
  actor: AuditActor;
  timestamp: string;
  reasonSource: string; // e.g. "USER_MANUAL_EDIT", "USER_DELETE", "AI_STAGED_CONFIRMATION", "OCR_IMPORT"
}

export interface AiDerivedInsight {
  id: string;
  userId: string;
  subjectProfileId?: string;
  insightType: 'risk_alert' | 'trend_summary' | 'medication_interaction' | 'preventive_recommendation';
  title: string;
  summary: string;
  confidenceScore: number; // 0.0 - 1.0
  evidenceRecordIds: string[]; // Source record IDs that this insight relies on
  algorithmRulesVersion: string; // e.g. "v2.4_hybrid_context_builder"
  status: 'active' | 'invalidated' | 'recalculated' | 'dismissed';
  invalidatedAt?: string;
  invalidationReason?: string;
  recalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class AuditProvenanceService {
  private auditLedger: CriticalChangeAuditRecord[] = [];
  private insightsDb: Map<string, AiDerivedInsight> = new Map();

  constructor() {
    this.seedDefaultInsights('user_demo_me');
  }

  /**
   * Requirement 18: Record critical mutation (CREATE, UPDATE, DELETE) with full provenance
   */
  public async recordCriticalChange(params: {
    userId: string;
    subjectProfileId?: string;
    resourceType: CriticalChangeAuditRecord['resourceType'];
    resourceId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    oldValue: any | null;
    newValue: any | null;
    actor: AuditActor;
    reasonSource: string;
  }): Promise<CriticalChangeAuditRecord> {
    const auditRecord: CriticalChangeAuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId,
      subjectProfileId: params.subjectProfileId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: params.action,
      oldValue: params.oldValue,
      newValue: params.newValue,
      actor: params.actor,
      timestamp: new Date().toISOString(),
      reasonSource: params.reasonSource,
    };

    this.auditLedger.unshift(auditRecord);

    // Keep limit of 1000 audit records in ledger
    if (this.auditLedger.length > 1000) {
      this.auditLedger = this.auditLedger.slice(0, 1000);
    }

    // Cascade Invalidation check: If an evidence record was modified or deleted, invalidate dependent insights
    if (params.action === 'UPDATE' || params.action === 'DELETE') {
      await this.invalidateDependentInsights({
        userId: params.userId,
        sourceRecordId: params.resourceId,
        action: params.action,
        actor: params.actor,
        reasonSource: params.reasonSource,
      });
    }

    return auditRecord;
  }

  /**
   * Requirement 18: Invalidate or recalculate AI-derived insights when source evidence is modified or deleted
   */
  public async invalidateDependentInsights(params: {
    userId: string;
    sourceRecordId: string;
    action: 'UPDATE' | 'DELETE';
    actor: AuditActor;
    reasonSource: string;
  }): Promise<AiDerivedInsight[]> {
    const invalidatedList: AiDerivedInsight[] = [];
    const nowIso = new Date().toISOString();

    for (const insight of this.insightsDb.values()) {
      if (
        insight.userId === params.userId &&
        insight.status === 'active' &&
        Array.isArray(insight.evidenceRecordIds) &&
        insight.evidenceRecordIds.includes(params.sourceRecordId)
      ) {
        const actionText = params.action === 'DELETE' ? 'удалил' : 'изменил';
        const reason = `Пользователь (${params.actor.name || params.actor.id}) ${actionText} исходную запись доказательной базы [${params.sourceRecordId}]. Инсайт инвалидирован для перерасчета.`;

        const updatedInsight: AiDerivedInsight = {
          ...insight,
          status: 'invalidated',
          invalidatedAt: nowIso,
          invalidationReason: reason,
          updatedAt: nowIso,
        };

        this.insightsDb.set(insight.id, updatedInsight);
        invalidatedList.push(updatedInsight);

        // Record audit entry for insight status transition
        this.auditLedger.unshift({
          id: `audit-insight-inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: params.userId,
          resourceType: 'document',
          resourceId: insight.id,
          action: 'UPDATE',
          oldValue: { status: 'active', title: insight.title },
          newValue: { status: 'invalidated', reason },
          actor: { id: 'SYSTEM_CASCADE', name: 'AI Cascade Guard', role: 'ai_agent' },
          timestamp: nowIso,
          reasonSource: `CASCADE_INVALIDATION_BY_${params.action}`,
        });
      }
    }

    return invalidatedList;
  }

  /**
   * Register a new AI Derived Insight with evidence links and rules version
   */
  public registerInsight(params: {
    userId: string;
    subjectProfileId?: string;
    insightType: AiDerivedInsight['insightType'];
    title: string;
    summary: string;
    confidenceScore?: number;
    evidenceRecordIds: string[];
    algorithmRulesVersion?: string;
  }): AiDerivedInsight {
    const id = `insight-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const insight: AiDerivedInsight = {
      id,
      userId: params.userId,
      subjectProfileId: params.subjectProfileId,
      insightType: params.insightType,
      title: params.title,
      summary: params.summary,
      confidenceScore: params.confidenceScore ?? 0.92,
      evidenceRecordIds: params.evidenceRecordIds,
      algorithmRulesVersion: params.algorithmRulesVersion || 'v2.4_hybrid_context_builder',
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.insightsDb.set(id, insight);
    return insight;
  }

  /**
   * Get audit logs filtered by userId
   */
  public getAuditLogs(userId?: string, limit: number = 50): CriticalChangeAuditRecord[] {
    if (!userId) return this.auditLedger.slice(0, limit);
    return this.auditLedger.filter((log) => log.userId === userId || log.userId === 'user_demo_me').slice(0, limit);
  }

  /**
   * Get AI Insights for user
   */
  public getInsights(userId: string): AiDerivedInsight[] {
    return Array.from(this.insightsDb.values()).filter(
      (insight) => insight.userId === userId || insight.userId === 'user_demo_me'
    );
  }

  /**
   * Seed default AI insights with explicit evidence record IDs for demonstration
   */
  public seedDefaultInsights(userId: string) {
    const nowIso = new Date().toISOString();

    const defaultInsight1: AiDerivedInsight = {
      id: 'insight-bp-trend-01',
      userId,
      subjectProfileId: `sp-primary-${userId}`,
      insightType: 'trend_summary',
      title: 'Устойчивая тенденция к нормализации АД',
      summary: 'Анализ за последние 14 дней указывает на снижение среднего систолического давления со 145 до 128 мм рт. ст.',
      confidenceScore: 0.94,
      evidenceRecordIds: ['BP_MEASURE_1', 'BP_MEASURE_2', 'DAILY_LOG_1'],
      algorithmRulesVersion: 'v2.4_hybrid_context_builder',
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const defaultInsight2: AiDerivedInsight = {
      id: 'insight-risk-02',
      userId,
      subjectProfileId: `sp-primary-${userId}`,
      insightType: 'risk_alert',
      title: 'Оценка риска железодефицитной анемии',
      summary: 'Снижение уровня гемоглобина на фоне жалоб на быструю утомляемость требует лабораторного контроля ферритина.',
      confidenceScore: 0.88,
      evidenceRecordIds: ['DOC_LAB_1', 'DAILY_LOG_2'],
      algorithmRulesVersion: 'v2.4_hybrid_context_builder',
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.insightsDb.set(defaultInsight1.id, defaultInsight1);
    this.insightsDb.set(defaultInsight2.id, defaultInsight2);
  }
}

export const auditProvenanceService = new AuditProvenanceService();
