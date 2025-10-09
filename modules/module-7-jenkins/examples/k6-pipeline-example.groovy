// Complete Jenkins Pipeline Example with k6 Performance Testing Integration
// This example shows how to integrate k6 performance testing into a typical CI/CD pipeline

pipeline {
    agent any
    
    environment {
        // Application settings
        APP_NAME = 'quote-app'
        DOCKER_REGISTRY = 'your-registry.com'
        DOCKER_REPO = "${DOCKER_REGISTRY}/${APP_NAME}"
        
        // k6 Performance Testing
        K6_VERSION = 'latest'
        PERFORMANCE_RESULTS_DIR = 'performance-results'
        
        // Monitoring
        INFLUXDB_URL = 'http://influxdb:8086/k6'
        GRAFANA_URL = 'http://grafana:3000'
        
        // Notification
        SLACK_CHANNEL = '#devops-alerts'
        
        // Environment URLs
        STAGING_URL = 'https://staging.yourapp.com'
        PRODUCTION_URL = 'https://yourapp.com'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
    }
    
    parameters {
        choice(
            name: 'DEPLOYMENT_STRATEGY',
            choices: ['rolling', 'blue-green', 'canary'],
            description: 'Deployment strategy to use'
        )
        choice(
            name: 'PERFORMANCE_TEST_SUITE',
            choices: ['load', 'stress', 'spike', 'all', 'none'],
            description: 'Performance test suite to run'
        )
        string(
            name: 'VIRTUAL_USERS',
            defaultValue: '50',
            description: 'Number of virtual users for performance testing'
        )
        string(
            name: 'TEST_DURATION',
            defaultValue: '5m',
            description: 'Duration of performance tests'
        )
        booleanParam(
            name: 'SKIP_PERFORMANCE_TESTS',
            defaultValue: false,
            description: 'Skip performance testing'
        )
        booleanParam(
            name: 'FAIL_ON_PERFORMANCE_ISSUES',
            defaultValue: true,
            description: 'Fail pipeline on performance threshold breaches'
        )
    }
    
    stages {
        stage('Checkout & Setup') {
            steps {
                script {
                    echo "🔄 Checking out code and setting up environment..."
                    
                    // Checkout code
                    checkout scm
                    
                    // Set build information
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    
                    env.BUILD_VERSION = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                    env.IMAGE_TAG = "${env.BUILD_VERSION}"
                    
                    // Create results directory
                    sh "mkdir -p ${env.PERFORMANCE_RESULTS_DIR}"
                    
                    echo "Build Version: ${env.BUILD_VERSION}"
                    echo "Image Tag: ${env.IMAGE_TAG}"
                }
            }
        }
        
        stage('Code Quality & Security') {
            parallel {
                stage('Backend Linting') {
                    steps {
                        script {
                            echo "🔍 Running backend linting..."
                            sh '''
                                cd backend
                                npm ci
                                npm run lint
                            '''
                        }
                    }
                }
                
                stage('Frontend Linting') {
                    steps {
                        script {
                            echo "🔍 Running frontend linting..."
                            sh '''
                                cd frontend
                                npm ci
                                npm run lint
                            '''
                        }
                    }
                }
                
                stage('Security Audit') {
                    steps {
                        script {
                            echo "🔒 Running security audit..."
                            sh '''
                                cd backend && npm audit --audit-level=high
                                cd ../frontend && npm audit --audit-level=high
                            '''
                        }
                    }
                }
            }
        }
        
        stage('Testing') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        script {
                            echo "🧪 Running backend tests..."
                            sh '''
                                cd backend
                                npm run test:unit
                                npm run test:integration
                            '''
                        }
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'backend/test-results.xml'
                            publishCoverage adapters: [
                                istanbulCoberturaAdapter('backend/coverage/cobertura-coverage.xml')
                            ]
                        }
                    }
                }
                
                stage('Frontend Tests') {
                    steps {
                        script {
                            echo "🧪 Running frontend tests..."
                            sh '''
                                cd frontend
                                npm run test:unit
                                npm run test:e2e
                            '''
                        }
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'frontend/test-results.xml'
                            publishCoverage adapters: [
                                istanbulCoberturaAdapter('frontend/coverage/cobertura-coverage.xml')
                            ]
                        }
                    }
                }
            }
        }
        
        stage('Build & Package') {
            parallel {
                stage('Backend Build') {
                    steps {
                        script {
                            echo "🏗️ Building backend Docker image..."
                            sh """
                                docker build -t ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG} ./backend
                                docker tag ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG} ${env.DOCKER_REPO}-backend:latest
                            """
                        }
                    }
                }
                
                stage('Frontend Build') {
                    steps {
                        script {
                            echo "🏗️ Building frontend Docker image..."
                            sh """
                                docker build -t ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG} ./frontend
                                docker tag ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG} ${env.DOCKER_REPO}-frontend:latest
                            """
                        }
                    }
                }
            }
        }
        
        stage('Security Scanning') {
            parallel {
                stage('Container Security Scan') {
                    steps {
                        script {
                            echo "🔒 Scanning Docker images for vulnerabilities..."
                            sh """
                                # Install Trivy if not available
                                which trivy || (
                                    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                                )
                                
                                # Scan backend image
                                trivy image --format json --output trivy-backend-report.json ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG}
                                
                                # Scan frontend image
                                trivy image --format json --output trivy-frontend-report.json ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG}
                            """
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'trivy-*-report.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('Push Images') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
            }
            steps {
                script {
                    echo "📦 Pushing Docker images to registry..."
                    withCredentials([usernamePassword(credentialsId: 'docker-registry-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        sh """
                            echo \$DOCKER_PASS | docker login ${env.DOCKER_REGISTRY} -u \$DOCKER_USER --password-stdin
                            docker push ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG}
                            docker push ${env.DOCKER_REPO}-backend:latest
                            docker push ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG}
                            docker push ${env.DOCKER_REPO}-frontend:latest
                        """
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
            }
            steps {
                script {
                    echo "🚀 Deploying to staging environment..."
                    
                    // Update Kubernetes manifests
                    sh """
                        # Update image tags in Kubernetes manifests
                        sed -i 's|image: .*backend:.*|image: ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG}|g' k8s/staging/backend-deployment.yaml
                        sed -i 's|image: .*frontend:.*|image: ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG}|g' k8s/staging/frontend-deployment.yaml
                        
                        # Apply Kubernetes manifests
                        kubectl apply -f k8s/staging/ --namespace=staging
                        
                        # Wait for deployment to be ready
                        kubectl rollout status deployment/quote-app-backend -n staging --timeout=300s
                        kubectl rollout status deployment/quote-app-frontend -n staging --timeout=300s
                    """
                    
                    // Run smoke tests
                    echo "🧪 Running staging smoke tests..."
                    sh """
                        # Wait for service to be ready
                        sleep 30
                        
                        # Basic health check
                        curl -f ${env.STAGING_URL}/api/health || exit 1
                        curl -f ${env.STAGING_URL}/api/quotes | jq '.length' || exit 1
                    """
                }
            }
        }
        
        stage('Performance Testing - Staging') {
            when {
                allOf {
                    anyOf {
                        branch 'develop'
                        branch 'main'
                    }
                    not {
                        params.SKIP_PERFORMANCE_TESTS
                    }
                }
            }
            parallel {
                stage('Load Testing') {
                    when {
                        anyOf {
                            expression { params.PERFORMANCE_TEST_SUITE == 'all' }
                            expression { params.PERFORMANCE_TEST_SUITE == 'load' }
                        }
                    }
                    steps {
                        script {
                            echo "🔄 Running load testing against staging..."
                            runK6PerformanceTest(
                                testType: 'load',
                                scriptName: 'basic-load-test.js',
                                targetUrl: env.STAGING_URL,
                                virtualUsers: params.VIRTUAL_USERS,
                                duration: params.TEST_DURATION,
                                environment: 'staging'
                            )
                        }
                    }
                }
                
                stage('Stress Testing') {
                    when {
                        anyOf {
                            expression { params.PERFORMANCE_TEST_SUITE == 'all' }
                            expression { params.PERFORMANCE_TEST_SUITE == 'stress' }
                        }
                    }
                    steps {
                        script {
                            echo "💪 Running stress testing against staging..."
                            runK6PerformanceTest(
                                testType: 'stress',
                                scriptName: 'stress-test.js',
                                targetUrl: env.STAGING_URL,
                                virtualUsers: params.VIRTUAL_USERS,
                                duration: params.TEST_DURATION,
                                environment: 'staging'
                            )
                        }
                    }
                }
                
                stage('Spike Testing') {
                    when {
                        anyOf {
                            expression { params.PERFORMANCE_TEST_SUITE == 'all' }
                            expression { params.PERFORMANCE_TEST_SUITE == 'spike' }
                        }
                    }
                    steps {
                        script {
                            echo "⚡ Running spike testing against staging..."
                            runK6PerformanceTest(
                                testType: 'spike',
                                scriptName: 'spike-test.js',
                                targetUrl: env.STAGING_URL,
                                virtualUsers: params.VIRTUAL_USERS,
                                duration: params.TEST_DURATION,
                                environment: 'staging'
                            )
                        }
                    }
                }
            }
        }
        
        stage('Performance Analysis') {
            when {
                allOf {
                    anyOf {
                        branch 'develop'
                        branch 'main'
                    }
                    not {
                        params.SKIP_PERFORMANCE_TESTS
                    }
                }
            }
            steps {
                script {
                    echo "🔍 Analyzing performance test results..."
                    
                    // Generate performance report
                    generatePerformanceReport()
                    
                    // Analyze results and set quality gates
                    def performanceIssues = analyzePerformanceResults()
                    
                    if (performanceIssues.size() > 0 && params.FAIL_ON_PERFORMANCE_ISSUES) {
                        error("Performance quality gates failed: ${performanceIssues.join(', ')}")
                    }
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                allOf {
                    branch 'main'
                    not {
                        changeRequest()
                    }
                }
            }
            steps {
                script {
                    // Manual approval for production deployment
                    timeout(time: 10, unit: 'MINUTES') {
                        def deploymentApproved = input(
                            message: 'Deploy to Production?',
                            ok: 'Deploy',
                            parameters: [
                                choice(
                                    name: 'DEPLOYMENT_STRATEGY',
                                    choices: ['rolling', 'blue-green', 'canary'],
                                    description: 'Choose deployment strategy'
                                )
                            ]
                        )
                        
                        env.PROD_DEPLOYMENT_STRATEGY = deploymentApproved
                    }
                    
                    echo "🚀 Deploying to production using ${env.PROD_DEPLOYMENT_STRATEGY} strategy..."
                    
                    switch(env.PROD_DEPLOYMENT_STRATEGY) {
                        case 'rolling':
                            deployRolling('production')
                            break
                        case 'blue-green':
                            deployBlueGreen('production')
                            break
                        case 'canary':
                            deployCanary('production')
                            break
                        default:
                            error("Unknown deployment strategy: ${env.PROD_DEPLOYMENT_STRATEGY}")
                    }
                }
            }
        }
        
        stage('Production Performance Testing') {
            when {
                allOf {
                    branch 'main'
                    not {
                        params.SKIP_PERFORMANCE_TESTS
                    }
                    expression { params.PERFORMANCE_TEST_SUITE == 'load' || params.PERFORMANCE_TEST_SUITE == 'all' }
                }
            }
            steps {
                script {
                    echo "🔄 Running production load testing..."
                    
                    // Only run light load testing in production
                    runK6PerformanceTest(
                        testType: 'load',
                        scriptName: 'basic-load-test.js',
                        targetUrl: env.PRODUCTION_URL,
                        virtualUsers: '10', // Reduced load for production
                        duration: '2m',     // Shorter duration for production
                        environment: 'production'
                    )
                }
            }
        }
    }
    
    post {
        always {
            // Archive artifacts
            archiveArtifacts artifacts: "${env.PERFORMANCE_RESULTS_DIR}/**/*", allowEmptyArchive: true
            
            // Publish HTML reports
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: env.PERFORMANCE_RESULTS_DIR,
                reportFiles: '*.html',
                reportName: 'k6 Performance Report'
            ])
            
            // Clean up Docker images
            sh """
                docker rmi ${env.DOCKER_REPO}-backend:${env.IMAGE_TAG} || true
                docker rmi ${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG} || true
                docker system prune -f
            """
        }
        
        success {
            script {
                sendSlackNotification(
                    channel: env.SLACK_CHANNEL,
                    color: 'good',
                    message: """
                    ✅ *Pipeline Success* - ${env.JOB_NAME} #${env.BUILD_NUMBER}
                    
                    *Branch:* ${env.BRANCH_NAME}
                    *Commit:* ${env.GIT_COMMIT_SHORT}
                    *Build Version:* ${env.BUILD_VERSION}
                    
                    *Performance Tests:* ${params.SKIP_PERFORMANCE_TESTS ? 'Skipped' : 'Completed'}
                    *Deployment:* ${env.BRANCH_NAME == 'main' ? 'Production' : 'Staging'}
                    
                    *Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
                    """
                )
            }
        }
        
        failure {
            script {
                sendSlackNotification(
                    channel: env.SLACK_CHANNEL,
                    color: 'danger',
                    message: """
                    ❌ *Pipeline Failed* - ${env.JOB_NAME} #${env.BUILD_NUMBER}
                    
                    *Branch:* ${env.BRANCH_NAME}
                    *Commit:* ${env.GIT_COMMIT_SHORT}
                    *Stage:* ${env.STAGE_NAME}
                    
                    *Logs:* ${env.BUILD_URL}console
                    *Performance Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
                    """
                )
            }
        }
        
        unstable {
            script {
                sendSlackNotification(
                    channel: env.SLACK_CHANNEL,
                    color: 'warning',
                    message: """
                    ⚠️ *Pipeline Unstable* - ${env.JOB_NAME} #${env.BUILD_NUMBER}
                    
                    *Branch:* ${env.BRANCH_NAME}
                    *Commit:* ${env.GIT_COMMIT_SHORT}
                    *Issues:* Performance thresholds exceeded
                    
                    *Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
                    """
                )
            }
        }
    }
}

// Helper function to run k6 performance tests
def runK6PerformanceTest(Map config) {
    def outputFile = "${env.PERFORMANCE_RESULTS_DIR}/${config.testType}-test-${config.environment}-${env.BUILD_NUMBER}.json"
    
    try {
        sh """
            docker run --rm \
                -v \$(pwd)/modules/module-8-k6-performance:/scripts \
                -v \$(pwd)/${env.PERFORMANCE_RESULTS_DIR}:/results \
                -e TARGET_URL=${config.targetUrl} \
                -e VIRTUAL_USERS=${config.virtualUsers} \
                -e DURATION=${config.duration} \
                --network host \
                grafana/k6:${env.K6_VERSION} run \
                --out json=/results/${config.testType}-test-${config.environment}-${env.BUILD_NUMBER}.json \
                --out influxdb=${env.INFLUXDB_URL} \
                /scripts/tests/${config.testType}/${config.scriptName}
        """
        
        env."${config.testType.toUpperCase()}_TEST_RESULT" = 'PASSED'
        echo "✅ ${config.testType} test completed successfully"
        
    } catch (Exception e) {
        env."${config.testType.toUpperCase()}_TEST_RESULT" = 'FAILED'
        echo "❌ ${config.testType} test failed: ${e.message}"
        
        if (params.FAIL_ON_PERFORMANCE_ISSUES && config.environment != 'production') {
            throw e
        }
    }
}

// Helper function to generate performance report
def generatePerformanceReport() {
    sh """
        # Generate comprehensive performance report
        cat > ${env.PERFORMANCE_RESULTS_DIR}/performance-report-${env.BUILD_NUMBER}.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - Build ${env.BUILD_NUMBER}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; color: #667eea; }
        .test-results { margin: 30px 0; }
        .test-result { background: #f8f9fa; margin: 15px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #28a745; }
        .failed { border-left-color: #dc3545; }
        .status { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; font-size: 0.9em; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0; }
        .recommendations h3 { color: #856404; margin-top: 0; }
        .recommendations ul { margin: 10px 0; padding-left: 20px; }
        .recommendations li { margin: 5px 0; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Test Report</h1>
            <p><strong>Build:</strong> ${env.BUILD_NUMBER} | <strong>Branch:</strong> ${env.BRANCH_NAME} | <strong>Commit:</strong> ${env.GIT_COMMIT_SHORT}</p>
            <p><strong>Timestamp:</strong> \$(date) | <strong>Test Suite:</strong> ${params.PERFORMANCE_TEST_SUITE}</p>
        </div>
        
        <div class="metrics">
            <div class="metric">
                <h3>Virtual Users</h3>
                <div class="value">${params.VIRTUAL_USERS}</div>
            </div>
            <div class="metric">
                <h3>Test Duration</h3>
                <div class="value">${params.TEST_DURATION}</div>
            </div>
            <div class="metric">
                <h3>Environment</h3>
                <div class="value">${env.BRANCH_NAME == 'main' ? 'Production' : 'Staging'}</div>
            </div>
            <div class="metric">
                <h3>Strategy</h3>
                <div class="value">${params.DEPLOYMENT_STRATEGY}</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>📈 Test Results</h2>
            
            <div class="test-result \${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                <h3>🔄 Load Testing 
                    <span class="status status-\${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                        \${env.LOAD_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application performance under expected load conditions</p>
            </div>
            
            <div class="test-result \${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                <h3>💪 Stress Testing 
                    <span class="status status-\${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                        \${env.STRESS_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application behavior beyond normal operating capacity</p>
            </div>
            
            <div class="test-result \${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                <h3>⚡ Spike Testing 
                    <span class="status status-\${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : 'failed'}">
                        \${env.SPIKE_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
                <p>Tests application response to sudden traffic increases</p>
            </div>
        </div>
        
        <div class="recommendations">
            <h3>💡 Performance Recommendations</h3>
            <ul>
                <li>Monitor response times during peak traffic periods</li>
                <li>Implement auto-scaling policies based on CPU and memory usage</li>
                <li>Consider implementing caching strategies for frequently accessed data</li>
                <li>Review database query performance and indexing</li>
                <li>Set up alerting for performance degradation</li>
                <li>Regular performance testing in CI/CD pipeline</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin-top: 40px; color: #666;">
            <p>Generated by Jenkins k6 Performance Testing Pipeline</p>
            <p><a href="${env.BUILD_URL}" target="_blank">View Build Details</a> | 
               <a href="${env.GRAFANA_URL}/d/k6-performance" target="_blank">Grafana Dashboard</a></p>
        </div>
    </div>
</body>
</html>
EOF
    """
}

// Helper function to analyze performance results
def analyzePerformanceResults() {
    def issues = []
    
    if (env.LOAD_TEST_RESULT == 'FAILED') {
        issues.add('Load testing failed')
    }
    if (env.STRESS_TEST_RESULT == 'FAILED') {
        issues.add('Stress testing failed')
    }
    if (env.SPIKE_TEST_RESULT == 'FAILED') {
        issues.add('Spike testing failed')
    }
    
    return issues
}

// Helper function to send Slack notifications
def sendSlackNotification(Map config) {
    slackSend(
        channel: config.channel,
        color: config.color,
        message: config.message
    )
}

// Deployment strategy functions
def deployRolling(environment) {
    echo "🔄 Executing rolling deployment to ${environment}..."
    sh """
        kubectl set image deployment/quote-app-backend quote-app-backend=${env.DOCKER_REPO}-backend:${env.IMAGE_TAG} -n ${environment}
        kubectl set image deployment/quote-app-frontend quote-app-frontend=${env.DOCKER_REPO}-frontend:${env.IMAGE_TAG} -n ${environment}
        kubectl rollout status deployment/quote-app-backend -n ${environment} --timeout=300s
        kubectl rollout status deployment/quote-app-frontend -n ${environment} --timeout=300s
    """
}

def deployBlueGreen(environment) {
    echo "🔵🟢 Executing blue-green deployment to ${environment}..."
    // Blue-green deployment logic here
    sh """
        # Create green environment
        kubectl apply -f k8s/${environment}/green/ --namespace=${environment}
        kubectl rollout status deployment/quote-app-backend-green -n ${environment} --timeout=300s
        kubectl rollout status deployment/quote-app-frontend-green -n ${environment} --timeout=300s
        
        # Switch traffic to green
        kubectl patch service quote-app-backend -n ${environment} -p '{"spec":{"selector":{"version":"green"}}}'
        kubectl patch service quote-app-frontend -n ${environment} -p '{"spec":{"selector":{"version":"green"}}}'
        
        # Clean up blue environment after successful switch
        sleep 60
        kubectl delete deployment quote-app-backend-blue -n ${environment} || true
        kubectl delete deployment quote-app-frontend-blue -n ${environment} || true
    """
}

def deployCanary(environment) {
    echo "🐤 Executing canary deployment to ${environment}..."
    // Canary deployment logic here
    sh """
        # Deploy canary version (10% traffic)
        kubectl apply -f k8s/${environment}/canary/ --namespace=${environment}
        kubectl rollout status deployment/quote-app-backend-canary -n ${environment} --timeout=300s
        kubectl rollout status deployment/quote-app-frontend-canary -n ${environment} --timeout=300s
        
        # Monitor canary for 5 minutes
        sleep 300
        
        # If successful, promote canary to 100%
        kubectl scale deployment quote-app-backend -n ${environment} --replicas=0
        kubectl scale deployment quote-app-frontend -n ${environment} --replicas=0
        kubectl scale deployment quote-app-backend-canary -n ${environment} --replicas=3
        kubectl scale deployment quote-app-frontend-canary -n ${environment} --replicas=3
        
        # Update service selectors
        kubectl patch service quote-app-backend -n ${environment} -p '{"spec":{"selector":{"version":"canary"}}}'
        kubectl patch service quote-app-frontend -n ${environment} -p '{"spec":{"selector":{"version":"canary"}}}'
    """
}