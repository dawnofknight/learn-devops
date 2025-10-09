# Module 1B: Multi-Container Apps with Docker Compose

## 🎯 Objective

Learn to define, run, and connect multiple services (frontend, backend, database) using Docker Compose for local development.

## 🔑 Key Concepts

- **docker-compose.yml** syntax: `version`, `services`, `build`, `ports`, `environment`, `volumes`
- **Service Networking**: How containers in the same Compose file communicate with each other using service names
- **Data Persistence**: Using `volumes` to persist database data
- **Environment Management**: Using `.env` files and environment variables
- **Service Dependencies**: Using `depends_on` to control startup order
- **Development vs Production**: Different compose configurations for different environments

## 📚 Prerequisites

- Completed Module 1A (Single Container Workflow)
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- Basic understanding of YAML syntax

## 📝 Tutorial

### Part 1: Basic Docker Compose Setup

Let's create a complete multi-container setup for our Quote of the Day application.

#### Step 1: Create the Main Docker Compose File

Create `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  database:
    image: postgres:15-alpine
    container_name: quote-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: quotes_db
      POSTGRES_USER: quotes_user
      POSTGRES_PASSWORD: quotes_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./app/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quotes_user -d quotes_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - quote-network

  # Backend API
  backend:
    build:
      context: ./app/backend
      dockerfile: Dockerfile
    container_name: quote-api
    restart: unless-stopped
    environment:
      NODE_ENV: development
      PORT: 3001
      DB_HOST: database
      DB_PORT: 5432
      DB_NAME: quotes_db
      DB_USER: quotes_user
      DB_PASSWORD: quotes_password
    ports:
      - "3001:3001"
    depends_on:
      database:
        condition: service_healthy
    volumes:
      # Mount source code for development (hot reload)
      - ./app/backend:/app
      - /app/node_modules
    networks:
      - quote-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend React App
  frontend:
    build:
      context: ./app/frontend
      dockerfile: Dockerfile.dev
    container_name: quote-frontend
    restart: unless-stopped
    environment:
      - REACT_APP_API_URL=http://localhost:3001
    ports:
      - "3000:3000"
    depends_on:
      - backend
    volumes:
      # Mount source code for development (hot reload)
      - ./app/frontend:/app
      - /app/node_modules
    networks:
      - quote-network
    stdin_open: true
    tty: true

# Named volumes for data persistence
volumes:
  postgres_data:
    driver: local

# Custom network for service communication
networks:
  quote-network:
    driver: bridge
```

#### Step 2: Create Development Dockerfile for Frontend

Create `Dockerfile.dev` in the frontend directory:

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
```

#### Step 3: Create Environment Configuration

Create `.env` file in the project root:

```env
# Database Configuration
POSTGRES_DB=quotes_db
POSTGRES_USER=quotes_user
POSTGRES_PASSWORD=quotes_password

# Backend Configuration
NODE_ENV=development
PORT=3001

# Frontend Configuration
REACT_APP_API_URL=http://localhost:3001
```

Update `docker-compose.yml` to use environment file:

```yaml
version: '3.8'

services:
  database:
    image: postgres:15-alpine
    container_name: quote-db
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./app/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - quote-network

  backend:
    build:
      context: ./app/backend
      dockerfile: Dockerfile
    container_name: quote-api
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DB_HOST: database
      DB_PORT: 5432
    ports:
      - "${PORT}:${PORT}"
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - ./app/backend:/app
      - /app/node_modules
    networks:
      - quote-network

  frontend:
    build:
      context: ./app/frontend
      dockerfile: Dockerfile.dev
    container_name: quote-frontend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
    depends_on:
      - backend
    volumes:
      - ./app/frontend:/app
      - /app/node_modules
    networks:
      - quote-network
    stdin_open: true
    tty: true

volumes:
  postgres_data:

networks:
  quote-network:
    driver: bridge
```

### Part 2: Running and Managing the Multi-Container Application

#### Step 1: Start the Application Stack

```bash
# Start all services in detached mode
docker-compose up -d

# View running services
docker-compose ps

# View logs from all services
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs from specific service
docker-compose logs backend
```

#### Step 2: Service Communication Testing

```bash
# Test database connectivity from backend container
docker-compose exec backend sh
# Inside the container:
# npm run db:test (if you have a test script)
# exit

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/quotes/random

# Test frontend
open http://localhost:3000
```

#### Step 3: Development Workflow

```bash
# Rebuild specific service after code changes
docker-compose build backend
docker-compose up -d backend

# Restart specific service
docker-compose restart frontend

# Scale services (useful for load testing)
docker-compose up -d --scale backend=3

# View service logs
docker-compose logs -f --tail=100 backend
```

### Part 3: Advanced Docker Compose Features

#### Step 1: Override Files for Different Environments

Create `docker-compose.override.yml` for development:

```yaml
version: '3.8'

services:
  backend:
    volumes:
      - ./app/backend:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
      DEBUG: "app:*"
    command: npm run dev

  frontend:
    volumes:
      - ./app/frontend:/app
      - /app/node_modules
    environment:
      FAST_REFRESH: true
      CHOKIDAR_USEPOLLING: true

  database:
    ports:
      - "5432:5432"  # Expose database port for development tools
```

Create `docker-compose.prod.yml` for production:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./app/backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
    restart: always
    # Remove volume mounts for production

  frontend:
    build:
      context: ./app/frontend
      dockerfile: Dockerfile
    restart: always
    # Remove volume mounts for production

  database:
    # Don't expose database port in production
    ports: []
    restart: always

  # Add reverse proxy for production
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: always
```

#### Step 2: Using Profiles for Optional Services

Update `docker-compose.yml` to include optional services:

```yaml
version: '3.8'

services:
  # ... existing services ...

  # Redis for caching (optional)
  redis:
    image: redis:7-alpine
    container_name: quote-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - quote-network
    profiles:
      - caching
      - full

  # Adminer for database management (optional)
  adminer:
    image: adminer:latest
    container_name: quote-adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - database
    networks:
      - quote-network
    profiles:
      - tools
      - full

volumes:
  postgres_data:
  redis_data:

networks:
  quote-network:
    driver: bridge
```

Run with profiles:

```bash
# Start with caching services
docker-compose --profile caching up -d

# Start with database tools
docker-compose --profile tools up -d

# Start everything
docker-compose --profile full up -d
```

### Part 4: Monitoring and Debugging

#### Step 1: Health Checks and Dependencies

```bash
# Check service health
docker-compose ps

# Wait for services to be healthy
docker-compose up --wait

# Check specific service health
docker inspect quote-db --format='{{.State.Health.Status}}'
```

#### Step 2: Resource Monitoring

```bash
# View resource usage
docker stats

# View compose services resource usage
docker-compose top

# Check disk usage
docker system df
```

#### Step 3: Debugging Network Issues

```bash
# List networks
docker network ls

# Inspect the compose network
docker network inspect learn-container_quote-network

# Test connectivity between services
docker-compose exec backend ping database
docker-compose exec frontend ping backend
```

### Part 5: Data Management and Backups

#### Step 1: Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect learn-container_postgres_data

# Backup database
docker-compose exec database pg_dump -U quotes_user quotes_db > backup.sql

# Restore database
docker-compose exec -T database psql -U quotes_user quotes_db < backup.sql
```

#### Step 2: Complete Backup and Restore

Create `scripts/backup.sh`:

```bash
#!/bin/bash

# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup database
docker-compose exec -T database pg_dump -U quotes_user quotes_db > backups/$(date +%Y%m%d)/database.sql

# Backup volumes
docker run --rm -v learn-container_postgres_data:/data -v $(pwd)/backups/$(date +%Y%m%d):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .

echo "Backup completed: backups/$(date +%Y%m%d)/"
```

Create `scripts/restore.sh`:

```bash
#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la backups/
    exit 1
fi

BACKUP_DATE=$1

# Stop services
docker-compose down

# Restore volume
docker run --rm -v learn-container_postgres_data:/data -v $(pwd)/backups/$BACKUP_DATE:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data

# Start database
docker-compose up -d database

# Wait for database to be ready
sleep 10

# Restore database
docker-compose exec -T database psql -U quotes_user quotes_db < backups/$BACKUP_DATE/database.sql

# Start all services
docker-compose up -d

echo "Restore completed from: backups/$BACKUP_DATE/"
```

## 💪 Challenge

Complete these hands-on tasks to reinforce your learning:

### Challenge 1: Basic Multi-Container Setup
1. Create a `docker-compose.yml` file for the full stack
2. Start all services and verify they can communicate
3. Test the complete application flow
4. Check logs from all services

### Challenge 2: Environment Management
1. Create `.env` file with all configuration
2. Create separate override files for development and production
3. Test running with different configurations
4. Implement proper secret management

### Challenge 3: Service Dependencies and Health Checks
1. Add health checks to all services
2. Configure proper service dependencies
3. Test startup order and failure scenarios
4. Implement graceful shutdown handling

### Challenge 4: Development Workflow
1. Set up hot reload for both frontend and backend
2. Create scripts for common development tasks
3. Implement database seeding and migrations
4. Set up debugging capabilities

### Challenge 5: Production Readiness
1. Create production-optimized compose file
2. Add reverse proxy with Nginx
3. Implement proper logging and monitoring
4. Create backup and restore procedures

## ✅ Validation

Verify your implementation by checking:

- [ ] All services start successfully with `docker-compose up`
- [ ] Frontend can communicate with backend API
- [ ] Backend can connect to and query the database
- [ ] Data persists after container restarts
- [ ] Health checks work for all services
- [ ] Environment variables are properly configured
- [ ] Development hot reload works
- [ ] Production build is optimized
- [ ] Backup and restore procedures work

## 🔍 Troubleshooting

### Common Issues:

**Services can't communicate:**
```bash
# Check network configuration
docker network ls
docker network inspect <network_name>

# Verify service names in compose file
docker-compose config
```

**Database connection fails:**
```bash
# Check database logs
docker-compose logs database

# Test database connectivity
docker-compose exec backend ping database
docker-compose exec database pg_isready -U quotes_user
```

**Port conflicts:**
```bash
# Check what's using the port
lsof -i :3000

# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # host:container
```

**Volume permission issues:**
```bash
# Check volume ownership
docker-compose exec backend ls -la /app

# Fix permissions
docker-compose exec backend chown -R node:node /app
```

**Build failures:**
```bash
# Clean build cache
docker-compose build --no-cache

# Rebuild specific service
docker-compose build backend
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Compose Best Practices](https://docs.docker.com/compose/production/)
- [Environment Variables in Compose](https://docs.docker.com/compose/environment-variables/)

## 🎉 Completion

Congratulations! You've mastered multi-container applications with Docker Compose. You can now:
- Orchestrate multiple services with Docker Compose
- Manage service networking and communication
- Handle data persistence with volumes
- Configure different environments
- Implement proper development workflows
- Debug multi-container applications

**Next Step**: Continue to [Module 2: Introduction to Kubernetes](../module-2-kubernetes-intro/README.md)