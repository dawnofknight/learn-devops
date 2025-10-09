import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for DDoS simulation
export let errorRate = new Rate('errors');
export let responseTimeTrend = new Trend('response_time_custom');
export let requestCounter = new Counter('requests_total');
export let activeAttackers = new Gauge('active_attackers');
export let attackIntensity = new Gauge('attack_intensity');
export let blockedRequests = new Counter('blocked_requests');
export let rateLimitHits = new Counter('rate_limit_hits');
export let circuitBreakerTrips = new Counter('circuit_breaker_trips');
export let ddosFailures = new Counter('ddos_failures');
export let legitimateRequests = new Counter('legitimate_requests');
export let maliciousRequests = new Counter('malicious_requests');

export let options = {
  stages: [
    // Phase 1: Reconnaissance - Low intensity probing
    { duration: '2m', target: 50 },    // Reconnaissance phase
    { duration: '1m', target: 50 },    // Maintain reconnaissance
    
    // Phase 2: Initial Attack - Moderate DDoS
    { duration: '1m', target: 200 },   // Ramp up attack
    { duration: '3m', target: 200 },   // Sustained moderate attack
    
    // Phase 3: Escalation - High intensity DDoS
    { duration: '1m', target: 500 },   // Escalate attack
    { duration: '5m', target: 500 },   // Sustained high attack
    
    // Phase 4: Peak Attack - Maximum intensity
    { duration: '30s', target: 1000 }, // Peak attack intensity
    { duration: '3m', target: 1000 },  // Sustained peak attack
    
    // Phase 5: Distributed Attack - Multiple vectors
    { duration: '1m', target: 1500 },  // Multi-vector attack
    { duration: '4m', target: 1500 },  // Sustained multi-vector
    
    // Phase 6: Persistence - Prolonged attack
    { duration: '2m', target: 800 },   // Reduce but maintain attack
    { duration: '8m', target: 800 },   // Prolonged persistence
    
    // Phase 7: Final Assault - Last attempt
    { duration: '30s', target: 2000 }, // Final assault
    { duration: '2m', target: 2000 },  // Brief final assault
    
    // Phase 8: Retreat - Attack subsides
    { duration: '2m', target: 100 },   // Attack subsides
    { duration: '3m', target: 100 },   // Monitoring phase
    { duration: '2m', target: 0 },     // Complete retreat
  ],
  
  thresholds: {
    // DDoS-specific thresholds (more lenient as we expect degradation)
    http_req_duration: ['p(95)<10000', 'p(99)<30000'], // Very high response times expected
    http_req_failed: ['rate<0.8'], // Allow up to 80% failure rate during peak attack
    errors: ['rate<0.9'], // Allow up to 90% error rate
    blocked_requests: ['count>100'], // Expect many blocked requests
    rate_limit_hits: ['count>50'], // Expect rate limiting
    ddos_failures: ['count<5000'], // Limit total DDoS failures
    
    // Per-phase thresholds
    'http_req_duration{phase:reconnaissance}': ['p(95)<2000'],
    'http_req_duration{phase:initial_attack}': ['p(95)<5000'],
    'http_req_duration{phase:escalation}': ['p(95)<8000'],
    'http_req_duration{phase:peak_attack}': ['p(95)<15000'],
    'http_req_duration{phase:distributed_attack}': ['p(95)<20000'],
    'http_req_duration{phase:persistence}': ['p(95)<12000'],
    'http_req_duration{phase:final_assault}': ['p(95)<25000'],
    'http_req_duration{phase:retreat}': ['p(95)<5000'],
  },
  
  // Test metadata
  tags: {
    test_type: 'ddos_simulation',
    environment: 'development',
    duration: '40m',
    warning: 'SIMULATION_ONLY',
  },
  
  // Extended timeout for DDoS conditions
  timeout: '120s',
};

// Test configuration
const BASE_URL = __ENV.TARGET || 'http://localhost:3000';
const ATTACK_PATTERNS = [
  'volumetric',      // 25% - High volume requests
  'protocol',        // 25% - Protocol-based attacks
  'application',     // 25% - Application layer attacks
  'legitimate',      // 25% - Legitimate traffic mixed in
];

// DDoS attack vectors
const ATTACK_VECTORS = {
  volumetric: [
    'flood_get',
    'flood_post',
    'large_payload',
    'rapid_fire',
  ],
  protocol: [
    'slowloris',
    'connection_exhaustion',
    'malformed_requests',
    'header_manipulation',
  ],
  application: [
    'resource_exhaustion',
    'database_overload',
    'cache_poisoning',
    'search_abuse',
  ],
  legitimate: [
    'normal_browsing',
    'api_usage',
    'health_checks',
    'monitoring',
  ],
};

export default function () {
  // Determine current attack phase and intensity
  const currentVUs = __VU;
  let attackPhase, intensity, phaseTag;
  
  if (currentVUs <= 50) {
    attackPhase = 'reconnaissance';
    intensity = 1;
    phaseTag = 'reconnaissance';
  } else if (currentVUs <= 200) {
    attackPhase = 'initial_attack';
    intensity = 2;
    phaseTag = 'initial_attack';
  } else if (currentVUs <= 500) {
    attackPhase = 'escalation';
    intensity = 3;
    phaseTag = 'escalation';
  } else if (currentVUs <= 1000) {
    attackPhase = 'peak_attack';
    intensity = 5;
    phaseTag = 'peak_attack';
  } else if (currentVUs <= 1500) {
    attackPhase = 'distributed_attack';
    intensity = 6;
    phaseTag = 'distributed_attack';
  } else if (currentVUs <= 800) {
    attackPhase = 'persistence';
    intensity = 4;
    phaseTag = 'persistence';
  } else if (currentVUs <= 2000) {
    attackPhase = 'final_assault';
    intensity = 7;
    phaseTag = 'final_assault';
  } else {
    attackPhase = 'retreat';
    intensity = 1;
    phaseTag = 'retreat';
  }
  
  attackIntensity.add(intensity);
  activeAttackers.add(currentVUs);
  
  // Select attack pattern
  const patternIndex = __VU % ATTACK_PATTERNS.length;
  const attackPattern = ATTACK_PATTERNS[patternIndex];
  
  // Test data
  const testData = {
    attackerId: Math.floor(Math.random() * 1000000) + 1,
    sessionId: `ddos_session_${__VU}_${__ITER}`,
    attackPattern: attackPattern,
    attackPhase: attackPhase,
    intensity: intensity,
    phaseTag: phaseTag,
    startTime: new Date().getTime(),
    userAgent: generateMaliciousUserAgent(),
    sourceIP: generateFakeIP(),
  };

  // Execute attack pattern
  try {
    switch (attackPattern) {
      case 'volumetric':
        volumetricAttack(testData);
        break;
      case 'protocol':
        protocolAttack(testData);
        break;
      case 'application':
        applicationAttack(testData);
        break;
      case 'legitimate':
        legitimateTraffic(testData);
        break;
    }
  } catch (error) {
    console.error(`❌ DDoS attack ${attackPattern} failed: ${error.message}`);
    errorRate.add(1);
    ddosFailures.add(1);
  }
}

function volumetricAttack(testData) {
  // High volume attacks to overwhelm bandwidth/resources
  const vectors = ATTACK_VECTORS.volumetric;
  const vector = vectors[Math.floor(Math.random() * vectors.length)];
  
  maliciousRequests.add(1);
  
  switch (vector) {
    case 'flood_get':
      floodGetAttack(testData);
      break;
    case 'flood_post':
      floodPostAttack(testData);
      break;
    case 'large_payload':
      largePayloadAttack(testData);
      break;
    case 'rapid_fire':
      rapidFireAttack(testData);
      break;
  }
}

function floodGetAttack(testData) {
  // Flood with GET requests
  const requestCount = Math.min(testData.intensity * 5, 25);
  
  for (let i = 0; i < requestCount; i++) {
    const endpoints = [
      '/api/quotes',
      '/api/quotes/random',
      '/api/quotes?limit=1000',
      '/api/quotes/search?q=' + 'x'.repeat(100),
      '/api/health',
      '/',
    ];
    
    const endpoint = endpoints[i % endpoints.length];
    const response = makeDDoSRequest('GET', endpoint, 'flood_get', testData);
    
    validateDDoSResponse(response, 'flood_get', {
      'flood request attempted': (r) => r.status !== undefined,
      'system responded or blocked': (r) => r.status !== 0 || r.error,
    }, testData);
    
    // No sleep - flood as fast as possible
  }
}

function floodPostAttack(testData) {
  // Flood with POST requests
  const requestCount = Math.min(testData.intensity * 3, 15);
  
  for (let i = 0; i < requestCount; i++) {
    const payload = JSON.stringify({
      attack: 'ddos_simulation',
      data: 'x'.repeat(Math.min(testData.intensity * 100, 1000)),
      timestamp: Date.now(),
    });
    
    const response = makeDDoSRequest('POST', '/api/quotes', 'flood_post', testData, {}, payload);
    
    validateDDoSResponse(response, 'flood_post', {
      'post flood attempted': (r) => r.status !== undefined,
      'system handled or blocked': (r) => r.status !== 0 || r.error,
    }, testData);
  }
}

function largePayloadAttack(testData) {
  // Send extremely large payloads
  const payloadSize = Math.min(testData.intensity * 10000, 100000);
  const largePayload = JSON.stringify({
    attack: 'large_payload',
    data: 'x'.repeat(payloadSize),
    metadata: {
      size: payloadSize,
      intensity: testData.intensity,
      phase: testData.attackPhase,
    },
  });
  
  const response = makeDDoSRequest('POST', '/api/quotes', 'large_payload', testData, {
    'Content-Type': 'application/json',
    'Content-Length': largePayload.length.toString(),
  }, largePayload);
  
  validateDDoSResponse(response, 'large_payload', {
    'large payload attempted': (r) => r.status !== undefined,
    'payload rejected or processed': (r) => r.status === 413 || r.status === 400 || r.status === 200 || r.status === 0,
  }, testData);
}

function rapidFireAttack(testData) {
  // Rapid consecutive requests with no delay
  const burstCount = Math.min(testData.intensity * 10, 50);
  
  for (let i = 0; i < burstCount; i++) {
    const response = makeDDoSRequest('GET', '/api/quotes/random', 'rapid_fire', testData);
    validateDDoSResponse(response, 'rapid_fire', {
      'rapid fire attempted': (r) => r.status !== undefined,
    }, testData);
    // Absolutely no delay
  }
}

function protocolAttack(testData) {
  // Protocol-level attacks
  const vectors = ATTACK_VECTORS.protocol;
  const vector = vectors[Math.floor(Math.random() * vectors.length)];
  
  maliciousRequests.add(1);
  
  switch (vector) {
    case 'slowloris':
      slowlorisAttack(testData);
      break;
    case 'connection_exhaustion':
      connectionExhaustionAttack(testData);
      break;
    case 'malformed_requests':
      malformedRequestsAttack(testData);
      break;
    case 'header_manipulation':
      headerManipulationAttack(testData);
      break;
  }
}

function slowlorisAttack(testData) {
  // Simulate slowloris by holding connections
  const response = makeDDoSRequest('GET', '/api/quotes', 'slowloris', testData, {
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=300, max=1000',
    'X-Slowloris': 'true',
  });
  
  validateDDoSResponse(response, 'slowloris', {
    'slowloris connection attempted': (r) => r.status !== undefined,
  }, testData);
  
  // Hold the connection for a long time
  sleep(Math.min(testData.intensity * 10, 60));
}

function connectionExhaustionAttack(testData) {
  // Try to exhaust connection pools
  const connectionCount = Math.min(testData.intensity * 2, 10);
  
  for (let i = 0; i < connectionCount; i++) {
    const response = makeDDoSRequest('GET', '/api/health', 'connection_exhaustion', testData, {
      'Connection': 'keep-alive',
      'X-Connection-ID': `exhaust_${i}`,
    });
    
    validateDDoSResponse(response, 'connection_exhaustion', {
      'connection exhaustion attempted': (r) => r.status !== undefined,
    }, testData);
    
    sleep(0.1); // Small delay between connections
  }
}

function malformedRequestsAttack(testData) {
  // Send malformed requests
  const malformedHeaders = {
    'Content-Length': '-1',
    'Transfer-Encoding': 'chunked\r\nContent-Length: 0',
    'Host': 'evil.com',
    'X-Forwarded-For': '127.0.0.1, 127.0.0.1, 127.0.0.1',
    'X-Malformed': '\r\n\r\nGET /evil HTTP/1.1\r\n',
  };
  
  const response = makeDDoSRequest('GET', '/api/quotes', 'malformed', testData, malformedHeaders);
  
  validateDDoSResponse(response, 'malformed', {
    'malformed request attempted': (r) => r.status !== undefined,
    'malformed request handled': (r) => r.status === 400 || r.status === 0 || r.status === 200,
  }, testData);
}

function headerManipulationAttack(testData) {
  // Manipulate headers to bypass security
  const manipulatedHeaders = {
    'X-Forwarded-For': generateFakeIP(),
    'X-Real-IP': generateFakeIP(),
    'X-Originating-IP': generateFakeIP(),
    'X-Remote-IP': generateFakeIP(),
    'X-Client-IP': generateFakeIP(),
    'CF-Connecting-IP': generateFakeIP(),
    'User-Agent': generateMaliciousUserAgent(),
    'Referer': 'https://evil.com/attack',
    'Origin': 'https://malicious.com',
  };
  
  const response = makeDDoSRequest('GET', '/api/quotes', 'header_manipulation', testData, manipulatedHeaders);
  
  validateDDoSResponse(response, 'header_manipulation', {
    'header manipulation attempted': (r) => r.status !== undefined,
  }, testData);
}

function applicationAttack(testData) {
  // Application-layer attacks
  const vectors = ATTACK_VECTORS.application;
  const vector = vectors[Math.floor(Math.random() * vectors.length)];
  
  maliciousRequests.add(1);
  
  switch (vector) {
    case 'resource_exhaustion':
      resourceExhaustionAttack(testData);
      break;
    case 'database_overload':
      databaseOverloadAttack(testData);
      break;
    case 'cache_poisoning':
      cachePoisoningAttack(testData);
      break;
    case 'search_abuse':
      searchAbuseAttack(testData);
      break;
  }
}

function resourceExhaustionAttack(testData) {
  // Try to exhaust server resources
  const resourceIntensiveEndpoints = [
    '/api/quotes?limit=10000&sort=complex',
    '/api/quotes/export?format=xml&detailed=true',
    '/api/analytics?range=all&detailed=true',
    '/api/quotes/search?q=' + 'complex query '.repeat(50),
  ];
  
  const endpoint = resourceIntensiveEndpoints[Math.floor(Math.random() * resourceIntensiveEndpoints.length)];
  const response = makeDDoSRequest('GET', endpoint, 'resource_exhaustion', testData);
  
  validateDDoSResponse(response, 'resource_exhaustion', {
    'resource exhaustion attempted': (r) => r.status !== undefined,
  }, testData);
}

function databaseOverloadAttack(testData) {
  // Overload database with complex queries
  const complexQueries = [
    '/api/quotes?search=' + 'x'.repeat(1000),
    '/api/quotes?filter=complex&sort=random&limit=1000',
    '/api/quotes/stats?detailed=true&range=all',
  ];
  
  const endpoint = complexQueries[Math.floor(Math.random() * complexQueries.length)];
  const response = makeDDoSRequest('GET', endpoint, 'database_overload', testData);
  
  validateDDoSResponse(response, 'database_overload', {
    'database overload attempted': (r) => r.status !== undefined,
  }, testData);
}

function cachePoisoningAttack(testData) {
  // Try to poison caches
  const response = makeDDoSRequest('GET', '/api/quotes', 'cache_poisoning', testData, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Cache-Poison': 'true',
  });
  
  validateDDoSResponse(response, 'cache_poisoning', {
    'cache poisoning attempted': (r) => r.status !== undefined,
  }, testData);
}

function searchAbuseAttack(testData) {
  // Abuse search functionality
  const abusiveSearches = [
    'a'.repeat(1000),
    '%' + 'x'.repeat(500),
    '.*.*.*.*.*',
    '\\' + 'n'.repeat(100),
    '<script>alert("xss")</script>',
  ];
  
  const searchTerm = abusiveSearches[Math.floor(Math.random() * abusiveSearches.length)];
  const response = makeDDoSRequest('GET', `/api/quotes/search?q=${encodeURIComponent(searchTerm)}`, 'search_abuse', testData);
  
  validateDDoSResponse(response, 'search_abuse', {
    'search abuse attempted': (r) => r.status !== undefined,
  }, testData);
}

function legitimateTraffic(testData) {
  // Simulate legitimate traffic mixed with attack
  const vectors = ATTACK_VECTORS.legitimate;
  const vector = vectors[Math.floor(Math.random() * vectors.length)];
  
  legitimateRequests.add(1);
  
  switch (vector) {
    case 'normal_browsing':
      normalBrowsingTraffic(testData);
      break;
    case 'api_usage':
      apiUsageTraffic(testData);
      break;
    case 'health_checks':
      healthCheckTraffic(testData);
      break;
    case 'monitoring':
      monitoringTraffic(testData);
      break;
  }
}

function normalBrowsingTraffic(testData) {
  // Normal user browsing behavior
  const response = makeDDoSRequest('GET', '/api/quotes', 'normal_browsing', testData, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Referer': 'https://example.com/',
  });
  
  validateDDoSResponse(response, 'normal_browsing', {
    'normal browsing completed': (r) => r.status === 200 || r.status === 429 || r.status === 503,
  }, testData);
  
  sleep(Math.random() * 5 + 2); // Normal think time
}

function apiUsageTraffic(testData) {
  // Legitimate API usage
  const response = makeDDoSRequest('GET', '/api/quotes/random', 'api_usage', testData, {
    'User-Agent': 'MyApp/1.0',
    'Accept': 'application/json',
    'Authorization': 'Bearer legitimate-token',
  });
  
  validateDDoSResponse(response, 'api_usage', {
    'api usage completed': (r) => r.status === 200 || r.status === 429 || r.status === 503,
  }, testData);
  
  sleep(Math.random() * 3 + 1);
}

function healthCheckTraffic(testData) {
  // Health check requests
  const response = makeDDoSRequest('GET', '/api/health', 'health_check', testData, {
    'User-Agent': 'HealthChecker/1.0',
  });
  
  validateDDoSResponse(response, 'health_check', {
    'health check completed': (r) => r.status === 200 || r.status === 503,
  }, testData);
  
  sleep(30); // Health checks are infrequent
}

function monitoringTraffic(testData) {
  // Monitoring system requests
  const response = makeDDoSRequest('GET', '/api/metrics', 'monitoring', testData, {
    'User-Agent': 'Prometheus/2.0',
    'Accept': 'text/plain',
  });
  
  validateDDoSResponse(response, 'monitoring', {
    'monitoring completed': (r) => r.status === 200 || r.status === 404 || r.status === 503,
  }, testData);
  
  sleep(15); // Monitoring is periodic
}

function makeDDoSRequest(method, endpoint, requestType, testData, extraHeaders = {}, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'User-Agent': testData.userAgent,
    'Accept': 'application/json',
    'X-Session-ID': testData.sessionId,
    'X-Attacker-ID': testData.attackerId.toString(),
    'X-Attack-Phase': testData.attackPhase,
    'X-Attack-Intensity': testData.intensity.toString(),
    'X-Request-Type': requestType,
    'X-Request-ID': `ddos_${__VU}_${__ITER}_${Date.now()}`,
    'X-Source-IP': testData.sourceIP,
    'X-DDoS-Simulation': 'true',
    ...extraHeaders,
  };
  
  const params = {
    headers: headers,
    tags: { 
      endpoint: requestType,
      attack_pattern: testData.attackPattern,
      attack_phase: testData.attackPhase,
      attack_intensity: testData.intensity.toString(),
      phase: testData.phaseTag,
    },
    timeout: '30s', // Shorter timeout for DDoS
  };
  
  let response;
  const startTime = new Date().getTime();
  
  try {
    if (method === 'GET') {
      response = http.get(url, params);
    } else if (method === 'POST') {
      response = http.post(url, body, params);
    }
    
    // Record metrics
    requestCounter.add(1);
    responseTimeTrend.add(response.timings.duration);
    
    // Check for defensive responses
    if (response.status === 429) {
      rateLimitHits.add(1);
      console.log(`🚦 Rate limited: ${requestType} (${testData.attackPhase})`);
    }
    
    if (response.status === 403) {
      blockedRequests.add(1);
      console.log(`🚫 Blocked: ${requestType} (${testData.attackPhase})`);
    }
    
    if (response.status === 503) {
      console.log(`🛡️  Service unavailable: ${requestType} (defensive measure)`);
    }
    
    // Check for circuit breaker
    if (response.headers && response.headers['X-Circuit-Breaker']) {
      circuitBreakerTrips.add(1);
      console.log(`⚡ Circuit breaker: ${response.headers['X-Circuit-Breaker']}`);
    }
    
  } catch (error) {
    console.error(`❌ DDoS request failed: ${endpoint} - ${error.message} (${testData.attackPhase})`);
    response = { 
      status: 0, 
      timings: { duration: new Date().getTime() - startTime }, 
      body: '', 
      error: error.message 
    };
    errorRate.add(1);
    ddosFailures.add(1);
  }
  
  return response;
}

function validateDDoSResponse(response, requestType, checks, testData) {
  const result = check(response, checks, { 
    request_type: requestType,
    attack_phase: testData.attackPhase,
    attack_pattern: testData.attackPattern,
    attack_intensity: testData.intensity.toString(),
    phase: testData.phaseTag,
  });
  
  if (!result) {
    errorRate.add(1);
  }
  
  return result;
}

function generateMaliciousUserAgent() {
  const maliciousAgents = [
    'DDoS-Bot/1.0',
    'AttackBot/2.0',
    'Mozilla/5.0 (compatible; EvilBot/1.0)',
    'curl/7.68.0',
    'python-requests/2.25.1',
    'Go-http-client/1.1',
    'Wget/1.20.3',
    '',
    'X'.repeat(1000),
  ];
  
  return maliciousAgents[Math.floor(Math.random() * maliciousAgents.length)];
}

function generateFakeIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Setup function
export function setup() {
  console.log('⚠️  🚨 Starting k6 DDoS Simulation 🚨 ⚠️');
  console.log('🔴 WARNING: This is a SIMULATION for testing purposes only!');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`🎯 Attack Patterns: ${ATTACK_PATTERNS.join(', ')}`);
  console.log('🛡️  Testing system resilience against DDoS attacks...');
  
  // Verify target is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    console.warn(`⚠️  Target ${BASE_URL} returned status ${response.status}, but continuing with DDoS simulation...`);
  } else {
    console.log('✅ Target is accessible, starting DDoS simulation...');
  }
  
  return { 
    startTime: new Date().toISOString(),
    targetUrl: BASE_URL,
    attackPatterns: ATTACK_PATTERNS,
  };
}

// Teardown function
export function teardown(data) {
  console.log('✅ k6 DDoS Simulation completed');
  console.log(`🕐 Started at: ${data.startTime}`);
  console.log(`🕐 Ended at: ${new Date().toISOString()}`);
  console.log(`🎯 Target: ${data.targetUrl}`);
  console.log('🛡️  Allowing system recovery time...');
  
  // Give the system time to fully recover
  sleep(30);
}

// Custom summary report
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reports/ddos-simulation-summary.json': JSON.stringify(data, null, 2),
    'reports/ddos-simulation-report.html': htmlReport(data),
  };
  
  // Calculate DDoS-specific metrics
  const totalRequests = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const totalErrors = data.metrics.errors ? data.metrics.errors.values.count : 0;
  const blockedCount = data.metrics.blocked_requests ? data.metrics.blocked_requests.values.count : 0;
  const rateLimitCount = data.metrics.rate_limit_hits ? data.metrics.rate_limit_hits.values.count : 0;
  const circuitBreakerCount = data.metrics.circuit_breaker_trips ? data.metrics.circuit_breaker_trips.values.count : 0;
  const ddosFailuresCount = data.metrics.ddos_failures ? data.metrics.ddos_failures.values.count : 0;
  const legitimateCount = data.metrics.legitimate_requests ? data.metrics.legitimate_requests.values.count : 0;
  const maliciousCount = data.metrics.malicious_requests ? data.metrics.malicious_requests.values.count : 0;
  const avgResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0;
  const p95ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  const p99ResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0;
  const maxResponseTime = data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max : 0;
  
  console.log('\n🚨 DDoS Simulation Summary:');
  console.log(`📈 Total Requests: ${totalRequests}`);
  console.log(`❌ Total Errors: ${totalErrors} (${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%)`);
  console.log(`🚫 Blocked Requests: ${blockedCount}`);
  console.log(`🚦 Rate Limit Hits: ${rateLimitCount}`);
  console.log(`⚡ Circuit Breaker Trips: ${circuitBreakerCount}`);
  console.log(`💥 DDoS Failures: ${ddosFailuresCount}`);
  console.log(`✅ Legitimate Requests: ${legitimateCount}`);
  console.log(`🔴 Malicious Requests: ${maliciousCount}`);
  console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`🎯 95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
  console.log(`🎯 99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);
  console.log(`🚀 Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
  
  // DDoS resilience assessment
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) : 0;
  const blockRate = totalRequests > 0 ? (blockedCount / totalRequests) : 0;
  const rateLimitRate = totalRequests > 0 ? (rateLimitCount / totalRequests) : 0;
  
  console.log('\n🛡️  DDoS Resilience Assessment:');
  
  if (blockRate > 0.3 || rateLimitRate > 0.2 || circuitBreakerCount > 0) {
    console.log('✅ EXCELLENT: System actively defended against DDoS attacks');
    console.log(`   - Blocked ${(blockRate * 100).toFixed(1)}% of requests`);
    console.log(`   - Rate limited ${(rateLimitRate * 100).toFixed(1)}% of requests`);
    console.log(`   - Circuit breaker activated ${circuitBreakerCount} times`);
  } else if (errorRate > 0.5 && p95ResponseTime > 5000) {
    console.log('⚠️  GOOD: System degraded under attack but remained partially functional');
  } else if (errorRate < 0.3 && p95ResponseTime < 3000) {
    console.log('🔶 CONCERNING: System may not have adequate DDoS protection');
    console.log('   - Consider implementing rate limiting, IP blocking, or circuit breakers');
  } else {
    console.log('❌ POOR: System failed to handle DDoS attack effectively');
  }
  
  // Defense mechanism analysis
  console.log('\n🛡️  Defense Mechanisms Observed:');
  if (blockedCount > 0) {
    console.log(`✅ IP/Request Blocking: ${blockedCount} requests blocked`);
  }
  if (rateLimitCount > 0) {
    console.log(`✅ Rate Limiting: ${rateLimitCount} requests rate limited`);
  }
  if (circuitBreakerCount > 0) {
    console.log(`✅ Circuit Breaker: ${circuitBreakerCount} activations`);
  }
  if (blockedCount === 0 && rateLimitCount === 0 && circuitBreakerCount === 0) {
    console.log('⚠️  No active defense mechanisms detected');
    console.log('   - Consider implementing DDoS protection measures');
  }
  
  // Traffic analysis
  if (legitimateCount > 0 && maliciousCount > 0) {
    const legitimateSuccessRate = legitimateCount > 0 ? ((legitimateCount - (legitimateCount * errorRate)) / legitimateCount) : 0;
    console.log(`\n📊 Traffic Analysis:`);
    console.log(`   - Legitimate traffic success rate: ${(legitimateSuccessRate * 100).toFixed(1)}%`);
    console.log(`   - Malicious vs Legitimate ratio: ${(maliciousCount / legitimateCount).toFixed(2)}:1`);
  }
  
  console.log('\n🔴 REMINDER: This was a SIMULATION for testing purposes only!');
  
  return summary;
}