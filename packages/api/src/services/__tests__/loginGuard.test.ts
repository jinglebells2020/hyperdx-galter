import { clearDBCollections, closeDB, connectDB } from '@/fixtures';
import Team from '@/models/team';
import User from '@/models/user';
import {
  LOGIN_LOCK_DURATION_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  isCurrentSessionStillActive,
  recordLoginFailure,
  recordLoginSuccess,
  touchLastSeen,
} from '@/services/loginGuard';

const fakeReq = (sessionID = 'sess-1', ip = '203.0.113.7') =>
  ({
    sessionID,
    ip,
    headers: {},
  }) as any;

describe('loginGuard (FIB §22, §51 — KZ certification)', () => {
  beforeAll(async () => {
    await connectDB();
  });
  afterEach(async () => {
    await clearDBCollections();
  });
  afterAll(async () => {
    await closeDB();
  });

  it('locks an account after LOGIN_MAX_FAILED_ATTEMPTS failures', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({ email: 'a@b.kz', team: team._id });

    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      await recordLoginFailure('a@b.kz', fakeReq());
    }

    const after = await User.findById(u._id);
    expect(after?.failedLoginCountSinceLastSuccess).toBe(
      LOGIN_MAX_FAILED_ATTEMPTS,
    );
    expect(after?.lockedUntil).toBeTruthy();
    expect(after?.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(after?.lockedUntil!.getTime()).toBeLessThanOrEqual(
      Date.now() + LOGIN_LOCK_DURATION_MS + 1000,
    );
  });

  it('does not leak account existence: no doc, no write', async () => {
    await recordLoginFailure('ghost@b.kz', fakeReq());
    const count = await User.countDocuments({});
    expect(count).toBe(0);
  });

  it('resets counter on successful login', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({
      email: 'a@b.kz',
      team: team._id,
      failedLoginCountSinceLastSuccess: 3,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    await recordLoginSuccess(u, fakeReq('sess-success', '198.51.100.2'));

    const after = await User.findById(u._id);
    expect(after?.failedLoginCountSinceLastSuccess).toBe(0);
    expect(after?.lockedUntil).toBeFalsy();
    expect(after?.lastLoginAt).toBeTruthy();
    expect(after?.lastLoginIp).toBe('198.51.100.2');
    expect(after?.activeSessionId).toBe('sess-success');
  });

  it('enforces single-session: new login evicts old session id', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({ email: 'a@b.kz', team: team._id });

    await recordLoginSuccess(u, fakeReq('first-session'));
    expect(await isCurrentSessionStillActive(u._id, 'first-session')).toBe(true);
    expect(await isCurrentSessionStillActive(u._id, 'stale-session')).toBe(
      false,
    );

    // Simulate the same user logging in from a second browser
    await recordLoginSuccess(u, fakeReq('second-session'));
    expect(await isCurrentSessionStillActive(u._id, 'second-session')).toBe(
      true,
    );
    expect(await isCurrentSessionStillActive(u._id, 'first-session')).toBe(
      false,
    );
  });

  it('isCurrentSessionStillActive refuses while account is locked', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({
      email: 'a@b.kz',
      team: team._id,
      activeSessionId: 'live-session',
      lockedUntil: new Date(Date.now() + 60_000),
    });
    expect(await isCurrentSessionStillActive(u._id, 'live-session')).toBe(false);
  });

  it('touchLastSeen updates lastSeenAt', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({ email: 'a@b.kz', team: team._id });
    const before = await User.findById(u._id);
    expect(before?.lastSeenAt).toBeFalsy();
    await touchLastSeen(u._id);
    const after = await User.findById(u._id);
    expect(after?.lastSeenAt).toBeTruthy();
  });

  it('reset window: counter restarts after LOGIN_FAILURE_RESET_WINDOW_MS', async () => {
    const team = await Team.create({ name: 'T' });
    const u = await User.create({
      email: 'a@b.kz',
      team: team._id,
      failedLoginCountSinceLastSuccess: 2,
      // 31 minutes ago — outside the 30-min reset window
      lastFailedLoginAt: new Date(Date.now() - 31 * 60 * 1000),
    });

    await recordLoginFailure('a@b.kz', fakeReq());
    const after = await User.findById(u._id);
    // Should restart at 1, not 3
    expect(after?.failedLoginCountSinceLastSuccess).toBe(1);
    expect(after?.lockedUntil).toBeFalsy();
  });
});
