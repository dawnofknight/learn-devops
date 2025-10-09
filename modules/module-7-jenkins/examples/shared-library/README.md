# Jenkins Shared Library

This Jenkins shared library provides reusable pipeline components and utilities for standardized CI/CD workflows.

## 📁 Structure

```
shared-library/
├── src/
│   └── com/
│       └── company/
│           └── jenkins/
│               └── Utils.groovy          # Utility class with helper functions
├── vars/
│   ├── buildAndPushImage.groovy         # Docker build and push functionality
│   ├── deployToKubernetes.groovy        # Kubernetes deployment with multiple strategies
│   ├── notifySlack.groovy               # Slack notification integration
│   ├── pipeline.groovy                  # Comprehensive pipeline wrapper
│   └── runTests.groovy                  # Test execution framework
└── README.md                            # This documentation
```

## 🚀 Quick Start

### 1. Configure Shared Library in Jenkins

1. Go to **Manage Jenkins** → **Configure System**
2. Scroll to **Global Pipeline Libraries**
3. Add a new library with:
   - **Name**: `jenkins-shared-library`
   - **Default version**: `main`
   - **Retrieval method**: Modern SCM
   - **Source Code Management**: Git
   - **Repository URL**: Your shared library repository URL

### 2. Use in Jenkinsfile

```groovy
@Library('jenkins-shared-library') _

pipeline([
    config: [
        appName: 'my-awesome-app',
        dockerRegistry: 'ghcr.io/myorg',
        notifications: [
            slack: [
                enabled: true,
                channel: '#deployments',
                onSuccess: true,
                onFailure: true
            ]
        ]
    ],
    stages: ['checkout', 'test', 'build', 'deploy']
])
```

## 📚 Components

### 🔧 Utils Class

The `Utils` class provides common utility functions:

```groovy
@Library('jenkins-shared-library') _
import com.company.jenkins.Utils

def utils = new Utils(this)

pipeline {
    agent any
    stages {
        stage('Example') {
            steps {
                script {
                    def version = utils.generateVersion()
                    def branch = utils.getBranchName()
                    def isMain = utils.isMainBranch()
                    
                    echo "Version: ${version}"
                    echo "Branch: ${branch}"
                    echo "Is main branch: ${isMain}"
                }
            }
        }
    }
}
```

#### Key Methods:

- `getCurrentTimestamp()` - Get current timestamp in ISO format
- `getShortCommitHash()` - Get short Git commit hash
- `getBranchName()` - Get current branch name
- `isMainBranch()` - Check if current branch is main/master
- `generateVersion()` - Generate semantic version based on branch
- `getEnvironmentFromBranch()` - Get environment based on branch name
- `executeCommand(command)` - Execute shell command and return output
- `retryWithBackoff(maxRetries, closure)` - Retry with exponential backoff
- `generateBuildMetadata()` - Generate comprehensive build metadata

### 🐳 buildAndPushImage

Build and push Docker images with security scanning:

```groovy
buildAndPushImage([
    imageName: 'my-app',
    dockerFile: 'Dockerfile',
    context: '.',
    registry: 'ghcr.io/myorg',
    tags: ['v1.0.0', 'latest'],
    enableScan: true,
    failOnCritical: true,
    buildArgs: [
        'NODE_ENV': 'production',
        'API_URL': 'https://api.example.com'
    ]
])
```

#### Parameters:

- `imageName` (required) - Name of the Docker image
- `dockerFile` - Path to Dockerfile (default: 'Dockerfile')
- `context` - Build context (default: '.')
- `registry` - Docker registry URL
- `tags` - List of tags to apply
- `enableScan` - Enable Trivy security scanning
- `failOnCritical` - Fail build on critical vulnerabilities
- `buildArgs` - Build arguments map

### ☸️ deployToKubernetes

Deploy applications to Kubernetes with multiple strategies:

```groovy
deployToKubernetes([
    appName: 'my-app',
    namespace: 'production',
    imageTag: 'v1.0.0',
    registry: 'ghcr.io/myorg',
    strategy: 'blue-green',
    timeout: 300,
    enableRollback: true,
    values: [
        'replicas': 3,
        'resources.requests.cpu': '100m',
        'resources.requests.memory': '128Mi'
    ]
])
```

#### Parameters:

- `appName` (required) - Application name
- `namespace` (required) - Kubernetes namespace
- `imageTag` (required) - Docker image tag
- `registry` - Docker registry URL
- `strategy` - Deployment strategy: 'rolling', 'blue-green', 'canary'
- `timeout` - Health check timeout in seconds
- `enableRollback` - Enable automatic rollback on failure
- `values` - Helm values to override

#### Supported Strategies:

1. **Rolling Deployment** - Gradual replacement of old pods
2. **Blue-Green Deployment** - Switch traffic between two environments
3. **Canary Deployment** - Gradual traffic shifting to new version

### 📢 notifySlack

Send Slack notifications with rich formatting:

```groovy
notifySlack([
    channel: '#deployments',
    message: 'Deployment completed successfully!',
    status: 'success',
    mentionChannel: true,
    threadReply: false
])
```

#### Parameters:

- `channel` (required) - Slack channel
- `message` - Custom message
- `status` - Build status: 'success', 'failure', 'warning', 'info'
- `mentionChannel` - Mention @channel
- `threadReply` - Send as thread reply

#### Convenience Methods:

```groovy
// Simple notifications
notifySlack.success('#deployments', 'Deployment successful!')
notifySlack.failure('#deployments', 'Deployment failed!')
notifySlack.deployment('#deployments', 'my-app', 'production', 'v1.0.0')
```

### 🧪 runTests

Execute various types of tests with comprehensive reporting:

```groovy
runTests([
    type: 'unit',
    timeout: 30,
    parallel: true,
    publishResults: true,
    generateCoverage: true,
    coverageThreshold: 80,
    retryCount: 2
])
```

#### Parameters:

- `type` (required) - Test type: 'unit', 'integration', 'e2e', 'performance', 'security'
- `timeout` - Test timeout in minutes
- `parallel` - Run tests in parallel
- `publishResults` - Publish JUnit test results
- `generateCoverage` - Generate code coverage reports
- `coverageThreshold` - Minimum coverage percentage
- `retryCount` - Number of retries on failure

### 🏗️ pipeline (Comprehensive Wrapper)

The main pipeline wrapper that orchestrates the entire CI/CD process:

```groovy
@Library('jenkins-shared-library') _

pipeline([
    config: [
        appName: 'my-awesome-app',
        dockerRegistry: 'ghcr.io/myorg',
        kubernetesNamespace: 'my-app',
        buildTimeout: 60,
        notifications: [
            slack: [
                enabled: true,
                channel: '#deployments',
                onSuccess: true,
                onFailure: true
            ],
            email: [
                enabled: true,
                recipients: 'team@company.com',
                onFailure: true
            ]
        ],
        security: [
            enableSonarQube: true,
            enableTrivyScan: true,
            enableOWASPScan: true,
            failOnCritical: true
        ],
        deployment: [
            strategy: 'blue-green',
            environments: ['staging', 'production'],
            autoPromote: false,
            healthCheckTimeout: 300
        ],
        testing: [
            unit: true,
            integration: true,
            e2e: true,
            coverage: true,
            coverageThreshold: 80
        ]
    ],
    stages: ['checkout', 'test', 'quality', 'build', 'deploy']
])
```

#### Configuration Options:

##### Basic Configuration:
- `appName` - Application name
- `dockerRegistry` - Docker registry URL
- `kubernetesNamespace` - Kubernetes namespace
- `buildTimeout` - Overall build timeout in minutes

##### Notifications:
- `notifications.slack.enabled` - Enable Slack notifications
- `notifications.slack.channel` - Slack channel
- `notifications.slack.onSuccess` - Notify on success
- `notifications.slack.onFailure` - Notify on failure
- `notifications.email.enabled` - Enable email notifications
- `notifications.email.recipients` - Email recipients
- `notifications.email.onSuccess` - Email on success
- `notifications.email.onFailure` - Email on failure

##### Security:
- `security.enableSonarQube` - Enable SonarQube analysis
- `security.enableTrivyScan` - Enable Trivy container scanning
- `security.enableOWASPScan` - Enable OWASP dependency check
- `security.failOnCritical` - Fail build on critical issues

##### Deployment:
- `deployment.strategy` - Deployment strategy
- `deployment.environments` - Target environments
- `deployment.autoPromote` - Auto-promote to production
- `deployment.healthCheckTimeout` - Health check timeout

##### Testing:
- `testing.unit` - Enable unit tests
- `testing.integration` - Enable integration tests
- `testing.e2e` - Enable end-to-end tests
- `testing.coverage` - Generate coverage reports
- `testing.coverageThreshold` - Minimum coverage percentage

## 🔄 Pipeline Stages

The comprehensive pipeline includes the following stages:

1. **🚀 Pipeline Initialization**
   - Display build information
   - Validate environment variables
   - Generate build metadata

2. **📥 Checkout & Setup**
   - Checkout source code
   - Setup build environment
   - Display changed files

3. **🧪 Testing Suite** (Parallel)
   - Unit tests with coverage
   - Integration tests
   - End-to-end tests

4. **🔍 Code Quality & Security** (Parallel)
   - SonarQube analysis
   - OWASP dependency check

5. **🏗️ Build & Package** (Parallel)
   - Backend Docker image build
   - Frontend Docker image build
   - Security scanning

6. **🚀 Deployment**
   - Deploy to staging
   - Approval for production (if required)
   - Deploy to production

## 🎯 Branch-Based Workflows

The library automatically determines deployment behavior based on branch patterns:

- **`main`/`master`** → Production deployment
- **`develop`/`development`** → Staging deployment
- **`release/*`** → Pre-production deployment
- **`feature/*`** → Development deployment
- **`hotfix/*`** → Hotfix deployment

## 📊 Version Generation

Automatic semantic versioning based on branch:

- **Main branch**: `1.0.{BUILD_NUMBER}`
- **Release branch**: `{VERSION}-rc.{BUILD_NUMBER}`
- **Hotfix branch**: `{VERSION}-hotfix.{BUILD_NUMBER}`
- **Other branches**: `0.0.{BUILD_NUMBER}-{SHORT_HASH}`

## 🔐 Security Features

- **Container Scanning**: Trivy integration for vulnerability detection
- **Dependency Scanning**: OWASP dependency check
- **Code Quality**: SonarQube integration
- **Secret Management**: Secure credential handling
- **RBAC**: Role-based access control

## 📈 Monitoring & Observability

- **Build Metadata**: Comprehensive build information
- **Test Reports**: JUnit and coverage reports
- **Artifact Archiving**: Automatic artifact preservation
- **Notifications**: Slack and email integration
- **Audit Trail**: Complete deployment history

## 🛠️ Customization

### Adding Custom Test Types

```groovy
// In your Jenkinsfile
runTests([
    type: 'custom',
    command: 'npm run test:custom',
    timeout: 15,
    publishResults: true
])
```

### Custom Deployment Strategies

```groovy
// Extend deployToKubernetes for custom strategies
deployToKubernetes([
    appName: 'my-app',
    namespace: 'production',
    imageTag: 'v1.0.0',
    strategy: 'custom',
    customStrategy: {
        // Your custom deployment logic
        sh 'kubectl apply -f custom-deployment.yaml'
    }
])
```

### Environment-Specific Configuration

```groovy
def getConfigForEnvironment(env) {
    def configs = [
        staging: [
            replicas: 2,
            resources: [cpu: '100m', memory: '256Mi']
        ],
        production: [
            replicas: 5,
            resources: [cpu: '500m', memory: '1Gi']
        ]
    ]
    return configs[env] ?: configs.staging
}
```

## 🔧 Troubleshooting

### Common Issues:

1. **Library Not Found**
   - Ensure the shared library is configured in Jenkins
   - Check the repository URL and credentials

2. **Permission Denied**
   - Verify Jenkins service account has required permissions
   - Check Kubernetes RBAC settings

3. **Docker Build Failures**
   - Ensure Docker daemon is accessible
   - Check Dockerfile syntax and dependencies

4. **Test Failures**
   - Review test reports in Jenkins
   - Check test environment setup

5. **Deployment Failures**
   - Verify Kubernetes cluster connectivity
   - Check namespace and resource quotas

### Debug Mode:

Enable debug logging by setting environment variable:

```groovy
environment {
    DEBUG_MODE = 'true'
}
```

## 📚 Best Practices

1. **Version Control**: Always version your shared library
2. **Testing**: Test library changes in a separate environment
3. **Documentation**: Keep documentation up to date
4. **Security**: Use secure credential management
5. **Monitoring**: Monitor pipeline performance and success rates
6. **Rollback**: Always have a rollback strategy
7. **Notifications**: Configure appropriate notifications for your team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## 📄 License

This shared library is provided under the MIT License. See LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the DevOps team
- Check Jenkins logs for detailed error information

---

**Happy Building! 🚀**