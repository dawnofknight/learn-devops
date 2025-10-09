#!/bin/bash

# Integration Test Script for Cloud-Native Learning Path
# Tests all modules to ensure complete system functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test Docker availability
test_docker() {
    log "Testing Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        warning "Docker daemon is not running - skipping Docker-based tests"
        return 1
    fi
    
    success "Docker is available and running"
    return 0
}

# Test Docker Compose availability
test_docker_compose() {
    log "Testing Docker Compose availability..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not available"
        return 1
    fi
    
    success "Docker Compose is available"
    return 0
}

# Test kubectl availability
test_kubectl() {
    log "Testing kubectl availability..."
    
    if ! command -v kubectl &> /dev/null; then
        warning "kubectl is not installed - skipping Kubernetes tests"
        return 1
    fi
    
    success "kubectl is available"
    return 0
}

# Test Module 1A - Single Container
test_module_1a() {
    log "Testing Module 1A - Single Container..."
    
    local module_dir="modules/module-1a-single-container"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 1A directory not found"
        return 1
    fi
    
    # Check for required files
    local required_files=(
        "$module_dir/README.md"
        "$module_dir/backend/Dockerfile"
        "$module_dir/frontend/Dockerfile"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file missing: $file"
            return 1
        fi
    done
    
    success "Module 1A structure is valid"
    return 0
}

# Test Module 1B - Docker Compose
test_module_1b() {
    log "Testing Module 1B - Docker Compose..."
    
    local module_dir="modules/module-1b-docker-compose"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 1B directory not found"
        return 1
    fi
    
    # Check for required files
    local required_files=(
        "$module_dir/README.md"
        "$module_dir/docker-compose.yml"
        "$module_dir/docker-compose.prod.yml"
        "$module_dir/.env"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file missing: $file"
            return 1
        fi
    done
    
    # Validate Docker Compose configuration
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        cd "$module_dir"
        if docker-compose config &> /dev/null || docker compose config &> /dev/null; then
            success "Module 1B Docker Compose configuration is valid"
        else
            error "Module 1B Docker Compose configuration is invalid"
            cd - > /dev/null
            return 1
        fi
        cd - > /dev/null
    fi
    
    return 0
}

# Test Module 2 - Kubernetes
test_module_2() {
    log "Testing Module 2 - Kubernetes..."
    
    local module_dir="modules/module-2-kubernetes-intro"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 2 directory not found"
        return 1
    fi
    
    # Check for required files
    local required_files=(
        "$module_dir/README.md"
        "$module_dir/namespace.yaml"
        "$module_dir/postgres-deployment.yaml"
        "$module_dir/backend-deployment.yaml"
        "$module_dir/frontend-deployment.yaml"
        "$module_dir/deploy-all.sh"
        "$module_dir/cleanup.sh"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file missing: $file"
            return 1
        fi
    done
    
    # Validate YAML files
    if command -v kubectl &> /dev/null; then
        # Check if kubectl can connect to a cluster
        if kubectl cluster-info &> /dev/null; then
            for yaml_file in "$module_dir"/*.yaml; do
                if ! kubectl apply --dry-run=client -f "$yaml_file" &> /dev/null; then
                    error "Invalid Kubernetes YAML: $(basename "$yaml_file")"
                    return 1
                fi
            done
            success "Module 2 Kubernetes manifests are valid"
        else
            # If no cluster is available, just check basic YAML structure
            warning "No Kubernetes cluster available - checking basic YAML structure"
            for yaml_file in "$module_dir"/*.yaml; do
                # Basic check: ensure file is not empty and has basic YAML structure
                if [[ ! -s "$yaml_file" ]]; then
                    error "Empty YAML file: $(basename "$yaml_file")"
                    return 1
                fi
                
                # Check for basic Kubernetes resource structure
                if ! grep -q "apiVersion:" "$yaml_file" || ! grep -q "kind:" "$yaml_file"; then
                    error "Invalid Kubernetes resource structure: $(basename "$yaml_file")"
                    return 1
                fi
            done
            success "Module 2 Kubernetes YAML structure is valid"
        fi
    fi
    
    return 0
}

# Test Module 3 - Cloud Deployment
test_module_3() {
    log "Testing Module 3 - Cloud Deployment..."
    
    local module_dir="modules/module-3-cloud-deployment"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 3 directory not found"
        return 1
    fi
    
    # Check for cloud provider directories
    local cloud_dirs=("aws" "gcp" "azure")
    
    for cloud_dir in "${cloud_dirs[@]}"; do
        if [[ ! -d "$module_dir/$cloud_dir" ]]; then
            error "Cloud provider directory missing: $cloud_dir"
            return 1
        fi
    done
    
    success "Module 3 cloud deployment structure is valid"
    return 0
}

# Test Module 4 - Performance Testing
test_module_4() {
    log "Testing Module 4 - Performance Testing..."
    
    local module_dir="modules/module-4-performance-testing"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 4 directory not found"
        return 1
    fi
    
    # Check for required files
    local required_files=(
        "$module_dir/README.md"
        "$module_dir/docker-compose.yml"
        "$module_dir/Dockerfile"
        "$module_dir/tests"
        "$module_dir/scripts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -e "$file" ]]; then
            error "Required file/directory missing: $file"
            return 1
        fi
    done
    
    # Validate Docker Compose configuration
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        cd "$module_dir"
        if docker-compose config &> /dev/null || docker compose config &> /dev/null; then
            success "Module 4 Docker Compose configuration is valid"
        else
            error "Module 4 Docker Compose configuration is invalid"
            cd - > /dev/null
            return 1
        fi
        cd - > /dev/null
    fi
    
    return 0
}

# Test Module 5 - Monitoring
test_module_5() {
    log "Testing Module 5 - Monitoring..."
    
    local module_dir="modules/module-5-monitoring"
    
    if [[ ! -d "$module_dir" ]]; then
        error "Module 5 directory not found"
        return 1
    fi
    
    # Check for required files and directories
    local required_items=(
        "$module_dir/README.md"
        "$module_dir/MONITORING.md"
        "$module_dir/docker-compose.yml"
        "$module_dir/.env"
        "$module_dir/prometheus"
        "$module_dir/grafana"
        "$module_dir/alertmanager"
        "$module_dir/scripts/setup-monitoring.sh"
        "$module_dir/scripts/start-monitoring.sh"
    )
    
    for item in "${required_items[@]}"; do
        if [[ ! -e "$item" ]]; then
            error "Required file/directory missing: $item"
            return 1
        fi
    done
    
    # Check if scripts are executable
    local scripts=(
        "$module_dir/scripts/setup-monitoring.sh"
        "$module_dir/scripts/start-monitoring.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -x "$script" ]]; then
            error "Script is not executable: $(basename "$script")"
            return 1
        fi
    done
    
    # Validate Docker Compose configuration
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        cd "$module_dir"
        if docker-compose config &> /dev/null || docker compose config &> /dev/null; then
            success "Module 5 Docker Compose configuration is valid"
        else
            error "Module 5 Docker Compose configuration is invalid"
            cd - > /dev/null
            return 1
        fi
        cd - > /dev/null
    fi
    
    return 0
}

# Test main application structure
test_main_app() {
    log "Testing main application structure..."
    
    local app_dir="app"
    
    if [[ ! -d "$app_dir" ]]; then
        error "Main app directory not found"
        return 1
    fi
    
    # Check for required directories
    local required_dirs=(
        "$app_dir/frontend"
        "$app_dir/backend"
        "$app_dir/database"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error "Required directory missing: $dir"
            return 1
        fi
    done
    
    # Check for key files
    local required_files=(
        "$app_dir/backend/package.json"
        "$app_dir/backend/server.js"
        "$app_dir/frontend/package.json"
        "$app_dir/database/init.sql"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file missing: $file"
            return 1
        fi
    done
    
    success "Main application structure is valid"
    return 0
}

# Test documentation
test_documentation() {
    log "Testing documentation..."
    
    local required_docs=(
        "README.md"
        "modules/module-1a-single-container/README.md"
        "modules/module-1b-docker-compose/README.md"
        "modules/module-2-kubernetes-intro/README.md"
        "modules/module-3-cloud-deployment/README.md"
        "modules/module-4-performance-testing/README.md"
        "modules/module-5-monitoring/README.md"
        "modules/module-5-monitoring/MONITORING.md"
    )
    
    for doc in "${required_docs[@]}"; do
        if [[ ! -f "$doc" ]]; then
            error "Required documentation missing: $doc"
            return 1
        fi
        
        # Check if documentation is not empty
        if [[ ! -s "$doc" ]]; then
            error "Documentation is empty: $doc"
            return 1
        fi
    done
    
    success "All required documentation is present and non-empty"
    return 0
}

# Main test execution
main() {
    log "Starting Cloud-Native Learning Path Integration Tests"
    log "=================================================="
    
    # Test prerequisites
    DOCKER_AVAILABLE=false
    COMPOSE_AVAILABLE=false
    KUBECTL_AVAILABLE=false
    
    if test_docker; then
        DOCKER_AVAILABLE=true
    fi
    
    if test_docker_compose; then
        COMPOSE_AVAILABLE=true
    fi
    
    if test_kubectl; then
        KUBECTL_AVAILABLE=true
    fi
    
    # Test all modules
    test_main_app
    test_module_1a
    test_module_1b
    test_module_2
    test_module_3
    test_module_4
    test_module_5
    test_documentation
    
    # Print summary
    log "=================================================="
    log "Integration Test Summary"
    log "=================================================="
    
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "\n${RED}Failed Tests:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}  - $failed_test${NC}"
        done
        echo
        exit 1
    else
        echo -e "\n${GREEN}🎉 All integration tests passed!${NC}"
        echo -e "${GREEN}The Cloud-Native Learning Path is ready for use.${NC}"
        echo
        exit 0
    fi
}

# Run main function
main "$@"