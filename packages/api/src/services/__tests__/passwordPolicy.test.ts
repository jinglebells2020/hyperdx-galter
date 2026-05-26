import { clearDBCollections, closeDB, connectDB } from '@/fixtures';
import Team from '@/models/team';
import User from '@/models/user';
import {
  PASSWORD_EXPIRY_DAYS,
  PASSWORD_HISTORY_LENGTH,
  changeUserPassword,
  initialiseUserPassword,
  newPasswordExpiry,
} from '@/services/passwordPolicy';

const fakeReq = () => ({ ip: '198.51.100.1', headers: {} }) as any;

async function makeUser(initialPassword = 'Original-1234!') {
  const team = await Team.create({ name: 'T' });
  const u = new (User as any)({
    email: 'alice@example.kz',
    name: 'Alice',
    team: team._id,
  });
  await initialiseUserPassword(u, initialPassword);
  return User.findById(u._id);
}

describe('passwordPolicy (FIB §24 — KZ certification)', () => {
  beforeAll(async () => {
    await connectDB();
  });
  afterEach(async () => {
    await clearDBCollections();
  });
  afterAll(async () => {
    await closeDB();
  });

  it('newPasswordExpiry returns now + 90 days', () => {
    const now = new Date('2026-05-26T00:00:00Z');
    const exp = newPasswordExpiry(now);
    const diffDays =
      (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(PASSWORD_EXPIRY_DAYS);
  });

  it('initialiseUserPassword stamps expiry and leaves history empty', async () => {
    const u = await makeUser('First-Password-1!');
    // History is empty after initialise. The current hash is on the user
    // document itself; subsequent changeUserPassword calls will push the
    // previous hash to history. Reuse of the CURRENT password is rejected
    // separately via authenticate(newPassword).
    expect(u?.passwordHistory ?? []).toHaveLength(0);
    expect(u?.passwordChangedAt).toBeTruthy();
    expect(u?.passwordExpiresAt).toBeTruthy();
    expect(u?.mustChangePasswordOnNextLogin).toBe(false);
  });

  it('rejects reuse of the CURRENT password (FIB §24 reuse_current)', async () => {
    const u = await makeUser('Current-Pwd-1!');
    const r = await changeUserPassword({
      actor: u!,
      oldPassword: 'Current-Pwd-1!',
      newPassword: 'Current-Pwd-1!',
      req: fakeReq(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('reuse');
  });

  it('changeUserPassword rejects wrong old password', async () => {
    const u = await makeUser('Right-Password-1!');
    const r = await changeUserPassword({
      actor: u!,
      oldPassword: 'WRONG',
      newPassword: 'New-Password-2!',
      req: fakeReq(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('oldPasswordIncorrect');
  });

  it('changeUserPassword rejects reuse', async () => {
    let u = await makeUser('First-Password-1!');
    const r = await changeUserPassword({
      actor: u!,
      oldPassword: 'First-Password-1!',
      newPassword: 'First-Password-1!',
      req: fakeReq(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('reuse');
  });

  it('changeUserPassword succeeds + caps history at PASSWORD_HISTORY_LENGTH', async () => {
    let u = await makeUser('Pwd-1!Pwd-1!');
    const sequence = [
      'Pwd-2!Pwd-2!',
      'Pwd-3!Pwd-3!',
      'Pwd-4!Pwd-4!',
      'Pwd-5!Pwd-5!',
      'Pwd-6!Pwd-6!',
      'Pwd-7!Pwd-7!',
    ];
    let old = 'Pwd-1!Pwd-1!';
    for (const next of sequence) {
      u = await User.findById(u!._id);
      const r = await changeUserPassword({
        actor: u!,
        oldPassword: old,
        newPassword: next,
        req: fakeReq(),
      });
      expect(r.ok).toBe(true);
      old = next;
    }
    const final = await User.findById(u!._id);
    expect(final?.passwordHistory.length).toBeLessThanOrEqual(
      PASSWORD_HISTORY_LENGTH,
    );
    // The very first hash is now outside the history window — reuse must be
    // allowed (history slides forward).
    const r = await changeUserPassword({
      actor: final!,
      oldPassword: 'Pwd-7!Pwd-7!',
      newPassword: 'Pwd-1!Pwd-1!',
      req: fakeReq(),
    });
    expect(r.ok).toBe(true);
  });

  it('changeUserPassword updates passwordChangedAt + passwordExpiresAt', async () => {
    const u = await makeUser('Pwd-1!Pwd-1!');
    const before = u!.passwordChangedAt!;
    await new Promise(res => setTimeout(res, 5));
    const r = await changeUserPassword({
      actor: u!,
      oldPassword: 'Pwd-1!Pwd-1!',
      newPassword: 'Pwd-2!Pwd-2!',
      req: fakeReq(),
    });
    expect(r.ok).toBe(true);
    const after = await User.findById(u!._id);
    expect(after?.passwordChangedAt!.getTime()).toBeGreaterThan(before.getTime());
    expect(after?.passwordExpiresAt!.getTime()).toBeGreaterThan(
      after?.passwordChangedAt!.getTime() ?? 0,
    );
    expect(after?.mustChangePasswordOnNextLogin).toBe(false);
  });
});
