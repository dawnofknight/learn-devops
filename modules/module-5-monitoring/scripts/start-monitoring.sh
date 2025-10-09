#!/bin/bash

# Start Monitoring Stack Script
# This script starts the complete monitoring infrastructure for the Quote of the Day application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
TIMEOUT=300  # 5 minutes timeout for services to start

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

# Function to check if Docker is running
check_docker() {
    print_status "Checking Docker availability..."
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose availability..."
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    local dirs=(
        "$PROJECT_DIR/data/prometheus"
        "$PROJECT_DIR/data/grafana"
        "$PROJECT_DIR/data/alertmanager"
        "$PROJECT_DIR/logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    # Set proper permissions for Grafana
    if [[ -d "$PROJECT_DIR/data/grafana" ]]; then
        chmod 777 "$PROJECT_DIR/data/grafana"
    fi
    
    print_success "Directories created successfully"
}

# Function to validate configuration files
validate_configs() {
    print_status "Validating configuration files..."
    
    local configs=(
        "$PROJECT_DIR/prometheus/prometheus.yml"
        "$PROJECT_DIR/alertmanager/alertmanager.yml"
        "$PROJECT_DIR/grafana/provisioning/datasources/prometheus.yml"
        "$PROJECT_DIR/grafana/provisioning/dashboards/dashboards.yml"
        "$PROJECT_DIR/blackbox/blackbox.yml"
    )
    
    for config in "${configs[@]}"; do
        if [[ ! -f "$config" ]]; then
            print_error "Configuration file not found: $config"
            exit 1
        fi
    done
    
    print_success "All configuration files found"
}

# Function to pull Docker images
pull_images() {
    print_status "Pulling Docker images..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" pull
    else
        docker compose -f "$COMPOSE_FILE" pull
    fi
    
    print_success "Docker images pulled successfully"
}

# Function to start services
start_services() {
    print_status "Starting monitoring services..."
    
    # Start core monitoring services first
    local core_services=("prometheus" "alertmanager" "grafana")
    
    for service in "${core_services[@]}"; do
        print_status "Starting $service..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose -f "$COMPOSE_FILE" up -d "$service"
        else
            docker compose -f "$COMPOSE_FILE" up -d "$service"
        fi
    done
    
    # Wait a bit for core services to initialize
    print_status "Waiting for core services to initialize..."
    sleep 10
    
    # Start exporters and other services
    print_status "Starting exporters and additional services..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" up -d
    else
        docker compose -f "$COMPOSE_FILE" up -d
    fi
    
    print_success "All services started"
}

# Function to wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to become healthy..."
    
    local services=(
        "prometheus:9090"
        "grafana:3000"
        "alertmanager:9093"
        "node-exporter:9100"
        "cadvisor:8080"
        "blackbox-exporter:9115"
    )
    
    local start_time=$(date +%s)
    
    for service_port in "${services[@]}"; do
        local service=$(echo "$service_port" | cut -d: -f1)
        local port=$(echo "$service_port" | cut -d: -f2)
        
        print_status "Checking $service on port $port..."
        
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $TIMEOUT ]]; then
            print_error "Timeout waiting for services to start"
            exit 1
        fi
        
        while ! curl -s "http://localhost:$port" >/dev/null 2>&1; do
            current_time=$(date +%s)
            elapsed=$((current_time - start_time))
            
            if [[ $elapsed -gt $TIMEOUT ]]; then
                print_error "Timeout waiting for $service to start"
                exit 1
            fi
            
            print_status "Waiting for $service to be ready... (${elapsed}s elapsed)"
            sleep 5
        done
        
        print_success "$service is ready"
    done
}

# Function to display service URLs
show_urls() {
    print_success "Monitoring stack started successfully!"
    echo
    echo "=== Service URLs ==="
    echo "Grafana:           http://localhost:3000 (admin/admin123)"
    echo "Prometheus:        http://localhost:9090"
    echo "AlertManager:      http://localhost:9093"
    echo "Node Exporter:     http://localhost:9100"
    echo "cAdvisor:          http://localhost:8080"
    echo "Blackbox Exporter: http://localhost:9115"
    echo "Pushgateway:       http://localhost:9091"
    echo
    echo "=== Application URLs ==="
    echo "Quote Backend:     http://localhost:8000"
    echo "Quote Frontend:    http://localhost:3001"
    echo "Nginx:             http://localhost:80"
    echo
    echo "=== Database URLs ==="
    echo "PostgreSQL:        localhost:5432 (postgres/password)"
    echo "Redis:             localhost:6379"
    echo
}

# Function to show logs
show_logs() {
    print_status "Showing service logs (press Ctrl+C to exit)..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" logs -f
    else
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Function to check service status
check_status() {
    print_status "Checking service status..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" ps
    else
        docker compose -f "$COMPOSE_FILE" ps
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping monitoring services..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" down
    else
        docker compose -f "$COMPOSE_FILE" down
    fi
    print_success "Services stopped"
}

# Function to restart services
restart_services() {
    print_status "Restarting monitoring services..."
    stop_services
    sleep 5
    start_services
    wait_for_services
    show_urls
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  start     Start the monitoring stack (default)"
    echo "  stop      Stop the monitoring stack"
    echo "  restart   Restart the monitoring stack"
    echo "  status    Show service status"
    echo "  logs      Show service logs"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0                # Start the monitoring stack"
    echo "  $0 start          # Start the monitoring stack"
    echo "  $0 stop           # Stop the monitoring stack"
    echo "  $0 restart        # Restart the monitoring stack"
    echo "  $0 status         # Check service status"
    echo "  $0 logs           # Show logs"
}

# Main function
main() {
    local command="${1:-start}"
    
    case "$command" in
        "start")
            print_status "Starting monitoring stack..."
            check_docker
            check_docker_compose
            create_directories
            validate_configs
            pull_images
            start_services
            wait_for_services
            show_urls
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "status")
            check_status
            ;;
        "logs")
            show_logs
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Trap to handle script interruption
trap 'print_warning "Script interrupted. You may need to manually stop services with: docker-compose down"' INT

# Run main function
main "$@"