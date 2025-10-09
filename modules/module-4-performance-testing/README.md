# Module 4: Performance Testing with k6

This module demonstrates how to implement comprehensive performance testing for containerized applications using k6, a modern load testing tool. We'll test our Quote of the Day application across different scenarios and environments.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Files in this Module](#files-in-this-module)
- [Quick Start](#quick-start)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Docker Integration](#docker-integration)
- [CI/CD Integration](#cicd-integration)
- [Monitoring and Reporting](#monitoring-and-reporting)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Performance testing is crucial for ensuring your application can handle expected load and identifying bottlenecks before they impact users. This module covers:

- **Load Testing**: Normal expected load
- **Stress Testing**: Beyond normal capacity
- **Spike Testing**: Sudden load increases
- **Volume Testing**: Large amounts of data
- **Endurance Testing**: Extended periods

## 📦 Prerequisites

- Docker and Docker Compose
- k6 installed locally (optional, can use Docker)
- Running Quote of the Day application
- Basic understanding of HTTP and performance metrics

### Installing k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
winget install k6
```

## 📁 Files in this Module

```
module-4-performance-testing/
├── README.md                 # This documentation
├── tests/
│   ├── load-test.js         # Standard load testing
│   ├── stress-test.js       # Stress testing scenarios
│   ├── spike-test.js        # Spike testing scenarios
│   ├── volume-test.js       # Volume testing with large data
│   ├── endurance-test.js    # Long-running endurance tests
│   ├── api-test.js          # API-specific performance tests
│   └── utils/
│       ├── config.js        # Test configuration
│       ├── helpers.js       # Helper functions
│       └── data.js          # Test data generators
├── docker/
│   ├── Dockerfile           # k6 Docker image
│   ├── docker-compose.yml   # k6 with InfluxDB and Grafana
│   └── grafana/
│       ├── dashboards/      # Grafana dashboards
│       └── provisioning/    # Grafana configuration
├── scripts/
│   ├── run-tests.sh         # Test execution script
│   ├── run-docker-tests.sh  # Docker-based test execution
│   └── generate-report.sh   # Report generation
├── ci/
│   ├── performance-pipeline.yml  # CI/CD pipeline
│   └── thresholds.json      # Performance thresholds
└── reports/
    └── .gitkeep             # Report output directory
```

## 🚀 Quick Start

1. **Start the application** (from module-1b or deployed version):
   ```bash
   cd ../module-1b-docker-compose
   docker-compose up -d
   ```

2. **Run a basic load test**:
   ```bash
   cd module-4-performance-testing
   k6 run tests/load-test.js
   ```

3. **Run tests with Docker**:
   ```bash
   ./scripts/run-docker-tests.sh
   ```

4. **View results in Grafana**:
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   # Open http://localhost:3000 (admin/admin)
   ```

## 🧪 Test Types

### Load Testing
Tests normal expected load to ensure the application performs well under typical conditions.

**Characteristics:**
- Gradual ramp-up to target load
- Sustained load for a period
- Gradual ramp-down
- Validates response times and throughput

### Stress Testing
Tests beyond normal capacity to find the breaking point.

**Characteristics:**
- Ramp-up beyond normal load
- Identifies maximum capacity
- Tests system recovery
- Finds resource limitations

### Spike Testing
Tests sudden increases in load.

**Characteristics:**
- Immediate jump to high load
- Tests auto-scaling capabilities
- Validates system stability
- Checks for memory leaks

### Volume Testing
Tests with large amounts of data.

**Characteristics:**
- Large request/response payloads
- Database stress testing
- Memory usage validation
- Storage performance

### Endurance Testing
Tests system stability over extended periods.

**Characteristics:**
- Long-running tests (hours/days)
- Memory leak detection
- Resource degradation
- System stability validation

## 🏃‍♂️ Running Tests

### Local Execution

**Single test:**
```bash
k6 run tests/load-test.js
```

**With custom configuration:**
```bash
k6 run --vus 50 --duration 5m tests/load-test.js
```

**With environment variables:**
```bash
BASE_URL=http://localhost:3000 k6 run tests/load-test.js
```

### Docker Execution

**Run with monitoring stack:**
```bash
./scripts/run-docker-tests.sh load-test
```

**Custom test with Docker:**
```bash
docker run --rm -i grafana/k6:latest run - <tests/load-test.js
```

### Batch Execution

**Run all tests:**
```bash
./scripts/run-tests.sh all
```

**Run specific test suite:**
```bash
./scripts/run-tests.sh api
```

## 🐳 Docker Integration

### k6 with Monitoring Stack

The Docker setup includes:
- **k6**: Load testing tool
- **InfluxDB**: Time-series database for metrics
- **Grafana**: Visualization and dashboards

**Start monitoring stack:**
```bash
cd docker
docker-compose up -d
```

**Run test with monitoring:**
```bash
docker-compose run --rm k6 run /tests/load-test.js
```

### Custom k6 Image

Build custom image with your tests:
```bash
cd docker
docker build -t my-k6-tests .
docker run --rm my-k6-tests run /tests/load-test.js
```

## 🔄 CI/CD Integration

### GitHub Actions

The performance pipeline runs:
1. **Setup**: Prepare test environment
2. **Deploy**: Start application under test
3. **Test**: Execute performance tests
4. **Report**: Generate and store results
5. **Validate**: Check against thresholds

**Trigger conditions:**
- Pull requests to main/develop
- Scheduled runs (nightly)
- Manual triggers
- Release deployments

### Performance Thresholds

Tests include automated pass/fail criteria:
```javascript
export let options = {
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
    http_reqs: ['rate>100'],          // Throughput over 100 RPS
  },
};
```

## 📊 Monitoring and Reporting

### Metrics Collected

**HTTP Metrics:**
- Response time (avg, min, max, percentiles)
- Request rate (RPS)
- Error rate
- Data transferred

**System Metrics:**
- Virtual users (VUs)
- Iterations
- Test duration
- Resource utilization

### Grafana Dashboards

Pre-configured dashboards for:
- **Overview**: High-level performance metrics
- **HTTP**: Detailed HTTP performance
- **Errors**: Error analysis and trends
- **Comparison**: Test run comparisons

### Report Generation

**HTML Reports:**
```bash
k6 run --out json=results.json tests/load-test.js
./scripts/generate-report.sh results.json
```

**CSV Export:**
```bash
k6 run --out csv=results.csv tests/load-test.js
```

## 🎯 Best Practices

### Test Design

1. **Start Small**: Begin with simple tests and gradually increase complexity
2. **Realistic Data**: Use production-like test data
3. **Environment Parity**: Test in production-like environments
4. **Baseline First**: Establish performance baselines
5. **Incremental Load**: Gradually increase load to find limits

### Test Execution

1. **Consistent Environment**: Use dedicated test environments
2. **Warm-up Period**: Allow applications to warm up
3. **Multiple Runs**: Execute tests multiple times for consistency
4. **Resource Monitoring**: Monitor system resources during tests
5. **Clean State**: Start each test with a clean system state

### Results Analysis

1. **Trend Analysis**: Look for performance trends over time
2. **Percentile Focus**: Focus on 95th/99th percentiles, not just averages
3. **Error Investigation**: Investigate all errors and failures
4. **Correlation**: Correlate performance with system metrics
5. **Documentation**: Document findings and recommendations

## 🔧 Troubleshooting

### Common Issues

**High Error Rates:**
- Check application logs
- Verify network connectivity
- Validate test data
- Check resource limits

**Inconsistent Results:**
- Ensure consistent test environment
- Check for background processes
- Validate test isolation
- Review system resource usage

**Low Performance:**
- Check database connections
- Review application configuration
- Validate resource allocation
- Check for bottlenecks

### Debug Mode

**Enable verbose logging:**
```bash
k6 run --verbose tests/load-test.js
```

**HTTP debug:**
```bash
k6 run --http-debug tests/load-test.js
```

**Custom logging in tests:**
```javascript
import { check } from 'k6';
import { Rate } from 'k6/metrics';

export default function () {
  console.log('Debug: Starting iteration');
  // Test logic here
}
```

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Grafana k6 Dashboards](https://grafana.com/grafana/dashboards/?search=k6)
- [InfluxDB with k6](https://k6.io/docs/results-visualization/influxdb-+-grafana/)

## 🎯 Learning Objectives

After completing this module, you will understand:

- Different types of performance testing
- How to design effective performance tests
- k6 test scripting and execution
- Performance monitoring and visualization
- CI/CD integration for automated testing
- Performance analysis and optimization

## 🔗 Next Steps

- **Module 5**: Monitoring with Prometheus & Grafana
- **Advanced Topics**: Custom metrics, distributed testing
- **Production**: Performance testing in production environments