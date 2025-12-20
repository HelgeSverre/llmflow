#!/bin/bash
# Run all LLMFlow examples
# Usage: ./examples/run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  LLMFlow Examples Runner"
echo "=========================================="
echo ""

# Load .env from project root if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    echo -e "${GREEN}✓ Loading .env from project root${NC}"
    set -a
    source "$ROOT_DIR/.env"
    set +a
else
    echo -e "${YELLOW}○ No .env file found in project root${NC}"
    echo "  Copy .env.example to .env and add your API keys"
fi
echo ""

# Check if LLMFlow is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${RED}Error: LLMFlow is not running${NC}"
    echo "Start it with: npm start"
    exit 1
fi

echo -e "${GREEN}✓ LLMFlow is running${NC}"
echo ""

# Check for OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY not set${NC}"
    echo "Add OPENAI_API_KEY to .env in project root"
    echo ""
    echo "Example .env:"
    echo "  OPENAI_API_KEY=sk-..."
    exit 1
fi
echo -e "${GREEN}✓ OPENAI_API_KEY is set${NC}"
echo ""

PASSED=0
FAILED=0

run_example() {
    local name=$1
    local dir="$SCRIPT_DIR/$name"
    
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}○ $name - directory not found${NC}"
        return
    fi
    
    echo -e "Running ${YELLOW}$name${NC}..."
    
    cd "$dir"
    
    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        npm install --silent 2>/dev/null || true
    fi
    
    # Run with timeout
    if timeout 30 npm start 2>&1; then
        echo -e "${GREEN}✓ $name passed${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ $name failed${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# Run each example
for example in langchain ai-sdk-proxy vercel-ai-sdk rag-pipeline; do
    run_example "$example"
done

# Summary
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

# Check traces were logged
TRACE_COUNT=$(curl -s http://localhost:3000/api/stats | grep -o '"total_requests":[0-9]*' | cut -d: -f2)
echo "Total traces in LLMFlow: $TRACE_COUNT"

exit $FAILED
