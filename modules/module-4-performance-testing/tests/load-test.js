// Load Test for Quote of the Day Application
// This test simulates normal expected load to verify system performance under typical usage

import { check, sleep } from 'k6';
import { config } from './utils/config.js';
import { 
  HttpHelper, 
  ResponseValidator, 
  LoadPatternHelper,
  SleepHelper,
  TestDataHelper,
  PerformanceMonitor
} from './utils/helpers.js';

// Test configuration
export let options = {
  stages: config.scenarios.load.stages,
  thresholds: config.thresholds,
  
  // Additional load test specific configuration
  ext: {
    loadimpact: {
      name: 'Quote App - Load Test',
      projectID: 3599339,
    },
  },
  
  // Tags for better organization
  tags: {
    testType: 'load',
    environment: config.environment,
    application: 'quote-app'
  },

  // Scenarios for different user behaviors
  scenarios: {
    // Web users browsing the application
    web_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.scenarios.load.stages,
      gracefulRampDown: '30s',
      tags: { userType: 'web' },
    },
    
    // API users making direct API calls
    api_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 5 },   // Ramp up to 5 API users
        { duration: '5m', target: 5 },   // Stay at 5 API users
        { duration: '2m', target: 10 },  // Ramp up to 10 API users
        { duration: '5m', target: 10 },  // Stay at 10 API users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { userType: 'api' },
      exec: 'apiUserScenario',
    },
    
    // Health check monitoring
    health_check: {
      executor: 'constant-vus',
      vus: 1,
      duration: '16m',
      gracefulRampDown: '10s',
      tags: { userType: 'monitor' },
      exec: 'healthCheckScenario',
    },
  },
};

// Setup function - runs once before the test
export function setup() {
  console.log('🚀 Starting Load Test for Quote of the Day Application');
  console.log(`📊 Environment: ${config.environment}`);
  console.log(`🎯 Base URL: ${config.getBaseUrl()}`);
  console.log(`⏱️  Test Duration: ~16 minutes`);
  console.log(`👥 Max VUs: ${Math.max(...config.scenarios.load.stages.map(s => s.target))}`);
  
  // Verify application is accessible
  const httpHelper = new HttpHelper();
  
  console.log('🔍 Verifying application accessibility...');
  
  // Check frontend
  const frontendCheck = httpHelper.get(config.endpoints.frontend);
  if (!ResponseValidator.isSuccessful(frontendCheck)) {
    throw new Error(`Frontend not accessible: ${frontendCheck.status}`);
  }
  
  // Check backend health
  const healthCheck = httpHelper.get(config.endpoints.health);
  if (!ResponseValidator.isSuccessful(healthCheck)) {
    throw new Error(`Backend health check failed: ${healthCheck.status}`);
  }
  
  // Check API endpoints
  const apiCheck = httpHelper.get(config.endpoints.randomQuote);
  if (!ResponseValidator.isSuccessful(apiCheck)) {
    throw new Error(`API not accessible: ${apiCheck.status}`);
  }
  
  console.log('✅ Application is accessible and ready for testing');
  
  return {
    startTime: Date.now(),
    environment: config.environment,
    baseUrl: config.getBaseUrl()
  };
}

// Default scenario - Web users browsing the application
export default function(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    // Simulate different user behaviors based on VU ID
    const vuId = __VU;
    const behavior = vuId % 3; // 3 different behavior patterns
    
    switch (behavior) {
      case 0:
        // Casual browser - just views quotes
        casualBrowsingBehavior(httpHelper);
        break;
      case 1:
        // Active user - explores different sections
        activeBrowsingBehavior(httpHelper);
        break;
      case 2:
        // Power user - uses multiple features
        powerUserBehavior(httpHelper);
        break;
    }
  });
}

// API users scenario
export function apiUserScenario(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    LoadPatternHelper.simulateApiUsage(httpHelper);
  });
}

// Health check monitoring scenario
export function healthCheckScenario(data) {
  const httpHelper = new HttpHelper();
  
  // Check application health every 30 seconds
  const healthResponse = httpHelper.get(config.endpoints.health);
  
  const healthCheck = check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (!healthCheck) {
    console.error(`❌ Health check failed at ${new Date().toISOString()}`);
  }
  
  sleep(30); // Check every 30 seconds
}

// Casual browsing behavior
function casualBrowsingBehavior(httpHelper) {
  // Load homepage
  const homepage = httpHelper.get(config.endpoints.frontend);
  ResponseValidator.validateResponse(homepage, {
    expectedStatus: 200,
    maxResponseTime: 2000,
    expectedText: 'Quote of the Day'
  });
  
  SleepHelper.sleepWithJitter(2, 0.2); // 2s ± 20% jitter
  
  // Get a random quote
  const randomQuote = httpHelper.get(config.endpoints.randomQuote);
  ResponseValidator.validateResponse(randomQuote, {
    expectedStatus: 200,
    maxResponseTime: 1000,
    requireJson: true,
    expectedKeys: ['text', 'author']
  });
  
  SleepHelper.sleepWithJitter(3, 0.3); // 3s ± 30% jitter
  
  // Maybe get another quote (50% chance)
  if (Math.random() > 0.5) {
    const anotherQuote = httpHelper.get(config.endpoints.randomQuote);
    ResponseValidator.validateResponse(anotherQuote, {
      expectedStatus: 200,
      maxResponseTime: 1000,
      requireJson: true
    });
    
    SleepHelper.sleepWithJitter(2, 0.2);
  }
}

// Active browsing behavior
function activeBrowsingBehavior(httpHelper) {
  // Load homepage
  const homepage = httpHelper.get(config.endpoints.frontend);
  ResponseValidator.validateResponse(homepage, {
    expectedStatus: 200,
    maxResponseTime: 2000
  });
  
  SleepHelper.sleepWithJitter(1.5, 0.2);
  
  // Browse quotes
  const allQuotes = httpHelper.get(config.endpoints.quotes);
  ResponseValidator.validateResponse(allQuotes, {
    expectedStatus: 200,
    maxResponseTime: 1500,
    requireJson: true
  });
  
  SleepHelper.sleepWithJitter(2, 0.3);
  
  // Check categories
  const categories = httpHelper.get(config.endpoints.categories);
  ResponseValidator.validateResponse(categories, {
    expectedStatus: 200,
    maxResponseTime: 1000
  });
  
  SleepHelper.sleepWithJitter(1, 0.2);
  
  // Get random quotes multiple times
  for (let i = 0; i < TestDataHelper.generateRandomNumber(2, 4); i++) {
    const randomQuote = httpHelper.get(config.endpoints.randomQuote);
    ResponseValidator.validateResponse(randomQuote, {
      expectedStatus: 200,
      maxResponseTime: 1000,
      requireJson: true,
      expectedKeys: ['text', 'author']
    });
    
    SleepHelper.sleepWithJitter(1.5, 0.3);
  }
}

// Power user behavior
function powerUserBehavior(httpHelper) {
  // Comprehensive application usage
  LoadPatternHelper.simulatePageLoad(httpHelper);
  
  SleepHelper.sleepWithJitter(1, 0.2);
  
  // Explore all endpoints
  const endpoints = [
    config.endpoints.quotes,
    config.endpoints.categories,
    config.endpoints.randomQuote,
    config.endpoints.health
  ];
  
  endpoints.forEach(endpoint => {
    const response = httpHelper.get(endpoint);
    ResponseValidator.validateResponse(response, {
      expectedStatus: 200,
      maxResponseTime: 1500
    });
    
    SleepHelper.sleepWithJitter(0.8, 0.2);
  });
  
  // Simulate rapid quote requests (testing caching)
  for (let i = 0; i < 5; i++) {
    const rapidQuote = httpHelper.get(config.endpoints.randomQuote);
    ResponseValidator.validateResponse(rapidQuote, {
      expectedStatus: 200,
      maxResponseTime: 800, // Expect faster response due to caching
      requireJson: true
    });
    
    SleepHelper.fixedSleep(0.3); // Shorter sleep for rapid requests
  }
  
  SleepHelper.sleepWithJitter(2, 0.4);
}

// Teardown function - runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log('📊 Load Test Completed');
  console.log(`⏱️  Total Duration: ${Math.round(duration)}s`);
  console.log(`🌍 Environment: ${data.environment}`);
  console.log(`🎯 Target URL: ${data.baseUrl}`);
  
  // Final health check
  const httpHelper = new HttpHelper();
  const finalHealthCheck = httpHelper.get(config.endpoints.health);
  
  if (ResponseValidator.isSuccessful(finalHealthCheck)) {
    console.log('✅ Application is healthy after load test');
  } else {
    console.log('⚠️  Application health check failed after load test');
  }
  
  console.log('');
  console.log('📈 Key Metrics to Review:');
  console.log('  - HTTP request duration (avg, p95, p99)');
  console.log('  - HTTP request failure rate');
  console.log('  - Requests per second');
  console.log('  - Custom error rate');
  console.log('  - Response time trends');
  console.log('');
  console.log('🔍 Check Grafana dashboard for detailed metrics visualization');
}