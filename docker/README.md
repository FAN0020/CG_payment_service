# ClassGuru Payment Service - Docker Deployment

This directory contains Docker configuration files for deploying the ClassGuru Payment Service in production.

## Files

- `Dockerfile` - Production Docker image configuration
- `docker-compose.yml` - Docker Compose configuration for easy deployment
- `.dockerignore` - Files to exclude from Docker build context
- `build.sh` - Build script for creating the Docker image
- `README.md` - This documentation

## Quick Start

### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 20+ for building the project
3. Environment variables configured in `../env.txt`

### Build and Run

1. **Build the Docker image:**
   ```bash
   ./build.sh
   ```

2. **Run with Docker Compose (recommended):**
   ```bash
   docker-compose up -d
   ```

3. **Run with Docker directly:**
   ```bash
   docker run -p 8790:8790 --env-file ../env.txt classguru-payment-service:latest
   ```

### Environment Variables

The service uses environment variables from `../env.txt`. Key variables include:

- `PORT=8790` - Service port
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `JWT_SECRET` - JWT signing secret
- `DB_PATH=./data/payment.db` - SQLite database path

### Health Check

The service includes a health check endpoint at `/health` that Docker uses to monitor container health.

### Data Persistence

- Database files are persisted in Docker volumes
- Logs are persisted in Docker volumes
- Data survives container restarts

### Production Considerations

1. **Security:**
   - Use production Stripe keys
   - Use strong JWT secrets
   - Consider using Docker secrets for sensitive data

2. **Monitoring:**
   - Check logs: `docker-compose logs -f`
   - Monitor health: `docker-compose ps`

3. **Scaling:**
   - The service is stateless except for SQLite database
   - For high availability, consider external database

### Troubleshooting

- **Build fails:** Ensure `npm run build` works locally
- **Container won't start:** Check environment variables in `env.txt`
- **Database issues:** Ensure data volume is properly mounted
- **Port conflicts:** Change port mapping in docker-compose.yml

### Development vs Production

This Docker setup is optimized for production:
- Only includes compiled JavaScript files (no TypeScript source)
- Uses production dependencies only
- Includes health checks
- Optimized for smaller image size
