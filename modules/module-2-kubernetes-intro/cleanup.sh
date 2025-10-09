#!/bin/bash

# Cleanup Script for Quote App Kubernetes Resources
# This script removes all resources created for the Quote of the Day application

set -e

echo "🧹 Cleaning up Quote of the Day Application from Kubernetes..."

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

# Check if namespace exists
if kubectl get namespace quote-app &> /dev/null; then
    echo "🗑️  Deleting quote-app namespace and all resources..."
    kubectl delete namespace quote-app
    
    echo "⏳ Waiting for namespace deletion to complete..."
    kubectl wait --for=delete namespace/quote-app --timeout=60s
    
    echo "✅ All resources have been cleaned up!"
else
    echo "ℹ️  quote-app namespace doesn't exist. Nothing to clean up."
fi

# Optional: Clean up Docker images
read -p "Do you want to remove Docker images as well? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🐳 Removing Docker images..."
    
    if [[ "$(docker images -q quote-api:latest 2> /dev/null)" != "" ]]; then
        docker rmi quote-api:latest
        echo "✅ Removed quote-api:latest image"
    fi
    
    if [[ "$(docker images -q quote-frontend:latest 2> /dev/null)" != "" ]]; then
        docker rmi quote-frontend:latest
        echo "✅ Removed quote-frontend:latest image"
    fi
    
    echo "🧹 Docker cleanup completed!"
fi

echo "🎉 Cleanup completed successfully!"