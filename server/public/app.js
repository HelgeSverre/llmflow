// State
let currentTab = 'traces';
let traces = [];
let stats = {};

// Initialize function
function init() {
    console.log("[LLMFlow] Dashboard - initialized");

    loadStats();
    loadTraces();

    setInterval(loadStats, 10000); // Refresh stats every 10 seconds
    setInterval(loadTraces, 5000); // Refresh traces every 5 seconds
}

// Initialize when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already loaded
    init();
}

// Tab switching
function showTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'traces') {
        document.getElementById('tracesTab').classList.add('active');
        loadTraces();
    } else if (tab === 'models') {
        document.getElementById('modelsTab').classList.add('active');
        loadModelStats();
    }
}

// Load stats
async function loadStats() {
    try {
        console.log("[LLMFlow] Loading stats...");

        const response = await fetch('/api/stats');
        stats = await response.json();

        // Update stat displays
        document.getElementById('totalRequests').textContent = stats.total_requests || 0;
        document.getElementById('totalTokens').textContent = formatNumber(stats.total_tokens || 0);
        document.getElementById('totalCost').textContent = '$' + (stats.total_cost || 0).toFixed(4);
        document.getElementById('avgLatency').textContent = Math.round(stats.avg_duration || 0) + 'ms';
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load traces
async function loadTraces() {
    if (currentTab !== 'traces') return;

    try {
        console.log("[LLMFlow] Loading traces...");

        const response = await fetch('/api/traces?limit=50');
        traces = await response.json();

        const tbody = document.getElementById('tracesBody');

        if (traces.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">No traces yet. Make an API call to see data.</td></tr>';
            return;
        }

        tbody.innerHTML = traces.map(trace => `
            <tr>
                <td>${formatTime(trace.timestamp)}</td>
                <td>${trace.model}</td>
                <td>${formatNumber(trace.total_tokens)}</td>
                <td>$${trace.estimated_cost.toFixed(6)}</td>
                <td>${trace.duration_ms}ms</td>
                <td class="${trace.status < 400 ? 'status-success' : 'status-error'}">
                    ${trace.status}
                </td>
                <td>
                    <button class="view-btn" onclick="viewTrace('${trace.id}')">View</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load traces:', error);
        document.getElementById('tracesBody').innerHTML =
            '<tr><td colspan="7" class="loading">Failed to load traces</td></tr>';
    }
}

// Load model stats
async function loadModelStats() {
    if (currentTab !== 'models') return;

    try {
        const container = document.getElementById('modelStats');

        if (!stats.models || stats.models.length === 0) {
            container.innerHTML = '<p class="loading">No model usage data yet.</p>';
            return;
        }

        container.innerHTML = stats.models.map(model => `
            <div class="model-card">
                <h4>${model.model}</h4>
                <div class="model-stat">
                    <span class="model-stat-label">Requests:</span>
                    <span class="model-stat-value">${model.count}</span>
                </div>
                <div class="model-stat">
                    <span class="model-stat-label">Tokens:</span>
                    <span class="model-stat-value">${formatNumber(model.tokens)}</span>
                </div>
                <div class="model-stat">
                    <span class="model-stat-label">Cost:</span>
                    <span class="model-stat-value">$${model.cost.toFixed(4)}</span>
                </div>
                <div class="model-stat">
                    <span class="model-stat-label">Avg Cost:</span>
                    <span class="model-stat-value">$${(model.cost / model.count).toFixed(4)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load model stats:', error);
    }
}

// View trace details
async function viewTrace(traceId) {
    try {
        const response = await fetch(`/api/traces/${traceId}`);
        const data = await response.json();

        // Format trace info
        const traceInfo = {
            ID: data.trace.id,
            Timestamp: new Date(data.trace.timestamp).toLocaleString(),
            Model: data.trace.model,
            'Duration (ms)': data.trace.duration_ms,
            'Prompt Tokens': data.trace.prompt_tokens,
            'Completion Tokens': data.trace.completion_tokens,
            'Total Tokens': data.trace.total_tokens,
            'Estimated Cost': '$' + data.trace.estimated_cost.toFixed(6),
            Status: data.trace.status,
            Error: data.trace.error || 'None'
        };

        document.getElementById('traceInfo').textContent = JSON.stringify(traceInfo, null, 2);

        // Format request
        if (data.request) {
            const requestData = {
                method: data.request.method,
                path: data.request.path,
                headers: data.request.headers,
                body: data.request.body
            };
            document.getElementById('requestDetails').textContent = JSON.stringify(requestData, null, 2);
        }

        // Format response
        if (data.response) {
            const responseData = {
                status: data.response.status,
                headers: data.response.headers,
                body: data.response.body
            };
            document.getElementById('responseDetails').textContent = JSON.stringify(responseData, null, 2);
        }

        // Show modal
        document.getElementById('traceModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to load trace details:', error);
        alert('Failed to load trace details');
    }
}

// Close modal
function closeModal() {
    document.getElementById('traceModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('traceModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Utility functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        return Math.floor(diff / 60000) + 'm ago';
    } else if (diff < 86400000) { // Less than 1 day
        return Math.floor(diff / 3600000) + 'h ago';
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}