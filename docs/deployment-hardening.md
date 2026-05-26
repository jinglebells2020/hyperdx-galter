# Mooldir deployment hardening guide (KZ certification)

This document captures the host- and orchestrator-level controls that the
Mooldir application image expects to be in place. The application code
enforces what it can; the rest must be configured at deploy time and
attested by the operating organisation to satisfy the KZ State Technical
Service criteria (FIB / OSI / OPOIB).

If you skip any item in this list, mark it in the cert application as
"deviation" with a justification.

## 1. Clock synchronisation (FIB §44, OSI §2.6, §4.5)

The container is configured with `TZ=UTC` and includes
`/etc/mooldir-time-policy` describing the approved NTP upstream servers:

- `time.kz` (primary)
- `time1.kazntp.kz` (secondary)
- `time2.kazntp.kz` (secondary)

**Host must run an NTP daemon** (chrony recommended) pointed at the servers
above. Acceptable maximum drift: ±500 ms.

For Railway: Railway hosts come time-synchronised via the underlying cloud
provider; this is acceptable as long as you periodically verify that the
in-container `tasks/clockDriftMonitor.ts` is logging `mooldir.clock.drift
OK` (visible in HyperDX logs under `type=mooldir.clock.drift`).

For bare-metal / Kubernetes / VM-based deployments: install chrony and
point it at the approved servers. Sample chrony.conf snippet:

```
server time.kz iburst prefer
server time1.kazntp.kz iburst
server time2.kazntp.kz iburst
makestep 1.0 3
rtcsync
```

Verification command for the auditor:

```
chronyc tracking
chronyc sources -v
```

## 2. Antivirus / malware protection (FIB §56-60)

Mooldir is application software, not an endpoint protection product. The
host running Mooldir must have:

- A licensed AV product (FIB §57) installed and running
- Auto-update of AV signatures (FIB §58) — via WSUS or an internal repo
  mirror in closed networks (FIB §62)
- Centralised management of the AV console (FIB §59) reporting health
- USB / removable-media scanning if applicable (FIB §60)

## 3. Network segmentation (OSI §4)

The Mooldir application services should be deployed in a dedicated
network segment, isolated from:

- End-user workstations
- Public Internet (except for outbound NTP, package updates, and the
  application's egress endpoints for Telegram alerts / email)

Recommended segmentation:

```
+-----------------------+      +-------------------+
| Mooldir UI (HyperDX)  | <--> | Mooldir API       |
| public-egress segment |      | private segment   |
+-----------------------+      +-------------------+
                                       |
                                       v
                                +-------------------+
                                | ClickHouse + Mongo|
                                | data segment      |
                                +-------------------+
```

For Railway deployments, this maps to:

- `frontend` service (public-facing)
- `backend` service (private)
- `clickhouse-internal` + `mongodb-internal` (private only)

## 4. TLS at all layers (FIB §8, §16, §20)

Required:

- Public ingress: TLS 1.2+ (TLS 1.3 preferred), terminated at Railway edge
  or your reverse proxy. Verify via `nmap --script ssl-enum-ciphers -p 443`.
- App ↔ ClickHouse: enable `?secure=true` on the connection URL once your
  CH server has a cert. Set `CLICKHOUSE_URL=clickhouse://user:pass@host:9440/db?secure=true`.
- App ↔ MongoDB: include `tls=true` in the URI:
  `mongodb://user:pass@host:27017/?tls=true&tlsCAFile=/etc/ssl/...`
- OTel collector: bearer auth is mandatory; mTLS optional but recommended.

## 5. Backups (FIB §34, §39, OPOIB §5)

Mooldir holds three durable stores:

- **MongoDB** — team / user / source / dashboard / saved-search /
  audit-event metadata. `mongodump` weekly full + daily incremental
  (oplog replay).
- **ClickHouse** — telemetry & 1С events. `clickhouse-backup` (or
  ClickHouse Cloud snapshots) daily incremental + weekly full.
- **PostgreSQL** (Galter side) — per memory `pg_dump` weekly + S3.

All backups must be encrypted (AES-256-GCM client-side OR cloud-provider
KMS). Quarterly DR drill: restore a backup into a staging environment
and verify integrity (FIB §39).

## 6. Disaster recovery (FIB §48, OSI §8.1)

For ОИ ЭП class 1: nagruženное hot standby in a second region.
For class 2: cold standby in a second region.
For class 3: cold backups in the same region (current configuration).

Plan to upgrade by Sprint 3 of the cert roadmap if certifying as class 1 or 2.

## 7. Roles & access (FIB §33, §28-33, OPOIB §9)

The application supports four roles: `user`, `dataAdmin`, `userAdmin`,
`securityAdmin`. Standard operating procedure:

- `securityAdmin` — sole audit-log reader. Held by the ИБ officer.
- `userAdmin` — creates / disables users. Held by the IT lead.
- `dataAdmin` — manages sources, connections, dashboards. Multiple
  people OK.
- `user` — end user. Cannot read the audit log nor change
  org-wide settings.

Initial bootstrap: the first registered user is auto-promoted to
`securityAdmin`. All subsequent role changes happen through the
`/team/users/:id/role` endpoint (audited).

## 8. Login banner (FIB §53)

The login page displays a Russian-language warning before authentication
referencing КоАП РК / УК РК. Verify by visiting the login page logged
out. Customise text via `MOOLDIR_LOGIN_BANNER_HTML` if your installation
requires a different legal notice.

## 9. Session controls (FIB §50-52)

Already enforced by the app:

- Cookie: `secure` (when not in dev), `httpOnly`, `sameSite=strict`.
- Idle timeout: 24 h.
- Parallel session limit: 1 (a new login evicts the old session).
- Account lockout: 5 failed attempts → 15 min lock.

## 10. Audit retention (FIB §6, OSI §2.3)

The `HdxAuditEvent` Mongo collection is kept in operational storage. A
cron job (`tasks/auditArchive.ts`) copies events older than 60 days into
the cold-storage archive (S3 + Glacier transition at 90 days). Total
retention: 5 years.

Default archive bucket: `s3://mooldir-audit-archive-{tenant}/`. KMS key
rotation: 12 months.
