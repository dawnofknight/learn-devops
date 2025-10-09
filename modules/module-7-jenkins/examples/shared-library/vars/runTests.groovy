#!/usr/bin/env groovy

/**
 * Run tests with comprehensive reporting
 * 
 * @param config Map containing test configuration
 *   - testType: Type of tests to run (unit, integration, e2e, all)
 *   - testCommand: Custom test command (optional)
 *   - testDir: Directory containing tests (default: current directory)
 *   - reportDir: Directory for test reports (default: 'test-reports')
 *   - coverageDir: Directory for coverage reports (default: 'coverage')
 *   - parallel: Run tests in parallel (default: true)
 *   - timeout: Test timeout in minutes (default: 30)
 *   - retries: Number of retries for flaky tests (default: 0)
 *   - publishResults: Publish test results (default: true)
 *   - publishCoverage: Publish coverage reports (default: true)
 *   - failFast: Fail fast on first test failure (default: false)
 *   - environment: Environment variables for tests
 *   - services: Services to start before tests (docker-compose services)
 *   - browsers: Browsers for e2e tests (chrome, firefox, safari)
 *   - tags: Test tags to include/exclude
 */
def call(Map config = [:]) {
    // Set defaults
    config.testType = config.testType ?: 'all'
    config.testDir = config.testDir ?: '.'
    config.reportDir = config.reportDir ?: 'test-reports'
    config.coverageDir = config.coverageDir ?: 'coverage'
    config.parallel = config.parallel != false
    config.timeout = config.timeout ?: 30
    config.retries = config.retries ?: 0
    config.publishResults = config.publishResults != false
    config.publishCoverage = config.publishCoverage != false
    config.failFast = config.failFast ?: false
    
    echo "🧪 Running ${config.testType} tests..."
    
    def testResults = [:]
    
    try {
        // Setup test environment
        setupTestEnvironment(config)
        
        // Start required services
        if (config.services) {
            startServices(config.services)
        }
        
        // Run tests based on type
        switch (config.testType.toLowerCase()) {
            case 'unit':
                testResults = runUnitTests(config)
                break
            case 'integration':
                testResults = runIntegrationTests(config)
                break
            case 'e2e':
            case 'end-to-end':
                testResults = runE2ETests(config)
                break
            case 'performance':
                testResults = runPerformanceTests(config)
                break
            case 'security':
                testResults = runSecurityTests(config)
                break
            case 'all':
                testResults = runAllTests(config)
                break
            default:
                testResults = runCustomTests(config)
                break
        }
        
        // Publish results
        if (config.publishResults) {
            publishTestResults(config, testResults)
        }
        
        // Publish coverage
        if (config.publishCoverage) {
            publishCoverageReports(config)
        }
        
        // Generate test summary
        def summary = generateTestSummary(testResults)
        echo summary
        
        echo "✅ Tests completed successfully!"
        
        return testResults
        
    } catch (Exception e) {
        echo "❌ Tests failed: ${e.getMessage()}"
        
        // Still try to publish results for failed tests
        if (config.publishResults) {
            try {
                publishTestResults(config, testResults)
            } catch (Exception publishError) {
                echo "⚠️ Failed to publish test results: ${publishError.getMessage()}"
            }
        }
        
        throw e
        
    } finally {
        // Cleanup
        cleanupTestEnvironment(config)
        
        // Stop services
        if (config.services) {
            stopServices(config.services)
        }
    }
}

def setupTestEnvironment(Map config) {
    echo "🔧 Setting up test environment..."
    
    // Create report directories
    sh """
        mkdir -p ${config.reportDir}
        mkdir -p ${config.coverageDir}
        mkdir -p ${config.reportDir}/unit
        mkdir -p ${config.reportDir}/integration
        mkdir -p ${config.reportDir}/e2e
        mkdir -p ${config.reportDir}/performance
        mkdir -p ${config.reportDir}/security
    """
    
    // Set environment variables
    if (config.environment) {
        config.environment.each { key, value ->
            env."${key}" = value
        }
    }
    
    // Set test-specific environment variables
    env.NODE_ENV = 'test'
    env.CI = 'true'
    env.JEST_JUNIT_OUTPUT_DIR = config.reportDir
    env.JEST_JUNIT_OUTPUT_NAME = 'junit.xml'
    
    echo "✅ Test environment setup complete"
}

def runUnitTests(Map config) {
    echo "🔬 Running unit tests..."
    
    def results = [:]
    
    timeout(time: config.timeout, unit: 'MINUTES') {
        try {
            def testCommand = config.testCommand ?: detectUnitTestCommand()
            
            if (config.parallel) {
                testCommand += " --maxWorkers=50%"
            }
            
            if (config.failFast) {
                testCommand += " --bail"
            }
            
            // Add coverage collection
            testCommand += " --coverage --coverageDirectory=${config.coverageDir}"
            testCommand += " --coverageReporters=text --coverageReporters=lcov --coverageReporters=html"
            
            // Add JUnit reporter
            testCommand += " --reporters=default --reporters=jest-junit"
            
            def exitCode = sh(
                script: testCommand,
                returnStatus: true
            )
            
            results.unit = [
                exitCode: exitCode,
                success: exitCode == 0,
                type: 'unit'
            ]
            
            if (exitCode != 0 && config.retries > 0) {
                results.unit = retryTests(config, testCommand, 'unit')
            }
            
        } catch (Exception e) {
            results.unit = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'unit'
            ]
        }
    }
    
    return results
}

def runIntegrationTests(Map config) {
    echo "🔗 Running integration tests..."
    
    def results = [:]
    
    timeout(time: config.timeout * 2, unit: 'MINUTES') {
        try {
            def testCommand = config.testCommand ?: detectIntegrationTestCommand()
            
            // Integration tests typically need more setup time
            testCommand += " --testTimeout=30000"
            
            if (config.tags) {
                testCommand += " --testNamePattern='${config.tags}'"
            }
            
            def exitCode = sh(
                script: testCommand,
                returnStatus: true
            )
            
            results.integration = [
                exitCode: exitCode,
                success: exitCode == 0,
                type: 'integration'
            ]
            
        } catch (Exception e) {
            results.integration = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'integration'
            ]
        }
    }
    
    return results
}

def runE2ETests(Map config) {
    echo "🌐 Running end-to-end tests..."
    
    def results = [:]
    
    timeout(time: config.timeout * 3, unit: 'MINUTES') {
        try {
            // Setup browsers
            setupBrowsers(config.browsers ?: ['chrome'])
            
            def testCommand = config.testCommand ?: detectE2ETestCommand()
            
            // Add browser configuration
            if (config.browsers) {
                config.browsers.each { browser ->
                    echo "Running E2E tests on ${browser}..."
                    def browserCommand = "${testCommand} --browser=${browser}"
                    
                    def exitCode = sh(
                        script: browserCommand,
                        returnStatus: true
                    )
                    
                    results["e2e_${browser}"] = [
                        exitCode: exitCode,
                        success: exitCode == 0,
                        type: 'e2e',
                        browser: browser
                    ]
                }
            } else {
                def exitCode = sh(
                    script: testCommand,
                    returnStatus: true
                )
                
                results.e2e = [
                    exitCode: exitCode,
                    success: exitCode == 0,
                    type: 'e2e'
                ]
            }
            
        } catch (Exception e) {
            results.e2e = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'e2e'
            ]
        }
    }
    
    return results
}

def runPerformanceTests(Map config) {
    echo "⚡ Running performance tests..."
    
    def results = [:]
    
    timeout(time: config.timeout * 2, unit: 'MINUTES') {
        try {
            def testCommand = config.testCommand ?: detectPerformanceTestCommand()
            
            def exitCode = sh(
                script: testCommand,
                returnStatus: true
            )
            
            results.performance = [
                exitCode: exitCode,
                success: exitCode == 0,
                type: 'performance'
            ]
            
            // Parse performance metrics if available
            if (fileExists('performance-results.json')) {
                def metrics = readJSON file: 'performance-results.json'
                results.performance.metrics = metrics
            }
            
        } catch (Exception e) {
            results.performance = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'performance'
            ]
        }
    }
    
    return results
}

def runSecurityTests(Map config) {
    echo "🔒 Running security tests..."
    
    def results = [:]
    
    timeout(time: config.timeout, unit: 'MINUTES') {
        try {
            def testCommand = config.testCommand ?: detectSecurityTestCommand()
            
            def exitCode = sh(
                script: testCommand,
                returnStatus: true
            )
            
            results.security = [
                exitCode: exitCode,
                success: exitCode == 0,
                type: 'security'
            ]
            
        } catch (Exception e) {
            results.security = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'security'
            ]
        }
    }
    
    return results
}

def runAllTests(Map config) {
    echo "🎯 Running all test suites..."
    
    def results = [:]
    
    if (config.parallel) {
        // Run test suites in parallel
        parallel(
            'Unit Tests': {
                results.putAll(runUnitTests(config))
            },
            'Integration Tests': {
                results.putAll(runIntegrationTests(config))
            },
            'E2E Tests': {
                results.putAll(runE2ETests(config))
            }
        )
    } else {
        // Run test suites sequentially
        results.putAll(runUnitTests(config))
        results.putAll(runIntegrationTests(config))
        results.putAll(runE2ETests(config))
    }
    
    return results
}

def runCustomTests(Map config) {
    echo "🔧 Running custom tests..."
    
    def results = [:]
    
    if (!config.testCommand) {
        error("Custom test type requires testCommand parameter")
    }
    
    timeout(time: config.timeout, unit: 'MINUTES') {
        try {
            def exitCode = sh(
                script: config.testCommand,
                returnStatus: true
            )
            
            results.custom = [
                exitCode: exitCode,
                success: exitCode == 0,
                type: 'custom'
            ]
            
        } catch (Exception e) {
            results.custom = [
                exitCode: 1,
                success: false,
                error: e.getMessage(),
                type: 'custom'
            ]
        }
    }
    
    return results
}

def retryTests(Map config, String testCommand, String testType) {
    echo "🔄 Retrying ${testType} tests (${config.retries} attempts remaining)..."
    
    for (int i = 1; i <= config.retries; i++) {
        echo "Retry attempt ${i}/${config.retries}"
        
        def exitCode = sh(
            script: testCommand,
            returnStatus: true
        )
        
        if (exitCode == 0) {
            return [
                exitCode: exitCode,
                success: true,
                type: testType,
                retryAttempt: i
            ]
        }
        
        if (i < config.retries) {
            sleep(10) // Wait before retry
        }
    }
    
    return [
        exitCode: 1,
        success: false,
        type: testType,
        retriesExhausted: true
    ]
}

def detectUnitTestCommand() {
    if (fileExists('package.json')) {
        def packageJson = readJSON file: 'package.json'
        if (packageJson.scripts?.test) {
            return 'npm test'
        }
        if (packageJson.scripts?.'test:unit') {
            return 'npm run test:unit'
        }
        return 'npm test'
    }
    
    if (fileExists('pom.xml')) {
        return 'mvn test'
    }
    
    if (fileExists('build.gradle')) {
        return './gradlew test'
    }
    
    if (fileExists('pytest.ini') || fileExists('setup.py')) {
        return 'pytest'
    }
    
    return 'echo "No test command detected"'
}

def detectIntegrationTestCommand() {
    if (fileExists('package.json')) {
        def packageJson = readJSON file: 'package.json'
        if (packageJson.scripts?.'test:integration') {
            return 'npm run test:integration'
        }
        return 'npm test -- --testPathPattern=integration'
    }
    
    if (fileExists('pom.xml')) {
        return 'mvn integration-test'
    }
    
    return 'echo "No integration test command detected"'
}

def detectE2ETestCommand() {
    if (fileExists('package.json')) {
        def packageJson = readJSON file: 'package.json'
        if (packageJson.scripts?.'test:e2e') {
            return 'npm run test:e2e'
        }
        if (packageJson.scripts?.cypress) {
            return 'npm run cypress'
        }
        if (packageJson.scripts?.playwright) {
            return 'npm run playwright'
        }
    }
    
    if (fileExists('cypress.json') || fileExists('cypress.config.js')) {
        return 'npx cypress run'
    }
    
    if (fileExists('playwright.config.js')) {
        return 'npx playwright test'
    }
    
    return 'echo "No E2E test command detected"'
}

def detectPerformanceTestCommand() {
    if (fileExists('package.json')) {
        def packageJson = readJSON file: 'package.json'
        if (packageJson.scripts?.'test:performance') {
            return 'npm run test:performance'
        }
    }
    
    return 'echo "No performance test command detected"'
}

def detectSecurityTestCommand() {
    if (fileExists('package.json')) {
        return 'npm audit --audit-level=high'
    }
    
    return 'echo "No security test command detected"'
}

def setupBrowsers(List browsers) {
    browsers.each { browser ->
        switch (browser.toLowerCase()) {
            case 'chrome':
                sh '''
                    # Install Chrome if not available
                    if ! command -v google-chrome &> /dev/null; then
                        echo "Installing Chrome..."
                        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
                        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
                        apt-get update && apt-get install -y google-chrome-stable
                    fi
                '''
                break
            case 'firefox':
                sh '''
                    # Install Firefox if not available
                    if ! command -v firefox &> /dev/null; then
                        echo "Installing Firefox..."
                        apt-get update && apt-get install -y firefox
                    fi
                '''
                break
        }
    }
}

def startServices(List services) {
    echo "🚀 Starting services: ${services.join(', ')}"
    
    services.each { service ->
        sh "docker-compose up -d ${service}"
    }
    
    // Wait for services to be ready
    sleep(10)
}

def stopServices(List services) {
    echo "🛑 Stopping services: ${services.join(', ')}"
    
    try {
        services.each { service ->
            sh "docker-compose stop ${service}"
        }
    } catch (Exception e) {
        echo "⚠️ Failed to stop some services: ${e.getMessage()}"
    }
}

def publishTestResults(Map config, Map results) {
    echo "📊 Publishing test results..."
    
    try {
        // Publish JUnit results
        if (fileExists("${config.reportDir}/**/*.xml")) {
            publishTestResults([
                testResultsPattern: "${config.reportDir}/**/*.xml",
                allowEmptyResults: true,
                keepLongStdio: true
            ])
        }
        
        // Archive test artifacts
        archiveArtifacts(
            artifacts: "${config.reportDir}/**/*",
            allowEmptyArchive: true,
            fingerprint: true
        )
        
        echo "✅ Test results published"
        
    } catch (Exception e) {
        echo "⚠️ Failed to publish test results: ${e.getMessage()}"
    }
}

def publishCoverageReports(Map config) {
    echo "📈 Publishing coverage reports..."
    
    try {
        if (fileExists("${config.coverageDir}/lcov.info")) {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: config.coverageDir,
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
        }
        
        echo "✅ Coverage reports published"
        
    } catch (Exception e) {
        echo "⚠️ Failed to publish coverage reports: ${e.getMessage()}"
    }
}

def generateTestSummary(Map results) {
    def summary = "\n📋 Test Summary:\n"
    summary += "=" * 50 + "\n"
    
    def totalTests = 0
    def passedTests = 0
    def failedTests = 0
    
    results.each { testType, result ->
        def status = result.success ? "✅ PASSED" : "❌ FAILED"
        summary += "${testType.toUpperCase()}: ${status}\n"
        
        if (result.error) {
            summary += "  Error: ${result.error}\n"
        }
        
        if (result.retryAttempt) {
            summary += "  Succeeded after ${result.retryAttempt} retries\n"
        }
        
        totalTests++
        if (result.success) {
            passedTests++
        } else {
            failedTests++
        }
    }
    
    summary += "=" * 50 + "\n"
    summary += "Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}\n"
    
    if (failedTests == 0) {
        summary += "🎉 All tests passed!\n"
    } else {
        summary += "⚠️ ${failedTests} test suite(s) failed\n"
    }
    
    return summary
}

def cleanupTestEnvironment(Map config) {
    echo "🧹 Cleaning up test environment..."
    
    try {
        // Clean up temporary files
        sh """
            # Remove temporary test files
            find . -name "*.tmp" -delete || true
            find . -name ".nyc_output" -type d -exec rm -rf {} + || true
            
            # Clean up browser artifacts
            rm -rf /tmp/.org.chromium.* || true
            rm -rf /tmp/playwright-* || true
        """
        
        echo "✅ Test environment cleaned up"
        
    } catch (Exception e) {
        echo "⚠️ Failed to clean up test environment: ${e.getMessage()}"
    }
}