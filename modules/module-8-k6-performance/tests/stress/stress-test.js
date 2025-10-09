import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for stress testing
export let errorRate = new Rate('errors');
export let responseTimeTrend = new Trend('response_time_custom');
export let requestCounter = new Counter('requests_total');
export let activeUsers = new Gauge('active_users');
export let systemStressLevel = new Gauge('system_stress_level');
export let timeoutCounter = new Counter('timeouts');
export let serverErrorCounter = new Counter('server_errors');

export let options = {
  stages: [
    // Baseline - Normal load
    { duration: '2m', target: 50 },   // Ramp up to normal load
    { duration: '3m', target: 50 },   // Stay at normal load
    
    // Stress Phase 1 - High load
    { duration: '2m', target: 150 },  // Ramp up to high load
    { duration: '5m', target: 150 },  // Stay at high load
    
    // Stress Phase 2 - Very high load
    { duration: '2m', target: 300 },  // Ramp up to very high load
    { duration: '5m', target: 300 },  // Stay at very high load
    
    // Stress Phase 3 - Extreme load
    { duration: '2m', target: 500 },  // Ramp up to extreme load
    { duration: '5m', target: 500 },  // Stay at extreme load
    
    // Breaking Point - Push to limits
    { duration: '2m', target: 800 },  // Ramp up to breaking point
    { duration: '5m', target: 800 },  // Stay at breaking point
    
    // Recovery Phase
    { duration: '3m', target: 50 },   // Quick ramp down to normal
    { duration: '5m', target: 50 },   // Recovery at normal load
    { duration: '2m', target: 0 },    // Final ramp down
  ],
  
  thresholds: {
    // Relaxed thresholds for stress testing
    http_req_duration: ['p(95)<5000', 'p(99)<10000'], // Allow higher response times
    http_req_failed: ['rate<0.3'], // Allow up to 30% failure rate
    errors: ['rate<0.4'], // Allow up to 40% error rate
    timeouts: ['count<1000'], // Limit timeouts
    server_errors: ['count<500'], // Limit server errors
    
    // Per-stage thresholds
    'http_req_duration{stage:baseline}': ['p(95)<1000'],
    'http_req_duration{stage:high_load}': ['p(95)<2000'],
    'http_req_duration{stage:very_high_load}': ['p(95)<3000'],
    'http_req_duration{stage:extreme_load}': ['p(95)<5000'],
    'http_req_duration{stage:breaking_point}': ['p(95)<10000'],
    'http_req_duration{stage:recovery}': ['p(95)<2000'],
  },
  
  // Test metadata
  tags: {
    test_type: 'stress',
    environment: 'development',
    duration: '43m',
  },
  
  // Disable default timeout to handle slow responses
  timeout: '120s',
};

// Test configuration
const BASE_URL = __ENV.TARGET || 'http://localhost:3000';
const MAX_RETRIES = parseInt(__ENV.MAX_RETRIES) || 3;
const RETRY_DELAY = parseFloat(__ENV.RETRY_DELAY) || 1;

// Stress test patterns
const STRESS_PATTERNS = [
  'rapid_fire',      // 25% - Rapid consecutive requests
  'resource_heavy',  // 25% - Resource-intensive requests
  'connection_hold', // 25% - Hold connections longer
  'random_chaos',    // 25% - Random chaotic behavior
];

export default function () {
  // Determine current stress level based on VU count
  const currentVUs = __VU;
  let stressLevel, stageTag;
  
  if (currentVUs <= 50) {
    stressLevel = 1;
    stageTag = 'baseline';
  } else if (currentVUs <= 150) {
    stressLevel = 2;
    stageTag = 'high_load';
  } else if (currentVUs <= 300) {
    stressLevel = 3;
    stageTag = 'very_high_load';
  } else if (currentVUs <= 500) {
    stressLevel = 4;
    stageTag = 'extreme_load';
  } else if (currentVUs <= 800) {
    stressLevel = 5;
    stageTag = 'breaking_point';
  } else {
    stressLevel = 2;
    stageTag = 'recovery';
  }
  
  systemStressLevel.add(stressLevel);
  activeUsers.add(currentVUs);
  
  // Select stress pattern
  const patternIndex = __VU % STRESS_PATTERNS.length;
  const stressPattern = STRESS_PATTERNS[patternIndex];
  
  // Test data
  const testData = {
    userId: Math.floor(Math.random() * 100000) + 1,
    sessionId: `stress_session_${__VU}_${__ITER}`,
    stressPattern: stressPattern,
    stressLevel: stressLevel,
    stageTag: stageTag,
    startTime: new Date().getTime(),
  };

  // Execute stress pattern
  try {
    switch (stressPattern) {
      case 'rapid_fire':
        rapidFirePattern(testData);
        break;
      case 'resource_heavy':
        resourceHeavyPattern(testData);
        break;
      case 'connection_hold':
        connectionHoldPattern(testData);
        break;
      case 'random_chaos':
        randomChaosPattern(testData);
        break;
    }
  } catch (error) {
    console.error(`❌ Stress pattern ${stressPattern} failed: ${error.message}`);
    errorRate.add(1);
  }
}

function rapidFirePattern(testData) {
  // Rapid consecutive requests with minimal think time
  const requestCount = Math.min(testData.stressLevel * 2, 10);
  
  for (let i = 0; i < requestCount; i++) {
    const endpoint = i % 2 === 0 ? '/api/quotes' : '/api/quotes/random';
    const response = makeStressRequest('GET', endpoint, 'rapid_fire', testData);
    
    validateStressResponse(response, 'rapid_fire', {
      'rapid fire request completed': (r) => r.status !== 0,
      'rapid fire response time acceptable': (r) => r.timings.duration < 10000,
    }, testData);
    
    // Minimal sleep between rapid requests
    sleep(0.1);
  }
  
  // Short recovery
  sleep(Math.random() * 2);
}

function resourceHeavyPattern(testData) {
  // Requests that consume more server resources
  const heavyEndpoints = [
    '/api/quotes?limit=1000',
    '/api/quotes?search=stress&detailed=true',
    '/api/quotes/export?format=json',
    '/api/analytics?range=all',
  ];
  
  for (let i = 0; i < Math.min(testData.stressLevel, 5); i++) {
    const endpoint = heavyEndpoints[i % heavyEndpoints.length];
    const response = makeStressRequest('GET', endpoint, 'resource_heavy', testData);
    
    validateStressResponse(response, 'resource_heavy', {
      'resource heavy request completed': (r) => r.status !== 0,
      'resource heavy request not timed out': (r) => r.status !== 0 || r.error_code !== 1050,
    }, testData);
    
    // Longer think time for heavy requests
    sleep(Math.random() * 3 + 1);
  }
}

function connectionHoldPattern(testData) {
  // Hold connections longer to stress connection pools
  const response = makeStressRequest('GET', '/api/quotes', 'connection_hold', testData, {
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=30, max=100',
  });
  
  validateStressResponse(response, 'connection_hold', {
    'connection hold request completed': (r) => r.status !== 0,
    'connection maintained': (r) => r.status === 200 || r.status === 429,
  }, testData);
  
  // Hold the connection longer
  sleep(Math.random() * 10 + 5);
  
  // Make another request on the same connection
  const followupResponse = makeStressRequest('GET', '/api/health', 'connection_hold', testData);
  validateStressResponse(followupResponse, 'connection_hold_followup', {
    'followup request completed': (r) => r.status !== 0,
  }, testData);
}

function randomChaosPattern(testData) {
  // Random chaotic behavior to simulate unpredictable load
  const chaosActions = [
    () => {
      // Burst of requests
      for (let i = 0; i < 5; i++) {
        makeStressRequest('GET', '/api/quotes/random', 'chaos_burst', testData);
        sleep(0.05);
      }
    },
    () => {
      // Large payload request
      const largeData = 'x'.repeat(Math.min(testData.stressLevel * 1000, 10000));
      makeStressRequest('POST', '/api/quotes', 'chaos_large_payload', testData, {}, largeData);
    },
    () => {
      // Random endpoints
      const randomEndpoint = `/api/${Math.random().toString(36).substring(7)}`;
      makeStressRequest('GET', randomEndpoint, 'chaos_random', testData);
    },
    () => {
      // Malformed requests
      makeStressRequest('GET', '/api/quotes', 'chaos_malformed', testData, {
        'Content-Length': '999999',
        'X-Chaos': 'true',
      });
    },
  ];
  
  // Execute random chaos actions
  const actionCount = Math.min(testData.stressLevel, 3);
  for (let i = 0; i < actionCount; i++) {
    const action = chaosActions[Math.floor(Math.random() * chaosActions.length)];
    try {
      action();
    } catch (error) {
      console.warn(`⚠️  Chaos action failed: ${error.message}`);
    }
    sleep(Math.random() * 2);
  }
}

function makeStressRequest(method, endpoint, requestType, testData, extraHeaders = {}, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'User-Agent': `k6-stress-test/1.0 (${testData.stressPattern})`,
    'Accept': 'application/json',
    'X-Session-ID': testData.sessionId,
    'X-User-ID': testData.userId.toString(),
    'X-Stress-Level': testData.stressLevel.toString(),
    'X-Request-Type': requestType,
    'X-Request-ID': `stress_${__VU}_${__ITER}_${Date.now()}`,
    ...extraHeaders,
  };
  
  const params = {
    headers: headers,
    tags: { 
      endpoint: requestType,
      stress_pattern: testData.stressPattern,
      stress_level: testData.stressLevel.toString(),
      stage: testData.stageTag,
    },
    timeout: '60s',
  };
  
  let response;
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      const startTime = new Date().getTime();
      
      if (method === 'GET') {
        response = http.get(url, params);
      } else if (method === 'POST') {
        response = http.post(url, body, params);
      }
      
      // Record metrics
      requestCounter.add(1);
      responseTimeTrend.add(response.timings.duration);
      
      // Check for timeouts
      if (response.timings.duration > 30000) {
        timeoutCounter.add(1);
        console.warn(`⏰ Timeout: ${endpoint} took ${response.timings.duration.toFixed(2)}ms`);
      }
      
      // Check for server errors
      if (response.status >= 500) {
        serverErrorCounter.add(1);
        console.warn(`🔥 Server Error: ${endpoint} returned ${response.status}`);
      }
      
      // Log extreme response times
      if (response.timings.duration > 5000) {
        console.warn(`🐌 Slow response: ${endpoint} took ${response.timings.duration.toFixed(2)}ms (Stress Level: ${testData.stressLevel})`);
      }
      
      break; // Success, exit retry loop
      
    } catch (error) {
      retries++;
      console.error(`❌ Request failed (attempt ${retries}/${MAX_RETRIES + 1}): ${endpoint} - ${error.message}`);
      
      if (retries <= MAX_RETRIES) {
        sleep(RETRY_DELAY * retries); // Exponential backoff
      } else {
        // Final failure
        response = { 
          status: 0, 
          timings: { duration: 0 }, 
          body: '', 
          error: error.message 
        };
        errorRate.add(1);
      }
    }
  }
  
  return response;
}

function validateStressResponse(response, requestType, checks, testData) {
  const result = check(response, checks, { 
    request_type: requestType,
    stress_level: testData.stressLevel.toString(),
    stage: testData.stageTag,
  });
  
  if (!result) {
    errorRate.add(1);
  }
  
  // Additional stress-specific validations
  if (response.status === 429) {
    console.log(`🚦 Rate limited: ${requestType} (expected under stress)`);
  } else if (response.status === 503) {
    console.log(`🚫 Service unavailable: ${requestType} (system overloaded)`);
  } else if (response.status === 0) {
    console.error(`💥 Connection failed: ${requestType} (system breakdown)`);
  }
  
  return result;
}

// Setup function
export function setup() {
  console.log('🚀 Starting k6 Stress Test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`🔄 Max Retries: ${MAX_RETRIES}`);
  console.log(`⏱️  Retry Delay: ${RETRY_DELAY}s`);
  console.log(`🎯 Stress Patterns: ${STRESS_PATTERNS.join(', ')}`);
  
  // Verify target is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    console.warn(`⚠️  Target ${BASE_URL} returned status ${response.status}, but continuing with stress test...`);
  } else {
    console.log('✅ Target is accessible, starting stress test...');
  }
  
  return { 
    startTime: new Date().toISOString(),
    targetUrl: BASE_URL,
    maxRetries: MAX_RETRIES,
  };
}

// Teardown function
export function teardown(data) {
  console.log('✅ k6 Stress Test completed');
  console.log(`🕐 Started at: ${data.startTime}`);
  console.log(`🕐 Ended at: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${data.targetUrl}`);
  console.log('🔄 Allowing system recovery time...');
  
  // Give the system time to recover
  sleep(10);
}

// Custom summary report
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/stress-test-summary.json': JSON.stringify(data, null, 2),
    'reports/stress-test-report.html': htmlReport(data),
  };
  
  // Calculate stress test specific metrics
  const totalRequests = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const totalErrors = data.metrics.errors ? data.metrics.errors.values.count : 0;
  const totalTimeouts = data.metrics.timeouts ? data.metrics.timeouts.values.count : 0;
  const totalServerErrors = data.metrics.server_errors ? data.metrics.server_errors.values.count : 0;
  const avgResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0;
  const p95ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  const p99ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0;
  const maxResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max : 0;
  
  console.log('\n🔥 Stress Test Summary:');
  console.log(`📈 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors} (${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%)`);
  console.log(`⏰ Timeouts: ${totalTimeouts}`);
  console.log(`🔥 Server Errors: ${totalServerErrors}`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`🎯 95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`🎯 99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(`🚀 Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
  
  // System resilience assessment
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) : 0;
  const timeoutRate = totalRequests > 0 ? (totalTimeouts / totalRequests) : 0;
  
  console.log('\n🏥 System Resilience Assessment:');
  
  if (errorRate < 0.1 && timeoutRate < 0.05 && p95ResponseTime < 2000) {
    console.log('✅ EXCELLENT: System handled stress very well');
  } else if (errorRate < 0.3 && timeoutRate < 0.1 && p95ResponseTime < 5000) {
    console.log('⚠️  GOOD: System handled stress with some degradation');
  } else if (errorRate < 0.5 && timeoutRate < 0.2) {
    console.log('🔶 FAIR: System struggled under stress but remained functional');
  } else {
    console.log('❌ POOR: System failed to handle stress effectively');
  }
  
  // Breaking point analysis
  if (totalServerErrors > 0 || timeoutRate > 0.3) {
    console.log('💥 Breaking point reached - system showed signs of failure');
  } else if (errorRate > 0.2) {
    console.log('⚠️  Stress threshold reached - system degraded significantly');
  } else {
    console.log('💪 System remained stable throughout stress test');
  }
  
  return summary;
}