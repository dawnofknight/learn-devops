#!/bin/bash

# Azure Kubernetes Service (AKS) Cleanup Script
# This script removes all Azure resources created for the Quote of the Day application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="quote-app-rg"
CLUSTER_NAME="quote-app-cluster"
ACR_NAME="quoteappacr"
LOCATION="eastus"

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

print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Function to confirm deletion
confirm_deletion() {
    print_header "Azure AKS Cleanup Confirmation"
    
    echo -e "${RED}WARNING: This will permanently delete the following resources:${NC}"
    echo "  • AKS Cluster: $CLUSTER_NAME"
    echo "  • Azure Container Registry: $ACR_NAME"
    echo "  • Resource Group: $RESOURCE_GROUP (and all resources within)"
    echo "  • All Kubernetes resources (pods, services, ingresses, etc.)"
    echo "  • All persistent volumes and data"
    echo "  • Application Gateway and associated resources"
    echo "  • Monitoring resources (if installed)"
    echo ""
    
    read -p "Are you sure you want to proceed? Type 'yes' to confirm: " -r
    if [[ ! $REPLY == "yes" ]]; then
        print_status "Cleanup cancelled."
        exit 0
    fi
    
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed."
        exit 1
    fi
    print_success "Azure CLI is available"
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run: az login"
        exit 1
    fi
    print_success "Logged in to Azure"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_warning "kubectl is not installed. Some cleanup steps may be skipped."
    else
        print_success "kubectl is available"
    fi
    
    echo ""
}

# Function to cleanup Kubernetes resources
cleanup_kubernetes_resources() {
    print_header "Cleaning up Kubernetes Resources"
    
    if ! command -v kubectl &> /dev/null; then
        print_warning "kubectl not available, skipping Kubernetes cleanup"
        return
    fi
    
    # Try to get cluster credentials
    if az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_status "Getting cluster credentials..."
        az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing || print_warning "Failed to get credentials"
        
        # Delete application namespace
        print_status "Deleting quote-app namespace..."
        kubectl delete namespace quote-app --ignore-not-found=true --timeout=60s || print_warning "Failed to delete quote-app namespace"
        
        # Delete monitoring namespace if it exists
        print_status "Deleting monitoring namespace..."
        kubectl delete namespace monitoring --ignore-not-found=true --timeout=60s || print_warning "Failed to delete monitoring namespace"
        
        # Delete storage classes
        print_status "Deleting custom storage classes..."
        kubectl delete storageclass azure-disk-premium --ignore-not-found=true || print_warning "Failed to delete azure-disk-premium storage class"
        kubectl delete storageclass azure-disk-standard --ignore-not-found=true || print_warning "Failed to delete azure-disk-standard storage class"
        kubectl delete storageclass azure-file-premium --ignore-not-found=true || print_warning "Failed to delete azure-file-premium storage class"
        
        print_success "Kubernetes resources cleanup completed"
    else
        print_warning "AKS cluster not found, skipping Kubernetes cleanup"
    fi
    
    echo ""
}

# Function to cleanup ACR images
cleanup_acr_images() {
    print_header "Cleaning up Azure Container Registry"
    
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_status "Deleting ACR repositories..."
        
        # Delete backend repository
        az acr repository delete --name $ACR_NAME --repository quote-api --yes || print_warning "Failed to delete quote-api repository"
        
        # Delete frontend repository
        az acr repository delete --name $ACR_NAME --repository quote-frontend --yes || print_warning "Failed to delete quote-frontend repository"
        
        print_success "ACR repositories cleaned up"
    else
        print_warning "ACR $ACR_NAME not found"
    fi
    
    echo ""
}

# Function to delete AKS cluster
delete_aks_cluster() {
    print_header "Deleting AKS Cluster"
    
    if az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_status "Deleting AKS cluster $CLUSTER_NAME..."
        print_status "This may take 10-15 minutes..."
        
        az aks delete \
            --resource-group $RESOURCE_GROUP \
            --name $CLUSTER_NAME \
            --yes \
            --no-wait
        
        print_success "AKS cluster deletion initiated"
        
        # Wait for cluster deletion to complete
        print_status "Waiting for cluster deletion to complete..."
        while az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &> /dev/null; do
            echo -n "."
            sleep 30
        done
        echo ""
        print_success "AKS cluster deleted successfully"
    else
        print_warning "AKS cluster $CLUSTER_NAME not found"
    fi
    
    echo ""
}

# Function to delete resource group
delete_resource_group() {
    print_header "Deleting Resource Group"
    
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        print_status "Deleting resource group $RESOURCE_GROUP..."
        print_status "This will delete all remaining resources in the group..."
        
        az group delete \
            --name $RESOURCE_GROUP \
            --yes \
            --no-wait
        
        print_success "Resource group deletion initiated"
        
        # Wait for resource group deletion to complete
        print_status "Waiting for resource group deletion to complete..."
        while az group show --name $RESOURCE_GROUP &> /dev/null; do
            echo -n "."
            sleep 30
        done
        echo ""
        print_success "Resource group deleted successfully"
    else
        print_warning "Resource group $RESOURCE_GROUP not found"
    fi
    
    echo ""
}

# Function to cleanup local files
cleanup_local_files() {
    print_header "Cleaning up Local Files"
    
    # Remove backup files
    if [ -f "azure-deployment.yaml.bak" ]; then
        print_status "Removing backup files..."
        rm -f azure-deployment.yaml.bak
        print_success "Backup files removed"
    fi
    
    # Remove kubectl context
    if command -v kubectl &> /dev/null; then
        print_status "Removing kubectl context..."
        kubectl config delete-context $CLUSTER_NAME || print_warning "Failed to delete kubectl context"
        kubectl config delete-cluster $CLUSTER_NAME || print_warning "Failed to delete kubectl cluster"
        kubectl config unset users.clusterUser_${RESOURCE_GROUP}_${CLUSTER_NAME} || print_warning "Failed to unset kubectl user"
    fi
    
    echo ""
}

# Function to verify cleanup
verify_cleanup() {
    print_header "Verifying Cleanup"
    
    # Check if resource group exists
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        print_warning "Resource group $RESOURCE_GROUP still exists"
        print_status "Listing remaining resources:"
        az resource list --resource-group $RESOURCE_GROUP --output table
    else
        print_success "Resource group $RESOURCE_GROUP has been deleted"
    fi
    
    # Check if ACR exists
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "ACR $ACR_NAME still exists"
    else
        print_success "ACR $ACR_NAME has been deleted"
    fi
    
    # Check if AKS cluster exists
    if az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "AKS cluster $CLUSTER_NAME still exists"
    else
        print_success "AKS cluster $CLUSTER_NAME has been deleted"
    fi
    
    echo ""
}

# Function to show cleanup status
show_cleanup_status() {
    print_header "Cleanup Status"
    
    print_status "Checking Azure resources..."
    
    # List all resource groups
    echo -e "${CYAN}Resource Groups:${NC}"
    az group list --query "[?starts_with(name, 'quote-app')].{Name:name, Location:location, State:properties.provisioningState}" --output table
    
    echo ""
    echo -e "${CYAN}AKS Clusters:${NC}"
    az aks list --query "[?starts_with(name, 'quote-app')].{Name:name, ResourceGroup:resourceGroup, Location:location, Status:powerState.code}" --output table
    
    echo ""
    echo -e "${CYAN}Container Registries:${NC}"
    az acr list --query "[?starts_with(name, 'quoteapp')].{Name:name, ResourceGroup:resourceGroup, Location:location, Status:provisioningState}" --output table
    
    echo ""
}

# Function for forced cleanup (skip confirmations)
forced_cleanup() {
    print_header "Forced Cleanup Mode"
    print_warning "Skipping confirmations and proceeding with cleanup..."
    
    check_prerequisites
    cleanup_kubernetes_resources
    cleanup_acr_images
    delete_aks_cluster
    delete_resource_group
    cleanup_local_files
    verify_cleanup
    
    print_success "Forced cleanup completed!"
}

# Function for verification only
verification_only() {
    print_header "Verification Mode"
    print_status "Checking cleanup status without making changes..."
    
    check_prerequisites
    show_cleanup_status
    verify_cleanup
}

# Function to show help
show_help() {
    echo "Azure AKS Cleanup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --force     Skip confirmation prompts and force cleanup"
    echo "  -v, --verify    Only verify cleanup status, don't delete anything"
    echo "  -s, --status    Show current status of Azure resources"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Interactive cleanup with confirmations"
    echo "  $0 --force      # Force cleanup without confirmations"
    echo "  $0 --verify     # Check cleanup status only"
    echo "  $0 --status     # Show current resource status"
    echo ""
}

# Main cleanup function
main() {
    print_header "Azure AKS Cleanup for Quote of the Day"
    echo ""
    
    confirm_deletion
    check_prerequisites
    cleanup_kubernetes_resources
    cleanup_acr_images
    delete_aks_cluster
    delete_resource_group
    cleanup_local_files
    verify_cleanup
    
    print_success "Cleanup completed successfully!"
    print_status "All Azure resources for the Quote of the Day application have been removed."
}

# Handle script interruption
trap 'print_error "Cleanup interrupted. Some resources may still exist."; exit 1' INT

# Parse command line arguments
case "${1:-}" in
    -f|--force)
        forced_cleanup
        ;;
    -v|--verify)
        verification_only
        ;;
    -s|--status)
        check_prerequisites
        show_cleanup_status
        ;;
    -h|--help)
        show_help
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac