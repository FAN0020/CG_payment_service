# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install dumb-init and build tools for native dependencies
RUN apk add --no-cache dumb-init python3 make g++

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S payment-service -u 1001

# Set working directory
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from dist directory
COPY ../dist ./dist

# Copy environment file
COPY ../env.txt ./.env

# Create necessary directories
RUN mkdir -p ./data ./logs && \
    chown -R payment-service:nodejs /app

# Switch to non-root user
USER payment-service

# Expose the port the app runs on
EXPOSE 8790

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8790

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8790/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
