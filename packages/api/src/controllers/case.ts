import Case, {
  type ICase,
  type ICaseNote,
  type ICaseTimelineEntry,
  type CaseSeverity,
  type CaseStatus,
} from '@/models/case';

type CaseCreateInput = {
  case_number?: string;
  title: string;
  description?: string;
  finding_signature?: string;
  rule_name?: string;
  tier_detected_by?: 'tier1' | 'tier2' | 'tier3' | 'manual';
  severity?: CaseSeverity;
  status?: CaseStatus;
  assignee_email?: string | null;
  related_entity_ids?: string[];
  related_actor_ids?: string[];
  related_counterparty_ids?: string[];
  time_window?: { start: Date; end: Date };
  citations?: ICase['citations'];
  notes?: ICaseNote[];
};

export async function getCases(
  teamId: string,
  filters: { status?: CaseStatus; severity?: CaseSeverity; assignee_email?: string } = {},
): Promise<ICase[]> {
  const query: Record<string, unknown> = { team: teamId };
  if (filters.status) query.status = filters.status;
  if (filters.severity) query.severity = filters.severity;
  if (filters.assignee_email) query.assignee_email = filters.assignee_email;
  return Case.find(query).sort({ createdAt: -1 }).limit(500).lean();
}

export async function getCase(teamId: string, caseId: string): Promise<ICase | null> {
  return Case.findOne({ _id: caseId, team: teamId }).lean();
}

export async function getCaseByNumber(teamId: string, caseNumber: string): Promise<ICase | null> {
  return Case.findOne({ case_number: caseNumber, team: teamId }).lean();
}

export async function nextCaseNumber(teamId: string): Promise<string> {
  // СД-YYYY-NNNN where NNNN increments per team per year
  const year = new Date().getFullYear();
  const prefix = `СД-${year}-`;
  const last = await Case.findOne({ team: teamId, case_number: { $regex: `^${prefix}` } })
    .sort({ case_number: -1 })
    .lean();
  const lastN = last ? parseInt(last.case_number.split('-')[2] ?? '0', 10) : 0;
  return `${prefix}${String(lastN + 1).padStart(4, '0')}`;
}

export async function createCase(
  teamId: string,
  input: CaseCreateInput,
  userId: string,
  userEmail: string,
): Promise<ICase> {
  const case_number = input.case_number || (await nextCaseNumber(teamId));
  const doc = await Case.create({
    team: teamId,
    case_number,
    title: input.title,
    description: input.description,
    finding_signature: input.finding_signature || '',
    rule_name: input.rule_name,
    tier_detected_by: input.tier_detected_by || 'manual',
    severity: input.severity || 'medium',
    status: input.status || 'open',
    assignee_email: input.assignee_email ?? null,
    related_entity_ids: input.related_entity_ids || [],
    related_actor_ids: input.related_actor_ids || [],
    related_counterparty_ids: input.related_counterparty_ids || [],
    time_window: input.time_window,
    citations: input.citations || [],
    notes: input.notes || [],
    timeline: [
      {
        at: new Date(),
        kind: 'created',
        actor: userEmail,
      },
    ],
    evidence_count: (input.related_entity_ids?.length ?? 0) + (input.related_actor_ids?.length ?? 0),
    createdBy: userId,
    updatedBy: userId,
  });
  return doc.toObject();
}

export async function updateCase(
  teamId: string,
  caseId: string,
  patch: Partial<{
    title: string;
    description: string;
    severity: CaseSeverity;
    status: CaseStatus;
    assignee_email: string | null;
    related_entity_ids: string[];
    related_actor_ids: string[];
    related_counterparty_ids: string[];
  }>,
  userId: string,
  userEmail: string,
): Promise<ICase | null> {
  const existing = await Case.findOne({ _id: caseId, team: teamId });
  if (!existing) return null;

  const timeline: ICaseTimelineEntry[] = [];
  if (patch.status && patch.status !== existing.status) {
    timeline.push({
      at: new Date(),
      kind: 'status_changed',
      actor: userEmail,
      diff: { from: existing.status, to: patch.status },
    });
  }
  if (patch.severity && patch.severity !== existing.severity) {
    timeline.push({
      at: new Date(),
      kind: 'severity_changed',
      actor: userEmail,
      diff: { from: existing.severity, to: patch.severity },
    });
  }
  if (patch.assignee_email !== undefined && patch.assignee_email !== existing.assignee_email) {
    timeline.push({
      at: new Date(),
      kind: patch.assignee_email ? 'assigned' : 'unassigned',
      actor: userEmail,
      diff: { from: existing.assignee_email, to: patch.assignee_email },
    });
  }

  Object.assign(existing, patch);
  existing.updatedBy = userId as never;
  if (timeline.length) {
    existing.timeline = [...existing.timeline, ...timeline];
  }
  await existing.save();
  return existing.toObject();
}

export async function addNote(
  teamId: string,
  caseId: string,
  text: string,
  userEmail: string,
): Promise<ICase | null> {
  const c = await Case.findOne({ _id: caseId, team: teamId });
  if (!c) return null;
  const note: ICaseNote = { at: new Date(), author: userEmail, text };
  c.notes = [...c.notes, note];
  c.timeline = [...c.timeline, { at: new Date(), kind: 'note_added', actor: userEmail }];
  await c.save();
  return c.toObject();
}

export async function closeCase(
  teamId: string,
  caseId: string,
  closeReason: 'confirmed' | 'rejected_false_positive' | 'unresolved',
  userEmail: string,
): Promise<ICase | null> {
  const c = await Case.findOne({ _id: caseId, team: teamId });
  if (!c) return null;
  c.status = 'closed';
  c.closed_at = new Date();
  c.closed_by = userEmail;
  c.close_reason = closeReason;
  c.timeline = [
    ...c.timeline,
    { at: new Date(), kind: 'closed', actor: userEmail, diff: { close_reason: closeReason } },
  ];
  await c.save();
  return c.toObject();
}

export async function reopenCase(teamId: string, caseId: string, userEmail: string): Promise<ICase | null> {
  const c = await Case.findOne({ _id: caseId, team: teamId });
  if (!c) return null;
  c.status = 'reopened';
  c.closed_at = null;
  c.closed_by = null;
  c.close_reason = null;
  c.timeline = [...c.timeline, { at: new Date(), kind: 'reopened', actor: userEmail }];
  await c.save();
  return c.toObject();
}
