// Stress Test for Quote of the Day Application
// This test pushes the system beyond normal capacity to identify breaking points

import { check, sleep } from 'k6';
import { config } from './utils/config.js';
import { 
  HttpHelper, 
  ResponseValidator, 
  LoadPatternHelper,
  SleepHelper,
  TestDataHelper,
  PerformanceMonitor,
  ErrorHandler
} from './utils/helpers.js';

// Stress test configuration with higher thresholds
export let options = {
  stages: config.scenarios.stress.stages,
  
  // More lenient thresholds for stress testing
  thresholds: {
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'], // Allow higher response times
    'http_req_failed': ['rate<0.1'], // Allow up to 10% failure rate
    'http_reqs': ['rate>10'], // Expect at least 10 requests per second
    'custom_error_rate': ['rate<0.15'], // Allow up to 15% custom error rate
    'successful_requests': ['count>1000'], // Expect at least 1000 successful requests
  },
  
  ext: {
    loadimpact: {
      name: 'Quote App - Stress Test',
      projectID: 3599339,
    },
  },
  
  tags: {
    testType: 'stress',
    environment: config.environment,
    application: 'quote-app'
  },

  // Scenarios for stress testing
  scenarios: {
    // Aggressive web users
    stress_web_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.scenarios.stress.stages,
      gracefulRampDown: '1m',
      tags: { userType: 'web_stress' },
    },
    
    // High-frequency API calls
    stress_api_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },   // Quick ramp to 10 API users
        { duration: '5m', target: 20 },   // Increase to 20 API users
        { duration: '3m', target: 40 },   // Stress with 40 API users
        { duration: '5m', target: 40 },   // Maintain stress level
        { duration: '2m', target: 20 },   // Partial recovery
        { duration: '3m', target: 0 },    // Full recovery
      ],
      gracefulRampDown: '1m',
      tags: { userType: 'api_stress' },
      exec: 'stressApiScenario',
    },
    
    // Burst traffic simulation
    burst_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 10 },   // Normal traffic
        { duration: '30s', target: 50 },  // Sudden burst
        { duration: '2m', target: 50 },   // Sustained burst
        { duration: '30s', target: 100 }, // Peak burst
        { duration: '1m', target: 100 },  // Peak sustained
        { duration: '1m', target: 10 },   // Recovery
        { duration: '1m', target: 0 },    // Cool down
      ],
      gracefulRampDown: '30s',
      tags: { userType: 'burst' },
      exec: 'burstTrafficScenario',
    },
    
    // Continuous health monitoring during stress
    stress_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '20m',
      gracefulRampDown: '10s',
      tags: { userType: 'monitor' },
      exec: 'stressMonitorScenario',
    },
  },
};

// Setup function
export function setup() {
  console.log('🔥 Starting Stress Test for Quote of the Day Application');
  console.log(`📊 Environment: ${config.environment}`);
  console.log(`🎯 Base URL: ${config.getBaseUrl()}`);
  console.log(`⏱️  Test Duration: ~20 minutes`);
  console.log(`👥 Max VUs: ${Math.max(...config.scenarios.stress.stages.map(s => s.target))}`);
  console.log('⚠️  WARNING: This test will push the system beyond normal limits');
  
  // Verify application baseline performance
  const httpHelper = new HttpHelper();
  
  console.log('🔍 Establishing baseline performance...');
  
  const baselineChecks = [];
  
  // Multiple baseline requests to get average
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    
    const frontendCheck = httpHelper.get(config.endpoints.frontend);
    const apiCheck = httpHelper.get(config.endpoints.randomQuote);
    const healthCheck = httpHelper.get(config.endpoints.health);
    
    const duration = Date.now() - start;
    baselineChecks.push({
      frontend: frontendCheck.timings.duration,
      api: apiCheck.timings.duration,
      health: healthCheck.timings.duration,
      total: duration
    });
    
    sleep(1);
  }
  
  const avgBaseline = baselineChecks.reduce((acc, curr) => ({
    frontend: acc.frontend + curr.frontend / baselineChecks.length,
    api: acc.api + curr.api / baselineChecks.length,
    health: acc.health + curr.health / baselineChecks.length,
    total: acc.total + curr.total / baselineChecks.length
  }), { frontend: 0, api: 0, health: 0, total: 0 });
  
  console.log(`📊 Baseline Performance:`);
  console.log(`   Frontend: ${Math.round(avgBaseline.frontend)}ms`);
  console.log(`   API: ${Math.round(avgBaseline.api)}ms`);
  console.log(`   Health: ${Math.round(avgBaseline.health)}ms`);
  console.log(`   Total: ${Math.round(avgBaseline.total)}ms`);
  
  return {
    startTime: Date.now(),
    environment: config.environment,
    baseUrl: config.getBaseUrl(),
    baseline: avgBaseline
  };
}

// Default scenario - Aggressive web users
export default function(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    // More aggressive behavior patterns
    const vuId = __VU;
    const behavior = vuId % 4; // 4 different stress patterns
    
    try {
      switch (behavior) {
        case 0:
          // Rapid fire requests
          rapidFireBehavior(httpHelper);
          break;
        case 1:
          // Heavy browsing with minimal delays
          heavyBrowsingBehavior(httpHelper);
          break;
        case 2:
          // API hammering
          apiHammeringBehavior(httpHelper);
          break;
        case 3:
          // Mixed aggressive behavior
          mixedAggressiveBehavior(httpHelper);
          break;
      }
    } catch (error) {
      ErrorHandler.logError(error, `VU ${vuId} behavior ${behavior}`);
    }
  });
}

// Stress API scenario
export function stressApiScenario(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      // Rapid API calls with minimal delays
      for (let i = 0; i < TestDataHelper.generateRandomNumber(5, 10); i++) {
        const endpoint = TestDataHelper.getRandomItem([
          config.endpoints.randomQuote,
          config.endpoints.quotes,
          config.endpoints.categories,
          config.endpoints.health
        ]);
        
        const response = httpHelper.get(endpoint);
        
        // More lenient validation for stress test
        check(response, {
          'status is not 5xx': (r) => r.status < 500,
          'response time < 10s': (r) => r.timings.duration < 10000,
        });
        
        // Very short sleep between requests
        SleepHelper.fixedSleep(0.1);
      }
    } catch (error) {
      ErrorHandler.logError(error, 'Stress API scenario');
    }
  });
}

// Burst traffic scenario
export function burstTrafficScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    // Single request with minimal processing
    const endpoint = TestDataHelper.getRandomItem([
      config.endpoints.frontend,
      config.endpoints.randomQuote,
      config.endpoints.health
    ]);
    
    const response = httpHelper.get(endpoint);
    
    check(response, {
      'burst request completed': (r) => r.status !== 0,
      'response time < 15s': (r) => r.timings.duration < 15000,
    });
    
  } catch (error) {
    ErrorHandler.logError(error, 'Burst traffic scenario');
  }
}

// Stress monitoring scenario
export function stressMonitorScenario(data) {
  const httpHelper = new HttpHelper();
  
  // Monitor system health during stress
  const healthResponse = httpHelper.get(config.endpoints.health);
  
  const healthMetrics = check(healthResponse, {
    'health endpoint accessible': (r) => r.status !== 0,
    'health response time < 5s': (r) => r.timings.duration < 5000,
    'health status not 5xx': (r) => r.status < 500,
  });
  
  // Log critical health issues
  if (!healthMetrics || healthResponse.status >= 500) {
    console.error(`🚨 CRITICAL: Health check failed during stress test at ${new Date().toISOString()}`);
    console.error(`   Status: ${healthResponse.status}`);
    console.error(`   Response Time: ${Math.round(healthResponse.timings.duration)}ms`);
  }
  
  sleep(15); // Check every 15 seconds during stress
}

// Rapid fire behavior - minimal delays, maximum requests
function rapidFireBehavior(httpHelper) {
  for (let i = 0; i < 8; i++) {
    const response = httpHelper.get(config.endpoints.randomQuote);
    
    check(response, {
      'rapid fire request completed': (r) => r.status !== 0,
      'rapid fire not timeout': (r) => r.timings.duration < 8000,
    });
    
    SleepHelper.fixedSleep(0.05); // 50ms between requests
  }
}

// Heavy browsing with minimal delays
function heavyBrowsingBehavior(httpHelper) {
  // Load multiple pages quickly
  const pages = [
    config.endpoints.frontend,
    config.endpoints.quotes,
    config.endpoints.categories,
    config.endpoints.randomQuote,
    config.endpoints.health
  ];
  
  pages.forEach(page => {
    const response = httpHelper.get(page);
    
    check(response, {
      'heavy browsing page loaded': (r) => r.status < 500,
      'heavy browsing response time acceptable': (r) => r.timings.duration < 6000,
    });
    
    SleepHelper.fixedSleep(0.2); // 200ms between pages
  });
  
  // Additional rapid quote requests
  for (let i = 0; i < 5; i++) {
    const quote = httpHelper.get(config.endpoints.randomQuote);
    
    check(quote, {
      'heavy browsing quote loaded': (r) => r.status < 500,
    });
    
    SleepHelper.fixedSleep(0.1);
  }
}

// API hammering behavior
function apiHammeringBehavior(httpHelper) {
  // Simulate aggressive API client
  const apiEndpoints = [
    config.endpoints.randomQuote,
    config.endpoints.quotes,
    config.endpoints.categories
  ];
  
  // Make many API calls in quick succession
  for (let i = 0; i < 12; i++) {
    const endpoint = TestDataHelper.getRandomItem(apiEndpoints);
    const response = httpHelper.get(endpoint);
    
    check(response, {
      'api hammer request processed': (r) => r.status !== 0,
      'api hammer not server error': (r) => r.status < 500,
    });
    
    // No sleep - hammer as fast as possible
  }
  
  SleepHelper.fixedSleep(0.5); // Brief pause before next iteration
}

// Mixed aggressive behavior
function mixedAggressiveBehavior(httpHelper) {
  // Combination of all aggressive patterns
  
  // Start with page load
  const homepage = httpHelper.get(config.endpoints.frontend);
  check(homepage, {
    'mixed aggressive homepage loaded': (r) => r.status < 500,
  });
  
  SleepHelper.fixedSleep(0.1);
  
  // Rapid API calls
  for (let i = 0; i < 6; i++) {
    const api = httpHelper.get(config.endpoints.randomQuote);
    check(api, {
      'mixed aggressive api call': (r) => r.status < 500,
    });
  }
  
  SleepHelper.fixedSleep(0.2);
  
  // Browse other endpoints
  const browse = httpHelper.get(config.endpoints.quotes);
  check(browse, {
    'mixed aggressive browse': (r) => r.status < 500,
  });
  
  // Final health check
  const health = httpHelper.get(config.endpoints.health);
  check(health, {
    'mixed aggressive health check': (r) => r.status !== 0,
  });
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log('🔥 Stress Test Completed');
  console.log(`⏱️  Total Duration: ${Math.round(duration)}s`);
  console.log(`🌍 Environment: ${data.environment}`);
  console.log(`🎯 Target URL: ${data.baseUrl}`);
  
  // Post-stress health assessment
  console.log('🏥 Post-stress health assessment...');
  
  const httpHelper = new HttpHelper();
  const recoveryChecks = [];
  
  // Multiple health checks to assess recovery
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    
    try {
      const frontendCheck = httpHelper.get(config.endpoints.frontend);
      const apiCheck = httpHelper.get(config.endpoints.randomQuote);
      const healthCheck = httpHelper.get(config.endpoints.health);
      
      const duration = Date.now() - start;
      recoveryChecks.push({
        frontend: frontendCheck.timings.duration,
        api: apiCheck.timings.duration,
        health: healthCheck.timings.duration,
        total: duration,
        success: frontendCheck.status < 400 && apiCheck.status < 400 && healthCheck.status < 400
      });
      
    } catch (error) {
      console.error(`Recovery check ${i + 1} failed: ${error}`);
      recoveryChecks.push({
        frontend: 0,
        api: 0,
        health: 0,
        total: 0,
        success: false
      });
    }
    
    sleep(2);
  }
  
  const successfulChecks = recoveryChecks.filter(check => check.success);
  
  if (successfulChecks.length > 0) {
    const avgRecovery = successfulChecks.reduce((acc, curr) => ({
      frontend: acc.frontend + curr.frontend / successfulChecks.length,
      api: acc.api + curr.api / successfulChecks.length,
      health: acc.health + curr.health / successfulChecks.length,
      total: acc.total + curr.total / successfulChecks.length
    }), { frontend: 0, api: 0, health: 0, total: 0 });
    
    console.log(`📊 Post-Stress Performance:`);
    console.log(`   Frontend: ${Math.round(avgRecovery.frontend)}ms (baseline: ${Math.round(data.baseline.frontend)}ms)`);
    console.log(`   API: ${Math.round(avgRecovery.api)}ms (baseline: ${Math.round(data.baseline.api)}ms)`);
    console.log(`   Health: ${Math.round(avgRecovery.health)}ms (baseline: ${Math.round(data.baseline.health)}ms)`);
    
    // Calculate performance degradation
    const degradation = {
      frontend: ((avgRecovery.frontend - data.baseline.frontend) / data.baseline.frontend * 100),
      api: ((avgRecovery.api - data.baseline.api) / data.baseline.api * 100),
      health: ((avgRecovery.health - data.baseline.health) / data.baseline.health * 100)
    };
    
    console.log(`📈 Performance Change from Baseline:`);
    console.log(`   Frontend: ${degradation.frontend > 0 ? '+' : ''}${Math.round(degradation.frontend)}%`);
    console.log(`   API: ${degradation.api > 0 ? '+' : ''}${Math.round(degradation.api)}%`);
    console.log(`   Health: ${degradation.health > 0 ? '+' : ''}${Math.round(degradation.health)}%`);
    
    if (Math.max(degradation.frontend, degradation.api, degradation.health) > 50) {
      console.log('⚠️  WARNING: Significant performance degradation detected');
    } else {
      console.log('✅ System recovered well from stress test');
    }
    
  } else {
    console.log('❌ CRITICAL: System did not recover properly from stress test');
  }
  
  console.log(`📊 Recovery Success Rate: ${Math.round(successfulChecks.length / recoveryChecks.length * 100)}%`);
  
  console.log('');
  console.log('📈 Key Stress Test Metrics to Review:');
  console.log('  - Peak response times during stress');
  console.log('  - Error rates at different load levels');
  console.log('  - System recovery time');
  console.log('  - Resource utilization peaks');
  console.log('  - Breaking point identification');
  console.log('');
  console.log('🔍 Check system logs and monitoring dashboards for detailed analysis');
}