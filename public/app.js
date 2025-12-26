// State
const validTabs = ['timeline', 'traces', 'logs', 'metrics', 'models', 'analytics'];
let currentTab = 'timeline';
let traces = [];
let logs = [];
let stats = {};
let selectedTraceId = null;
let selectedLogId = null;
let selectedTimelineItem = null;
let timelineItems = [];
let timelineFilters = {
    q: '',
    tool: '',
    type: '',
    dateRange: '',
    date_from: null
};
let filters = {
    q: '',
    model: '',
    status: '',
    dateRange: '',
    date_from: null,
    date_to: null
};
let logFilters = {
    q: '',
    service_name: '',
    event_name: '',
    severity_min: null
};
let metrics = [];
let metricsSummary = [];
let metricFilters = {
    name: '',
    service_name: '',
    metric_type: ''
};

// WebSocket state
let ws = null;
let wsRetryDelay = 1000;
const WS_MAX_RETRY = 30000;

// URL hash for tab persistence
function getTabFromHash() {
    const hash = window.location.hash.slice(1);
    return validTabs.includes(hash) ? hash : null;
}

function setTabHash(tab) {
    if (validTabs.includes(tab)) {
        // Use pushState to create history entries for back/forward navigation
        if (window.location.hash !== '#' + tab) {
            history.pushState(null, '', '#' + tab);
        }
    }
}

// Theme
function initTheme() {
    const savedTheme = localStorage.getItem('llmflow-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('llmflow-theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('llmflow-theme', 'dark');
    }
}

// Apply theme immediately (before DOMContentLoaded)
initTheme();

// Initialize
function init() {
    initFiltersFromUrl();
    setupFilters();
    setupLogFilters();
    setupMetricFilters();
    setupTimelineFilters();
    setupAnalyticsFilters();
    setupKeyboardShortcuts();
    loadModels();
    loadStats();
    loadLogFilterOptions();
    loadMetricFilterOptions();
    initWebSocket();

    // Load initial tab from hash or default to timeline
    currentTab = getTabFromHash() || 'timeline';
    showTab(currentTab);

    // Polling as fallback (less frequent since we have WebSocket)
    setInterval(loadStats, 30000);
    setInterval(() => {
        if (currentTab === 'timeline') loadTimeline();
        else if (currentTab === 'traces') loadTraces();
    }, 30000);

    // Handle hash changes (back/forward navigation)
    window.addEventListener('hashchange', () => {
        const tab = getTabFromHash();
        if (tab && tab !== currentTab) {
            showTab(tab);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        
        // "/" to focus search (when not in input)
        if (e.key === '/' && !isInputFocused) {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
            return;
        }
        
        // Escape: blur input or close detail panel
        if (e.key === 'Escape') {
            if (isInputFocused) {
                document.activeElement?.blur();
            } else {
                // Close detail panel by deselecting
                selectedTraceId = null;
                selectedLogId = null;
                selectedTimelineItem = null;
                document.querySelectorAll('.trace-row.selected, .log-row.selected, .timeline-item.selected')
                    .forEach(el => el.classList.remove('selected'));
                document.getElementById('detailTitle').textContent = 'Select a trace';
                document.getElementById('detailMeta').textContent = '';
            }
            return;
        }
        
        // Don't handle other shortcuts when in input
        if (isInputFocused) return;
        
        // Arrow key navigation for trace list
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') {
            e.preventDefault();
            navigateList(e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1);
            return;
        }
        
        // Enter to select/expand current item
        if (e.key === 'Enter') {
            const selected = document.querySelector('.trace-row.selected, .log-row.selected, .timeline-item.selected');
            if (selected) {
                selected.click();
            }
            return;
        }
        
        // Tab shortcuts: 1-6 for tabs
        if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const tabIndex = parseInt(e.key) - 1;
            if (tabIndex < validTabs.length) {
                e.preventDefault();
                showTab(validTabs[tabIndex]);
            }
            return;
        }
        
        // "r" to refresh
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            refreshCurrentTab();
            return;
        }
        
        // "t" to toggle theme
        if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleTheme();
            return;
        }
        
        // "?" to show keyboard help
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
            e.preventDefault();
            showKeyboardHelp();
            return;
        }
    });
}

function navigateList(direction) {
    let rows, currentSelected;
    
    if (currentTab === 'timeline') {
        rows = Array.from(document.querySelectorAll('.timeline-item'));
        currentSelected = document.querySelector('.timeline-item.selected');
    } else if (currentTab === 'traces') {
        rows = Array.from(document.querySelectorAll('#tracesBody .trace-row'));
        currentSelected = document.querySelector('#tracesBody .trace-row.selected');
    } else if (currentTab === 'logs') {
        rows = Array.from(document.querySelectorAll('#logsBody .trace-row'));
        currentSelected = document.querySelector('#logsBody .trace-row.selected');
    } else if (currentTab === 'metrics') {
        rows = Array.from(document.querySelectorAll('#metricsBody .trace-row'));
        currentSelected = document.querySelector('#metricsBody .trace-row.selected');
    } else {
        return;
    }
    
    if (rows.length === 0) return;
    
    let currentIndex = currentSelected ? rows.indexOf(currentSelected) : -1;
    let newIndex = currentIndex + direction;
    
    // Wrap around
    if (newIndex < 0) newIndex = rows.length - 1;
    if (newIndex >= rows.length) newIndex = 0;
    
    const newRow = rows[newIndex];
    if (newRow) {
        // For rows with onclick, trigger click; otherwise just select visually
        if (newRow.onclick || newRow.getAttribute('onclick')) {
            newRow.click();
        } else {
            // Visual selection only (for metrics which have no detail view)
            rows.forEach(r => r.classList.remove('selected'));
            newRow.classList.add('selected');
        }
        newRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function refreshCurrentTab() {
    switch (currentTab) {
        case 'timeline': loadTimeline(); break;
        case 'traces': loadTraces(); break;
        case 'logs': loadLogs(); break;
        case 'metrics': loadMetrics(); loadMetricsSummary(); break;
        case 'models': loadModelStats(); break;
        case 'analytics': loadAnalytics(); break;
    }
}

function showKeyboardHelp() {
    const existingHelp = document.getElementById('keyboardHelp');
    if (existingHelp) {
        existingHelp.remove();
        return;
    }
    
    const help = document.createElement('div');
    help.id = 'keyboardHelp';
    help.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--bg-secondary); border: 1px solid var(--border);
        border-radius: 8px; padding: 20px; z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3); min-width: 300px;
    `;
    help.innerHTML = `
        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Keyboard Shortcuts</h3>
        <table style="width: 100%; font-size: 13px;">
            <tr><td style="padding: 4px 0;"><kbd>/</kbd></td><td>Focus search</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Close panel / blur input</td></tr>
            <tr><td><kbd>↑</kbd> <kbd>↓</kbd> or <kbd>j</kbd> <kbd>k</kbd></td><td>Navigate list</td></tr>
            <tr><td><kbd>Enter</kbd></td><td>Select item</td></tr>
            <tr><td><kbd>1</kbd>-<kbd>6</kbd></td><td>Switch tabs</td></tr>
            <tr><td><kbd>r</kbd></td><td>Refresh</td></tr>
            <tr><td><kbd>t</kbd></td><td>Toggle theme</td></tr>
            <tr><td><kbd>?</kbd></td><td>Show/hide this help</td></tr>
        </table>
        <p style="margin: 15px 0 0 0; font-size: 11px; opacity: 0.7;">Press any key to close</p>
    `;
    document.body.appendChild(help);
    
    const closeHelp = () => {
        help.remove();
        document.removeEventListener('keydown', closeHelp);
        document.removeEventListener('click', closeHelp);
    };
    setTimeout(() => {
        document.addEventListener('keydown', closeHelp, { once: true });
        document.addEventListener('click', closeHelp, { once: true });
    }, 100);
}

// Filters
function initFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    filters.q = params.get('q') || '';
    filters.model = params.get('model') || '';
    filters.status = params.get('status') || '';
    filters.dateRange = params.get('date') || '';
    applyDateRange(filters.dateRange);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = filters.q;
    const modelFilter = document.getElementById('modelFilter');
    if (modelFilter) modelFilter.value = filters.model;
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.value = filters.status;
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) dateFilter.value = filters.dateRange;
}

function setupFilters() {
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filters.q = e.target.value;
            updateUrl();
            loadTraces();
        }, 300);
    });

    document.getElementById('modelFilter')?.addEventListener('change', (e) => {
        filters.model = e.target.value;
        updateUrl();
        loadTraces();
    });

    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        filters.status = e.target.value;
        updateUrl();
        loadTraces();
    });

    document.getElementById('dateFilter')?.addEventListener('change', (e) => {
        filters.dateRange = e.target.value;
        applyDateRange(filters.dateRange);
        updateUrl();
        loadTraces();
    });

    document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
}

function applyDateRange(range) {
    const now = Date.now();
    switch (range) {
        case '1h': filters.date_from = now - 3600000; break;
        case '24h': filters.date_from = now - 86400000; break;
        case '7d': filters.date_from = now - 604800000; break;
        default: filters.date_from = null;
    }
    filters.date_to = null;
}

function updateUrl() {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.model) params.set('model', filters.model);
    if (filters.status) params.set('status', filters.status);
    if (filters.dateRange) params.set('date', filters.dateRange);
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
}

function clearFilters() {
    filters = { q: '', model: '', status: '', dateRange: '', date_from: null, date_to: null };
    document.getElementById('searchInput').value = '';
    document.getElementById('modelFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('dateFilter').value = '';
    updateUrl();
    loadTraces();
}

// Tab switching
function showTab(tab) {
    currentTab = tab;
    setTabHash(tab);
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick*="'${tab}'"]`)?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'timeline') {
        document.getElementById('timelineTab').classList.add('active');
        loadTimeline();
    } else if (tab === 'traces') {
        document.getElementById('tracesTab').classList.add('active');
        loadTraces();
    } else if (tab === 'logs') {
        document.getElementById('logsTab').classList.add('active');
        loadLogs();
    } else if (tab === 'metrics') {
        document.getElementById('metricsTab').classList.add('active');
        loadMetrics();
        loadMetricsSummary();
    } else if (tab === 'models') {
        document.getElementById('modelsTab').classList.add('active');
        loadModelStats();
    } else if (tab === 'analytics') {
        document.getElementById('analyticsTab').classList.add('active');
        loadAnalytics();
    }
}

// Load models for filter
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const models = await response.json();
        const select = document.getElementById('modelFilter');
        if (!select) return;
        select.innerHTML = '<option value="">All Models</option>';
        models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model;
            opt.textContent = model;
            if (model === filters.model) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load models:', e);
    }
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        stats = await response.json();
        document.getElementById('totalRequests').textContent = stats.total_requests || 0;
        document.getElementById('totalTokens').textContent = formatNumber(stats.total_tokens || 0);
        document.getElementById('totalCost').textContent = '$' + (stats.total_cost || 0).toFixed(2);
        document.getElementById('avgLatency').textContent = Math.round(stats.avg_duration || 0) + 'ms';
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// Load traces
async function loadTraces() {
    if (currentTab !== 'traces') return;

    try {
        const params = new URLSearchParams({ limit: '100' });
        if (filters.q) params.set('q', filters.q);
        if (filters.model) params.set('model', filters.model);
        if (filters.status) params.set('status', filters.status);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);

        const response = await fetch('/api/traces?' + params.toString());
        traces = await response.json();

        const tbody = document.getElementById('tracesBody');
        if (traces.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No traces found. Run: npm run demo</td></tr>`;
            return;
        }

        tbody.innerHTML = traces.map(t => `
            <tr class="trace-row ${t.id === selectedTraceId ? 'selected' : ''}" data-testid="trace-row" data-trace-id="${t.id}" onclick="selectTrace('${t.id}', this)">
                <td data-testid="trace-time">${formatTime(t.timestamp)}</td>
                <td data-testid="trace-type"><span class="span-badge span-${t.span_type || 'llm'}">${t.span_type || 'llm'}</span></td>
                <td data-testid="trace-name">${escapeHtml(t.span_name || '-')}</td>
                <td data-testid="trace-model">${t.model ? `<span class="model-badge">${escapeHtml(t.model)}</span>` : '-'}</td>
                <td data-testid="trace-tokens">${formatNumber(t.total_tokens || 0)}</td>
                <td data-testid="trace-cost">$${(t.estimated_cost || 0).toFixed(4)}</td>
                <td data-testid="trace-latency">${t.duration_ms || 0}ms</td>
                <td data-testid="trace-status" class="${(t.status || 200) < 400 ? 'status-success' : 'status-error'}">${t.status || 200}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load traces:', e);
        document.getElementById('tracesBody').innerHTML = 
            '<tr><td colspan="8" class="empty-state">Failed to load traces</td></tr>';
    }
}

// Select trace and show in detail panel
async function selectTrace(traceId, rowEl) {
    selectedTraceId = traceId;

    document.querySelectorAll('.trace-row').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');

    const titleEl = document.getElementById('detailTitle');
    const metaEl = document.getElementById('detailMeta');
    const infoEl = document.getElementById('traceInfo');
    const spanTreeEl = document.getElementById('spanTree');
    const ioEl = document.getElementById('traceIO');

    try {
        const treeRes = await fetch(`/api/traces/${traceId}/tree`);

        if (treeRes.ok) {
            const data = await treeRes.json();
            const t = data.trace || {};

            titleEl.textContent = data.spans?.[0]?.span_name || 'Trace';
            metaEl.textContent = [
                t.span_count ? `${t.span_count} spans` : null,
                t.duration_ms ? `${t.duration_ms}ms` : null,
                t.total_tokens ? `${t.total_tokens} tokens` : null,
                t.total_cost ? `$${t.total_cost.toFixed(4)}` : null
            ].filter(Boolean).join(' · ');

            infoEl.textContent = JSON.stringify({
                trace_id: t.trace_id,
                duration: `${t.duration_ms}ms`,
                tokens: t.total_tokens,
                cost: `$${(t.total_cost || 0).toFixed(4)}`,
                spans: t.span_count
            }, null, 2);

            spanTreeEl.innerHTML = (data.spans || []).map(s => renderSpanNode(s)).join('') 
                || '<span class="empty-state">No spans</span>';

            const firstSpan = data.spans?.[0];
            const { input, output } = firstSpan ? extractIO(firstSpan) : { input: null, output: null };
            ioEl.textContent = JSON.stringify({ input, output }, null, 2);
        } else {
            const res = await fetch(`/api/traces/${traceId}`);
            const data = await res.json();
            const t = data.trace;

            titleEl.textContent = t.span_name || t.model || 'Trace';
            metaEl.textContent = [
                t.duration_ms ? `${t.duration_ms}ms` : null,
                t.total_tokens ? `${t.total_tokens} tokens` : null
            ].filter(Boolean).join(' · ');

            infoEl.textContent = JSON.stringify(t, null, 2);
            spanTreeEl.innerHTML = '<span class="empty-state">Single span trace</span>';
            
            const spanLike = {
                input: t.input,
                output: t.output,
                request_body: data.request?.body,
                response_body: data.response?.body,
            };
            const { input, output } = extractIO(spanLike);
            ioEl.textContent = JSON.stringify({ input, output }, null, 2);
        }
    } catch (e) {
        console.error('Failed to load trace:', e);
        titleEl.textContent = 'Error';
        metaEl.textContent = '';
        infoEl.textContent = '{}';
        spanTreeEl.innerHTML = '<span class="empty-state">Failed to load</span>';
        ioEl.textContent = '{}';
    }
}

// Render span node recursively
function renderSpanNode(span, depth = 0) {
    const children = (span.children || []).map(c => renderSpanNode(c, depth + 1)).join('');
    return `
        <div class="span-node">
            <div class="span-node-header">
                <span class="span-badge span-${span.span_type || 'custom'}">${span.span_type || 'span'}</span>
                <strong>${escapeHtml(span.span_name || span.id?.slice(0, 8) || 'span')}</strong>
                <span class="span-node-meta">
                    ${span.duration_ms || 0}ms
                    ${span.model ? `· ${span.model}` : ''}
                </span>
            </div>
            ${children ? `<div class="span-node-children">${children}</div>` : ''}
        </div>
    `;
}

// Load model stats
async function loadModelStats() {
    if (currentTab !== 'models') return;

    const container = document.getElementById('modelStats');
    if (!stats.models || stats.models.length === 0) {
        container.innerHTML = '<p class="empty-state">No model usage data yet</p>';
        return;
    }

    container.innerHTML = stats.models.map(m => `
        <div class="model-card">
            <h4>${escapeHtml(m.model || 'unknown')}</h4>
            <div class="model-stat">
                <span class="model-stat-label">Requests</span>
                <span class="model-stat-value">${m.count}</span>
            </div>
            <div class="model-stat">
                <span class="model-stat-label">Tokens</span>
                <span class="model-stat-value">${formatNumber(m.tokens)}</span>
            </div>
            <div class="model-stat">
                <span class="model-stat-label">Cost</span>
                <span class="model-stat-value">$${(m.cost || 0).toFixed(4)}</span>
            </div>
        </div>
    `).join('');
}

// ==================== Logs Functions ====================

function setupLogFilters() {
    let searchTimeout;
    document.getElementById('logSearchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            logFilters.q = e.target.value;
            loadLogs();
        }, 300);
    });

    document.getElementById('logServiceFilter')?.addEventListener('change', (e) => {
        logFilters.service_name = e.target.value;
        loadLogs();
    });

    document.getElementById('logEventFilter')?.addEventListener('change', (e) => {
        logFilters.event_name = e.target.value;
        loadLogs();
    });

    document.getElementById('logSeverityFilter')?.addEventListener('change', (e) => {
        logFilters.severity_min = e.target.value ? parseInt(e.target.value, 10) : null;
        loadLogs();
    });

    document.getElementById('clearLogFilters')?.addEventListener('click', clearLogFilters);
}

function clearLogFilters() {
    logFilters = { q: '', service_name: '', event_name: '', severity_min: null };
    document.getElementById('logSearchInput').value = '';
    document.getElementById('logServiceFilter').value = '';
    document.getElementById('logEventFilter').value = '';
    document.getElementById('logSeverityFilter').value = '';
    loadLogs();
}

async function loadLogFilterOptions() {
    try {
        const response = await fetch('/api/logs/filters');
        const data = await response.json();
        
        const serviceSelect = document.getElementById('logServiceFilter');
        if (serviceSelect && data.services) {
            serviceSelect.innerHTML = '<option value="">All Services</option>';
            data.services.forEach(svc => {
                const opt = document.createElement('option');
                opt.value = svc;
                opt.textContent = svc;
                serviceSelect.appendChild(opt);
            });
        }
        
        const eventSelect = document.getElementById('logEventFilter');
        if (eventSelect && data.event_names) {
            eventSelect.innerHTML = '<option value="">All Events</option>';
            data.event_names.forEach(evt => {
                const opt = document.createElement('option');
                opt.value = evt;
                opt.textContent = evt;
                eventSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load log filter options:', e);
    }
}

async function loadLogs() {
    if (currentTab !== 'logs') return;

    try {
        const params = new URLSearchParams({ limit: '100' });
        if (logFilters.q) params.set('q', logFilters.q);
        if (logFilters.service_name) params.set('service_name', logFilters.service_name);
        if (logFilters.event_name) params.set('event_name', logFilters.event_name);
        if (logFilters.severity_min != null) params.set('severity_min', logFilters.severity_min);

        const response = await fetch('/api/logs?' + params.toString());
        const data = await response.json();
        logs = data.logs || [];

        renderLogsTable();
    } catch (e) {
        console.error('Failed to load logs:', e);
        document.getElementById('logsBody').innerHTML = 
            '<tr><td colspan="5" class="empty-state">Failed to load logs</td></tr>';
    }
}

function renderLogsTable() {
    const tbody = document.getElementById('logsBody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No logs found. Send OTLP logs to /v1/logs</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr class="trace-row ${l.id === selectedLogId ? 'selected' : ''}" data-testid="log-row" data-log-id="${l.id}" onclick="selectLog('${l.id}', this)">
            <td data-testid="log-time">${formatTime(l.timestamp)}</td>
            <td data-testid="log-severity"><span class="severity-badge severity-${getSeverityClass(l.severity_text)}">${l.severity_text || 'INFO'}</span></td>
            <td data-testid="log-service">${l.service_name ? `<span class="service-badge">${escapeHtml(l.service_name)}</span>` : '-'}</td>
            <td data-testid="log-event">${l.event_name ? `<span class="event-badge">${escapeHtml(l.event_name)}</span>` : '-'}</td>
            <td data-testid="log-body-preview"><span class="log-body-preview">${escapeHtml(l.body || '-')}</span></td>
        </tr>
    `).join('');
}

function getSeverityClass(severityText) {
    if (!severityText) return 'info';
    const s = severityText.toLowerCase();
    if (s.includes('fatal')) return 'fatal';
    if (s.includes('error')) return 'error';
    if (s.includes('warn')) return 'warn';
    if (s.includes('debug')) return 'debug';
    if (s.includes('trace')) return 'trace';
    return 'info';
}

async function selectLog(logId, rowEl) {
    selectedLogId = logId;

    document.querySelectorAll('#logsBody .trace-row').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');

    const titleEl = document.getElementById('logDetailTitle');
    const metaEl = document.getElementById('logDetailMeta');
    const bodyEl = document.getElementById('logBody');
    const attrsEl = document.getElementById('logAttributes');
    const resourceEl = document.getElementById('logResource');

    try {
        const response = await fetch(`/api/logs/${logId}`);
        if (!response.ok) throw new Error('Log not found');
        
        const log = await response.json();

        titleEl.textContent = log.event_name || log.service_name || 'Log';
        metaEl.textContent = [
            log.severity_text,
            log.service_name,
            log.trace_id ? `trace: ${log.trace_id.slice(0, 8)}...` : null
        ].filter(Boolean).join(' · ');

        bodyEl.textContent = log.body || '-';
        attrsEl.textContent = JSON.stringify(log.attributes || {}, null, 2);
        resourceEl.textContent = JSON.stringify(log.resource_attributes || {}, null, 2);
    } catch (e) {
        console.error('Failed to load log:', e);
        titleEl.textContent = 'Error';
        metaEl.textContent = '';
        bodyEl.textContent = 'Failed to load log';
        attrsEl.textContent = '{}';
        resourceEl.textContent = '{}';
    }
}

function handleNewLog(log) {
    if (currentTab !== 'logs') return;
    if (!logMatchesFilters(log)) return;

    if (!logs.find(l => l.id === log.id)) {
        logs.unshift(log);
        if (logs.length > 100) {
            logs.length = 100;
        }
        renderLogsTable();
    }
}

function logMatchesFilters(log) {
    if (logFilters.service_name && log.service_name !== logFilters.service_name) return false;
    if (logFilters.event_name && log.event_name !== logFilters.event_name) return false;
    if (logFilters.q) return false; // Text search requires server
    return true;
}

// ==================== Metrics Functions ====================

function setupMetricFilters() {
    document.getElementById('metricNameFilter')?.addEventListener('change', (e) => {
        metricFilters.name = e.target.value;
        loadMetrics();
    });

    document.getElementById('metricServiceFilter')?.addEventListener('change', (e) => {
        metricFilters.service_name = e.target.value;
        loadMetrics();
    });

    document.getElementById('metricTypeFilter')?.addEventListener('change', (e) => {
        metricFilters.metric_type = e.target.value;
        loadMetrics();
    });

    document.getElementById('clearMetricFilters')?.addEventListener('click', clearMetricFilters);
}

function clearMetricFilters() {
    metricFilters = { name: '', service_name: '', metric_type: '' };
    document.getElementById('metricNameFilter').value = '';
    document.getElementById('metricServiceFilter').value = '';
    document.getElementById('metricTypeFilter').value = '';
    loadMetrics();
}

async function loadMetricFilterOptions() {
    try {
        const response = await fetch('/api/metrics/filters');
        const data = await response.json();
        
        const nameSelect = document.getElementById('metricNameFilter');
        if (nameSelect && data.names) {
            nameSelect.innerHTML = '<option value="">All Metrics</option>';
            data.names.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                nameSelect.appendChild(opt);
            });
        }
        
        const serviceSelect = document.getElementById('metricServiceFilter');
        if (serviceSelect && data.services) {
            serviceSelect.innerHTML = '<option value="">All Services</option>';
            data.services.forEach(svc => {
                const opt = document.createElement('option');
                opt.value = svc;
                opt.textContent = svc;
                serviceSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load metric filter options:', e);
    }
}

async function loadMetricsSummary() {
    if (currentTab !== 'metrics') return;

    try {
        const response = await fetch('/api/metrics?aggregation=summary');
        const data = await response.json();
        metricsSummary = data.summary || [];

        const container = document.getElementById('metricsSummary');
        if (!metricsSummary || metricsSummary.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = '';
        container.innerHTML = metricsSummary.slice(0, 8).map(m => `
            <div class="metric-card">
                <div class="metric-card-header">
                    <span class="metric-card-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
                    <span class="metric-badge metric-${m.metric_type || 'gauge'}">${m.metric_type || 'gauge'}</span>
                </div>
                <div class="metric-card-value">${formatMetricValue(m)}</div>
                <div class="metric-card-meta">
                    <span>${m.data_points} data points</span>
                    <span>${m.service_name || 'unknown'}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load metrics summary:', e);
        document.getElementById('metricsSummary').innerHTML = 
            '<p class="empty-state">Failed to load metrics</p>';
    }
}

function formatMetricValue(m) {
    if (m.sum_int != null && m.sum_int !== 0) {
        return formatNumber(m.sum_int);
    }
    if (m.avg_double != null) {
        return m.avg_double.toFixed(2);
    }
    if (m.max_int != null) {
        return formatNumber(m.max_int);
    }
    return '-';
}

async function loadMetrics() {
    if (currentTab !== 'metrics') return;

    try {
        const params = new URLSearchParams({ limit: '100' });
        if (metricFilters.name) params.set('name', metricFilters.name);
        if (metricFilters.service_name) params.set('service_name', metricFilters.service_name);
        if (metricFilters.metric_type) params.set('metric_type', metricFilters.metric_type);

        const response = await fetch('/api/metrics?' + params.toString());
        const data = await response.json();
        metrics = data.metrics || [];

        renderMetricsTable();
    } catch (e) {
        console.error('Failed to load metrics:', e);
        document.getElementById('metricsBody').innerHTML = 
            '<tr><td colspan="5" class="empty-state">Failed to load metrics</td></tr>';
    }
}

function renderMetricsTable() {
    const tbody = document.getElementById('metricsBody');
    if (!tbody) return;

    if (!metrics || metrics.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No metrics found. Send OTLP metrics to /v1/metrics</td></tr>`;
        return;
    }

    tbody.innerHTML = metrics.map(m => `
        <tr class="trace-row">
            <td>${formatTime(m.timestamp)}</td>
            <td><span class="metric-badge metric-${m.metric_type || 'gauge'}">${m.metric_type || 'gauge'}</span></td>
            <td class="metric-name-cell">${escapeHtml(m.name)}</td>
            <td class="metric-value">${m.value_int != null ? formatNumber(m.value_int) : (m.value_double != null ? m.value_double.toFixed(2) : '-')}</td>
            <td>${m.service_name ? `<span class="service-badge">${escapeHtml(m.service_name)}</span>` : '-'}</td>
        </tr>
    `).join('');
}

function handleNewMetric(metric) {
    if (currentTab !== 'metrics') return;
    
    if (!metrics.find(m => m.id === metric.id)) {
        metrics.unshift(metric);
        if (metrics.length > 100) {
            metrics.length = 100;
        }
        renderMetricsTable();
    }
}

// ==================== Timeline Functions ====================

function setupTimelineFilters() {
    let searchTimeout;
    document.getElementById('timelineSearchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            timelineFilters.q = e.target.value;
            loadTimeline();
        }, 300);
    });

    document.getElementById('toolFilter')?.addEventListener('change', (e) => {
        timelineFilters.tool = e.target.value;
        loadTimeline();
    });

    document.getElementById('timelineTypeFilter')?.addEventListener('change', (e) => {
        timelineFilters.type = e.target.value;
        loadTimeline();
    });

    document.getElementById('timelineDateFilter')?.addEventListener('change', (e) => {
        timelineFilters.dateRange = e.target.value;
        applyTimelineDateRange(timelineFilters.dateRange);
        loadTimeline();
    });

    document.getElementById('clearTimelineFilters')?.addEventListener('click', clearTimelineFilters);
}

function applyTimelineDateRange(range) {
    const now = Date.now();
    switch (range) {
        case '1h': timelineFilters.date_from = now - 3600000; break;
        case '24h': timelineFilters.date_from = now - 86400000; break;
        case '7d': timelineFilters.date_from = now - 604800000; break;
        default: timelineFilters.date_from = null;
    }
}

function clearTimelineFilters() {
    timelineFilters = { q: '', tool: '', type: '', dateRange: '', date_from: null };
    document.getElementById('timelineSearchInput').value = '';
    document.getElementById('toolFilter').value = '';
    document.getElementById('timelineTypeFilter').value = '';
    document.getElementById('timelineDateFilter').value = '';
    loadTimeline();
}

async function loadTimeline() {
    if (currentTab !== 'timeline') return;

    try {
        // Load traces and logs in parallel
        const [tracesRes, logsRes] = await Promise.all([
            fetch('/api/traces?limit=50'),
            fetch('/api/logs?limit=50')
        ]);

        const tracesData = await tracesRes.json();
        const logsData = await logsRes.json();

        // Combine and normalize
        const traceItems = (tracesData || []).map(t => ({
            id: t.id,
            type: 'trace',
            timestamp: t.timestamp,
            title: t.span_name || t.model || 'Trace',
            body: t.model ? `Model: ${t.model}` : '',
            tool: detectTool(t),
            tokens: t.total_tokens,
            cost: t.estimated_cost,
            duration: t.duration_ms,
            status: t.status,
            trace_id: t.trace_id || t.id,
            raw: t
        }));

        const logItems = (logsData.logs || []).map(l => ({
            id: l.id,
            type: 'log',
            timestamp: l.timestamp,
            title: l.event_name || l.service_name || 'Log',
            body: l.body || '',
            tool: detectToolFromLog(l),
            severity: l.severity_text,
            trace_id: l.trace_id,
            raw: l
        }));

        // Combine and sort by timestamp
        timelineItems = [...traceItems, ...logItems]
            .sort((a, b) => b.timestamp - a.timestamp);

        // Apply filters
        let filtered = timelineItems;

        if (timelineFilters.tool) {
            filtered = filtered.filter(i => i.tool === timelineFilters.tool);
        }

        if (timelineFilters.type) {
            filtered = filtered.filter(i => i.type === timelineFilters.type);
        }

        if (timelineFilters.date_from) {
            filtered = filtered.filter(i => i.timestamp >= timelineFilters.date_from);
        }

        if (timelineFilters.q) {
            const q = timelineFilters.q.toLowerCase();
            filtered = filtered.filter(i => 
                (i.title && i.title.toLowerCase().includes(q)) ||
                (i.body && i.body.toLowerCase().includes(q))
            );
        }

        renderTimeline(filtered.slice(0, 100));
    } catch (e) {
        console.error('Failed to load timeline:', e);
        document.getElementById('timelineList').innerHTML = 
            '<div class="empty-state">Failed to load timeline</div>';
    }
}

function detectTool(trace) {
    const provider = (trace.provider || '').toLowerCase();
    const serviceName = (trace.service_name || '').toLowerCase();
    
    if (provider.includes('anthropic-passthrough') || serviceName.includes('claude')) {
        return 'claude-code';
    }
    if (serviceName.includes('codex') || serviceName.includes('openai-codex')) {
        return 'codex-cli';
    }
    if (provider.includes('gemini-passthrough') || serviceName.includes('gemini')) {
        return 'gemini-cli';
    }
    if (serviceName.includes('aider')) {
        return 'aider';
    }
    return 'proxy';
}

function detectToolFromLog(log) {
    const serviceName = (log.service_name || '').toLowerCase();
    const eventName = (log.event_name || '').toLowerCase();
    
    if (serviceName.includes('claude') || eventName.includes('claude')) {
        return 'claude-code';
    }
    if (serviceName.includes('codex') || eventName.includes('codex')) {
        return 'codex-cli';
    }
    if (serviceName.includes('gemini') || eventName.includes('gemini')) {
        return 'gemini-cli';
    }
    if (serviceName.includes('aider')) {
        return 'aider';
    }
    return 'proxy';
}

function getToolIcon(tool) {
    switch (tool) {
        case 'claude-code': return '🟣';
        case 'codex-cli': return '🟢';
        case 'gemini-cli': return '🔵';
        case 'aider': return '🟠';
        default: return '⚪';
    }
}

function getToolLabel(tool) {
    switch (tool) {
        case 'claude-code': return 'Claude';
        case 'codex-cli': return 'Codex';
        case 'gemini-cli': return 'Gemini';
        case 'aider': return 'Aider';
        default: return 'Proxy';
    }
}

function renderTimeline(items) {
    const container = document.getElementById('timelineList');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty-state">No activity yet. Run an AI CLI tool to see the timeline.</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="timeline-item ${selectedTimelineItem?.id === item.id ? 'selected' : ''}" 
             onclick="selectTimelineItem('${item.id}', '${item.type}', this)">
            <div class="timeline-item-icon tool-${item.tool}">
                ${getToolIcon(item.tool)}
            </div>
            <div class="timeline-item-content">
                <div class="timeline-item-header">
                    <span class="type-badge type-${item.type}">${item.type}</span>
                    <span class="timeline-item-title">${escapeHtml(item.title)}</span>
                    <span class="timeline-item-time">${formatTime(item.timestamp)}</span>
                </div>
                <div class="timeline-item-body">${escapeHtml(item.body)}</div>
                <div class="timeline-item-meta">
                    <span class="tool-badge tool-${item.tool}">${getToolLabel(item.tool)}</span>
                    ${item.tokens ? `<span>${formatNumber(item.tokens)} tokens</span>` : ''}
                    ${item.cost ? `<span>$${item.cost.toFixed(4)}</span>` : ''}
                    ${item.duration ? `<span>${item.duration}ms</span>` : ''}
                    ${item.severity ? `<span class="severity-badge severity-${getSeverityClass(item.severity)}">${item.severity}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function selectTimelineItem(id, type, rowEl) {
    selectedTimelineItem = { id, type };

    document.querySelectorAll('.timeline-item').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');

    const titleEl = document.getElementById('timelineDetailTitle');
    const metaEl = document.getElementById('timelineDetailMeta');
    const dataEl = document.getElementById('timelineDetailData');
    const relatedSection = document.getElementById('relatedLogsSection');
    const relatedLogsEl = document.getElementById('relatedLogs');

    try {
        if (type === 'trace') {
            const response = await fetch(`/api/traces/${id}`);
            const data = await response.json();
            const t = data.trace || data;

            titleEl.textContent = t.span_name || t.model || 'Trace';
            metaEl.textContent = [
                t.provider,
                t.duration_ms ? `${t.duration_ms}ms` : null,
                t.total_tokens ? `${t.total_tokens} tokens` : null
            ].filter(Boolean).join(' · ');

            dataEl.textContent = JSON.stringify(t, null, 2);

            // Load related logs
            if (t.trace_id) {
                const logsRes = await fetch(`/api/logs?trace_id=${t.trace_id}&limit=10`);
                const logsData = await logsRes.json();
                const relatedLogs = logsData.logs || [];

                if (relatedLogs.length > 0) {
                    relatedSection.style.display = 'block';
                    relatedLogsEl.innerHTML = relatedLogs.map(l => `
                        <div class="related-log-item">
                            <div class="related-log-header">
                                <span class="severity-badge severity-${getSeverityClass(l.severity_text)}">${l.severity_text || 'INFO'}</span>
                                <span>${formatTime(l.timestamp)}</span>
                            </div>
                            <div class="related-log-body">${escapeHtml(l.body || '-')}</div>
                        </div>
                    `).join('');
                } else {
                    relatedSection.style.display = 'none';
                }
            } else {
                relatedSection.style.display = 'none';
            }
        } else if (type === 'log') {
            const response = await fetch(`/api/logs/${id}`);
            const log = await response.json();

            titleEl.textContent = log.event_name || log.service_name || 'Log';
            metaEl.textContent = [
                log.severity_text,
                log.service_name,
                log.trace_id ? `trace: ${log.trace_id.slice(0, 8)}...` : null
            ].filter(Boolean).join(' · ');

            dataEl.textContent = JSON.stringify(log, null, 2);
            relatedSection.style.display = 'none';
        }
    } catch (e) {
        console.error('Failed to load timeline item:', e);
        titleEl.textContent = 'Error';
        metaEl.textContent = '';
        dataEl.textContent = 'Failed to load';
        relatedSection.style.display = 'none';
    }
}

function handleTimelineUpdate(item) {
    if (currentTab !== 'timeline') return;
    loadTimeline(); // Reload for now - could optimize later
}

// Utils
function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Extract input/output from span - handles both SDK spans and proxy traces
function extractIO(spanLike) {
    // 1. Prefer explicit SDK span fields
    let input = spanLike.input ?? null;
    let output = spanLike.output ?? null;

    const reqBody = spanLike.request_body || spanLike.requestBody || spanLike.request?.body || {};
    const resBody = spanLike.response_body || spanLike.responseBody || spanLike.response?.body || {};

    // 2. If missing, try OpenAI-style / proxy request body
    if (input == null) {
        if (Array.isArray(reqBody.messages)) {
            input = reqBody.messages;
        } else if (reqBody.prompt != null) {
            input = reqBody.prompt;
        } else if (reqBody.input != null) {
            input = reqBody.input;
        } else if (reqBody.contents != null) {
            // Gemini format
            input = reqBody.contents;
        }
    }

    // 3. If missing, try OpenAI-style / proxy response body
    if (output == null) {
        if (Array.isArray(resBody.choices) && resBody.choices.length > 0) {
            const contents = resBody.choices
                .map(c => (c.message && c.message.content) || c.text || null)
                .filter(Boolean);

            if (contents.length === 1) {
                output = contents[0];
            } else if (contents.length > 1) {
                output = contents;
            }
        } else if (resBody.output != null) {
            output = resBody.output;
        } else if (resBody.output_text != null) {
            // OpenAI Responses API
            output = resBody.output_text;
        }
    }

    return { input, output };
}

// WebSocket for real-time updates
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/ws';

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[LLMFlow] WebSocket connected');
            wsRetryDelay = 1000; // Reset backoff
            updateConnectionStatus(true);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleWsMessage(msg);
            } catch (e) {
                console.error('[LLMFlow] Invalid WS message', e);
            }
        };

        ws.onclose = () => {
            console.log('[LLMFlow] WebSocket closed, reconnecting...');
            updateConnectionStatus(false);
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[LLMFlow] WebSocket error', err);
            updateConnectionStatus(false);
            ws.close();
        };
    } catch (e) {
        console.error('[LLMFlow] Failed to create WebSocket', e);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    setTimeout(() => {
        wsRetryDelay = Math.min(wsRetryDelay * 2, WS_MAX_RETRY);
        initWebSocket();
    }, wsRetryDelay);
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        indicator.className = connected ? 'status-dot connected' : 'status-dot disconnected';
        indicator.title = connected ? 'Real-time updates active' : 'Reconnecting...';
    }
}

function handleWsMessage(msg) {
    switch (msg.type) {
        case 'new_span':
            handleNewSpan(msg.payload);
            break;
        case 'new_trace':
            // Could highlight or scroll to top
            break;
        case 'new_log':
            handleNewLog(msg.payload);
            break;
        case 'new_metric':
            handleNewMetric(msg.payload);
            break;
        case 'stats_update':
            handleStatsUpdate(msg.payload);
            break;
        case 'hello':
            console.log('[LLMFlow] Server hello:', msg.time);
            break;
        default:
            break;
    }
}

function handleStatsUpdate(newStats) {
    stats = newStats;
    const elTotalRequests = document.getElementById('totalRequests');
    if (!elTotalRequests) return;

    elTotalRequests.textContent = stats.total_requests || 0;
    document.getElementById('totalTokens').textContent = formatNumber(stats.total_tokens || 0);
    document.getElementById('totalCost').textContent = '$' + (stats.total_cost || 0).toFixed(2);
    document.getElementById('avgLatency').textContent = Math.round(stats.avg_duration || 0) + 'ms';

    // Update models tab if visible
    if (currentTab === 'models') {
        loadModelStats();
    }
}

function handleNewSpan(span) {
    // Only update if on traces tab and span matches filters
    if (currentTab !== 'traces') return;
    if (!spanMatchesFilters(span)) return;

    // Prepend if not already in list
    if (!traces.find(t => t.id === span.id)) {
        traces.unshift(span);
        if (traces.length > 100) {
            traces.length = 100;
        }
        renderTracesTable();
    }
}

function spanMatchesFilters(span) {
    if (filters.model && span.model !== filters.model) return false;

    if (filters.status) {
        const status = span.status || 200;
        if (filters.status === 'error' && status < 400) return false;
        if (filters.status === 'success' && status >= 400) return false;
    }

    if (filters.date_from && span.timestamp < filters.date_from) return false;
    if (filters.date_to && span.timestamp > filters.date_to) return false;

    // Text search requires server - skip live updates for q filter
    if (filters.q) return false;

    return true;
}

function renderTracesTable() {
    const tbody = document.getElementById('tracesBody');
    if (!tbody) return;

    if (!traces || traces.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No traces found. Run: npm run demo</td></tr>`;
        return;
    }

    tbody.innerHTML = traces.map(t => `
        <tr class="trace-row ${t.id === selectedTraceId ? 'selected' : ''}" data-testid="trace-row" data-trace-id="${t.id}" onclick="selectTrace('${t.id}', this)">
            <td data-testid="trace-time">${formatTime(t.timestamp)}</td>
            <td data-testid="trace-type"><span class="span-badge span-${t.span_type || 'llm'}">${t.span_type || 'llm'}</span></td>
            <td data-testid="trace-name">${escapeHtml(t.span_name || '-')}</td>
            <td data-testid="trace-model">${t.model ? `<span class="model-badge">${escapeHtml(t.model)}</span>` : '-'}</td>
            <td data-testid="trace-tokens">${formatNumber(t.total_tokens || 0)}</td>
            <td data-testid="trace-cost">$${(t.estimated_cost || 0).toFixed(4)}</td>
            <td data-testid="trace-latency">${t.duration_ms || 0}ms</td>
            <td data-testid="trace-status" class="${(t.status || 200) < 400 ? 'status-success' : 'status-error'}">${t.status || 200}</td>
        </tr>
    `).join('');
}

// ==================== Analytics Functions ====================

let analyticsDays = 30;

function setupAnalyticsFilters() {
    document.getElementById('analyticsDaysFilter')?.addEventListener('change', (e) => {
        analyticsDays = parseInt(e.target.value) || 30;
        loadAnalytics();
    });

    document.getElementById('refreshAnalytics')?.addEventListener('click', loadAnalytics);
}

async function loadAnalytics() {
    if (currentTab !== 'analytics') return;

    try {
        const [trendsRes, toolRes, modelRes, dailyRes] = await Promise.all([
            fetch(`/api/analytics/token-trends?interval=day&days=${analyticsDays}`),
            fetch(`/api/analytics/cost-by-tool?days=${analyticsDays}`),
            fetch(`/api/analytics/cost-by-model?days=${analyticsDays}`),
            fetch(`/api/analytics/daily?days=${analyticsDays}`)
        ]);

        const [trendsData, toolData, modelData, dailyData] = await Promise.all([
            trendsRes.json(),
            toolRes.json(),
            modelRes.json(),
            dailyRes.json()
        ]);

        renderTokenTrendsChart(trendsData.trends || []);
        renderCostByToolChart(toolData.by_tool || []);
        renderCostByModelChart(modelData.by_model || []);
        renderDailySummary(dailyData.daily || []);
    } catch (e) {
        console.error('Failed to load analytics:', e);
        const setError = (id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="empty-state">Failed to load data.</p>';
        };
        setError('tokenTrendsChart');
        setError('costByToolChart');
        setError('costByModelChart');
        setError('dailySummaryTable');
    }
}

function renderTokenTrendsChart(trends) {
    const container = document.getElementById('tokenTrendsChart');
    if (!container) return;

    if (!trends || trends.length === 0) {
        container.innerHTML = '<p class="empty-state">No data yet. Generate some traces to see trends.</p>';
        return;
    }

    const maxTokens = Math.max(...trends.map(t => t.total_tokens || 0));
    const barWidth = Math.max(8, Math.floor((container.clientWidth - 60) / trends.length) - 2);

    container.innerHTML = `
        <div class="bar-chart">
            <div class="bar-chart-bars">
                ${trends.map((t, i) => {
                    const height = maxTokens > 0 ? ((t.total_tokens || 0) / maxTokens * 100) : 0;
                    const promptHeight = maxTokens > 0 ? ((t.prompt_tokens || 0) / maxTokens * 100) : 0;
                    return `
                        <div class="bar-group" style="width: ${barWidth}px" title="${t.label}\nTokens: ${formatNumber(t.total_tokens || 0)}\nCost: $${(t.total_cost || 0).toFixed(4)}">
                            <div class="bar bar-total" style="height: ${height}%"></div>
                            <div class="bar bar-prompt" style="height: ${promptHeight}%"></div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="bar-chart-legend">
                <span class="legend-item"><span class="legend-dot legend-total"></span>Total</span>
                <span class="legend-item"><span class="legend-dot legend-prompt"></span>Prompt</span>
            </div>
        </div>
    `;
}

function renderCostByToolChart(byTool) {
    const container = document.getElementById('costByToolChart');
    if (!container) return;

    if (!byTool || byTool.length === 0) {
        container.innerHTML = '<p class="empty-state">No data yet.</p>';
        return;
    }

    const totalCost = byTool.reduce((sum, t) => sum + (t.total_cost || 0), 0);

    container.innerHTML = `
        <div class="horizontal-bar-chart">
            ${byTool.slice(0, 8).map(t => {
                const toolName = getToolDisplayName(t.provider, t.service_name);
                const percentage = totalCost > 0 ? ((t.total_cost || 0) / totalCost * 100) : 0;
                const toolClass = getToolClass(t.provider, t.service_name);
                return `
                    <div class="h-bar-row">
                        <div class="h-bar-label">
                            <span class="tool-badge ${toolClass}">${escapeHtml(toolName)}</span>
                        </div>
                        <div class="h-bar-track">
                            <div class="h-bar-fill ${toolClass}" style="width: ${percentage}%"></div>
                        </div>
                        <div class="h-bar-value">$${(t.total_cost || 0).toFixed(2)}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="chart-total">Total: $${totalCost.toFixed(2)}</div>
    `;
}

function renderCostByModelChart(byModel) {
    const container = document.getElementById('costByModelChart');
    if (!container) return;

    if (!byModel || byModel.length === 0) {
        container.innerHTML = '<p class="empty-state">No data yet.</p>';
        return;
    }

    const totalCost = byModel.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    container.innerHTML = `
        <div class="horizontal-bar-chart">
            ${byModel.slice(0, 8).map(m => {
                const percentage = totalCost > 0 ? ((m.total_cost || 0) / totalCost * 100) : 0;
                return `
                    <div class="h-bar-row">
                        <div class="h-bar-label">
                            <span class="model-badge">${escapeHtml(m.model || 'unknown')}</span>
                        </div>
                        <div class="h-bar-track">
                            <div class="h-bar-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="h-bar-value">$${(m.total_cost || 0).toFixed(2)}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="chart-total">Total: $${totalCost.toFixed(2)}</div>
    `;
}

function renderDailySummary(daily) {
    const container = document.getElementById('dailySummaryTable');
    if (!container) return;

    if (!daily || daily.length === 0) {
        container.innerHTML = '<p class="empty-state">No data yet.</p>';
        return;
    }

    const reversed = [...daily].reverse();

    container.innerHTML = `
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                </tr>
            </thead>
            <tbody>
                ${reversed.slice(0, 14).map(d => `
                    <tr>
                        <td>${d.date}</td>
                        <td>${formatNumber(d.requests || 0)}</td>
                        <td>${formatNumber(d.tokens || 0)}</td>
                        <td>$${(d.cost || 0).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getToolDisplayName(provider, serviceName) {
    const p = (provider || '').toLowerCase();
    const s = (serviceName || '').toLowerCase();

    if (p.includes('anthropic') || s.includes('claude')) return 'Claude Code';
    if (s.includes('codex') || p.includes('codex')) return 'Codex CLI';
    if (p.includes('gemini') || s.includes('gemini')) return 'Gemini CLI';
    if (s.includes('aider')) return 'Aider';
    if (p.includes('openai')) return 'OpenAI';
    if (p.includes('ollama')) return 'Ollama';

    return provider || serviceName || 'Other';
}

function getToolClass(provider, serviceName) {
    const p = (provider || '').toLowerCase();
    const s = (serviceName || '').toLowerCase();

    if (p.includes('anthropic') || s.includes('claude')) return 'tool-claude-code';
    if (s.includes('codex') || p.includes('codex')) return 'tool-codex-cli';
    if (p.includes('gemini') || s.includes('gemini')) return 'tool-gemini-cli';
    if (s.includes('aider')) return 'tool-aider';

    return 'tool-proxy';
}


