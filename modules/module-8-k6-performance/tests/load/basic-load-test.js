import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTimeTrend = new Trend('response_time_custom');
export let requestCounter = new Counter('requests_total');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users over 2 minutes
    { duration: '5m', target: 10 }, // Stay at 10 users for 5 minutes
    { duration: '2m', target: 20 }, // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 20 }, // Stay at 20 users for 5 minutes
    { duration: '2m', target: 0 },  // Ramp down to 0 users over 2 minutes
  ],
  
  thresholds: {
    // 95% of requests must complete below 500ms
    http_req_duration: ['p(95)<500'],
    // 99% of requests must complete below 1000ms
    'http_req_duration{expected_response:true}': ['p(99)<1000'],
    // Error rate must be below 1%
    errors: ['rate<0.01'],
    // Request rate should be above 1 req/s
    http_reqs: ['rate>1'],
    // Failed requests should be below 5%
    http_req_failed: ['rate<0.05'],
  },
  
  // Test metadata
  tags: {
    test_type: 'load',
    environment: 'development',
  },
};

// Test configuration
const BASE_URL = __ENV.TARGET || 'http://localhost:3000';
const THINK_TIME = parseFloat(__ENV.THINK_TIME) || 1;

export default function () {
  // Test data
  const testData = {
    userId: Math.floor(Math.random() * 1000) + 1,
    sessionId: `session_${__VU}_${__ITER}`,
  };

  // Test scenario: User browsing quotes
  let response;
  
  // 1. Get all quotes (main page)
  response = http.get(`${BASE_URL}/api/quotes`, {
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'Accept': 'application/json',
      'X-Session-ID': testData.sessionId,
    },
    tags: { endpoint: 'quotes_list' },
  });
  
  requestCounter.add(1);
  responseTimeTrend.add(response.timings.duration);
  
  const quotesListCheck = check(response, {
    'quotes list status is 200': (r) => r.status === 200,
    'quotes list response time < 500ms': (r) => r.timings.duration < 500,
    'quotes list has content': (r) => r.body && r.body.length > 0,
    'quotes list content-type is JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  });
  
  if (!quotesListCheck) {
    errorRate.add(1);
  }
  
  sleep(THINK_TIME);
  
  // 2. Get random quote
  response = http.get(`${BASE_URL}/api/quotes/random`, {
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'Accept': 'application/json',
      'X-Session-ID': testData.sessionId,
    },
    tags: { endpoint: 'random_quote' },
  });
  
  requestCounter.add(1);
  responseTimeTrend.add(response.timings.duration);
  
  const randomQuoteCheck = check(response, {
    'random quote status is 200': (r) => r.status === 200,
    'random quote response time < 300ms': (r) => r.timings.duration < 300,
    'random quote has content': (r) => r.body && r.body.length > 0,
  });
  
  if (!randomQuoteCheck) {
    errorRate.add(1);
  }
  
  sleep(THINK_TIME * 0.5);
  
  // 3. Health check
  response = http.get(`${BASE_URL}/api/health`, {
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'X-Session-ID': testData.sessionId,
    },
    tags: { endpoint: 'health_check' },
  });
  
  requestCounter.add(1);
  responseTimeTrend.add(response.timings.duration);
  
  const healthCheck = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  if (!healthCheck) {
    errorRate.add(1);
  }
  
  // Random think time between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('🚀 Starting k6 Load Test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`⏱️  Think Time: ${THINK_TIME}s`);
  
  // Verify target is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`Target ${BASE_URL} is not accessible. Status: ${response.status}`);
  }
  
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('✅ k6 Load Test completed');
  console.log(`🕐 Started at: ${data.startTime}`);
  console.log(`🕐 Ended at: ${new Date().toISOString()}`);
}

// Custom summary report
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/load-test-summary.json': JSON.stringify(data, null, 2),
    'reports/load-test-report.html': htmlReport(data),
  };
  
  // Add custom metrics to summary
  if (data.metrics.errors) {
    console.log(`❌ Total Errors: ${data.metrics.errors.values.count}`);
    console.log(`📊 Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);
  }
  
  if (data.metrics.http_req_duration) {
    console.log(`⚡ Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
    console.log(`🎯 95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  }
  
  return summary;
}