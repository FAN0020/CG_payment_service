.PHONY: help install dev build start stop restart status health validate clean test lint format

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)ClassGuru Ad Service - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

dev: validate ## Start development server with auto-reload
	@echo "$(GREEN)Starting development server...$(NC)"
	npm run dev

build: ## Build TypeScript to JavaScript
	@echo "$(GREEN)Building project...$(NC)"
	npm run build

start: validate ## Start production server
	@echo "$(GREEN)Starting ad service...$(NC)"
	npm start &
	@echo "$(GREEN)Ad service started on port 8791$(NC)"

stop: ## Stop the ad service
	@echo "$(YELLOW)Stopping ad service...$(NC)"
	npm run kill-server || true
	@echo "$(GREEN)Ad service stopped$(NC)"

restart: stop start ## Restart the ad service
	@echo "$(GREEN)Ad service restarted$(NC)"

status: ## Check if ad service is running
	@echo "$(YELLOW)Checking ad service status...$(NC)"
	@curl -s http://localhost:8791/api/ads/health > /dev/null && echo "$(GREEN)✓ Ad service is running$(NC)" || echo "$(RED)✗ Ad service is not running$(NC)"

health: ## Run health check
	@echo "$(YELLOW)Running health check...$(NC)"
	@curl -s http://localhost:8791/api/ads/health | json_pp || echo "$(RED)Failed to connect$(NC)"

validate: ## Validate environment configuration
	@echo "$(YELLOW)Validating configuration...$(NC)"
	@node scripts/validate-env.js

clean: ## Clean database and logs
	@echo "$(YELLOW)Cleaning data...$(NC)"
	rm -rf data/*.db
	rm -rf logs/*.log
	@echo "$(GREEN)Cleaned$(NC)"

test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	npm test

lint: ## Run linter
	@echo "$(YELLOW)Linting code...$(NC)"
	npm run lint

format: ## Format code
	@echo "$(YELLOW)Formatting code...$(NC)"
	npm run format

.DEFAULT_GOAL := help
