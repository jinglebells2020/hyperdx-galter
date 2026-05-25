import mongoose, { Schema } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'open' | 'in_progress' | 'pending_clarification' | 'resolved' | 'closed' | 'reopened';
export type CaseDetectionTier = 'tier1' | 'tier2' | 'tier3' | 'manual';

export interface ICaseNote {
  at: Date;
  author: string;
  text: string;
}

export interface ICaseTimelineEntry {
  at: Date;
  kind:
    | 'created'
    | 'assigned'
    | 'unassigned'
    | 'status_changed'
    | 'severity_changed'
    | 'note_added'
    | 'evidence_added'
    | 'citation_added'
    | 'reopened'
    | 'closed'
    | 'escalated';
  actor: string;
  note?: string;
  diff?: Record<string, unknown>;
}

export interface ICaseCitation {
  npa: string; // e.g. "НК РК ст. 422"
  url?: string;
  excerpt?: string;
  added_at: Date;
  added_by: string;
}

export interface ICase {
  _id: ObjectId;
  team: ObjectId;

  case_number: string; // СД-2026-NNNN
  title: string;
  description?: string;

  finding_signature: string; // deterministic hash of rule + entity_id + window — for dedup
  rule_name?: string;
  tier_detected_by: CaseDetectionTier;

  severity: CaseSeverity;
  status: CaseStatus;
  assignee_email?: string | null;

  related_entity_ids: string[];
  related_actor_ids: string[];
  related_counterparty_ids?: string[];

  time_window?: {
    start: Date;
    end: Date;
  };

  citations: ICaseCitation[];
  notes: ICaseNote[];
  timeline: ICaseTimelineEntry[];

  evidence_count: number;
  llm_verdict?: {
    severity: string;
    confidence: number;
    explanation: string;
    evaluated_at: Date;
  } | null;

  closed_at?: Date | null;
  closed_by?: string | null;
  close_reason?: 'confirmed' | 'rejected_false_positive' | 'unresolved' | null;

  // Self-audit hooks — when the case itself is edited, the change is
  // pushed into the timeline so investigators can see what changed and
  // when. The diff carries the field-level before/after so accountability
  // is preserved at every step.
  createdAt: Date;
  updatedAt: Date;
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
}

const CitationSchema = new Schema<ICaseCitation>(
  {
    npa: { type: String, required: true },
    url: String,
    excerpt: String,
    added_at: { type: Date, default: Date.now },
    added_by: String,
  },
  { _id: false },
);

const NoteSchema = new Schema<ICaseNote>(
  {
    at: { type: Date, default: Date.now },
    author: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const TimelineSchema = new Schema<ICaseTimelineEntry>(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, required: true },
    actor: { type: String, required: true },
    note: String,
    diff: Schema.Types.Mixed,
  },
  { _id: false },
);

const CaseSchema = new Schema<ICase>(
  {
    team: { type: Schema.Types.ObjectId, required: true, ref: 'Team', index: true },

    case_number: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: String,

    finding_signature: { type: String, index: true },
    rule_name: String,
    tier_detected_by: { type: String, enum: ['tier1', 'tier2', 'tier3', 'manual'], default: 'manual' },

    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending_clarification', 'resolved', 'closed', 'reopened'],
      default: 'open',
      index: true,
    },
    assignee_email: { type: String, default: null, index: true },

    related_entity_ids: { type: [String], default: [] },
    related_actor_ids: { type: [String], default: [] },
    related_counterparty_ids: { type: [String], default: [] },

    time_window: {
      start: Date,
      end: Date,
    },

    citations: { type: [CitationSchema], default: [] },
    notes: { type: [NoteSchema], default: [] },
    timeline: { type: [TimelineSchema], default: [] },

    evidence_count: { type: Number, default: 0 },
    llm_verdict: { type: Schema.Types.Mixed, default: null },

    closed_at: { type: Date, default: null },
    closed_by: { type: String, default: null },
    close_reason: { type: String, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

CaseSchema.index({ team: 1, status: 1, severity: -1, createdAt: -1 });
CaseSchema.index({ team: 1, assignee_email: 1 });
CaseSchema.index({ team: 1, finding_signature: 1 });

export const Case = mongoose.model<ICase>('Case', CaseSchema);
export default Case;
