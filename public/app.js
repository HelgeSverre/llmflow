// State
let currentTab = 'traces';
let traces = [];
let stats = {};
let selectedTraceId = null;
let filters = {
    q: '',
    model: '',
    status: '',
    dateRange: '',
    date_from: null,
    date_to: null
};

// WebSocket state
let ws = null;
let wsRetryDelay = 1000;
const WS_MAX_RETRY = 30000;

// Initialize
function init() {
    initFiltersFromUrl();
    setupFilters();
    setupKeyboardShortcuts();
    loadModels();
    loadStats();
    loadTraces();
    initWebSocket();

    // Polling as fallback (less frequent since we have WebSocket)
    setInterval(loadStats, 30000);
    setInterval(loadTraces, 30000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        if (e.key === 'Escape') {
            document.activeElement?.blur();
        }
    });
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
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'traces') {
        document.getElementById('tracesTab').classList.add('active');
        loadTraces();
    } else if (tab === 'models') {
        document.getElementById('modelsTab').classList.add('active');
        loadModelStats();
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
            <tr class="trace-row ${t.id === selectedTraceId ? 'selected' : ''}" onclick="selectTrace('${t.id}', this)">
                <td>${formatTime(t.timestamp)}</td>
                <td><span class="span-badge span-${t.span_type || 'llm'}">${t.span_type || 'llm'}</span></td>
                <td>${escapeHtml(t.span_name || '-')}</td>
                <td>${t.model ? `<span class="model-badge">${escapeHtml(t.model)}</span>` : '-'}</td>
                <td>${formatNumber(t.total_tokens || 0)}</td>
                <td>$${(t.estimated_cost || 0).toFixed(4)}</td>
                <td>${t.duration_ms || 0}ms</td>
                <td class="${(t.status || 200) < 400 ? 'status-success' : 'status-error'}">${t.status || 200}</td>
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
            ioEl.textContent = JSON.stringify({
                input: firstSpan?.input || null,
                output: firstSpan?.output || null
            }, null, 2);
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
            ioEl.textContent = JSON.stringify({
                request: data.request?.body,
                response: data.response?.body
            }, null, 2);
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
        <tr class="trace-row ${t.id === selectedTraceId ? 'selected' : ''}" onclick="selectTrace('${t.id}', this)">
            <td>${formatTime(t.timestamp)}</td>
            <td><span class="span-badge span-${t.span_type || 'llm'}">${t.span_type || 'llm'}</span></td>
            <td>${escapeHtml(t.span_name || '-')}</td>
            <td>${t.model ? `<span class="model-badge">${escapeHtml(t.model)}</span>` : '-'}</td>
            <td>${formatNumber(t.total_tokens || 0)}</td>
            <td>$${(t.estimated_cost || 0).toFixed(4)}</td>
            <td>${t.duration_ms || 0}ms</td>
            <td class="${(t.status || 200) < 400 ? 'status-success' : 'status-error'}">${t.status || 200}</td>
        </tr>
    `).join('');
}
