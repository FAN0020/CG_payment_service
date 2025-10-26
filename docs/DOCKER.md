# 🐳 Docker Configuration Guide

**Complete Docker setup and deployment for ClassGuru Payment Service**

## 🚀 Quick Start

```bash
# Build and run
cd docker
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Verify deployment
curl http://localhost:8790/api/credits/health
```

## 🔧 Configuration

### 📡 Port Mapping
```yaml
ports:
  - "8790:8790"  # Host Port:Container Port
```

**Details:**
- **Host Port**: `8790` (external access)
- **Container Port**: `8790` (internal service)
- **Access URL**: `http://localhost:8790` or `http://your-server-ip:8790`
- **Health Check**: `http://localhost:8790/api/credits/health`

### 📁 Volume Mapping

**Docker Volumes (Recommended):**
```yaml
volumes:
  - payment_data:/app/data      # SQLite database persistence
  - payment_logs:/app/logs      # Application logs persistence
```

**Volume Details:**
- **`payment_data`**: Stores SQLite database (`payment.db`)
- **`payment_logs`**: Stores application log files
- **Location**: Docker-managed volumes in `/var/lib/docker/volumes/`

**Alternative - Direct Directory Mapping:**
```yaml
volumes:
  - ./data:/app/data            # Map to local ./data directory
  - ./logs:/app/logs            # Map to local ./logs directory
  # Or use absolute paths:
  - /host/path/to/data:/app/data
  - /host/path/to/logs:/app/logs
```

### 🌐 Network Configuration
```yaml
networks:
  - payment-network  # Custom bridge network
```

**Network Details:**
- **Type**: Bridge network
- **Name**: `payment-network`
- **Purpose**: Container-to-container communication

## 🐳 Dockerfile

**Key Features:**
- **Base**: Node.js 20 Alpine (minimal, secure)
- **Security**: Non-root user execution
- **Health Check**: Built-in monitoring
- **Production**: No dev dependencies
- **SSH Deploy Key**: Clones private GitHub repositories during build

## 🚀 Docker Compose

```yaml
version: '3.8'

services:
  payment-service:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: classguru-payment-service
    ports:
      - "8790:8790"
    environment:
      - NODE_ENV=production
      - PORT=8790
    env_file:
      - ../env.txt
    volumes:
      - payment_data:/app/data
      - payment_logs:/app/logs
    networks:
      - payment-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8790/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  payment_data:
  payment_logs:

networks:
  payment-network:
    driver: bridge
```

## 🛠️ Commands

### Basic Commands
```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart
docker compose restart

# Rebuild and start
docker compose up -d --build
```

### Build Commands
```bash
# Build image (requires deploy_key file)
docker build -f docker/Dockerfile -t classguru-payment-service .

# Build with no cache
docker build --no-cache -f docker/Dockerfile -t classguru-payment-service .

# Build and run
docker compose up -d --build
```

### 🔑 SSH Deploy Key Setup

**Prerequisites:**

**Option 1: Automated Setup (Recommended)**
```bash
cd docker
./setup-deploy-key.sh
```

**Option 2: Manual Setup**
1. **Generate SSH Key Pair:**
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -C "deploy-key"
   ```

2. **Add Public Key to GitHub:**
   - Copy `deploy_key.pub` content
   - Go to your GitHub repository → Settings → Deploy keys
   - Add new deploy key with read access

3. **Place Private Key:**
   ```bash
   # Copy the private key to docker directory
   cp deploy_key docker/deploy_key
   ```

**Security Notes:**
- ✅ Private key is automatically cleaned up after build
- ✅ Key has restricted permissions (600)
- ✅ Key is excluded from version control
- ✅ Only used during build process

### Debug Commands
```bash
# Shell access
docker exec -it classguru-payment-service sh

# View container logs
docker logs classguru-payment-service

# Check health status
docker inspect classguru-payment-service | grep Health

# Monitor resources
docker stats classguru-payment-service
```

### Testing Commands
```bash
# Test health endpoint
curl http://localhost:8790/api/credits/health

# Test with verbose output
curl -v http://localhost:8790/api/credits/health

# Test from container
docker exec -it classguru-payment-service curl localhost:8790/health
```

## 📊 Volume Management

```bash
# List volumes
docker volume ls | grep payment

# Inspect volume
docker volume inspect docker_payment_data

# Backup database
docker run --rm -v docker_payment_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/payment_data_backup.tar.gz -C /data .

# Restore database
docker run --rm -v docker_payment_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/payment_data_backup.tar.gz -C /data
```

## 🌐 Network Commands

```bash
# List networks
docker network ls

# Inspect network
docker network inspect docker_payment-network

# Test connectivity
docker exec -it classguru-payment-service curl localhost:8790/health
```

## 🧹 Cleanup Commands

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a

# Stop and remove volumes (WARNING: Data loss)
docker compose down -v
```

## ✅ Verification

### Check Configuration
```bash
# Check container status
docker compose ps

# Check port mapping
docker port classguru-payment-service

# Check volumes
docker volume ls | grep payment

# Test service
curl http://localhost:8790/api/credits/health
```

### 💡 Why This Configuration?

**✅ This setup is recommended because:**

1. **Port Mapping `8790:8790`**:
   - Standard practice for single-service containers
   - Keeps internal and external ports the same for simplicity
   - Easy to remember and configure

2. **Docker Volumes vs Direct Mapping**:
   - **Docker Volumes** (current): Better data management, cross-platform compatibility
   - **Direct Mapping**: Easier to access files directly on host system
   - Both approaches are valid depending on your needs

3. **Network Configuration**:
   - Custom bridge network allows future service expansion
   - Isolates payment service from other containers
   - Enables service-to-service communication

**🎯 This is a production-ready configuration!**

## 🔒 Security

- ✅ **Non-root user**: Runs as `payment-service` (UID 1001)
- ✅ **Minimal base**: Alpine Linux
- ✅ **Production only**: No dev dependencies
- ✅ **Volume isolation**: Separate data and logs volumes

## 🚀 Production

### Environment Variables
```env
NODE_ENV=production
PORT=8790
STRIPE_SECRET_KEY=sk_live_your_production_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret
JWT_SECRET=64_character_random_string_here
```

### Production Checklist
- [ ] Use production Stripe keys
- [ ] Configure reverse proxy (nginx)
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and backups

### Production Considerations

1. **Security:**
   - Use production Stripe keys
   - Use strong JWT secrets
   - Consider using Docker secrets for sensitive data

2. **Monitoring:**
   - Check logs: `docker compose logs -f`
   - Monitor health: `docker compose ps`

3. **Scaling:**
   - The service is stateless except for SQLite database
   - For high availability, consider external database

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port in use | `lsof -i :8790` then `kill -9 <PID>` |
| Container won't start | `docker compose logs payment-service` |
| Database issues | `docker exec -it classguru-payment-service ls -la /app/data` |
| Health check fails | `curl -v http://localhost:8790/api/credits/health` |
| Build fails | Ensure `npm run build` works locally |

### Debug Mode
```bash
# Run with debug logging
docker run --rm -d --name payment-service \
  -p 8790:8790 \
  -e LOG_LEVEL=debug \
  -v payment_data:/app/data \
  -v payment_logs:/app/logs \
  classguru-payment-service
```

## 📋 Configuration Files

- **Dockerfile**: `docker/Dockerfile`
- **Docker Compose**: `docker/docker-compose.yml`
- **Environment**: `env.txt`
- **Build Script**: `docker/build.sh`
- **SSH Setup**: `docker/setup-deploy-key.sh`
- **Deploy Key Example**: `docker/deploy_key.example`

---

**This is the single source of truth for Docker deployment!** 🎯