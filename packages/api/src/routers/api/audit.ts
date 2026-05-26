import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import { requireSecurityAdmin } from '@/middleware/requireRole';
import AuditEvent from '@/models/auditEvent';
import { auditResource } from '@/services/audit';
import { Api400Error } from '@/utils/errors';

const router = express.Router();

// FIB §3-5 audit search. Gated by securityAdmin (FIB §4) and the search itself
// is audited (FIB §30: admin reads of the audit log are themselves audited).
const searchQuery = z.object({
  // Time window (oldest first if `asc`).
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  // Selectivity attributes (FIB §5).
  actorUserId: z.string().optional(),
  actorEmail: z.string().optional(),
  actorIp: z.string().optional(),
  category: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'denied']).optional(),
  objectKind: z.string().optional(),
  objectId: z.string().optional(),
  // Paging.
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

router.get(
  '/events',
  requireSecurityAdmin,
  validateRequest({ query: searchQuery }),
  async (req, res, next) => {
    try {
      const {
        from,
        to,
        actorUserId,
        actorEmail,
        actorIp,
        category,
        action,
        outcome,
        objectKind,
        objectId,
        cursor,
        limit,
        order,
      } = req.query as z.infer<typeof searchQuery>;

      const filter: Record<string, unknown> = {};
      if (from || to || cursor) {
        const ts: Record<string, Date> = {};
        if (from) ts.$gte = new Date(from);
        if (to) ts.$lte = new Date(to);
        if (cursor) {
          // Cursor is the timestamp of the last returned item.
          if (order === 'asc') ts.$gt = new Date(cursor);
          else ts.$lt = new Date(cursor);
        }
        filter.ts = ts;
      }
      if (actorUserId) filter.actorUserId = actorUserId;
      if (actorEmail) filter.actorEmail = actorEmail.toLowerCase();
      if (actorIp) filter.actorIp = actorIp;
      if (category) filter.category = category;
      if (action) filter.action = action;
      if (outcome) filter.outcome = outcome;
      if (objectKind) filter.objectKind = objectKind;
      if (objectId) filter.objectId = objectId;

      const sort = order === 'asc' ? { ts: 1 as const } : { ts: -1 as const };
      const found = await AuditEvent.find(filter)
        .sort(sort)
        .limit(Math.min(limit ?? 100, 500))
        .lean();

      // Audit the audit-read itself.
      await auditResource(
        'security',
        'audit.viewed',
        {
          objectKind: 'auditEventQuery',
          actorUserId: (req.user as any)?._id,
          actorEmail: (req.user as any)?.email,
          teamId: (req.user as any)?.team,
          details: {
            resultCount: found.length,
            filterKeys: Object.keys(filter),
          },
        },
        req,
      );

      res.json({
        events: found,
        nextCursor: found.length > 0 ? found[found.length - 1].ts : null,
      });
    } catch (e) {
      if (e instanceof Api400Error) return next(e);
      next(e);
    }
  },
);

export default router;
