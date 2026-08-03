# Portfolio Advisor

A local-only tool that reviews my investment portfolio against a target allocation
(Investment Policy Statement) and recommends buy-only rebalancing purchases,
with supporting sources, on a bi-monthly cadence plus a deeper review before
the annual contribution each January.

## Privacy model

This repo contains **code only**. All sensitive data — holdings (ISINs,
quantities), the annual contribution amount, and the actual IPS — lives in
`~/investments-data/`, **outside this repo**, and is never committed.

See `templates/*.example.yaml` for the expected file formats (placeholder
data only).

Everything runs locally via `launchd`; no cloud execution, no third party
sees portfolio size or holdings beyond anonymous ticker/price lookups.

## Layout

- `scripts/` — pipeline code
- `templates/` — example/placeholder versions of the data files
- Real data (not in git): `~/investments-data/{ips,portfolio,contribution}.yaml`,
  `~/investments-data/history/` (past reports + recommendation log),
  `~/investments-data/cache/` (price data cache)
