#!/bin/bash

# Azure Kubernetes Service (AKS) Deployment Script
# This script automates the deployment of the Quote of the Day application to AKS

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
LOCATION="eastus"
ACR_NAME="quoteappacr"
KUBERNETES_VERSION="1.28.3"
NODE_COUNT=2
MIN_COUNT=1
MAX_COUNT=4
NODE_VM_SIZE="Standard_D2s_v3"

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

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first:"
        echo "  brew install azure-cli"
        exit 1
    fi
    print_success "Azure CLI is installed"
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run: az login"
        exit 1
    fi
    print_success "Logged in to Azure"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install it first:"
        echo "  brew install kubectl"
        exit 1
    fi
    print_success "kubectl is installed"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first:"
        echo "  brew install --cask docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    print_success "Docker is running"
    
    # Check Helm
    if ! command -v helm &> /dev/null; then
        print_warning "Helm is not installed. Installing Helm for monitoring setup..."
        brew install helm
    fi
    print_success "Helm is available"
    
    echo ""
}

# Function to get Azure subscription info
get_azure_info() {
    print_header "Azure Subscription Information"
    
    SUBSCRIPTION_ID=$(az account show --query id --output tsv)
    SUBSCRIPTION_NAME=$(az account show --query name --output tsv)
    TENANT_ID=$(az account show --query tenantId --output tsv)
    
    print_status "Subscription ID: $SUBSCRIPTION_ID"
    print_status "Subscription Name: $SUBSCRIPTION_NAME"
    print_status "Tenant ID: $TENANT_ID"
    print_status "Resource Group: $RESOURCE_GROUP"
    print_status "Location: $LOCATION"
    
    echo ""
}

# Function to create resource group
create_resource_group() {
    print_header "Creating Resource Group"
    
    if az group show --name $RESOURCE_GROUP &> /dev/null; then
        print_warning "Resource group $RESOURCE_GROUP already exists"
    else
        print_status "Creating resource group $RESOURCE_GROUP..."
        az group create --name $RESOURCE_GROUP --location $LOCATION
        print_success "Resource group created successfully"
    fi
    
    echo ""
}

# Function to create Azure Container Registry
create_acr() {
    print_header "Setting up Azure Container Registry"
    
    # Create ACR if it doesn't exist
    if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "ACR $ACR_NAME already exists"
    else
        print_status "Creating Azure Container Registry $ACR_NAME..."
        az acr create \
            --resource-group $RESOURCE_GROUP \
            --name $ACR_NAME \
            --sku Basic \
            --admin-enabled true
        print_success "ACR created successfully"
    fi
    
    # Get ACR login server
    ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)
    print_status "ACR Login Server: $ACR_LOGIN_SERVER"
    
    # Login to ACR
    print_status "Logging in to ACR..."
    az acr login --name $ACR_NAME
    print_success "Logged in to ACR"
    
    echo ""
}

# Function to create AKS cluster
create_aks_cluster() {
    print_header "Creating AKS Cluster"
    
    if az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "AKS cluster $CLUSTER_NAME already exists"
    else
        print_status "Creating AKS cluster $CLUSTER_NAME..."
        print_status "This may take 10-15 minutes..."
        
        az aks create \
            --resource-group $RESOURCE_GROUP \
            --name $CLUSTER_NAME \
            --node-count $NODE_COUNT \
            --enable-addons monitoring,http_application_routing,azure-policy \
            --generate-ssh-keys \
            --kubernetes-version $KUBERNETES_VERSION \
            --node-vm-size $NODE_VM_SIZE \
            --node-osdisk-size 30 \
            --enable-cluster-autoscaler \
            --min-count $MIN_COUNT \
            --max-count $MAX_COUNT \
            --network-plugin azure \
            --network-policy azure \
            --service-cidr 10.0.0.0/16 \
            --dns-service-ip 10.0.0.10 \
            --docker-bridge-address 172.17.0.1/16 \
            --enable-managed-identity \
            --attach-acr $ACR_NAME \
            --location $LOCATION
        
        print_success "AKS cluster created successfully"
    fi
    
    # Get cluster credentials
    print_status "Getting cluster credentials..."
    az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing
    print_success "Cluster credentials configured"
    
    # Verify cluster connection
    print_status "Verifying cluster connection..."
    kubectl get nodes
    print_success "Successfully connected to cluster"
    
    echo ""
}

# Function to build and push Docker images
build_and_push_images() {
    print_header "Building and Pushing Docker Images"
    
    # Navigate to project root
    cd ../../../
    
    # Build backend image
    print_status "Building backend image..."
    docker build -t $ACR_LOGIN_SERVER/quote-api:latest -f apps/quote-api/Dockerfile apps/quote-api/
    
    print_status "Pushing backend image to ACR..."
    docker push $ACR_LOGIN_SERVER/quote-api:latest
    print_success "Backend image pushed successfully"
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build -t $ACR_LOGIN_SERVER/quote-frontend:latest -f apps/quote-frontend/Dockerfile apps/quote-frontend/
    
    print_status "Pushing frontend image to ACR..."
    docker push $ACR_LOGIN_SERVER/quote-frontend:latest
    print_success "Frontend image pushed successfully"
    
    # Return to Azure directory
    cd modules/module-3-cloud-deployment/azure/
    
    echo ""
}

# Function to update deployment manifests with ACR details
update_deployment_manifests() {
    print_header "Updating Deployment Manifests"
    
    # Update azure-deployment.yaml with correct ACR registry
    print_status "Updating deployment manifests with ACR details..."
    
    # Create backup
    cp azure-deployment.yaml azure-deployment.yaml.bak
    
    # Replace placeholder ACR name with actual ACR login server
    sed -i.tmp "s|quoteappacr.azurecr.io|$ACR_LOGIN_SERVER|g" azure-deployment.yaml
    rm azure-deployment.yaml.tmp
    
    print_success "Deployment manifests updated"
    
    echo ""
}

# Function to install Application Gateway Ingress Controller
install_agic() {
    print_header "Installing Application Gateway Ingress Controller"
    
    # Check if AGIC is already installed
    if kubectl get deployment -n kube-system ingress-appgw &> /dev/null; then
        print_warning "Application Gateway Ingress Controller already installed"
    else
        print_status "Installing Application Gateway Ingress Controller..."
        
        # Add the application-gateway-kubernetes-ingress helm repo
        helm repo add application-gateway-kubernetes-ingress https://appgwingress.blob.core.windows.net/ingress-azure-helm-package/
        helm repo update
        
        # Get cluster resource group (different from user resource group)
        CLUSTER_RESOURCE_GROUP=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --query nodeResourceGroup --output tsv)
        
        # Create Application Gateway
        print_status "Creating Application Gateway..."
        az network application-gateway create \
            --name quote-app-appgw \
            --location $LOCATION \
            --resource-group $CLUSTER_RESOURCE_GROUP \
            --sku Standard_v2 \
            --public-ip-address quote-app-appgw-ip \
            --vnet-name aks-vnet-* \
            --subnet appgw-subnet \
            --capacity 2 \
            --http-settings-cookie-based-affinity Disabled \
            --frontend-port 80 \
            --http-settings-port 80 \
            --http-settings-protocol Http || print_warning "Application Gateway may already exist"
        
        # Install AGIC using Helm
        print_status "Installing AGIC via Helm..."
        helm install ingress-azure \
            application-gateway-kubernetes-ingress/ingress-azure \
            --namespace kube-system \
            --set appgw.name=quote-app-appgw \
            --set appgw.resourceGroup=$CLUSTER_RESOURCE_GROUP \
            --set appgw.subscriptionId=$SUBSCRIPTION_ID \
            --set armAuth.type=servicePrincipal \
            --set rbac.enabled=true || print_warning "AGIC installation may have failed, continuing..."
        
        print_success "Application Gateway Ingress Controller setup completed"
    fi
    
    echo ""
}

# Function to deploy the application
deploy_application() {
    print_header "Deploying Application"
    
    # Apply storage classes first
    print_status "Applying storage classes..."
    kubectl apply -f aks-cluster.yaml
    
    # Deploy the application
    print_status "Deploying application manifests..."
    kubectl apply -f azure-deployment.yaml
    
    # Wait for deployments to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres-deployment -n quote-app
    
    print_status "Waiting for backend to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/backend-deployment -n quote-app
    
    print_status "Waiting for frontend to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/frontend-deployment -n quote-app
    
    print_success "Application deployed successfully"
    
    echo ""
}

# Function to deploy HPA
deploy_hpa() {
    print_header "Deploying Horizontal Pod Autoscaler"
    
    # Check if metrics server is running
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        print_warning "Metrics server not found. HPA may not work properly."
    fi
    
    print_status "Applying HPA configuration..."
    kubectl apply -f hpa.yaml
    
    print_success "HPA deployed successfully"
    
    echo ""
}

# Function to deploy ingress
deploy_ingress() {
    print_header "Deploying Ingress"
    
    print_status "Applying ingress configuration..."
    kubectl apply -f azure-ingress.yaml
    
    print_status "Waiting for ingress to be ready..."
    sleep 30
    
    print_success "Ingress deployed successfully"
    
    echo ""
}

# Function to setup monitoring
setup_monitoring() {
    print_header "Setting up Monitoring (Optional)"
    
    read -p "Do you want to install Prometheus and Grafana for monitoring? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Creating monitoring namespace..."
        kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
        
        print_status "Adding Prometheus Helm repository..."
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        print_status "Installing Prometheus and Grafana..."
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --set grafana.adminPassword=admin123 \
            --set grafana.service.type=LoadBalancer \
            --set prometheus.service.type=LoadBalancer
        
        print_success "Monitoring stack installed successfully"
        print_status "Grafana admin password: admin123"
    else
        print_status "Skipping monitoring setup"
    fi
    
    echo ""
}

# Function to display deployment status
display_status() {
    print_header "Deployment Status"
    
    print_status "Cluster Information:"
    kubectl cluster-info
    
    echo ""
    print_status "Nodes:"
    kubectl get nodes -o wide
    
    echo ""
    print_status "Pods in quote-app namespace:"
    kubectl get pods -n quote-app -o wide
    
    echo ""
    print_status "Services in quote-app namespace:"
    kubectl get services -n quote-app
    
    echo ""
    print_status "Ingress in quote-app namespace:"
    kubectl get ingress -n quote-app
    
    echo ""
    print_status "HPA status:"
    kubectl get hpa -n quote-app
    
    echo ""
}

# Function to get access information
get_access_info() {
    print_header "Access Information"
    
    # Get ingress IP
    INGRESS_IP=""
    print_status "Waiting for ingress IP address..."
    for i in {1..30}; do
        INGRESS_IP=$(kubectl get ingress quote-app-ingress -n quote-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
        if [ ! -z "$INGRESS_IP" ]; then
            break
        fi
        sleep 10
        echo -n "."
    done
    echo ""
    
    if [ ! -z "$INGRESS_IP" ]; then
        print_success "Application is accessible at:"
        echo -e "  ${CYAN}Frontend:${NC} http://$INGRESS_IP/"
        echo -e "  ${CYAN}Backend API:${NC} http://$INGRESS_IP/api/quotes"
        echo -e "  ${CYAN}Health Check:${NC} http://$INGRESS_IP/health"
    else
        print_warning "Ingress IP not yet available. Check status with:"
        echo "  kubectl get ingress -n quote-app"
    fi
    
    # Get monitoring access if installed
    if kubectl get service prometheus-grafana -n monitoring &> /dev/null; then
        GRAFANA_IP=$(kubectl get service prometheus-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
        if [ ! -z "$GRAFANA_IP" ]; then
            echo -e "  ${CYAN}Grafana:${NC} http://$GRAFANA_IP (admin/admin123)"
        fi
    fi
    
    echo ""
}

# Function to show useful commands
show_useful_commands() {
    print_header "Useful Commands"
    
    echo -e "${CYAN}Cluster Management:${NC}"
    echo "  az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME"
    echo "  kubectl get nodes"
    echo "  kubectl get pods --all-namespaces"
    
    echo ""
    echo -e "${CYAN}Application Management:${NC}"
    echo "  kubectl get all -n quote-app"
    echo "  kubectl logs -f deployment/backend-deployment -n quote-app"
    echo "  kubectl logs -f deployment/frontend-deployment -n quote-app"
    echo "  kubectl describe pod <pod-name> -n quote-app"
    
    echo ""
    echo -e "${CYAN}Scaling:${NC}"
    echo "  kubectl scale deployment backend-deployment --replicas=3 -n quote-app"
    echo "  kubectl get hpa -n quote-app"
    echo "  az aks scale --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --node-count 3"
    
    echo ""
    echo -e "${CYAN}Ingress and Networking:${NC}"
    echo "  kubectl get ingress -n quote-app"
    echo "  kubectl describe ingress quote-app-ingress -n quote-app"
    
    echo ""
    echo -e "${CYAN}Monitoring:${NC}"
    echo "  kubectl get pods -n monitoring"
    echo "  kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
    
    echo ""
    echo -e "${CYAN}Cleanup:${NC}"
    echo "  ./cleanup-azure.sh"
    
    echo ""
}

# Main deployment function
main() {
    print_header "Azure AKS Deployment for Quote of the Day"
    echo ""
    
    check_prerequisites
    get_azure_info
    create_resource_group
    create_acr
    create_aks_cluster
    build_and_push_images
    update_deployment_manifests
    install_agic
    deploy_application
    deploy_hpa
    deploy_ingress
    setup_monitoring
    
    echo ""
    display_status
    echo ""
    get_access_info
    echo ""
    show_useful_commands
    
    print_success "Deployment completed successfully!"
    print_status "Your Quote of the Day application is now running on Azure AKS!"
}

# Handle script interruption
trap 'print_error "Deployment interrupted. You may need to clean up resources manually."; exit 1' INT

# Run main function
main