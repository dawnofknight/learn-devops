#!/bin/bash

# Performance Testing Script for Quote of the Day Application
# This script provides a convenient way to run k6 performance tests locally

set -e

# Default values
TEST_TYPE="load"
ENVIRONMENT="local"
BASE_URL="http://localhost:3000"
OUTPUT_FORMAT="console"
RESULTS_DIR="results"
REPORTS_DIR="reports"
DOCKER_MODE=false
VERBOSE=false
CLEAN_RESULTS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Performance Testing Script for Quote of the Day Application

OPTIONS:
    -t, --test-type TYPE        Test type: load, stress, spike, volume, endurance, all (default: load)
    -e, --environment ENV       Environment: local, docker, staging, production (default: local)
    -u, --base-url URL          Base URL for testing (default: http://localhost:3000)
    -o, --output FORMAT         Output format: console, json, csv, influxdb, web (default: console)
    -r, --results-dir DIR       Results directory (default: results)
    -R, --reports-dir DIR       Reports directory (default: reports)
    -d, --docker                Run tests using Docker Compose
    -v, --verbose               Enable verbose output
    -c, --clean                 Clean previous results before running
    -h, --help                  Show this help message

EXAMPLES:
    # Run basic load test
    $0

    # Run stress test with JSON output
    $0 -t stress -o json

    # Run all tests against staging environment
    $0 -t all -e staging -u https://staging.example.com

    # Run tests in Docker with InfluxDB output
    $0 -d -o influxdb

    # Run spike test with verbose output and clean previous results
    $0 -t spike -v -c

ENVIRONMENT VARIABLES:
    K6_ENVIRONMENT              Override environment setting
    K6_BASE_URL                 Override base URL
    K6_VUS                      Override virtual users
    K6_DURATION                 Override test duration
    K6_ITERATIONS               Override iterations

EOF
}

# Function to validate dependencies
check_dependencies() {
    print_info "Checking dependencies..."
    
    if [ "$DOCKER_MODE" = true ]; then
        if ! command -v docker &> /dev/null; then
            print_error "Docker is required but not installed"
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is required but not installed"
            exit 1
        fi
        
        print_success "Docker dependencies found"
    else
        if ! command -v k6 &> /dev/null; then
            print_error "k6 is required but not installed"
            print_info "Install k6: https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
        
        if ! command -v node &> /dev/null; then
            print_error "Node.js is required for result processing"
            exit 1
        fi
        
        print_success "Local dependencies found"
    fi
}

# Function to setup directories
setup_directories() {
    print_info "Setting up directories..."
    
    mkdir -p "$RESULTS_DIR"
    mkdir -p "$REPORTS_DIR"
    
    if [ "$CLEAN_RESULTS" = true ]; then
        print_warning "Cleaning previous results..."
        rm -f "$RESULTS_DIR"/*.json
        rm -f "$RESULTS_DIR"/*.csv
        rm -f "$REPORTS_DIR"/*.html
    fi
    
    print_success "Directories ready"
}

# Function to set environment variables
setup_environment() {
    print_info "Setting up environment variables..."
    
    export K6_ENVIRONMENT="${K6_ENVIRONMENT:-$ENVIRONMENT}"
    export K6_BASE_URL="${K6_BASE_URL:-$BASE_URL}"
    
    # Set environment-specific defaults
    case "$K6_ENVIRONMENT" in
        "local")
            export K6_BASE_URL="${K6_BASE_URL:-http://localhost:3000}"
            ;;
        "docker")
            export K6_BASE_URL="${K6_BASE_URL:-http://app:3000}"
            ;;
        "staging")
            export K6_BASE_URL="${K6_BASE_URL:-https://staging.example.com}"
            ;;
        "production")
            export K6_BASE_URL="${K6_BASE_URL:-https://production.example.com}"
            ;;
    esac
    
    print_success "Environment configured for $K6_ENVIRONMENT"
    [ "$VERBOSE" = true ] && echo "Base URL: $K6_BASE_URL"
}

# Function to run a single test
run_single_test() {
    local test_type=$1
    local test_file="tests/${test_type}-test.js"
    local test_id="${test_type}_$(date +%Y%m%d_%H%M%S)"
    
    if [ ! -f "$test_file" ]; then
        print_error "Test file not found: $test_file"
        return 1
    fi
    
    print_info "Running $test_type test..."
    
    # Build k6 command
    local k6_cmd="k6 run"
    local k6_args=""
    
    # Add output options
    case "$OUTPUT_FORMAT" in
        "json")
            k6_args="$k6_args --out json=${RESULTS_DIR}/${test_id}.json"
            ;;
        "csv")
            k6_args="$k6_args --out csv=${RESULTS_DIR}/${test_id}.csv"
            ;;
        "influxdb")
            k6_args="$k6_args --out influxdb=http://localhost:8086/k6"
            ;;
        "web")
            k6_args="$k6_args --out web-dashboard=port=5665"
            ;;
        "console")
            # Default console output
            ;;
    esac
    
    # Add tags
    k6_args="$k6_args --tag testid=$test_id"
    k6_args="$k6_args --tag environment=$K6_ENVIRONMENT"
    k6_args="$k6_args --tag testtype=$test_type"
    k6_args="$k6_args --tag local=true"
    
    # Add verbose flag if requested
    if [ "$VERBOSE" = true ]; then
        k6_args="$k6_args --verbose"
    fi
    
    # Run the test
    local full_cmd="$k6_cmd $k6_args $test_file"
    
    print_info "Executing: $full_cmd"
    
    if eval "$full_cmd"; then
        print_success "$test_type test completed successfully"
        
        # Process results if JSON output was used
        if [ "$OUTPUT_FORMAT" = "json" ] && [ -f "${RESULTS_DIR}/${test_id}.json" ]; then
            print_info "Processing results..."
            cd scripts
            if npm list > /dev/null 2>&1; then
                node process-results.js "../${RESULTS_DIR}/${test_id}.json" "../${REPORTS_DIR}/${test_id}_report.html"
                print_success "HTML report generated: ${REPORTS_DIR}/${test_id}_report.html"
            else
                print_warning "Node.js dependencies not installed. Run 'npm install' in scripts directory."
            fi
            cd ..
        fi
        
        return 0
    else
        print_error "$test_type test failed"
        return 1
    fi
}

# Function to run tests with Docker
run_docker_tests() {
    print_info "Running tests with Docker Compose..."
    
    # Set Docker environment variables
    export COMPOSE_PROJECT_NAME="k6-performance-tests"
    export K6_TEST_TYPE="$TEST_TYPE"
    export K6_ENVIRONMENT="$ENVIRONMENT"
    export K6_BASE_URL="$BASE_URL"
    
    if [ "$TEST_TYPE" = "all" ]; then
        print_info "Running all test types with Docker..."
        
        for test in load stress spike volume; do
            print_info "Starting $test test..."
            K6_TEST_TYPE="$test" docker-compose up --build k6-$test
            
            if [ $? -eq 0 ]; then
                print_success "$test test completed"
            else
                print_error "$test test failed"
            fi
        done
        
        # Generate summary report
        print_info "Generating summary report..."
        docker-compose up --build results-processor
        
    else
        # Run single test type
        docker-compose up --build k6-$TEST_TYPE
        
        if [ $? -eq 0 ]; then
            print_success "Docker test completed"
        else
            print_error "Docker test failed"
            exit 1
        fi
    fi
    
    # Cleanup
    docker-compose down
    print_success "Docker tests completed"
}

# Function to run all tests
run_all_tests() {
    print_info "Running all test types..."
    
    local test_types=("load" "stress" "spike" "volume")
    local failed_tests=()
    local successful_tests=()
    
    for test_type in "${test_types[@]}"; do
        print_info "Starting $test_type test..."
        
        if run_single_test "$test_type"; then
            successful_tests+=("$test_type")
        else
            failed_tests+=("$test_type")
        fi
        
        # Add delay between tests
        if [ ${#test_types[@]} -gt 1 ]; then
            print_info "Waiting 30 seconds before next test..."
            sleep 30
        fi
    done
    
    # Generate summary report
    if [ "$OUTPUT_FORMAT" = "json" ] && command -v node &> /dev/null; then
        print_info "Generating summary report..."
        cd scripts
        if npm list > /dev/null 2>&1; then
            node generate-summary.js "../$RESULTS_DIR" "../$REPORTS_DIR/performance-summary.html"
            print_success "Summary report generated: $REPORTS_DIR/performance-summary.html"
        fi
        cd ..
    fi
    
    # Print final summary
    echo
    print_info "Test Summary:"
    echo "  Successful: ${#successful_tests[@]} (${successful_tests[*]})"
    echo "  Failed: ${#failed_tests[@]} (${failed_tests[*]})"
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -u|--base-url)
            BASE_URL="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -r|--results-dir)
            RESULTS_DIR="$2"
            shift 2
            ;;
        -R|--reports-dir)
            REPORTS_DIR="$2"
            shift 2
            ;;
        -d|--docker)
            DOCKER_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--clean)
            CLEAN_RESULTS=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate test type
case "$TEST_TYPE" in
    "load"|"stress"|"spike"|"volume"|"endurance"|"all")
        ;;
    *)
        print_error "Invalid test type: $TEST_TYPE"
        print_info "Valid types: load, stress, spike, volume, endurance, all"
        exit 1
        ;;
esac

# Validate output format
case "$OUTPUT_FORMAT" in
    "console"|"json"|"csv"|"influxdb"|"web")
        ;;
    *)
        print_error "Invalid output format: $OUTPUT_FORMAT"
        print_info "Valid formats: console, json, csv, influxdb, web"
        exit 1
        ;;
esac

# Main execution
print_info "Starting performance tests..."
print_info "Test Type: $TEST_TYPE"
print_info "Environment: $ENVIRONMENT"
print_info "Output Format: $OUTPUT_FORMAT"
print_info "Docker Mode: $DOCKER_MODE"

# Check dependencies
check_dependencies

# Setup environment
setup_environment
setup_directories

# Run tests
if [ "$DOCKER_MODE" = true ]; then
    run_docker_tests
elif [ "$TEST_TYPE" = "all" ]; then
    run_all_tests
else
    run_single_test "$TEST_TYPE"
fi

print_success "Performance testing completed!"

# Show results location
if [ "$OUTPUT_FORMAT" != "console" ]; then
    print_info "Results saved to: $RESULTS_DIR/"
    if [ -d "$REPORTS_DIR" ] && [ "$(ls -A $REPORTS_DIR 2>/dev/null)" ]; then
        print_info "Reports saved to: $REPORTS_DIR/"
    fi
fi