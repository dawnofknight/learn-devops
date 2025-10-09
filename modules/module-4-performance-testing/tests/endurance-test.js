// Endurance Test for Quote of the Day Application
// This test verifies system stability and performance over extended periods

import { check, sleep } from 'k6';
import { config } from './utils/config.js';
import { 
  HttpHelper, 
  ResponseValidator, 
  TestDataHelper,
  SleepHelper,
  PerformanceMonitor,
  ErrorHandler
} from './utils/helpers.js';

// Endurance test configuration
export let options = {
  stages: config.scenarios.endurance.stages,
  
  // Endurance-specific thresholds
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // Consistent response times
    'http_req_failed': ['rate<0.02'], // Very low failure rate over time
    'http_reqs': ['rate>3'], // Minimum sustained request rate
    'custom_error_rate': ['rate<0.03'], // Low custom error rate
    'successful_requests': ['count>5000'], // High number of successful requests over time
    
    // Endurance-specific metrics
    'memory_stability': ['avg<2000'], // Memory usage should remain stable
    'performance_degradation': ['rate<0.1'], // Performance should not degrade significantly
    'connection_stability': ['rate>0.98'], // Connection success rate should remain high
    'resource_efficiency': ['avg<1500'], // Resource usage should be efficient
    'system_recovery': ['rate>0.95'], // System should recover from minor issues
  },
  
  ext: {
    loadimpact: {
      name: 'Quote App - Endurance Test',
      projectID: 3599339,
    },
  },
  
  tags: {
    testType: 'endurance',
    environment: config.environment,
    application: 'quote-app'
  },

  // Endurance test scenarios
  scenarios: {
    // Main endurance scenario - sustained load
    sustained_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.scenarios.endurance.stages,
      gracefulRampDown: '5m',
      tags: { enduranceType: 'sustained' },
    },
    
    // Background monitoring
    system_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60m',
      gracefulRampDown: '30s',
      tags: { enduranceType: 'monitor' },
      exec: 'systemMonitorScenario',
    },
    
    // Periodic health checks
    health_checker: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60m',
      gracefulRampDown: '30s',
      tags: { enduranceType: 'health' },
      exec: 'healthCheckScenario',
    },
    
    // Memory leak detection
    memory_tracker: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60m',
      gracefulRampDown: '30s',
      tags: { enduranceType: 'memory' },
      exec: 'memoryTrackingScenario',
    },
    
    // Performance baseline tracking
    performance_baseline: {
      executor: 'constant-vus',
      vus: 2,
      duration: '60m',
      gracefulRampDown: '1m',
      tags: { enduranceType: 'baseline' },
      exec: 'performanceBaselineScenario',
    },
  },
};

// Custom metrics for endurance testing
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

const memoryStability = new Trend('memory_stability');
const performanceDegradation = new Rate('performance_degradation');
const connectionStability = new Rate('connection_stability');
const resourceEfficiency = new Trend('resource_efficiency');
const systemRecovery = new Rate('system_recovery');
const responseTimeVariance = new Trend('response_time_variance');
const errorRecoveryTime = new Trend('error_recovery_time');
const systemHealthScore = new Gauge('system_health_score');

// Global variables for tracking
let baselineResponseTime = 0;
let errorCount = 0;
let recoveryStartTime = 0;
let performanceHistory = [];

// Setup function
export function setup() {
  console.log('🏃‍♂️ Starting Endurance Test for Quote of the Day Application');
  console.log(`🏃‍♂️ Environment: ${config.environment}`);
  console.log(`🎯 Base URL: ${config.getBaseUrl()}`);
  console.log(`⏱️  Test Duration: 60 minutes`);
  console.log(`📈 Max VUs: ${Math.max(...config.scenarios.endurance.stages.map(s => s.target))}`);
  console.log('🔄 Testing system stability over extended period');
  
  // Establish baseline performance
  const httpHelper = new HttpHelper();
  
  console.log('📊 Establishing performance baseline...');
  
  const baselineTests = [];
  
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    const frontendResponse = httpHelper.get(config.endpoints.frontend);
    const quotesResponse = httpHelper.get(config.endpoints.randomQuote);
    const healthResponse = httpHelper.get(config.endpoints.health);
    
    const totalTime = Date.now() - start;
    
    baselineTests.push({
      iteration: i + 1,
      totalTime: totalTime,
      frontendTime: frontendResponse.timings.duration,
      quotesTime: quotesResponse.timings.duration,
      healthTime: healthResponse.timings.duration,
      success: frontendResponse.status < 400 && quotesResponse.status < 400 && healthResponse.status < 400
    });
    
    sleep(2);
  }
  
  const successfulBaselines = baselineTests.filter(b => b.success);
  const avgResponseTime = successfulBaselines.reduce((sum, b) => sum + b.totalTime, 0) / successfulBaselines.length;
  
  console.log(`📊 Baseline Results (${successfulBaselines.length}/${baselineTests.length} successful):`);
  console.log(`   Average Total Time: ${Math.round(avgResponseTime)}ms`);
  console.log(`   Average Frontend Time: ${Math.round(successfulBaselines.reduce((sum, b) => sum + b.frontendTime, 0) / successfulBaselines.length)}ms`);
  console.log(`   Average Quotes Time: ${Math.round(successfulBaselines.reduce((sum, b) => sum + b.quotesTime, 0) / successfulBaselines.length)}ms`);
  console.log(`   Average Health Time: ${Math.round(successfulBaselines.reduce((sum, b) => sum + b.healthTime, 0) / successfulBaselines.length)}ms`);
  
  return {
    startTime: Date.now(),
    environment: config.environment,
    baseUrl: config.getBaseUrl(),
    baselineResponseTime: avgResponseTime,
    baselineResults: successfulBaselines
  };
}

// Default scenario - Sustained load
export default function(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      const iterationStart = Date.now();
      
      // Simulate realistic user behavior over time
      const userBehavior = TestDataHelper.generateRandomNumber(1, 4);
      
      switch (userBehavior) {
        case 1:
          casualUserBehavior(httpHelper, data);
          break;
        case 2:
          activeUserBehavior(httpHelper, data);
          break;
        case 3:
          powerUserBehavior(httpHelper, data);
          break;
        case 4:
          backgroundUserBehavior(httpHelper, data);
          break;
      }
      
      const iterationTime = Date.now() - iterationStart;
      resourceEfficiency.add(iterationTime);
      
      // Track performance over time
      performanceHistory.push({
        timestamp: Date.now(),
        responseTime: iterationTime,
        vuId: __VU,
        iteration: __ITER
      });
      
      // Keep only recent history (last 100 entries per VU)
      if (performanceHistory.length > 100) {
        performanceHistory = performanceHistory.slice(-100);
      }
      
    } catch (error) {
      ErrorHandler.logError(error, `Endurance test VU ${__VU}`);
      errorCount++;
      
      if (recoveryStartTime === 0) {
        recoveryStartTime = Date.now();
      }
    }
  });
}

// System monitoring scenario
export function systemMonitorScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    // Comprehensive system monitoring
    const monitoringStart = Date.now();
    
    // Test all critical endpoints
    const endpoints = [
      { name: 'frontend', url: config.endpoints.frontend },
      { name: 'quotes', url: config.endpoints.quotes },
      { name: 'random-quote', url: config.endpoints.randomQuote },
      { name: 'health', url: config.endpoints.health },
    ];
    
    const monitoringResults = [];
    
    for (const endpoint of endpoints) {
      const response = httpHelper.get(endpoint.url);
      
      monitoringResults.push({
        endpoint: endpoint.name,
        responseTime: response.timings.duration,
        status: response.status,
        success: response.status < 400,
        timestamp: Date.now()
      });
      
      connectionStability.add(response.status < 400);
    }
    
    // Calculate system health score
    const successfulEndpoints = monitoringResults.filter(r => r.success).length;
    const healthScore = (successfulEndpoints / endpoints.length) * 100;
    systemHealthScore.add(healthScore);
    
    // Check for performance degradation
    const avgCurrentResponseTime = monitoringResults.reduce((sum, r) => sum + r.responseTime, 0) / monitoringResults.length;
    
    if (data.baselineResponseTime > 0) {
      const degradationRatio = avgCurrentResponseTime / data.baselineResponseTime;
      performanceDegradation.add(degradationRatio > 1.5); // 50% degradation threshold
      
      // Track response time variance
      const variance = Math.abs(avgCurrentResponseTime - data.baselineResponseTime);
      responseTimeVariance.add(variance);
    }
    
    const monitoringTime = Date.now() - monitoringStart;
    memoryStability.add(monitoringTime);
    
    check(monitoringResults, {
      'all endpoints accessible': () => successfulEndpoints === endpoints.length,
      'system health score > 80%': () => healthScore > 80,
      'monitoring overhead < 5s': () => monitoringTime < 5000,
    });
    
    // Log periodic status
    if (__ITER % 10 === 0) {
      console.log(`🔍 System Monitor - Health: ${Math.round(healthScore)}%, Avg Response: ${Math.round(avgCurrentResponseTime)}ms`);
    }
    
  } catch (error) {
    ErrorHandler.logError(error, 'System monitoring scenario');
  }
  
  sleep(30); // Monitor every 30 seconds
}

// Health check scenario
export function healthCheckScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    const healthResponse = httpHelper.get(config.endpoints.health);
    
    const healthCheck = check(healthResponse, {
      'health endpoint responsive': (r) => r.status === 200,
      'health response time < 1s': (r) => r.timings.duration < 1000,
      'health endpoint returns valid data': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.hasOwnProperty('status') || json.hasOwnProperty('health');
        } catch (e) {
          return r.body.includes('OK') || r.body.includes('healthy');
        }
      }
    });
    
    connectionStability.add(healthCheck);
    
    // Test recovery if there were previous errors
    if (errorCount > 0 && recoveryStartTime > 0) {
      if (healthCheck) {
        const recoveryTime = Date.now() - recoveryStartTime;
        errorRecoveryTime.add(recoveryTime);
        systemRecovery.add(true);
        
        // Reset error tracking
        errorCount = 0;
        recoveryStartTime = 0;
        
        console.log(`✅ System recovered in ${Math.round(recoveryTime / 1000)}s`);
      }
    }
    
  } catch (error) {
    ErrorHandler.logError(error, 'Health check scenario');
    errorCount++;
  }
  
  sleep(15); // Health check every 15 seconds
}

// Memory tracking scenario
export function memoryTrackingScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    // Simulate memory-intensive operations
    const memoryTestStart = Date.now();
    
    // Generate and process large amounts of data
    const largeDataSets = [];
    
    for (let i = 0; i < 5; i++) {
      const largePayload = TestDataHelper.generateLargePayload(1000);
      largeDataSets.push(largePayload);
      
      // Make requests while holding large data
      const response = httpHelper.get(config.endpoints.quotes);
      
      check(response, {
        'memory test request successful': (r) => r.status < 400,
        'memory test response time reasonable': (r) => r.timings.duration < 3000,
      });
      
      sleep(1);
    }
    
    // Clear large data sets (simulate garbage collection)
    largeDataSets.length = 0;
    
    const memoryTestTime = Date.now() - memoryTestStart;
    memoryStability.add(memoryTestTime);
    
    // Test system responsiveness after memory operations
    const postMemoryResponse = httpHelper.get(config.endpoints.randomQuote);
    
    const memoryEfficiencyCheck = check(postMemoryResponse, {
      'post-memory operation responsive': (r) => r.status < 400,
      'post-memory response time good': (r) => r.timings.duration < 2000,
    });
    
    systemRecovery.add(memoryEfficiencyCheck);
    
  } catch (error) {
    ErrorHandler.logError(error, 'Memory tracking scenario');
  }
  
  sleep(60); // Memory test every minute
}

// Performance baseline tracking scenario
export function performanceBaselineScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    // Regular performance baseline checks
    const baselineStart = Date.now();
    
    const baselineTests = [];
    
    // Test multiple endpoints for baseline comparison
    const testEndpoints = [
      config.endpoints.frontend,
      config.endpoints.randomQuote,
      config.endpoints.quotes
    ];
    
    for (const endpoint of testEndpoints) {
      const response = httpHelper.get(endpoint);
      
      baselineTests.push({
        endpoint: endpoint,
        responseTime: response.timings.duration,
        status: response.status,
        success: response.status < 400
      });
      
      sleep(0.5);
    }
    
    const avgCurrentTime = baselineTests.reduce((sum, t) => sum + t.responseTime, 0) / baselineTests.length;
    const successRate = baselineTests.filter(t => t.success).length / baselineTests.length;
    
    // Compare with initial baseline
    if (data.baselineResponseTime > 0) {
      const performanceRatio = avgCurrentTime / data.baselineResponseTime;
      
      // Track significant performance changes
      performanceDegradation.add(performanceRatio > 1.3); // 30% degradation
      
      check(baselineTests, {
        'performance within acceptable range': () => performanceRatio < 2.0, // 100% degradation limit
        'baseline success rate > 90%': () => successRate > 0.9,
        'baseline response time reasonable': () => avgCurrentTime < 5000,
      });
      
      // Log performance trends
      if (__ITER % 5 === 0) {
        const trend = performanceRatio > 1.1 ? '📈' : performanceRatio < 0.9 ? '📉' : '➡️';
        console.log(`${trend} Performance Baseline - Current: ${Math.round(avgCurrentTime)}ms, Ratio: ${performanceRatio.toFixed(2)}x`);
      }
    }
    
    const baselineTime = Date.now() - baselineStart;
    resourceEfficiency.add(baselineTime);
    
  } catch (error) {
    ErrorHandler.logError(error, 'Performance baseline scenario');
  }
  
  sleep(45); // Baseline check every 45 seconds
}

// User behavior patterns
function casualUserBehavior(httpHelper, data) {
  // Casual user - light usage
  const frontend = httpHelper.get(config.endpoints.frontend);
  
  ResponseValidator.validateResponse(frontend, {
    expectedStatus: 200,
    maxResponseTime: 3000
  });
  
  SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(10, 30), 0.3);
  
  const quote = httpHelper.get(config.endpoints.randomQuote);
  
  ResponseValidator.validateResponse(quote, {
    expectedStatus: 200,
    maxResponseTime: 2000,
    requireJson: true
  });
  
  SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(15, 45), 0.4);
}

function activeUserBehavior(httpHelper, data) {
  // Active user - moderate usage
  const actions = [
    () => httpHelper.get(config.endpoints.frontend),
    () => httpHelper.get(config.endpoints.randomQuote),
    () => httpHelper.get(config.endpoints.quotes),
    () => httpHelper.get(config.endpoints.categories),
  ];
  
  const numActions = TestDataHelper.generateRandomNumber(2, 4);
  
  for (let i = 0; i < numActions; i++) {
    const action = TestDataHelper.getRandomItem(actions);
    const response = action();
    
    ResponseValidator.validateResponse(response, {
      expectedStatus: 200,
      maxResponseTime: 2500
    });
    
    SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(3, 8), 0.2);
  }
  
  SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(8, 20), 0.3);
}

function powerUserBehavior(httpHelper, data) {
  // Power user - heavy usage
  const powerActions = [
    () => httpHelper.get(config.endpoints.quotes),
    () => httpHelper.get(config.endpoints.randomQuote),
    () => httpHelper.get(config.endpoints.categories),
    () => httpHelper.get(config.endpoints.frontend),
  ];
  
  const numActions = TestDataHelper.generateRandomNumber(4, 8);
  
  for (let i = 0; i < numActions; i++) {
    const action = TestDataHelper.getRandomItem(powerActions);
    const response = action();
    
    ResponseValidator.validateResponse(response, {
      expectedStatus: 200,
      maxResponseTime: 3000
    });
    
    SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(1, 3), 0.1);
  }
  
  SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(5, 15), 0.2);
}

function backgroundUserBehavior(httpHelper, data) {
  // Background user - minimal usage
  const health = httpHelper.get(config.endpoints.health);
  
  ResponseValidator.validateResponse(health, {
    expectedStatus: 200,
    maxResponseTime: 1000
  });
  
  SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(30, 60), 0.5);
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log('🏃‍♂️ Endurance Test Completed');
  console.log(`⏱️  Total Duration: ${Math.round(duration)}s (${Math.round(duration / 60)} minutes)`);
  console.log(`🌍 Environment: ${data.environment}`);
  console.log(`🎯 Target URL: ${data.baseUrl}`);
  
  // Final system stability assessment
  console.log('📊 Final system stability assessment...');
  
  const httpHelper = new HttpHelper();
  const finalAssessment = [];
  
  // Test system state after endurance test
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    
    const frontendResponse = httpHelper.get(config.endpoints.frontend);
    const quotesResponse = httpHelper.get(config.endpoints.randomQuote);
    const healthResponse = httpHelper.get(config.endpoints.health);
    
    const totalTime = Date.now() - start;
    
    finalAssessment.push({
      iteration: i + 1,
      totalTime: totalTime,
      frontendTime: frontendResponse.timings.duration,
      quotesTime: quotesResponse.timings.duration,
      healthTime: healthResponse.timings.duration,
      success: frontendResponse.status < 400 && quotesResponse.status < 400 && healthResponse.status < 400
    });
    
    sleep(2);
  }
  
  const successfulFinal = finalAssessment.filter(a => a.success);
  const finalAvgResponseTime = successfulFinal.reduce((sum, a) => sum + a.totalTime, 0) / successfulFinal.length;
  
  console.log(`📊 Final Assessment Results (${successfulFinal.length}/${finalAssessment.length} successful):`);
  console.log(`   Average Total Time: ${Math.round(finalAvgResponseTime)}ms`);
  console.log(`   Average Frontend Time: ${Math.round(successfulFinal.reduce((sum, a) => sum + a.frontendTime, 0) / successfulFinal.length)}ms`);
  console.log(`   Average Quotes Time: ${Math.round(successfulFinal.reduce((sum, a) => sum + a.quotesTime, 0) / successfulFinal.length)}ms`);
  console.log(`   Average Health Time: ${Math.round(successfulFinal.reduce((sum, a) => sum + a.healthTime, 0) / successfulFinal.length)}ms`);
  
  // Compare with baseline
  if (data.baselineResponseTime > 0 && finalAvgResponseTime > 0) {
    const performanceChange = ((finalAvgResponseTime - data.baselineResponseTime) / data.baselineResponseTime * 100);
    
    console.log('📈 Endurance Performance Analysis:');
    console.log(`   Baseline Response Time: ${Math.round(data.baselineResponseTime)}ms`);
    console.log(`   Final Response Time: ${Math.round(finalAvgResponseTime)}ms`);
    console.log(`   Performance Change: ${performanceChange > 0 ? '+' : ''}${Math.round(performanceChange)}%`);
    
    if (Math.abs(performanceChange) < 10) {
      console.log('✅ Excellent stability - performance remained consistent');
    } else if (Math.abs(performanceChange) < 25) {
      console.log('✅ Good stability - minor performance variation');
    } else if (Math.abs(performanceChange) < 50) {
      console.log('⚠️  Moderate stability - noticeable performance change');
    } else {
      console.log('❌ Poor stability - significant performance degradation');
    }
  }
  
  // System recovery verification
  const finalHealthCheck = httpHelper.get(config.endpoints.health);
  
  if (ResponseValidator.isSuccessful(finalHealthCheck)) {
    console.log('✅ System is stable and healthy after endurance test');
  } else {
    console.log('⚠️  System health may be compromised after endurance test');
  }
  
  console.log('');
  console.log('📈 Key Endurance Test Metrics to Review:');
  console.log('  - Memory stability and leak detection');
  console.log('  - Performance degradation over time');
  console.log('  - Connection stability and recovery');
  console.log('  - Resource efficiency and cleanup');
  console.log('  - System recovery from errors');
  console.log('  - Response time variance trends');
  console.log('');
  console.log('🔍 Check system metrics for:');
  console.log('  - Memory usage patterns and growth');
  console.log('  - CPU utilization trends');
  console.log('  - Database connection pool health');
  console.log('  - Cache hit rates over time');
  console.log('  - Garbage collection frequency');
  console.log('  - Thread pool utilization');
  console.log('  - Disk space and I/O patterns');
}