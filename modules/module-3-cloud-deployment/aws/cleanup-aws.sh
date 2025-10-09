#!/bin/bash

# AWS EKS Cleanup Script for Quote of the Day Application
# This script removes all AWS resources created for the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="quote-app-cluster"
REGION="us-west-2"
NAMESPACE="quote-app"
ACCOUNT_ID=""

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

# Function to get AWS account ID
get_account_id() {
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    if [ -z "$ACCOUNT_ID" ]; then
        print_warning "Could not get AWS account ID. Some cleanup operations may fail."
    else
        print_status "AWS Account ID: $ACCOUNT_ID"
    fi
}

# Function to confirm deletion
confirm_deletion() {
    echo
    print_warning "This will delete the following AWS resources:"
    echo "  - EKS Cluster: $CLUSTER_NAME"
    echo "  - All Kubernetes resources in namespace: $NAMESPACE"
    echo "  - ECR repositories: quote-api, quote-frontend"
    echo "  - IAM roles and policies for Load Balancer Controller"
    echo "  - Any associated Load Balancers and Security Groups"
    echo
    
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Cleanup cancelled."
        exit 0
    fi
}

# Function to delete Kubernetes resources
delete_k8s_resources() {
    print_status "Deleting Kubernetes resources..."
    
    # Check if cluster exists and is accessible
    if ! kubectl cluster-info &> /dev/null; then
        print_warning "Cannot access Kubernetes cluster. Skipping Kubernetes resource cleanup."
        return
    fi
    
    # Delete ingress first to remove load balancers
    print_status "Deleting ingress resources..."
    kubectl delete ingress --all -n $NAMESPACE --ignore-not-found=true
    
    # Wait for load balancers to be deleted
    print_status "Waiting for load balancers to be deleted..."
    sleep 30
    
    # Delete namespace (this will delete all resources in the namespace)
    print_status "Deleting namespace $NAMESPACE..."
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    # Delete AWS Load Balancer Controller
    print_status "Deleting AWS Load Balancer Controller..."
    helm uninstall aws-load-balancer-controller -n kube-system --ignore-not-found || true
    
    print_success "Kubernetes resources deleted!"
}

# Function to delete ECR repositories
delete_ecr_repositories() {
    print_status "Deleting ECR repositories..."
    
    for repo in quote-api quote-frontend; do
        if aws ecr describe-repositories --repository-names $repo --region $REGION &> /dev/null; then
            print_status "Deleting ECR repository: $repo"
            # Delete all images first
            aws ecr list-images --repository-name $repo --region $REGION --query 'imageIds[*]' --output json | \
            jq '.[] | select(.imageTag != null) | {imageTag: .imageTag}' | \
            aws ecr batch-delete-image --repository-name $repo --region $REGION --image-ids file:///dev/stdin || true
            
            # Delete repository
            aws ecr delete-repository --repository-name $repo --region $REGION --force
        else
            print_warning "ECR repository $repo not found"
        fi
    done
    
    print_success "ECR repositories deleted!"
}

# Function to delete IAM resources
delete_iam_resources() {
    print_status "Deleting IAM resources..."
    
    if [ ! -z "$ACCOUNT_ID" ]; then
        # Delete IAM policy
        if aws iam get-policy --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy &> /dev/null; then
            print_status "Deleting IAM policy: AWSLoadBalancerControllerIAMPolicy"
            aws iam delete-policy --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy
        fi
        
        # Delete IAM role (eksctl will handle this when deleting the cluster)
        print_status "IAM role will be deleted with the cluster"
    fi
    
    print_success "IAM resources cleanup initiated!"
}

# Function to delete EKS cluster
delete_eks_cluster() {
    print_status "Deleting EKS cluster..."
    
    if eksctl get cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
        print_status "Deleting EKS cluster $CLUSTER_NAME (this may take 10-15 minutes)..."
        eksctl delete cluster --name $CLUSTER_NAME --region $REGION --wait
        print_success "EKS cluster deleted successfully!"
    else
        print_warning "EKS cluster $CLUSTER_NAME not found"
    fi
}

# Function to cleanup local files
cleanup_local_files() {
    print_status "Cleaning up local files..."
    
    # Remove temporary files
    rm -f iam_policy.json
    rm -f aws-deployment-updated.yaml
    
    print_success "Local cleanup completed!"
}

# Function to verify cleanup
verify_cleanup() {
    print_status "Verifying cleanup..."
    
    # Check if cluster still exists
    if eksctl get cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
        print_warning "EKS cluster still exists"
    else
        print_success "EKS cluster successfully deleted"
    fi
    
    # Check ECR repositories
    for repo in quote-api quote-frontend; do
        if aws ecr describe-repositories --repository-names $repo --region $REGION &> /dev/null; then
            print_warning "ECR repository $repo still exists"
        else
            print_success "ECR repository $repo successfully deleted"
        fi
    done
}

# Main execution
main() {
    print_status "Starting AWS EKS cleanup for Quote of the Day application..."
    echo
    
    get_account_id
    confirm_deletion
    
    delete_k8s_resources
    delete_ecr_repositories
    delete_iam_resources
    delete_eks_cluster
    cleanup_local_files
    
    echo
    verify_cleanup
    
    echo
    print_success "🎉 Cleanup completed successfully!"
    echo
    print_status "Note: It may take a few minutes for all AWS resources to be fully removed."
    print_status "You can verify in the AWS Console that all resources have been deleted."
    echo
    print_status "Estimated cost savings: All AWS resources have been terminated."
}

# Handle script interruption
trap 'print_error "Cleanup interrupted. Some resources may still exist."; exit 1' INT TERM

# Run main function
main "$@"