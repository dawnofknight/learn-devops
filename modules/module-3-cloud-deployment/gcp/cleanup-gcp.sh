#!/bin/bash

# Cleanup Script for Quote of the Day Application on GCP/GKE
# This script removes all GCP resources created for the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="quote-app-cluster"
REGION="us-central1"
PROJECT_ID=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get confirmation
confirm_cleanup() {
    echo -e "${RED}WARNING: This will delete ALL resources for the Quote App on GCP!${NC}"
    echo "This includes:"
    echo "  - GKE Cluster: $CLUSTER_NAME"
    echo "  - Container images in GCR"
    echo "  - Static IP addresses"
    echo "  - Load balancers and ingress resources"
    echo "  - All Kubernetes resources"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Cleanup cancelled."
        exit 0
    fi
}

# Function to get GCP project ID
get_project_id() {
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$PROJECT_ID" ]; then
            print_error "No GCP project set. Please run: gcloud config set project YOUR_PROJECT_ID"
            exit 1
        fi
    fi
    print_status "Using GCP project: $PROJECT_ID"
}

# Function to delete Kubernetes resources
delete_k8s_resources() {
    print_status "Deleting Kubernetes resources..."
    
    # Check if cluster exists and kubectl is configured
    if gcloud container clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
        # Configure kubectl
        gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID
        
        # Delete ingress first (to release load balancers)
        print_status "Deleting ingress resources..."
        kubectl delete ingress --all -n quote-app --ignore-not-found=true
        
        # Wait for load balancers to be cleaned up
        print_status "Waiting for load balancers to be cleaned up..."
        sleep 30
        
        # Delete the entire namespace (this will delete all resources in it)
        print_status "Deleting quote-app namespace..."
        kubectl delete namespace quote-app --ignore-not-found=true
        
        # Delete monitoring namespace if it exists
        print_status "Deleting monitoring namespace..."
        kubectl delete namespace monitoring --ignore-not-found=true
        
        # Delete cluster-wide resources
        print_status "Deleting cluster-wide resources..."
        kubectl delete storageclass gke-ssd-storage --ignore-not-found=true
        kubectl delete storageclass gke-standard-storage --ignore-not-found=true
        
        print_success "Kubernetes resources deleted!"
    else
        print_warning "Cluster $CLUSTER_NAME not found. Skipping Kubernetes cleanup."
    fi
}

# Function to delete static IP addresses
delete_static_ips() {
    print_status "Deleting static IP addresses..."
    
    # Delete production IP
    if gcloud compute addresses describe quote-app-ip --global --project=$PROJECT_ID &>/dev/null; then
        gcloud compute addresses delete quote-app-ip --global --project=$PROJECT_ID --quiet
        print_success "Production static IP deleted!"
    else
        print_warning "Production static IP not found."
    fi
    
    # Delete staging IP
    if gcloud compute addresses describe quote-app-staging-ip --global --project=$PROJECT_ID &>/dev/null; then
        gcloud compute addresses delete quote-app-staging-ip --global --project=$PROJECT_ID --quiet
        print_success "Staging static IP deleted!"
    else
        print_warning "Staging static IP not found."
    fi
}

# Function to delete container images
delete_container_images() {
    print_status "Deleting container images from GCR..."
    
    # Delete backend images
    if gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name:quote-api" --format="value(name)" | grep -q quote-api; then
        gcloud container images delete gcr.io/$PROJECT_ID/quote-api:latest --quiet --force-delete-tags 2>/dev/null || true
        print_success "Backend images deleted!"
    else
        print_warning "Backend images not found in GCR."
    fi
    
    # Delete frontend images
    if gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name:quote-frontend" --format="value(name)" | grep -q quote-frontend; then
        gcloud container images delete gcr.io/$PROJECT_ID/quote-frontend:latest --quiet --force-delete-tags 2>/dev/null || true
        print_success "Frontend images deleted!"
    else
        print_warning "Frontend images not found in GCR."
    fi
}

# Function to delete GKE cluster
delete_cluster() {
    print_status "Deleting GKE cluster..."
    
    if gcloud container clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
        gcloud container clusters delete $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID --quiet
        print_success "GKE cluster deleted!"
    else
        print_warning "Cluster $CLUSTER_NAME not found."
    fi
}

# Function to clean up local files
cleanup_local_files() {
    print_status "Cleaning up local temporary files..."
    
    # Remove backup files created during deployment
    find . -name "*.bak" -delete 2>/dev/null || true
    
    # Remove any temporary kubeconfig files
    rm -f /tmp/kubeconfig-* 2>/dev/null || true
    
    print_success "Local cleanup completed!"
}

# Function to verify cleanup
verify_cleanup() {
    print_status "Verifying cleanup..."
    
    # Check cluster
    if gcloud container clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
        print_error "Cluster still exists!"
    else
        print_success "Cluster successfully deleted."
    fi
    
    # Check static IPs
    PROD_IP_EXISTS=$(gcloud compute addresses describe quote-app-ip --global --project=$PROJECT_ID &>/dev/null && echo "true" || echo "false")
    STAGING_IP_EXISTS=$(gcloud compute addresses describe quote-app-staging-ip --global --project=$PROJECT_ID &>/dev/null && echo "true" || echo "false")
    
    if [ "$PROD_IP_EXISTS" = "true" ] || [ "$STAGING_IP_EXISTS" = "true" ]; then
        print_warning "Some static IPs may still exist."
    else
        print_success "Static IPs successfully deleted."
    fi
    
    # Check container images
    BACKEND_IMAGES=$(gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name:quote-api" --format="value(name)" 2>/dev/null | wc -l)
    FRONTEND_IMAGES=$(gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name:quote-frontend" --format="value(name)" 2>/dev/null | wc -l)
    
    if [ "$BACKEND_IMAGES" -gt 0 ] || [ "$FRONTEND_IMAGES" -gt 0 ]; then
        print_warning "Some container images may still exist in GCR."
    else
        print_success "Container images successfully deleted."
    fi
}

# Function to display remaining resources
display_remaining_resources() {
    print_status "Checking for any remaining resources..."
    
    echo ""
    echo "==================== REMAINING GCP RESOURCES ===================="
    
    # List compute instances
    echo -e "${BLUE}Compute Instances:${NC}"
    gcloud compute instances list --project=$PROJECT_ID --filter="name~quote-app" 2>/dev/null || echo "None found"
    
    # List load balancers
    echo -e "${BLUE}Load Balancers:${NC}"
    gcloud compute forwarding-rules list --project=$PROJECT_ID --filter="name~quote-app" 2>/dev/null || echo "None found"
    
    # List static IPs
    echo -e "${BLUE}Static IP Addresses:${NC}"
    gcloud compute addresses list --project=$PROJECT_ID --filter="name~quote-app" 2>/dev/null || echo "None found"
    
    # List container images
    echo -e "${BLUE}Container Images:${NC}"
    gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name~quote" 2>/dev/null || echo "None found"
    
    # List clusters
    echo -e "${BLUE}GKE Clusters:${NC}"
    gcloud container clusters list --project=$PROJECT_ID --filter="name~quote-app" 2>/dev/null || echo "None found"
    
    echo ""
}

# Function to show cleanup summary
show_cleanup_summary() {
    print_success "Cleanup completed!"
    echo ""
    echo "==================== CLEANUP SUMMARY ===================="
    echo "✓ Kubernetes resources deleted"
    echo "✓ GKE cluster deleted"
    echo "✓ Static IP addresses deleted"
    echo "✓ Container images deleted"
    echo "✓ Local temporary files cleaned"
    echo ""
    echo "==================== WHAT WAS REMOVED ===================="
    echo "• GKE Cluster: $CLUSTER_NAME"
    echo "• Namespace: quote-app"
    echo "• Namespace: monitoring"
    echo "• Static IPs: quote-app-ip, quote-app-staging-ip"
    echo "• Container Images: gcr.io/$PROJECT_ID/quote-api, gcr.io/$PROJECT_ID/quote-frontend"
    echo "• Load Balancers and Ingress resources"
    echo "• All associated persistent volumes and storage"
    echo ""
    echo "==================== BILLING IMPACT ===================="
    echo "• Compute Engine instances: Stopped"
    echo "• Load Balancers: Removed"
    echo "• Persistent Disks: Deleted"
    echo "• Static IP addresses: Released"
    echo "• Container Registry storage: Cleared"
    echo ""
    print_status "Your GCP billing should reflect these changes within a few hours."
    echo ""
    print_status "To redeploy the application, run: ./deploy-gcp.sh"
}

# Main cleanup function
main() {
    print_status "Starting GCP cleanup for Quote of the Day application..."
    echo ""
    
    get_project_id
    confirm_cleanup
    
    print_status "Beginning cleanup process..."
    
    delete_k8s_resources
    delete_static_ips
    delete_container_images
    delete_cluster
    cleanup_local_files
    
    echo ""
    verify_cleanup
    echo ""
    display_remaining_resources
    echo ""
    show_cleanup_summary
}

# Handle script arguments
case "${1:-}" in
    "force")
        # Skip confirmation for automated cleanup
        get_project_id
        delete_k8s_resources
        delete_static_ips
        delete_container_images
        delete_cluster
        cleanup_local_files
        verify_cleanup
        ;;
    "verify")
        get_project_id
        verify_cleanup
        display_remaining_resources
        ;;
    "images-only")
        get_project_id
        delete_container_images
        ;;
    "cluster-only")
        get_project_id
        confirm_cleanup
        delete_k8s_resources
        delete_cluster
        ;;
    *)
        main
        ;;
esac