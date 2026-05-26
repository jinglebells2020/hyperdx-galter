# Mooldir KZ certification — progress tracker

Living document tracking progress against the three KZ State Technical
Service criteria documents. Updated on every sprint.

Cross-reference: `/home/ubuntu/mooldir-fib-osi-opoib-compliance.md` for
the initial gap analysis (2026-05-25).

## Sprint 1 — code-level Sprint (in branch `feat/kz-cert-sprint-1`)

| Item | Status | Closed by |
|---|---|---|
| FIB §1-6 self-audit log | ✓ DONE | `models/auditEvent.ts`, `services/audit.ts`, login/logout/CRUD hooks |
| FIB §3-5 audit search UI + API | ✓ DONE | `routers/api/audit.ts`, `pages/audit.tsx` |
| FIB §22 brute-force lockout | ✓ DONE | `services/loginGuard.ts` |
| FIB §24 password policy | ✓ DONE | `services/passwordPolicy.ts`, schema fields |
| FIB §30 audit-data admin-only | ✓ DONE | `middleware/requireRole.ts` |
| FIB §33 three-role hierarchy | ✓ DONE | User.role enum, requireSecurityAdmin/UserAdmin/DataAdmin |
| FIB §44 UTC(kz) sync | ✓ DONE | `tasks/clockDriftMonitor.ts`, `/etc/mooldir-time-policy` |
| FIB §50-52 session hardening | ✓ DONE | `api-app.ts` cookie config + single-session |
| FIB §53 login banner | ✓ DONE | `LoginBanner.tsx` |
| FIB §54 last-login surface | ✓ DONE | `GET /me/login-history`, UI badge wiring |
| OSI §2.4 audit-log tamper protection (app side) | ✓ DONE | `requireSecurityAdmin` gate; CH row policies pending Sprint 2 |
| OSI §2.6 UTC(kz) sync | ✓ DONE | see FIB §44 |

## Sprint 2 — infra + code (pending)

| Item | Plan |
|---|---|
| FIB §6 / OSI §2.3 retention 5 y | Two-tier: `otel_logs` 60 d hot → `otel_logs_archive` 5 y on object storage. Sign every archive batch with the tenant ECDSA key (extend `signEventHash`). Needs CH 24.10 upgrade. |
| FIB §8 / §16 / §20 TLS at all hops | CH client switches to `?secure=true`; Mongo URI gains `tls=true`. CH server cert via internal CA. |
| OSI §2.4 CH row policies | Migration 002 (drafted, deferred) — re-enable once Railway CH has CREATE USER / CREATE ROW POLICY. |
| FIB §34 / §39 backup + DR drill | `clickhouse-backup` cron + quarterly restore test. |
| OPOIB §11 audit retention runbook | `docs/runbooks/audit-retention.md` — pgdump for HdxAuditEvent → S3 + Glacier 90 d. |

## Sprint 3 — infrastructure

| Item | Plan |
|---|---|
| FIB §48 / OSI §6.1 / §8.1 HA-DR | CH Cloud multi-AZ + Mongo Atlas replica set + Postgres multi-AZ. Document RPO / RTO. |

## Sprint 4 — organizational (templates)

| Item | Plan |
|---|---|
| OPOIB §1 asset register | Provide JSON-template; ИБ-officer fills in services. |
| OPOIB §2 designate ИБ-офицер | One-page assignment letter; reviewed every 2 years. |
| OPOIB §3 personnel security | Onboarding/offboarding checklists (NDA, prod access revoke). |
| OPOIB §5 BCP | Builds on Sprint 3. |
| OPOIB §8 risk catalogue | ISO 27005-aligned. Top 10 risks template. |
| OPOIB §12 TD ИБ | 4-tier policy → standard → procedure → record. RU + KZ. |
| OPOIB §13 SDL | Semgrep / CodeQL in CI; sec-review PR template (Sprint 4 in this repo). |

## Items that this repo cannot close

- The actual аттестация — must be run by a licensed «испытательная
  лаборатория». Mooldir as a product can be made certifiable; the
  certificate itself is issued by a third party.
- Customer-side OSI §1.x / §4.x / §5.x — these belong to the operating
  organisation's network gear configuration, not to Mooldir.
- FIB §56-60 (antivirus on host), §67-70 (DLP) — host-layer / deployment
  responsibilities; we document them in `docs/deployment-hardening.md`
  but they are configured by the customer.

## How to read this file

After every cert-related commit, append the closed item to the relevant
sprint table. If the item is partial, mark `~PARTIAL` and explain in the
"Closed by" cell.
