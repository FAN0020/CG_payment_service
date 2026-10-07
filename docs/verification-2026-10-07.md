# Build verification — 7 October 2026

| Item | Result |
| --- | --- |
| Source | `07c40575c576cdecfb5038d121035c0f1ba08d2e` |
| Environment | macOS; Node.js 26.5.0; npm 11.17.0 |
| Locked dependency installation | `npm ci --ignore-scripts --no-audit --no-fund` — passed |
| TypeScript validation | `npm run type-check` — passed |
| Compilation | `npm run build` — passed |

This run confirms that the checked-in source type-checks and compiles with the locked dependency tree. Installation scripts were disabled, so native database module installation and runtime behavior were not exercised. No Stripe keys were used, no payments were created, and webhook delivery, production deployment, and throughput were not evaluated.

See the [integration guide](integration-guide.md) and [existing test utilities](../tests/integration) for the additional configuration required to exercise the running service.
