# LLMFlow MVP Makefile
# Shortcuts for compound commands and common workflows

.PHONY: help
help:
	@echo "LLMFlow MVP - Common Commands"
	@echo ""
	@echo "  make dev              - Install deps and start servers"
	@echo "  make docker           - Build and run with Docker Compose"
	@echo "  make docker-bg        - Build and run Docker in background"
	@echo "  make docker-stop      - Stop Docker containers"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make reset            - Clean everything and reinstall"
	@echo "  make status           - Check what's running"

# One command to get everything running
.PHONY: dev
dev:
	cd server && npm install && npm start

# Docker workflow in one command
.PHONY: docker
docker:
	docker-compose up --build

# Run Docker in background
.PHONY: docker-bg
docker-bg:
	docker-compose up -d --build
	@echo "Running in background. Use 'docker-compose logs -f' to see logs"

# Stop Docker containers
.PHONY: docker-stop
docker-stop:
	docker-compose down

# View Docker logs
.PHONY: docker-logs
docker-logs:
	docker-compose logs -f

# Clean and reinstall
.PHONY: reset
reset:
	rm -rf server/node_modules example/node_modules
	cd server && npm install
	cd example && npm install

# Check what's running
.PHONY: status
status:
	@echo "Node processes:"
	@ps aux | grep -E "node.*server" | grep -v grep || echo "  None running"
	@echo "\nDocker containers:"
	@docker ps | grep llmflow || echo "  None running"
	@echo "\nPorts:"
	@lsof -i :8080 || echo "  8080: free"
	@lsof -i :3000 || echo "  3000: free"