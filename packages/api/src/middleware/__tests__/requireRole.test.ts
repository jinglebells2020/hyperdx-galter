import express from 'express';
import request from 'supertest';

import { clearDBCollections, closeDB, connectDB } from '@/fixtures';
import {
  requireRole,
  requireSecurityAdmin,
} from '@/middleware/requireRole';
import AuditEvent from '@/models/auditEvent';

function mountApp(role: string | undefined, mw = requireSecurityAdmin) {
  const app = express();
  app.use((req: any, _res, next) => {
    req.user = {
      _id: 'u1',
      email: 'u1@kz',
      team: 't1',
      role,
    };
    next();
  });
  app.get('/protected', mw, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('requireRole (FIB §33 — KZ certification)', () => {
  beforeAll(async () => {
    await connectDB();
  });
  afterEach(async () => {
    await clearDBCollections();
  });
  afterAll(async () => {
    await closeDB();
  });

  it('lets a securityAdmin through', async () => {
    const app = mountApp('securityAdmin');
    await request(app).get('/protected').expect(200, { ok: true });
  });

  it('blocks a regular user with 403', async () => {
    const app = mountApp('user');
    await request(app).get('/protected').expect(403);
  });

  it('also blocks userAdmin against requireSecurityAdmin', async () => {
    const app = mountApp('userAdmin');
    await request(app).get('/protected').expect(403);
  });

  it('records a denied audit event when blocking', async () => {
    const app = mountApp('user');
    await request(app).get('/protected').expect(403);
    const events = await AuditEvent.find({});
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('denied');
    expect(events[0].action).toBe('audit.viewed');
    expect(events[0].objectId).toContain('/protected');
  });

  it('treats missing role as `user`', async () => {
    const app = mountApp(undefined);
    await request(app).get('/protected').expect(403);
  });

  it('requireRole accepts a custom role list', async () => {
    const mw = requireRole('dataAdmin', 'userAdmin');
    const app1 = mountApp('dataAdmin', mw);
    await request(app1).get('/protected').expect(200);
    const app2 = mountApp('user', mw);
    await request(app2).get('/protected').expect(403);
  });
});
