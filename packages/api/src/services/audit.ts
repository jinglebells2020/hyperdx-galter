import type { Request } from 'express';
import { serializeError } from 'serialize-error';

import AuditEvent, {
  HdxAuditAction,
  HdxAuditCategory,
  HdxAuditOutcome,
  IHdxAuditEvent,
} from '@/models/auditEvent';
import logger from '@/utils/logger';

// FIB §1-6 self-audit recorder. Designed to NEVER throw — a logging failure
// must not break the user-facing operation, but it must surface in the
// application log so an operator can investigate.

type AuditInput = Omit<IHdxAuditEvent, '_id' | 'ts' | 'sessionId'> & {
  ts?: Date;
};

function ipFromRequest(req: Request | null | undefined): string | undefined {
  if (!req) return undefined;
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0]?.split(',')[0]?.trim();
  }
  return req.ip;
}

function userAgentFromRequest(req: Request | null | undefined): string | undefined {
  if (!req) return undefined;
  const ua = req.headers?.['user-agent'];
  if (typeof ua === 'string') {
    // Truncate to 512 chars to bound storage.
    return ua.length > 512 ? ua.slice(0, 512) : ua;
  }
  return undefined;
}

export async function recordAudit(input: AuditInput, req?: Request | null) {
  try {
    const actorIp = input.actorIp ?? ipFromRequest(req);
    const actorUserAgent = input.actorUserAgent ?? userAgentFromRequest(req);
    const sessionId = (req as any)?.sessionID;
    await AuditEvent.create({
      ts: input.ts ?? new Date(),
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      actorIp,
      actorUserAgent,
      sessionId,
      category: input.category,
      action: input.action,
      outcome: input.outcome,
      objectKind: input.objectKind,
      objectId: input.objectId,
      details: input.details,
      errorMessage: input.errorMessage,
      teamId: input.teamId,
    });
  } catch (err) {
    // Hard requirement: never throw out of the audit recorder. Log loudly.
    logger.error(
      { err: serializeError(err), action: input.action },
      'auditService.recordAudit failed',
    );
  }
}

// Convenience wrappers for the hottest paths.
export const auditLogin = (
  outcome: HdxAuditOutcome,
  detail: {
    actorEmail: string;
    actorUserId?: any;
    teamId?: any;
    errorMessage?: string;
    action?: HdxAuditAction;
  },
  req: Request | null,
) =>
  recordAudit(
    {
      category: 'auth',
      action:
        detail.action ?? (outcome === 'success' ? 'login.success' : 'login.failed'),
      outcome,
      actorEmail: detail.actorEmail,
      actorUserId: detail.actorUserId,
      teamId: detail.teamId,
      errorMessage: detail.errorMessage,
    },
    req,
  );

export const auditResource = (
  category: HdxAuditCategory,
  action: HdxAuditAction,
  detail: {
    objectKind: string;
    objectId?: string;
    actorUserId?: any;
    actorEmail?: string;
    teamId?: any;
    details?: Record<string, unknown>;
  },
  req: Request | null,
  outcome: HdxAuditOutcome = 'success',
) =>
  recordAudit(
    {
      category,
      action,
      outcome,
      objectKind: detail.objectKind,
      objectId: detail.objectId,
      actorUserId: detail.actorUserId,
      actorEmail: detail.actorEmail,
      teamId: detail.teamId,
      details: detail.details,
    },
    req,
  );

export type { HdxAuditAction, HdxAuditCategory, HdxAuditOutcome };
