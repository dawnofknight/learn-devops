import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTimeTrend = new Trend('response_time_custom');
export let requestCounter = new Counter('requests_total');
export let activeUsers = new Gauge('active_users');
export let endpointErrors = new Counter('endpoint_errors');

export let options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up to 50 users over 5 minutes
    { duration: '30m', target: 50 },  // Sustained load of 50 users for 30 minutes
    { duration: '10m', target: 100 }, // Increase to 100 users over 10 minutes
    { duration: '20m', target: 100 }, // Sustained load of 100 users for 20 minutes
    { duration: '5m', target: 0 },    // Ramp down to 0 users over 5 minutes
  ],
  
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    'http_req_duration{endpoint:quotes_list}': ['p(95)<800'],
    'http_req_duration{endpoint:random_quote}': ['p(95)<500'],
    'http_req_duration{endpoint:health_check}': ['p(95)<200'],
    
    // Error rate thresholds
    errors: ['rate<0.02'], // Less than 2% error rate
    http_req_failed: ['rate<0.05'], // Less than 5% failed requests
    'http_req_failed{endpoint:health_check}': ['rate<0.01'],
    
    // Throughput thresholds
    http_reqs: ['rate>10'], // At least 10 requests per second
    
    // Custom metrics thresholds
    requests_total: ['count>5000'], // At least 5000 total requests
    endpoint_errors: ['count<100'], // Less than 100 endpoint errors
  },
  
  // Test metadata
  tags: {
    test_type: 'sustained_load',
    environment: 'development',
    duration: '70m',
  },
};

// Test configuration
const BASE_URL = __ENV.TARGET || 'http://localhost:3000';
const THINK_TIME_MIN = parseFloat(__ENV.THINK_TIME_MIN) || 1;
const THINK_TIME_MAX = parseFloat(__ENV.THINK_TIME_MAX) || 5;

// User behavior patterns
const USER_BEHAVIORS = [
  'casual_browser',    // 40% - Casual browsing
  'active_reader',     // 30% - Active reading
  'quick_visitor',     // 20% - Quick visits
  'heavy_user',        // 10% - Heavy usage
];

export default function () {
  // Determine user behavior for this VU
  const behaviorIndex = __VU % USER_BEHAVIORS.length;
  const userBehavior = USER_BEHAVIORS[behaviorIndex];
  
  // Update active users metric
  activeUsers.add(__VU);
  
  // Test data
  const testData = {
    userId: Math.floor(Math.random() * 10000) + 1,
    sessionId: `session_${__VU}_${__ITER}`,
    userBehavior: userBehavior,
    startTime: new Date().getTime(),
  };

  // Execute behavior-specific test scenario
  switch (userBehavior) {
    case 'casual_browser':
      casualBrowserScenario(testData);
      break;
    case 'active_reader':
      activeReaderScenario(testData);
      break;
    case 'quick_visitor':
      quickVisitorScenario(testData);
      break;
    case 'heavy_user':
      heavyUserScenario(testData);
      break;
  }
}

function casualBrowserScenario(testData) {
  // Casual browser: Views main page, maybe a random quote, then leaves
  
  // 1. Get quotes list
  let response = makeRequest('GET', '/api/quotes', 'quotes_list', testData);
  validateResponse(response, 'quotes_list', {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'has quotes': (r) => r.body && r.body.length > 0,
  });
  
  sleep(randomThinkTime(2, 5)); // Longer think time for casual users
  
  // 2. Maybe get a random quote (70% chance)
  if (Math.random() < 0.7) {
    response = makeRequest('GET', '/api/quotes/random', 'random_quote', testData);
    validateResponse(response, 'random_quote', {
      'status is 200': (r) => r.status === 200,
      'response time < 800ms': (r) => r.timings.duration < 800,
    });
    
    sleep(randomThinkTime(3, 8)); // Read the quote
  }
  
  // 3. Health check (simulate page refresh)
  response = makeRequest('GET', '/api/health', 'health_check', testData);
  validateResponse(response, 'health_check', {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
}

function activeReaderScenario(testData) {
  // Active reader: Views multiple pages, searches, reads multiple quotes
  
  // 1. Get quotes list
  let response = makeRequest('GET', '/api/quotes', 'quotes_list', testData);
  validateResponse(response, 'quotes_list', {
    'status is 200': (r) => r.status === 200,
    'response time < 800ms': (r) => r.timings.duration < 800,
  });
  
  sleep(randomThinkTime(1, 3));
  
  // 2. Get multiple random quotes
  for (let i = 0; i < 3; i++) {
    response = makeRequest('GET', '/api/quotes/random', 'random_quote', testData);
    validateResponse(response, 'random_quote', {
      'status is 200': (r) => r.status === 200,
      'response time < 600ms': (r) => r.timings.duration < 600,
    });
    
    sleep(randomThinkTime(2, 4)); // Time to read
  }
  
  // 3. Check health periodically
  response = makeRequest('GET', '/api/health', 'health_check', testData);
  validateResponse(response, 'health_check', {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(randomThinkTime(1, 2));
  
  // 4. Get quotes list again (pagination or refresh)
  response = makeRequest('GET', '/api/quotes?page=2', 'quotes_list', testData);
  validateResponse(response, 'quotes_list', {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function quickVisitorScenario(testData) {
  // Quick visitor: Fast browsing, minimal interaction
  
  // 1. Quick health check
  let response = makeRequest('GET', '/api/health', 'health_check', testData);
  validateResponse(response, 'health_check', {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(randomThinkTime(0.5, 1));
  
  // 2. Quick random quote
  response = makeRequest('GET', '/api/quotes/random', 'random_quote', testData);
  validateResponse(response, 'random_quote', {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(randomThinkTime(0.5, 2)); // Quick read and leave
}

function heavyUserScenario(testData) {
  // Heavy user: Multiple interactions, API calls, longer session
  
  // 1. Get quotes list
  let response = makeRequest('GET', '/api/quotes', 'quotes_list', testData);
  validateResponse(response, 'quotes_list', {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(randomThinkTime(1, 2));
  
  // 2. Multiple random quotes with different parameters
  for (let i = 0; i < 5; i++) {
    const endpoint = i % 2 === 0 ? '/api/quotes/random' : `/api/quotes/random?category=${i}`;
    response = makeRequest('GET', endpoint, 'random_quote', testData);
    validateResponse(response, 'random_quote', {
      'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'response time < 800ms': (r) => r.timings.duration < 800,
    });
    
    sleep(randomThinkTime(1, 3));
  }
  
  // 3. Health checks (simulate monitoring)
  for (let i = 0; i < 2; i++) {
    response = makeRequest('GET', '/api/health', 'health_check', testData);
    validateResponse(response, 'health_check', {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });
    
    sleep(randomThinkTime(0.5, 1));
  }
  
  // 4. Final quotes list check
  response = makeRequest('GET', '/api/quotes?limit=50', 'quotes_list', testData);
  validateResponse(response, 'quotes_list', {
    'status is 200': (r) => r.status === 200,
    'response time < 1500ms': (r) => r.timings.duration < 1500,
  });
}

function makeRequest(method, endpoint, endpointTag, testData) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'User-Agent': `k6-sustained-test/1.0 (${testData.userBehavior})`,
    'Accept': 'application/json',
    'X-Session-ID': testData.sessionId,
    'X-User-ID': testData.userId.toString(),
    'X-Request-ID': `req_${__VU}_${__ITER}_${Date.now()}`,
  };
  
  const params = {
    headers: headers,
    tags: { 
      endpoint: endpointTag,
      user_behavior: testData.userBehavior,
    },
    timeout: '30s',
  };
  
  let response;
  const startTime = new Date().getTime();
  
  try {
    if (method === 'GET') {
      response = http.get(url, params);
    } else if (method === 'POST') {
      response = http.post(url, null, params);
    }
    
    // Record metrics
    requestCounter.add(1);
    responseTimeTrend.add(response.timings.duration);
    
    // Log slow requests
    if (response.timings.duration > 2000) {
      console.warn(`⚠️  Slow request: ${endpoint} took ${response.timings.duration.toFixed(2)}ms`);
    }
    
  } catch (error) {
    console.error(`❌ Request failed: ${endpoint} - ${error.message}`);
    endpointErrors.add(1, { endpoint: endpointTag });
    response = { status: 0, timings: { duration: 0 }, body: '' };
  }
  
  return response;
}

function validateResponse(response, endpoint, checks) {
  const result = check(response, checks, { endpoint: endpoint });
  
  if (!result) {
    errorRate.add(1);
    endpointErrors.add(1, { endpoint: endpoint });
  }
  
  return result;
}

function randomThinkTime(min = THINK_TIME_MIN, max = THINK_TIME_MAX) {
  return Math.random() * (max - min) + min;
}

// Setup function
export function setup() {
  console.log('🚀 Starting k6 Sustained Load Test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`⏱️  Think Time: ${THINK_TIME_MIN}s - ${THINK_TIME_MAX}s`);
  console.log(`👥 User Behaviors: ${USER_BEHAVIORS.join(', ')}`);
  
  // Verify target is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`Target ${BASE_URL} is not accessible. Status: ${response.status}`);
  }
  
  console.log('✅ Target is accessible, starting test...');
  
  return { 
    startTime: new Date().toISOString(),
    targetUrl: BASE_URL,
  };
}

// Teardown function
export function teardown(data) {
  console.log('✅ k6 Sustained Load Test completed');
  console.log(`🕐 Started at: ${data.startTime}`);
  console.log(`🕐 Ended at: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${data.targetUrl}`);
}

// Custom summary report
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/sustained-load-summary.json': JSON.stringify(data, null, 2),
    'reports/sustained-load-report.html': htmlReport(data),
  };
  
  // Calculate and display custom metrics
  const totalRequests = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const totalErrors = data.metrics.errors ? data.metrics.errors.values.count : 0;
  const avgResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0;
  const p95ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  const p99ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0;
  
  console.log('\n📊 Sustained Load Test Summary:');
  console.log(`📈 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`📊 Error Rate: ${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`🎯 95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`🎯 99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);
  
  // Performance assessment
  if (totalErrors / totalRequests < 0.02 && p95ResponseTime < 1000) {
    console.log('✅ Performance: EXCELLENT');
  } else if (totalErrors / totalRequests < 0.05 && p95ResponseTime < 2000) {
    console.log('⚠️  Performance: GOOD');
  } else {
    console.log('❌ Performance: NEEDS IMPROVEMENT');
  }
  
  return summary;
}