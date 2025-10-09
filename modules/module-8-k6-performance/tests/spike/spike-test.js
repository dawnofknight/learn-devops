import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for spike testing
export let errorRate = new Rate('errors');
export let responseTimeTrend = new Trend('response_time_custom');
export let requestCounter = new Counter('requests_total');
export let activeUsers = new Gauge('active_users');
export let spikeIntensity = new Gauge('spike_intensity');
export let recoveryTime = new Trend('recovery_time');
export let spikeFailures = new Counter('spike_failures');
export let autoScalingEvents = new Counter('autoscaling_events');

export let options = {
  stages: [
    // Baseline - Normal load
    { duration: '5m', target: 20 },   // Normal baseline load
    
    // Spike 1 - Moderate spike
    { duration: '30s', target: 200 }, // Sudden spike to 10x load
    { duration: '2m', target: 200 },  // Hold spike
    { duration: '2m', target: 20 },   // Recovery to baseline
    { duration: '3m', target: 20 },   // Recovery period
    
    // Spike 2 - High spike
    { duration: '30s', target: 500 }, // Sudden spike to 25x load
    { duration: '2m', target: 500 },  // Hold spike
    { duration: '3m', target: 20 },   // Recovery to baseline
    { duration: '3m', target: 20 },   // Recovery period
    
    // Spike 3 - Extreme spike
    { duration: '15s', target: 1000 }, // Sudden extreme spike to 50x load
    { duration: '1m', target: 1000 },  // Hold extreme spike
    { duration: '5m', target: 20 },    // Extended recovery
    { duration: '5m', target: 20 },    // Recovery verification
    
    // Double spike - Two consecutive spikes
    { duration: '30s', target: 300 },  // First spike
    { duration: '1m', target: 300 },   // Hold first spike
    { duration: '30s', target: 600 },  // Second spike (double)
    { duration: '1m', target: 600 },   // Hold second spike
    { duration: '5m', target: 20 },    // Final recovery
    
    // Cleanup
    { duration: '2m', target: 0 },     // Ramp down to zero
  ],
  
  thresholds: {
    // Spike-specific thresholds
    http_req_duration: ['p(95)<3000', 'p(99)<8000'], // Allow higher response times during spikes
    http_req_failed: ['rate<0.2'], // Allow up to 20% failure rate during spikes
    errors: ['rate<0.25'], // Allow up to 25% error rate
    spike_failures: ['count<100'], // Limit spike-related failures
    
    // Per-stage thresholds
    'http_req_duration{stage:baseline}': ['p(95)<1000'],
    'http_req_duration{stage:moderate_spike}': ['p(95)<2000'],
    'http_req_duration{stage:high_spike}': ['p(95)<4000'],
    'http_req_duration{stage:extreme_spike}': ['p(95)<8000'],
    'http_req_duration{stage:double_spike}': ['p(95)<6000'],
    'http_req_duration{stage:recovery}': ['p(95)<1500'],
    
    // Recovery thresholds
    'recovery_time': ['p(95)<30000'], // Recovery should happen within 30 seconds
  },
  
  // Test metadata
  tags: {
    test_type: 'spike',
    environment: 'development',
    duration: '42m',
  },
  
  // Extended timeout for spike conditions
  timeout: '60s',
};

// Test configuration
const BASE_URL = __ENV.TARGET || 'http://localhost:3000';
const SPIKE_THRESHOLD = parseInt(__ENV.SPIKE_THRESHOLD) || 100;
const RECOVERY_THRESHOLD = parseInt(__ENV.RECOVERY_THRESHOLD) || 50;

// Spike test scenarios
const SPIKE_SCENARIOS = [
  'normal_user',      // 40% - Normal user behavior
  'spike_generator',  // 30% - Aggressive spike behavior
  'recovery_tester',  // 20% - Tests recovery capabilities
  'chaos_injector',   // 10% - Injects chaos during spikes
];

export default function () {
  // Determine current spike phase and intensity
  const currentVUs = __VU;
  let spikePhase, intensity, stageTag;
  
  if (currentVUs <= 50) {
    spikePhase = 'baseline';
    intensity = 1;
    stageTag = 'baseline';
  } else if (currentVUs <= 200) {
    spikePhase = 'moderate_spike';
    intensity = 2;
    stageTag = 'moderate_spike';
  } else if (currentVUs <= 500) {
    spikePhase = 'high_spike';
    intensity = 3;
    stageTag = 'high_spike';
  } else if (currentVUs <= 1000) {
    spikePhase = 'extreme_spike';
    intensity = 5;
    stageTag = 'extreme_spike';
  } else {
    spikePhase = 'double_spike';
    intensity = 4;
    stageTag = 'double_spike';
  }
  
  // Check if we're in recovery phase
  if (__ITER > 0 && currentVUs < RECOVERY_THRESHOLD) {
    spikePhase = 'recovery';
    intensity = 1;
    stageTag = 'recovery';
  }
  
  spikeIntensity.add(intensity);
  activeUsers.add(currentVUs);
  
  // Select spike scenario
  const scenarioIndex = __VU % SPIKE_SCENARIOS.length;
  const spikeScenario = SPIKE_SCENARIOS[scenarioIndex];
  
  // Test data
  const testData = {
    userId: Math.floor(Math.random() * 100000) + 1,
    sessionId: `spike_session_${__VU}_${__ITER}`,
    spikeScenario: spikeScenario,
    spikePhase: spikePhase,
    intensity: intensity,
    stageTag: stageTag,
    startTime: new Date().getTime(),
  };

  // Execute spike scenario
  try {
    switch (spikeScenario) {
      case 'normal_user':
        normalUserScenario(testData);
        break;
      case 'spike_generator':
        spikeGeneratorScenario(testData);
        break;
      case 'recovery_tester':
        recoveryTesterScenario(testData);
        break;
      case 'chaos_injector':
        chaosInjectorScenario(testData);
        break;
    }
  } catch (error) {
    console.error(`❌ Spike scenario ${spikeScenario} failed: ${error.message}`);
    errorRate.add(1);
    spikeFailures.add(1);
  }
}

function normalUserScenario(testData) {
  // Normal user behavior that should work even during spikes
  const response = makeSpikeRequest('GET', '/api/quotes', 'normal_user', testData);
  
  validateSpikeResponse(response, 'normal_user', {
    'normal user request completed': (r) => r.status !== 0,
    'normal user got valid response': (r) => r.status === 200 || r.status === 429 || r.status === 503,
    'normal user response time reasonable': (r) => r.timings.duration < 10000,
  }, testData);
  
  // Normal think time
  sleep(Math.random() * 3 + 1);
  
  // Health check during spike
  const healthResponse = makeSpikeRequest('GET', '/api/health', 'health_check', testData);
  validateSpikeResponse(healthResponse, 'health_check', {
    'health check responded': (r) => r.status !== 0,
  }, testData);
  
  sleep(Math.random() * 2);
}

function spikeGeneratorScenario(testData) {
  // Aggressive behavior that generates spike load
  const requestCount = Math.min(testData.intensity * 3, 15);
  const recoveryStartTime = new Date().getTime();
  
  for (let i = 0; i < requestCount; i++) {
    const endpoints = [
      '/api/quotes',
      '/api/quotes/random',
      '/api/quotes?limit=100',
      '/api/quotes/search?q=spike',
    ];
    
    const endpoint = endpoints[i % endpoints.length];
    const response = makeSpikeRequest('GET', endpoint, 'spike_generator', testData);
    
    validateSpikeResponse(response, 'spike_generator', {
      'spike request attempted': (r) => r.status !== 0 || r.error,
      'spike request handled': (r) => r.status === 200 || r.status === 429 || r.status === 503 || r.status === 0,
    }, testData);
    
    // Check for auto-scaling indicators
    if (response.headers && response.headers['X-Auto-Scale']) {
      autoScalingEvents.add(1);
      console.log(`🔄 Auto-scaling detected: ${response.headers['X-Auto-Scale']}`);
    }
    
    // Minimal think time during spike generation
    sleep(0.1);
  }
  
  // Measure recovery time if we're transitioning out of spike
  if (testData.spikePhase === 'recovery') {
    const recoveryDuration = new Date().getTime() - recoveryStartTime;
    recoveryTime.add(recoveryDuration);
  }
  
  sleep(Math.random() * 1);
}

function recoveryTesterScenario(testData) {
  // Tests system recovery capabilities after spikes
  if (testData.spikePhase === 'recovery') {
    // Test if system is recovering properly
    const recoveryStartTime = new Date().getTime();
    
    // Make a series of requests to test recovery
    for (let i = 0; i < 3; i++) {
      const response = makeSpikeRequest('GET', '/api/quotes', 'recovery_test', testData);
      
      validateSpikeResponse(response, 'recovery_test', {
        'recovery request completed': (r) => r.status !== 0,
        'recovery response time improving': (r) => r.timings.duration < 5000,
        'recovery no server errors': (r) => r.status < 500 || r.status === 503,
      }, testData);
      
      sleep(1); // Give system time to recover between requests
    }
    
    const recoveryDuration = new Date().getTime() - recoveryStartTime;
    recoveryTime.add(recoveryDuration);
    
    console.log(`🏥 Recovery test completed in ${recoveryDuration}ms (Phase: ${testData.spikePhase})`);
  } else {
    // During spike, test critical functionality
    const response = makeSpikeRequest('GET', '/api/health', 'critical_function', testData);
    validateSpikeResponse(response, 'critical_function', {
      'critical function available': (r) => r.status === 200 || r.status === 503,
    }, testData);
  }
  
  sleep(Math.random() * 4 + 2);
}

function chaosInjectorScenario(testData) {
  // Injects additional chaos during spikes
  const chaosActions = [
    () => {
      // Concurrent burst
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(makeSpikeRequest('GET', '/api/quotes/random', 'chaos_burst', testData));
      }
      // Note: k6 doesn't support Promise.all, so we simulate concurrent requests
      for (let i = 0; i < 5; i++) {
        makeSpikeRequest('GET', '/api/quotes/random', 'chaos_burst', testData);
      }
    },
    () => {
      // Large payload during spike
      const largePayload = JSON.stringify({
        data: 'x'.repeat(Math.min(testData.intensity * 500, 5000)),
        spike: true,
        chaos: true,
      });
      makeSpikeRequest('POST', '/api/quotes', 'chaos_large_payload', testData, {}, largePayload);
    },
    () => {
      // Invalid requests during spike
      makeSpikeRequest('GET', '/api/invalid/endpoint', 'chaos_invalid', testData);
      makeSpikeRequest('DELETE', '/api/quotes/999999', 'chaos_delete', testData);
    },
    () => {
      // Connection chaos
      makeSpikeRequest('GET', '/api/quotes', 'chaos_connection', testData, {
        'Connection': 'close',
        'X-Chaos-Test': 'connection-chaos',
      });
    },
  ];
  
  // Execute chaos actions based on spike intensity
  const actionCount = Math.min(testData.intensity, 3);
  for (let i = 0; i < actionCount; i++) {
    const action = chaosActions[Math.floor(Math.random() * chaosActions.length)];
    try {
      action();
    } catch (error) {
      console.warn(`⚠️  Chaos action failed: ${error.message}`);
      spikeFailures.add(1);
    }
    sleep(Math.random() * 1);
  }
  
  sleep(Math.random() * 3);
}

function makeSpikeRequest(method, endpoint, requestType, testData, extraHeaders = {}, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'User-Agent': `k6-spike-test/1.0 (${testData.spikeScenario})`,
    'Accept': 'application/json',
    'X-Session-ID': testData.sessionId,
    'X-User-ID': testData.userId.toString(),
    'X-Spike-Phase': testData.spikePhase,
    'X-Spike-Intensity': testData.intensity.toString(),
    'X-Request-Type': requestType,
    'X-Request-ID': `spike_${__VU}_${__ITER}_${Date.now()}`,
    'X-Spike-Test': 'true',
    ...extraHeaders,
  };
  
  const params = {
    headers: headers,
    tags: { 
      endpoint: requestType,
      spike_scenario: testData.spikeScenario,
      spike_phase: testData.spikePhase,
      spike_intensity: testData.intensity.toString(),
      stage: testData.stageTag,
    },
    timeout: testData.spikePhase === 'extreme_spike' ? '30s' : '15s',
  };
  
  let response;
  const startTime = new Date().getTime();
  
  try {
    if (method === 'GET') {
      response = http.get(url, params);
    } else if (method === 'POST') {
      response = http.post(url, body, params);
    } else if (method === 'DELETE') {
      response = http.del(url, null, params);
    }
    
    // Record metrics
    requestCounter.add(1);
    responseTimeTrend.add(response.timings.duration);
    
    // Log spike-specific events
    if (testData.spikePhase.includes('spike') && response.timings.duration > 2000) {
      console.warn(`🌊 Spike impact: ${endpoint} took ${response.timings.duration.toFixed(2)}ms (Phase: ${testData.spikePhase})`);
    }
    
    // Check for rate limiting during spikes
    if (response.status === 429) {
      console.log(`🚦 Rate limited during ${testData.spikePhase}: ${endpoint}`);
    }
    
    // Check for service unavailable during spikes
    if (response.status === 503) {
      console.log(`🚫 Service unavailable during ${testData.spikePhase}: ${endpoint}`);
    }
    
    // Check for circuit breaker activation
    if (response.headers && response.headers['X-Circuit-Breaker']) {
      console.log(`⚡ Circuit breaker activated: ${response.headers['X-Circuit-Breaker']}`);
    }
    
  } catch (error) {
    console.error(`❌ Spike request failed: ${endpoint} - ${error.message} (Phase: ${testData.spikePhase})`);
    response = { 
      status: 0, 
      timings: { duration: new Date().getTime() - startTime }, 
      body: '', 
      error: error.message 
    };
    errorRate.add(1);
    spikeFailures.add(1);
  }
  
  return response;
}

function validateSpikeResponse(response, requestType, checks, testData) {
  const result = check(response, checks, { 
    request_type: requestType,
    spike_phase: testData.spikePhase,
    spike_intensity: testData.intensity.toString(),
    stage: testData.stageTag,
  });
  
  if (!result) {
    errorRate.add(1);
  }
  
  // Spike-specific validations
  if (testData.spikePhase.includes('spike')) {
    if (response.status === 200) {
      console.log(`✅ System handled spike request: ${requestType} (${testData.spikePhase})`);
    } else if (response.status === 429 || response.status === 503) {
      console.log(`⚠️  System protected itself: ${requestType} returned ${response.status} (${testData.spikePhase})`);
    } else if (response.status === 0) {
      console.error(`💥 System failed during spike: ${requestType} (${testData.spikePhase})`);
      spikeFailures.add(1);
    }
  }
  
  return result;
}

// Setup function
export function setup() {
  console.log('🌊 Starting k6 Spike Test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`⚡ Spike Threshold: ${SPIKE_THRESHOLD} VUs`);
  console.log(`🏥 Recovery Threshold: ${RECOVERY_THRESHOLD} VUs`);
  console.log(`🎯 Spike Scenarios: ${SPIKE_SCENARIOS.join(', ')}`);
  
  // Verify target is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    console.warn(`⚠️  Target ${BASE_URL} returned status ${response.status}, but continuing with spike test...`);
  } else {
    console.log('✅ Target is accessible, starting spike test...');
  }
  
  return { 
    startTime: new Date().toISOString(),
    targetUrl: BASE_URL,
    spikeThreshold: SPIKE_THRESHOLD,
    recoveryThreshold: RECOVERY_THRESHOLD,
  };
}

// Teardown function
export function teardown(data) {
  console.log('✅ k6 Spike Test completed');
  console.log(`🕐 Started at: ${data.startTime}`);
  console.log(`🕐 Ended at: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${data.targetUrl}`);
  console.log('🏥 Allowing system recovery time...');
  
  // Give the system time to fully recover
  sleep(15);
}

// Custom summary report
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/spike-test-summary.json': JSON.stringify(data, null, 2),
    'reports/spike-test-report.html': htmlReport(data),
  };
  
  // Calculate spike test specific metrics
  const totalRequests = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const totalErrors = data.metrics.errors ? data.metrics.errors.values.count : 0;
  const spikeFailuresCount = data.metrics.spike_failures ? data.metrics.spike_failures.values.count : 0;
  const autoScalingCount = data.metrics.autoscaling_events ? data.metrics.autoscaling_events.values.count : 0;
  const avgResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0;
  const p95ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  const p99ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0;
  const maxResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max : 0;
  const avgRecoveryTime = data.metrics.recovery_time ? data.metrics.recovery_time.values.avg : 0;
  const p95RecoveryTime = data.metrics.recovery_time ? data.metrics.recovery_time.values['p(95)'] : 0;
  
  console.log('\n🌊 Spike Test Summary:');
  console.log(`📈 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors} (${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%)`);
  console.log(`💥 Spike Failures: ${spikeFailuresCount}`);
  console.log(`🔄 Auto-scaling Events: ${autoScalingCount}`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`🎯 95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`🎯 99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(`🚀 Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
  console.log(`🏥 Avg Recovery Time: ${avgRecoveryTime.toFixed(2)}ms`);
  console.log(`🏥 95th Percentile Recovery: ${p95RecoveryTime.toFixed(2)}ms`);
  
  // Spike resilience assessment
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) : 0;
  const spikeFailureRate = totalRequests > 0 ? (spikeFailuresCount / totalRequests) : 0;
  
  console.log('\n🌊 Spike Resilience Assessment:');
  
  if (errorRate < 0.1 && spikeFailureRate < 0.05 && p95ResponseTime < 3000 && avgRecoveryTime < 10000) {
    console.log('✅ EXCELLENT: System handled spikes exceptionally well');
  } else if (errorRate < 0.2 && spikeFailureRate < 0.1 && p95ResponseTime < 5000 && avgRecoveryTime < 20000) {
    console.log('⚠️  GOOD: System handled spikes with acceptable degradation');
  } else if (errorRate < 0.4 && spikeFailureRate < 0.2 && avgRecoveryTime < 30000) {
    console.log('🔶 FAIR: System struggled with spikes but recovered');
  } else {
    console.log('❌ POOR: System failed to handle spikes effectively');
  }
  
  // Auto-scaling assessment
  if (autoScalingCount > 0) {
    console.log(`🔄 Auto-scaling detected: ${autoScalingCount} events - system adapted to load`);
  } else {
    console.log('📊 No auto-scaling detected - system handled spikes with fixed resources');
  }
  
  // Recovery assessment
  if (avgRecoveryTime > 0) {
    if (avgRecoveryTime < 5000) {
      console.log('🏥 FAST recovery: System recovered quickly from spikes');
    } else if (avgRecoveryTime < 15000) {
      console.log('🏥 MODERATE recovery: System took reasonable time to recover');
    } else {
      console.log('🏥 SLOW recovery: System took significant time to recover');
    }
  }
  
  return summary;
}