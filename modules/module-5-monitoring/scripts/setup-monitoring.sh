#!/bin/bash

# Setup Monitoring Environment Script
# This script sets up the monitoring environment for the Quote of the Day application

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
MAIN_PROJECT_DIR="$(dirname "$(dirname "$(dirname "$PROJECT_DIR")")")"

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

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available disk space (at least 2GB)
    local available_space=$(df -BG "$PROJECT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_space -lt 2 ]]; then
        print_warning "Low disk space detected. At least 2GB is recommended for monitoring data."
    fi
    
    print_success "System requirements check passed"
}

# Function to create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    local dirs=(
        "$PROJECT_DIR/data"
        "$PROJECT_DIR/data/prometheus"
        "$PROJECT_DIR/data/grafana"
        "$PROJECT_DIR/data/grafana/plugins"
        "$PROJECT_DIR/data/alertmanager"
        "$PROJECT_DIR/data/postgres"
        "$PROJECT_DIR/data/redis"
        "$PROJECT_DIR/logs"
        "$PROJECT_DIR/logs/prometheus"
        "$PROJECT_DIR/logs/grafana"
        "$PROJECT_DIR/logs/alertmanager"
        "$PROJECT_DIR/logs/nginx"
        "$PROJECT_DIR/backups"
        "$PROJECT_DIR/backups/prometheus"
        "$PROJECT_DIR/backups/grafana"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    print_success "Directory structure created"
}

# Function to set proper permissions
set_permissions() {
    print_status "Setting proper permissions..."
    
    # Grafana needs specific permissions
    if [[ -d "$PROJECT_DIR/data/grafana" ]]; then
        chmod -R 777 "$PROJECT_DIR/data/grafana"
        print_status "Set Grafana data permissions"
    fi
    
    # Prometheus needs write access to data directory
    if [[ -d "$PROJECT_DIR/data/prometheus" ]]; then
        chmod -R 755 "$PROJECT_DIR/data/prometheus"
        print_status "Set Prometheus data permissions"
    fi
    
    # AlertManager needs write access
    if [[ -d "$PROJECT_DIR/data/alertmanager" ]]; then
        chmod -R 755 "$PROJECT_DIR/data/alertmanager"
        print_status "Set AlertManager data permissions"
    fi
    
    # Make scripts executable
    if [[ -d "$PROJECT_DIR/scripts" ]]; then
        chmod +x "$PROJECT_DIR/scripts"/*.sh 2>/dev/null || true
        print_status "Made scripts executable"
    fi
    
    print_success "Permissions set successfully"
}

# Function to validate configuration files
validate_configurations() {
    print_status "Validating configuration files..."
    
    local configs=(
        "$PROJECT_DIR/prometheus/prometheus.yml"
        "$PROJECT_DIR/prometheus/alert-rules.yml"
        "$PROJECT_DIR/prometheus/recording-rules.yml"
        "$PROJECT_DIR/alertmanager/alertmanager.yml"
        "$PROJECT_DIR/grafana/provisioning/datasources/prometheus.yml"
        "$PROJECT_DIR/grafana/provisioning/dashboards/dashboards.yml"
        "$PROJECT_DIR/blackbox/blackbox.yml"
        "$PROJECT_DIR/postgres-exporter/queries.yaml"
        "$PROJECT_DIR/docker-compose.yml"
    )
    
    local missing_configs=()
    
    for config in "${configs[@]}"; do
        if [[ ! -f "$config" ]]; then
            missing_configs+=("$config")
        fi
    done
    
    if [[ ${#missing_configs[@]} -gt 0 ]]; then
        print_error "Missing configuration files:"
        for config in "${missing_configs[@]}"; do
            echo "  - $config"
        done
        exit 1
    fi
    
    print_success "All configuration files validated"
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    local env_file="$PROJECT_DIR/.env"
    
    if [[ ! -f "$env_file" ]]; then
        cat > "$env_file" << EOF
# Monitoring Stack Environment Configuration

# Grafana Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_INSTALL_PLUGINS=grafana-piechart-panel,grafana-worldmap-panel,grafana-clock-panel

# Prometheus Configuration
PROMETHEUS_RETENTION_TIME=30d
PROMETHEUS_RETENTION_SIZE=10GB

# AlertManager Configuration
ALERTMANAGER_CLUSTER_LISTEN_ADDRESS=0.0.0.0:9094
ALERTMANAGER_CLUSTER_PEER=

# Database Configuration
POSTGRES_DB=quotes_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3001
NGINX_PORT=80

# Exporter Configuration
NODE_EXPORTER_PORT=9100
CADVISOR_PORT=8080
BLACKBOX_EXPORTER_PORT=9115
POSTGRES_EXPORTER_PORT=9187
REDIS_EXPORTER_PORT=9121
NGINX_EXPORTER_PORT=9113
PUSHGATEWAY_PORT=9091

# Network Configuration
MONITORING_NETWORK=monitoring-network
APP_NETWORK=app-network

# Volume Configuration
PROMETHEUS_DATA_PATH=./data/prometheus
GRAFANA_DATA_PATH=./data/grafana
ALERTMANAGER_DATA_PATH=./data/alertmanager
POSTGRES_DATA_PATH=./data/postgres
REDIS_DATA_PATH=./data/redis

# Log Configuration
LOG_LEVEL=info
LOG_PATH=./logs
EOF
        print_success "Environment file created: $env_file"
    else
        print_status "Environment file already exists: $env_file"
    fi
}

# Function to pull required Docker images
pull_images() {
    print_status "Pulling required Docker images..."
    
    local images=(
        "prom/prometheus:latest"
        "prom/alertmanager:latest"
        "grafana/grafana:latest"
        "prom/node-exporter:latest"
        "gcr.io/cadvisor/cadvisor:latest"
        "prom/blackbox-exporter:latest"
        "wrouesnel/postgres_exporter:latest"
        "oliver006/redis_exporter:latest"
        "nginx/nginx-prometheus-exporter:latest"
        "prom/pushgateway:latest"
        "postgres:13"
        "redis:6-alpine"
        "nginx:alpine"
    )
    
    for image in "${images[@]}"; do
        print_status "Pulling $image..."
        docker pull "$image"
    done
    
    print_success "All Docker images pulled successfully"
}

# Function to create backup script
create_backup_script() {
    print_status "Creating backup script..."
    
    local backup_script="$PROJECT_DIR/scripts/backup-monitoring.sh"
    
    cat > "$backup_script" << 'EOF'
#!/bin/bash

# Backup Monitoring Data Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "Starting monitoring data backup..."

# Create backup directories
mkdir -p "$BACKUP_DIR/prometheus_$TIMESTAMP"
mkdir -p "$BACKUP_DIR/grafana_$TIMESTAMP"

# Backup Prometheus data
if [[ -d "$PROJECT_DIR/data/prometheus" ]]; then
    cp -r "$PROJECT_DIR/data/prometheus"/* "$BACKUP_DIR/prometheus_$TIMESTAMP/"
    echo "Prometheus data backed up"
fi

# Backup Grafana data
if [[ -d "$PROJECT_DIR/data/grafana" ]]; then
    cp -r "$PROJECT_DIR/data/grafana"/* "$BACKUP_DIR/grafana_$TIMESTAMP/"
    echo "Grafana data backed up"
fi

# Create archive
cd "$BACKUP_DIR"
tar -czf "monitoring_backup_$TIMESTAMP.tar.gz" "prometheus_$TIMESTAMP" "grafana_$TIMESTAMP"
rm -rf "prometheus_$TIMESTAMP" "grafana_$TIMESTAMP"

echo "Backup completed: monitoring_backup_$TIMESTAMP.tar.gz"

# Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -name "monitoring_backup_*.tar.gz" -mtime +7 -delete
EOF
    
    chmod +x "$backup_script"
    print_success "Backup script created: $backup_script"
}

# Function to create health check script
create_health_check_script() {
    print_status "Creating health check script..."
    
    local health_script="$PROJECT_DIR/scripts/health-check.sh"
    
    cat > "$health_script" << 'EOF'
#!/bin/bash

# Health Check Script for Monitoring Stack

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Services to check
declare -A SERVICES=(
    ["Prometheus"]="http://localhost:9090/-/healthy"
    ["Grafana"]="http://localhost:3000/api/health"
    ["AlertManager"]="http://localhost:9093/-/healthy"
    ["Node Exporter"]="http://localhost:9100/metrics"
    ["cAdvisor"]="http://localhost:8080/healthz"
    ["Blackbox Exporter"]="http://localhost:9115/metrics"
)

echo "=== Monitoring Stack Health Check ==="
echo

all_healthy=true

for service in "${!SERVICES[@]}"; do
    url="${SERVICES[$service]}"
    
    if curl -s -f "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service is healthy"
    else
        echo -e "${RED}✗${NC} $service is not responding"
        all_healthy=false
    fi
done

echo

if $all_healthy; then
    echo -e "${GREEN}All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}Some services are not healthy. Check the logs for more details.${NC}"
    exit 1
fi
EOF
    
    chmod +x "$health_script"
    print_success "Health check script created: $health_script"
}

# Function to display setup summary
show_summary() {
    print_success "Monitoring environment setup completed!"
    echo
    echo "=== Setup Summary ==="
    echo "Project Directory: $PROJECT_DIR"
    echo "Configuration Files: ✓"
    echo "Directory Structure: ✓"
    echo "Permissions: ✓"
    echo "Environment File: ✓"
    echo "Docker Images: ✓"
    echo "Scripts: ✓"
    echo
    echo "=== Next Steps ==="
    echo "1. Review the configuration files in:"
    echo "   - prometheus/"
    echo "   - grafana/"
    echo "   - alertmanager/"
    echo
    echo "2. Customize the .env file if needed"
    echo
    echo "3. Start the monitoring stack:"
    echo "   ./scripts/start-monitoring.sh"
    echo
    echo "4. Access the services:"
    echo "   - Grafana: http://localhost:3000 (admin/admin123)"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - AlertManager: http://localhost:9093"
    echo
    echo "5. Run health checks:"
    echo "   ./scripts/health-check.sh"
    echo
    echo "6. Create backups:"
    echo "   ./scripts/backup-monitoring.sh"
    echo
}

# Main function
main() {
    print_status "Setting up monitoring environment..."
    
    check_requirements
    create_directories
    set_permissions
    validate_configurations
    create_env_file
    pull_images
    create_backup_script
    create_health_check_script
    
    show_summary
}

# Run main function
main "$@"