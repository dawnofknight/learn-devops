// Jenkins Shared Library for k6 Performance Testing
// File: vars/k6PerformanceTest.groovy
// Usage: k6PerformanceTest(config)

def call(Map config) {
    // Default configuration
    def defaultConfig = [
        testSuite: 'load',
        environment: 'staging',
        virtualUsers: 50,
        duration: '5m',
        targetUrl: '',
        k6Version: 'latest',
        resultsDir: 'k6-results',
        influxdbUrl: 'http://influxdb:8086/k6',
        grafanaUrl: 'http://grafana:3000',
        generateReport: true,
        failOnThresholds: true,
        slackChannel: '#devops-alerts',
        archiveResults: true,
        publishHtml: true
    ]
    
    // Merge user config with defaults
    def finalConfig = defaultConfig + config
    
    pipeline {
        agent any
        
        environment {
            K6_VERSION = "${finalConfig.k6Version}"
            RESULTS_DIR = "${finalConfig.resultsDir}"
            TARGET_URL = "${finalConfig.targetUrl}"
            VIRTUAL_USERS = "${finalConfig.virtualUsers}"
            DURATION = "${finalConfig.duration}"
            INFLUXDB_URL = "${finalConfig.influxdbUrl}"
            GRAFANA_URL = "${finalConfig.grafanaUrl}"
            SLACK_CHANNEL = "${finalConfig.slackChannel}"
        }
        
        stages {
            stage('Setup k6 Environment') {
                steps {
                    script {
                        setupK6Environment(finalConfig)
                    }
                }
            }
            
            stage('Run Performance Tests') {
                steps {
                    script {
                        runPerformanceTests(finalConfig)
                    }
                }
            }
            
            stage('Generate Reports') {
                when {
                    expression { finalConfig.generateReport }
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
                script {
                    cleanupK6Environment(finalConfig)
                    
                    if (finalConfig.archiveResults) {
                        archiveArtifacts artifacts: "${finalConfig.resultsDir}/**/*", allowEmptyArchive: true
                    }
                    
                    if (finalConfig.publishHtml) {
                        publishHTML([
                            allowMissing: false,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: finalConfig.resultsDir,
                            reportFiles: '*.html',
                            reportName: 'k6 Performance Report'
                        ])
                    }
                }
            }
            
            success {
                script {
                    sendNotification(finalConfig, 'success')
                }
            }
            
            failure {
                script {
                    sendNotification(finalConfig, 'failure')
                }
            }
            
            unstable {
                script {
                    sendNotification(finalConfig, 'unstable')
                }
            }
        }
    }
}

// Setup k6 testing environment
def setupK6Environment(config) {
    echo "🔧 Setting up k6 performance testing environment..."
    
    // Create results directory
    sh "mkdir -p ${config.resultsDir}"
    
    // Pull k6 Docker image
    sh "docker pull grafana/k6:${config.k6Version}"
    
    // Setup monitoring stack if needed
    if (config.setupMonitoring) {
        setupMonitoringStack(config)
    }
    
    // Validate target URL
    if (!config.targetUrl) {
        error("Target URL is required for performance testing")
    }
    
    // Test connectivity to target
    sh """
        curl -f --connect-timeout 10 --max-time 30 ${config.targetUrl}/health || \\
        curl -f --connect-timeout 10 --max-time 30 ${config.targetUrl} || \\
        echo "Warning: Could not verify target URL connectivity"
    """
    
    echo "✅ k6 environment setup completed"
}

// Run performance tests based on test suite
def runPerformanceTests(config) {
    echo "🚀 Running ${config.testSuite} performance tests..."
    
    def testScripts = getTestScripts(config.testSuite)
    def results = [:]
    
    // Run tests in parallel if multiple scripts
    if (testScripts.size() > 1) {
        def parallelTests = [:]
        
        testScripts.each { testType, scriptPath ->
            parallelTests[testType] = {
                results[testType] = runSingleK6Test(testType, scriptPath, config)
            }
        }
        
        parallel parallelTests
    } else {
        testScripts.each { testType, scriptPath ->
            results[testType] = runSingleK6Test(testType, scriptPath, config)
        }
    }
    
    // Store results for later analysis
    env.K6_TEST_RESULTS = groovy.json.JsonBuilder(results).toString()
    
    return results
}

// Run a single k6 test
def runSingleK6Test(testType, scriptPath, config) {
    def result = [:]
    def timestamp = new Date().format('yyyyMMdd-HHmmss')
    def outputFile = "${config.resultsDir}/${testType}-${timestamp}.json"
    
    try {
        echo "🔄 Running ${testType} test..."
        
        def k6Command = buildK6Command(testType, scriptPath, outputFile, config)
        
        sh k6Command
        
        result.status = 'PASSED'
        result.outputFile = outputFile
        result.testType = testType
        result.timestamp = timestamp
        
        echo "✅ ${testType} test completed successfully"
        
    } catch (Exception e) {
        result.status = 'FAILED'
        result.error = e.message
        result.testType = testType
        result.timestamp = timestamp
        
        echo "❌ ${testType} test failed: ${e.message}"
        
        if (config.failOnThresholds) {
            throw e
        }
    }
    
    return result
}

// Build k6 command based on configuration
def buildK6Command(testType, scriptPath, outputFile, config) {
    def command = """
        docker run --rm \\
            -v \$(pwd)/modules/module-8-k6-performance:/scripts \\
            -v \$(pwd)/${config.resultsDir}:/results \\
            -e TARGET_URL=${config.targetUrl} \\
            -e VIRTUAL_USERS=${config.virtualUsers} \\
            -e DURATION=${config.duration} \\
            -e TEST_TYPE=${testType} \\
            --network host \\
            grafana/k6:${config.k6Version} run \\
            --out json=/results/\$(basename ${outputFile})
    """
    
    // Add InfluxDB output if configured
    if (config.influxdbUrl) {
        command += " --out influxdb=${config.influxdbUrl}"
    }
    
    // Add custom options
    if (config.k6Options) {
        command += " ${config.k6Options}"
    }
    
    command += " /scripts/${scriptPath}"
    
    return command
}

// Get test scripts based on test suite
def getTestScripts(testSuite) {
    def scripts = [:]
    
    switch(testSuite.toLowerCase()) {
        case 'load':
            scripts['load'] = 'tests/load/basic-load-test.js'
            break
            
        case 'stress':
            scripts['stress'] = 'tests/stress/stress-test.js'
            break
            
        case 'spike':
            scripts['spike'] = 'tests/spike/spike-test.js'
            break
            
        case 'ddos':
            scripts['ddos'] = 'tests/ddos/ddos-simulation.js'
            break
            
        case 'sustained':
            scripts['sustained'] = 'tests/load/sustained-load-test.js'
            break
            
        case 'comprehensive':
            scripts['load'] = 'tests/load/basic-load-test.js'
            scripts['stress'] = 'tests/stress/stress-test.js'
            scripts['spike'] = 'tests/spike/spike-test.js'
            break
            
        case 'full':
            scripts['load'] = 'tests/load/basic-load-test.js'
            scripts['sustained'] = 'tests/load/sustained-load-test.js'
            scripts['stress'] = 'tests/stress/stress-test.js'
            scripts['spike'] = 'tests/spike/spike-test.js'
            break
            
        case 'security':
            scripts['ddos'] = 'tests/ddos/ddos-simulation.js'
            break
            
        default:
            scripts['load'] = 'tests/load/basic-load-test.js'
    }
    
    return scripts
}

// Generate performance reports
def generatePerformanceReports(config) {
    echo "📊 Generating performance reports..."
    
    // Parse test results
    def results = env.K6_TEST_RESULTS ? readJSON(text: env.K6_TEST_RESULTS) : [:]
    
    // Generate HTML report
    generateHtmlReport(results, config)
    
    // Generate JSON summary
    generateJsonSummary(results, config)
    
    // Generate CSV for trend analysis
    generateCsvReport(results, config)
    
    echo "✅ Performance reports generated"
}

// Generate HTML performance report
def generateHtmlReport(results, config) {
    def timestamp = new Date().format('yyyy-MM-dd HH:mm:ss')
    def buildInfo = "${env.JOB_NAME} #${env.BUILD_NUMBER}"
    
    def htmlContent = """
<!DOCTYPE html>
<html>
<head>
    <title>k6 Performance Test Report</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .config-section { background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .config-item { text-align: center; }
        .config-item h3 { margin: 0 0 10px 0; color: #495057; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .config-item .value { font-size: 1.8em; font-weight: bold; color: #667eea; }
        .results-section { background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .test-result { margin: 15px 0; padding: 20px; border-radius: 8px; border-left: 5px solid #ddd; }
        .test-result.passed { border-left-color: #28a745; background: #f8fff9; }
        .test-result.failed { border-left-color: #dc3545; background: #fff8f8; }
        .test-result h3 { margin: 0 0 10px 0; display: flex; justify-content: space-between; align-items: center; }
        .status-badge { padding: 6px 12px; border-radius: 20px; color: white; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric h4 { margin: 0 0 8px 0; color: #6c757d; font-size: 0.8em; }
        .metric .value { font-size: 1.4em; font-weight: bold; color: #495057; }
        .footer { text-align: center; margin-top: 40px; color: #6c757d; font-size: 0.9em; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendations h3 { color: #856404; margin-top: 0; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin: 5px 0; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 k6 Performance Test Report</h1>
            <p><strong>Build:</strong> ${buildInfo} | <strong>Generated:</strong> ${timestamp}</p>
        </div>
        
        <div class="config-section">
            <h2>📋 Test Configuration</h2>
            <div class="config-grid">
                <div class="config-item">
                    <h3>Test Suite</h3>
                    <div class="value">${config.testSuite}</div>
                </div>
                <div class="config-item">
                    <h3>Environment</h3>
                    <div class="value">${config.environment}</div>
                </div>
                <div class="config-item">
                    <h3>Virtual Users</h3>
                    <div class="value">${config.virtualUsers}</div>
                </div>
                <div class="config-item">
                    <h3>Duration</h3>
                    <div class="value">${config.duration}</div>
                </div>
                <div class="config-item">
                    <h3>Target URL</h3>
                    <div class="value" style="font-size: 1em; word-break: break-all;">${config.targetUrl}</div>
                </div>
            </div>
        </div>
        
        <div class="results-section">
            <h2>📈 Test Results</h2>
    """
    
    // Add test results
    results.each { testType, result ->
        def statusClass = result.status == 'PASSED' ? 'passed' : 'failed'
        def statusBadgeClass = result.status == 'PASSED' ? 'status-passed' : 'status-failed'
        
        htmlContent += """
            <div class="test-result ${statusClass}">
                <h3>
                    ${getTestTypeIcon(testType)} ${testType.capitalize()} Test
                    <span class="status-badge ${statusBadgeClass}">${result.status}</span>
                </h3>
        """
        
        if (result.status == 'FAILED' && result.error) {
            htmlContent += "<p><strong>Error:</strong> ${result.error}</p>"
        }
        
        if (result.outputFile) {
            htmlContent += "<p><strong>Results File:</strong> ${result.outputFile}</p>"
        }
        
        htmlContent += "</div>"
    }
    
    // Add recommendations
    htmlContent += """
            <div class="recommendations">
                <h3>💡 Recommendations</h3>
                <ul>
                    <li>Monitor response times and error rates in Grafana dashboard</li>
                    <li>Review detailed metrics in the JSON output files</li>
                    <li>Consider running tests during off-peak hours for production environments</li>
                    <li>Set up alerts for performance degradation</li>
                    <li>Regularly update performance baselines</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by Jenkins k6 Shared Library</p>
            <p>Grafana Dashboard: <a href="${config.grafanaUrl}" target="_blank">${config.grafanaUrl}</a></p>
        </div>
    </div>
</body>
</html>
    """
    
    writeFile file: "${config.resultsDir}/performance-report.html", text: htmlContent
}

// Get test type icon
def getTestTypeIcon(testType) {
    switch(testType.toLowerCase()) {
        case 'load': return '🔄'
        case 'stress': return '💪'
        case 'spike': return '⚡'
        case 'ddos': return '🛡️'
        case 'sustained': return '⏱️'
        default: return '📊'
    }
}

// Generate JSON summary report
def generateJsonSummary(results, config) {
    def summary = [
        build: [
            job: env.JOB_NAME,
            number: env.BUILD_NUMBER,
            timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
            url: env.BUILD_URL
        ],
        configuration: config,
        results: results,
        status: results.values().any { it.status == 'FAILED' } ? 'FAILED' : 'PASSED'
    ]
    
    writeJSON file: "${config.resultsDir}/performance-summary.json", json: summary
}

// Generate CSV report for trend analysis
def generateCsvReport(results, config) {
    def csvContent = "timestamp,build_number,test_type,status,target_url,virtual_users,duration\n"
    def timestamp = new Date().format('yyyy-MM-dd HH:mm:ss')
    
    results.each { testType, result ->
        csvContent += "${timestamp},${env.BUILD_NUMBER},${testType},${result.status},${config.targetUrl},${config.virtualUsers},${config.duration}\n"
    }
    
    writeFile file: "${config.resultsDir}/performance-trends.csv", text: csvContent
}

// Analyze performance results
def analyzePerformanceResults(config) {
    echo "🔍 Analyzing performance results..."
    
    def results = env.K6_TEST_RESULTS ? readJSON(text: env.K6_TEST_RESULTS) : [:]
    def issues = []
    def recommendations = []
    
    // Check for failures
    results.each { testType, result ->
        if (result.status == 'FAILED') {
            issues.add("${testType} test failed")
        }
    }
    
    // Generate recommendations based on results
    if (issues.size() > 0) {
        recommendations.add("Investigate failed tests and review error logs")
        recommendations.add("Check system resources during test execution")
        recommendations.add("Consider reducing load or increasing system capacity")
    } else {
        recommendations.add("All tests passed - consider increasing load for stress testing")
        recommendations.add("Monitor trends over time to detect performance degradation")
    }
    
    // Set build status based on results
    if (issues.size() > 0) {
        if (config.failOnThresholds) {
            currentBuild.result = 'FAILURE'
            error("Performance tests failed: ${issues.join(', ')}")
        } else {
            currentBuild.result = 'UNSTABLE'
            echo "⚠️ Performance issues detected but not failing build: ${issues.join(', ')}"
        }
    } else {
        echo "✅ All performance tests passed successfully!"
    }
    
    // Store analysis results
    env.PERFORMANCE_ISSUES = issues.join(', ')
    env.PERFORMANCE_RECOMMENDATIONS = recommendations.join('; ')
}

// Setup monitoring stack
def setupMonitoringStack(config) {
    echo "🔧 Setting up monitoring stack..."
    
    try {
        sh """
            cd modules/module-8-k6-performance
            docker-compose up -d influxdb grafana prometheus
            sleep 30
        """
        echo "✅ Monitoring stack started"
    } catch (Exception e) {
        echo "⚠️ Could not start monitoring stack: ${e.message}"
    }
}

// Cleanup k6 environment
def cleanupK6Environment(config) {
    echo "🧹 Cleaning up k6 environment..."
    
    try {
        // Stop monitoring stack if it was started
        if (config.setupMonitoring) {
            sh """
                cd modules/module-8-k6-performance
                docker-compose down
            """
        }
        
        // Clean up Docker images if requested
        if (config.cleanupImages) {
            sh "docker rmi grafana/k6:${config.k6Version} || true"
        }
        
        // Clean up temporary files
        sh "find ${config.resultsDir} -name '*.tmp' -delete || true"
        
        echo "✅ Cleanup completed"
    } catch (Exception e) {
        echo "⚠️ Cleanup warning: ${e.message}"
    }
}

// Send notification
def sendNotification(config, status) {
    if (!config.slackChannel) {
        return
    }
    
    def color = status == 'success' ? 'good' : status == 'failure' ? 'danger' : 'warning'
    def emoji = status == 'success' ? '✅' : status == 'failure' ? '❌' : '⚠️'
    
    def results = env.K6_TEST_RESULTS ? readJSON(text: env.K6_TEST_RESULTS) : [:]
    def resultsSummary = results.collect { testType, result -> 
        "${testType}: ${result.status}" 
    }.join(', ')
    
    def message = """
    ${emoji} *k6 Performance Test ${status.capitalize()}*
    
    *Job:* ${env.JOB_NAME} #${env.BUILD_NUMBER}
    *Test Suite:* ${config.testSuite}
    *Environment:* ${config.environment}
    *Target:* ${config.targetUrl}
    
    *Results:* ${resultsSummary ?: 'No tests run'}
    
    *Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
    """
    
    try {
        slackSend(
            channel: config.slackChannel,
            color: color,
            message: message
        )
    } catch (Exception e) {
        echo "⚠️ Could not send Slack notification: ${e.message}"
    }
}

// Return the main function for pipeline usage
return this