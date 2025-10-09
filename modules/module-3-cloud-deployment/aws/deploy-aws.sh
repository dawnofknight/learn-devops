#!/bin/bash

# AWS EKS Deployment Script for Quote of the Day Application
# This script automates the deployment process to AWS EKS

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
ECR_REGISTRY=""
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

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# Function to get AWS account ID
get_account_id() {
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ -z "$ACCOUNT_ID" ]; then
        print_error "Failed to get AWS account ID. Please check your AWS credentials."
        exit 1
    fi
    ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    print_success "AWS Account ID: $ACCOUNT_ID"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    check_command "aws"
    check_command "kubectl"
    check_command "eksctl"
    check_command "docker"
    check_command "helm"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    get_account_id
    print_success "All prerequisites met!"
}

# Function to create EKS cluster
create_cluster() {
    print_status "Checking if EKS cluster exists..."
    
    if eksctl get cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
        print_warning "Cluster $CLUSTER_NAME already exists. Skipping creation."
    else
        print_status "Creating EKS cluster $CLUSTER_NAME (this may take 15-20 minutes)..."
        eksctl create cluster -f eks-cluster.yaml
        print_success "EKS cluster created successfully!"
    fi
    
    # Update kubeconfig
    print_status "Updating kubeconfig..."
    aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME
    
    # Verify cluster access
    print_status "Verifying cluster access..."
    kubectl get nodes
    print_success "Cluster is accessible!"
}

# Function to setup ECR repositories
setup_ecr() {
    print_status "Setting up ECR repositories..."
    
    # Create repositories if they don't exist
    for repo in quote-api quote-frontend; do
        if ! aws ecr describe-repositories --repository-names $repo --region $REGION &> /dev/null; then
            print_status "Creating ECR repository: $repo"
            aws ecr create-repository --repository-name $repo --region $REGION
        else
            print_warning "ECR repository $repo already exists"
        fi
    done
    
    print_success "ECR repositories are ready!"
}

# Function to build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."
    
    # Login to ECR
    print_status "Logging into ECR..."
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Build and push backend image
    print_status "Building backend image..."
    cd ../../../app/backend
    docker build -t quote-api:latest .
    docker tag quote-api:latest $ECR_REGISTRY/quote-api:latest
    docker push $ECR_REGISTRY/quote-api:latest
    cd - > /dev/null
    
    # Build and push frontend image
    print_status "Building frontend image..."
    cd ../../../app/frontend
    docker build -t quote-frontend:latest .
    docker tag quote-frontend:latest $ECR_REGISTRY/quote-frontend:latest
    docker push $ECR_REGISTRY/quote-frontend:latest
    cd - > /dev/null
    
    print_success "Docker images built and pushed successfully!"
}

# Function to install AWS Load Balancer Controller
install_alb_controller() {
    print_status "Installing AWS Load Balancer Controller..."
    
    # Check if already installed
    if kubectl get deployment -n kube-system aws-load-balancer-controller &> /dev/null; then
        print_warning "AWS Load Balancer Controller already installed"
        return
    fi
    
    # Download IAM policy
    if [ ! -f iam_policy.json ]; then
        curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json
    fi
    
    # Create IAM policy
    if ! aws iam get-policy --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy &> /dev/null; then
        aws iam create-policy \
            --policy-name AWSLoadBalancerControllerIAMPolicy \
            --policy-document file://iam_policy.json
    fi
    
    # Create service account
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=aws-load-balancer-controller \
        --role-name AmazonEKSLoadBalancerControllerRole \
        --attach-policy-arn=arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
        --approve \
        --override-existing-serviceaccounts
    
    # Install controller using Helm
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName=$CLUSTER_NAME \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller
    
    print_success "AWS Load Balancer Controller installed!"
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application to Kubernetes..."
    
    # Update deployment file with correct ECR registry
    sed "s/<ACCOUNT_ID>/$ACCOUNT_ID/g" aws-deployment.yaml > aws-deployment-updated.yaml
    
    # Apply Kubernetes manifests
    print_status "Creating namespace and deploying resources..."
    kubectl apply -f aws-deployment-updated.yaml
    
    # Wait for deployments to be ready
    print_status "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres-deployment -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=300s deployment/backend-deployment -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=300s deployment/frontend-deployment -n $NAMESPACE
    
    # Apply HPA
    print_status "Applying Horizontal Pod Autoscaler..."
    kubectl apply -f hpa.yaml
    
    # Apply Ingress
    print_status "Applying Ingress configuration..."
    kubectl apply -f aws-ingress.yaml
    
    print_success "Application deployed successfully!"
}

# Function to display status and access information
show_status() {
    print_status "Deployment Status:"
    echo
    
    # Show pods
    print_status "Pods in $NAMESPACE namespace:"
    kubectl get pods -n $NAMESPACE -o wide
    echo
    
    # Show services
    print_status "Services in $NAMESPACE namespace:"
    kubectl get services -n $NAMESPACE
    echo
    
    # Show ingress
    print_status "Ingress configuration:"
    kubectl get ingress -n $NAMESPACE
    echo
    
    # Show HPA status
    print_status "Horizontal Pod Autoscaler status:"
    kubectl get hpa -n $NAMESPACE
    echo
    
    # Get Load Balancer URL
    print_status "Getting Load Balancer URL..."
    LB_URL=$(kubectl get ingress quote-app-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Not ready yet")
    
    if [ "$LB_URL" != "Not ready yet" ] && [ ! -z "$LB_URL" ]; then
        print_success "Application is accessible at: http://$LB_URL"
        print_success "API endpoint: http://$LB_URL/api/quotes"
        print_success "Health check: http://$LB_URL/health"
    else
        print_warning "Load Balancer is still being provisioned. Check again in a few minutes:"
        echo "kubectl get ingress quote-app-ingress -n $NAMESPACE"
    fi
}

# Function to show useful commands
show_useful_commands() {
    echo
    print_status "Useful commands:"
    echo "# Check pod logs:"
    echo "kubectl logs -f deployment/backend-deployment -n $NAMESPACE"
    echo "kubectl logs -f deployment/frontend-deployment -n $NAMESPACE"
    echo
    echo "# Scale deployments:"
    echo "kubectl scale deployment backend-deployment --replicas=5 -n $NAMESPACE"
    echo
    echo "# Port forward for local testing:"
    echo "kubectl port-forward service/frontend-service 8080:80 -n $NAMESPACE"
    echo "kubectl port-forward service/backend-service 3001:3001 -n $NAMESPACE"
    echo
    echo "# Check HPA status:"
    echo "kubectl get hpa -n $NAMESPACE -w"
    echo
    echo "# Delete application:"
    echo "./cleanup-aws.sh"
}

# Main execution
main() {
    print_status "Starting AWS EKS deployment for Quote of the Day application..."
    echo
    
    check_prerequisites
    create_cluster
    setup_ecr
    build_and_push_images
    install_alb_controller
    deploy_application
    
    echo
    print_success "🎉 Deployment completed successfully!"
    echo
    
    show_status
    show_useful_commands
    
    # Cleanup temporary file
    rm -f aws-deployment-updated.yaml
}

# Run main function
main "$@"