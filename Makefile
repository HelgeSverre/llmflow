# LLMFlow MVP Makefile
# Shortcuts for compound commands and common workflows

.PHONY: help
help:
	@echo "LLMFlow MVP - Common Commands"
	@echo ""
	@echo "  make dev              - Install deps and start servers"
	@echo "  make docker           - Build and run with Docker"
	@echo "  make docker-bg        - Build and run Docker in background"
	@echo "  make reset            - Clean everything and reinstall"
	@echo "  make status           - Check what's running"

# One command to get everything running
.PHONY: dev
dev:
	npm install
	npm start

# Docker workflow in one command
.PHONY: docker
docker:
	docker build -t llmflow-mvp .
	docker run -p 8080:8080 -p 3000:3000 llmflow-mvp

# Run Docker in background
.PHONY: docker-bg
docker-bg:
	docker build -t llmflow-mvp .
	docker run -d --name llmflow -p 8080:8080 -p 3000:3000 llmflow-mvp
	@echo "Running in background. Use 'docker logs -f llmflow' to see logs"

# Clean and reinstall
.PHONY: reset
reset:
	rm -rf node_modules
	npm install

# Check what's running
.PHONY: status
status:
	@echo "Node processes:"
	@ps aux | grep -E "node.*llmflow" | grep -v grep || echo "  None running"
	@echo "\nDocker containers:"
	@docker ps | grep llmflow || echo "  None running"
	@echo "\nPorts:"
	@lsof -i :8080 || echo "  8080: free"
	@lsof -i :3000 || echo "  3000: free"