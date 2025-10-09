# Custom k6 Docker image with additional tools and configurations
FROM grafana/k6:latest

# Set working directory
WORKDIR /app

# Install additional tools
USER root

# Install curl, jq, and other utilities for enhanced testing
RUN apk add --no-cache \
    curl \
    jq \
    bash \
    git \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create directories for tests, results, and reports
RUN mkdir -p /tests /results /reports /scripts /config

# Copy test files and configurations
COPY tests/ /tests/
COPY scripts/ /scripts/
COPY config/ /config/

# Set proper permissions
RUN chmod -R 755 /tests /scripts /config
RUN chmod -R 777 /results /reports

# Create a non-root user for running tests
RUN addgroup -g 1000 k6user && \
    adduser -D -s /bin/bash -u 1000 -G k6user k6user

# Install Node.js for result processing scripts
RUN apk add --no-cache nodejs npm

# Copy package.json for result processing dependencies
COPY scripts/package.json /scripts/package.json

# Install Node.js dependencies
RUN cd /scripts && npm install --production

# Set environment variables
ENV K6_BROWSER_ENABLED=true
ENV K6_NO_USAGE_REPORT=true
ENV K6_WEB_DASHBOARD=true
ENV K6_WEB_DASHBOARD_EXPORT=/reports/dashboard.html

# Create entrypoint script
COPY <<EOF /entrypoint.sh
#!/bin/bash

# Set default values
TEST_TYPE=\${TEST_TYPE:-load}
ENVIRONMENT=\${ENVIRONMENT:-local}
BASE_URL=\${BASE_URL:-http://localhost:3000}
OUTPUT_FORMAT=\${OUTPUT_FORMAT:-json}
RESULTS_DIR=\${RESULTS_DIR:-/results}
REPORTS_DIR=\${REPORTS_DIR:-/reports}

# Create timestamp for this test run
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
TEST_ID="\${TEST_TYPE}_\${ENVIRONMENT}_\${TIMESTAMP}"

echo "🚀 Starting k6 Performance Test"
echo "📊 Test Type: \${TEST_TYPE}"
echo "🌍 Environment: \${ENVIRONMENT}"
echo "🎯 Base URL: \${BASE_URL}"
echo "📁 Results Dir: \${RESULTS_DIR}"
echo "🆔 Test ID: \${TEST_ID}"

# Set k6 environment variables
export K6_ENVIRONMENT=\${ENVIRONMENT}
export K6_BASE_URL=\${BASE_URL}
export K6_TEST_ID=\${TEST_ID}

# Determine test file
case \${TEST_TYPE} in
    load)
        TEST_FILE="/tests/load-test.js"
        ;;
    stress)
        TEST_FILE="/tests/stress-test.js"
        ;;
    spike)
        TEST_FILE="/tests/spike-test.js"
        ;;
    volume)
        TEST_FILE="/tests/volume-test.js"
        ;;
    endurance)
        TEST_FILE="/tests/endurance-test.js"
        ;;
    *)
        echo "❌ Unknown test type: \${TEST_TYPE}"
        echo "Available types: load, stress, spike, volume, endurance"
        exit 1
        ;;
esac

# Check if test file exists
if [ ! -f "\${TEST_FILE}" ]; then
    echo "❌ Test file not found: \${TEST_FILE}"
    exit 1
fi

# Prepare output options
OUTPUT_OPTIONS=""

# Add InfluxDB output if configured
if [ -n "\${K6_INFLUXDB_URL}" ]; then
    OUTPUT_OPTIONS="\${OUTPUT_OPTIONS} --out influxdb=\${K6_INFLUXDB_URL}"
fi

# Add JSON output
if [ "\${OUTPUT_FORMAT}" = "json" ] || [ "\${OUTPUT_FORMAT}" = "both" ]; then
    OUTPUT_OPTIONS="\${OUTPUT_OPTIONS} --out json=\${RESULTS_DIR}/\${TEST_ID}.json"
fi

# Add CSV output
if [ "\${OUTPUT_FORMAT}" = "csv" ] || [ "\${OUTPUT_FORMAT}" = "both" ]; then
    OUTPUT_OPTIONS="\${OUTPUT_OPTIONS} --out csv=\${RESULTS_DIR}/\${TEST_ID}.csv"
fi

# Add web dashboard export
if [ "\${K6_WEB_DASHBOARD}" = "true" ]; then
    OUTPUT_OPTIONS="\${OUTPUT_OPTIONS} --out web-dashboard"
    export K6_WEB_DASHBOARD_EXPORT="\${REPORTS_DIR}/\${TEST_ID}_dashboard.html"
fi

# Add tags
TAG_OPTIONS="--tag testid=\${TEST_ID} --tag environment=\${ENVIRONMENT} --tag testtype=\${TEST_TYPE}"

# Run the test
echo "🏃 Running k6 test..."
echo "📄 Test file: \${TEST_FILE}"
echo "🏷️  Tags: \${TAG_OPTIONS}"
echo "📤 Output: \${OUTPUT_OPTIONS}"

k6 run \${OUTPUT_OPTIONS} \${TAG_OPTIONS} "\${TEST_FILE}"

TEST_EXIT_CODE=\$?

echo "📊 Test completed with exit code: \${TEST_EXIT_CODE}"

# Process results if Node.js script exists
if [ -f "/scripts/process-results.js" ] && [ -f "\${RESULTS_DIR}/\${TEST_ID}.json" ]; then
    echo "🔄 Processing test results..."
    cd /scripts
    node process-results.js "\${RESULTS_DIR}/\${TEST_ID}.json" "\${REPORTS_DIR}/\${TEST_ID}_report.html"
fi

# Generate summary report
if [ -f "/scripts/generate-summary.js" ]; then
    echo "📋 Generating summary report..."
    cd /scripts
    node generate-summary.js "\${RESULTS_DIR}" "\${REPORTS_DIR}/summary.html"
fi

echo "✅ Test execution completed"
echo "📁 Results available in: \${RESULTS_DIR}"
echo "📊 Reports available in: \${REPORTS_DIR}"

exit \${TEST_EXIT_CODE}
EOF

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER k6user

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command (can be overridden)
CMD []

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD k6 version || exit 1

# Labels for better container management
LABEL maintainer="Performance Testing Team"
LABEL version="1.0.0"
LABEL description="Custom k6 image for Quote of the Day application performance testing"
LABEL org.opencontainers.image.source="https://github.com/your-org/quote-app"
LABEL org.opencontainers.image.documentation="https://github.com/your-org/quote-app/blob/main/modules/module-4-performance-testing/README.md"