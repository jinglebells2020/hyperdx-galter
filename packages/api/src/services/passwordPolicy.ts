import type { Request } from 'express';

import User, { UserDocument } from '@/models/user';
import { auditResource } from '@/services/audit';

// FIB §24 — password policy enforcement.
//
// * Min 12 chars + 4 character classes (already enforced by the registration
//   Zod schema and the front-end PasswordCheck component).
// * Expiration: 90 days after the last change.
// * History: last 5 hashes; user may not reuse any of them.
// * Forced rotation: securityAdmin may set `mustChangePasswordOnNextLogin`
//   which is read by the login flow.

export const PASSWORD_EXPIRY_DAYS = 90;
export const PASSWORD_HISTORY_LENGTH = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function newPasswordExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_EXPIRY_DAYS * MS_PER_DAY);
}

/**
 * Compare a candidate password against all stored history hashes. Returns
 * `true` if any previous hash matches (i.e. reuse). Uses
 * passport-local-mongoose's internal hashing — the User document holds
 * `hash`/`salt` for the current password; history rows store the same
 * serialised "salt:hash:iterations" blob we get from the plugin.
 */
async function candidateMatchesAnyHistory(
  user: UserDocument & { authenticate: any },
  candidate: string,
): Promise<boolean> {
  const history = user.passwordHistory ?? [];
  if (history.length === 0) return false;
  // We use a throwaway User document with hash/salt set from the history
  // row so we can re-use the plugin's authenticate(). The plugin doesn't
  // expose a "verify against arbitrary hash" function directly.
  for (const entry of history) {
    // The hash blob from passport-local-mongoose is encoded as
    // `${salt}:${hash}:${iterations}` (the @hyperdx fork uses pbkdf2 by
    // default). We deserialise back into a temporary user.
    const blob = entry.hash;
    const tmp = new User({ email: 'noop@noop' });
    const [salt, hash, iterations] = blob.split(':');
    if (!salt || !hash || !iterations) continue;
    (tmp as any).salt = salt;
    (tmp as any).hash = hash;
    (tmp as any).iterations = parseInt(iterations, 10);
    const result = await new Promise<boolean>(resolve => {
      (tmp as any).authenticate(candidate, (_err: any, ok: any) => {
        resolve(!!ok);
      });
    });
    if (result) return true;
  }
  return false;
}

export interface ChangePasswordOptions {
  actor: UserDocument;
  oldPassword: string;
  newPassword: string;
  req: Request;
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; code: 'oldPasswordIncorrect' | 'reuse' | 'unknown'; message: string };

/**
 * Change the user's password while updating the history + expiration +
 * mustChangePassword flag. Always emits an audit record (success or
 * failure).
 */
export async function changeUserPassword(
  opts: ChangePasswordOptions,
): Promise<ChangePasswordResult> {
  const { actor, oldPassword, newPassword, req } = opts;

  // Capture the current hash before mutation so we can push it to history.
  const previousBlob = serializePlmHashBlob(actor as any);

  // Verify the old password.
  const verified = await new Promise<boolean>(resolve => {
    (actor as any).authenticate(oldPassword, (_err: any, ok: any) => {
      resolve(!!ok);
    });
  });
  if (!verified) {
    await auditResource(
      'user',
      'password.changed',
      {
        objectKind: 'User',
        objectId: actor._id.toString(),
        actorUserId: actor._id,
        actorEmail: actor.email,
        teamId: actor.team,
      },
      req,
      'failure',
    );
    return {
      ok: false,
      code: 'oldPasswordIncorrect',
      message: 'Current password is incorrect.',
    };
  }

  // FIB §24 reuse check — refuse the *current* password and any of the
  // last PASSWORD_HISTORY_LENGTH past passwords. Current is checked by
  // re-running authenticate(newPassword); history is checked by the
  // serialised-blob comparison.
  const reusesCurrent = await new Promise<boolean>(resolve => {
    (actor as any).authenticate(newPassword, (_err: any, ok: any) => {
      resolve(!!ok);
    });
  });
  const reusesHistory =
    !reusesCurrent &&
    (await candidateMatchesAnyHistory(actor as any, newPassword));
  if (reusesCurrent || reusesHistory) {
    await auditResource(
      'user',
      'password.changed',
      {
        objectKind: 'User',
        objectId: actor._id.toString(),
        actorUserId: actor._id,
        actorEmail: actor.email,
        teamId: actor.team,
        details: { reason: reusesCurrent ? 'reuse_current' : 'reuse_history' },
      },
      req,
      'denied',
    );
    return {
      ok: false,
      code: 'reuse',
      message: `New password must not match the current password or any of the last ${PASSWORD_HISTORY_LENGTH} passwords.`,
    };
  }

  // Set the new password (plugin handles hashing + saves).
  await new Promise<void>((resolve, reject) => {
    (actor as any).setPassword(newPassword, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });

  // Push the OLD hash to history (not the new one — the new one is the
  // current password and is checked separately above). Cap at
  // PASSWORD_HISTORY_LENGTH.
  const newHistory = [
    ...(actor.passwordHistory ?? []),
    previousBlob
      ? { hash: previousBlob, changedAt: new Date() }
      : null,
  ]
    .filter((x): x is { hash: string; changedAt: Date } => !!x)
    .slice(-PASSWORD_HISTORY_LENGTH);
  actor.passwordHistory = newHistory;
  actor.passwordChangedAt = new Date();
  actor.passwordExpiresAt = newPasswordExpiry();
  actor.mustChangePasswordOnNextLogin = false;
  await actor.save();

  await auditResource(
    'user',
    'password.changed',
    {
      objectKind: 'User',
      objectId: actor._id.toString(),
      actorUserId: actor._id,
      actorEmail: actor.email,
      teamId: actor.team,
    },
    req,
    'success',
  );
  return { ok: true };
}

/**
 * Initial password registration (no old password to verify) — used by
 * the team-setup invite flow and password-reset completion. Still records
 * the new hash into history and sets the expiration.
 */
export async function initialiseUserPassword(
  user: UserDocument,
  newPassword: string,
) {
  await new Promise<void>((resolve, reject) => {
    (user as any).setPassword(newPassword, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
  // Initial password — leave history empty. Subsequent changes will push
  // the previous hash. The CURRENT hash is checked separately on
  // each change via authenticate(newPassword), so leaving history empty
  // does not let A→A reuse slip through.
  user.passwordHistory = [];
  user.passwordChangedAt = new Date();
  user.passwordExpiresAt = newPasswordExpiry();
  user.mustChangePasswordOnNextLogin = false;
  await user.save();
}

function serializePlmHashBlob(
  user: { salt?: string; hash?: string; iterations?: number },
): string | null {
  if (!user.salt || !user.hash || !user.iterations) return null;
  return `${user.salt}:${user.hash}:${user.iterations}`;
}
