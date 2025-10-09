// k6 Test Helper Functions
// This file contains utility functions used across all performance tests

import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import http from 'k6/http';
import { config } from './config.js';

// Custom metrics
export const errorRate = new Rate('custom_error_rate');
export const responseTime = new Trend('custom_response_time');
export const requestCount = new Counter('custom_request_count');
export const successfulRequests = new Counter('successful_requests');
export const failedRequests = new Counter('failed_requests');

// HTTP helper functions
export class HttpHelper {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl || config.getBaseUrl();
    this.defaultHeaders = config.http.headers;
  }

  // GET request with error handling and metrics
  get(endpoint, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      headers: this.defaultHeaders,
      timeout: config.http.timeout,
      ...params
    };

    config.logging.debug(`GET ${url}`);
    
    const response = http.get(url, options);
    this.recordMetrics(response);
    
    return response;
  }

  // POST request with error handling and metrics
  post(endpoint, payload = null, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      headers: this.defaultHeaders,
      timeout: config.http.timeout,
      ...params
    };

    config.logging.debug(`POST ${url}`);
    
    const response = http.post(url, JSON.stringify(payload), options);
    this.recordMetrics(response);
    
    return response;
  }

  // PUT request with error handling and metrics
  put(endpoint, payload = null, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      headers: this.defaultHeaders,
      timeout: config.http.timeout,
      ...params
    };

    config.logging.debug(`PUT ${url}`);
    
    const response = http.put(url, JSON.stringify(payload), options);
    this.recordMetrics(response);
    
    return response;
  }

  // DELETE request with error handling and metrics
  delete(endpoint, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      headers: this.defaultHeaders,
      timeout: config.http.timeout,
      ...params
    };

    config.logging.debug(`DELETE ${url}`);
    
    const response = http.del(url, null, options);
    this.recordMetrics(response);
    
    return response;
  }

  // Record custom metrics
  recordMetrics(response) {
    requestCount.add(1);
    responseTime.add(response.timings.duration);
    
    if (response.status >= 200 && response.status < 400) {
      successfulRequests.add(1);
      errorRate.add(false);
    } else {
      failedRequests.add(1);
      errorRate.add(true);
      config.logging.warn(`HTTP ${response.status}: ${response.url}`);
    }
  }
}

// Response validation helpers
export class ResponseValidator {
  // Check if response is successful
  static isSuccessful(response) {
    return response.status >= 200 && response.status < 400;
  }

  // Check if response has expected status
  static hasStatus(response, expectedStatus) {
    return check(response, {
      [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    });
  }

  // Check if response time is within threshold
  static responseTimeWithin(response, threshold) {
    return check(response, {
      [`response time < ${threshold}ms`]: (r) => r.timings.duration < threshold,
    });
  }

  // Check if response contains expected content
  static containsText(response, expectedText) {
    return check(response, {
      [`response contains "${expectedText}"`]: (r) => r.body.includes(expectedText),
    });
  }

  // Check if response is valid JSON
  static isValidJson(response) {
    return check(response, {
      'response is valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });
  }

  // Check if JSON response has expected structure
  static hasJsonStructure(response, expectedKeys) {
    return check(response, {
      'response has expected JSON structure': (r) => {
        try {
          const json = JSON.parse(r.body);
          return expectedKeys.every(key => json.hasOwnProperty(key));
        } catch (e) {
          return false;
        }
      },
    });
  }

  // Comprehensive response validation
  static validateResponse(response, options = {}) {
    const {
      expectedStatus = 200,
      maxResponseTime = 1000,
      expectedText = null,
      expectedKeys = null,
      requireJson = false
    } = options;

    const checks = {};
    
    // Status check
    checks[`status is ${expectedStatus}`] = (r) => r.status === expectedStatus;
    
    // Response time check
    checks[`response time < ${maxResponseTime}ms`] = (r) => r.timings.duration < maxResponseTime;
    
    // Content checks
    if (expectedText) {
      checks[`response contains "${expectedText}"`] = (r) => r.body.includes(expectedText);
    }
    
    // JSON validation
    if (requireJson || expectedKeys) {
      checks['response is valid JSON'] = (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      };
    }
    
    // JSON structure validation
    if (expectedKeys) {
      checks['response has expected JSON structure'] = (r) => {
        try {
          const json = JSON.parse(r.body);
          return expectedKeys.every(key => json.hasOwnProperty(key));
        } catch (e) {
          return false;
        }
      };
    }

    return check(response, checks);
  }
}

// Test data helpers
export class TestDataHelper {
  // Get random item from array
  static getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // Generate random string
  static generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Generate random number within range
  static generateRandomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate random email
  static generateRandomEmail() {
    const domains = ['example.com', 'test.com', 'demo.org'];
    const username = this.generateRandomString(8);
    const domain = this.getRandomItem(domains);
    return `${username}@${domain}`;
  }

  // Generate random quote data
  static generateRandomQuote() {
    return config.testData.generateRandomQuote();
  }

  // Generate large payload for volume testing
  static generateLargePayload(size = 1000) {
    return config.testData.generateLargePayload(size);
  }

  // Get sample quotes
  static getSampleQuotes() {
    return config.testData.sampleQuotes;
  }

  // Get random category
  static getRandomCategory() {
    return this.getRandomItem(config.testData.categories);
  }
}

// Sleep helpers
export class SleepHelper {
  // Random sleep within configured range
  static randomSleep() {
    sleep(config.sleep.random());
  }

  // Fixed sleep duration
  static fixedSleep(duration) {
    sleep(duration);
  }

  // Sleep with jitter to avoid thundering herd
  static sleepWithJitter(baseDuration, jitterPercent = 0.1) {
    const jitter = baseDuration * jitterPercent * (Math.random() - 0.5) * 2;
    sleep(baseDuration + jitter);
  }

  // Progressive sleep (increases over time)
  static progressiveSleep(iteration, baseDuration = 1, increment = 0.1) {
    const duration = baseDuration + (iteration * increment);
    sleep(Math.min(duration, 10)); // Cap at 10 seconds
  }
}

// Load pattern helpers
export class LoadPatternHelper {
  // Simulate user think time
  static userThinkTime() {
    SleepHelper.randomSleep();
  }

  // Simulate page load sequence
  static simulatePageLoad(httpHelper) {
    // Load main page
    const mainPage = httpHelper.get(config.endpoints.frontend);
    ResponseValidator.validateResponse(mainPage, { expectedStatus: 200 });
    
    SleepHelper.fixedSleep(1);
    
    // Load API data
    const apiData = httpHelper.get(config.endpoints.randomQuote);
    ResponseValidator.validateResponse(apiData, { 
      expectedStatus: 200, 
      requireJson: true,
      expectedKeys: ['text', 'author']
    });
    
    SleepHelper.randomSleep();
    
    return { mainPage, apiData };
  }

  // Simulate user browsing behavior
  static simulateUserBrowsing(httpHelper) {
    const actions = [
      () => httpHelper.get(config.endpoints.frontend),
      () => httpHelper.get(config.endpoints.randomQuote),
      () => httpHelper.get(config.endpoints.quotes),
      () => httpHelper.get(config.endpoints.categories),
      () => httpHelper.get(config.endpoints.health),
    ];

    // Perform 3-5 random actions
    const numActions = TestDataHelper.generateRandomNumber(3, 5);
    
    for (let i = 0; i < numActions; i++) {
      const action = TestDataHelper.getRandomItem(actions);
      const response = action();
      
      ResponseValidator.validateResponse(response, {
        expectedStatus: 200,
        maxResponseTime: 2000
      });
      
      SleepHelper.userThinkTime();
    }
  }

  // Simulate API-only usage
  static simulateApiUsage(httpHelper) {
    // Get random quote
    const randomQuote = httpHelper.get(config.endpoints.randomQuote);
    ResponseValidator.validateResponse(randomQuote, {
      expectedStatus: 200,
      requireJson: true,
      expectedKeys: ['text', 'author']
    });

    SleepHelper.fixedSleep(0.5);

    // Get all quotes
    const allQuotes = httpHelper.get(config.endpoints.quotes);
    ResponseValidator.validateResponse(allQuotes, {
      expectedStatus: 200,
      requireJson: true
    });

    SleepHelper.fixedSleep(0.5);

    // Health check
    const health = httpHelper.get(config.endpoints.health);
    ResponseValidator.validateResponse(health, {
      expectedStatus: 200
    });
  }
}

// Error handling helpers
export class ErrorHandler {
  // Log error with context
  static logError(error, context = '') {
    const message = context ? `${context}: ${error}` : error;
    config.logging.error(message);
  }

  // Handle HTTP errors
  static handleHttpError(response, context = '') {
    if (!ResponseValidator.isSuccessful(response)) {
      this.logError(`HTTP ${response.status} - ${response.statusText}`, context);
      return false;
    }
    return true;
  }

  // Retry mechanism
  static retry(fn, maxRetries = 3, delay = 1000) {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        return fn();
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          this.logError(`Failed after ${maxRetries} attempts: ${error}`);
          throw error;
        }
        
        config.logging.warn(`Attempt ${attempts} failed, retrying in ${delay}ms...`);
        sleep(delay / 1000);
      }
    }
  }
}

// Performance monitoring helpers
export class PerformanceMonitor {
  // Track custom timing
  static trackTiming(name, fn) {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;
    
    // Create custom metric if it doesn't exist
    if (!this.customTimings) {
      this.customTimings = {};
    }
    
    if (!this.customTimings[name]) {
      this.customTimings[name] = new Trend(`custom_timing_${name}`);
    }
    
    this.customTimings[name].add(duration);
    config.logging.debug(`${name} took ${duration}ms`);
    
    return result;
  }

  // Monitor memory usage (if available)
  static logMemoryUsage() {
    if (typeof __VU !== 'undefined') {
      config.logging.debug(`VU ${__VU}, Iteration ${__ITER}`);
    }
  }

  // Track iteration performance
  static trackIteration(iterationFn) {
    const start = Date.now();
    
    try {
      const result = iterationFn();
      const duration = Date.now() - start;
      
      config.logging.debug(`Iteration completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      config.logging.error(`Iteration failed after ${duration}ms: ${error}`);
      throw error;
    }
  }
}

// Export all helpers as default
export default {
  HttpHelper,
  ResponseValidator,
  TestDataHelper,
  SleepHelper,
  LoadPatternHelper,
  ErrorHandler,
  PerformanceMonitor,
  // Custom metrics
  errorRate,
  responseTime,
  requestCount,
  successfulRequests,
  failedRequests
};