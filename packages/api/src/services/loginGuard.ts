import type { Request } from 'express';

import User, { UserDocument } from '@/models/user';

// FIB §22 brute-force defence: lock after N failed attempts for L minutes;
// reset the counter on a successful login. Threshold and window match the
// production-side Galter values (production/apps/api/src/controllers/authController.ts).
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_FAILURE_RESET_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function ipFromRequest(req: Request | null | undefined): string | undefined {
  if (!req) return undefined;
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim();
  }
  return req.ip;
}

export async function recordLoginSuccess(user: UserDocument, req: Request | null) {
  const sessionId = (req as any)?.sessionID;
  const ip = ipFromRequest(req);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        lastSeenAt: new Date(),
        failedLoginCountSinceLastSuccess: 0,
        activeSessionId: sessionId,
      },
      $unset: {
        lockedUntil: '',
      },
    },
  );
}

export async function recordLoginFailure(
  email: string,
  req: Request | null,
  _reason?: string,
) {
  const ip = ipFromRequest(req);
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (!existing) {
    // Don't expose enumeration. Still record the failure on the (absent) account.
    return;
  }

  // Reset window: if the last failure was long ago, start fresh at 1.
  const now = Date.now();
  const lastFail = existing.lastFailedLoginAt?.getTime() ?? 0;
  const withinWindow = now - lastFail < LOGIN_FAILURE_RESET_WINDOW_MS;
  const newCount =
    (withinWindow ? existing.failedLoginCountSinceLastSuccess ?? 0 : 0) + 1;

  const update: Record<string, unknown> = {
    failedLoginCountSinceLastSuccess: newCount,
    lastFailedLoginAt: new Date(),
    lastFailedLoginIp: ip,
  };
  if (newCount >= LOGIN_MAX_FAILED_ATTEMPTS) {
    update.lockedUntil = new Date(now + LOGIN_LOCK_DURATION_MS);
  }
  await User.updateOne({ _id: existing._id }, { $set: update });
}

// FIB §51 parallel-session limit: after a successful login we record the new
// session id on the user. When a subsequent request comes in, the
// `enforceSingleSession` middleware compares the current session id to the
// recorded one and 401s if they differ (i.e. the user logged in elsewhere).
export async function isCurrentSessionStillActive(
  userId: any,
  sessionId: string | undefined,
): Promise<boolean> {
  if (!sessionId) return false;
  const u = await User.findById(userId).select(
    'activeSessionId lastSeenAt lockedUntil passwordExpiresAt',
  );
  if (!u) return false;
  if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) return false;
  if (u.activeSessionId && u.activeSessionId !== sessionId) return false;
  return true;
}

export async function touchLastSeen(userId: any) {
  await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } });
}
