#!/usr/bin/env groovy

import com.company.jenkins.Utils

/**
 * Comprehensive pipeline wrapper for standardized CI/CD workflows
 * 
 * Usage:
 * pipeline {
 *   config: [
 *     appName: 'my-app',
 *     dockerRegistry: 'ghcr.io/myorg',
 *     kubernetesNamespace: 'my-app',
 *     notifications: [
 *       slack: [channel: '#deployments', onSuccess: true, onFailure: true],
 *       email: [recipients: 'team@company.com', onFailure: true]
 *     ]
 *   ],
 *   stages: [
 *     'checkout',
 *     'test',
 *     'build',
 *     'security-scan',
 *     'deploy'
 *   ]
 * }
 */
def call(Map config) {
    // Initialize utilities
    def utils = new Utils(this)
    
    // Default configuration
    def defaultConfig = [
        appName: env.JOB_NAME?.split('/')[0] ?: 'app',
        dockerRegistry: 'ghcr.io',
        kubernetesNamespace: null,
        buildTimeout: 60,
        testTimeout: 30,
        deployTimeout: 15,
        retryCount: 3,
        parallelJobs: 4,
        notifications: [
            slack: [enabled: false],
            email: [enabled: false]
        ],
        security: [
            enableSonarQube: true,
            enableTrivyScan: true,
            enableOWASPScan: false,
            failOnCritical: true
        ],
        deployment: [
            strategy: 'rolling', // rolling, blue-green, canary
            environments: ['staging', 'production'],
            autoPromote: false,
            healthCheckTimeout: 300
        ],
        testing: [
            unit: true,
            integration: true,
            e2e: false,
            performance: false,
            coverage: true,
            coverageThreshold: 80
        ]
    ]
    
    // Merge configurations
    config = defaultConfig + config
    
    // Set Kubernetes namespace if not provided
    if (!config.kubernetesNamespace) {
        config.kubernetesNamespace = utils.getKubernetesNamespace(config.appName)
    }
    
    pipeline {
        agent any
        
        options {
            buildDiscarder(logRotator(numToKeepStr: '10'))
            timeout(time: config.buildTimeout, unit: 'MINUTES')
            retry(config.retryCount)
            skipStagesAfterUnstable()
            parallelsAlwaysFailFast()
        }
        
        environment {
            APP_NAME = "${config.appName}"
            DOCKER_REGISTRY = "${config.dockerRegistry}"
            K8S_NAMESPACE = "${config.kubernetesNamespace}"
            BUILD_VERSION = "${utils.generateVersion()}"
            BUILD_ENVIRONMENT = "${utils.getEnvironmentFromBranch()}"
            DOCKER_BUILDKIT = '1'
            COMPOSE_DOCKER_CLI_BUILD = '1'
        }
        
        stages {
            stage('🚀 Pipeline Initialization') {
                steps {
                    script {
                        // Display build information
                        def buildInfo = utils.generateBuildMetadata()
                        echo """
                        ╔══════════════════════════════════════════════════════════════╗
                        ║                    🚀 PIPELINE STARTED                       ║
                        ╠══════════════════════════════════════════════════════════════╣
                        ║ App Name:     ${buildInfo.jobName}
                        ║ Version:      ${buildInfo.version}
                        ║ Branch:       ${buildInfo.branch}
                        ║ Environment:  ${buildInfo.environment}
                        ║ Commit:       ${buildInfo.shortCommit}
                        ║ Triggered by: ${buildInfo.triggeredBy}
                        ║ Build URL:    ${buildInfo.buildUrl}
                        ╚══════════════════════════════════════════════════════════════╝
                        """.stripIndent()
                        
                        // Validate required environment variables
                        utils.validateEnvironmentVariables([
                            'DOCKER_REGISTRY',
                            'K8S_NAMESPACE'
                        ])
                        
                        // Store build metadata
                        utils.writeJsonFile('build-metadata.json', buildInfo)
                        utils.archiveArtifacts('build-metadata.json')
                    }
                }
            }
            
            stage('📥 Checkout & Setup') {
                when {
                    expression { 'checkout' in config.stages }
                }
                steps {
                    script {
                        echo "🔄 Checking out source code..."
                        checkout scm
                        
                        // Setup build environment
                        sh '''
                            echo "Setting up build environment..."
                            mkdir -p reports/{test,coverage,security,quality}
                            mkdir -p artifacts/{docker,kubernetes}
                        '''
                        
                        // Display changed files
                        def changedFiles = utils.getChangedFiles()
                        if (changedFiles) {
                            echo "📝 Changed files in this build:"
                            changedFiles.each { file ->
                                echo "  - ${file}"
                            }
                        }
                    }
                }
            }
            
            stage('🧪 Testing Suite') {
                when {
                    expression { 'test' in config.stages }
                }
                parallel {
                    stage('Unit Tests') {
                        when {
                            expression { config.testing.unit }
                        }
                        steps {
                            script {
                                runTests([
                                    type: 'unit',
                                    timeout: config.testTimeout,
                                    publishResults: true,
                                    generateCoverage: config.testing.coverage
                                ])
                            }
                        }
                        post {
                            always {
                                publishTestResults(
                                    testResultsPattern: 'reports/test/unit/*.xml',
                                    allowEmptyResults: true
                                )
                                
                                script {
                                    if (config.testing.coverage) {
                                        publishCoverage(
                                            adapters: [
                                                jacocoAdapter('reports/coverage/jacoco.xml'),
                                                coberturaAdapter('reports/coverage/cobertura.xml')
                                            ],
                                            sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                                        )
                                    }
                                }
                            }
                        }
                    }
                    
                    stage('Integration Tests') {
                        when {
                            expression { config.testing.integration }
                        }
                        steps {
                            script {
                                runTests([
                                    type: 'integration',
                                    timeout: config.testTimeout * 2,
                                    publishResults: true,
                                    setupServices: true
                                ])
                            }
                        }
                        post {
                            always {
                                publishTestResults(
                                    testResultsPattern: 'reports/test/integration/*.xml',
                                    allowEmptyResults: true
                                )
                            }
                        }
                    }
                    
                    stage('E2E Tests') {
                        when {
                            expression { config.testing.e2e }
                        }
                        steps {
                            script {
                                runTests([
                                    type: 'e2e',
                                    timeout: config.testTimeout * 3,
                                    publishResults: true,
                                    setupBrowser: true,
                                    setupServices: true
                                ])
                            }
                        }
                        post {
                            always {
                                publishTestResults(
                                    testResultsPattern: 'reports/test/e2e/*.xml',
                                    allowEmptyResults: true
                                )
                                
                                archiveArtifacts(
                                    artifacts: 'reports/test/e2e/screenshots/**/*',
                                    allowEmptyArchive: true
                                )
                            }
                        }
                    }
                }
            }
            
            stage('🔍 Code Quality & Security') {
                when {
                    expression { 'quality' in config.stages || 'security' in config.stages }
                }
                parallel {
                    stage('SonarQube Analysis') {
                        when {
                            expression { config.security.enableSonarQube }
                        }
                        steps {
                            script {
                                withSonarQubeEnv('SonarQube') {
                                    sh '''
                                        sonar-scanner \
                                          -Dsonar.projectKey=${APP_NAME} \
                                          -Dsonar.projectName=${APP_NAME} \
                                          -Dsonar.projectVersion=${BUILD_VERSION} \
                                          -Dsonar.sources=. \
                                          -Dsonar.exclusions=**/node_modules/**,**/vendor/**,**/*.test.js,**/*.spec.js \
                                          -Dsonar.coverage.exclusions=**/*.test.js,**/*.spec.js \
                                          -Dsonar.javascript.lcov.reportPaths=reports/coverage/lcov.info \
                                          -Dsonar.java.coveragePlugin=jacoco \
                                          -Dsonar.jacoco.reportPaths=reports/coverage/jacoco.exec
                                    '''
                                }
                                
                                timeout(time: 10, unit: 'MINUTES') {
                                    def qg = waitForQualityGate()
                                    if (qg.status != 'OK') {
                                        error "Pipeline aborted due to quality gate failure: ${qg.status}"
                                    }
                                }
                            }
                        }
                    }
                    
                    stage('OWASP Dependency Check') {
                        when {
                            expression { config.security.enableOWASPScan }
                        }
                        steps {
                            script {
                                sh '''
                                    dependency-check.sh \
                                      --project ${APP_NAME} \
                                      --scan . \
                                      --format XML \
                                      --format HTML \
                                      --out reports/security/dependency-check \
                                      --exclude "**/node_modules/**" \
                                      --exclude "**/vendor/**"
                                '''
                                
                                publishHTML([
                                    allowMissing: false,
                                    alwaysLinkToLastBuild: true,
                                    keepAll: true,
                                    reportDir: 'reports/security/dependency-check',
                                    reportFiles: 'dependency-check-report.html',
                                    reportName: 'OWASP Dependency Check Report'
                                ])
                            }
                        }
                    }
                }
            }
            
            stage('🏗️ Build & Package') {
                when {
                    expression { 'build' in config.stages }
                }
                parallel {
                    stage('Backend Build') {
                        when {
                            expression { utils.fileExists('backend/Dockerfile') || utils.fileExists('Dockerfile') }
                        }
                        steps {
                            script {
                                def dockerFile = utils.fileExists('backend/Dockerfile') ? 'backend/Dockerfile' : 'Dockerfile'
                                def context = utils.fileExists('backend/Dockerfile') ? 'backend' : '.'
                                
                                buildAndPushImage([
                                    imageName: "${config.appName}-backend",
                                    dockerFile: dockerFile,
                                    context: context,
                                    registry: config.dockerRegistry,
                                    tags: [env.BUILD_VERSION, utils.isMainBranch() ? 'latest' : utils.getBranchName()],
                                    enableScan: config.security.enableTrivyScan,
                                    failOnCritical: config.security.failOnCritical
                                ])
                            }
                        }
                    }
                    
                    stage('Frontend Build') {
                        when {
                            expression { utils.fileExists('frontend/Dockerfile') }
                        }
                        steps {
                            script {
                                buildAndPushImage([
                                    imageName: "${config.appName}-frontend",
                                    dockerFile: 'frontend/Dockerfile',
                                    context: 'frontend',
                                    registry: config.dockerRegistry,
                                    tags: [env.BUILD_VERSION, utils.isMainBranch() ? 'latest' : utils.getBranchName()],
                                    enableScan: config.security.enableTrivyScan,
                                    failOnCritical: config.security.failOnCritical
                                ])
                            }
                        }
                    }
                }
            }
            
            stage('🚀 Deployment') {
                when {
                    expression { 'deploy' in config.stages }
                }
                stages {
                    stage('Deploy to Staging') {
                        when {
                            expression { 'staging' in config.deployment.environments }
                        }
                        steps {
                            script {
                                deployToKubernetes([
                                    appName: config.appName,
                                    namespace: "${config.kubernetesNamespace}-staging",
                                    imageTag: env.BUILD_VERSION,
                                    registry: config.dockerRegistry,
                                    strategy: config.deployment.strategy,
                                    timeout: config.deployment.healthCheckTimeout,
                                    enableRollback: true
                                ])
                                
                                // Run smoke tests
                                runTests([
                                    type: 'smoke',
                                    environment: 'staging',
                                    timeout: 10
                                ])
                            }
                        }
                    }
                    
                    stage('Approval for Production') {
                        when {
                            allOf {
                                expression { 'production' in config.deployment.environments }
                                not { expression { config.deployment.autoPromote } }
                                anyOf {
                                    expression { utils.isMainBranch() }
                                    expression { utils.isReleaseBranch() }
                                }
                            }
                        }
                        steps {
                            script {
                                def deploymentInfo = """
                                🚀 **Production Deployment Approval Required**
                                
                                **Application:** ${config.appName}
                                **Version:** ${env.BUILD_VERSION}
                                **Branch:** ${utils.getBranchName()}
                                **Commit:** ${utils.getShortCommitHash()}
                                **Environment:** Production
                                **Strategy:** ${config.deployment.strategy}
                                
                                **Build Information:**
                                - Build Number: ${env.BUILD_NUMBER}
                                - Build URL: ${env.BUILD_URL}
                                - Duration: ${utils.getBuildDuration()}
                                
                                Please review the staging deployment and approve for production.
                                """.stripIndent()
                                
                                // Send notification for approval
                                if (config.notifications.slack.enabled) {
                                    notifySlack([
                                        channel: config.notifications.slack.channel,
                                        message: deploymentInfo,
                                        color: 'warning',
                                        mentionChannel: true
                                    ])
                                }
                                
                                timeout(time: 24, unit: 'HOURS') {
                                    input(
                                        message: 'Deploy to Production?',
                                        ok: 'Deploy',
                                        submitterParameter: 'APPROVER',
                                        parameters: [
                                            choice(
                                                name: 'DEPLOYMENT_STRATEGY',
                                                choices: ['rolling', 'blue-green', 'canary'],
                                                description: 'Deployment strategy for production'
                                            ),
                                            booleanParam(
                                                name: 'SKIP_TESTS',
                                                defaultValue: false,
                                                description: 'Skip post-deployment tests'
                                            )
                                        ]
                                    )
                                }
                                
                                echo "✅ Production deployment approved by: ${env.APPROVER}"
                                env.DEPLOYMENT_STRATEGY = env.DEPLOYMENT_STRATEGY ?: config.deployment.strategy
                            }
                        }
                    }
                    
                    stage('Deploy to Production') {
                        when {
                            anyOf {
                                expression { config.deployment.autoPromote }
                                expression { env.APPROVER != null }
                            }
                            anyOf {
                                expression { utils.isMainBranch() }
                                expression { utils.isReleaseBranch() }
                            }
                        }
                        steps {
                            script {
                                deployToKubernetes([
                                    appName: config.appName,
                                    namespace: "${config.kubernetesNamespace}-prod",
                                    imageTag: env.BUILD_VERSION,
                                    registry: config.dockerRegistry,
                                    strategy: env.DEPLOYMENT_STRATEGY ?: config.deployment.strategy,
                                    timeout: config.deployment.healthCheckTimeout,
                                    enableRollback: true
                                ])
                                
                                // Run production smoke tests
                                if (!env.SKIP_TESTS?.toBoolean()) {
                                    runTests([
                                        type: 'smoke',
                                        environment: 'production',
                                        timeout: 10
                                    ])
                                }
                            }
                        }
                    }
                }
            }
        }
        
        post {
            always {
                script {
                    // Archive build artifacts
                    utils.archiveArtifacts('reports/**/*')
                    utils.archiveArtifacts('artifacts/**/*')
                    
                    // Generate build summary
                    def buildSummary = [
                        status: currentBuild.currentResult,
                        duration: utils.getBuildDuration(),
                        version: env.BUILD_VERSION,
                        branch: utils.getBranchName(),
                        commit: utils.getShortCommitHash(),
                        environment: env.BUILD_ENVIRONMENT,
                        approver: env.APPROVER,
                        deploymentStrategy: env.DEPLOYMENT_STRATEGY
                    ]
                    
                    utils.writeJsonFile('build-summary.json', buildSummary)
                    utils.archiveArtifacts('build-summary.json')
                }
            }
            
            success {
                script {
                    echo "✅ Pipeline completed successfully!"
                    
                    // Send success notifications
                    if (config.notifications.slack.enabled && config.notifications.slack.onSuccess) {
                        notifySlack([
                            channel: config.notifications.slack.channel,
                            status: 'success',
                            message: "🎉 Deployment successful for ${config.appName} v${env.BUILD_VERSION}"
                        ])
                    }
                    
                    if (config.notifications.email.enabled && config.notifications.email.onSuccess) {
                        utils.sendEmail(
                            config.notifications.email.recipients,
                            "✅ Deployment Success: ${config.appName} v${env.BUILD_VERSION}",
                            """
                            <h2>🎉 Deployment Successful</h2>
                            <p><strong>Application:</strong> ${config.appName}</p>
                            <p><strong>Version:</strong> ${env.BUILD_VERSION}</p>
                            <p><strong>Branch:</strong> ${utils.getBranchName()}</p>
                            <p><strong>Duration:</strong> ${utils.getBuildDuration()}</p>
                            <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                            """.stripIndent()
                        )
                    }
                }
            }
            
            failure {
                script {
                    echo "❌ Pipeline failed!"
                    
                    // Send failure notifications
                    if (config.notifications.slack.enabled && config.notifications.slack.onFailure) {
                        notifySlack([
                            channel: config.notifications.slack.channel,
                            status: 'failure',
                            message: "💥 Deployment failed for ${config.appName} v${env.BUILD_VERSION}"
                        ])
                    }
                    
                    if (config.notifications.email.enabled && config.notifications.email.onFailure) {
                        utils.sendEmail(
                            config.notifications.email.recipients,
                            "❌ Deployment Failed: ${config.appName} v${env.BUILD_VERSION}",
                            """
                            <h2>💥 Deployment Failed</h2>
                            <p><strong>Application:</strong> ${config.appName}</p>
                            <p><strong>Version:</strong> ${env.BUILD_VERSION}</p>
                            <p><strong>Branch:</strong> ${utils.getBranchName()}</p>
                            <p><strong>Duration:</strong> ${utils.getBuildDuration()}</p>
                            <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                            <p><strong>Console Log:</strong> <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></p>
                            """.stripIndent()
                        )
                    }
                }
            }
            
            cleanup {
                script {
                    // Clean workspace
                    utils.cleanWorkspace()
                }
            }
        }
    }
}