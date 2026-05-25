import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hdxServer } from '@/api';

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus =
  | 'open'
  | 'in_progress'
  | 'pending_clarification'
  | 'resolved'
  | 'closed'
  | 'reopened';

export interface CaseNote {
  at: string;
  author: string;
  text: string;
}

export interface CaseTimelineEntry {
  at: string;
  kind: string;
  actor: string;
  note?: string;
  diff?: Record<string, unknown>;
}

export interface CaseCitation {
  npa: string;
  url?: string;
  excerpt?: string;
  added_at?: string;
  added_by?: string;
}

export interface AuditCase {
  _id: string;
  team: string;
  case_number: string;
  title: string;
  description?: string;
  finding_signature?: string;
  rule_name?: string;
  tier_detected_by: 'tier1' | 'tier2' | 'tier3' | 'manual';
  severity: CaseSeverity;
  status: CaseStatus;
  assignee_email?: string | null;
  related_entity_ids: string[];
  related_actor_ids: string[];
  related_counterparty_ids?: string[];
  time_window?: { start: string; end: string };
  citations: CaseCitation[];
  notes: CaseNote[];
  timeline: CaseTimelineEntry[];
  evidence_count: number;
  closed_at?: string | null;
  closed_by?: string | null;
  close_reason?: 'confirmed' | 'rejected_false_positive' | 'unresolved' | null;
  createdAt: string;
  updatedAt: string;
}

export function useCases(filters: { status?: CaseStatus; severity?: CaseSeverity } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.severity) params.set('severity', filters.severity);
  const qs = params.toString();
  return useQuery({
    queryKey: ['cases', filters],
    queryFn: () => hdxServer(`cases${qs ? '?' + qs : ''}`).json<AuditCase[]>(),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['case', id],
    enabled: !!id,
    queryFn: () => hdxServer(`cases/${id}`).json<AuditCase>(),
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AuditCase> }) =>
      hdxServer(`cases/${id}`, { method: 'PATCH', json: patch }).json<AuditCase>(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case', data._id] });
    },
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      hdxServer(`cases/${id}/notes`, { method: 'POST', json: { text } }).json<AuditCase>(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['case', data._id] });
    },
  });
}

export function useCloseCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      close_reason,
    }: {
      id: string;
      close_reason: 'confirmed' | 'rejected_false_positive' | 'unresolved';
    }) => hdxServer(`cases/${id}/close`, { method: 'POST', json: { close_reason } }).json<AuditCase>(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case', data._id] });
    },
  });
}

export function useReopenCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      hdxServer(`cases/${id}/reopen`, { method: 'POST' }).json<AuditCase>(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case', data._id] });
    },
  });
}

export function severityLabel(s: CaseSeverity): string {
  return { critical: 'Критический', high: 'Высокий', medium: 'Средний', low: 'Низкий' }[s] || s;
}

export function severityColor(s: CaseSeverity): string {
  return { critical: 'red', high: 'orange', medium: 'yellow', low: 'gray' }[s] || 'gray';
}

export function statusLabel(s: CaseStatus): string {
  return (
    {
      open: 'Открыто',
      in_progress: 'В работе',
      pending_clarification: 'Ожидает уточнения',
      resolved: 'Разрешено',
      closed: 'Закрыто',
      reopened: 'Возобновлено',
    }[s] || s
  );
}

export function statusColor(s: CaseStatus): string {
  return (
    {
      open: 'blue',
      in_progress: 'cyan',
      pending_clarification: 'yellow',
      resolved: 'green',
      closed: 'gray',
      reopened: 'orange',
    }[s] || 'gray'
  );
}
