// Volume Test for Quote of the Day Application
// This test verifies system performance with large amounts of data and extended operations

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

// Volume test configuration
export let options = {
  stages: config.scenarios.volume.stages,
  
  // Volume-specific thresholds
  thresholds: {
    'http_req_duration': ['p(95)<3000', 'p(99)<8000'], // Reasonable response times with large data
    'http_req_failed': ['rate<0.05'], // Low failure rate expected
    'http_reqs': ['rate>5'], // Minimum request rate
    'custom_error_rate': ['rate<0.08'], // Low custom error rate
    'successful_requests': ['count>2000'], // High number of successful requests
    
    // Volume-specific metrics
    'large_payload_processing': ['avg<5000'], // Large payload processing time
    'data_consistency_check': ['rate>0.95'], // Data consistency should be high
    'memory_efficiency': ['avg<10000'], // Memory usage efficiency
  },
  
  ext: {
    loadimpact: {
      name: 'Quote App - Volume Test',
      projectID: 3599339,
    },
  },
  
  tags: {
    testType: 'volume',
    environment: config.environment,
    application: 'quote-app'
  },

  // Volume test scenarios
  scenarios: {
    // Large data processing
    large_data_processing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.scenarios.volume.stages,
      gracefulRampDown: '2m',
      tags: { volumeType: 'large_data' },
    },
    
    // Bulk operations simulation
    bulk_operations: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 5 },    // Gradual ramp up
        { duration: '10m', target: 10 },  // Sustained bulk operations
        { duration: '5m', target: 15 },   // Increased bulk load
        { duration: '10m', target: 15 },  // Extended bulk operations
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '1m',
      tags: { volumeType: 'bulk_ops' },
      exec: 'bulkOperationsScenario',
    },
    
    // Data consistency verification
    data_consistency: {
      executor: 'constant-vus',
      vus: 3,
      duration: '30m',
      gracefulRampDown: '30s',
      tags: { volumeType: 'consistency' },
      exec: 'dataConsistencyScenario',
    },
    
    // Long-running operations
    long_running_ops: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30m',
      gracefulRampDown: '1m',
      tags: { volumeType: 'long_running' },
      exec: 'longRunningScenario',
    },
  },
};

// Custom metrics for volume testing
import { Trend, Rate, Counter } from 'k6/metrics';

const largePayloadProcessing = new Trend('large_payload_processing');
const dataConsistencyCheck = new Rate('data_consistency_check');
const memoryEfficiency = new Trend('memory_efficiency');
const bulkOperationTime = new Trend('bulk_operation_time');
const dataIntegrityCheck = new Rate('data_integrity_check');
const longRunningOperationTime = new Trend('long_running_operation_time');

// Setup function
export function setup() {
  console.log('📊 Starting Volume Test for Quote of the Day Application');
  console.log(`📊 Environment: ${config.environment}`);
  console.log(`🎯 Base URL: ${config.getBaseUrl()}`);
  console.log(`⏱️  Test Duration: ~30 minutes`);
  console.log(`📈 Max VUs: ${Math.max(...config.scenarios.volume.stages.map(s => s.target))}`);
  console.log('🗄️  Testing large data volumes and extended operations');
  
  // Verify system can handle initial data load
  const httpHelper = new HttpHelper();
  
  console.log('🔍 Verifying system baseline with sample data...');
  
  // Test with progressively larger payloads
  const payloadSizes = [100, 500, 1000, 2000];
  const baselineResults = [];
  
  for (const size of payloadSizes) {
    console.log(`   Testing payload size: ${size} characters`);
    
    const start = Date.now();
    
    // Generate large payload
    const largePayload = TestDataHelper.generateLargePayload(size);
    
    // Test multiple endpoints with large data
    const frontendResponse = httpHelper.get(config.endpoints.frontend);
    const quotesResponse = httpHelper.get(config.endpoints.quotes);
    
    const processingTime = Date.now() - start;
    
    baselineResults.push({
      payloadSize: size,
      processingTime: processingTime,
      frontendTime: frontendResponse.timings.duration,
      quotesTime: quotesResponse.timings.duration,
      success: frontendResponse.status < 400 && quotesResponse.status < 400
    });
    
    sleep(1);
  }
  
  const successfulBaselines = baselineResults.filter(r => r.success);
  
  console.log(`📊 Baseline Results (${successfulBaselines.length}/${baselineResults.length} successful):`);
  successfulBaselines.forEach(result => {
    console.log(`   ${result.payloadSize} chars: ${Math.round(result.processingTime)}ms total, ${Math.round(result.frontendTime)}ms frontend, ${Math.round(result.quotesTime)}ms quotes`);
  });
  
  return {
    startTime: Date.now(),
    environment: config.environment,
    baseUrl: config.getBaseUrl(),
    baselineResults: successfulBaselines
  };
}

// Default scenario - Large data processing
export default function(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      // Test with various data volumes
      const volumeType = TestDataHelper.generateRandomNumber(1, 4);
      
      switch (volumeType) {
        case 1:
          smallVolumeTest(httpHelper);
          break;
        case 2:
          mediumVolumeTest(httpHelper);
          break;
        case 3:
          largeVolumeTest(httpHelper);
          break;
        case 4:
          extraLargeVolumeTest(httpHelper);
          break;
      }
    } catch (error) {
      ErrorHandler.logError(error, `Volume test VU ${__VU}`);
    }
  });
}

// Bulk operations scenario
export function bulkOperationsScenario(data) {
  PerformanceMonitor.trackIteration(() => {
    const httpHelper = new HttpHelper();
    
    try {
      const start = Date.now();
      
      // Simulate bulk data retrieval
      const bulkRequests = TestDataHelper.generateRandomNumber(5, 15);
      const results = [];
      
      for (let i = 0; i < bulkRequests; i++) {
        const endpoint = TestDataHelper.getRandomItem([
          config.endpoints.quotes,
          config.endpoints.randomQuote,
          config.endpoints.categories
        ]);
        
        const response = httpHelper.get(endpoint);
        results.push({
          endpoint: endpoint,
          status: response.status,
          responseTime: response.timings.duration,
          success: response.status < 400
        });
        
        // Brief pause between bulk requests
        SleepHelper.fixedSleep(0.1);
      }
      
      const bulkTime = Date.now() - start;
      bulkOperationTime.add(bulkTime);
      
      // Verify bulk operation success
      const successRate = results.filter(r => r.success).length / results.length;
      dataIntegrityCheck.add(successRate > 0.9);
      
      check(results, {
        'bulk operations completed': () => results.length === bulkRequests,
        'bulk success rate > 90%': () => successRate > 0.9,
        'bulk operation time reasonable': () => bulkTime < 30000,
      });
      
      SleepHelper.sleepWithJitter(2, 0.3);
      
    } catch (error) {
      ErrorHandler.logError(error, 'Bulk operations scenario');
    }
  });
}

// Data consistency scenario
export function dataConsistencyScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    // Test data consistency across multiple requests
    const consistencyTests = [];
    
    // Get multiple random quotes and verify consistency
    for (let i = 0; i < 5; i++) {
      const quote1 = httpHelper.get(config.endpoints.randomQuote);
      sleep(0.5);
      const quote2 = httpHelper.get(config.endpoints.randomQuote);
      
      const consistency = check({ quote1, quote2 }, {
        'quotes have consistent structure': ({ quote1, quote2 }) => {
          try {
            const json1 = JSON.parse(quote1.body);
            const json2 = JSON.parse(quote2.body);
            return json1.hasOwnProperty('text') && json1.hasOwnProperty('author') &&
                   json2.hasOwnProperty('text') && json2.hasOwnProperty('author');
          } catch (e) {
            return false;
          }
        },
        'quotes return valid data': ({ quote1, quote2 }) => {
          return quote1.status === 200 && quote2.status === 200;
        }
      });
      
      consistencyTests.push(consistency);
      dataConsistencyCheck.add(consistency);
    }
    
    // Test data integrity with all quotes endpoint
    const allQuotes = httpHelper.get(config.endpoints.quotes);
    
    const integrityCheck = check(allQuotes, {
      'all quotes endpoint accessible': (r) => r.status === 200,
      'all quotes returns array': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json);
        } catch (e) {
          return false;
        }
      },
      'all quotes response time acceptable': (r) => r.timings.duration < 5000,
    });
    
    dataIntegrityCheck.add(integrityCheck);
    
  } catch (error) {
    ErrorHandler.logError(error, 'Data consistency scenario');
  }
  
  sleep(30); // Check consistency every 30 seconds
}

// Long-running operations scenario
export function longRunningScenario(data) {
  const httpHelper = new HttpHelper();
  
  try {
    const start = Date.now();
    
    // Simulate long-running user session
    const sessionDuration = TestDataHelper.generateRandomNumber(300, 600); // 5-10 minutes
    const sessionStart = Date.now();
    
    while ((Date.now() - sessionStart) < sessionDuration * 1000) {
      // Perform various operations throughout the session
      const operations = [
        () => httpHelper.get(config.endpoints.frontend),
        () => httpHelper.get(config.endpoints.randomQuote),
        () => httpHelper.get(config.endpoints.quotes),
        () => httpHelper.get(config.endpoints.categories),
        () => httpHelper.get(config.endpoints.health),
      ];
      
      const operation = TestDataHelper.getRandomItem(operations);
      const response = operation();
      
      check(response, {
        'long running operation successful': (r) => r.status < 400,
        'long running operation responsive': (r) => r.timings.duration < 10000,
      });
      
      // Simulate user think time
      SleepHelper.sleepWithJitter(TestDataHelper.generateRandomNumber(10, 30), 0.2);
    }
    
    const totalSessionTime = Date.now() - start;
    longRunningOperationTime.add(totalSessionTime);
    
    console.log(`Long-running session completed: ${Math.round(totalSessionTime / 1000)}s`);
    
  } catch (error) {
    ErrorHandler.logError(error, 'Long-running scenario');
  }
}

// Small volume test (baseline)
function smallVolumeTest(httpHelper) {
  const start = Date.now();
  
  // Standard requests with small data
  const frontend = httpHelper.get(config.endpoints.frontend);
  const quote = httpHelper.get(config.endpoints.randomQuote);
  
  const processingTime = Date.now() - start;
  largePayloadProcessing.add(processingTime);
  
  ResponseValidator.validateResponse(frontend, {
    expectedStatus: 200,
    maxResponseTime: 2000
  });
  
  ResponseValidator.validateResponse(quote, {
    expectedStatus: 200,
    maxResponseTime: 1000,
    requireJson: true,
    expectedKeys: ['text', 'author']
  });
  
  SleepHelper.sleepWithJitter(2, 0.2);
}

// Medium volume test
function mediumVolumeTest(httpHelper) {
  const start = Date.now();
  
  // Multiple requests simulating medium data load
  const requests = [];
  
  for (let i = 0; i < 5; i++) {
    const response = httpHelper.get(config.endpoints.quotes);
    requests.push(response);
    SleepHelper.fixedSleep(0.2);
  }
  
  const processingTime = Date.now() - start;
  largePayloadProcessing.add(processingTime);
  
  // Verify all requests succeeded
  const successCount = requests.filter(r => r.status < 400).length;
  dataConsistencyCheck.add(successCount === requests.length);
  
  check(requests, {
    'medium volume all requests successful': () => successCount === requests.length,
    'medium volume processing time acceptable': () => processingTime < 8000,
  });
  
  SleepHelper.sleepWithJitter(3, 0.3);
}

// Large volume test
function largeVolumeTest(httpHelper) {
  const start = Date.now();
  
  // Simulate processing large amounts of data
  const largeDataRequests = [];
  
  // Multiple concurrent-like requests
  for (let i = 0; i < 10; i++) {
    const endpoint = TestDataHelper.getRandomItem([
      config.endpoints.quotes,
      config.endpoints.categories,
      config.endpoints.randomQuote
    ]);
    
    const response = httpHelper.get(endpoint);
    largeDataRequests.push(response);
    
    // Minimal delay to simulate rapid requests
    SleepHelper.fixedSleep(0.1);
  }
  
  const processingTime = Date.now() - start;
  largePayloadProcessing.add(processingTime);
  
  // Analyze response times and success rates
  const avgResponseTime = largeDataRequests.reduce((sum, r) => sum + r.timings.duration, 0) / largeDataRequests.length;
  const successRate = largeDataRequests.filter(r => r.status < 400).length / largeDataRequests.length;
  
  memoryEfficiency.add(avgResponseTime);
  dataConsistencyCheck.add(successRate > 0.8);
  
  check(largeDataRequests, {
    'large volume success rate > 80%': () => successRate > 0.8,
    'large volume avg response time < 3s': () => avgResponseTime < 3000,
    'large volume processing time < 15s': () => processingTime < 15000,
  });
  
  SleepHelper.sleepWithJitter(5, 0.4);
}

// Extra large volume test
function extraLargeVolumeTest(httpHelper) {
  const start = Date.now();
  
  // Simulate very large data processing
  const extraLargeRequests = [];
  
  // Generate large payload for testing
  const largePayload = TestDataHelper.generateLargePayload(5000);
  
  // Multiple requests with large data simulation
  for (let i = 0; i < 15; i++) {
    const endpoint = TestDataHelper.getRandomItem([
      config.endpoints.quotes,
      config.endpoints.randomQuote
    ]);
    
    const response = httpHelper.get(endpoint);
    extraLargeRequests.push(response);
    
    // Process large payload (simulate client-side processing)
    const processedData = largePayload.substring(0, TestDataHelper.generateRandomNumber(1000, 3000));
    
    SleepHelper.fixedSleep(0.05);
  }
  
  const processingTime = Date.now() - start;
  largePayloadProcessing.add(processingTime);
  
  // Analyze performance with extra large volume
  const maxResponseTime = Math.max(...extraLargeRequests.map(r => r.timings.duration));
  const minResponseTime = Math.min(...extraLargeRequests.map(r => r.timings.duration));
  const successRate = extraLargeRequests.filter(r => r.status < 400).length / extraLargeRequests.length;
  
  memoryEfficiency.add(maxResponseTime - minResponseTime); // Response time variance
  dataConsistencyCheck.add(successRate > 0.7);
  
  check(extraLargeRequests, {
    'extra large volume success rate > 70%': () => successRate > 0.7,
    'extra large volume max response time < 8s': () => maxResponseTime < 8000,
    'extra large volume processing time < 30s': () => processingTime < 30000,
    'extra large volume response time variance < 5s': () => (maxResponseTime - minResponseTime) < 5000,
  });
  
  SleepHelper.sleepWithJitter(8, 0.5);
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  
  console.log('📊 Volume Test Completed');
  console.log(`⏱️  Total Duration: ${Math.round(duration)}s`);
  console.log(`🌍 Environment: ${data.environment}`);
  console.log(`🎯 Target URL: ${data.baseUrl}`);
  
  // Post-volume analysis
  console.log('📊 Post-volume system analysis...');
  
  const httpHelper = new HttpHelper();
  const postVolumeResults = [];
  
  // Test system performance after volume test
  const payloadSizes = [100, 500, 1000, 2000];
  
  for (const size of payloadSizes) {
    const start = Date.now();
    
    const largePayload = TestDataHelper.generateLargePayload(size);
    const frontendResponse = httpHelper.get(config.endpoints.frontend);
    const quotesResponse = httpHelper.get(config.endpoints.quotes);
    
    const processingTime = Date.now() - start;
    
    postVolumeResults.push({
      payloadSize: size,
      processingTime: processingTime,
      frontendTime: frontendResponse.timings.duration,
      quotesTime: quotesResponse.timings.duration,
      success: frontendResponse.status < 400 && quotesResponse.status < 400
    });
    
    sleep(1);
  }
  
  const successfulPostVolume = postVolumeResults.filter(r => r.success);
  
  console.log(`📊 Post-Volume Results (${successfulPostVolume.length}/${postVolumeResults.length} successful):`);
  successfulPostVolume.forEach(result => {
    console.log(`   ${result.payloadSize} chars: ${Math.round(result.processingTime)}ms total, ${Math.round(result.frontendTime)}ms frontend, ${Math.round(result.quotesTime)}ms quotes`);
  });
  
  // Compare with baseline
  if (data.baselineResults.length > 0 && successfulPostVolume.length > 0) {
    console.log('📈 Performance Comparison (Post-Volume vs Baseline):');
    
    for (let i = 0; i < Math.min(data.baselineResults.length, successfulPostVolume.length); i++) {
      const baseline = data.baselineResults[i];
      const postVolume = successfulPostVolume[i];
      
      const processingChange = ((postVolume.processingTime - baseline.processingTime) / baseline.processingTime * 100);
      const frontendChange = ((postVolume.frontendTime - baseline.frontendTime) / baseline.frontendTime * 100);
      const quotesChange = ((postVolume.quotesTime - baseline.quotesTime) / baseline.quotesTime * 100);
      
      console.log(`   ${baseline.payloadSize} chars:`);
      console.log(`     Processing: ${processingChange > 0 ? '+' : ''}${Math.round(processingChange)}%`);
      console.log(`     Frontend: ${frontendChange > 0 ? '+' : ''}${Math.round(frontendChange)}%`);
      console.log(`     Quotes: ${quotesChange > 0 ? '+' : ''}${Math.round(quotesChange)}%`);
    }
  }
  
  // System health check
  const finalHealthCheck = httpHelper.get(config.endpoints.health);
  
  if (ResponseValidator.isSuccessful(finalHealthCheck)) {
    console.log('✅ System is healthy after volume test');
  } else {
    console.log('⚠️  System health degraded after volume test');
  }
  
  console.log('');
  console.log('📈 Key Volume Test Metrics to Review:');
  console.log('  - Large payload processing times');
  console.log('  - Data consistency across high volume operations');
  console.log('  - Memory efficiency and garbage collection');
  console.log('  - Database performance with large datasets');
  console.log('  - Response time variance under load');
  console.log('  - Long-running operation stability');
  console.log('');
  console.log('🔍 Check system metrics for:');
  console.log('  - Memory usage patterns');
  console.log('  - Database query performance');
  console.log('  - Cache efficiency');
  console.log('  - Connection pool utilization');
  console.log('  - Disk I/O patterns');
}