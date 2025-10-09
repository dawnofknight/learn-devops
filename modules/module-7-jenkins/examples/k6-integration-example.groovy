// Jenkins Shared Library function for k6 Performance Testing Integration
// File: vars/runK6PerformanceTests.groovy

def call(Map config) {
    // Default configuration
    def defaultConfig = [
        testSuite: 'load',                    // load, stress, spike, ddos, all
        environment: 'staging',               // staging, production, local
        virtualUsers: 50,                     // Number of virtual users
        duration: '5m',                       // Test duration
        targetUrl: '',                        // Target URL (auto-detected if empty)
        k6Version: 'latest',                  // k6 Docker image version
        enableMonitoring: true,               // Enable InfluxDB/Grafana monitoring
        generateReports: true,                // Generate HTML reports
        failOnThresholdBreach: true,          // Fail pipeline on threshold breach
        slackChannel: '#performance-alerts',  // Slack notification channel
        resultsDir: 'k6-results'             // Results directory
    ]
    
    // Merge user config with defaults
    def finalConfig = defaultConfig + config
    
    pipeline {
        agent any
        
        environment {
            K6_VERSION = finalConfig.k6Version
            RESULTS_DIR = finalConfig.resultsDir
            TARGET_URL = finalConfig.targetUrl
            VIRTUAL_USERS = finalConfig.virtualUsers.toString()
            DURATION = finalConfig.duration
            TEST_SUITE = finalConfig.testSuite
            ENVIRONMENT = finalConfig.environment
        }
        
        stages {
            stage('Setup k6 Testing') {
                steps {
                    script {
                        echo "🔧 Setting up k6 Performance Testing..."
                        
                        // Create results directory
                        sh "mkdir -p ${env.RESULTS_DIR}"
                        
                        // Auto-detect target URL if not provided
                        if (!env.TARGET_URL || env.TARGET_URL.isEmpty()) {
                            env.TARGET_URL = detectTargetUrl(finalConfig.environment)
                        }
                        
                        echo "Target URL: ${env.TARGET_URL}"
                        echo "Test Suite: ${env.TEST_SUITE}"
                        echo "Virtual Users: ${env.VIRTUAL_USERS}"
                        echo "Duration: ${env.DURATION}"
                    }
                }
            }
            
            stage('Run k6 Performance Tests') {
                parallel {
                    stage('Load Testing') {
                        when {
                            anyOf {
                                expression { env.TEST_SUITE == 'all' }
                                expression { env.TEST_SUITE == 'load' }
                            }
                        }
                        steps {
                            script {
                                runK6Test('load', 'basic-load-test.js', finalConfig)
                            }
                        }
                    }
                    
                    stage('Stress Testing') {
                        when {
                            anyOf {
                                expression { env.TEST_SUITE == 'all' }
                                expression { env.TEST_SUITE == 'stress' }
                            }
                        }
                        steps {
                            script {
                                runK6Test('stress', 'stress-test.js', finalConfig)
                            }
                        }
                    }
                    
                    stage('Spike Testing') {
                        when {
                            anyOf {
                                expression { env.TEST_SUITE == 'all' }
                                expression { env.TEST_SUITE == 'spike' }
                            }
                        }
                        steps {
                            script {
                                runK6Test('spike', 'spike-test.js', finalConfig)
                            }
                        }
                    }
                    
                    stage('DDoS Simulation') {
                        when {
                            allOf {
                                anyOf {
                                    expression { env.TEST_SUITE == 'all' }
                                    expression { env.TEST_SUITE == 'ddos' }
                                }
                                not {
                                    expression { env.ENVIRONMENT == 'production' }
                                }
                            }
                        }
                        steps {
                            script {
                                echo "🛡️ Running DDoS Simulation (Non-Production Only)..."
                                runK6Test('ddos', 'ddos-simulation.js', finalConfig)
                            }
                        }
                    }
                }
            }
            
            stage('Generate Reports') {
                when {
                    expression { finalConfig.generateReports }
                }
                steps {
                    script {
                        generatePerformanceReports(finalConfig)
                    }
                }
            }
            
            stage('Analyze Results') {
                steps {
                    script {
                        analyzePerformanceResults(finalConfig)
                    }
                }
            }
        }
        
        post {
            always {
                archiveArtifacts artifacts: "${env.RESULTS_DIR}/**/*", allowEmptyArchive: true
                
                // Publish HTML reports
                if (finalConfig.generateReports) {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: env.RESULTS_DIR,
                        reportFiles: '*.html',
                        reportName: 'k6 Performance Report'
                    ])
                }
            }
            
            success {
                script {
                    if (finalConfig.slackChannel) {
                        sendSlackNotification('success', finalConfig)
                    }
                }
            }
            
            failure {
                script {
                    if (finalConfig.slackChannel) {
                        sendSlackNotification('failure', finalConfig)
                    }
                }
            }
        }
    }
}

// Helper function to detect target URL based on environment
def detectTargetUrl(environment) {
    switch(environment) {
        case 'production':
            return sh(
                script: 'kubectl get service quote-app-frontend -n production -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" 2>/dev/null || echo ""',
                returnStdout: true
            ).trim()
        case 'staging':
            return sh(
                script: 'kubectl get service quote-app-frontend -n staging -o jsonpath="{.status.loadBalancer.ingress[0].hostname}" 2>/dev/null || echo ""',
                returnStdout: true
            ).trim()
        case 'local':
            return 'http://host.docker.internal:3000'
        default:
            return 'http://localhost:3000'
    }
}

// Helper function to run individual k6 tests
def runK6Test(testType, scriptName, config) {
    try {
        echo "🚀 Running ${testType} test: ${scriptName}"
        
        def outputFile = "${env.RESULTS_DIR}/${testType}-test-${env.BUILD_NUMBER}.json"
        def influxOutput = config.enableMonitoring ? "--out influxdb=\${INFLUXDB_URL}" : ""
        
        sh """
            docker run --rm \
                -v \$(pwd)/modules/module-8-k6-performance:/scripts \
                -v \$(pwd)/${env.RESULTS_DIR}:/results \
                -e TARGET_URL=${env.TARGET_URL} \
                -e VIRTUAL_USERS=${env.VIRTUAL_USERS} \
                -e DURATION=${env.DURATION} \
                --network host \
                grafana/k6:${env.K6_VERSION} run \
                --out json=/results/${testType}-test-${env.BUILD_NUMBER}.json \
                ${influxOutput} \
                /scripts/tests/${testType}/${scriptName}
        """
        
        env."${testType.toUpperCase()}_TEST_RESULT" = 'PASSED'
        echo "✅ ${testType} test completed successfully"
        
    } catch (Exception e) {
        env."${testType.toUpperCase()}_TEST_RESULT" = 'FAILED'
        echo "❌ ${testType} test failed: ${e.message}"
        
        if (config.failOnThresholdBreach && testType != 'ddos') {
            throw e
        }
    }
}

// Helper function to generate performance reports
def generatePerformanceReports(config) {
    echo "📊 Generating Performance Reports..."
    
    sh """
        # Generate summary report
        cat > ${env.RESULTS_DIR}/performance-summary-${env.BUILD_NUMBER}.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>k6 Performance Test Summary - Build ${env.BUILD_NUMBER}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5; 
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            margin-bottom: 30px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
        }
        .metric-card { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            text-align: center;
            transition: transform 0.2s;
        }
        .metric-card:hover { transform: translateY(-2px); }
        .metric-card h3 { color: #667eea; margin-bottom: 10px; }
        .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .test-results { margin: 30px 0; }
        .test-result { 
            background: white; 
            margin: 15px 0; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 5px solid #ddd;
        }
        .passed { border-left-color: #28a745; }
        .failed { border-left-color: #dc3545; }
        .skipped { border-left-color: #ffc107; }
        .status-badge { 
            display: inline-block; 
            padding: 5px 15px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold; 
            font-size: 0.9em;
        }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-skipped { background: #ffc107; }
        .links { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            margin-top: 30px;
        }
        .links a { 
            display: inline-block; 
            margin: 10px 15px 10px 0; 
            padding: 12px 25px; 
            background: #667eea; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            transition: background 0.2s;
        }
        .links a:hover { background: #5a6fd8; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding: 20px; 
            color: #666; 
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 k6 Performance Test Summary</h1>
            <p><strong>Build:</strong> ${env.BUILD_NUMBER} | <strong>Environment:</strong> ${env.ENVIRONMENT}</p>
            <p><strong>Target:</strong> ${env.TARGET_URL} | <strong>Timestamp:</strong> \$(date)</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Virtual Users</h3>
                <div class="metric-value">${env.VIRTUAL_USERS}</div>
                <p>Concurrent users simulated</p>
            </div>
            <div class="metric-card">
                <h3>Test Duration</h3>
                <div class="metric-value">${env.DURATION}</div>
                <p>Total test execution time</p>
            </div>
            <div class="metric-card">
                <h3>Test Suite</h3>
                <div class="metric-value">${env.TEST_SUITE}</div>
                <p>Performance test type</p>
            </div>
            <div class="metric-card">
                <h3>Environment</h3>
                <div class="metric-value">${env.ENVIRONMENT}</div>
                <p>Target environment</p>
            </div>
        </div>
        
        <div class="test-results">
            <h2>📈 Test Results</h2>
            
            <div class="test-result \${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : env.LOAD_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>🔄 Load Testing 
                    <span class="status-badge status-\${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : env.LOAD_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.LOAD_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application performance under expected load conditions</p>
            </div>
            
            <div class="test-result \${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : env.STRESS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>💪 Stress Testing 
                    <span class="status-badge status-\${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : env.STRESS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.STRESS_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application behavior beyond normal operating capacity</p>
            </div>
            
            <div class="test-result \${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : env.SPIKE_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>⚡ Spike Testing 
                    <span class="status-badge status-\${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : env.SPIKE_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.SPIKE_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application response to sudden traffic increases</p>
            </div>
            
            <div class="test-result \${env.DDOS_TEST_RESULT == 'PASSED' ? 'passed' : env.DDOS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>🛡️ DDoS Simulation 
                    <span class="status-badge status-\${env.DDOS_TEST_RESULT == 'PASSED' ? 'passed' : env.DDOS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.DDOS_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Simulates distributed denial-of-service attack patterns</p>
            </div>
        </div>
        
        <div class="links">
            <h2>🔗 Quick Links</h2>
            <a href="${env.BUILD_URL}" target="_blank">📋 Jenkins Build</a>
            <a href="${env.BUILD_URL}k6_20Performance_20Report/" target="_blank">📊 Detailed Reports</a>
            <a href="\${env.GRAFANA_URL}/d/k6-performance" target="_blank">📈 Grafana Dashboard</a>
            <a href="${env.BUILD_URL}console" target="_blank">🔍 Build Logs</a>
        </div>
        
        <div class="footer">
            <p>Generated by Jenkins k6 Performance Testing Pipeline</p>
            <p>Build #${env.BUILD_NUMBER} - \$(date)</p>
        </div>
    </div>
</body>
</html>
EOF
    """
}

// Helper function to analyze performance results
def analyzePerformanceResults(config) {
    echo "🔍 Analyzing Performance Results..."
    
    def issues = []
    def recommendations = []
    
    // Check test results
    if (env.LOAD_TEST_RESULT == 'FAILED') {
        issues.add("Load testing failed - application may not handle expected traffic")
        recommendations.add("Review response times and error rates during load testing")
        recommendations.add("Check database connection pool configuration")
    }
    
    if (env.STRESS_TEST_RESULT == 'FAILED') {
        issues.add("Stress testing failed - system breaking point reached")
        recommendations.add("Implement auto-scaling policies")
        recommendations.add("Review resource limits and requests")
    }
    
    if (env.SPIKE_TEST_RESULT == 'FAILED') {
        issues.add("Spike testing failed - poor recovery from traffic spikes")
        recommendations.add("Implement circuit breakers and rate limiting")
        recommendations.add("Review caching strategies")
    }
    
    // Set environment variables for notifications
    env.PERFORMANCE_ISSUES = issues.join('; ')
    env.PERFORMANCE_RECOMMENDATIONS = recommendations.join('; ')
    
    if (issues.size() > 0) {
        echo "⚠️ Performance Issues Detected:"
        issues.each { issue -> echo "  - ${issue}" }
        echo "💡 Recommendations:"
        recommendations.each { rec -> echo "  - ${rec}" }
    } else {
        echo "✅ All performance tests passed successfully!"
    }
}

// Helper function to send Slack notifications
def sendSlackNotification(status, config) {
    def color = status == 'success' ? 'good' : 'danger'
    def emoji = status == 'success' ? '✅' : '❌'
    
    def message = """
    ${emoji} *k6 Performance Testing ${status.capitalize()}* - ${env.JOB_NAME} #${env.BUILD_NUMBER}
    
    *Environment:* ${env.ENVIRONMENT}
    *Target:* ${env.TARGET_URL}
    *Test Suite:* ${env.TEST_SUITE}
    *Virtual Users:* ${env.VIRTUAL_USERS}
    *Duration:* ${env.DURATION}
    
    *Results:*
    • Load: ${env.LOAD_TEST_RESULT ?: 'SKIPPED'}
    • Stress: ${env.STRESS_TEST_RESULT ?: 'SKIPPED'}
    • Spike: ${env.SPIKE_TEST_RESULT ?: 'SKIPPED'}
    • DDoS: ${env.DDOS_TEST_RESULT ?: 'SKIPPED'}
    
    *Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
    """
    
    if (status == 'failure' && env.PERFORMANCE_ISSUES) {
        message += "\n*Issues:* ${env.PERFORMANCE_ISSUES}"
        message += "\n*Recommendations:* ${env.PERFORMANCE_RECOMMENDATIONS}"
    }
    
    slackSend(
        channel: config.slackChannel,
        color: color,
        message: message
    )
}