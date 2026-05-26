import mongoose, { Schema } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// FIB §1-6 (KZ State Technical Service) — self-audit log of Mooldir's own
// actions: login/logout, password changes, role changes, data exports, source
// CRUD, dashboard CRUD, saved-search CRUD, alert mgmt. Persisted in MongoDB
// so it survives a ClickHouse outage. Index supports the audit dashboard
// filters (subject, object, address, type, time) required by FIB §5.
//
// Retention: kept indefinitely in Mongo; a daily cron snapshots events older
// than 60 days to long-term cold storage (5 years for KZ accounting compliance,
// see docs/runbooks/audit-retention.md) — see services/auditArchive.ts.
export type HdxAuditCategory =
  | 'auth'
  | 'user'
  | 'team'
  | 'source'
  | 'connection'
  | 'dashboard'
  | 'savedSearch'
  | 'alert'
  | 'webhook'
  | 'apiKey'
  | 'role'
  | 'config'
  | 'export'
  | 'security';

export type HdxAuditAction =
  // Authentication & session
  | 'login.success'
  | 'login.failed'
  | 'login.blocked.locked'
  | 'login.blocked.passwordExpired'
  | 'logout'
  | 'session.terminatedByConcurrentLogin'
  | 'password.changed'
  | 'password.resetRequested'
  | 'password.resetCompleted'
  // User mgmt
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.activated'
  | 'user.deactivated'
  | 'user.roleChanged'
  | 'user.invited'
  // Team
  | 'team.created'
  | 'team.updated'
  | 'team.allowedAuthMethodsChanged'
  // Resources
  | 'source.created'
  | 'source.updated'
  | 'source.deleted'
  | 'connection.created'
  | 'connection.updated'
  | 'connection.deleted'
  | 'dashboard.created'
  | 'dashboard.updated'
  | 'dashboard.deleted'
  | 'dashboard.viewed'
  | 'savedSearch.created'
  | 'savedSearch.updated'
  | 'savedSearch.deleted'
  | 'alert.created'
  | 'alert.updated'
  | 'alert.deleted'
  | 'alert.fired'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  // API keys / access
  | 'apiKey.created'
  | 'apiKey.revoked'
  | 'apiKey.used'
  // Audit-data access (FIB §30 — admin reads of audit log are themselves audited)
  | 'audit.viewed'
  | 'audit.exported'
  // Catch-all
  | 'config.changed'
  | 'export.completed';

export type HdxAuditOutcome = 'success' | 'failure' | 'denied';

export interface IHdxAuditEvent {
  _id: ObjectId;
  // when
  ts: Date;
  // who (subject)
  actorUserId?: ObjectId;
  actorEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;
  // where (session)
  sessionId?: string;
  // what
  category: HdxAuditCategory;
  action: HdxAuditAction;
  outcome: HdxAuditOutcome;
  // on what (object)
  objectKind?: string;
  objectId?: string;
  // details (kept small; large payloads must not be stored here)
  details?: Record<string, unknown>;
  errorMessage?: string;
  // tenant scope
  teamId?: ObjectId;
}

const AuditEventSchema = new Schema(
  {
    ts: { type: Date, default: () => new Date(), index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    actorIp: { type: String },
    actorUserAgent: { type: String },
    sessionId: { type: String },
    category: { type: String, required: true },
    action: { type: String, required: true },
    outcome: { type: String, required: true },
    objectKind: { type: String },
    objectId: { type: String },
    details: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  },
  {
    // No timestamps:true — `ts` is the canonical event time; we don't want a
    // separate `updatedAt` that could be confused with the event ts.
    capped: false,
    minimize: false,
  },
);

// Compound indexes for FIB §5 selectivity (subject / object / type / time).
AuditEventSchema.index({ teamId: 1, ts: -1 });
AuditEventSchema.index({ actorUserId: 1, ts: -1 });
AuditEventSchema.index({ category: 1, action: 1, ts: -1 });
AuditEventSchema.index({ objectKind: 1, objectId: 1, ts: -1 });
AuditEventSchema.index({ actorIp: 1, ts: -1 });

export default mongoose.model<IHdxAuditEvent>('HdxAuditEvent', AuditEventSchema);
