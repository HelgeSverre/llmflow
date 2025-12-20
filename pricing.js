const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const PRICING_URL = process.env.PRICING_URL || DEFAULT_PRICING_URL;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');

const fallbackPricingPath = path.join(__dirname, 'pricing.fallback.json');

let pricingData = {};
let lastFetchTime = 0;

function loadFallbackPricing() {
    try {
        if (fs.existsSync(fallbackPricingPath)) {
            pricingData = JSON.parse(fs.readFileSync(fallbackPricingPath, 'utf8'));
        }
    } catch (err) {
        // Silent fail, will use empty pricing
    }
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 10000 }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function loadPricing() {
    try {
        const json = await fetchJson(PRICING_URL);
        pricingData = json;
        lastFetchTime = Date.now();
        if (VERBOSE) {
            console.log(`\x1b[2m[pricing] Loaded ${Object.keys(pricingData).length} models\x1b[0m`);
        }
    } catch (err) {
        if (Object.keys(pricingData).length === 0) {
            loadFallbackPricing();
        }
    }
}

function normalizeModelName(model) {
    if (!model) return null;
    
    let normalized = model.toLowerCase().trim();
    
    // Remove common prefixes
    const prefixes = ['openai/', 'anthropic/', 'google/', 'azure/', 'together/'];
    for (const prefix of prefixes) {
        if (normalized.startsWith(prefix)) {
            normalized = normalized.slice(prefix.length);
            break;
        }
    }
    
    return normalized;
}

function findModelPricing(modelName) {
    if (!modelName || !pricingData) return null;
    
    const normalized = normalizeModelName(modelName);
    if (!normalized) return null;
    
    // Try exact match first
    if (pricingData[normalized]) {
        return pricingData[normalized];
    }
    
    // Try with provider prefixes
    const providers = ['openai/', 'azure/', ''];
    for (const prefix of providers) {
        const key = prefix + normalized;
        if (pricingData[key]) {
            return pricingData[key];
        }
    }
    
    // Try partial match for versioned models (gpt-4-0125-preview -> gpt-4)
    const baseName = normalized.split('-').slice(0, 2).join('-');
    for (const key of Object.keys(pricingData)) {
        if (key.startsWith(baseName) || key.includes(normalized)) {
            return pricingData[key];
        }
    }
    
    return null;
}

function calculateCost(model, promptTokens, completionTokens) {
    const pricing = findModelPricing(model);
    
    if (!pricing) {
        // Fallback to default pricing for unknown models
        return ((promptTokens * 0.001) + (completionTokens * 0.002)) / 1000;
    }
    
    // LiteLLM format: input_cost_per_token, output_cost_per_token (per token, not per 1k)
    const inputCost = pricing.input_cost_per_token || 0;
    const outputCost = pricing.output_cost_per_token || pricing.input_cost_per_token || 0;
    
    return (promptTokens * inputCost) + (completionTokens * outputCost);
}

function getPricingInfo(model) {
    return findModelPricing(model);
}

function getPricingStats() {
    return {
        modelCount: Object.keys(pricingData).length,
        lastFetchTime,
        source: PRICING_URL
    };
}

// Initialize pricing
loadFallbackPricing();
loadPricing();

// Refresh pricing periodically
setInterval(loadPricing, REFRESH_INTERVAL_MS);

module.exports = {
    calculateCost,
    getPricingInfo,
    getPricingStats,
    loadPricing
};
