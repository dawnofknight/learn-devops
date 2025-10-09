# Module 3: Deployment to Cloud Provider

## 🎯 Objective

Learn how to deploy containerized applications to major cloud providers (AWS EKS, Google GKE, Azure AKS) using managed Kubernetes services, including CI/CD pipelines, monitoring, and production best practices.

## 🔑 Key Concepts

- **Managed Kubernetes Services**: EKS, GKE, AKS comparison and setup
- **Cloud-Native Storage**: Persistent volumes, storage classes
- **Load Balancing**: Cloud load balancers, ingress controllers
- **Auto-scaling**: Horizontal Pod Autoscaler (HPA), Cluster Autoscaler
- **CI/CD Pipelines**: GitHub Actions, GitLab CI, Jenkins
- **Security**: RBAC, Pod Security Standards, Network Policies
- **Monitoring**: Cloud-native monitoring solutions
- **Cost Optimization**: Resource management, spot instances

## 📚 Prerequisites

- Completed Module 1 (Docker) and Module 2 (Kubernetes)
- Cloud provider account (AWS, GCP, or Azure)
- Cloud CLI tools installed (aws-cli, gcloud, or azure-cli)
- kubectl configured
- Docker Hub or cloud container registry account
- Basic understanding of cloud networking concepts

## 🛠️ Setup Options

Choose one of the following cloud providers to complete this module:

### Option A: Amazon Web Services (EKS)
### Option B: Google Cloud Platform (GKE)  
### Option C: Microsoft Azure (AKS)

---

## 🅰️ Option A: AWS EKS Deployment

### Prerequisites for AWS

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Install eksctl
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl

# Configure AWS credentials
aws configure
```

### Step 1: Create EKS Cluster

Create `eks-cluster.yaml`:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: quote-app-cluster
  region: us-west-2
  version: "1.28"

iam:
  withOIDC: true

managedNodeGroups:
  - name: quote-app-nodes
    instanceType: t3.medium
    minSize: 1
    maxSize: 4
    desiredCapacity: 2
    volumeSize: 20
    ssh:
      allow: true
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true
        efs: true
        albIngress: true

addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy
  - name: aws-ebs-csi-driver
```

Deploy the cluster:

```bash
# Create EKS cluster (takes 15-20 minutes)
eksctl create cluster -f eks-cluster.yaml

# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name quote-app-cluster

# Verify cluster
kubectl get nodes
```

### Step 2: Set up Container Registry

```bash
# Create ECR repository
aws ecr create-repository --repository-name quote-api --region us-west-2
aws ecr create-repository --repository-name quote-frontend --region us-west-2

# Get login token
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

# Tag and push images
docker tag quote-api:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-api:latest
docker tag quote-frontend:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-frontend:latest

docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-api:latest
docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-frontend:latest
```

### Step 3: Deploy Application with AWS-specific configurations

Create `aws-deployment.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quote-app
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-storage
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: quote-app
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3-storage
  resources:
    requests:
      storage: 10Gi
---
# PostgreSQL Deployment with EBS volume
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
  namespace: quote-app
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
        env:
        - name: POSTGRES_DB
          value: quotes_db
        - name: POSTGRES_USER
          value: quotes_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        ports:
        - containerPort: 5432
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
# Backend Deployment with ECR images
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
  namespace: quote-app
spec:
  replicas: 3
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
        image: <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-api:latest
        env:
        - name: DB_HOST
          value: postgres-service
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
# Frontend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
  namespace: quote-app
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
        image: <account-id>.dkr.ecr.us-west-2.amazonaws.com/quote-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
```

### Step 4: Set up Application Load Balancer

Install AWS Load Balancer Controller:

```bash
# Create IAM policy
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=quote-app-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::<account-id>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install controller
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=quote-app-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

Create `aws-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: quote-app-ingress
  namespace: quote-app
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
spec:
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3001
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

---

## 🅱️ Option B: Google Cloud GKE Deployment

### Prerequisites for GCP

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth application-default login

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 1: Create GKE Cluster

```bash
# Set project and zone
export PROJECT_ID=your-project-id
export ZONE=us-central1-a

# Create GKE cluster
gcloud container clusters create quote-app-cluster \
    --zone=$ZONE \
    --machine-type=e2-medium \
    --num-nodes=2 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=4 \
    --enable-autorepair \
    --enable-autoupgrade \
    --disk-size=20GB

# Get credentials
gcloud container clusters get-credentials quote-app-cluster --zone=$ZONE
```

### Step 2: Set up Container Registry

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Tag and push images
docker tag quote-api:latest gcr.io/$PROJECT_ID/quote-api:latest
docker tag quote-frontend:latest gcr.io/$PROJECT_ID/quote-frontend:latest

docker push gcr.io/$PROJECT_ID/quote-api:latest
docker push gcr.io/$PROJECT_ID/quote-frontend:latest
```

### Step 3: Deploy with GCP-specific configurations

Create `gcp-deployment.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quote-app
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ssd-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: quote-app
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ssd-storage
  resources:
    requests:
      storage: 10Gi
---
# Application deployments with GCR images
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
  namespace: quote-app
spec:
  replicas: 3
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
        image: gcr.io/PROJECT_ID/quote-api:latest
        # ... rest of configuration
```

---

## 🅲 Option C: Azure AKS Deployment

### Prerequisites for Azure

```bash
# Install Azure CLI
brew install azure-cli

# Login to Azure
az login

# Create resource group
az group create --name quote-app-rg --location eastus

# Create AKS cluster
az aks create \
    --resource-group quote-app-rg \
    --name quote-app-cluster \
    --node-count 2 \
    --enable-addons monitoring \
    --generate-ssh-keys \
    --node-vm-size Standard_B2s

# Get credentials
az aks get-credentials --resource-group quote-app-rg --name quote-app-cluster
```

---

## 🔄 CI/CD Pipeline Setup

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push Backend image
      uses: docker/build-push-action@v5
      with:
        context: ./app/backend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/quote-api:${{ github.sha }}

    - name: Build and push Frontend image
      uses: docker/build-push-action@v5
      with:
        context: ./app/frontend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/quote-frontend:${{ github.sha }}

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG }}

    - name: Deploy to Kubernetes
      run: |
        # Update image tags in deployment files
        sed -i 's|IMAGE_TAG|${{ github.sha }}|g' k8s/production/*.yaml
        
        # Apply configurations
        kubectl apply -f k8s/production/
        
        # Wait for rollout
        kubectl rollout status deployment/backend-deployment -n quote-app
        kubectl rollout status deployment/frontend-deployment -n quote-app
```

## 📊 Monitoring and Observability

### Prometheus and Grafana Setup

Create `monitoring-stack.yaml`:

```yaml
# Prometheus ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
---
# Grafana Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin123
```

## 🔒 Security Best Practices

### RBAC Configuration

Create `rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: quote-app-sa
  namespace: quote-app
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: quote-app
  name: quote-app-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: quote-app-binding
  namespace: quote-app
subjects:
- kind: ServiceAccount
  name: quote-app-sa
  namespace: quote-app
roleRef:
  kind: Role
  name: quote-app-role
  apiGroup: rbac.authorization.k8s.io
```

### Network Policies

Create `network-policies.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: quote-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: quote-app
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3001
```

## 📈 Auto-scaling Configuration

### Horizontal Pod Autoscaler

Create `hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: quote-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 💪 Challenges

### Challenge 1: Multi-Cloud Deployment
1. Deploy the application to two different cloud providers
2. Compare performance, costs, and features
3. Implement cross-cloud disaster recovery

### Challenge 2: Blue-Green Deployment
1. Implement blue-green deployment strategy
2. Set up automated rollback on failure
3. Test with zero-downtime updates

### Challenge 3: Cost Optimization
1. Implement cluster autoscaling
2. Use spot instances where appropriate
3. Set up cost monitoring and alerts

### Challenge 4: Security Hardening
1. Implement Pod Security Standards
2. Set up image vulnerability scanning
3. Configure secrets management with cloud KMS

### Challenge 5: Observability Stack
1. Deploy complete monitoring stack (Prometheus, Grafana, Jaeger)
2. Set up custom dashboards and alerts
3. Implement distributed tracing

## ✅ Validation Checklist

- [ ] Cluster is created and accessible
- [ ] Container images are pushed to cloud registry
- [ ] Application is deployed and running
- [ ] Load balancer/Ingress is configured
- [ ] Auto-scaling is working
- [ ] Monitoring is set up
- [ ] CI/CD pipeline is functional
- [ ] Security policies are applied
- [ ] Backup and disaster recovery tested

## 🔍 Troubleshooting

### Common Issues:

**Cluster creation fails:**
```bash
# Check quotas and limits
aws service-quotas get-service-quota --service-code eks --quota-code L-1194D53C
gcloud compute project-info describe --project=$PROJECT_ID
az vm list-usage --location eastus
```

**Image pull errors:**
```bash
# Check registry authentication
kubectl create secret docker-registry regcred \
  --docker-server=<registry-url> \
  --docker-username=<username> \
  --docker-password=<password>
```

**Load balancer not working:**
```bash
# Check ingress controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

## 📚 Additional Resources

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [GKE Best Practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [AKS Best Practices](https://docs.microsoft.com/en-us/azure/aks/best-practices)
- [Kubernetes Production Best Practices](https://kubernetes.io/docs/setup/best-practices/)

## 🎉 Completion

Congratulations! You've successfully deployed a production-ready application to a cloud Kubernetes service. You now understand:

- Cloud-managed Kubernetes services
- Container registry integration
- Production deployment strategies
- Auto-scaling and load balancing
- Security best practices
- Monitoring and observability
- CI/CD pipeline implementation

**Next Step**: Continue to [Module 4: Performance Testing with k6](../module-4-performance-testing/README.md)