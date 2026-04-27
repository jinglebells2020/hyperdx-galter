# hyperdx-galter

A Galter / AltaiLabs fork of [hyperdxio/hyperdx](https://github.com/hyperdxio/hyperdx),
forked at upstream commit `c2a9f96` (2026-04-27) under MIT license.

## Why fork

Upstream HyperDX is excellent observability software but doesn't fit the
Galter customer surface out-of-the-box:

- **Russian-first UI** for KZ accountant audience
- **Brand v2 typography + palette** (Newsreader / Manrope / JetBrains Mono /
  forest-green or ochre accent) instead of HyperDX's stock chrome
- **Embedded `Entity Trace`** deep-link page from `altailabs.io/onec/entity/...`
  inside HyperDX rows
- **Hide power-user surfaces** that customers shouldn't see (raw CH SQL
  workbench, alert engine for non-admin teams, OPAMP supervisor)
- **Skip bundled OTel collector** — we run our own collector image so we
  control the bearer-auth config (resolves the `provided authorization does
  not match expected scheme or token` blocker observed on the upstream
  OPAMP-supervised collector)

## Tracking upstream

```bash
# Fetch upstream changes
git fetch upstream

# Merge a specific upstream tag/branch
git merge upstream/main

# OR rebase our customizations on top of upstream
git rebase upstream/main
```

Our `origin` is `jinglebells2020/hyperdx-galter`. Upstream is
`hyperdxio/hyperdx` and is read-only — never push to it.

## Deployment

Runs as Railway service `hyperdx-galter` in project `altnapp`. Connects to
the same MongoDB and ClickHouse as the existing `HyperDX` service so both
read/write the same teams, sources, dashboards. (Coexist mode — once the
fork is stable, `HyperDX` can be deleted.)

Required env vars on the Railway service:
- `MONGO_URI` — point at existing `mongodb.railway.internal:27017`
- `DEFAULT_CONNECTIONS` + `DEFAULT_SOURCES` — copy from the existing
  HyperDX service
- `FRONTEND_URL` / `HYPERDX_APP_URL` — public URL of this service
- `OTEL_EXPORTER_OTLP_ENDPOINT` — point at our collector
- `OTEL_SERVICE_NAME` — `hdx-galter`

## Building

The all-in-one Dockerfile lives at `docker/hyperdx/Dockerfile`. For
production it's simpler to run `packages/api/Dockerfile` and
`packages/app/Dockerfile` as two services, but Railway's "1 service, 1
image" model makes the all-in-one image the default starting point.

## What's customized

(populated as work lands)

- _none yet — this is the bare fork commit_
