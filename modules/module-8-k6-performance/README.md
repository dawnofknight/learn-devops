# Module 8: Performance Testing with k6

## 🎯 Learning Objectives

By the end of this module, you will:
- Master k6 performance testing fundamentals
- Implement comprehensive load, stress, and spike testing scenarios
- Create DDOS simulation and resilience testing
- Integrate k6 with CI/CD pipelines (Jenkins, GitHub Actions)
- Monitor and analyze performance metrics with InfluxDB, Grafana, and Prometheus
- Build automated performance testing workflows
- Implement performance quality gates and thresholds

## 📋 Prerequisites

- Completed Module 1-7 or equivalent Docker/Kubernetes knowledge
- Basic understanding of HTTP protocols and APIs
- Familiarity with JavaScript (k6 uses JavaScript for test scripts)
- Understanding of performance testing concepts
- Jenkins knowledge (for CI/CD integration examples)

## 🛠️ Required Tools

- **k6**: Modern load testing tool
- **Docker & Docker Compose**: For containerized testing
- **Grafana**: Performance metrics visualization
- **InfluxDB**: Time-series database for metrics storage
- **Prometheus**: Metrics collection and alerting
- **Jenkins**: CI/CD integration (optional)
- **Node Exporter & cAdvisor**: System monitoring

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Navigate to the k6 module
cd modules/module-8-k6-performance

# Start the complete testing environment
docker-compose up -d

# Install k6 locally (optional)
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### 2. Run Your First Performance Test

```bash
# Basic load test
k6 run tests/load/basic-load-test.js

# Stress test with Docker
docker run --rm -v $(pwd)/tests:/tests grafana/k6 run /tests/stress/stress-test.js

# DDOS simulation
k6 run tests/ddos/ddos-simulation.js
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    k6 Performance Testing Architecture           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   k6 CLI    │    │ k6 Cloud    │    │ k6 Operator │         │
│  │   (Local)   │    │ (SaaS)      │    │ (K8s)       │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Test Execution Layer                       │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │ Load Tests  │ │Stress Tests │ │Spike Tests  │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │Volume Tests │ │ DDOS Sim.   │ │Endurance    │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Metrics Collection                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │  InfluxDB   │ │ Prometheus  │ │   StatsD    │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Visualization Layer                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │   Grafana   │ │ k6 Cloud    │ │   Custom    │          │ │
│  │  │ Dashboards  │ │ Dashboard   │ │   Reports   │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Module Structure

```
module-8-k6-performance/
├── README.md                          # This documentation
├── docker-compose.yml                 # Complete testing environment
├── examples/                          # Example applications for testing
│   ├── quote-app/                     # Sample application
│   ├── microservices/                 # Microservices testing examples
│   └── api-gateway/                   # API Gateway performance tests
├── tests/                             # k6 test scripts
│   ├── load/                          # Load testing scenarios
│   │   ├── basic-load-test.js
│   │   ├── ramp-up-load-test.js
│   │   └── sustained-load-test.js
│   ├── stress/                        # Stress testing scenarios
│   │   ├── stress-test.js
│   │   ├── breakpoint-test.js
│   │   └── resource-exhaustion.js
│   ├── spike/                         # Spike testing scenarios
│   │   ├── spike-test.js
│   │   ├── traffic-burst.js
│   │   └── flash-crowd.js
│   ├── ddos/                          # DDOS simulation scenarios
│   │   ├── ddos-simulation.js
│   │   ├── slowloris-attack.js
│   │   ├── http-flood.js
│   │   └── distributed-attack.js
│   └── utils/                         # Utility functions
│       ├── helpers.js
│       ├── data-generators.js
│       └── custom-metrics.js
├── scripts/                           # Automation scripts
│   ├── setup-environment.sh
│   ├── run-test-suite.sh
│   ├── generate-report.sh
│   └── cleanup.sh
├── docker/                            # Docker configurations
│   ├── k6/
│   ├── grafana/
│   └── influxdb/
├── k8s/                              # Kubernetes manifests
│   ├── k6-operator/
│   ├── monitoring/
│   └── test-jobs/
└── reports/                          # Generated test reports
    ├── templates/
    └── outputs/
```

## 🧪 Test Types and Scenarios

### 1. Load Testing

**Purpose**: Verify system behavior under expected load conditions.

#### Basic Load Test
```javascript
// tests/load/basic-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'], // Error rate must be below 10%
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/quotes');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  sleep(1);
}
```

#### Sustained Load Test
```javascript
// tests/load/sustained-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

export let options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up
    { duration: '30m', target: 50 },  // Sustained load
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const baseUrl = 'http://localhost:3000';
  
  // Test multiple endpoints
  const endpoints = [
    '/api/quotes',
    '/api/quotes/random',
    '/api/health',
  ];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${baseUrl}${endpoint}`);
    check(response, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
    });
  });
  
  sleep(Math.random() * 3 + 1); // Random sleep 1-4 seconds
}

export function handleSummary(data) {
  return {
    'reports/sustained-load-report.html': htmlReport(data),
  };
}
```

### 2. Stress Testing

**Purpose**: Determine system breaking point and behavior under extreme conditions.

#### Stress Test
```javascript
// tests/stress/stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
export let errorCounter = new Counter('errors');
export let responseTimeTrend = new Trend('response_time');

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to normal load
    { duration: '5m', target: 100 },  // Stay at normal load
    { duration: '2m', target: 200 },  // Ramp up to high load
    { duration: '5m', target: 200 },  // Stay at high load
    { duration: '2m', target: 300 },  // Ramp up to stress load
    { duration: '5m', target: 300 },  // Stay at stress load
    { duration: '2m', target: 400 },  // Ramp up to breaking point
    { duration: '5m', target: 400 },  // Stay at breaking point
    { duration: '10m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
    errors: ['count<100'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/quotes', {
    timeout: '60s',
  });
  
  responseTimeTrend.add(response.timings.duration);
  
  const result = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  if (!result) {
    errorCounter.add(1);
  }
  
  sleep(0.5);
}
```

#### Breakpoint Test
```javascript
// tests/stress/breakpoint-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  executor: 'ramping-arrival-rate',
  startRate: 50,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 1000,
  stages: [
    { target: 200, duration: '30s' },
    { target: 500, duration: '1m' },
    { target: 1000, duration: '2m' },
    { target: 1500, duration: '2m' },
    { target: 2000, duration: '2m' },
  ],
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<=0.1', abortOnFail: true },
    ],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/quotes');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### 3. Spike Testing

**Purpose**: Test system behavior under sudden traffic spikes.

#### Spike Test
```javascript
// tests/spike/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 10 },   // Normal load
    { duration: '1m', target: 10 },    // Stay at normal load
    { duration: '10s', target: 1400 }, // Spike to 1400 users
    { duration: '3m', target: 1400 },  // Stay at spike
    { duration: '10s', target: 10 },   // Quick ramp down to normal
    { duration: '3m', target: 10 },    // Recovery at normal load
    { duration: '10s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/quotes');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1500,
  });
  sleep(1);
}
```

### 4. DDOS Simulation

**Purpose**: Test system resilience against distributed denial-of-service attacks.

#### Basic DDOS Simulation
```javascript
// tests/ddos/ddos-simulation.js
import http from 'k6/http';
import { check } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
  scenarios: {
    // HTTP Flood Attack
    http_flood: {
      executor: 'constant-arrival-rate',
      rate: 1000, // 1000 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      tags: { attack_type: 'http_flood' },
    },
    
    // Slowloris Attack Simulation
    slowloris: {
      executor: 'constant-vus',
      vus: 200,
      duration: '10m',
      tags: { attack_type: 'slowloris' },
    },
    
    // Random Endpoint Attack
    random_endpoints: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 500, duration: '2m' },
        { target: 1000, duration: '5m' },
        { target: 1500, duration: '3m' },
      ],
      tags: { attack_type: 'random_endpoints' },
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Allow higher response times during attack
    http_req_failed: ['rate<0.5'], // Allow higher error rates
  },
};

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'http_flood';
  
  switch (scenario) {
    case 'http_flood':
      httpFloodAttack();
      break;
    case 'slowloris':
      slowlorisAttack();
      break;
    case 'random_endpoints':
      randomEndpointAttack();
      break;
    default:
      httpFloodAttack();
  }
}

function httpFloodAttack() {
  const response = http.get('http://localhost:3000/api/quotes', {
    timeout: '30s',
  });
  
  check(response, {
    'server survived flood': (r) => r.status !== 0,
  });
}

function slowlorisAttack() {
  // Simulate slow HTTP requests
  const response = http.get('http://localhost:3000/api/quotes', {
    timeout: '120s',
    headers: {
      'Connection': 'keep-alive',
      'User-Agent': `SlowBot-${randomString(10)}`,
    },
  });
  
  check(response, {
    'server responded to slow request': (r) => r.status !== 0,
  });
  
  // Keep connection open longer
  sleep(Math.random() * 30 + 10);
}

function randomEndpointAttack() {
  const endpoints = [
    '/api/quotes',
    '/api/quotes/random',
    '/api/health',
    '/api/nonexistent',
    '/admin',
    '/login',
    `/${randomString(20)}`,
  ];
  
  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`http://localhost:3000${randomEndpoint}`);
  
  check(response, {
    'server handled random request': (r) => r.status !== 0,
  });
}
```

#### Advanced DDOS with Multiple Attack Vectors
```javascript
// tests/ddos/distributed-attack.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
  scenarios: {
    // Volumetric Attack - High bandwidth consumption
    volumetric_attack: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      tags: { attack_vector: 'volumetric' },
    },
    
    // Protocol Attack - Exploit protocol weaknesses
    protocol_attack: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15m',
      tags: { attack_vector: 'protocol' },
    },
    
    // Application Layer Attack - Target application logic
    application_attack: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 200, duration: '3m' },
        { target: 800, duration: '7m' },
        { target: 1200, duration: '5m' },
      ],
      tags: { attack_vector: 'application' },
    },
  },
  
  thresholds: {
    'http_req_duration{attack_vector:volumetric}': ['p(95)<10000'],
    'http_req_duration{attack_vector:protocol}': ['p(95)<15000'],
    'http_req_duration{attack_vector:application}': ['p(95)<8000'],
    'http_req_failed': ['rate<0.8'], // Allow high failure rate during attack
  },
};

export default function () {
  const attackVector = __ITER % 3;
  
  switch (attackVector) {
    case 0:
      volumetricAttack();
      break;
    case 1:
      protocolAttack();
      break;
    case 2:
      applicationAttack();
      break;
  }
}

function volumetricAttack() {
  // Large payload requests
  const largePayload = randomString(10000); // 10KB payload
  
  const response = http.post('http://localhost:3000/api/quotes', 
    JSON.stringify({ data: largePayload }), 
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '60s',
    }
  );
  
  check(response, {
    'volumetric attack handled': (r) => r.status !== 0,
  });
}

function protocolAttack() {
  // Malformed requests and protocol exploitation
  const malformedHeaders = {
    'Content-Length': randomIntBetween(1000000, 9999999).toString(),
    'Transfer-Encoding': 'chunked',
    'Connection': 'keep-alive',
    'X-Forwarded-For': randomString(50),
  };
  
  const response = http.get('http://localhost:3000/api/quotes', {
    headers: malformedHeaders,
    timeout: '90s',
  });
  
  check(response, {
    'protocol attack handled': (r) => r.status !== 0,
  });
  
  sleep(randomIntBetween(5, 30)); // Variable delay
}

function applicationAttack() {
  // Target expensive operations
  const expensiveEndpoints = [
    '/api/quotes?limit=10000',
    '/api/search?q=' + randomString(100),
    '/api/export?format=pdf&size=large',
    '/api/analytics?range=all&detailed=true',
  ];
  
  const endpoint = expensiveEndpoints[Math.floor(Math.random() * expensiveEndpoints.length)];
  const response = http.get(`http://localhost:3000${endpoint}`, {
    timeout: '120s',
  });
  
  check(response, {
    'application attack handled': (r) => r.status !== 0,
  });
  
  sleep(0.1); // Rapid fire
}
```

## 🔧 Docker Environment

### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  # k6 Load Testing
  k6:
    image: grafana/k6:latest
    networks:
      - k6-network
    volumes:
      - ./tests:/tests
      - ./reports:/reports
    environment:
      - K6_OUT=influxdb=http://influxdb:8086/k6
    depends_on:
      - influxdb
    command: run --quiet /tests/load/basic-load-test.js

  # InfluxDB for metrics storage
  influxdb:
    image: influxdb:1.8
    networks:
      - k6-network
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=k6
      - INFLUXDB_USER=k6
      - INFLUXDB_USER_PASSWORD=k6
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=admin
    volumes:
      - influxdb-data:/var/lib/influxdb

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    networks:
      - k6-network
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning
      - ./docker/grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - influxdb

  # Sample application for testing
  quote-app:
    build: ./examples/quote-app
    networks:
      - k6-network
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_USER=quotes
      - DB_PASSWORD=quotes123
      - DB_NAME=quotes_db
    depends_on:
      - postgres

  # PostgreSQL database
  postgres:
    image: postgres:13
    networks:
      - k6-network
    environment:
      - POSTGRES_DB=quotes_db
      - POSTGRES_USER=quotes
      - POSTGRES_PASSWORD=quotes123
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./examples/quote-app/database/init.sql:/docker-entrypoint-initdb.d/init.sql

  # Prometheus for additional metrics
  prometheus:
    image: prom/prometheus:latest
    networks:
      - k6-network
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

networks:
  k6-network:
    driver: bridge

volumes:
  influxdb-data:
  grafana-data:
  postgres-data:
  prometheus-data:
```

## 🎯 Performance Quality Gates & Thresholds

### Understanding Quality Gates

Performance quality gates are automated checks that determine whether your application meets predefined performance criteria. They act as gatekeepers in your CI/CD pipeline, preventing poorly performing code from reaching production.

#### Types of Quality Gates

1. **Response Time Gates**
   - Average response time
   - 95th percentile response time
   - 99th percentile response time
   - Maximum response time

2. **Throughput Gates**
   - Requests per second (RPS)
   - Transactions per second (TPS)
   - Data transfer rates

3. **Error Rate Gates**
   - HTTP error rate
   - Application error rate
   - Timeout rate

4. **Resource Utilization Gates**
   - CPU usage
   - Memory consumption
   - Network bandwidth

### Implementing k6 Thresholds

#### Basic Threshold Configuration

```javascript
// tests/utils/thresholds.js
export const performanceThresholds = {
    // Response time thresholds
    http_req_duration: [
        'p(95)<1000',    // 95% of requests must be below 1s
        'p(99)<2000',    // 99% of requests must be below 2s
        'avg<500',       // Average response time below 500ms
        'max<5000'       // Maximum response time below 5s
    ],
    
    // Error rate thresholds
    http_req_failed: [
        'rate<0.01'      // Error rate must be below 1%
    ],
    
    // Throughput thresholds
    http_reqs: [
        'rate>100'       // Must handle at least 100 RPS
    ],
    
    // Custom metric thresholds
    login_duration: [
        'p(95)<2000'     // Login process under 2s for 95% of users
    ],
    
    // Data transfer thresholds
    data_received: [
        'rate>10000'     // Must receive at least 10KB/s
    ]
};

export const strictThresholds = {
    http_req_duration: [
        'p(95)<500',     // Stricter response time
        'p(99)<1000',
        'avg<200'
    ],
    http_req_failed: ['rate<0.005'], // 0.5% error rate
    http_reqs: ['rate>200']          // Higher throughput requirement
};

export const relaxedThresholds = {
    http_req_duration: [
        'p(95)<2000',    // More lenient for development
        'avg<1000'
    ],
    http_req_failed: ['rate<0.05'],  // 5% error rate acceptable
    http_reqs: ['rate>50']           // Lower throughput requirement
};
```

#### Environment-Specific Thresholds

```javascript
// tests/utils/environment-thresholds.js
import { performanceThresholds, strictThresholds, relaxedThresholds } from './thresholds.js';

export function getThresholds(environment = 'staging') {
    const thresholdMap = {
        'production': strictThresholds,
        'staging': performanceThresholds,
        'development': relaxedThresholds,
        'feature': relaxedThresholds
    };
    
    return thresholdMap[environment] || performanceThresholds;
}

export function getCustomThresholds(testType, environment) {
    const baseThresholds = getThresholds(environment);
    
    switch (testType) {
        case 'load':
            return {
                ...baseThresholds,
                // Load test specific thresholds
                http_req_duration: ['p(95)<1000', 'avg<400'],
                http_reqs: ['rate>50']
            };
            
        case 'stress':
            return {
                ...baseThresholds,
                // More lenient for stress tests
                http_req_duration: ['p(95)<3000', 'avg<1500'],
                http_req_failed: ['rate<0.1'] // 10% error rate acceptable under stress
            };
            
        case 'spike':
            return {
                ...baseThresholds,
                // Spike test thresholds
                http_req_duration: ['p(95)<2000'],
                http_req_failed: ['rate<0.05']
            };
            
        case 'ddos':
            return {
                // DDOS simulation - focus on system stability
                http_req_failed: ['rate<0.5'], // 50% error rate acceptable
                http_req_duration: ['p(50)<5000'] // Focus on median response time
            };
            
        default:
            return baseThresholds;
    }
}
```

#### Advanced Threshold Implementation

```javascript
// tests/load/advanced-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { getCustomThresholds } from '../utils/environment-thresholds.js';

// Custom metrics
const loginDuration = new Trend('login_duration');
const checkoutDuration = new Trend('checkout_duration');
const errorRate = new Rate('custom_error_rate');
const businessTransactions = new Counter('business_transactions');

// Get environment-specific thresholds
const environment = __ENV.ENVIRONMENT || 'staging';
const thresholds = getCustomThresholds('load', environment);

export const options = {
    stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 }
    ],
    
    // Apply dynamic thresholds
    thresholds: {
        ...thresholds,
        
        // Custom metric thresholds
        login_duration: ['p(95)<3000', 'avg<1500'],
        checkout_duration: ['p(95)<5000', 'avg<2500'],
        custom_error_rate: ['rate<0.02'],
        business_transactions: ['count>100']
    },
    
    // Abort test if critical thresholds are breached
    abortOnFail: true,
    
    // Tags for better reporting
    tags: {
        environment: environment,
        test_type: 'load',
        version: __ENV.APP_VERSION || 'unknown'
    }
};

export default function() {
    // Login flow with custom metric
    const loginStart = Date.now();
    const loginResponse = http.post(`${__ENV.TARGET_URL}/api/auth/login`, {
        username: 'testuser',
        password: 'testpass'
    });
    
    const loginSuccess = check(loginResponse, {
        'login successful': (r) => r.status === 200,
        'login response time OK': (r) => r.timings.duration < 2000
    });
    
    loginDuration.add(Date.now() - loginStart);
    
    if (!loginSuccess) {
        errorRate.add(1);
        return; // Skip rest of test if login fails
    }
    
    errorRate.add(0);
    
    // Extract token for subsequent requests
    const token = loginResponse.json('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Browse products
    const productsResponse = http.get(`${__ENV.TARGET_URL}/api/products`, { headers });
    check(productsResponse, {
        'products loaded': (r) => r.status === 200,
        'products response time OK': (r) => r.timings.duration < 1000
    });
    
    sleep(1);
    
    // Add to cart
    const cartResponse = http.post(`${__ENV.TARGET_URL}/api/cart/add`, {
        productId: 123,
        quantity: 1
    }, { headers });
    
    check(cartResponse, {
        'item added to cart': (r) => r.status === 200
    });
    
    sleep(1);
    
    // Checkout process with custom metric
    const checkoutStart = Date.now();
    const checkoutResponse = http.post(`${__ENV.TARGET_URL}/api/checkout`, {
        paymentMethod: 'credit_card',
        shippingAddress: 'Test Address'
    }, { headers });
    
    const checkoutSuccess = check(checkoutResponse, {
        'checkout successful': (r) => r.status === 200,
        'checkout response time OK': (r) => r.timings.duration < 3000
    });
    
    checkoutDuration.add(Date.now() - checkoutStart);
    
    if (checkoutSuccess) {
        businessTransactions.add(1);
    }
    
    sleep(2);
}

// Handle summary for quality gate decisions
export function handleSummary(data) {
    const report = {
        timestamp: new Date().toISOString(),
        environment: environment,
        test_type: 'load',
        duration: data.state.testRunDurationMs,
        
        // Key metrics
        metrics: {
            avg_response_time: data.metrics.http_req_duration.values.avg,
            p95_response_time: data.metrics.http_req_duration.values['p(95)'],
            p99_response_time: data.metrics.http_req_duration.values['p(99)'],
            error_rate: data.metrics.http_req_failed.values.rate,
            requests_per_second: data.metrics.http_reqs.values.rate,
            total_requests: data.metrics.http_reqs.values.count,
            
            // Custom metrics
            avg_login_duration: data.metrics.login_duration?.values.avg || 0,
            avg_checkout_duration: data.metrics.checkout_duration?.values.avg || 0,
            custom_error_rate: data.metrics.custom_error_rate?.values.rate || 0,
            business_transactions: data.metrics.business_transactions?.values.count || 0
        },
        
        // Threshold results
        thresholds: data.metrics,
        
        // Quality gate status
        quality_gate: {
            passed: Object.values(data.metrics).every(metric => 
                !metric.thresholds || Object.values(metric.thresholds).every(t => !t.ok === false)
            )
        }
    };
    
    return {
        'quality-gate-report.json': JSON.stringify(report, null, 2),
        'stdout': generateSummaryReport(report)
    };
}

function generateSummaryReport(report) {
    const status = report.quality_gate.passed ? '✅ PASSED' : '❌ FAILED';
    
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                           PERFORMANCE QUALITY GATE                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Status: ${status.padEnd(65)} ║
║ Environment: ${report.environment.padEnd(61)} ║
║ Test Type: ${report.test_type.padEnd(63)} ║
║ Duration: ${(report.duration / 1000).toFixed(2)}s${' '.repeat(58)} ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                KEY METRICS                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Average Response Time: ${report.metrics.avg_response_time.toFixed(2)}ms${' '.repeat(40)} ║
║ 95th Percentile: ${report.metrics.p95_response_time.toFixed(2)}ms${' '.repeat(46)} ║
║ Error Rate: ${(report.metrics.error_rate * 100).toFixed(2)}%${' '.repeat(55)} ║
║ Requests/Second: ${report.metrics.requests_per_second.toFixed(2)}${' '.repeat(48)} ║
║ Total Requests: ${report.metrics.total_requests}${' '.repeat(50)} ║
║ Business Transactions: ${report.metrics.business_transactions}${' '.repeat(43)} ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `;
}
```

### CI/CD Integration with Quality Gates

#### Jenkins Quality Gate Implementation

```groovy
// Jenkins pipeline stage for quality gates
stage('Performance Quality Gates') {
    steps {
        script {
            // Run k6 test with quality gates
            def testResult = sh(
                script: """
                    docker run --rm \
                        -v \$(pwd):/workspace \
                        -w /workspace \
                        -e ENVIRONMENT=${params.ENVIRONMENT} \
                        -e TARGET_URL=${env.TARGET_URL} \
                        grafana/k6 run \
                        --out json=reports/quality-gate-results.json \
                        tests/load/advanced-load-test.js
                """,
                returnStatus: true
            )
            
            // Parse quality gate results
            def qualityReport = readJSON file: 'reports/quality-gate-report.json'
            
            // Set build status based on quality gates
            if (!qualityReport.quality_gate.passed) {
                currentBuild.result = 'UNSTABLE'
                
                // Send detailed failure notification
                def failureDetails = analyzeQualityGateFailures(qualityReport)
                
                slackSend(
                    channel: '#performance-alerts',
                    color: 'danger',
                    message: """
                        🚨 Performance Quality Gate Failed!
                        
                        Environment: ${params.ENVIRONMENT}
                        Build: ${env.BUILD_NUMBER}
                        
                        Failed Metrics:
                        ${failureDetails.join('\n')}
                        
                        View Report: ${env.BUILD_URL}artifact/reports/performance-report.html
                    """
                )
                
                // Optionally fail the build for critical environments
                if (params.ENVIRONMENT == 'production') {
                    error("Performance quality gates failed for production deployment")
                }
            } else {
                echo "✅ All performance quality gates passed!"
                
                slackSend(
                    channel: '#performance-alerts',
                    color: 'good',
                    message: """
                        ✅ Performance Quality Gate Passed!
                        
                        Environment: ${params.ENVIRONMENT}
                        Build: ${env.BUILD_NUMBER}
                        
                        Key Metrics:
                        - Avg Response Time: ${qualityReport.metrics.avg_response_time.toFixed(2)}ms
                        - Error Rate: ${(qualityReport.metrics.error_rate * 100).toFixed(2)}%
                        - RPS: ${qualityReport.metrics.requests_per_second.toFixed(2)}
                    """
                )
            }
        }
    }
}

def analyzeQualityGateFailures(qualityReport) {
    def failures = []
    
    if (qualityReport.metrics.avg_response_time > 500) {
        failures.add("⚠️ Average response time too high: ${qualityReport.metrics.avg_response_time.toFixed(2)}ms")
    }
    
    if (qualityReport.metrics.error_rate > 0.01) {
        failures.add("⚠️ Error rate too high: ${(qualityReport.metrics.error_rate * 100).toFixed(2)}%")
    }
    
    if (qualityReport.metrics.p95_response_time > 1000) {
        failures.add("⚠️ 95th percentile response time too high: ${qualityReport.metrics.p95_response_time.toFixed(2)}ms")
    }
    
    return failures
}
```

#### GitHub Actions Quality Gate

```yaml
# .github/workflows/performance-quality-gates.yml
name: Performance Quality Gates

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  performance-quality-gates:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        test-type: [load, stress]
        environment: [staging]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Environment
        run: |
          echo "ENVIRONMENT=${{ matrix.environment }}" >> $GITHUB_ENV
          echo "TEST_TYPE=${{ matrix.test-type }}" >> $GITHUB_ENV
          echo "TARGET_URL=https://api.${{ matrix.environment }}.example.com" >> $GITHUB_ENV
      
      - name: Run k6 Performance Tests with Quality Gates
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            -w /workspace \
            -e ENVIRONMENT=${{ env.ENVIRONMENT }} \
            -e TARGET_URL=${{ env.TARGET_URL }} \
            grafana/k6 run \
            --out json=reports/quality-gate-results.json \
            tests/${{ matrix.test-type }}/advanced-${{ matrix.test-type }}-test.js
      
      - name: Analyze Quality Gates
        id: quality-gates
        run: |
          # Parse quality gate results
          QUALITY_GATE_PASSED=$(jq -r '.quality_gate.passed' reports/quality-gate-report.json)
          AVG_RESPONSE_TIME=$(jq -r '.metrics.avg_response_time' reports/quality-gate-report.json)
          ERROR_RATE=$(jq -r '.metrics.error_rate' reports/quality-gate-report.json)
          
          echo "quality_gate_passed=$QUALITY_GATE_PASSED" >> $GITHUB_OUTPUT
          echo "avg_response_time=$AVG_RESPONSE_TIME" >> $GITHUB_OUTPUT
          echo "error_rate=$ERROR_RATE" >> $GITHUB_OUTPUT
          
          if [ "$QUALITY_GATE_PASSED" = "false" ]; then
            echo "❌ Performance quality gates failed!"
            exit 1
          else
            echo "✅ Performance quality gates passed!"
          fi
      
      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const qualityReport = JSON.parse(fs.readFileSync('reports/quality-gate-report.json', 'utf8'));
            
            const status = qualityReport.quality_gate.passed ? '✅ PASSED' : '❌ FAILED';
            const emoji = qualityReport.quality_gate.passed ? '🎉' : '⚠️';
            
            const comment = `
            ## ${emoji} Performance Quality Gate Results
            
            **Status:** ${status}
            **Environment:** ${{ matrix.environment }}
            **Test Type:** ${{ matrix.test-type }}
            
            ### Key Metrics
            | Metric | Value | Threshold |
            |--------|-------|-----------|
            | Avg Response Time | ${qualityReport.metrics.avg_response_time.toFixed(2)}ms | < 500ms |
            | 95th Percentile | ${qualityReport.metrics.p95_response_time.toFixed(2)}ms | < 1000ms |
            | Error Rate | ${(qualityReport.metrics.error_rate * 100).toFixed(2)}% | < 1% |
            | Requests/Second | ${qualityReport.metrics.requests_per_second.toFixed(2)} | > 50 |
            
            ${qualityReport.quality_gate.passed ? 
              '🎯 All performance criteria met! Ready for deployment.' : 
              '🚨 Performance issues detected. Please review and optimize before merging.'
            }
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
      
      - name: Upload Quality Gate Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: quality-gate-report-${{ matrix.test-type }}-${{ matrix.environment }}
          path: reports/quality-gate-report.json
```

### Best Practices for Quality Gates

#### 1. Gradual Threshold Tightening

```javascript
// Implement progressive quality gates
export function getProgressiveThresholds(buildNumber, environment) {
    const baseThresholds = getThresholds(environment);
    
    // Gradually tighten thresholds over time
    const progressionFactor = Math.min(buildNumber / 100, 1); // Reach target after 100 builds
    
    return {
        http_req_duration: [
            `p(95)<${1000 - (progressionFactor * 200)}`, // From 1000ms to 800ms
            `avg<${500 - (progressionFactor * 100)}`     // From 500ms to 400ms
        ],
        http_req_failed: [
            `rate<${0.01 - (progressionFactor * 0.005)}` // From 1% to 0.5%
        ]
    };
}
```

#### 2. Context-Aware Quality Gates

```javascript
// Adjust thresholds based on test context
export function getContextualThresholds(context) {
    const { testType, environment, timeOfDay, loadLevel } = context;
    
    let thresholds = getThresholds(environment);
    
    // Adjust for time of day (peak vs off-peak)
    if (timeOfDay === 'peak') {
        thresholds = relaxThresholds(thresholds, 0.2); // 20% more lenient
    }
    
    // Adjust for load level
    if (loadLevel === 'high') {
        thresholds = relaxThresholds(thresholds, 0.3); // 30% more lenient
    }
    
    return thresholds;
}
```

#### 3. Composite Quality Scores

```javascript
// Calculate overall performance score
export function calculatePerformanceScore(metrics) {
    const weights = {
        response_time: 0.4,
        error_rate: 0.3,
        throughput: 0.2,
        availability: 0.1
    };
    
    const scores = {
        response_time: Math.max(0, 100 - (metrics.avg_response_time / 10)),
        error_rate: Math.max(0, 100 - (metrics.error_rate * 10000)),
        throughput: Math.min(100, metrics.requests_per_second),
        availability: (1 - metrics.error_rate) * 100
    };
    
    const overallScore = Object.entries(weights).reduce((total, [metric, weight]) => {
        return total + (scores[metric] * weight);
    }, 0);
    
    return {
        overall: overallScore,
        breakdown: scores,
        grade: getPerformanceGrade(overallScore)
    };
}

function getPerformanceGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}
```

## 📊 Monitoring & Observability

### Comprehensive Monitoring Stack

The k6 performance testing module includes a complete monitoring and observability stack to provide real-time insights into your application's performance during testing.

#### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   k6 Tests      │───▶│   InfluxDB      │───▶│   Grafana       │
│                 │    │   (Metrics)     │    │   (Dashboards)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────▶│   Prometheus    │◀─────────────┘
                        │   (Monitoring)  │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   AlertManager  │
                        │   (Alerting)    │
                        └─────────────────┘
```

### InfluxDB Integration

#### Configuration

```yaml
# docker/docker-compose.monitoring.yml
version: '3.8'

services:
  influxdb:
    image: influxdb:2.7
    container_name: k6-influxdb
    ports:
      - "8086:8086"
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=password123
      - DOCKER_INFLUXDB_INIT_ORG=k6-org
      - DOCKER_INFLUXDB_INIT_BUCKET=k6-metrics
      - DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=k6-admin-token
    volumes:
      - influxdb-data:/var/lib/influxdb2
      - ./config/influxdb:/etc/influxdb2
    networks:
      - k6-monitoring

  grafana:
    image: grafana/grafana:10.2.0
    container_name: k6-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
      - GF_INSTALL_PLUGINS=grafana-influxdb-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning
      - ./config/grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - influxdb
    networks:
      - k6-monitoring

  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: k6-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    networks:
      - k6-monitoring

  node-exporter:
    image: prom/node-exporter:v1.6.1
    container_name: k6-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - k6-monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.0
    container_name: k6-cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg
    networks:
      - k6-monitoring

volumes:
  influxdb-data:
  grafana-data:
  prometheus-data:

networks:
  k6-monitoring:
    driver: bridge
```

#### k6 InfluxDB Output Configuration

```javascript
// tests/utils/influxdb-config.js
export const influxDBConfig = {
    // InfluxDB v2 configuration
    url: __ENV.INFLUXDB_URL || 'http://localhost:8086',
    token: __ENV.INFLUXDB_TOKEN || 'k6-admin-token',
    org: __ENV.INFLUXDB_ORG || 'k6-org',
    bucket: __ENV.INFLUXDB_BUCKET || 'k6-metrics',
    
    // Additional tags for better data organization
    tags: {
        environment: __ENV.ENVIRONMENT || 'staging',
        test_type: __ENV.TEST_TYPE || 'load',
        version: __ENV.APP_VERSION || 'unknown',
        branch: __ENV.GIT_BRANCH || 'main',
        build_number: __ENV.BUILD_NUMBER || '0'
    }
};

// Enhanced test with InfluxDB output
export const options = {
    stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 }
    ],
    
    // InfluxDB output configuration
    ext: {
        influxdb: {
            ...influxDBConfig,
            // Custom measurement name
            measurement: 'k6_metrics',
            // Additional fields
            fields: ['response_time', 'error_rate', 'throughput']
        }
    },
    
    thresholds: {
        http_req_duration: ['p(95)<1000', 'avg<500'],
        http_req_failed: ['rate<0.01']
    }
};
```

### Grafana Dashboards

#### Complete k6 Performance Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "k6 Performance Testing Dashboard",
    "tags": ["k6", "performance", "testing"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Test Overview",
        "type": "stat",
        "targets": [
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_reqs\") |> aggregateWindow(every: v.windowPeriod, fn: sum)",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "red", "value": 80}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Response Time Distribution",
        "type": "timeseries",
        "targets": [
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_req_duration\") |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "A",
            "alias": "Average"
          },
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_req_duration_p95\") |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "B",
            "alias": "95th Percentile"
          },
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_req_duration_p99\") |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "C",
            "alias": "99th Percentile"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "unit": "ms"
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Request Rate & Error Rate",
        "type": "timeseries",
        "targets": [
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_reqs\") |> derivative(unit: 1s) |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "A",
            "alias": "Requests/sec"
          },
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"http_req_failed\") |> aggregateWindow(every: v.windowPeriod, fn: mean) |> map(fn: (r) => ({r with _value: r._value * 100.0}))",
            "refId": "B",
            "alias": "Error Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            }
          },
          "overrides": [
            {
              "matcher": {"id": "byName", "options": "Error Rate %"},
              "properties": [
                {"id": "unit", "value": "percent"},
                {"id": "color", "value": {"mode": "fixed", "fixedColor": "red"}}
              ]
            }
          ]
        },
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Virtual Users",
        "type": "timeseries",
        "targets": [
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"vus\") |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "A",
            "alias": "Active VUs"
          },
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"vus_max\") |> aggregateWindow(every: v.windowPeriod, fn: max)",
            "refId": "B",
            "alias": "Max VUs"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "unit": "short"
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      },
      {
        "id": 5,
        "title": "Data Transfer",
        "type": "timeseries",
        "targets": [
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"data_received\") |> derivative(unit: 1s) |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "A",
            "alias": "Data Received/sec"
          },
          {
            "query": "from(bucket: \"k6-metrics\") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == \"k6_metrics\" and r._field == \"data_sent\") |> derivative(unit: 1s) |> aggregateWindow(every: v.windowPeriod, fn: mean)",
            "refId": "B",
            "alias": "Data Sent/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "unit": "bytes"
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
```

### Prometheus Integration

#### Prometheus Configuration

```yaml
# config/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "k6_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'k6-prometheus-remote-write'
    static_configs:
      - targets: ['localhost:6565']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### k6 Prometheus Output

```javascript
// tests/utils/prometheus-config.js
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

export const options = {
    stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 }
    ],
    
    // Prometheus remote write configuration
    ext: {
        prometheus: {
            remote_write: {
                url: __ENV.PROMETHEUS_REMOTE_WRITE_URL || 'http://localhost:9090/api/v1/write',
                headers: {
                    'X-Prometheus-Remote-Write-Version': '0.1.0'
                }
            }
        }
    }
};

export function handleSummary(data) {
    // Convert k6 metrics to Prometheus format
    const prometheusMetrics = convertToPrometheusFormat(data);
    
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'prometheus-metrics.txt': prometheusMetrics
    };
}

function convertToPrometheusFormat(data) {
    const timestamp = Date.now();
    const metrics = [];
    
    // HTTP request duration
    metrics.push(`k6_http_req_duration_avg ${data.metrics.http_req_duration.values.avg} ${timestamp}`);
    metrics.push(`k6_http_req_duration_p95 ${data.metrics.http_req_duration.values['p(95)']} ${timestamp}`);
    metrics.push(`k6_http_req_duration_p99 ${data.metrics.http_req_duration.values['p(99)']} ${timestamp}`);
    
    // HTTP request rate
    metrics.push(`k6_http_reqs_rate ${data.metrics.http_reqs.values.rate} ${timestamp}`);
    metrics.push(`k6_http_reqs_total ${data.metrics.http_reqs.values.count} ${timestamp}`);
    
    // Error rate
    metrics.push(`k6_http_req_failed_rate ${data.metrics.http_req_failed.values.rate} ${timestamp}`);
    
    // Virtual users
    metrics.push(`k6_vus ${data.metrics.vus.values.value} ${timestamp}`);
    metrics.push(`k6_vus_max ${data.metrics.vus_max.values.value} ${timestamp}`);
    
    return metrics.join('\n');
}
```

### Real-time Alerting

#### AlertManager Configuration

```yaml
# config/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@example.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
        send_resolved: true
    
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#performance-alerts'
        title: 'k6 Performance Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

#### Performance Alert Rules

```yaml
# config/prometheus/k6_rules.yml
groups:
  - name: k6_performance_alerts
    rules:
      - alert: HighResponseTime
        expr: k6_http_req_duration_p95 > 2000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}ms, which exceeds the 2000ms threshold"

      - alert: HighErrorRate
        expr: k6_http_req_failed_rate > 0.05
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}, which exceeds the 5% threshold"

      - alert: LowThroughput
        expr: k6_http_reqs_rate < 10
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Low throughput detected"
          description: "Request rate is {{ $value }} RPS, which is below the expected 10 RPS threshold"

      - alert: TestFailure
        expr: up{job="k6-prometheus-remote-write"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "k6 test execution failed"
          description: "k6 test is not running or has failed"
```

### Custom Metrics and Monitoring

#### Advanced Custom Metrics

```javascript
// tests/utils/custom-metrics.js
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// Business-specific metrics
export const loginSuccessRate = new Rate('login_success_rate');
export const checkoutDuration = new Trend('checkout_duration');
export const cartAbandonmentRate = new Rate('cart_abandonment_rate');
export const activeUsers = new Gauge('active_users');
export const businessTransactions = new Counter('business_transactions');

// System performance metrics
export const memoryUsage = new Gauge('memory_usage_mb');
export const cpuUtilization = new Gauge('cpu_utilization_percent');
export const diskIO = new Trend('disk_io_ms');

// Custom error tracking
export const apiErrors = new Counter('api_errors');
export const timeoutErrors = new Counter('timeout_errors');
export const authenticationErrors = new Counter('authentication_errors');

// Performance budget metrics
export const performanceBudget = new Rate('performance_budget_compliance');
export const slaCompliance = new Rate('sla_compliance');

export function trackBusinessMetrics(response, operation) {
    switch (operation) {
        case 'login':
            loginSuccessRate.add(response.status === 200);
            if (response.status !== 200) {
                authenticationErrors.add(1);
            }
            break;
            
        case 'checkout':
            const checkoutTime = response.timings.duration;
            checkoutDuration.add(checkoutTime);
            
            if (response.status === 200) {
                businessTransactions.add(1);
            } else {
                cartAbandonmentRate.add(1);
            }
            break;
            
        case 'api_call':
            if (response.status >= 400) {
                apiErrors.add(1);
            }
            
            if (response.timings.duration > 30000) {
                timeoutErrors.add(1);
            }
            break;
    }
    
    // Performance budget compliance (response time < 1s)
    performanceBudget.add(response.timings.duration < 1000);
    
    // SLA compliance (response time < 2s and no errors)
    slaCompliance.add(response.timings.duration < 2000 && response.status < 400);
}
```

### Monitoring Best Practices

#### 1. Metric Collection Strategy

```javascript
// tests/utils/monitoring-strategy.js
export class MonitoringStrategy {
    constructor(environment) {
        this.environment = environment;
        this.metricsBuffer = [];
        this.samplingRate = this.getSamplingRate();
    }
    
    getSamplingRate() {
        // Adjust sampling based on environment
        const rates = {
            'production': 0.1,    // 10% sampling in prod
            'staging': 0.5,       // 50% sampling in staging
            'development': 1.0    // 100% sampling in dev
        };
        return rates[this.environment] || 0.5;
    }
    
    shouldSample() {
        return Math.random() < this.samplingRate;
    }
    
    collectMetric(name, value, tags = {}) {
        if (!this.shouldSample()) return;
        
        this.metricsBuffer.push({
            name,
            value,
            tags: {
                ...tags,
                environment: this.environment,
                timestamp: Date.now()
            }
        });
        
        // Flush buffer when it gets too large
        if (this.metricsBuffer.length > 1000) {
            this.flushMetrics();
        }
    }
    
    flushMetrics() {
        // Send metrics to monitoring system
        console.log(`Flushing ${this.metricsBuffer.length} metrics`);
        this.metricsBuffer = [];
    }
}
```

#### 2. Dashboard Organization

```javascript
// config/grafana/dashboard-config.js
export const dashboardConfig = {
    // Executive dashboard - high-level KPIs
    executive: {
        panels: [
            'test_success_rate',
            'avg_response_time',
            'error_rate',
            'throughput',
            'availability'
        ],
        refresh: '1m'
    },
    
    // Technical dashboard - detailed metrics
    technical: {
        panels: [
            'response_time_distribution',
            'error_breakdown',
            'resource_utilization',
            'custom_metrics',
            'threshold_compliance'
        ],
        refresh: '15s'
    },
    
    // Real-time dashboard - live monitoring
    realtime: {
        panels: [
            'live_metrics',
            'active_tests',
            'system_health',
            'alerts'
        ],
        refresh: '5s'
    }
};
```

### Troubleshooting Monitoring Issues

#### Common Issues and Solutions

1. **InfluxDB Connection Issues**
   ```bash
   # Check InfluxDB status
   docker logs k6-influxdb
   
   # Test connection
   curl -I http://localhost:8086/ping
   
   # Verify token
   influx auth list --host http://localhost:8086 --token k6-admin-token
   ```

2. **Grafana Dashboard Not Loading**
   ```bash
   # Check Grafana logs
   docker logs k6-grafana
   
   # Verify data source
   curl -H "Authorization: Bearer admin:admin123" \
        http://localhost:3000/api/datasources
   ```

3. **Missing Metrics in Prometheus**
   ```bash
   # Check Prometheus targets
   curl http://localhost:9090/api/v1/targets
   
   # Verify k6 metrics endpoint
   curl http://localhost:6565/metrics
   ```

#### Complete Jenkins Pipeline with k6

The Jenkins integration provides comprehensive performance testing capabilities with multiple pipeline examples:

##### 1. Basic Jenkins Pipeline Integration

```groovy
// Add to Jenkins shared library vars/runPerformanceTests.groovy
def call(Map config = [:]) {
    def testType = config.testType ?: 'load'
    def target = config.target ?: 'http://localhost:3000'
    def duration = config.duration ?: '5m'
    def vus = config.vus ?: 10
    
    script {
        // Run k6 performance tests
        sh """
            docker run --rm \
                -v \$(pwd)/tests:/tests \
                -v \$(pwd)/reports:/reports \
                -e K6_OUT=json=/reports/k6-results.json \
                grafana/k6 run \
                --vus ${vus} \
                --duration ${duration} \
                --env TARGET=${target} \
                /tests/${testType}/${testType}-test.js
        """
        
        // Archive results
        archiveArtifacts artifacts: 'reports/k6-results.json', fingerprint: true
        
        // Publish performance results
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'reports',
            reportFiles: 'performance-report.html',
            reportName: 'k6 Performance Report'
        ])
    }
}
```

##### 2. Advanced k6 Shared Library

```groovy
// vars/k6PerformanceTests.groovy - Complete shared library
def call(Map config = [:]) {
    // Configuration with defaults
    def testSuite = config.testSuite ?: 'load'
    def environment = config.environment ?: 'staging'
    def vus = config.vus ?: 10
    def duration = config.duration ?: '5m'
    def targetUrl = config.targetUrl ?: detectTargetUrl(environment)
    def k6Version = config.k6Version ?: 'latest'
    def resultsDir = config.resultsDir ?: 'k6-results'
    def enableMonitoring = config.enableMonitoring ?: true
    def generateReport = config.generateReport ?: true
    def failOnThresholds = config.failOnThresholds ?: true
    def slackChannel = config.slackChannel ?: '#performance-alerts'
    
    pipeline {
        agent any
        
        environment {
            K6_VERSION = "${k6Version}"
            TARGET_URL = "${targetUrl}"
            RESULTS_DIR = "${resultsDir}"
            TEST_SUITE = "${testSuite}"
        }
        
        stages {
            stage('Setup k6 Environment') {
                steps {
                    script {
                        // Create results directory
                        sh "mkdir -p ${resultsDir}"
                        
                        // Pull k6 Docker image
                        sh "docker pull grafana/k6:${k6Version}"
                        
                        // Setup monitoring stack if enabled
                        if (enableMonitoring) {
                            sh """
                                docker-compose -f docker/monitoring-stack.yml up -d influxdb grafana
                                sleep 30
                            """
                        }
                        
                        // Validate target URL
                        sh """
                            curl -f ${targetUrl}/health || {
                                echo "Target URL ${targetUrl} is not accessible"
                                exit 1
                            }
                        """
                    }
                }
            }
            
            stage('Run Performance Tests') {
                parallel {
                    stage('Load Testing') {
                        when {
                            anyOf {
                                expression { testSuite == 'all' }
                                expression { testSuite == 'load' }
                            }
                        }
                        steps {
                            script {
                                runK6Test([
                                    testType: 'load',
                                    testFile: 'tests/load/basic-load-test.js',
                                    vus: vus,
                                    duration: duration,
                                    outputFile: "${resultsDir}/load-test-results.json"
                                ])
                            }
                        }
                    }
                    
                    stage('Stress Testing') {
                        when {
                            anyOf {
                                expression { testSuite == 'all' }
                                expression { testSuite == 'stress' }
                            }
                        }
                        steps {
                            script {
                                runK6Test([
                                    testType: 'stress',
                                    testFile: 'tests/stress/stress-test.js',
                                    vus: vus * 2,
                                    duration: duration,
                                    outputFile: "${resultsDir}/stress-test-results.json"
                                ])
                            }
                        }
                    }
                    
                    stage('Spike Testing') {
                        when {
                            anyOf {
                                expression { testSuite == 'all' }
                                expression { testSuite == 'spike' }
                            }
                        }
                        steps {
                            script {
                                runK6Test([
                                    testType: 'spike',
                                    testFile: 'tests/spike/spike-test.js',
                                    vus: vus * 5,
                                    duration: duration,
                                    outputFile: "${resultsDir}/spike-test-results.json"
                                ])
                            }
                        }
                    }
                    
                    stage('DDOS Simulation') {
                        when {
                            allOf {
                                anyOf {
                                    expression { testSuite == 'all' }
                                    expression { testSuite == 'ddos' }
                                }
                                not { expression { environment == 'production' } }
                            }
                        }
                        steps {
                            script {
                                runK6Test([
                                    testType: 'ddos',
                                    testFile: 'tests/ddos/ddos-simulation.js',
                                    vus: vus * 10,
                                    duration: duration,
                                    outputFile: "${resultsDir}/ddos-test-results.json"
                                ])
                            }
                        }
                    }
                }
            }
            
            stage('Generate Reports') {
                when {
                    expression { generateReport }
                }
                steps {
                    script {
                        generateHtmlReport()
                        analyzeResults()
                    }
                }
            }
            
            stage('Performance Analysis') {
                steps {
                    script {
                        def analysis = analyzePerformanceResults()
                        
                        if (analysis.hasIssues && failOnThresholds) {
                            currentBuild.result = 'UNSTABLE'
                            echo "Performance issues detected: ${analysis.issues}"
                        }
                        
                        // Generate recommendations
                        echo "Performance Recommendations:"
                        analysis.recommendations.each { recommendation ->
                            echo "- ${recommendation}"
                        }
                    }
                }
            }
        }
        
        post {
            always {
                // Cleanup
                sh """
                    docker-compose -f docker/monitoring-stack.yml down || true
                    docker system prune -f || true
                """
                
                // Archive artifacts
                archiveArtifacts artifacts: "${resultsDir}/**/*", fingerprint: true
                
                // Publish HTML reports
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: resultsDir,
                    reportFiles: 'performance-report.html',
                    reportName: 'k6 Performance Report'
                ])
            }
            
            success {
                sendSlackNotification([
                    channel: slackChannel,
                    color: 'good',
                    message: "✅ Performance tests passed for ${env.JOB_NAME} #${env.BUILD_NUMBER}"
                ])
            }
            
            failure {
                sendSlackNotification([
                    channel: slackChannel,
                    color: 'danger',
                    message: "❌ Performance tests failed for ${env.JOB_NAME} #${env.BUILD_NUMBER}"
                ])
            }
            
            unstable {
                sendSlackNotification([
                    channel: slackChannel,
                    color: 'warning',
                    message: "⚠️ Performance tests unstable for ${env.JOB_NAME} #${env.BUILD_NUMBER}"
                ])
            }
        }
    }
}

// Helper functions
def runK6Test(Map config) {
    sh """
        docker run --rm \
            -v \$(pwd):/workspace \
            -w /workspace \
            -e K6_OUT=json=${config.outputFile} \
            -e TARGET_URL=${env.TARGET_URL} \
            grafana/k6:${env.K6_VERSION} run \
            --vus ${config.vus} \
            --duration ${config.duration} \
            --quiet \
            ${config.testFile}
    """
}

def generateHtmlReport() {
    sh """
        docker run --rm \
            -v \$(pwd)/${env.RESULTS_DIR}:/results \
            -v \$(pwd)/scripts:/scripts \
            node:16-alpine \
            node /scripts/generate-html-report.js /results
    """
}

def analyzePerformanceResults() {
    def results = [:]
    def issues = []
    def recommendations = []
    
    // Analyze JSON results
    def jsonFiles = sh(
        script: "find ${env.RESULTS_DIR} -name '*.json' -type f",
        returnStdout: true
    ).trim().split('\n')
    
    jsonFiles.each { file ->
        if (file) {
            def content = readFile(file)
            def data = readJSON text: content
            
            // Check thresholds
            if (data.metrics?.http_req_duration?.values?.p95 > 1000) {
                issues.add("High response time detected in ${file}")
                recommendations.add("Consider optimizing application performance")
            }
            
            if (data.metrics?.http_req_failed?.values?.rate > 0.1) {
                issues.add("High error rate detected in ${file}")
                recommendations.add("Investigate application errors and stability")
            }
        }
    }
    
    return [
        hasIssues: !issues.isEmpty(),
        issues: issues,
        recommendations: recommendations
    ]
}

def detectTargetUrl(environment) {
    switch(environment) {
        case 'production':
            return 'https://api.production.example.com'
        case 'staging':
            return 'https://api.staging.example.com'
        case 'local':
            return 'http://localhost:3000'
        default:
            return 'http://localhost:3000'
    }
}

def sendSlackNotification(Map config) {
    slackSend(
        channel: config.channel,
        color: config.color,
        message: config.message,
        teamDomain: 'your-team',
        token: env.SLACK_TOKEN
    )
}
```

##### 3. Multi-branch Pipeline Example

```groovy
// Jenkinsfile for multi-branch pipeline
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'TEST_SUITE',
            choices: ['branch-specific', 'load', 'stress', 'spike', 'all'],
            description: 'Select test suite to run'
        )
        string(
            name: 'VIRTUAL_USERS',
            defaultValue: '',
            description: 'Override virtual users (leave empty for branch defaults)'
        )
        string(
            name: 'TEST_DURATION',
            defaultValue: '',
            description: 'Override test duration (leave empty for branch defaults)'
        )
    }
    
    environment {
        BRANCH_CONFIG = getBranchConfig(env.BRANCH_NAME)
    }
    
    stages {
        stage('Branch Analysis & Setup') {
            steps {
                script {
                    def config = readJSON text: env.BRANCH_CONFIG
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Environment: ${config.environment}"
                    echo "Test Strategy: ${config.testStrategy}"
                    echo "Performance Gates: ${config.performanceGates}"
                }
            }
        }
        
        stage('Performance Testing') {
            steps {
                script {
                    def config = readJSON text: env.BRANCH_CONFIG
                    def testSuite = params.TEST_SUITE == 'branch-specific' ? config.testStrategy : params.TEST_SUITE
                    
                    k6PerformanceTests([
                        testSuite: testSuite,
                        environment: config.environment,
                        vus: params.VIRTUAL_USERS ?: config.virtualUsers,
                        duration: params.TEST_DURATION ?: config.duration,
                        targetUrl: config.targetUrl,
                        enableMonitoring: config.enableMonitoring,
                        generateReport: true,
                        failOnThresholds: config.performanceGates,
                        slackChannel: config.slackChannel
                    ])
                }
            }
        }
        
        stage('Quality Gates') {
            steps {
                script {
                    def config = readJSON text: env.BRANCH_CONFIG
                    if (config.performanceGates) {
                        applyQualityGates(config.qualityGates)
                    }
                }
            }
        }
    }
}

def getBranchConfig(branchName) {
    def configs = [
        'main': [
            environment: 'production',
            testStrategy: 'comprehensive',
            virtualUsers: 100,
            duration: '15m',
            targetUrl: 'https://api.production.example.com',
            enableMonitoring: true,
            performanceGates: true,
            qualityGates: [
                maxResponseTime: 500,
                maxErrorRate: 0.01
            ],
            slackChannel: '#production-alerts'
        ],
        'develop': [
            environment: 'staging',
            testStrategy: 'standard',
            virtualUsers: 50,
            duration: '10m',
            targetUrl: 'https://api.staging.example.com',
            enableMonitoring: true,
            performanceGates: true,
            qualityGates: [
                maxResponseTime: 1000,
                maxErrorRate: 0.05
            ],
            slackChannel: '#dev-alerts'
        ],
        'feature/*': [
            environment: 'feature',
            testStrategy: 'light',
            virtualUsers: 10,
            duration: '5m',
            targetUrl: 'http://feature-env.example.com',
            enableMonitoring: false,
            performanceGates: false,
            qualityGates: [
                maxResponseTime: 2000,
                maxErrorRate: 0.1
            ],
            slackChannel: '#dev-alerts'
        ]
    ]
    
    // Find matching configuration
    def config = configs.find { pattern, conf ->
        if (pattern.contains('*')) {
            return branchName.startsWith(pattern.replace('*', ''))
        } else {
            return branchName == pattern
        }
    }?.value
    
    return groovy.json.JsonBuilder(config ?: configs['feature/*']).toString()
}
```

##### 4. Pipeline Examples Location

All Jenkins integration examples are available in:
- `../module-7-jenkins/examples/k6-*` - Complete pipeline examples
- `../module-7-jenkins/pipelines/` - Shared library functions
- `../module-7-jenkins/scripts/` - Helper scripts

#### Quick Start with Jenkins

1. **Copy Shared Library**:
   ```bash
   cp ../module-7-jenkins/pipelines/k6-shared-library.groovy \
      $JENKINS_HOME/workspace/shared-library/vars/k6PerformanceTests.groovy
   ```

2. **Create Pipeline Job**:
   ```groovy
   @Library('shared-library') _
   
   k6PerformanceTests([
       testSuite: 'load',
       environment: 'staging',
       vus: 20,
       duration: '5m'
   ])
   ```

3. **Multi-branch Setup**:
   ```bash
   # Copy Jenkinsfile to your repository root
   cp ../module-7-jenkins/examples/k6-multibranch-example.groovy ./Jenkinsfile
   ```
```

### GitLab CI Integration

```yaml
# .gitlab-ci.yml
stages:
  - test
  - performance
  - report

variables:
  K6_VERSION: "latest"
  DOCKER_DRIVER: overlay2

# Performance testing job
k6-performance-tests:
  stage: performance
  image: docker:latest
  services:
    - docker:dind
  variables:
    TARGET_URL: "https://staging.example.com"
    TEST_DURATION: "5m"
    VIRTUAL_USERS: "20"
  before_script:
    - docker pull grafana/k6:$K6_VERSION
    - mkdir -p reports
  script:
    # Load Testing
    - |
      docker run --rm \
        -v $PWD/tests:/tests \
        -v $PWD/reports:/reports \
        -e K6_OUT=json=/reports/load-results.json \
        grafana/k6:$K6_VERSION run \
        --vus $VIRTUAL_USERS \
        --duration $TEST_DURATION \
        --env TARGET_URL=$TARGET_URL \
        /tests/load/basic-load-test.js
    
    # Stress Testing
    - |
      docker run --rm \
        -v $PWD/tests:/tests \
        -v $PWD/reports:/reports \
        -e K6_OUT=json=/reports/stress-results.json \
        grafana/k6:$K6_VERSION run \
        --vus $((VIRTUAL_USERS * 2)) \
        --duration $TEST_DURATION \
        --env TARGET_URL=$TARGET_URL \
        /tests/stress/stress-test.js
    
    # Generate HTML report
    - |
      docker run --rm \
        -v $PWD/reports:/reports \
        -v $PWD/scripts:/scripts \
        node:16-alpine \
        node /scripts/generate-report.js /reports
  
  artifacts:
    when: always
    paths:
      - reports/
    reports:
      junit: reports/junit-report.xml
    expire_in: 1 week
  
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "develop"
    - if: $CI_MERGE_REQUEST_IID

# Performance regression detection
performance-regression:
  stage: report
  image: node:16-alpine
  dependencies:
    - k6-performance-tests
  script:
    - npm install -g k6-reporter
    - k6-reporter compare --baseline reports/baseline.json --current reports/load-results.json
  artifacts:
    reports:
      performance: reports/performance-comparison.json
  only:
    - merge_requests
```

### Azure DevOps Integration

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop
      - feature/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  k6Version: 'latest'
  targetUrl: 'https://staging.example.com'
  testDuration: '5m'
  virtualUsers: 20

stages:
- stage: PerformanceTesting
  displayName: 'Performance Testing'
  jobs:
  - job: K6Tests
    displayName: 'Run k6 Performance Tests'
    steps:
    - task: Docker@2
      displayName: 'Pull k6 Docker Image'
      inputs:
        command: 'pull'
        arguments: 'grafana/k6:$(k6Version)'
    
    - script: |
        mkdir -p $(Build.ArtifactStagingDirectory)/reports
      displayName: 'Create Reports Directory'
    
    - script: |
        docker run --rm \
          -v $(Build.SourcesDirectory)/tests:/tests \
          -v $(Build.ArtifactStagingDirectory)/reports:/reports \
          -e K6_OUT=json=/reports/load-results.json \
          grafana/k6:$(k6Version) run \
          --vus $(virtualUsers) \
          --duration $(testDuration) \
          --env TARGET_URL=$(targetUrl) \
          /tests/load/basic-load-test.js
      displayName: 'Run Load Tests'
    
    - script: |
        docker run --rm \
          -v $(Build.SourcesDirectory)/tests:/tests \
          -v $(Build.ArtifactStagingDirectory)/reports:/reports \
          -e K6_OUT=json=/reports/stress-results.json \
          grafana/k6:$(k6Version) run \
          --vus $(($(virtualUsers) * 2)) \
          --duration $(testDuration) \
          --env TARGET_URL=$(targetUrl) \
          /tests/stress/stress-test.js
      displayName: 'Run Stress Tests'
    
    - script: |
        docker run --rm \
          -v $(Build.ArtifactStagingDirectory)/reports:/reports \
          -v $(Build.SourcesDirectory)/scripts:/scripts \
          node:16-alpine \
          node /scripts/generate-report.js /reports
      displayName: 'Generate HTML Report'
    
    - task: PublishTestResults@2
      displayName: 'Publish Test Results'
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: '$(Build.ArtifactStagingDirectory)/reports/junit-report.xml'
        failTaskOnFailedTests: true
    
    - task: PublishHtmlReport@1
      displayName: 'Publish HTML Report'
      inputs:
        reportDir: '$(Build.ArtifactStagingDirectory)/reports'
        tabName: 'k6 Performance Report'
    
    - task: PublishBuildArtifacts@1
      displayName: 'Publish Artifacts'
      inputs:
        pathToPublish: '$(Build.ArtifactStagingDirectory)/reports'
        artifactName: 'performance-reports'
```

### CircleCI Integration

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  docker: circleci/docker@2.1.4

executors:
  k6-executor:
    docker:
      - image: cimg/base:stable
    resource_class: medium

jobs:
  performance-tests:
    executor: k6-executor
    environment:
      K6_VERSION: latest
      TARGET_URL: https://staging.example.com
      TEST_DURATION: 5m
      VIRTUAL_USERS: 20
    steps:
      - checkout
      - setup_remote_docker:
          version: 20.10.14
      
      - run:
          name: Pull k6 Docker Image
          command: docker pull grafana/k6:$K6_VERSION
      
      - run:
          name: Create Reports Directory
          command: mkdir -p reports
      
      - run:
          name: Run Load Tests
          command: |
            docker run --rm \
              -v $PWD/tests:/tests \
              -v $PWD/reports:/reports \
              -e K6_OUT=json=/reports/load-results.json \
              grafana/k6:$K6_VERSION run \
              --vus $VIRTUAL_USERS \
              --duration $TEST_DURATION \
              --env TARGET_URL=$TARGET_URL \
              /tests/load/basic-load-test.js
      
      - run:
          name: Run Stress Tests
          command: |
            docker run --rm \
              -v $PWD/tests:/tests \
              -v $PWD/reports:/reports \
              -e K6_OUT=json=/reports/stress-results.json \
              grafana/k6:$K6_VERSION run \
              --vus $((VIRTUAL_USERS * 2)) \
              --duration $TEST_DURATION \
              --env TARGET_URL=$TARGET_URL \
              /tests/stress/stress-test.js
      
      - run:
          name: Generate HTML Report
          command: |
            docker run --rm \
              -v $PWD/reports:/reports \
              -v $PWD/scripts:/scripts \
              node:16-alpine \
              node /scripts/generate-report.js /reports
      
      - store_artifacts:
          path: reports
          destination: performance-reports
      
      - store_test_results:
          path: reports

workflows:
  performance-testing:
    jobs:
      - performance-tests:
          filters:
            branches:
              only:
                - main
                - develop
                - /feature\/.*/
```

### Bitbucket Pipelines Integration

```yaml
# bitbucket-pipelines.yml
image: atlassian/default-image:3

definitions:
  services:
    docker:
      memory: 2048

pipelines:
  default:
    - step:
        name: Performance Tests
        services:
          - docker
        caches:
          - docker
        script:
          - export K6_VERSION=latest
          - export TARGET_URL=https://staging.example.com
          - export TEST_DURATION=5m
          - export VIRTUAL_USERS=20
          
          # Pull k6 Docker image
          - docker pull grafana/k6:$K6_VERSION
          
          # Create reports directory
          - mkdir -p reports
          
          # Run Load Tests
          - |
            docker run --rm \
              -v $PWD/tests:/tests \
              -v $PWD/reports:/reports \
              -e K6_OUT=json=/reports/load-results.json \
              grafana/k6:$K6_VERSION run \
              --vus $VIRTUAL_USERS \
              --duration $TEST_DURATION \
              --env TARGET_URL=$TARGET_URL \
              /tests/load/basic-load-test.js
          
          # Run Stress Tests
          - |
            docker run --rm \
              -v $PWD/tests:/tests \
              -v $PWD/reports:/reports \
              -e K6_OUT=json=/reports/stress-results.json \
              grafana/k6:$K6_VERSION run \
              --vus $((VIRTUAL_USERS * 2)) \
              --duration $TEST_DURATION \
              --env TARGET_URL=$TARGET_URL \
              /tests/stress/stress-test.js
          
          # Generate HTML Report
          - |
            docker run --rm \
              -v $PWD/reports:/reports \
              -v $PWD/scripts:/scripts \
              node:16-alpine \
              node /scripts/generate-report.js /reports
        
        artifacts:
          - reports/**

  branches:
    main:
      - step:
          name: Production Performance Tests
          services:
            - docker
          script:
            - export TARGET_URL=https://production.example.com
            - export TEST_DURATION=10m
            - export VIRTUAL_USERS=50
            # ... rest of the performance testing steps
    
    develop:
      - step:
          name: Staging Performance Tests
          services:
            - docker
          script:
            - export TARGET_URL=https://staging.example.com
            - export TEST_DURATION=5m
            - export VIRTUAL_USERS=20
            # ... rest of the performance testing steps
```

### Tekton Pipelines Integration

```yaml
# tekton/k6-performance-pipeline.yaml
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: k6-performance-pipeline
spec:
  params:
    - name: target-url
      type: string
      default: "https://staging.example.com"
    - name: test-duration
      type: string
      default: "5m"
    - name: virtual-users
      type: string
      default: "20"
    - name: k6-version
      type: string
      default: "latest"
  
  workspaces:
    - name: source-code
    - name: reports
  
  tasks:
    - name: setup-environment
      taskRef:
        name: setup-k6-environment
      workspaces:
        - name: source
          workspace: source-code
      params:
        - name: k6-version
          value: $(params.k6-version)
    
    - name: load-testing
      taskRef:
        name: run-k6-tests
      runAfter:
        - setup-environment
      workspaces:
        - name: source
          workspace: source-code
        - name: reports
          workspace: reports
      params:
        - name: test-type
          value: "load"
        - name: target-url
          value: $(params.target-url)
        - name: duration
          value: $(params.test-duration)
        - name: vus
          value: $(params.virtual-users)
    
    - name: stress-testing
      taskRef:
        name: run-k6-tests
      runAfter:
        - setup-environment
      workspaces:
        - name: source
          workspace: source-code
        - name: reports
          workspace: reports
      params:
        - name: test-type
          value: "stress"
        - name: target-url
          value: $(params.target-url)
        - name: duration
          value: $(params.test-duration)
        - name: vus
          value: "40"  # Double the VUs for stress testing
    
    - name: generate-reports
      taskRef:
        name: generate-performance-reports
      runAfter:
        - load-testing
        - stress-testing
      workspaces:
        - name: reports
          workspace: reports

---
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: run-k6-tests
spec:
  params:
    - name: test-type
      type: string
    - name: target-url
      type: string
    - name: duration
      type: string
    - name: vus
      type: string
  
  workspaces:
    - name: source
    - name: reports
  
  steps:
    - name: run-k6-test
      image: grafana/k6:latest
      script: |
        #!/bin/sh
        k6 run \
          --vus $(params.vus) \
          --duration $(params.duration) \
          --env TARGET_URL=$(params.target-url) \
          --out json=$(workspaces.reports.path)/$(params.test-type)-results.json \
          $(workspaces.source.path)/tests/$(params.test-type)/$(params.test-type)-test.js
```

### GitHub Actions Integration

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [load, stress, spike]
        environment: [staging, production]
        exclude:
          - test-type: spike
            environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup k6
      uses: grafana/setup-k6-action@v1
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Start test environment
      run: |
        cd modules/module-8-k6-performance
        docker-compose up -d quote-app postgres influxdb grafana
        sleep 60 # Wait for services to be ready
    
    - name: Wait for services
      run: |
        timeout 300 bash -c 'until curl -f http://localhost:3000/health; do sleep 5; done'
        timeout 300 bash -c 'until curl -f http://localhost:8086/ping; do sleep 5; done'
    
    - name: Run ${{ matrix.test-type }} Tests on ${{ matrix.environment }}
      env:
        TARGET_URL: ${{ matrix.environment == 'production' && 'https://api.production.example.com' || 'http://localhost:3000' }}
        TEST_DURATION: ${{ matrix.environment == 'production' && '10m' || '5m' }}
        VIRTUAL_USERS: ${{ matrix.environment == 'production' && '100' || '20' }}
      run: |
        cd modules/module-8-k6-performance
        mkdir -p reports
        k6 run \
          --out json=reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json \
          --out influxdb=http://localhost:8086/k6 \
          --vus $VIRTUAL_USERS \
          --duration $TEST_DURATION \
          --env TARGET_URL=$TARGET_URL \
          --env ENVIRONMENT=${{ matrix.environment }} \
          tests/${{ matrix.test-type }}/${{ matrix.test-type }}-test.js
    
    - name: Generate Performance Report
      run: |
        cd modules/module-8-k6-performance
        node scripts/generate-report.js reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json
    
    - name: Performance Analysis
      id: analysis
      run: |
        cd modules/module-8-k6-performance
        ANALYSIS=$(node scripts/analyze-performance.js reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json)
        echo "analysis<<EOF" >> $GITHUB_OUTPUT
        echo "$ANALYSIS" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT
    
    - name: Upload Performance Results
      uses: actions/upload-artifact@v4
      with:
        name: performance-results-${{ matrix.test-type }}-${{ matrix.environment }}
        path: modules/module-8-k6-performance/reports/
        retention-days: 30
    
    - name: Comment PR with Results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const path = 'modules/module-8-k6-performance/reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json';
          
          if (fs.existsSync(path)) {
            const results = JSON.parse(fs.readFileSync(path));
            const metrics = results.metrics;
            
            const comment = `## 🚀 Performance Test Results - ${{ matrix.test-type }} (${{ matrix.environment }})
            
            | Metric | Value | Threshold | Status |
            |--------|-------|-----------|--------|
            | Avg Response Time | ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms | <1000ms | ${(metrics.http_req_duration?.values?.avg || 0) < 1000 ? '✅' : '❌'} |
            | 95th Percentile | ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms | <2000ms | ${(metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000 ? '✅' : '❌'} |
            | Error Rate | ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}% | <5% | ${(metrics.http_req_failed?.values?.rate || 0) < 0.05 ? '✅' : '❌'} |
            | Throughput | ${Math.round(metrics.http_reqs?.values?.rate || 0)} RPS | >10 RPS | ${(metrics.http_reqs?.values?.rate || 0) > 10 ? '✅' : '❌'} |
            
            📊 **Analysis**: ${{ steps.analysis.outputs.analysis }}
            
            📈 [View Detailed Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
          }
    
    - name: Performance Regression Check
      if: github.event_name == 'pull_request'
      run: |
        cd modules/module-8-k6-performance
        if [ -f "baseline/${{ matrix.test-type }}-${{ matrix.environment }}-baseline.json" ]; then
          node scripts/compare-performance.js \
            baseline/${{ matrix.test-type }}-${{ matrix.environment }}-baseline.json \
            reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json
        else
          echo "No baseline found for comparison"
        fi
    
    - name: Update Performance Baseline
      if: github.ref == 'refs/heads/main' && github.event_name == 'push'
      run: |
        cd modules/module-8-k6-performance
        mkdir -p baseline
        cp reports/${{ matrix.test-type }}-${{ matrix.environment }}-results.json \
           baseline/${{ matrix.test-type }}-${{ matrix.environment }}-baseline.json
        
        # Commit baseline update
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add baseline/
        git diff --staged --quiet || git commit -m "Update performance baseline for ${{ matrix.test-type }}-${{ matrix.environment }}"
        git push
    
    - name: Cleanup
      if: always()
      run: |
        cd modules/module-8-k6-performance
        docker-compose down -v
        docker system prune -f

  performance-summary:
    needs: performance-tests
    runs-on: ubuntu-latest
    if: always()
    steps:
    - name: Download all artifacts
      uses: actions/download-artifact@v4
      with:
        path: performance-results
    
    - name: Generate Summary Report
      run: |
        echo "# 📊 Performance Testing Summary" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        echo "| Test Type | Environment | Status | Artifacts |" >> $GITHUB_STEP_SUMMARY
        echo "|-----------|-------------|--------|-----------|" >> $GITHUB_STEP_SUMMARY
        
        for dir in performance-results/*/; do
          if [ -d "$dir" ]; then
            name=$(basename "$dir")
            echo "| ${name} | - | ✅ | [Download](${dir}) |" >> $GITHUB_STEP_SUMMARY
          fi
        done
```

### Integration Best Practices

#### 1. Environment-Specific Configuration

```javascript
// config/ci-environments.js
export const environments = {
    development: {
        targetUrl: 'http://localhost:3000',
        vus: 5,
        duration: '2m',
        thresholds: {
            http_req_duration: ['p(95)<2000'],
            http_req_failed: ['rate<0.1']
        }
    },
    
    staging: {
        targetUrl: 'https://staging.example.com',
        vus: 20,
        duration: '5m',
        thresholds: {
            http_req_duration: ['p(95)<1500'],
            http_req_failed: ['rate<0.05']
        }
    },
    
    production: {
        targetUrl: 'https://production.example.com',
        vus: 50,
        duration: '10m',
        thresholds: {
            http_req_duration: ['p(95)<1000'],
            http_req_failed: ['rate<0.01']
        }
    }
};

export function getEnvironmentConfig(env) {
    return environments[env] || environments.staging;
}
```

#### 2. Branch-Specific Testing Strategy

```yaml
# Branch-specific CI configuration
performance_strategy:
  main:
    tests: ['load', 'stress', 'spike']
    duration: '10m'
    vus: 100
    fail_on_threshold: true
    
  develop:
    tests: ['load', 'stress']
    duration: '5m'
    vus: 50
    fail_on_threshold: true
    
  feature/*:
    tests: ['load']
    duration: '2m'
    vus: 20
    fail_on_threshold: false
    
  hotfix/*:
    tests: ['load', 'stress']
    duration: '3m'
    vus: 30
    fail_on_threshold: true
```

#### 3. Performance Budgets and Quality Gates

```javascript
// scripts/performance-budget.js
export const performanceBudgets = {
    // Response time budgets (in milliseconds)
    responseTime: {
        p50: 500,
        p95: 1000,
        p99: 2000
    },
    
    // Error rate budgets (as percentage)
    errorRate: {
        max: 1.0  // 1% maximum error rate
    },
    
    // Throughput budgets (requests per second)
    throughput: {
        min: 100  // Minimum 100 RPS
    },
    
    // Resource utilization budgets
    resources: {
        cpu: 80,     // Maximum 80% CPU
        memory: 85,  // Maximum 85% memory
        disk: 90     // Maximum 90% disk
    }
};

export function validatePerformanceBudget(results) {
    const violations = [];
    
    // Check response time budgets
    if (results.metrics.http_req_duration.values['p(95)'] > performanceBudgets.responseTime.p95) {
        violations.push(`95th percentile response time exceeded: ${results.metrics.http_req_duration.values['p(95)']}ms > ${performanceBudgets.responseTime.p95}ms`);
    }
    
    // Check error rate budget
    const errorRate = results.metrics.http_req_failed.values.rate * 100;
    if (errorRate > performanceBudgets.errorRate.max) {
        violations.push(`Error rate exceeded: ${errorRate}% > ${performanceBudgets.errorRate.max}%`);
    }
    
    // Check throughput budget
    const throughput = results.metrics.http_reqs.values.rate;
    if (throughput < performanceBudgets.throughput.min) {
        violations.push(`Throughput below minimum: ${throughput} RPS < ${performanceBudgets.throughput.min} RPS`);
    }
    
    return {
        passed: violations.length === 0,
        violations: violations
    };
}
```

## 📊 Monitoring and Reporting

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "k6 Performance Testing Dashboard",
    "tags": ["k6", "performance", "testing"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Virtual Users",
        "type": "graph",
        "targets": [
          {
            "expr": "k6_vus",
            "legendFormat": "Virtual Users"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(k6_http_reqs_total[1m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "k6_http_req_duration",
            "legendFormat": "Response Time"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(k6_http_req_failed_total[5m]) * 100",
            "legendFormat": "Error Rate %"
          }
        ]
      }
    ]
  }
}
```

## 🎯 Best Practices

### 1. Test Design Principles

- **Start Small**: Begin with simple load tests before complex scenarios
- **Realistic Data**: Use production-like data and user patterns
- **Gradual Ramp-up**: Avoid sudden load spikes in regular testing
- **Environment Isolation**: Use dedicated test environments
- **Baseline Establishment**: Create performance baselines for comparison

### 2. DDOS Testing Guidelines

- **Controlled Environment**: Only test on your own systems
- **Legal Compliance**: Ensure testing complies with legal requirements
- **Resource Monitoring**: Monitor system resources during tests
- **Recovery Testing**: Test system recovery after attacks
- **Documentation**: Document attack patterns and system responses

### 3. CI/CD Integration

- **Automated Thresholds**: Set performance thresholds in CI/CD
- **Fail Fast**: Fail builds on performance regressions
- **Trend Analysis**: Track performance trends over time
- **Environment Parity**: Ensure test environments match production
- **Notification Strategy**: Alert teams on performance issues

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Monitor k6 memory usage
docker stats k6-container

# Reduce VU count or use arrival-rate executor
export K6_VUS=50
export K6_DURATION=5m
```

#### Network Timeouts
```javascript
// Increase timeout in test scripts
export let options = {
  timeout: '120s',
  noConnectionReuse: true,
};
```

#### Database Connection Issues
```bash
# Check database connectivity
docker exec -it postgres psql -U quotes -d quotes_db -c "SELECT 1;"

# Increase connection pool
export DB_MAX_CONNECTIONS=100
```

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [k6 Extensions](https://k6.io/docs/extensions/)
- [Grafana k6 Dashboards](https://grafana.com/grafana/dashboards/?search=k6)

## 🎓 Learning Challenges

### Challenge 1: Basic Performance Testing
1. Set up the k6 environment
2. Create a simple load test for the quote application
3. Run the test and analyze results
4. Set up Grafana dashboard for visualization

### Challenge 2: Advanced Stress Testing
1. Design a comprehensive stress test scenario
2. Implement breakpoint testing
3. Create custom metrics and thresholds
4. Generate detailed performance reports

### Challenge 3: DDOS Simulation
1. Implement multiple DDOS attack vectors
2. Test system resilience and recovery
3. Create monitoring and alerting for attacks
4. Document mitigation strategies

### Challenge 4: CI/CD Integration
1. Integrate k6 tests into Jenkins pipeline
2. Set up automated performance regression detection
3. Create performance trend reporting
4. Implement performance-based deployment gates

## 🏆 Completion Criteria

- [ ] Successfully run all test types (load, stress, spike, DDOS)
- [ ] Set up complete monitoring and visualization
- [ ] Integrate performance tests into CI/CD pipeline
- [ ] Create comprehensive performance reports
- [ ] Implement automated performance regression detection
- [ ] Document performance testing strategy and results

---

**Next Module**: [Module 9: Advanced Topics](../module-9-advanced/README.md)

**Previous Module**: [Module 7: Advanced CI/CD with Jenkins](../module-7-jenkins/README.md)

🚀 **Ready to master performance testing?** Start with Challenge 1 and build your k6 expertise!