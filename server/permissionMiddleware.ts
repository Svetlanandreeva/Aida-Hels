import express from 'express';
import { permissionService, PermissionScope } from './permissionService';

export interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    fullName?: string;
    sessionId?: string;
  };
}

/**
 * Express Middleware enforcing 6-stage Permission Pipeline (deny by default):
 * Authentication → Permission → Validation → Policy → Execution → Audit
 */
export function requirePermission(
  scope: PermissionScope,
  action: 'read' | 'write' | 'delete' | 'manage_grants' = 'read'
) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const requesterUserId = req.user?.id;

    if (!requesterUserId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED',
        scope,
        timestamp: new Date().toISOString(),
      });
    }

    const targetSubjectProfileId =
      (req.params.id as string) ||
      (req.params.profileId as string) ||
      (req.params.subject_profile_id as string) ||
      (req.params.profile_id as string) ||
      (req.query.profileId as string) ||
      (req.query.profile_id as string) ||
      (req.query.subject_profile_id as string) ||
      (req.body?.subjectProfileId as string) ||
      (req.body?.profileId as string) ||
      (req.body?.profile_id as string) ||
      (req.body?.subject_profile_id as string) ||
      'self';

    const evaluation = permissionService.evaluateAccess({
      requesterUserId,
      targetSubjectProfileId,
      scope,
      action,
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '',
      userAgent: req.headers['user-agent'] || '',
    });

    if (!evaluation.allowed) {
      return res.status(403).json({
        error: 'Forbidden: Access Denied by Permission Policy',
        code: 'PERMISSION_DENIED',
        stage: evaluation.stage,
        decision: evaluation.decision,
        scope,
        reason: evaluation.reason,
        auditLogId: evaluation.auditEntry.id,
        timestamp: evaluation.auditEntry.timestamp,
      });
    }

    (req as any).permissionEvaluation = evaluation;
    (req as any).subjectProfileId = targetSubjectProfileId;
    return next();
  };
}
