// Multibranch Pipeline Example with k6 Performance Testing
// This pipeline demonstrates different testing strategies based on branch patterns

pipeline {
    agent any
    
    environment {
        // Application settings
        APP_NAME = 'quote-app'
        DOCKER_REGISTRY = 'your-registry.com'
        
        // k6 Performance Testing
        K6_VERSION = 'latest'
        PERFORMANCE_RESULTS_DIR = 'performance-results'
        
        // Branch-specific configurations
        IS_MAIN_BRANCH = "${env.BRANCH_NAME == 'main'}"
        IS_DEVELOP_BRANCH = "${env.BRANCH_NAME == 'develop'}"
        IS_FEATURE_BRANCH = "${env.BRANCH_NAME.startsWith('feature/')}"
        IS_HOTFIX_BRANCH = "${env.BRANCH_NAME.startsWith('hotfix/')}"
        IS_RELEASE_BRANCH = "${env.BRANCH_NAME.startsWith('release/')}"
        
        // Environment URLs (dynamically set based on branch)
        TARGET_URL = "${getTargetUrl()}"
        
        // Monitoring
        INFLUXDB_URL = 'http://influxdb:8086/k6'
        GRAFANA_URL = 'http://grafana:3000'
        
        // Notifications
        SLACK_CHANNEL = '#devops-alerts'
    }
    
    options {
        buildDiscarder(logRotator(
            numToKeepStr: env.BRANCH_NAME == 'main' ? '20' : '10',
            daysToKeepStr: env.BRANCH_NAME == 'main' ? '30' : '7'
        ))
        timeout(time: 90, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
    }
    
    stages {
        stage('Branch Analysis & Setup') {
            steps {
                script {
                    echo "🔍 Analyzing branch: ${env.BRANCH_NAME}"
                    
                    // Set branch-specific configurations
                    setBranchConfiguration()
                    
                    // Display configuration
                    echo """
                    📋 Branch Configuration:
                    - Branch: ${env.BRANCH_NAME}
                    - Type: ${env.BRANCH_TYPE}
                    - Target URL: ${env.TARGET_URL}
                    - Performance Tests: ${env.PERFORMANCE_TEST_STRATEGY}
                    - Virtual Users: ${env.VIRTUAL_USERS}
                    - Test Duration: ${env.TEST_DURATION}
                    - Deployment Target: ${env.DEPLOYMENT_TARGET}
                    """
                    
                    // Create results directory
                    sh "mkdir -p ${env.PERFORMANCE_RESULTS_DIR}"
                }
            }
        }
        
        stage('Code Quality & Testing') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        script {
                            echo "🧪 Running unit tests..."
                            sh '''
                                cd backend && npm ci && npm run test:unit
                                cd ../frontend && npm ci && npm run test:unit
                            '''
                        }
                    }
                }
                
                stage('Integration Tests') {
                    when {
                        not {
                            expression { env.IS_FEATURE_BRANCH == 'true' }
                        }
                    }
                    steps {
                        script {
                            echo "🔗 Running integration tests..."
                            sh '''
                                cd backend && npm run test:integration
                            '''
                        }
                    }
                }
                
                stage('E2E Tests') {
                    when {
                        anyOf {
                            expression { env.IS_MAIN_BRANCH == 'true' }
                            expression { env.IS_DEVELOP_BRANCH == 'true' }
                            expression { env.IS_RELEASE_BRANCH == 'true' }
                        }
                    }
                    steps {
                        script {
                            echo "🎭 Running E2E tests..."
                            sh '''
                                cd frontend && npm run test:e2e
                            '''
                        }
                    }
                }
            }
        }
        
        stage('Build & Package') {
            steps {
                script {
                    echo "🏗️ Building application..."
                    
                    // Set image tag based on branch
                    env.IMAGE_TAG = getImageTag()
                    
                    parallel(
                        backend: {
                            sh """
                                docker build -t ${env.DOCKER_REGISTRY}/${env.APP_NAME}-backend:${env.IMAGE_TAG} ./backend
                            """
                        },
                        frontend: {
                            sh """
                                docker build -t ${env.DOCKER_REGISTRY}/${env.APP_NAME}-frontend:${env.IMAGE_TAG} ./frontend
                            """
                        }
                    )
                }
            }
        }
        
        stage('Deploy to Environment') {
            steps {
                script {
                    echo "🚀 Deploying to ${env.DEPLOYMENT_TARGET}..."
                    
                    switch(env.DEPLOYMENT_TARGET) {
                        case 'feature':
                            deployToFeatureEnvironment()
                            break
                        case 'staging':
                            deployToStagingEnvironment()
                            break
                        case 'production':
                            deployToProductionEnvironment()
                            break
                        default:
                            echo "⏭️ Skipping deployment for branch type: ${env.BRANCH_TYPE}"
                    }
                }
            }
        }
        
        stage('Performance Testing') {
            when {
                expression { env.PERFORMANCE_TEST_STRATEGY != 'none' }
            }
            steps {
                script {
                    echo "🚀 Running performance tests with strategy: ${env.PERFORMANCE_TEST_STRATEGY}"
                    
                    switch(env.PERFORMANCE_TEST_STRATEGY) {
                        case 'light':
                            runLightPerformanceTests()
                            break
                        case 'standard':
                            runStandardPerformanceTests()
                            break
                        case 'comprehensive':
                            runComprehensivePerformanceTests()
                            break
                        case 'production':
                            runProductionPerformanceTests()
                            break
                        default:
                            echo "⏭️ Unknown performance test strategy: ${env.PERFORMANCE_TEST_STRATEGY}"
                    }
                }
            }
        }
        
        stage('Performance Analysis & Quality Gates') {
            when {
                expression { env.PERFORMANCE_TEST_STRATEGY != 'none' }
            }
            steps {
                script {
                    echo "🔍 Analyzing performance results..."
                    
                    // Generate performance report
                    generateBranchSpecificReport()
                    
                    // Apply quality gates based on branch
                    applyPerformanceQualityGates()
                }
            }
        }
        
        stage('Promote to Next Environment') {
            when {
                allOf {
                    expression { env.BRANCH_TYPE in ['develop', 'release'] }
                    expression { currentBuild.result != 'FAILURE' }
                }
            }
            steps {
                script {
                    if (env.BRANCH_TYPE == 'develop') {
                        echo "🎯 Promoting successful develop build for release consideration..."
                        // Tag successful develop builds
                        sh """
                            git tag -a "develop-${env.BUILD_NUMBER}" -m "Successful develop build ${env.BUILD_NUMBER}"
                            git push origin "develop-${env.BUILD_NUMBER}"
                        """
                    } else if (env.BRANCH_TYPE == 'release') {
                        echo "🚀 Release branch ready for production deployment..."
                        // Create release candidate
                        sh """
                            git tag -a "rc-${env.BUILD_NUMBER}" -m "Release candidate ${env.BUILD_NUMBER}"
                            git push origin "rc-${env.BUILD_NUMBER}"
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Archive artifacts
            archiveArtifacts artifacts: "${env.PERFORMANCE_RESULTS_DIR}/**/*", allowEmptyArchive: true
            
            // Publish test results
            publishTestResults testResultsPattern: '**/test-results.xml'
            
            // Publish HTML reports if performance tests ran
            script {
                if (env.PERFORMANCE_TEST_STRATEGY != 'none') {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: env.PERFORMANCE_RESULTS_DIR,
                        reportFiles: '*.html',
                        reportName: 'k6 Performance Report'
                    ])
                }
            }
            
            // Clean up
            sh """
                docker system prune -f
                rm -rf node_modules || true
            """
        }
        
        success {
            script {
                sendBranchSpecificNotification('success')
            }
        }
        
        failure {
            script {
                sendBranchSpecificNotification('failure')
            }
        }
        
        unstable {
            script {
                sendBranchSpecificNotification('unstable')
            }
        }
    }
}

// Helper function to set branch-specific configuration
def setBranchConfiguration() {
    switch(true) {
        case env.BRANCH_NAME == 'main':
            env.BRANCH_TYPE = 'main'
            env.PERFORMANCE_TEST_STRATEGY = 'production'
            env.VIRTUAL_USERS = '20'
            env.TEST_DURATION = '3m'
            env.DEPLOYMENT_TARGET = 'production'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'false' // Don't fail prod deployments
            break
            
        case env.BRANCH_NAME == 'develop':
            env.BRANCH_TYPE = 'develop'
            env.PERFORMANCE_TEST_STRATEGY = 'comprehensive'
            env.VIRTUAL_USERS = '100'
            env.TEST_DURATION = '10m'
            env.DEPLOYMENT_TARGET = 'staging'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'true'
            break
            
        case env.BRANCH_NAME.startsWith('release/'):
            env.BRANCH_TYPE = 'release'
            env.PERFORMANCE_TEST_STRATEGY = 'standard'
            env.VIRTUAL_USERS = '75'
            env.TEST_DURATION = '8m'
            env.DEPLOYMENT_TARGET = 'staging'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'true'
            break
            
        case env.BRANCH_NAME.startsWith('hotfix/'):
            env.BRANCH_TYPE = 'hotfix'
            env.PERFORMANCE_TEST_STRATEGY = 'light'
            env.VIRTUAL_USERS = '50'
            env.TEST_DURATION = '5m'
            env.DEPLOYMENT_TARGET = 'staging'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'false' // Hotfixes need to go through quickly
            break
            
        case env.BRANCH_NAME.startsWith('feature/'):
            env.BRANCH_TYPE = 'feature'
            env.PERFORMANCE_TEST_STRATEGY = 'light'
            env.VIRTUAL_USERS = '25'
            env.TEST_DURATION = '3m'
            env.DEPLOYMENT_TARGET = 'feature'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'false'
            break
            
        default:
            env.BRANCH_TYPE = 'other'
            env.PERFORMANCE_TEST_STRATEGY = 'none'
            env.VIRTUAL_USERS = '10'
            env.TEST_DURATION = '2m'
            env.DEPLOYMENT_TARGET = 'none'
            env.FAIL_ON_PERFORMANCE_ISSUES = 'false'
    }
}

// Helper function to get target URL based on branch
def getTargetUrl() {
    switch(env.BRANCH_NAME) {
        case 'main':
            return 'https://yourapp.com'
        case 'develop':
            return 'https://staging.yourapp.com'
        case { it.startsWith('release/') }:
            return 'https://staging.yourapp.com'
        case { it.startsWith('hotfix/') }:
            return 'https://staging.yourapp.com'
        case { it.startsWith('feature/') }:
            def featureName = env.BRANCH_NAME.replace('feature/', '').replace('/', '-')
            return "https://${featureName}.feature.yourapp.com"
        default:
            return 'http://localhost:3000'
    }
}

// Helper function to get image tag based on branch
def getImageTag() {
    def gitCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
    
    switch(env.BRANCH_NAME) {
        case 'main':
            return "v${env.BUILD_NUMBER}-${gitCommit}"
        case 'develop':
            return "develop-${env.BUILD_NUMBER}-${gitCommit}"
        case { it.startsWith('release/') }:
            def version = env.BRANCH_NAME.replace('release/', '')
            return "${version}-rc${env.BUILD_NUMBER}-${gitCommit}"
        case { it.startsWith('hotfix/') }:
            def version = env.BRANCH_NAME.replace('hotfix/', '')
            return "${version}-hotfix${env.BUILD_NUMBER}-${gitCommit}"
        case { it.startsWith('feature/') }:
            def featureName = env.BRANCH_NAME.replace('feature/', '').replace('/', '-')
            return "feature-${featureName}-${env.BUILD_NUMBER}-${gitCommit}"
        default:
            return "branch-${env.BRANCH_NAME.replace('/', '-')}-${env.BUILD_NUMBER}-${gitCommit}"
    }
}

// Deployment functions
def deployToFeatureEnvironment() {
    echo "🚀 Deploying to feature environment..."
    def featureName = env.BRANCH_NAME.replace('feature/', '').replace('/', '-')
    
    sh """
        # Create feature namespace if it doesn't exist
        kubectl create namespace feature-${featureName} --dry-run=client -o yaml | kubectl apply -f -
        
        # Deploy to feature environment
        helm upgrade --install ${env.APP_NAME}-${featureName} ./helm-chart \\
            --namespace feature-${featureName} \\
            --set image.tag=${env.IMAGE_TAG} \\
            --set ingress.host=${featureName}.feature.yourapp.com \\
            --set resources.requests.cpu=100m \\
            --set resources.requests.memory=128Mi \\
            --set replicaCount=1
        
        # Wait for deployment
        kubectl rollout status deployment/${env.APP_NAME}-backend -n feature-${featureName} --timeout=300s
        kubectl rollout status deployment/${env.APP_NAME}-frontend -n feature-${featureName} --timeout=300s
    """
}

def deployToStagingEnvironment() {
    echo "🚀 Deploying to staging environment..."
    
    sh """
        # Deploy to staging
        helm upgrade --install ${env.APP_NAME} ./helm-chart \\
            --namespace staging \\
            --set image.tag=${env.IMAGE_TAG} \\
            --set ingress.host=staging.yourapp.com \\
            --set resources.requests.cpu=200m \\
            --set resources.requests.memory=256Mi \\
            --set replicaCount=2
        
        # Wait for deployment
        kubectl rollout status deployment/${env.APP_NAME}-backend -n staging --timeout=300s
        kubectl rollout status deployment/${env.APP_NAME}-frontend -n staging --timeout=300s
        
        # Run smoke tests
        sleep 30
        curl -f https://staging.yourapp.com/api/health || exit 1
    """
}

def deployToProductionEnvironment() {
    echo "🚀 Deploying to production environment..."
    
    // Require manual approval for production
    timeout(time: 15, unit: 'MINUTES') {
        input message: 'Deploy to Production?', ok: 'Deploy',
              submitterParameter: 'APPROVER'
    }
    
    sh """
        # Deploy to production with blue-green strategy
        helm upgrade --install ${env.APP_NAME} ./helm-chart \\
            --namespace production \\
            --set image.tag=${env.IMAGE_TAG} \\
            --set ingress.host=yourapp.com \\
            --set resources.requests.cpu=500m \\
            --set resources.requests.memory=512Mi \\
            --set replicaCount=3 \\
            --set strategy.type=BlueGreen
        
        # Wait for deployment
        kubectl rollout status deployment/${env.APP_NAME}-backend -n production --timeout=600s
        kubectl rollout status deployment/${env.APP_NAME}-frontend -n production --timeout=600s
        
        # Run production smoke tests
        sleep 60
        curl -f https://yourapp.com/api/health || exit 1
    """
}

// Performance testing functions
def runLightPerformanceTests() {
    echo "🔄 Running light performance tests..."
    
    parallel(
        'Load Test': {
            runK6Test('load', 'basic-load-test.js')
        }
    )
}

def runStandardPerformanceTests() {
    echo "🔄 Running standard performance tests..."
    
    parallel(
        'Load Test': {
            runK6Test('load', 'basic-load-test.js')
        },
        'Spike Test': {
            runK6Test('spike', 'spike-test.js')
        }
    )
}

def runComprehensivePerformanceTests() {
    echo "🔄 Running comprehensive performance tests..."
    
    parallel(
        'Load Test': {
            runK6Test('load', 'basic-load-test.js')
        },
        'Stress Test': {
            runK6Test('stress', 'stress-test.js')
        },
        'Spike Test': {
            runK6Test('spike', 'spike-test.js')
        }
    )
}

def runProductionPerformanceTests() {
    echo "🔄 Running production performance tests..."
    
    // Only light load testing in production
    runK6Test('load', 'basic-load-test.js')
}

// Helper function to run k6 tests
def runK6Test(testType, scriptName) {
    try {
        sh """
            docker run --rm \\
                -v \$(pwd)/modules/module-8-k6-performance:/scripts \\
                -v \$(pwd)/${env.PERFORMANCE_RESULTS_DIR}:/results \\
                -e TARGET_URL=${env.TARGET_URL} \\
                -e VIRTUAL_USERS=${env.VIRTUAL_USERS} \\
                -e DURATION=${env.TEST_DURATION} \\
                --network host \\
                grafana/k6:${env.K6_VERSION} run \\
                --out json=/results/${testType}-${env.BRANCH_TYPE}-${env.BUILD_NUMBER}.json \\
                --out influxdb=${env.INFLUXDB_URL} \\
                /scripts/tests/${testType}/${scriptName}
        """
        
        env."${testType.toUpperCase()}_TEST_RESULT" = 'PASSED'
        
    } catch (Exception e) {
        env."${testType.toUpperCase()}_TEST_RESULT" = 'FAILED'
        echo "❌ ${testType} test failed: ${e.message}"
        
        if (env.FAIL_ON_PERFORMANCE_ISSUES == 'true') {
            throw e
        }
    }
}

// Helper function to generate branch-specific report
def generateBranchSpecificReport() {
    sh """
        cat > ${env.PERFORMANCE_RESULTS_DIR}/performance-report-${env.BRANCH_TYPE}-${env.BUILD_NUMBER}.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report - ${env.BRANCH_NAME} - Build ${env.BUILD_NUMBER}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .branch-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; font-size: 1em; }
        .metric .value { font-size: 1.8em; font-weight: bold; color: #667eea; }
        .test-results { margin: 20px 0; }
        .test-result { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
        .skipped { border-left: 4px solid #ffc107; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 15px; color: white; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-skipped { background: #ffc107; }
        .branch-strategy { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Test Report</h1>
            <p><strong>Branch:</strong> ${env.BRANCH_NAME} | <strong>Build:</strong> ${env.BUILD_NUMBER}</p>
        </div>
        
        <div class="branch-info">
            <h3>📋 Branch Information</h3>
            <p><strong>Branch Type:</strong> ${env.BRANCH_TYPE}</p>
            <p><strong>Target URL:</strong> ${env.TARGET_URL}</p>
            <p><strong>Deployment Target:</strong> ${env.DEPLOYMENT_TARGET}</p>
            <p><strong>Image Tag:</strong> ${env.IMAGE_TAG}</p>
        </div>
        
        <div class="branch-strategy">
            <h3>🎯 Testing Strategy: ${env.PERFORMANCE_TEST_STRATEGY}</h3>
            <p>This branch uses the <strong>${env.PERFORMANCE_TEST_STRATEGY}</strong> performance testing strategy based on its type and purpose.</p>
        </div>
        
        <div class="metrics">
            <div class="metric">
                <h3>Virtual Users</h3>
                <div class="value">${env.VIRTUAL_USERS}</div>
            </div>
            <div class="metric">
                <h3>Test Duration</h3>
                <div class="value">${env.TEST_DURATION}</div>
            </div>
            <div class="metric">
                <h3>Branch Type</h3>
                <div class="value">${env.BRANCH_TYPE}</div>
            </div>
            <div class="metric">
                <h3>Strategy</h3>
                <div class="value">${env.PERFORMANCE_TEST_STRATEGY}</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>📈 Test Results</h2>
            
            <div class="test-result \${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : env.LOAD_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>🔄 Load Testing 
                    <span class="status status-\${env.LOAD_TEST_RESULT == 'PASSED' ? 'passed' : env.LOAD_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.LOAD_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
            </div>
            
            <div class="test-result \${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : env.STRESS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>💪 Stress Testing 
                    <span class="status status-\${env.STRESS_TEST_RESULT == 'PASSED' ? 'passed' : env.STRESS_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.STRESS_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
            </div>
            
            <div class="test-result \${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : env.SPIKE_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                <h3>⚡ Spike Testing 
                    <span class="status status-\${env.SPIKE_TEST_RESULT == 'PASSED' ? 'passed' : env.SPIKE_TEST_RESULT == 'FAILED' ? 'failed' : 'skipped'}">
                        \${env.SPIKE_TEST_RESULT ?: 'SKIPPED'}
                    </span>
                </h3>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
            <p>Generated by Jenkins Multibranch k6 Performance Testing Pipeline</p>
            <p>Build #${env.BUILD_NUMBER} - \$(date)</p>
        </div>
    </div>
</body>
</html>
EOF
    """
}

// Helper function to apply performance quality gates
def applyPerformanceQualityGates() {
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
    
    if (issues.size() > 0) {
        echo "⚠️ Performance issues detected: ${issues.join(', ')}"
        
        if (env.FAIL_ON_PERFORMANCE_ISSUES == 'true') {
            error("Performance quality gates failed for ${env.BRANCH_TYPE} branch")
        } else {
            echo "⚠️ Performance issues detected but not failing build for ${env.BRANCH_TYPE} branch"
            currentBuild.result = 'UNSTABLE'
        }
    } else {
        echo "✅ All performance quality gates passed!"
    }
}

// Helper function to send branch-specific notifications
def sendBranchSpecificNotification(status) {
    def color = status == 'success' ? 'good' : status == 'failure' ? 'danger' : 'warning'
    def emoji = status == 'success' ? '✅' : status == 'failure' ? '❌' : '⚠️'
    
    // Only send notifications for important branches
    if (env.BRANCH_TYPE in ['main', 'develop', 'release', 'hotfix']) {
        def message = """
        ${emoji} *${status.capitalize()}* - ${env.BRANCH_NAME} #${env.BUILD_NUMBER}
        
        *Branch Type:* ${env.BRANCH_TYPE}
        *Performance Strategy:* ${env.PERFORMANCE_TEST_STRATEGY}
        *Target:* ${env.TARGET_URL}
        *Deployment:* ${env.DEPLOYMENT_TARGET}
        
        *Performance Results:*
        • Load: ${env.LOAD_TEST_RESULT ?: 'SKIPPED'}
        • Stress: ${env.STRESS_TEST_RESULT ?: 'SKIPPED'}
        • Spike: ${env.SPIKE_TEST_RESULT ?: 'SKIPPED'}
        
        *Reports:* ${env.BUILD_URL}k6_20Performance_20Report/
        """
        
        slackSend(
            channel: env.SLACK_CHANNEL,
            color: color,
            message: message
        )
    }
}