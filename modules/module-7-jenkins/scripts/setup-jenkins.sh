#!/bin/bash

# Jenkins Setup Script
# This script sets up a complete Jenkins CI/CD environment with Docker Compose

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
JENKINS_HOME="./jenkins-data"
SSL_DIR="./ssl"
REGISTRY_AUTH_DIR="./registry-auth"
COMPOSE_FILE="docker-compose.jenkins.yml"

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
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi
    
    if ! command_exists openssl; then
        missing_deps+=("openssl")
    fi
    
    if ! command_exists htpasswd; then
        missing_deps+=("apache2-utils")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies and run this script again."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            print_status "On macOS, you can install them using:"
            print_status "  brew install docker docker-compose openssl apache2-utils"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            print_status "On Ubuntu/Debian, you can install them using:"
            print_status "  sudo apt-get update"
            print_status "  sudo apt-get install docker.io docker-compose openssl apache2-utils"
        fi
        
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Function to create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    mkdir -p "$JENKINS_HOME"/{workspace,plugins,secrets,logs}
    mkdir -p "$SSL_DIR"
    mkdir -p "$REGISTRY_AUTH_DIR"
    
    print_success "Directory structure created!"
}

# Function to generate SSL certificates
generate_ssl_certificates() {
    print_status "Generating SSL certificates..."
    
    # Generate CA key and certificate
    openssl genrsa -out "$SSL_DIR/ca.key" 4096
    openssl req -new -x509 -days 365 -key "$SSL_DIR/ca.key" -out "$SSL_DIR/ca.crt" \
        -subj "/C=US/ST=CA/L=San Francisco/O=Jenkins Lab/CN=Jenkins CA"
    
    # Generate certificates for each service
    local services=("jenkins" "sonar" "nexus" "registry")
    
    for service in "${services[@]}"; do
        # Generate private key
        openssl genrsa -out "$SSL_DIR/${service}.key" 2048
        
        # Generate certificate signing request
        openssl req -new -key "$SSL_DIR/${service}.key" -out "$SSL_DIR/${service}.csr" \
            -subj "/C=US/ST=CA/L=San Francisco/O=Jenkins Lab/CN=${service}.local"
        
        # Generate certificate
        openssl x509 -req -in "$SSL_DIR/${service}.csr" -CA "$SSL_DIR/ca.crt" -CAkey "$SSL_DIR/ca.key" \
            -CAcreateserial -out "$SSL_DIR/${service}.crt" -days 365 \
            -extensions v3_req -extfile <(cat <<EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${service}.local
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
)
        
        # Clean up CSR
        rm "$SSL_DIR/${service}.csr"
    done
    
    print_success "SSL certificates generated!"
    print_warning "Remember to add the CA certificate to your browser's trusted certificates:"
    print_warning "  CA Certificate: $SSL_DIR/ca.crt"
}

# Function to setup Docker registry authentication
setup_registry_auth() {
    print_status "Setting up Docker registry authentication..."
    
    local username="jenkins"
    local password="jenkins123"
    
    htpasswd -Bbn "$username" "$password" > "$REGISTRY_AUTH_DIR/htpasswd"
    
    print_success "Docker registry authentication configured!"
    print_status "Registry credentials: $username / $password"
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment file..."
    
    cat > .env <<EOF
# Jenkins Configuration
JENKINS_ADMIN_ID=admin
JENKINS_ADMIN_PASSWORD=admin123
JENKINS_AGENT_SECRET=

# Database Configuration
POSTGRES_USER=sonar
POSTGRES_PASSWORD=sonar123
POSTGRES_DB=sonar

# SonarQube Configuration
SONAR_JDBC_URL=jdbc:postgresql://postgres:5432/sonar
SONAR_JDBC_USERNAME=sonar
SONAR_JDBC_PASSWORD=sonar123

# Docker Registry Configuration
REGISTRY_USERNAME=jenkins
REGISTRY_PASSWORD=jenkins123

# Nexus Configuration
NEXUS_ADMIN_PASSWORD=admin123

# Network Configuration
COMPOSE_PROJECT_NAME=jenkins-lab
EOF
    
    print_success "Environment file created!"
}

# Function to create hosts file entries
create_hosts_entries() {
    print_status "Creating hosts file entries..."
    
    cat > hosts-entries.txt <<EOF
# Add these entries to your /etc/hosts file:
127.0.0.1 jenkins.local
127.0.0.1 sonar.local
127.0.0.1 nexus.local
127.0.0.1 registry.local
EOF
    
    print_success "Hosts entries created in hosts-entries.txt"
    print_warning "Please add the entries from hosts-entries.txt to your /etc/hosts file"
}

# Function to start services
start_services() {
    print_status "Starting Jenkins services..."
    
    # Pull images first
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_success "Services started!"
    
    # Wait for Jenkins to be ready
    print_status "Waiting for Jenkins to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:8080/login >/dev/null 2>&1; then
            break
        fi
        
        print_status "Attempt $attempt/$max_attempts - Jenkins not ready yet, waiting..."
        sleep 10
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Jenkins failed to start within the expected time"
        exit 1
    fi
    
    print_success "Jenkins is ready!"
}

# Function to configure Jenkins
configure_jenkins() {
    print_status "Configuring Jenkins..."
    
    # Wait a bit more for Jenkins to fully initialize
    sleep 30
    
    # Get Jenkins CLI
    curl -s http://localhost:8080/jnlpJars/jenkins-cli.jar -o jenkins-cli.jar
    
    # Install additional plugins if needed
    local additional_plugins=(
        "pipeline-stage-view"
        "pipeline-graph-analysis"
        "pipeline-rest-api"
        "pipeline-milestone-step"
        "pipeline-input-step"
    )
    
    for plugin in "${additional_plugins[@]}"; do
        java -jar jenkins-cli.jar -s http://localhost:8080 -auth admin:admin123 install-plugin "$plugin" || true
    done
    
    # Restart Jenkins to load new plugins
    java -jar jenkins-cli.jar -s http://localhost:8080 -auth admin:admin123 restart || true
    
    # Clean up
    rm -f jenkins-cli.jar
    
    print_success "Jenkins configuration completed!"
}

# Function to display service information
display_service_info() {
    print_success "Jenkins CI/CD Environment Setup Complete!"
    echo
    echo "🚀 Service URLs:"
    echo "   Jenkins:    https://jenkins.local (admin/admin123)"
    echo "   SonarQube:  https://sonar.local (admin/admin)"
    echo "   Nexus:      https://nexus.local (admin/admin123)"
    echo "   Registry:   https://registry.local (jenkins/jenkins123)"
    echo "   Portainer:  https://localhost:9443"
    echo
    echo "📁 Important Files:"
    echo "   SSL CA:     $SSL_DIR/ca.crt"
    echo "   Hosts:      hosts-entries.txt"
    echo "   Env:        .env"
    echo "   Compose:    $COMPOSE_FILE"
    echo
    echo "🔧 Useful Commands:"
    echo "   View logs:     docker-compose -f $COMPOSE_FILE logs -f [service]"
    echo "   Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "   Restart:       docker-compose -f $COMPOSE_FILE restart [service]"
    echo "   Status:        docker-compose -f $COMPOSE_FILE ps"
    echo
    echo "📚 Next Steps:"
    echo "   1. Add hosts entries to /etc/hosts"
    echo "   2. Import CA certificate to your browser"
    echo "   3. Access Jenkins and create your first pipeline"
    echo "   4. Configure SonarQube quality gates"
    echo "   5. Set up Nexus repositories"
    echo
}

# Function to cleanup on error
cleanup_on_error() {
    print_error "Setup failed. Cleaning up..."
    docker-compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    exit 1
}

# Main function
main() {
    echo "🚀 Jenkins CI/CD Environment Setup"
    echo "=================================="
    echo
    
    # Set trap for cleanup on error
    trap cleanup_on_error ERR
    
    check_prerequisites
    create_directories
    generate_ssl_certificates
    setup_registry_auth
    create_env_file
    create_hosts_entries
    start_services
    configure_jenkins
    display_service_info
    
    print_success "Setup completed successfully! 🎉"
}

# Run main function
main "$@"