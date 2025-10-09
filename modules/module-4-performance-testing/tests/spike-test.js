// Spike Test for Quote of the Day Application
// This test simulates sudden traffic spikes to test system resilience and auto-scaling

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

// Spike test configuration
export let options = {
  stages: config.scenarios.spike.stages,
  
  // Spike-specific thresholds - more lenient during spikes
  thresholds: {
    'http_req_duration': ['p(95)<8000', 'p(99)<15000'], // Allow higher response times during spikes
    'http_req_failed': ['rate<0.2'], // Allow up to 20% failure rate during spikes
    'http_reqs': ['rate>5'], // Expect at least 5 requests per second overall
    'custom_error_rate': ['rate<0.25'], // Allow up to 25% custom error rate during spikes
    'successful_requests': ['count>500'], // Expect at least 500 successful requests
    
    // Spike-specific metrics
    'spike_recovery_time': ['avg<30000'], // Recovery should be within 30 seconds
    'spike_survival_rate': ['rate>0.7'], // At least 70% of spike requests should succeed
  },
  
  ext: {
    loadimpact: {
      name: 'Quote App - Spike Test',
      projectID: 3599339,
    },
  },
  
  tags: {
    testType: 'spike',
    environment: config.environment,
    application: 'quote-app'
  },

  // Multiple spike scenarios
  scenarios: {
    // Main spike test - sudden traffic increase
    main_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.scenarios.spike.stages,
      gracefulRampDown: '2m',
      tags: { spikeType: 'main' },
    },
    
    // API-focused spike
    api_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },    // Normal load
        { duration: '10s', target: 50 },  // Sudden API spike
        { duration: '1m', target: 50 },   // Sustained spike
        { duration: '30s', target: 5 },   // Quick recovery
        { duration: '1m', target: 0 },    // Cool down
      ],
      gracefulRampDown: '30s',
      tags: { spikeType: 'api' },
      exec: 'apiSpikeScenario',
    },
    
    // Multiple mini-spikes
    mini_spikes: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '30s', target: 2 },   // Baseline
        { duration: '15s', target: 20 },  // Mini spike 1
        { duration: '30s', target: 5 },   // Recovery
        { duration: '15s', target: 25 },  // Mini spike 2
        { duration: '30s', target: 5 },   // Recovery
        { duration: '15s', target: 30 },  // Mini spike 3
        { duration: '30s', target: 2 },   // Final recovery
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
      tags: { spikeType: 'mini' },
      exec: 'miniSpikesScenario',
    },
    
    // Continuous monitoring during spikes
    spike_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10m',
      gracefulRampDown: '10s',
      tags: { spikeType: 'monitor' },
      exec: 'spikeMonitorScenario',
    },
  },
};

// Custom metrics for spike testing
import { Trend, Rate, Counter } from 'k6/metrics';

const spikeRecoveryTime = new Trend('spike_recovery_time');
const spikeSurvivalRate = new Rate('spike_survival_rate');
const spikeResponseTime = new Trend('spike_response_time');
const preSpikeBenchmark = new Trend('pre_spike_benchmark');
const postSpikeBenchmark = new Trend('post_spike_benchmark');

// Setup function
export function setup() {
  console.log('⚡ Starting Spike Test for Quote of the Day Application');
  console.log(`📊 Environment: ${config.environment}`);
  console.log(`🎯 Base URL: ${config.getBaseUrl()}`);
  console.log(`⏱️  Test Duration: ~10 minutes`);
  console.log(`📈 Spike Pattern: ${config.scenarios.spike.stages.map(s => s.target).join(' → ')} VUs`);
  console.log('🎯 Testing sudden traffic spikes and system resilience');
  
  // Establish pre-spike baseline
  const httpHelper = new HttpHelper();
  
  console.log('📊 Establishing pre-spike baseline...');
  
  const baselineMetrics = [];
  
  // Take multiple baseline measurements
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    const frontendResponse = httpHelper.get(config.endpoints.frontend);
    const apiResponse = httpHelper.get(config.endpoints.randomQuote);
    const healthResponse = httpHelper.get(config.endpoints.health);
    
    const totalTime = Date.now() - start;
    
    baselineMetrics.push({
      frontend: frontendResponse.timings.duration,
      api: apiResponse.timings.duration,
      health: healthResponse.timings.duration,
      total: totalTime,
      success: frontendResponse.status < 400 && apiResponse.status < 400 && healthResponse.status < 400
    });
    
    // Record pre-spike benchmarks
    preSpikeBenchmark.add(apiResponse.timings.duration);
    
    sleep(0.5);
  }
  
  const successfulBaselines = baselineMetrics.filter(m => m.success);
  const avgBaseline = successfulBaselines.reduce((acc, curr) => ({
    frontend: acc.frontend + curr.frontend / successfulBaselines.length,
    api: acc.api + curr.api / successfulBaselines.length,
    health: acc.health + curr.health / successfulBaselines.length,
    total: acc.total + curr.total / successfulBaselines.length
  }), { frontend: 0, api: 0, health: 0, total: 0 });
  
  console.log(`📊 Pre-Spike Baseline (${successfulBaselines.length}/10 successful):`);
  console.log(`   Frontend: ${Math.round(avgBaseline.frontend)}ms`);
  console.log(`   API: ${Math.round(avgBaseline.api)}ms`);
  console.log(`   Health: ${Math.round(avgBaseline.health)}ms`);
  console.log(`   Success Rate: ${Math.round(successfulBaselines.length / baselineMetrics.length * 100)}%`);
  
  return {
    startTime: Date.now(),
    environment: config.environment,
    baseUrl: config.getBaseUrl(),
    baseline: avgBaseline,
    baselineSuccessRate: successfulBaselines.length / baselineMetrics.length
  };
}

// Default scenario - Main spike test
export default function(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    const currentStage = getCurrentStage();
    
    try {
      // Adjust behavior based on current load stage
      if (currentStage === 'spike') {
        spikeBehavior(httpHelper);
      } else if (currentStage === 'recovery') {
        recoveryBehavior(httpHelper);
      } else {
        normalBehavior(httpHelper);
      }
    } catch (error) {
      ErrorHandler.logError(error, `Main spike VU ${__VU}`);
    }
  });
}

// API spike scenario
export function apiSpikeScenario(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      // Focus on API endpoints during spike
      const apiEndpoints = [
        config.endpoints.randomQuote,
        config.endpoints.quotes,
        config.endpoints.categories
      ];
      
      // Make multiple API calls rapidly
      for (let i = 0; i < TestDataHelper.generateRandomNumber(3, 6); i++) {
        const endpoint = TestDataHelper.getRandomItem(apiEndpoints);
        const start = Date.now();
        
        const response = httpHelper.get(endpoint);
        const responseTime = Date.now() - start;
        
        // Record spike-specific metrics
        spikeResponseTime.add(responseTime);
        spikeSurvivalRate.add(response.status < 500);
        
        check(response, {
          'api spike request processed': (r) => r.status !== 0,
          'api spike not server error': (r) => r.status < 500,
          'api spike response time reasonable': (r) => r.timings.duration < 10000,
        });
        
        SleepHelper.fixedSleep(0.1); // Minimal delay between API calls
      }
    } catch (error) {
      ErrorHandler.logError(error, 'API spike scenario');
    }
  });
}

// Mini spikes scenario
export function miniSpikesScenario(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      // Simulate user behavior during mini spikes
      const behavior = TestDataHelper.generateRandomNumber(1, 3);
      
      switch (behavior) {
        case 1:
          // Quick page visit
          const page = httpHelper.get(config.endpoints.frontend);
          spikeSurvivalRate.add(page.status < 500);
          break;
        case 2:
          // API call
          const api = httpHelper.get(config.endpoints.randomQuote);
          spikeSurvivalRate.add(api.status < 500);
          break;
        case 3:
          // Health check
          const health = httpHelper.get(config.endpoints.health);
          spikeSurvivalRate.add(health.status < 500);
          break;
      }
      
      SleepHelper.sleepWithJitter(0.5, 0.3);
    } catch (error) {
      ErrorHandler.logError(error, 'Mini spikes scenario');
    }
  });
}

// Spike monitoring scenario
export function spikeMonitorScenario(data) {
  const httpHelper = new HttpHelper();
  
  // Monitor system health and performance during spikes
  const start = Date.now();
  
  try {
    const healthResponse = httpHelper.get(config.endpoints.health);
    const apiResponse = httpHelper.get(config.endpoints.randomQuote);
    
    const responseTime = Date.now() - start;
    
    // Check if system is recovering (response time improving)
    if (responseTime < 2000) {
      spikeRecoveryTime.add(responseTime);
    }
    
    const healthCheck = check(healthResponse, {
      'spike monitor health accessible': (r) => r.status !== 0,
      'spike monitor health not 5xx': (r) => r.status < 500,
      'spike monitor health response time': (r) => r.timings.duration < 5000,
    });
    
    const apiCheck = check(apiResponse, {
      'spike monitor api accessible': (r) => r.status !== 0,
      'spike monitor api not 5xx': (r) => r.status < 500,
      'spike monitor api response time': (r) => r.timings.duration < 8000,
    });
    
    // Log critical issues during spikes
    if (!healthCheck || !apiCheck) {
      console.warn(`⚠️  System stress detected at ${new Date().toISOString()}`);
      console.warn(`   Health: ${healthResponse.status} (${Math.round(healthResponse.timings.duration)}ms)`);
      console.warn(`   API: ${apiResponse.status} (${Math.round(apiResponse.timings.duration)}ms)`);
    }
    
  } catch (error) {
    ErrorHandler.logError(error, 'Spike monitoring');
  }
  
  sleep(10); // Monitor every 10 seconds
}

// Determine current test stage based on time
function getCurrentStage() {
  const elapsed = (Date.now() - __ENV.TEST_START_TIME) / 1000;
  
  if (elapsed < 120) return 'normal';      // First 2 minutes
  if (elapsed < 150) return 'spike';       // 30-second spike
  if (elapsed < 270) return 'sustained';   // 2-minute sustained load
  if (elapsed < 330) return 'recovery';    // 1-minute recovery
  return 'normal';
}

// Normal behavior during baseline periods
function normalBehavior(httpHelper) {
  LoadPatternHelper.simulateUserBrowsing(httpHelper);
}

// Aggressive behavior during spike periods
function spikeBehavior(httpHelper) {
  // Rapid requests with minimal delays
  const requests = TestDataHelper.generateRandomNumber(4, 8);
  
  for (let i = 0; i < requests; i++) {
    const endpoint = TestDataHelper.getRandomItem([
      config.endpoints.frontend,
      config.endpoints.randomQuote,
      config.endpoints.quotes,
      config.endpoints.health
    ]);
    
    const start = Date.now();
    const response = httpHelper.get(endpoint);
    const responseTime = Date.now() - start;
    
    spikeResponseTime.add(responseTime);
    spikeSurvivalRate.add(response.status < 500);
    
    check(response, {
      'spike request completed': (r) => r.status !== 0,
      'spike request not timeout': (r) => r.timings.duration < 15000,
    });
    
    // Minimal delay during spike
    SleepHelper.fixedSleep(0.05);
  }
}

// Recovery behavior - testing system recovery
function recoveryBehavior(httpHelper) {
  // Gradual return to normal behavior
  const start = Date.now();
  
  const response = httpHelper.get(config.endpoints.randomQuote);
  const responseTime = Date.now() - start;
  
  // Track recovery metrics
  spikeRecoveryTime.add(responseTime);
  postSpikeBenchmark.add(response.timings.duration);
  
  const recoveryCheck = check(response, {
    'recovery request successful': (r) => r.status < 400,
    'recovery response time improving': (r) => r.timings.duration < 3000,
  });
  
  if (recoveryCheck) {
    spikeSurvivalRate.add(true);
  } else {
    spikeSurvivalRate.add(false);
  }
  
  SleepHelper.sleepWithJitter(1, 0.2);
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log('⚡ Spike Test Completed');
  console.log(`⏱️  Total Duration: ${Math.round(duration)}s`);
  console.log(`🌍 Environment: ${data.environment}`);
  console.log(`🎯 Target URL: ${data.baseUrl}`);
  
  // Post-spike analysis
  console.log('📊 Post-spike system analysis...');
  
  const httpHelper = new HttpHelper();
  const postSpikeMetrics = [];
  
  // Take post-spike measurements
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    try {
      const frontendResponse = httpHelper.get(config.endpoints.frontend);
      const apiResponse = httpHelper.get(config.endpoints.randomQuote);
      const healthResponse = httpHelper.get(config.endpoints.health);
      
      const totalTime = Date.now() - start;
      
      postSpikeMetrics.push({
        frontend: frontendResponse.timings.duration,
        api: apiResponse.timings.duration,
        health: healthResponse.timings.duration,
        total: totalTime,
        success: frontendResponse.status < 400 && apiResponse.status < 400 && healthResponse.status < 400
      });
      
      // Record post-spike benchmarks
      postSpikeBenchmark.add(apiResponse.timings.duration);
      
    } catch (error) {
      console.error(`Post-spike measurement ${i + 1} failed: ${error}`);
      postSpikeMetrics.push({
        frontend: 0,
        api: 0,
        health: 0,
        total: 0,
        success: false
      });
    }
    
    sleep(0.5);
  }
  
  const successfulPostSpike = postSpikeMetrics.filter(m => m.success);
  
  if (successfulPostSpike.length > 0) {
    const avgPostSpike = successfulPostSpike.reduce((acc, curr) => ({
      frontend: acc.frontend + curr.frontend / successfulPostSpike.length,
      api: acc.api + curr.api / successfulPostSpike.length,
      health: acc.health + curr.health / successfulPostSpike.length,
      total: acc.total + curr.total / successfulPostSpike.length
    }), { frontend: 0, api: 0, health: 0, total: 0 });
    
    console.log(`📊 Post-Spike Performance (${successfulPostSpike.length}/10 successful):`);
    console.log(`   Frontend: ${Math.round(avgPostSpike.frontend)}ms (baseline: ${Math.round(data.baseline.frontend)}ms)`);
    console.log(`   API: ${Math.round(avgPostSpike.api)}ms (baseline: ${Math.round(data.baseline.api)}ms)`);
    console.log(`   Health: ${Math.round(avgPostSpike.health)}ms (baseline: ${Math.round(data.baseline.health)}ms)`);
    
    // Calculate recovery metrics
    const recoveryRate = successfulPostSpike.length / postSpikeMetrics.length;
    const performanceRecovery = {
      frontend: ((avgPostSpike.frontend - data.baseline.frontend) / data.baseline.frontend * 100),
      api: ((avgPostSpike.api - data.baseline.api) / data.baseline.api * 100),
      health: ((avgPostSpike.health - data.baseline.health) / data.baseline.health * 100)
    };
    
    console.log(`📈 System Recovery Analysis:`);
    console.log(`   Success Rate: ${Math.round(recoveryRate * 100)}% (baseline: ${Math.round(data.baselineSuccessRate * 100)}%)`);
    console.log(`   Frontend Performance: ${performanceRecovery.frontend > 0 ? '+' : ''}${Math.round(performanceRecovery.frontend)}%`);
    console.log(`   API Performance: ${performanceRecovery.api > 0 ? '+' : ''}${Math.round(performanceRecovery.api)}%`);
    console.log(`   Health Performance: ${performanceRecovery.health > 0 ? '+' : ''}${Math.round(performanceRecovery.health)}%`);
    
    // Determine recovery status
    const maxDegradation = Math.max(performanceRecovery.frontend, performanceRecovery.api, performanceRecovery.health);
    const recoverySuccessful = recoveryRate >= data.baselineSuccessRate * 0.9 && maxDegradation < 100;
    
    if (recoverySuccessful) {
      console.log('✅ System recovered successfully from spike test');
    } else {
      console.log('⚠️  System recovery incomplete - performance degradation detected');
    }
    
  } else {
    console.log('❌ CRITICAL: System failed to recover from spike test');
  }
  
  console.log('');
  console.log('📈 Key Spike Test Metrics to Review:');
  console.log('  - Response time during spike vs baseline');
  console.log('  - Error rate during spike periods');
  console.log('  - System recovery time after spike');
  console.log('  - Auto-scaling behavior (if enabled)');
  console.log('  - Resource utilization spikes');
  console.log('  - Circuit breaker activation (if implemented)');
  console.log('');
  console.log('🔍 Check monitoring dashboards for:');
  console.log('  - CPU/Memory spikes');
  console.log('  - Database connection pools');
  console.log('  - Load balancer behavior');
  console.log('  - Cache hit rates during spikes');
}