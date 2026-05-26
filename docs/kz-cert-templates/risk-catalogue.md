# Mooldir risk catalogue (OPOIB §8)

ISO 27005-aligned. Compiled by the ИБ-officer; reviewed annually.

## Risk-rating matrix

Likelihood × Impact, each scored 1-5:

|   | I=1 | I=2 | I=3 | I=4 | I=5 |
|---|---|---|---|---|---|
| **L=5** | M | H | H | C | C |
| **L=4** | L | M | H | H | C |
| **L=3** | L | M | M | H | H |
| **L=2** | L | L | M | M | H |
| **L=1** | L | L | L | M | M |

L = low, M = medium, H = high, C = critical.

## Top risks (2026-05-26 baseline)

| # | Risk | L | I | Score | Treatment |
|---|---|---|---|---|---|
| R-001 | Tenant data leakage via shared CH user | 3 | 5 | H | Mitigate: ship CH row policies (Sprint 2 / OSI §2.4). |
| R-002 | Audit log tampered by sysadmin | 2 | 5 | H | Mitigate: ECDSA signature per event (DONE); separate securityAdmin role (DONE); cold archive (Sprint 2). |
| R-003 | Brute-force credential attack | 3 | 4 | H | Mitigate: 5-fail lockout (DONE), bcrypt cost 12 (DONE). |
| R-004 | Stolen JWT secret | 2 | 5 | H | Mitigate: 90-day rotation policy (DONE); dual-secret grace window (DONE). |
| R-005 | Clock skew vs UTC(kz) | 3 | 3 | M | Mitigate: chrony policy + clockDriftMonitor (DONE). |
| R-006 | Loss of 1С events ≥ 30 days | 5 | 4 | C | Mitigate: 5-year archive (Sprint 2 BLOCKER). |
| R-007 | Single-region outage | 2 | 5 | H | Transfer: SLA from Railway; Mitigate: Sprint 3 HA-DR. |
| R-008 | Phishing of an admin | 3 | 4 | H | Mitigate: 2FA required for admin (Galter side DONE); login banner (DONE). |
| R-009 | Outdated dependencies (CVE) | 4 | 3 | H | Mitigate: Renovate / Dependabot (Sprint 4). |
| R-010 | Database backup not restorable | 2 | 5 | H | Mitigate: quarterly DR drill (Sprint 2). |
| R-011 | Plaintext CH/Mongo on internal links | 3 | 4 | H | Mitigate: TLS at all hops (Sprint 2). |
| R-012 | Misconfigured Railway secret in build | 3 | 3 | M | Mitigate: gitleaks pre-commit (DONE for production repo); add to hyperdx-galter (Sprint 4). |

## Treatment status legend

- **Mitigate** — apply a control to lower likelihood or impact.
- **Transfer** — accept residual via contract (SLA, cyber insurance).
- **Accept** — acknowledged, no action; document why.
- **Avoid** — change the scope so the risk no longer applies.

## Review cadence

- Major review: annually
- Minor review: any time a new asset is added or an incident closes
- Each row's "Score" must be re-evaluated when its mitigation status changes
