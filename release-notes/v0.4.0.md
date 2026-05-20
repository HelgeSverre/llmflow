# LLMFlow v0.4.0 Release Notes

## 🎉 Frontend Rewrite: Svelte 5

The dashboard has been completely rewritten from vanilla JavaScript to **Svelte 5** with TypeScript. This brings:

- **Better maintainability** - Component-based architecture with reactive state management
- **Hot module replacement** - Fast development with instant feedback
- **Type safety** - Full TypeScript support across all components
- **Smaller bundle** - ~78KB gzipped (down from ~95KB)

### What's New

- **Timeline Tab** - Unified view of traces and logs in chronological order
- **Improved keyboard shortcuts** - `1-6` for tabs, `t` for theme, `j/k` for navigation
- **Better filtering** - All tabs now have consistent filter UIs with debounced search
- **Real-time updates** - WebSocket-driven live updates across all tabs

### New API Endpoints

- `GET /api/timeline` - Combined traces + logs feed
- `GET /api/analytics` - Aggregated analytics data (daily stats, cost by tool/model)

### Development Workflow

The frontend now lives in `frontend/` with its own build system:

```bash
# Development (with hot reload)
cd frontend && npm run dev

# Production build
cd frontend && npm run build

# Type checking
cd frontend && npm run check
```

### Breaking Changes

None. The dashboard UI and all API endpoints remain backward compatible.

---

## Full Changelog

### Added
- Svelte 5 + Vite frontend in `frontend/` directory
- Timeline tab combining traces and logs
- `/api/timeline` endpoint for unified data feed
- `/api/analytics` combined endpoint
- TypeScript type definitions for all stores and components
- 82 comprehensive E2E tests with Playwright

### Changed
- `/api/models` now returns full model stats (request_count, total_tokens, total_cost)
- Frontend build outputs to `public/` for seamless backend integration
- Test server uses port 3001/8081 to avoid conflicts

### Fixed
- Format utilities handle null/undefined values gracefully
- Analytics days filter correctly binds string values
- Status filter in traces tab properly selects inner span elements

---

**Full Changelog**: [v0.3.2...v0.4.0](https://github.com/HelgeSverre/llmflow/compare/v0.3.2...v0.4.0)
