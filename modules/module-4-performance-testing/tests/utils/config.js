// k6 Test Configuration
// This file contains configuration settings for all performance tests

export const config = {
  // Base URLs for different environments
  baseUrls: {
    local: 'http://localhost:3000',
    docker: 'http://host.docker.internal:3000',
    staging: 'https://staging.quote-app.example.com',
    production: 'https://quote-app.example.com',
  },

  // Get base URL from environment or default to local
  getBaseUrl() {
    const env = __ENV.ENVIRONMENT || 'local';
    return __ENV.BASE_URL || this.baseUrls[env] || this.baseUrls.local;
  },

  // API endpoints
  endpoints: {
    health: '/health',
    quotes: '/api/quotes',
    randomQuote: '/api/quotes/random',
    categories: '/api/quotes/categories',
    frontend: '/',
  },

  // Test scenarios configuration
  scenarios: {
    load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },  // Ramp up to 10 users
        { duration: '5m', target: 10 },  // Stay at 10 users
        { duration: '2m', target: 0 },   // Ramp down to 0 users
      ],
    },
    
    stress: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },   // Ramp up to 10 users
        { duration: '5m', target: 10 },   // Stay at 10 users
        { duration: '2m', target: 20 },   // Ramp up to 20 users
        { duration: '5m', target: 20 },   // Stay at 20 users
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '10m', target: 0 },   // Ramp down to 0 users
      ],
    },
    
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 100 },  // Stay at 100 users
        { duration: '10s', target: 0 },   // Drop to 0 users
      ],
    },
    
    volume: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
    },
    
    endurance: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30m',
    },
  },

  // Performance thresholds
  thresholds: {
    // HTTP request duration thresholds
    http_req_duration: {
      load: ['p(95)<500', 'p(99)<1000'],      // Load test: 95% < 500ms, 99% < 1s
      stress: ['p(95)<1000', 'p(99)<2000'],   // Stress test: 95% < 1s, 99% < 2s
      spike: ['p(95)<2000', 'p(99)<5000'],    // Spike test: 95% < 2s, 99% < 5s
      volume: ['p(95)<1000', 'p(99)<2000'],   // Volume test: 95% < 1s, 99% < 2s
      endurance: ['p(95)<500', 'p(99)<1000'], // Endurance: 95% < 500ms, 99% < 1s
    },

    // HTTP request failure rate thresholds
    http_req_failed: {
      load: ['rate<0.01'],      // Load test: < 1% error rate
      stress: ['rate<0.05'],    // Stress test: < 5% error rate
      spike: ['rate<0.10'],     // Spike test: < 10% error rate
      volume: ['rate<0.02'],    // Volume test: < 2% error rate
      endurance: ['rate<0.01'], // Endurance: < 1% error rate
    },

    // Request rate thresholds (requests per second)
    http_reqs: {
      load: ['rate>50'],        // Load test: > 50 RPS
      stress: ['rate>30'],      // Stress test: > 30 RPS (may degrade under stress)
      spike: ['rate>80'],       // Spike test: > 80 RPS during spike
      volume: ['rate>40'],      // Volume test: > 40 RPS
      endurance: ['rate>45'],   // Endurance: > 45 RPS sustained
    },
  },

  // Get thresholds for specific test type
  getThresholds(testType = 'load') {
    return {
      http_req_duration: this.thresholds.http_req_duration[testType] || this.thresholds.http_req_duration.load,
      http_req_failed: this.thresholds.http_req_failed[testType] || this.thresholds.http_req_failed.load,
      http_reqs: this.thresholds.http_reqs[testType] || this.thresholds.http_reqs.load,
    };
  },

  // HTTP request configuration
  http: {
    timeout: '30s',
    headers: {
      'User-Agent': 'k6-performance-test/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  // Test data configuration
  testData: {
    // Sample quotes for POST requests
    sampleQuotes: [
      {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        category: "motivation"
      },
      {
        text: "Life is what happens to you while you're busy making other plans.",
        author: "John Lennon",
        category: "life"
      },
      {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt",
        category: "dreams"
      },
      {
        text: "It is during our darkest moments that we must focus to see the light.",
        author: "Aristotle",
        category: "inspiration"
      },
      {
        text: "The way to get started is to quit talking and begin doing.",
        author: "Walt Disney",
        category: "action"
      }
    ],

    // Categories for filtering
    categories: ['motivation', 'life', 'dreams', 'inspiration', 'action', 'success', 'wisdom'],

    // Generate random quote data
    generateRandomQuote() {
      const quotes = this.sampleQuotes;
      const categories = this.categories;
      
      return {
        text: `Random quote ${Math.floor(Math.random() * 10000)}`,
        author: `Author ${Math.floor(Math.random() * 1000)}`,
        category: categories[Math.floor(Math.random() * categories.length)]
      };
    },

    // Generate large payload for volume testing
    generateLargePayload(size = 1000) {
      const baseQuote = this.sampleQuotes[0];
      return {
        ...baseQuote,
        text: baseQuote.text + ' '.repeat(size),
        metadata: {
          timestamp: new Date().toISOString(),
          testData: 'x'.repeat(size),
          id: Math.random().toString(36).substring(7),
        }
      };
    }
  },

  // Sleep configuration (think time between requests)
  sleep: {
    min: 1,    // Minimum sleep time in seconds
    max: 3,    // Maximum sleep time in seconds
    
    // Get random sleep time
    random() {
      return Math.random() * (this.max - this.min) + this.min;
    }
  },

  // Logging configuration
  logging: {
    level: __ENV.LOG_LEVEL || 'info', // debug, info, warn, error
    
    // Check if debug logging is enabled
    isDebug() {
      return this.level === 'debug';
    },
    
    // Log debug message
    debug(message) {
      if (this.isDebug()) {
        console.log(`[DEBUG] ${message}`);
      }
    },
    
    // Log info message
    info(message) {
      if (['debug', 'info'].includes(this.level)) {
        console.log(`[INFO] ${message}`);
      }
    },
    
    // Log warning message
    warn(message) {
      if (['debug', 'info', 'warn'].includes(this.level)) {
        console.log(`[WARN] ${message}`);
      }
    },
    
    // Log error message
    error(message) {
      console.log(`[ERROR] ${message}`);
    }
  },

  // Environment-specific overrides
  environments: {
    local: {
      // Local development overrides
      scenarios: {
        load: {
          executor: 'ramping-vus',
          stages: [
            { duration: '30s', target: 5 },
            { duration: '1m', target: 5 },
            { duration: '30s', target: 0 },
          ],
        }
      }
    },
    
    ci: {
      // CI/CD pipeline overrides (shorter tests)
      scenarios: {
        load: {
          executor: 'ramping-vus',
          stages: [
            { duration: '30s', target: 10 },
            { duration: '2m', target: 10 },
            { duration: '30s', target: 0 },
          ],
        }
      }
    },
    
    production: {
      // Production testing overrides (more conservative)
      scenarios: {
        load: {
          executor: 'ramping-vus',
          stages: [
            { duration: '5m', target: 20 },
            { duration: '10m', target: 20 },
            { duration: '5m', target: 0 },
          ],
        }
      }
    }
  },

  // Get environment-specific configuration
  getEnvironmentConfig() {
    const env = __ENV.ENVIRONMENT || 'local';
    return this.environments[env] || {};
  },

  // Merge configurations
  mergeConfig(baseConfig, overrides) {
    return Object.assign({}, baseConfig, overrides);
  }
};

// Export default configuration
export default config;