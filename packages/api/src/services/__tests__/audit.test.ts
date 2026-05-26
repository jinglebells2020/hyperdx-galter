import { clearDBCollections, closeDB, connectDB } from '@/fixtures';
import AuditEvent from '@/models/auditEvent';
import { auditLogin, auditResource, recordAudit } from '@/services/audit';

const fakeReq = (overrides: Partial<any> = {}) =>
  ({
    ip: '198.51.100.42',
    sessionID: 'sess-xyz',
    headers: {
      'user-agent': 'Mooldir-Test/1.0',
      ...((overrides.headers as any) ?? {}),
    },
    ...overrides,
  }) as any;

describe('audit service (FIB §1-6 — KZ certification)', () => {
  beforeAll(async () => {
    await connectDB();
  });
  afterEach(async () => {
    await clearDBCollections();
  });
  afterAll(async () => {
    await closeDB();
  });

  it('records the canonical FIB §2 fields: ts, subject, type, outcome', async () => {
    await recordAudit(
      {
        category: 'auth',
        action: 'login.success',
        outcome: 'success',
        actorEmail: 'a@b.kz',
      },
      fakeReq(),
    );
    const docs = await AuditEvent.find({});
    expect(docs).toHaveLength(1);
    const d = docs[0];
    expect(d.ts).toBeInstanceOf(Date);
    expect(d.actorEmail).toBe('a@b.kz');
    expect(d.actorIp).toBe('198.51.100.42');
    expect(d.actorUserAgent).toBe('Mooldir-Test/1.0');
    expect(d.sessionId).toBe('sess-xyz');
    expect(d.category).toBe('auth');
    expect(d.action).toBe('login.success');
    expect(d.outcome).toBe('success');
  });

  it('prefers X-Forwarded-For over req.ip when present', async () => {
    await recordAudit(
      {
        category: 'auth',
        action: 'login.failed',
        outcome: 'failure',
        actorEmail: 'x@y.kz',
      },
      fakeReq({
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      }),
    );
    const d = await AuditEvent.findOne({ actorEmail: 'x@y.kz' });
    expect(d?.actorIp).toBe('203.0.113.9');
  });

  it('truncates monster user-agents at 512 chars', async () => {
    await recordAudit(
      { category: 'auth', action: 'logout', outcome: 'success' },
      fakeReq({ headers: { 'user-agent': 'A'.repeat(2000) } }),
    );
    const d = await AuditEvent.findOne({});
    expect(d?.actorUserAgent?.length).toBe(512);
  });

  it('never throws when the database is unhappy', async () => {
    const origCreate = (AuditEvent as any).create;
    (AuditEvent as any).create = () => Promise.reject(new Error('boom'));
    await expect(
      recordAudit(
        { category: 'auth', action: 'login.success', outcome: 'success' },
        fakeReq(),
      ),
    ).resolves.toBeUndefined();
    (AuditEvent as any).create = origCreate;
  });

  it('auditLogin convenience picks the right action by outcome', async () => {
    await auditLogin('success', { actorEmail: 'a@b.kz' }, fakeReq());
    await auditLogin('failure', { actorEmail: 'a@b.kz' }, fakeReq());
    const docs = await AuditEvent.find({}).sort({ action: 1 });
    expect(docs.map(d => d.action)).toEqual(['login.failed', 'login.success']);
  });

  it('auditResource captures objectKind + objectId', async () => {
    await auditResource(
      'dashboard',
      'dashboard.deleted',
      {
        objectKind: 'Dashboard',
        objectId: 'dash-42',
        actorEmail: 'admin@x.kz',
      },
      fakeReq(),
    );
    const d = await AuditEvent.findOne({});
    expect(d?.objectKind).toBe('Dashboard');
    expect(d?.objectId).toBe('dash-42');
    expect(d?.category).toBe('dashboard');
  });
});
