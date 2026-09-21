# GitHub issue verification — 2026-09-21

Scope: all 29 open issues #5–#33, reviewed against local unpushed changes and completed in the working tree. GitHub issues remain open; no commits or pushes were made by this task.

| Issue                                                   | Local fix and evidence                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [#5](https://github.com/HelgeSverre/llmflow/issues/5)   | Shared redaction before insertion; historical scrub, REST/WS/export and proxy authentication regressions.                                      |
| [#6](https://github.com/HelgeSverre/llmflow/issues/6)   | Loopback listeners, explicit host overrides, Docker host-loopback publishing; reviewed-fixes tests.                                            |
| [#7](https://github.com/HelgeSverre/llmflow/issues/7)   | Exact Origin validation before upgrade; rejected hostile/missing origins and allowed dashboard connection tested.                              |
| [#8](https://github.com/HelgeSverre/llmflow/issues/8)   | Unique span IDs with shared trace IDs; mock normalized/native proxy tests.                                                                     |
| [#9](https://github.com/HelgeSverre/llmflow/issues/9)   | JSON/protobuf × identity/gzip × three signals, bounded decoding; real Python exporter integration.                                             |
| [#10](https://github.com/HelgeSverre/llmflow/issues/10) | Incremental OpenAI-compatible text/tool/finish/usage frames; native bytes preserved; proxy tests.                                              |
| [#11](https://github.com/HelgeSverre/llmflow/issues/11) | Request-scoped cumulative Anthropic input/output/cache usage; fragmented stream tests.                                                         |
| [#12](https://github.com/HelgeSverre/llmflow/issues/12) | Independent unsubscribe-capable record subscriptions; exporter/WS coexistence and failing-listener tests.                                      |
| [#13](https://github.com/HelgeSverre/llmflow/issues/13) | Full sanitized records exported; collector assertions for usage, long/structured logs, context and histograms.                                 |
| [#14](https://github.com/HelgeSverre/llmflow/issues/14) | Temporary databases and dynamic ports; concurrent sentinel-database isolation tests.                                                           |
| [#15](https://github.com/HelgeSverre/llmflow/issues/15) | Nonzero result for child signals, nonzero exit and spawn failures; runner regression tests.                                                    |
| [#16](https://github.com/HelgeSverre/llmflow/issues/16) | Forwarded query multimap remains separate from routing and redacted diagnostics; proxy tests.                                                  |
| [#17](https://github.com/HelgeSverre/llmflow/issues/17) | Native Gemini URL-based streaming detection, model extraction and final usage; proxy tests.                                                    |
| [#18](https://github.com/HelgeSverre/llmflow/issues/18) | Current and legacy token attributes with zero precedence; persisted totals and deterministic cost tests.                                       |
| [#19](https://github.com/HelgeSverre/llmflow/issues/19) | Measured model token sums and mean recorded LLM latency; API regressions and nullable dashboard rendering.                                     |
| [#20](https://github.com/HelgeSverre/llmflow/issues/20) | Immutable request context keeps streaming parent IDs and tags; proxy persistence tests.                                                        |
| [#21](https://github.com/HelgeSverre/llmflow/issues/21) | Bounded single-read upstream body parsing preserves native error text and status; proxy tests.                                                 |
| [#22](https://github.com/HelgeSverre/llmflow/issues/22) | Deterministic logical-trace session ownership, descendant rollups and root navigation; database tests.                                         |
| [#23](https://github.com/HelgeSverre/llmflow/issues/23) | Selection generations reject obsolete success/failure, same-ID and deselection races; Vitest.                                                  |
| [#24](https://github.com/HelgeSverre/llmflow/issues/24) | Authoritative filtered refreshes plus request generations; Vitest and real WebSocket Playwright filter test.                                   |
| [#25](https://github.com/HelgeSverre/llmflow/issues/25) | SDK and dashboard default to 1337; default/override ingestion and occupied-port tests.                                                         |
| [#26](https://github.com/HelgeSverre/llmflow/issues/26) | No proxy idle cutoff; explicit overall deadline and cancellation; real Bun 11-second initial/gap tests.                                        |
| [#27](https://github.com/HelgeSverre/llmflow/issues/27) | Whole-trace eviction, indexed counts, bounded markers and explicit partial trees; retention/session tests.                                     |
| [#28](https://github.com/HelgeSverre/llmflow/issues/28) | Self-contained Bun server bundle and clean npm consumer release gate. Initial artifact failed resolving @llmflow/db; repaired artifact passes. |
| [#29](https://github.com/HelgeSverre/llmflow/issues/29) | Node ESM launcher with usable help/version, missing-Bun diagnostic and deliberate exit codes; artifact gate.                                   |
| [#30](https://github.com/HelgeSverre/llmflow/issues/30) | Shared nullable timestamp conversion and one-off observed-time repair; timestamp and migration tests.                                          |
| [#31](https://github.com/HelgeSverre/llmflow/issues/31) | Typed nested-tree adapter retains descendants/details; viewport tests and actual OTLP browser tree.                                            |
| [#32](https://github.com/HelgeSverre/llmflow/issues/32) | Reactive viewport prop updates preserve valid state and clamp/reset scroll; mounted Svelte and browser tests.                                  |
| [#33](https://github.com/HelgeSverre/llmflow/issues/33) | Single owned WebSocket and retry timer, stale callback guards and cleanup; lifecycle Vitest.                                                   |

Verification passed: all workspace typechecks, the isolated server suite (including real Python OTLP export), 18 dashboard unit/component tests, 87 Playwright tests, the production build and clean npm artifact/CLI checks. Changed source files also pass Prettier and `git diff --check`.

Verification commands:

- `bun run typecheck`
- `LLMFLOW_PYTHON=/path/to/python bun run test` (Python environment includes `opentelemetry-sdk` and `opentelemetry-exporter-otlp-proto-http`)
- `bun run --filter @llmflow/dashboard test`
- `bunx playwright test`
- `bun run build && bun run test:package`

Browser verification covers 1440, 1000 and 390 px widths, light/dark themes, nested trace trees, timing geometry, trace switching, long captured content and all dashboard tabs. Live-filter coverage compares WebSocket refreshes against the API query after reload. Server/provider regressions use local mock upstreams; live third-party provider probes are explicitly opt-in and are not required release checks.

The nested tree endpoint remains the canonical server response. Its typed dashboard adapter resolves issue #31 without introducing the separate, proposed flat API change in backlog task 26. Optional bearer authentication and chat-message presentation are separate backlog work, not requirements of these 29 issues.
