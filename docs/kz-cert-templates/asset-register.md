# Mooldir asset register (OPOIB §1)

Filled in by the operating organisation as part of the certification
application. Re-reviewed annually OR after any change to the deployment
topology.

## Format

For each asset:

| Field | Notes |
|---|---|
| Asset ID | Stable identifier (`MD-ASSET-NNN`). |
| Type | server / vm / managed-db / container / network-device / service-account / dataset. |
| Description | One sentence. |
| Owner | The ИБ-officer or designate responsible. |
| Class | 1 / 2 / 3 per ППРК-832 classifier. |
| Value rating | high / medium / low (confidentiality + integrity + availability). |
| Location | Region, data-centre, segment. |
| Disposal procedure | Reference to OPOIB §1 п.10 procedure. |

## Default Mooldir assets

| Asset ID | Type | Description | Class | Value | Location |
|---|---|---|---|---|---|
| MD-ASSET-001 | container | HyperDX API service on Railway | 2 | high | Railway US-East / KZ |
| MD-ASSET-002 | container | HyperDX App service (Next.js) | 2 | medium | Railway US-East / KZ |
| MD-ASSET-003 | managed-db | MongoDB (HyperDX metadata + audit log) | 2 | high | Railway managed |
| MD-ASSET-004 | managed-db | ClickHouse (telemetry + 1С events) | 1 | high | Railway managed |
| MD-ASSET-005 | managed-db | PostgreSQL (Galter side) | 2 | high | Railway managed |
| MD-ASSET-006 | managed-db | Redis (cache + sessions) | 3 | low | Railway managed |
| MD-ASSET-007 | container | OTel Collector | 2 | medium | Railway US-East |
| MD-ASSET-008 | container | onec-replica per-tenant pollers | 2 | high | Railway US-East |
| MD-ASSET-009 | service-account | tenant ECDSA signing keys | 2 | high | Mongo + KMS-wrapped |
| MD-ASSET-010 | dataset | otel_logs (1С events) | 1 | high | ClickHouse |
| MD-ASSET-011 | dataset | HdxAuditEvent (self-audit) | 1 | high | MongoDB |
| MD-ASSET-012 | dataset | User passwords (bcrypt cost 12 + history) | 2 | high | MongoDB + PostgreSQL |

## Disposal procedure (default)

1. Pause the asset (stop ingestion, take it out of routing).
2. Snapshot for archival per the data-retention rules
   (`docs/runbooks/audit-retention.md`).
3. Delete the live store. For managed services on Railway, use the
   Railway dashboard "Delete service" with a follow-up call to verify
   physical deletion via SOC 2 inheritance.
4. Record the disposal in the audit log with category=`config`,
   action=`config.changed`, details `{asset: MD-ASSET-NNN, op: 'disposed'}`.

## Inventory verification

The asset register must be reviewed by the ИБ-officer and signed off
annually. The signed PDF goes into the cert-application bundle.
