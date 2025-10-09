# Module 1A: The Single Container Workflow

## 🎯 Objective

Understand and use Docker to containerize a single standalone application, interact with it, and manage its lifecycle.

## 🔑 Key Concepts

- **Dockerfile** syntax & best practices
- **Multi-Stage Builds** for optimized production images
- **Core CLI Commands**: `docker build`, `docker run`, `docker ps`, `docker logs`, `docker stop`, `docker rm`
- **Interacting with Containers**: `docker exec`
- **Image optimization** and security best practices

## 📚 Prerequisites

- Docker Desktop installed and running
- Basic command line knowledge
- Text editor (VS Code recommended)

## 📝 Tutorial

### Part 1: Backend API Container (Node.js)

Let's start by containerizing our Quote API backend service.

#### Step 1: Create a Simple Dockerfile

Navigate to the backend directory and create a `Dockerfile`:

```bash
cd app/backend
```

Create `Dockerfile`:

```dockerfile
# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the application
CMD ["npm", "start"]
```

#### Step 2: Build and Run the Backend Container

```bash
# Build the Docker image
docker build -t quote-api:v1 .

# Run the container
docker run -d \
  --name quote-api-container \
  -p 3001:3001 \
  -e NODE_ENV=production \
  quote-api:v1

# Check if the container is running
docker ps

# Test the API
curl http://localhost:3001/health
curl http://localhost:3001/api/quotes/random
```

#### Step 3: Interact with the Running Container

```bash
# View container logs
docker logs quote-api-container

# Follow logs in real-time
docker logs -f quote-api-container

# Execute commands inside the container
docker exec -it quote-api-container sh

# Inside the container, you can run:
# ls -la
# ps aux
# cat package.json
# exit
```

#### Step 4: Container Lifecycle Management

```bash
# Stop the container
docker stop quote-api-container

# Start the stopped container
docker start quote-api-container

# Restart the container
docker restart quote-api-container

# Remove the container (must be stopped first)
docker stop quote-api-container
docker rm quote-api-container

# Remove the image
docker rmi quote-api:v1
```

### Part 2: Frontend App with Multi-Stage Build (React)

Now let's create a more advanced Dockerfile using multi-stage builds for the React frontend.

#### Step 1: Create Multi-Stage Dockerfile

Navigate to the frontend directory:

```bash
cd ../frontend
```

Create `Dockerfile`:

```dockerfile
# Multi-stage build for React application

# Stage 1: Build the React application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine AS production

# Copy the build output from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration (optional)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a non-root user
RUN addgroup -g 1001 -S nginx
RUN adduser -S nginx -u 1001

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### Step 2: Create Nginx Configuration

Create `nginx.conf` in the frontend directory:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html index.htm;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (for production, you'd typically use a separate API service)
    location /api/ {
        proxy_pass http://quote-api-container:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
}
```

#### Step 3: Build and Run the Frontend Container

```bash
# Build the multi-stage Docker image
docker build -t quote-frontend:v1 .

# Check the image size (notice how much smaller it is!)
docker images | grep quote-frontend

# Run the frontend container
docker run -d \
  --name quote-frontend-container \
  -p 3000:80 \
  quote-frontend:v1

# Test the frontend
open http://localhost:3000
# or
curl http://localhost:3000
```

### Part 3: Docker Best Practices Demonstration

#### Step 1: Optimized Backend Dockerfile

Create `Dockerfile.optimized` in the backend directory:

```dockerfile
# Use specific version for reproducibility
FROM node:18.18.2-alpine3.18

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user early
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files and install dependencies as root
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "server.js"]
```

Create `healthcheck.js` in the backend directory:

```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

#### Step 2: Build and Compare Images

```bash
# Build optimized version
docker build -f Dockerfile.optimized -t quote-api:optimized .

# Compare image sizes
docker images | grep quote-api

# Run with health checks
docker run -d \
  --name quote-api-optimized \
  -p 3002:3001 \
  quote-api:optimized

# Check health status
docker ps
# Look for the health status in the STATUS column
```

### Part 4: Container Inspection and Debugging

```bash
# Inspect container details
docker inspect quote-api-optimized

# View resource usage
docker stats quote-api-optimized

# Check container processes
docker top quote-api-optimized

# View container filesystem changes
docker diff quote-api-optimized

# Export container as tar archive
docker export quote-api-optimized > quote-api-backup.tar

# Save image as tar archive
docker save quote-api:optimized > quote-api-image.tar
```

## 💪 Challenge

Complete these hands-on tasks to reinforce your learning:

### Challenge 1: Basic Containerization
1. Create a Dockerfile for the backend API
2. Build and run the container
3. Test all API endpoints
4. View logs and inspect the running container

### Challenge 2: Multi-Stage Build
1. Create a multi-stage Dockerfile for the React frontend
2. Build the image and note the final size
3. Run the container and verify the application works
4. Compare the size with a single-stage build

### Challenge 3: Optimization
1. Implement the optimized Dockerfile with security best practices
2. Add health checks to your containers
3. Use specific image tags instead of `latest`
4. Implement proper signal handling

### Challenge 4: Container Management
1. Run multiple containers with different names
2. Practice starting, stopping, and removing containers
3. Use `docker exec` to troubleshoot issues
4. Export and import container data

## ✅ Validation

Verify your implementation by checking:

- [ ] Backend container runs and responds to API calls
- [ ] Frontend container serves the React application
- [ ] Multi-stage build produces smaller image sizes
- [ ] Health checks work properly
- [ ] Containers can be managed through their lifecycle
- [ ] Non-root users are used for security
- [ ] Proper signal handling is implemented

## 🔍 Troubleshooting

### Common Issues:

**Container won't start:**
```bash
# Check logs for errors
docker logs container-name

# Inspect container configuration
docker inspect container-name
```

**Port already in use:**
```bash
# Find what's using the port
lsof -i :3001

# Use a different port
docker run -p 3002:3001 image-name
```

**Permission denied:**
```bash
# Make sure Docker daemon is running
docker version

# Check file permissions
ls -la Dockerfile
```

**Build fails:**
```bash
# Clean up build cache
docker system prune

# Build with no cache
docker build --no-cache -t image-name .
```

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)

## 🎉 Completion

Congratulations! You've mastered the single container workflow. You can now:
- Write effective Dockerfiles
- Build and optimize container images
- Manage container lifecycles
- Implement security best practices
- Debug containerized applications

**Next Step**: Continue to [Module 1B: Multi-Container Apps with Docker Compose](../module-1b-docker-compose/README.md)