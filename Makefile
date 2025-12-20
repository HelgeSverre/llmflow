# LLMFlow Makefile

.PHONY: help dev demo test docker docker-bg docker-stop docker-logs docker-test status clean

help:
	@echo "LLMFlow - Commands"
	@echo ""
	@echo "  make dev          - Install deps and start servers"
	@echo "  make demo         - Generate sample traces"
	@echo "  make test         - Run all tests (starts server automatically)"
	@echo "  make docker       - Build and run with Docker Compose"
	@echo "  make docker-bg    - Run Docker in background"
	@echo "  make docker-stop  - Stop Docker containers"
	@echo "  make docker-logs  - View Docker logs"
	@echo "  make docker-test  - Run tests in Docker"
	@echo "  make status       - Check what's running"
	@echo "  make clean        - Remove node_modules and data"

dev:
	npm install && npm start

demo:
	node test/demo.js

test:
	npm test

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
