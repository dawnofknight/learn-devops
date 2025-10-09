#!/bin/bash

# Deploy All Kubernetes Resources for Quote App
# This script deploys the complete Quote of the Day application to Kubernetes

set -e

echo "🚀 Deploying Quote of the Day Application to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your cluster connection."
    exit 1
fi

echo "✅ Kubernetes cluster is accessible"

# Build Docker images if they don't exist
echo "🔨 Building Docker images..."

# Check if backend image exists
if [[ "$(docker images -q quote-api:latest 2> /dev/null)" == "" ]]; then
    echo "Building backend image..."
    cd ../../app/backend
    docker build -t quote-api:latest .
    cd ../../modules/module-2-kubernetes-intro
else
    echo "✅ Backend image already exists"
fi

# Check if frontend image exists
if [[ "$(docker images -q quote-frontend:latest 2> /dev/null)" == "" ]]; then
    echo "Building frontend image..."
    cd ../../app/frontend
    docker build -t quote-frontend:latest .
    cd ../../modules/module-2-kubernetes-intro
else
    echo "✅ Frontend image already exists"
fi

# Deploy resources in order
echo "📦 Deploying Kubernetes resources..."

# 1. Create namespace
echo "Creating namespace..."
kubectl apply -f namespace.yaml

# 2. Deploy PostgreSQL
echo "Deploying PostgreSQL..."
kubectl apply -f postgres-configmap.yaml
kubectl apply -f postgres-secret.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml

# 3. Deploy Backend
echo "Deploying Backend API..."
kubectl apply -f backend-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml

# 4. Deploy Frontend
echo "Deploying Frontend..."
kubectl apply -f frontend-configmap.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml

# 5. Apply resource quota (optional)
echo "Applying resource quota..."
kubectl apply -f resource-quota.yaml

echo "⏳ Waiting for deployments to be ready..."

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=available --timeout=300s deployment/postgres-deployment -n quote-app

# Wait for Backend to be ready
kubectl wait --for=condition=available --timeout=300s deployment/backend-deployment -n quote-app

# Wait for Frontend to be ready
kubectl wait --for=condition=available --timeout=300s deployment/frontend-deployment -n quote-app

echo "✅ All deployments are ready!"

# Show status
echo "📊 Deployment Status:"
kubectl get pods -n quote-app
echo ""
kubectl get services -n quote-app
echo ""

# Get access information
echo "🌐 Access Information:"
echo "Frontend: http://localhost:30080"
echo "Backend API: kubectl port-forward service/backend-service 3001:3001 -n quote-app"
echo ""

# Show useful commands
echo "🔧 Useful Commands:"
echo "View logs: kubectl logs -l app=backend -n quote-app"
echo "Scale backend: kubectl scale deployment backend-deployment --replicas=3 -n quote-app"
echo "Delete all: kubectl delete namespace quote-app"
echo ""

echo "🎉 Deployment completed successfully!"
echo "Open http://localhost:30080 in your browser to access the application."