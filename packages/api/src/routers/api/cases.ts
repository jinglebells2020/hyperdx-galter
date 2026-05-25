import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import {
  addNote,
  closeCase,
  createCase,
  getCase,
  getCases,
  reopenCase,
  updateCase,
} from '@/controllers/case';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import { objectIdSchema } from '@/utils/zod';
import User from '@/models/user';

const router = express.Router();

const severityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const statusEnum = z.enum([
  'open',
  'in_progress',
  'pending_clarification',
  'resolved',
  'closed',
  'reopened',
]);

router.get('/', async (req, res, next) => {
  try {
    const { teamId } = getNonNullUserWithTeam(req);
    const cases = await getCases(teamId.toString(), {
      status: typeof req.query.status === 'string' ? (req.query.status as never) : undefined,
      severity: typeof req.query.severity === 'string' ? (req.query.severity as never) : undefined,
      assignee_email:
        typeof req.query.assignee_email === 'string' ? req.query.assignee_email : undefined,
    });
    res.json(cases);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/:id',
  validateRequest({ params: z.object({ id: objectIdSchema }) }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const c = await getCase(teamId.toString(), req.params.id);
      if (!c) return res.status(404).json({ error: 'not_found' });
      res.json(c);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/',
  validateRequest({
    body: z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(10000).optional(),
      severity: severityEnum.optional(),
      status: statusEnum.optional(),
      rule_name: z.string().max(500).optional(),
      tier_detected_by: z.enum(['tier1', 'tier2', 'tier3', 'manual']).optional(),
      finding_signature: z.string().max(500).optional(),
      assignee_email: z.string().nullable().optional(),
      related_entity_ids: z.array(z.string().max(100)).max(500).optional(),
      related_actor_ids: z.array(z.string().max(100)).max(100).optional(),
      related_counterparty_ids: z.array(z.string().max(100)).max(500).optional(),
      time_window: z
        .object({
          start: z.coerce.date(),
          end: z.coerce.date(),
        })
        .optional(),
      citations: z
        .array(
          z.object({
            npa: z.string().min(1),
            url: z.string().url().optional(),
            excerpt: z.string().max(3500).optional(),
            added_at: z.coerce.date().optional(),
            added_by: z.string().optional(),
          }),
        )
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const user = await User.findById(userId).lean();
      const created = await createCase(
        teamId.toString(),
        req.body as never,
        userId?.toString() || '',
        user?.email || 'unknown',
      );
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id',
  validateRequest({
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(10000).optional(),
      severity: severityEnum.optional(),
      status: statusEnum.optional(),
      assignee_email: z.string().nullable().optional(),
      related_entity_ids: z.array(z.string().max(100)).max(500).optional(),
      related_actor_ids: z.array(z.string().max(100)).max(100).optional(),
      related_counterparty_ids: z.array(z.string().max(100)).max(500).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const user = await User.findById(userId).lean();
      const updated = await updateCase(
        teamId.toString(),
        req.params.id,
        req.body as never,
        userId?.toString() || '',
        user?.email || 'unknown',
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/notes',
  validateRequest({
    params: z.object({ id: objectIdSchema }),
    body: z.object({ text: z.string().min(1).max(10000) }),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const user = await User.findById(userId).lean();
      const updated = await addNote(
        teamId.toString(),
        req.params.id,
        req.body.text,
        user?.email || 'unknown',
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/close',
  validateRequest({
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      close_reason: z.enum(['confirmed', 'rejected_false_positive', 'unresolved']),
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const user = await User.findById(userId).lean();
      const updated = await closeCase(
        teamId.toString(),
        req.params.id,
        req.body.close_reason,
        user?.email || 'unknown',
      );
      if (!updated) return res.status(404).json({ error: 'not_found' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/reopen',
  validateRequest({ params: z.object({ id: objectIdSchema }) }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const user = await User.findById(userId).lean();
      const updated = await reopenCase(teamId.toString(), req.params.id, user?.email || 'unknown');
      if (!updated) return res.status(404).json({ error: 'not_found' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
