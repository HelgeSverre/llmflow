# LLMFlow AI CLI Tools Support Roadmap

**Version**: 0.3.0 Target  
**Timeline**: Q1 2025 (8-10 weeks)  
**Goal**: Universal observability for AI coding assistants

## Vision

Make LLMFlow the go-to observability backend for AI-assisted development, supporting all major AI CLI tools out of the box.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LLMFlow v0.3.0                                  │
│                  "AI CLI Tools Observability"                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Claude Code ──┐                                                       │
│   Codex CLI ────┼──► OTLP Logs ────┐                                   │
│   Gemini CLI ───┤                  │                                   │
│                 ├──► OTLP Metrics ─┼──► LLMFlow ──► Dashboard          │
│                 │                  │      │                             │
│   Aider ────────┼──► Proxy ────────┤      └──► Alerts                  │
│   Cline ────────┤                  │      └──► Analytics               │
│   OpenCode ─────┘                  │                                   │
│                                    │                                   │
│   Any OpenAI ───────► Proxy ───────┘                                   │
│   Compatible                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: OTLP Logs Endpoint (Weeks 1-3)

**Milestone**: Accept log telemetry from Codex CLI

### Week 1: Core Implementation

| Task | Priority | Effort |
|------|----------|--------|
| Add `logs` table to database schema | P0 | 2h |
| Implement `/v1/logs` OTLP endpoint | P0 | 4h |
| Add log parsing from OTLP JSON format | P0 | 3h |
| Extract `event.name` for AI CLI tools | P0 | 2h |
| Add `db.insertLog()` function | P0 | 2h |

### Week 2: Dashboard Integration

| Task | Priority | Effort |
|------|----------|--------|
| Add `/api/logs` REST endpoint | P0 | 2h |
| Add `/api/logs/:id` endpoint | P0 | 1h |
| Add logs to WebSocket broadcasts | P1 | 2h |
| Create basic logs viewer component | P1 | 4h |
| Add log filtering (service, event, severity) | P1 | 3h |

### Week 3: Testing & Polish

| Task | Priority | Effort |
|------|----------|--------|
| Test with Codex CLI | P0 | 4h |
| Write integration tests | P1 | 3h |
| Add log retention/cleanup | P1 | 2h |
| Document configuration | P0 | 2h |
| Update examples/codex-cli/ | P1 | 2h |

**Deliverable**: Codex CLI logs visible in LLMFlow dashboard

---

## Phase 2: OTLP Metrics Endpoint (Weeks 4-6)

**Milestone**: Accept metrics from Claude Code and Gemini CLI

### Week 4: Core Implementation

| Task | Priority | Effort |
|------|----------|--------|
| Add `metrics` table to database schema | P0 | 2h |
| Implement `/v1/metrics` OTLP endpoint | P0 | 4h |
| Parse Counter, Gauge, Histogram types | P0 | 4h |
| Extract token usage metrics | P0 | 2h |
| Add `db.insertMetric()` function | P0 | 2h |

### Week 5: Aggregation & APIs

| Task | Priority | Effort |
|------|----------|--------|
| Implement metrics aggregation queries | P0 | 4h |
| Add `/api/metrics` REST endpoint | P0 | 2h |
| Add `/api/metrics/tokens` summary | P0 | 2h |
| Add `/api/metrics/costs` summary | P1 | 2h |
| Add metrics to stats endpoint | P1 | 2h |

### Week 6: Dashboard & Testing

| Task | Priority | Effort |
|------|----------|--------|
| Create metrics charts component | P1 | 4h |
| Add token usage visualization | P1 | 3h |
| Test with Claude Code | P0 | 4h |
| Test with Gemini CLI | P0 | 3h |
| Document Claude Code setup | P0 | 2h |

**Deliverable**: Claude Code & Gemini CLI metrics in dashboard

---

## Phase 3: Passthrough Proxy (Weeks 7-8)

**Milestone**: Claude Code works via LLMFlow proxy

### Week 7: Core Passthrough

| Task | Priority | Effort |
|------|----------|--------|
| Create `PassthroughHandler` base class | P0 | 3h |
| Implement Anthropic passthrough | P0 | 4h |
| Add `/passthrough/anthropic/*` routes | P0 | 2h |
| Extract usage from native responses | P0 | 3h |
| Add streaming support | P0 | 4h |

### Week 8: Additional Providers & Testing

| Task | Priority | Effort |
|------|----------|--------|
| Implement Gemini passthrough | P1 | 3h |
| Add `/passthrough/gemini/*` routes | P1 | 2h |
| Test Claude Code end-to-end | P0 | 4h |
| Add passthrough stats endpoint | P2 | 2h |
| Document passthrough configuration | P0 | 2h |

**Deliverable**: Claude Code fully working with LLMFlow

---

## Phase 4: Dashboard Enhancements (Weeks 9-10)

**Milestone**: Unified view of all AI CLI tool activity

### Week 9: Unified Telemetry View

| Task | Priority | Effort |
|------|----------|--------|
| Create unified timeline component | P1 | 4h |
| Correlate logs with traces via trace_id | P1 | 3h |
| Add "Tool" filter (Claude, Codex, etc.) | P1 | 2h |
| Session grouping for CLI tools | P2 | 3h |
| Add tool-specific icons/colors | P2 | 2h |

### Week 10: Analytics & Documentation

| Task | Priority | Effort |
|------|----------|--------|
| Token usage trends chart | P2 | 3h |
| Cost analytics by tool | P2 | 3h |
| Update main README | P0 | 2h |
| Create "AI CLI Tools" docs section | P0 | 4h |
| Update examples/ with all tools | P1 | 3h |

**Deliverable**: v0.3.0 release with full AI CLI support

---

## Release Schedule

```
Week 1-3    Week 4-6    Week 7-8    Week 9-10
   │           │           │           │
   ▼           ▼           ▼           ▼
┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
│v0.2.1│   │v0.2.2│   │v0.2.3│   │v0.3.0│
│ Logs │   │Metrics│  │Passth│   │Full  │
└──────┘   └──────┘   └──────┘   └──────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
 Codex     Claude     Claude     All tools
  CLI      Code+      Code       unified
 works     Gemini     proxy      dashboard
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Tool coverage | 4+ tools | Count supported tools |
| Setup time | < 5 min | User testing |
| Data latency | < 100ms | Performance testing |
| Dashboard load | < 2s | Performance testing |
| Documentation | Complete | All tools documented |

---

## Tool Support Timeline

| Tool | v0.2.1 | v0.2.2 | v0.2.3 | v0.3.0 |
|------|--------|--------|--------|--------|
| OpenAI SDK | ✅ | ✅ | ✅ | ✅ |
| Aider (proxy) | ✅ | ✅ | ✅ | ✅ |
| OpenLLMetry | ✅ | ✅ | ✅ | ✅ |
| Codex CLI | 🆕 | ✅ | ✅ | ✅ |
| Gemini CLI | ⚪ | 🆕 | ✅ | ✅ |
| Claude Code (OTEL) | ⚪ | 🆕 | ✅ | ✅ |
| Claude Code (proxy) | ⚪ | ⚪ | 🆕 | ✅ |
| Cline (proxy) | ⚪ | ⚪ | ⚪ | 🆕 |

Legend: ✅ Supported | 🆕 New in version | ⚪ Not yet

---

## Dependencies & Risks

### External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| OTLP JSON spec stability | Low | Use stable v1.9.0 spec |
| Claude Code OTEL support | Medium | Passthrough as fallback |
| Gemini CLI API changes | Low | Monitor releases |
| Codex CLI config format | Low | Already stable |

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Streaming parsing complexity | Medium | Start with non-streaming |
| Database schema migrations | Low | Use ALTER TABLE |
| Dashboard performance | Medium | Pagination, lazy loading |
| gRPC support requests | Low | Defer to v0.4.0 |

---

## Future (v0.4.0+)

Not in scope for v0.3.0, but on the radar:

- [ ] OTLP/gRPC support (for tools preferring gRPC)
- [ ] Protobuf binary encoding support
- [ ] Metrics downsampling for long-term storage
- [ ] MCP server for Cline/Claude Code integration
- [ ] Cost alerts and budgets
- [ ] Multi-user/team support
- [ ] Export to external observability platforms

---

## Quick Reference: Configuration per Tool

### After v0.3.0, users will configure:

**Claude Code**:
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000
# OR
export ANTHROPIC_BASE_URL=http://localhost:8080/passthrough/anthropic
```

**Codex CLI**:
```toml
# ~/.codex/config.toml
[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
```

**Gemini CLI**:
```json
{"telemetry": {"otlpEndpoint": "http://localhost:3000"}}
```

**Aider**:
```bash
aider --openai-api-base http://localhost:8080/v1
```

**Cline**:
Configure provider base URL in VS Code settings.

---

## Getting Started (For Contributors)

1. Read the RFCs in order:
   - [AI CLI Tools Support](./ai-cli-tools-support.md)
   - [OTLP Metrics and Logs](./metrics-and-logs.md)
   - [Passthrough Mode](./passthrough-mode.md)

2. Pick a task from Phase 1, Week 1

3. Create a branch: `feature/otlp-logs`

4. Reference this roadmap in PRs
