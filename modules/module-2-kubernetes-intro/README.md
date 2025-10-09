# Module 2: Introduction to Kubernetes

## 🎯 Objective

Learn Kubernetes fundamentals by deploying the Quote of the Day application using Pods, Services, Deployments, and ConfigMaps in a local cluster.

## 🔑 Key Concepts

- **Kubernetes Architecture**: Master/Control Plane, Nodes, kubelet, kube-proxy
- **Core Resources**: Pods, Services, Deployments, ReplicaSets
- **Configuration Management**: ConfigMaps, Secrets
- **Service Discovery**: ClusterIP, NodePort, LoadBalancer
- **kubectl CLI**: Essential commands for cluster management
- **YAML Manifests**: Declarative configuration files
- **Namespaces**: Resource isolation and organization
- **Labels and Selectors**: Resource identification and grouping

## 📚 Prerequisites

- Completed Module 1A and 1B (Docker fundamentals)
- Docker Desktop with Kubernetes enabled, OR
- Minikube installed, OR
- Kind (Kubernetes in Docker) installed
- kubectl CLI tool installed
- Basic understanding of YAML syntax

## 🛠️ Setup

### Option 1: Docker Desktop Kubernetes (Recommended for beginners)

```bash
# Enable Kubernetes in Docker Desktop
# Go to Docker Desktop > Settings > Kubernetes > Enable Kubernetes

# Verify installation
kubectl version --client
kubectl cluster-info
```

### Option 2: Minikube

```bash
# Install minikube (macOS)
brew install minikube

# Start minikube cluster
minikube start --driver=docker

# Verify installation
kubectl get nodes
minikube status
```

### Option 3: Kind (Kubernetes in Docker)

```bash
# Install kind (macOS)
brew install kind

# Create cluster
kind create cluster --name quote-cluster

# Verify installation
kubectl cluster-info --context kind-quote-cluster
```

## 📝 Tutorial

### Part 1: Understanding Kubernetes Basics

#### Step 1: Explore Your Cluster

```bash
# Check cluster information
kubectl cluster-info

# List all nodes
kubectl get nodes

# Get detailed node information
kubectl describe nodes

# Check available namespaces
kubectl get namespaces

# Set default namespace (optional)
kubectl config set-context --current --namespace=default
```

#### Step 2: Create a Namespace for Our Application

Create `namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quote-app
  labels:
    app: quote-of-the-day
    environment: development
```

Apply the namespace:

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Verify namespace creation
kubectl get namespaces

# Set as default namespace for this session
kubectl config set-context --current --namespace=quote-app
```

### Part 2: Deploying the Database

#### Step 1: Create PostgreSQL ConfigMap

Create `postgres-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: quote-app
  labels:
    app: postgres
data:
  POSTGRES_DB: quotes_db
  POSTGRES_USER: quotes_user
```

#### Step 2: Create PostgreSQL Secret

Create `postgres-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: quote-app
  labels:
    app: postgres
type: Opaque
data:
  # Base64 encoded values
  # echo -n 'quotes_password' | base64
  POSTGRES_PASSWORD: cXVvdGVzX3Bhc3N3b3Jk
```

#### Step 3: Create PostgreSQL Deployment

Create `postgres-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
  namespace: quote-app
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-init
          mountPath: /docker-entrypoint-initdb.d
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - quotes_user
            - -d
            - quotes_db
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - quotes_user
            - -d
            - quotes_db
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        emptyDir: {}
      - name: postgres-init
        configMap:
          name: postgres-init-script
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-init-script
  namespace: quote-app
data:
  init.sql: |
    -- Create quotes table
    CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Insert sample quotes
    INSERT INTO quotes (text, author, category) VALUES
    ('The only way to do great work is to love what you do.', 'Steve Jobs', 'motivation'),
    ('Innovation distinguishes between a leader and a follower.', 'Steve Jobs', 'innovation'),
    ('Life is what happens to you while you''re busy making other plans.', 'John Lennon', 'life'),
    ('The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt', 'dreams'),
    ('It is during our darkest moments that we must focus to see the light.', 'Aristotle', 'inspiration');

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_quotes_category ON quotes(category);
    CREATE INDEX IF NOT EXISTS idx_quotes_author ON quotes(author);
```

#### Step 4: Create PostgreSQL Service

Create `postgres-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: quote-app
  labels:
    app: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
  type: ClusterIP
```

Deploy PostgreSQL:

```bash
# Apply all PostgreSQL resources
kubectl apply -f postgres-configmap.yaml
kubectl apply -f postgres-secret.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# Check logs
kubectl logs -l app=postgres
```

### Part 3: Deploying the Backend API

#### Step 1: Create Backend ConfigMap

Create `backend-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: quote-app
  labels:
    app: backend
data:
  NODE_ENV: "production"
  PORT: "3001"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "quotes_db"
  DB_USER: "quotes_user"
```

#### Step 2: Create Backend Deployment

Create `backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
  namespace: quote-app
  labels:
    app: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: quote-api:latest
        imagePullPolicy: Never  # Use local image
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: PORT
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: DB_PORT
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: DB_NAME
        - name: DB_USER
          valueFrom:
            configMapKeyRef:
              name: backend-config
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

#### Step 3: Create Backend Service

Create `backend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: quote-app
  labels:
    app: backend
spec:
  selector:
    app: backend
  ports:
  - port: 3001
    targetPort: 3001
    protocol: TCP
  type: ClusterIP
```

Build and deploy backend:

```bash
# First, build the Docker image (from app/backend directory)
cd app/backend
docker build -t quote-api:latest .
cd ../..

# Apply backend resources
kubectl apply -f backend-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml

# Check deployment
kubectl get deployments
kubectl get pods -l app=backend
kubectl logs -l app=backend
```

### Part 4: Deploying the Frontend

#### Step 1: Create Frontend ConfigMap

Create `frontend-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
  namespace: quote-app
  labels:
    app: frontend
data:
  REACT_APP_API_URL: "http://backend-service:3001"
```

#### Step 2: Create Frontend Deployment

Create `frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
  namespace: quote-app
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: quote-frontend:latest
        imagePullPolicy: Never  # Use local image
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          valueFrom:
            configMapKeyRef:
              name: frontend-config
              key: REACT_APP_API_URL
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
```

#### Step 3: Create Frontend Service

Create `frontend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: quote-app
  labels:
    app: frontend
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    nodePort: 30080
  type: NodePort
```

Build and deploy frontend:

```bash
# Build the Docker image (from app/frontend directory)
cd app/frontend
docker build -t quote-frontend:latest .
cd ../..

# Apply frontend resources
kubectl apply -f frontend-configmap.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml

# Check deployment
kubectl get deployments
kubectl get services
```

### Part 5: Accessing and Testing the Application

#### Step 1: Access the Application

```bash
# Get service information
kubectl get services

# For Docker Desktop Kubernetes
open http://localhost:30080

# For Minikube
minikube service frontend-service --namespace=quote-app

# For Kind
kubectl port-forward service/frontend-service 8080:80 --namespace=quote-app
# Then open http://localhost:8080
```

#### Step 2: Test API Endpoints

```bash
# Port forward to backend service
kubectl port-forward service/backend-service 3001:3001 --namespace=quote-app &

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/quotes/random
curl http://localhost:3001/api/quotes
```

### Part 6: Kubernetes Management and Debugging

#### Step 1: Monitoring and Logging

```bash
# Watch pods in real-time
kubectl get pods --watch

# Get detailed pod information
kubectl describe pod <pod-name>

# View logs from multiple pods
kubectl logs -l app=backend --tail=50

# Follow logs in real-time
kubectl logs -f deployment/backend-deployment

# Execute commands in pods
kubectl exec -it <pod-name> -- /bin/sh
```

#### Step 2: Scaling Applications

```bash
# Scale backend deployment
kubectl scale deployment backend-deployment --replicas=3

# Scale frontend deployment
kubectl scale deployment frontend-deployment --replicas=1

# Check scaling status
kubectl get deployments
kubectl get pods
```

#### Step 3: Rolling Updates

```bash
# Update backend image
kubectl set image deployment/backend-deployment backend=quote-api:v2

# Check rollout status
kubectl rollout status deployment/backend-deployment

# View rollout history
kubectl rollout history deployment/backend-deployment

# Rollback to previous version
kubectl rollout undo deployment/backend-deployment
```

### Part 7: Advanced Kubernetes Features

#### Step 1: Resource Management

Create `resource-quota.yaml`:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: quote-app-quota
  namespace: quote-app
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 1Gi
    limits.cpu: "2"
    limits.memory: 2Gi
    pods: "10"
```

#### Step 2: Network Policies (Optional)

Create `network-policy.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quote-app-network-policy
  namespace: quote-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: quote-app
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: quote-app
```

#### Step 3: Persistent Volumes (Production-ready)

Create `postgres-pv.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /data/postgres
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: quote-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
```

## 💪 Challenge

Complete these hands-on tasks to reinforce your learning:

### Challenge 1: Basic Deployment
1. Deploy all three services (database, backend, frontend) to Kubernetes
2. Verify all pods are running and healthy
3. Test the complete application flow
4. Access the frontend through the NodePort service

### Challenge 2: Configuration Management
1. Create ConfigMaps for all environment variables
2. Use Secrets for sensitive data (passwords, API keys)
3. Update configurations without rebuilding images
4. Verify configuration changes take effect

### Challenge 3: Service Discovery and Networking
1. Understand how services communicate using DNS names
2. Test connectivity between pods using kubectl exec
3. Implement different service types (ClusterIP, NodePort)
4. Debug network connectivity issues

### Challenge 4: Scaling and Updates
1. Scale the backend to 3 replicas
2. Perform a rolling update of the backend
3. Rollback to a previous version
4. Monitor the update process

### Challenge 5: Resource Management
1. Set resource requests and limits for all containers
2. Create a ResourceQuota for the namespace
3. Monitor resource usage
4. Handle resource constraints

## ✅ Validation

Verify your implementation by checking:

- [ ] All pods are running and ready
- [ ] Services are accessible and responding
- [ ] Frontend can communicate with backend
- [ ] Backend can connect to database
- [ ] ConfigMaps and Secrets are properly configured
- [ ] Health checks are working
- [ ] Scaling operations work correctly
- [ ] Rolling updates complete successfully
- [ ] Resource limits are enforced

## 🔍 Troubleshooting

### Common Issues:

**Pods stuck in Pending state:**
```bash
# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name>

# Check resource quotas
kubectl describe quota --namespace=quote-app
```

**Image pull errors:**
```bash
# For local images, ensure imagePullPolicy: Never
# Check if image exists locally
docker images | grep quote

# Build image if missing
docker build -t quote-api:latest ./app/backend
```

**Service connectivity issues:**
```bash
# Test DNS resolution
kubectl exec -it <pod-name> -- nslookup backend-service

# Check service endpoints
kubectl get endpoints

# Test port connectivity
kubectl exec -it <pod-name> -- telnet backend-service 3001
```

**ConfigMap/Secret not updating:**
```bash
# Restart deployment to pick up changes
kubectl rollout restart deployment/backend-deployment

# Check if ConfigMap is mounted
kubectl exec -it <pod-name> -- env | grep DB_HOST
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)

## 🎉 Completion

Congratulations! You've mastered Kubernetes fundamentals. You can now:
- Deploy multi-tier applications to Kubernetes
- Manage configuration with ConfigMaps and Secrets
- Understand service discovery and networking
- Scale applications and perform rolling updates
- Debug and troubleshoot Kubernetes deployments
- Manage resources and quotas

**Next Step**: Continue to [Module 3: Deployment to Cloud Provider](../module-3-cloud-deployment/README.md)