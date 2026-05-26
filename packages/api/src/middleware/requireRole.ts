import type { NextFunction, Request, Response } from 'express';

import type { UserRole } from '@/models/user';
import { auditResource } from '@/services/audit';

// FIB §33 — role-based middleware. Accepts a set of roles that may pass; any
// other authenticated user gets a 403 and an audit `denied` record. Use after
// `isUserAuthenticated`.
export function requireRole(...allowed: UserRole[]) {
  const set = new Set(allowed);
  return async function requireRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const user: any = req.user;
    if (!user) return res.sendStatus(401);
    const role = (user.role ?? 'user') as UserRole;
    if (set.has(role)) {
      return next();
    }
    await auditResource(
      'security',
      'audit.viewed',
      {
        objectKind: 'route',
        objectId: req.originalUrl,
        actorUserId: user._id,
        actorEmail: user.email,
        teamId: user.team,
        details: {
          requiredRoles: [...set],
          actualRole: role,
        },
      },
      req,
      'denied',
    );
    return res.status(403).json({ error: 'forbidden', requiredRoles: [...set] });
  };
}

export const requireSecurityAdmin = requireRole('securityAdmin');
export const requireUserAdmin = requireRole('userAdmin', 'securityAdmin');
export const requireDataAdmin = requireRole(
  'dataAdmin',
  'userAdmin',
  'securityAdmin',
);
