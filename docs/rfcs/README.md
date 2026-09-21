# LLMFlow design records

These documents retain original design discussions. Their implementation details and example commands are historical; use the [README](../../README.md) and [current integration guide](../guides/ai-cli-tools.md) to run the app.

| Record                                       | Status                          | Current implementation                                                           |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| [OTLP metrics and logs](metrics-and-logs.md) | Implemented                     | `packages/otlp/src/`, dashboard Logs and Metrics tabs                            |
| [Native passthrough](passthrough-mode.md)    | Implemented                     | `apps/server/src/proxy.ts`, `packages/providers/src/passthrough.ts`              |
| [AI CLI tools](ai-cli-tools-support.md)      | Historical integration proposal | Use the current integration guide; upstream client capabilities vary by version. |

New proposals should identify a concrete user problem and measurable benefit. Existing feature status belongs in current guides, not in an implied implementation schedule for these historical records.
