#!/bin/bash

# Deploy Quote of the Day Application to Google Cloud Platform (GKE)
# This script automates the deployment process for GCP/GKE

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
ZONE="us-central1-a"
MACHINE_TYPE="e2-standard-2"
NUM_NODES=2
MIN_NODES=1
MAX_NODES=5

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        echo "Visit: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        print_warning "Helm is not installed. Some features may not work."
    fi
    
    print_success "All prerequisites are met!"
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

# Function to enable required APIs
enable_apis() {
    print_status "Enabling required GCP APIs..."
    
    gcloud services enable container.googleapis.com
    gcloud services enable compute.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable monitoring.googleapis.com
    gcloud services enable logging.googleapis.com
    
    print_success "Required APIs enabled!"
}

# Function to create GKE cluster
create_cluster() {
    print_status "Checking if GKE cluster exists..."
    
    if gcloud container clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
        print_warning "Cluster $CLUSTER_NAME already exists. Skipping creation."
        return 0
    fi
    
    print_status "Creating GKE cluster: $CLUSTER_NAME..."
    
    gcloud container clusters create $CLUSTER_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --machine-type=$MACHINE_TYPE \
        --num-nodes=$NUM_NODES \
        --min-nodes=$MIN_NODES \
        --max-nodes=$MAX_NODES \
        --enable-autoscaling \
        --enable-autorepair \
        --enable-autoupgrade \
        --disk-size=50GB \
        --disk-type=pd-ssd \
        --image-type=COS_CONTAINERD \
        --enable-network-policy \
        --enable-ip-alias \
        --enable-shielded-nodes \
        --shielded-secure-boot \
        --shielded-integrity-monitoring \
        --workload-pool=$PROJECT_ID.svc.id.goog \
        --enable-managed-prometheus \
        --logging=SYSTEM,WORKLOAD \
        --monitoring=SYSTEM,WORKLOAD \
        --addons=HorizontalPodAutoscaling,HttpLoadBalancing,GcePersistentDiskCsiDriver
    
    print_success "GKE cluster created successfully!"
}

# Function to configure kubectl
configure_kubectl() {
    print_status "Configuring kubectl..."
    
    gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID
    
    # Verify connection
    kubectl cluster-info
    
    print_success "kubectl configured successfully!"
}

# Function to setup Container Registry
setup_registry() {
    print_status "Setting up Google Container Registry..."
    
    # Configure Docker to use gcloud as credential helper
    gcloud auth configure-docker
    
    print_success "Container Registry configured!"
}

# Function to build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."
    
    # Navigate to app directory
    cd ../../app
    
    # Build backend image
    print_status "Building backend image..."
    docker build -t gcr.io/$PROJECT_ID/quote-api:latest ./backend
    docker push gcr.io/$PROJECT_ID/quote-api:latest
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build -t gcr.io/$PROJECT_ID/quote-frontend:latest ./frontend
    docker push gcr.io/$PROJECT_ID/quote-frontend:latest
    
    # Return to deployment directory
    cd ../modules/module-3-cloud-deployment/gcp
    
    print_success "Docker images built and pushed successfully!"
}

# Function to create static IP addresses
create_static_ips() {
    print_status "Creating static IP addresses..."
    
    # Create production IP
    if ! gcloud compute addresses describe quote-app-ip --global --project=$PROJECT_ID &>/dev/null; then
        gcloud compute addresses create quote-app-ip --global --project=$PROJECT_ID
        print_success "Production static IP created!"
    else
        print_warning "Production static IP already exists."
    fi
    
    # Create staging IP
    if ! gcloud compute addresses describe quote-app-staging-ip --global --project=$PROJECT_ID &>/dev/null; then
        gcloud compute addresses create quote-app-staging-ip --global --project=$PROJECT_ID
        print_success "Staging static IP created!"
    else
        print_warning "Staging static IP already exists."
    fi
    
    # Display IP addresses
    PROD_IP=$(gcloud compute addresses describe quote-app-ip --global --project=$PROJECT_ID --format="value(address)")
    STAGING_IP=$(gcloud compute addresses describe quote-app-staging-ip --global --project=$PROJECT_ID --format="value(address)")
    
    print_status "Production IP: $PROD_IP"
    print_status "Staging IP: $STAGING_IP"
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application to GKE..."
    
    # Update deployment files with project ID
    sed -i.bak "s/<PROJECT_ID>/$PROJECT_ID/g" gcp-deployment.yaml
    
    # Apply storage class first
    kubectl apply -f gke-cluster.yaml
    
    # Deploy application
    kubectl apply -f gcp-deployment.yaml
    
    # Wait for deployments to be ready
    print_status "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres-deployment -n quote-app
    kubectl wait --for=condition=available --timeout=300s deployment/backend-deployment -n quote-app
    kubectl wait --for=condition=available --timeout=300s deployment/frontend-deployment -n quote-app
    
    print_success "Application deployed successfully!"
}

# Function to setup HPA
setup_hpa() {
    print_status "Setting up Horizontal Pod Autoscaler..."
    
    # Apply HPA configuration
    kubectl apply -f ../aws/hpa.yaml  # Reuse HPA config from AWS
    
    print_success "HPA configured successfully!"
}

# Function to setup ingress
setup_ingress() {
    print_status "Setting up Ingress..."
    
    # Apply ingress configuration
    kubectl apply -f gcp-ingress.yaml
    
    print_status "Waiting for ingress to get external IP..."
    
    # Wait for ingress to get IP (this can take several minutes)
    timeout=600
    while [ $timeout -gt 0 ]; do
        INGRESS_IP=$(kubectl get ingress quote-app-ingress -n quote-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
        if [ ! -z "$INGRESS_IP" ]; then
            break
        fi
        echo "Waiting for ingress IP... ($timeout seconds remaining)"
        sleep 10
        timeout=$((timeout-10))
    done
    
    if [ ! -z "$INGRESS_IP" ]; then
        print_success "Ingress configured with IP: $INGRESS_IP"
    else
        print_warning "Ingress IP not ready yet. Check status with: kubectl get ingress -n quote-app"
    fi
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Add Prometheus Helm repository
    if command -v helm &> /dev/null; then
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        # Install Prometheus and Grafana
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --set grafana.adminPassword=admin123 \
            --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
            --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false
        
        print_success "Monitoring stack installed!"
        print_status "Grafana admin password: admin123"
    else
        print_warning "Helm not available. Skipping monitoring setup."
    fi
}

# Function to display deployment status
display_status() {
    print_status "Deployment Status:"
    echo "===================="
    
    # Cluster info
    echo -e "${BLUE}Cluster Information:${NC}"
    kubectl cluster-info
    echo ""
    
    # Nodes
    echo -e "${BLUE}Nodes:${NC}"
    kubectl get nodes -o wide
    echo ""
    
    # Pods
    echo -e "${BLUE}Pods in quote-app namespace:${NC}"
    kubectl get pods -n quote-app -o wide
    echo ""
    
    # Services
    echo -e "${BLUE}Services:${NC}"
    kubectl get services -n quote-app
    echo ""
    
    # Ingress
    echo -e "${BLUE}Ingress:${NC}"
    kubectl get ingress -n quote-app
    echo ""
    
    # HPA
    echo -e "${BLUE}Horizontal Pod Autoscaler:${NC}"
    kubectl get hpa -n quote-app
    echo ""
    
    # Storage
    echo -e "${BLUE}Persistent Volumes:${NC}"
    kubectl get pv,pvc -n quote-app
    echo ""
}

# Function to display access information
display_access_info() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "==================== ACCESS INFORMATION ===================="
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get ingress quote-app-ingress -n quote-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    
    if [ ! -z "$INGRESS_IP" ]; then
        echo -e "${GREEN}Application URL:${NC} http://$INGRESS_IP"
        echo -e "${GREEN}API Health Check:${NC} http://$INGRESS_IP/health"
        echo -e "${GREEN}API Quotes:${NC} http://$INGRESS_IP/api/quotes"
    else
        echo -e "${YELLOW}Ingress IP not ready yet. Check with:${NC} kubectl get ingress -n quote-app"
    fi
    
    # Static IPs
    PROD_IP=$(gcloud compute addresses describe quote-app-ip --global --project=$PROJECT_ID --format="value(address)" 2>/dev/null)
    STAGING_IP=$(gcloud compute addresses describe quote-app-staging-ip --global --project=$PROJECT_ID --format="value(address)" 2>/dev/null)
    
    echo -e "${GREEN}Production Static IP:${NC} $PROD_IP"
    echo -e "${GREEN}Staging Static IP:${NC} $STAGING_IP"
    
    # Monitoring
    if command -v helm &> /dev/null && helm list -n monitoring | grep -q prometheus; then
        echo ""
        echo "==================== MONITORING ===================="
        echo -e "${GREEN}Grafana:${NC} kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
        echo -e "${GREEN}Prometheus:${NC} kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090"
        echo -e "${GREEN}Grafana Login:${NC} admin / admin123"
    fi
    
    echo ""
    echo "==================== USEFUL COMMANDS ===================="
    echo "View pods:           kubectl get pods -n quote-app"
    echo "View services:       kubectl get services -n quote-app"
    echo "View ingress:        kubectl get ingress -n quote-app"
    echo "View logs (backend): kubectl logs -f deployment/backend-deployment -n quote-app"
    echo "View logs (frontend):kubectl logs -f deployment/frontend-deployment -n quote-app"
    echo "Scale backend:       kubectl scale deployment backend-deployment --replicas=3 -n quote-app"
    echo "Scale frontend:      kubectl scale deployment frontend-deployment --replicas=3 -n quote-app"
    echo "Delete app:          ./cleanup-gcp.sh"
    echo ""
    echo "GCP Console:         https://console.cloud.google.com/kubernetes/workload?project=$PROJECT_ID"
    echo "GKE Clusters:        https://console.cloud.google.com/kubernetes/list?project=$PROJECT_ID"
}

# Main deployment function
main() {
    print_status "Starting GCP/GKE deployment..."
    echo "Cluster: $CLUSTER_NAME"
    echo "Region: $REGION"
    echo "Project: $PROJECT_ID"
    echo ""
    
    check_prerequisites
    get_project_id
    enable_apis
    create_cluster
    configure_kubectl
    setup_registry
    build_and_push_images
    create_static_ips
    deploy_application
    setup_hpa
    setup_ingress
    setup_monitoring
    
    echo ""
    display_status
    echo ""
    display_access_info
}

# Handle script arguments
case "${1:-}" in
    "cleanup")
        ./cleanup-gcp.sh
        ;;
    "status")
        display_status
        ;;
    "info")
        display_access_info
        ;;
    *)
        main
        ;;
esac