#!/bin/bash
#
# Run Claude Code with OpenTelemetry observability
#
# IMPORTANT: Claude Code exports OTEL metrics and logs, NOT traces.
# LLMFlow currently only supports trace ingestion (/v1/traces).
#
# This script demonstrates the OTEL configuration for Claude Code.
# To fully utilize it, you'd need:
# - An OTEL collector that supports metrics/logs (e.g., Grafana Cloud, SigNoz)
# - Or extend LLMFlow to support /v1/metrics and /v1/logs endpoints
#
# For now, this script runs Claude Code with console telemetry output
# so you can see what metrics/logs Claude Code exports.
#
# Usage:
#   ./run-with-llmflow.sh                    # Interactive mode with console telemetry
#   ./run-with-llmflow.sh "your prompt"      # Execute a single prompt
#   ./run-with-llmflow.sh --print            # Print mode (just show response)
#
# Prerequisites:
#   1. Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
#   2. Authenticated with Anthropic (via `claude auth` or ANTHROPIC_API_KEY)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "  Claude Code + OpenTelemetry Demo"
echo -e "==========================================${NC}"
echo ""

# Check if claude is installed
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found${NC}"
    echo "Install with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Load .env from project root if it exists (for ANTHROPIC_API_KEY)
if [ -f "$ROOT_DIR/.env" ]; then
    ANTHROPIC_KEY=$(grep -E "^ANTHROPIC_API_KEY=" "$ROOT_DIR/.env" | cut -d'=' -f2-)
    if [ -n "$ANTHROPIC_KEY" ]; then
        export ANTHROPIC_API_KEY="$ANTHROPIC_KEY"
        echo -e "${GREEN}✓ Loaded ANTHROPIC_API_KEY from .env${NC}"
    fi
fi

# Check if we have an API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}Note: ANTHROPIC_API_KEY not set${NC}"
    echo "  Either add ANTHROPIC_API_KEY to $ROOT_DIR/.env"
    echo "  Or run: claude auth login"
    echo ""
fi

# Create isolated config directory for this session
ISOLATED_CONFIG_DIR="${SCRIPT_DIR}/.claude-config"
mkdir -p "$ISOLATED_CONFIG_DIR"

echo -e "${GREEN}✓ OpenTelemetry telemetry enabled${NC}"
echo -e "${GREEN}✓ Isolated config directory${NC}"
echo -e "  Config → ${ISOLATED_CONFIG_DIR}"
echo ""

# Set environment variables for Claude Code
export CLAUDE_CONFIG_DIR="$ISOLATED_CONFIG_DIR"

# Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY="1"

# Use console exporter for debugging (shows what Claude Code exports)
# For production, you'd use: OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER="${OTEL_METRICS_EXPORTER:-console}"
export OTEL_LOGS_EXPORTER="${OTEL_LOGS_EXPORTER:-console}"

# For OTLP export (requires a collector that supports metrics/logs):
# export OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
# export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"

# Faster export intervals for debugging
export OTEL_METRIC_EXPORT_INTERVAL="${OTEL_METRIC_EXPORT_INTERVAL:-10000}"
export OTEL_LOGS_EXPORT_INTERVAL="${OTEL_LOGS_EXPORT_INTERVAL:-5000}"

echo -e "${BLUE}Environment:${NC}"
echo "  CLAUDE_CONFIG_DIR=$CLAUDE_CONFIG_DIR"
echo "  CLAUDE_CODE_ENABLE_TELEMETRY=$CLAUDE_CODE_ENABLE_TELEMETRY"
echo "  OTEL_METRICS_EXPORTER=$OTEL_METRICS_EXPORTER"
echo "  OTEL_LOGS_EXPORTER=$OTEL_LOGS_EXPORTER"
echo ""

echo -e "${YELLOW}Note: Claude Code exports metrics/logs via OTEL, not traces.${NC}"
echo "      LLMFlow's /v1/traces endpoint only accepts traces."
echo "      Use 'console' exporter to see what Claude exports."
echo ""

# Run Claude Code with the provided arguments
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}Starting Claude Code in interactive mode...${NC}"
    echo ""
    exec claude
else
    echo -e "${YELLOW}Executing prompt...${NC}"
    echo ""
    claude "$@"
    echo ""
    echo -e "${GREEN}Done!${NC}"
fi
