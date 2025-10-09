# Azure Kubernetes Service (AKS) Deployment

This directory contains the configuration files and scripts for deploying the "Quote of the Day" application to Azure Kubernetes Service (AKS).

## Overview

Azure Kubernetes Service (AKS) is Microsoft's managed Kubernetes service that simplifies deploying, managing, and scaling containerized applications using Kubernetes on Azure.

## Prerequisites

Before deploying to AKS, ensure you have:

1. **Azure CLI** installed and configured
   ```bash
   # Install Azure CLI (macOS)
   brew install azure-cli
   
   # Login to Azure
   az login
   
   # Set your subscription
   az account set --subscription "your-subscription-id"
   ```

2. **kubectl** installed
   ```bash
   # Install kubectl (macOS)
   brew install kubectl
   ```

3. **Docker** installed and running
   ```bash
   # Install Docker (macOS)
   brew install --cask docker
   ```

4. **Helm** installed (for monitoring setup)
   ```bash
   # Install Helm (macOS)
   brew install helm
   ```

5. **Azure subscription** with appropriate permissions
   - Contributor role on the subscription or resource group
   - Ability to create service principals
   - Sufficient quota for compute resources

## Files in this Directory

- `aks-cluster.yaml` - AKS cluster configuration using Azure CLI
- `azure-deployment.yaml` - Kubernetes deployment manifests for Azure
- `azure-ingress.yaml` - Ingress configuration with Azure Application Gateway
- `hpa.yaml` - Horizontal Pod Autoscaler configuration
- `deploy-azure.sh` - Automated deployment script
- `cleanup-azure.sh` - Cleanup script to remove all resources

## Quick Start

1. **Clone the repository and navigate to the Azure directory:**
   ```bash
   cd modules/module-3-cloud-deployment/azure
   ```

2. **Review and update configuration:**
   - Edit `aks-cluster.yaml` to set your preferred region and resource group
   - Update `azure-deployment.yaml` with your Azure Container Registry (ACR) details
   - Modify `azure-ingress.yaml` with your domain name

3. **Deploy the application:**
   ```bash
   ./deploy-azure.sh
   ```

4. **Access your application:**
   - The script will provide the external IP address or domain name
   - Frontend: `http://your-domain/`
   - Backend API: `http://your-domain/api/quotes`
   - Health check: `http://your-domain/health`

## Detailed Deployment Steps

### 1. Create AKS Cluster

The deployment script will create an AKS cluster with:
- **Node pool**: Standard_D2s_v3 instances (2 vCPU, 8GB RAM)
- **Auto-scaling**: 1-4 nodes
- **Networking**: Azure CNI with network policies
- **Add-ons**: Azure Monitor, Azure Policy, HTTP Application Routing
- **RBAC**: Enabled for security

### 2. Container Registry

Azure Container Registry (ACR) will be created to store your Docker images:
- **SKU**: Basic (suitable for development/testing)
- **Admin access**: Enabled for easy integration
- **Geo-replication**: Available in higher SKUs

### 3. Application Deployment

The application consists of:
- **PostgreSQL database** with persistent storage
- **Backend API** (Node.js/Express)
- **Frontend** (React/Nginx)
- **Ingress controller** for external access
- **Horizontal Pod Autoscaler** for automatic scaling

### 4. Storage

- **Azure Disk**: Used for PostgreSQL persistent storage
- **Storage Class**: `managed-premium` for better performance
- **Backup**: Automatic snapshots available

### 5. Networking

- **Virtual Network**: Dedicated VNet for the cluster
- **Subnets**: Separate subnets for nodes and pods
- **Network Security Groups**: Automatic security rules
- **Load Balancer**: Azure Load Balancer for ingress traffic

## Monitoring and Logging

The deployment includes:

1. **Azure Monitor for Containers**
   - Container insights and metrics
   - Log analytics workspace
   - Performance monitoring

2. **Prometheus and Grafana** (optional)
   - Custom metrics collection
   - Advanced dashboards
   - Alerting capabilities

## Security Features

1. **Azure Active Directory Integration**
   - RBAC with Azure AD
   - Service principal authentication
   - Managed identities

2. **Network Policies**
   - Pod-to-pod communication control
   - Ingress and egress rules
   - Azure CNI network policies

3. **Azure Key Vault Integration**
   - Secrets management
   - Certificate storage
   - CSI driver for secret mounting

## Auto-scaling

1. **Horizontal Pod Autoscaler (HPA)**
   - CPU and memory-based scaling
   - Custom metrics support
   - Configurable scaling policies

2. **Cluster Autoscaler**
   - Automatic node scaling
   - Cost optimization
   - Multi-zone support

## Cost Optimization

1. **Node Pool Management**
   - Spot instances for non-critical workloads
   - Multiple node pools for different workload types
   - Automatic scaling to reduce costs

2. **Resource Management**
   - Resource quotas and limits
   - Rightsizing recommendations
   - Azure Advisor integration

## Troubleshooting

### Common Issues

1. **Insufficient Quota**
   ```bash
   # Check your quota
   az vm list-usage --location eastus --output table
   
   # Request quota increase if needed
   ```

2. **ACR Authentication Issues**
   ```bash
   # Attach ACR to AKS cluster
   az aks update -n myAKSCluster -g myResourceGroup --attach-acr myACRRegistry
   ```

3. **Ingress Not Working**
   ```bash
   # Check ingress controller
   kubectl get pods -n ingress-basic
   
   # Check ingress resource
   kubectl describe ingress quote-app-ingress -n quote-app
   ```

4. **Pod Startup Issues**
   ```bash
   # Check pod logs
   kubectl logs -f deployment/backend-deployment -n quote-app
   
   # Check pod events
   kubectl describe pod <pod-name> -n quote-app
   ```

### Useful Commands

```bash
# Get cluster credentials
az aks get-credentials --resource-group myResourceGroup --name myAKSCluster

# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# Check application status
kubectl get all -n quote-app

# View logs
kubectl logs -f deployment/backend-deployment -n quote-app
kubectl logs -f deployment/frontend-deployment -n quote-app

# Check ingress
kubectl get ingress -n quote-app
kubectl describe ingress quote-app-ingress -n quote-app

# Scale application
kubectl scale deployment backend-deployment --replicas=3 -n quote-app

# Check HPA status
kubectl get hpa -n quote-app

# Access Azure Monitor
az aks browse --resource-group myResourceGroup --name myAKSCluster
```

## Cleanup

To remove all resources and avoid charges:

```bash
./cleanup-azure.sh
```

This will delete:
- AKS cluster and all associated resources
- Azure Container Registry
- Resource group (if created by the script)
- Container images
- Load balancers and public IPs

## Additional Resources

- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/en-us/azure/container-registry/)
- [Azure Monitor for Containers](https://docs.microsoft.com/en-us/azure/azure-monitor/containers/)
- [AKS Best Practices](https://docs.microsoft.com/en-us/azure/aks/best-practices)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)

## Support

For issues specific to this deployment:
1. Check the troubleshooting section above
2. Review Azure AKS documentation
3. Check Azure service health status
4. Contact Azure support if needed

## Next Steps

After successful deployment, consider:
1. Setting up CI/CD pipelines with Azure DevOps
2. Implementing Azure Key Vault for secrets management
3. Configuring backup and disaster recovery
4. Setting up monitoring and alerting
5. Implementing security scanning and compliance checks