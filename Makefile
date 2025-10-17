.PHONY: help setup validate start stop restart status clean health test-payment

# Default port
PORT ?= 8790

help: ## Show this help message
	@echo "ClassGuru Payment Service - Commands"
	@echo "======================================"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment Variables:"
	@echo "  PORT=8790 (default)"

setup: ## Initial setup - create .env and install dependencies
	@echo "🚀 Setting up ClassGuru Payment Service..."
	@if [ ! -f .env ]; then \
		echo "📝 Creating .env from template..."; \
		cp .env.example .env; \
		echo "✅ .env created. Please edit it with your Stripe credentials."; \
		echo ""; \
		echo "Next steps:"; \
		echo "  1. Edit .env with your Stripe keys"; \
		echo "  2. Run: make validate"; \
		echo "  3. Run: make start"; \
	else \
		echo "✅ .env already exists"; \
	fi
	@npm install
	@mkdir -p data
	@echo "✅ Setup complete!"

validate: ## Validate environment configuration
	@node scripts/validate-env.js

start: validate ## Start the server (validates environment first)
	@echo "🚀 Starting server on port $(PORT)..."
	@if lsof -Pi :$(PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "⚠️  Port $(PORT) is already in use. Stopping existing process..."; \
		$(MAKE) stop; \
		sleep 2; \
	fi
	@echo "▶️  Server starting..."
	@PORT=$(PORT) npx tsx src/server.ts

start-dev: validate ## Start server in watch mode
	@echo "🔄 Starting server in watch mode on port $(PORT)..."
	@if lsof -Pi :$(PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
		$(MAKE) stop; \
		sleep 2; \
	fi
	@PORT=$(PORT) npx tsx watch src/server.ts

stop: ## Stop the server
	@echo "🛑 Stopping server on port $(PORT)..."
	@lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || echo "No server running"
	@echo "✅ Server stopped"

restart: stop start ## Restart the server

status: ## Check if server is running
	@if lsof -Pi :$(PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "✅ Server is RUNNING on port $(PORT)"; \
		lsof -i :$(PORT); \
	else \
		echo "❌ Server is NOT running on port $(PORT)"; \
		exit 1; \
	fi

health: ## Check server health
	@curl -f -s http://localhost:$(PORT)/api/payment/health | jq . || echo "❌ Health check failed"

test-payment: ## Open payment page in browser
	@if lsof -Pi :$(PORT) -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "🌐 Opening payment page..."; \
		open http://localhost:$(PORT)/payment || xdg-open http://localhost:$(PORT)/payment; \
	else \
		echo "❌ Server is not running. Run 'make start' first."; \
		exit 1; \
	fi

generate-jwt: ## Generate a test JWT token
	@node scripts/generate-test-jwt.js

clean: stop ## Clean data and logs
	@echo "🧹 Cleaning..."
	@rm -rf data/*.db
	@echo "✅ Cleaned"

full-check: validate status health ## Run all checks
	@echo ""
	@echo "======================================"
	@echo "✅ All checks passed!"
	@echo "======================================"
	@echo "Payment URL: http://localhost:$(PORT)/payment"
	@echo ""





