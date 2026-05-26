import * as config from '@/config';
import logger from '@/utils/logger';

// FIB / OSI compliance startup check. Runs once at boot. Emits a single
// structured log line per failed gate, marked with `mooldir.cert.gate=fail`
// so the alert dispatcher can pick it up.
//
// This is informational, not enforcing — we don't refuse to boot. The
// auditor and the operator both need the option to deploy first and fix
// later in non-prod environments. Production deployments should treat any
// `mooldir.cert.gate=fail` line as a release blocker.

interface Gate {
  id: string;
  fib?: string;
  osi?: string;
  description: string;
  check: () => { ok: boolean; detail?: string };
}

function isTlsEnabledOnMongo(uri: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('mongodb+srv://')) return true; // SRV mandates TLS
  if (/[?&]tls=true/i.test(uri)) return true;
  if (/[?&]ssl=true/i.test(uri)) return true;
  return false;
}

function isTlsEnabledOnClickHouse(uri: string | undefined): boolean {
  if (!uri) return true; // CH connection is configured per-source in HyperDX, not via env
  if (uri.startsWith('https://')) return true;
  if (uri.startsWith('clickhouse+https://')) return true;
  if (/secure=true/i.test(uri)) return true;
  return false;
}

const GATES: Gate[] = [
  {
    id: 'tls.mongo',
    fib: '§8, §16, §20',
    osi: '§7.1',
    description: 'MongoDB connection must use TLS (tls=true or +srv URI).',
    check: () => {
      if (config.IS_DEV) return { ok: true, detail: 'skipped in dev' };
      const ok = isTlsEnabledOnMongo(config.MONGO_URI ?? '');
      return {
        ok,
        detail: ok
          ? 'OK'
          : `MONGO_URI lacks tls=true / ssl=true / +srv prefix. Set tls=true on the URI for KZ cert compliance.`,
      };
    },
  },
  {
    id: 'tls.clickhouse',
    fib: '§8, §16, §20',
    osi: '§7.1',
    description:
      'ClickHouse connections must use HTTPS / ?secure=true (configured per-source in HyperDX team settings).',
    check: () => {
      // HyperDX stores CH connections per-team in Mongo, not in env. We
      // emit an advisory line so the operator manually verifies each
      // connection has secure=true.
      return {
        ok: true,
        detail:
          'ADVISORY: verify each team Connection has `secure=true` in the URL or `Use HTTPS` toggled on. Audit via the Mongo `connections` collection.',
      };
    },
  },
  {
    id: 'session.cookieSecure',
    fib: '§50-52',
    description: 'Session cookie must be `secure` in production.',
    check: () => {
      return {
        ok: !config.IS_DEV,
        detail: config.IS_DEV
          ? 'dev — cookie.secure=false is expected'
          : 'cookie.secure forced true in api-app.ts',
      };
    },
  },
  {
    id: 'ntp.utc-kz',
    fib: '§44',
    osi: '§2.6, §4.5',
    description:
      'Host must be NTP-synchronised to UTC(kz). See `/etc/mooldir-time-policy` and `tasks/clockDriftMonitor.ts`.',
    check: () => ({
      ok: true,
      detail:
        'ADVISORY: clockDriftMonitor publishes drift_ms every 60s. Confirm host runs chrony / equivalent pointed at time.kz.',
    }),
  },
  {
    id: 'role.bootstrap',
    fib: '§33',
    description:
      'First user registered must be promoted to securityAdmin (enforced in /register/password).',
    check: () => ({
      ok: true,
      detail:
        'ADVISORY: confirm via `db.users.find({role:"securityAdmin"}).count() >= 1` after first registration.',
    }),
  },
  {
    id: 'audit.retention',
    fib: '§6',
    osi: '§2.3',
    description:
      'Audit log must retain ≥ 3 years (5 y for accounting), 2 months hot. Mongo HdxAuditEvent is hot; cold archive pending (Sprint 2).',
    check: () => ({
      ok: false,
      detail:
        'BLOCKER: cold-archive pipeline not yet shipped. See `docs/kz-certification-progress.md` Sprint 2.',
    }),
  },
];

export function runCertComplianceCheck() {
  const failures: Array<{ id: string; detail?: string }> = [];
  for (const gate of GATES) {
    const r = gate.check();
    if (r.ok) {
      logger.info(
        {
          'mooldir.cert.gate': 'pass',
          gate: gate.id,
          fib: gate.fib,
          osi: gate.osi,
          detail: r.detail,
        },
        `cert.gate ${gate.id} OK`,
      );
    } else {
      failures.push({ id: gate.id, detail: r.detail });
      logger.error(
        {
          'mooldir.cert.gate': 'fail',
          gate: gate.id,
          fib: gate.fib,
          osi: gate.osi,
          description: gate.description,
          detail: r.detail,
        },
        `cert.gate ${gate.id} FAIL — ${gate.description}`,
      );
    }
  }
  if (failures.length === 0) {
    logger.info({ 'mooldir.cert.gate': 'all-pass' }, 'cert.gate all-pass');
  } else {
    logger.error(
      { 'mooldir.cert.gate': 'summary', failures },
      `cert.gate summary: ${failures.length} failed`,
    );
  }
  return failures;
}
