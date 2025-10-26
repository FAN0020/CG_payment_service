# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install dumb-init, build tools, and SSH client for Git operations
RUN apk add --no-cache dumb-init python3 make g++ openssh-client git

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S payment-service -u 1001

# Set working directory
WORKDIR /app

# Copy SSH deploy key and set up SSH configuration
COPY deploy_key /tmp/deploy_key
RUN chmod 600 /tmp/deploy_key && \
    mkdir -p /root/.ssh && \
    ssh-keyscan github.com >> /root/.ssh/known_hosts && \
    eval "$(ssh-agent -s)" && \
    ssh-add /tmp/deploy_key

# Clone private repository
RUN git clone git@github.com:FAN0020/payment-service.git /tmp/private-repo

# Copy package files from cloned repository
COPY --from=/tmp/private-repo /tmp/private-repo/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Clean up SSH key and temporary files
RUN rm -f /tmp/deploy_key && \
    rm -rf /tmp/private-repo && \
    rm -rf /root/.ssh

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
