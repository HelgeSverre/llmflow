# LLMFlow Makefile

.PHONY: help dev dev-verbose demo demo-many test test-otlp test-ws test-logs test-metrics test-providers test-providers-e2e test-e2e test-e2e-headed test-e2e-ui examples docker docker-bg docker-stop docker-logs docker-test status clean website-deploy og-image

help:
	@echo "LLMFlow - Commands"
	@echo ""
	@echo "  make dev              - Install deps and start servers"
	@echo "  make dev-verbose      - Start with verbose logging"
	@echo "  make demo             - Generate sample traces"
	@echo "  make demo-many        - Generate 20 sample traces"
	@echo "  make test             - Run all tests (starts server automatically)"
	@echo "  make test-otlp        - Run OTLP tests"
	@echo "  make test-ws          - Run WebSocket tests"
	@echo "  make test-logs        - Run OTLP logs tests"
	@echo "  make test-metrics     - Run OTLP metrics tests"
	@echo "  make test-providers   - Run provider tests"
	@echo "  make test-providers-e2e - Run provider E2E tests"
	@echo "  make test-e2e         - Run Playwright E2E tests"
	@echo "  make test-e2e-headed  - Run E2E tests with browser visible"
	@echo "  make test-e2e-ui      - Run E2E tests with Playwright UI"
	@echo "  make examples         - Run all integration examples"
	@echo "  make docker           - Build and run with Docker Compose"
	@echo "  make docker-bg        - Run Docker in background"
	@echo "  make docker-stop      - Stop Docker containers"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-test      - Run tests in Docker"
	@echo "  make status           - Check what's running"
	@echo "  make clean            - Remove node_modules and data"
	@echo "  make website-deploy   - Deploy website to Vercel"

dev:
	npm install && npm start

dev-verbose:
	npm run start:verbose

demo:
	node test/demo.js

demo-many:
	npm run demo:many

test:
	npm test

test-otlp:
	npm run test:otlp

test-ws:
	npm run test:ws

test-logs:
	npm run test:logs

test-metrics:
	npm run test:metrics

test-providers:
	npm run test:providers

test-providers-e2e:
	npm run test:providers-e2e

test-e2e:
	npm run test:e2e

test-e2e-headed:
	npm run test:e2e:headed

test-e2e-ui:
	npm run test:e2e:ui

examples:
	./examples/run-all.sh

docker:
	docker-compose up --build

docker-bg:
	docker-compose up -d --build
	@echo "Running in background. Use 'make docker-logs' to see logs"

docker-stop:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-test:
	docker-compose up -d --build
	@sleep 3
	@docker-compose exec llmflow node test/otlp-e2e.js || (docker-compose down && exit 1)
	docker-compose down

status:
	@echo "Node processes:"
	@ps aux | grep -E "node.*server" | grep -v grep || echo "  None running"
	@echo ""
	@echo "Docker containers:"
	@docker ps | grep llmflow || echo "  None running"
	@echo ""
	@echo "Ports:"
	@lsof -i :8080 2>/dev/null | head -2 || echo "  8080: free"
	@lsof -i :3000 2>/dev/null | head -2 || echo "  3000: free"

clean:
	rm -rf node_modules
	rm -rf ~/.llmflow/data.db
	@echo "Cleaned node_modules and database"

website-deploy:
	cd website && vc --prod

og-image:
	node scripts/generate-og-image.js
