# Module 7: Jenkins CI/CD with k6 Performance Testing

This module provides a comprehensive Jenkins CI/CD setup for containerized applications, including Docker and Kubernetes integration, security scanning, automated testing, deployment strategies, and integrated k6 performance testing.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Components](#components)
- [k6 Performance Testing Integration](#k6-performance-testing-integration)
- [Setup Instructions](#setup-instructions)
- [Pipeline Examples](#pipeline-examples)
- [Shared Library](#shared-library)
- [Security Features](#security-features)
- [Monitoring & Observability](#monitoring--observability)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🎯 Overview

This Jenkins module demonstrates enterprise-grade CI/CD practices with:

- **Automated CI/CD Pipelines**: Multi-branch, multi-environment deployment strategies
- **Performance Testing Integration**: k6 load testing with comprehensive reporting and monitoring
- **Security Integration**: SonarQube, Trivy, OWASP dependency scanning
- **Container Support**: Docker image building, scanning, and registry management
- **Kubernetes Integration**: Automated deployments with rolling, blue-green, and canary strategies
- **Shared Libraries**: Reusable pipeline components and utilities
- **Monitoring**: Integration with Prometheus, Grafana, InfluxDB, and alerting systems

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Kubernetes cluster (optional, for K8s examples)
- Git
- Basic understanding of Jenkins and CI/CD concepts

### 1. Start Jenkins Environment

```bash
cd modules/module-7-jenkins/scripts
chmod +x setup-jenkins.sh
./setup-jenkins.sh
```

This will set up:
- Jenkins master and agent
- SonarQube with PostgreSQL
- Nexus repository
- Docker registry
- Nginx reverse proxy

### 2. Access Services

After setup completion:

- **Jenkins**: https://jenkins.localhost (admin/admin123)
- **SonarQube**: https://sonarqube.localhost (admin/admin)
- **Nexus**: https://nexus.localhost (admin/admin123)
- **Docker Registry**: https://registry.localhost

### 3. Configure Your First Pipeline

1. Create a new Pipeline job in Jenkins
2. Use the provided Jenkinsfile examples
3. Configure webhooks for automatic builds

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │    │   Git Repository│    │   Jenkins       │
│   Workstation   │───▶│   (GitHub/      │───▶│   Master        │
│                 │    │    GitLab)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 │                                 │
                       ▼                                 ▼                                 ▼
            ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
            │   SonarQube     │              │   Jenkins       │              │   Docker        │
            │   (Code Quality)│              │   Agent         │              │   Registry      │
            └─────────────────┘              └─────────────────┘              └─────────────────┘
                       │                                 │                                 │
                       │                                 ▼                                 │
                       │                  ┌─────────────────────────────────┐              │
                       │                  │        Kubernetes Cluster       │              │
                       │                  │  ┌─────────┐  ┌─────────────┐   │              │
                       │                  │  │Staging  │  │ Production  │   │◀─────────────┘
                       │                  │  │   Env   │  │     Env     │   │
                       │                  │  └─────────┘  └─────────────┘   │
                       │                  └─────────────────────────────────┘
                       │                                 │
                       └─────────────────────────────────┼─────────────────────────────────┐
                                                         │                                 │
                                                         ▼                                 ▼
                                              ┌─────────────────┐              ┌─────────────────┐
                                              │   Prometheus    │              │     Slack       │
                                              │   Monitoring    │              │ Notifications   │
                                              └─────────────────┘              └─────────────────┘
```

## 🧩 Components

### Core Components

| Component | Description | Location |
|-----------|-------------|----------|
| **Jenkins Configuration** | Master setup with plugins and security | `jenkins/` |
| **Pipeline Examples** | Sample Jenkinsfiles for different scenarios | `pipelines/` |
| **k6 Performance Testing** | Load testing integration and examples | `examples/k6-*` |
| **Shared Library** | Reusable pipeline functions | `examples/shared-library/` |
| **Docker Compose** | Complete development environment | `examples/docker-compose.jenkins.yml` |
| **Kubernetes Manifests** | K8s deployment configurations | `examples/k8s-manifests/` |
| **Setup Scripts** | Automated environment setup | `scripts/` |

### Pipeline Types

1. **Basic Pipeline** (`pipelines/Jenkinsfile`)
   - Simple CI/CD for single applications
   - Docker build and push
   - Basic testing and deployment

2. **Multi-branch Pipeline** (`pipelines/Jenkinsfile.multibranch`)
   - Branch-specific workflows
   - Feature, develop, release, and main branch strategies
   - Automated environment promotion

3. **k6 Performance Testing Pipeline** (`examples/k6-*`)
   - Integrated load testing with k6
   - Multi-environment performance validation
   - Comprehensive reporting and monitoring
   - Quality gates based on performance thresholds

4. **Shared Library Pipeline** (`examples/application-examples/`)
   - Standardized, reusable pipeline components
   - Configuration-driven approach
   - Enterprise-ready features

## 🎯 k6 Performance Testing Integration

This module includes comprehensive k6 performance testing integration with Jenkins CI/CD pipelines:

### Features

- **Multi-Test Suite Support**: Load, stress, spike, and DDoS simulation tests
- **Environment-Specific Testing**: Different strategies for staging and production
- **Branch-Based Testing**: Customized performance testing based on Git branch patterns
- **Monitoring Integration**: InfluxDB, Grafana, and Prometheus integration
- **Quality Gates**: Fail builds based on performance thresholds
- **Comprehensive Reporting**: HTML reports, trend analysis, and Slack notifications

### Available Examples

| File | Description |
|------|-------------|
| `examples/k6-performance-jenkinsfile` | Dedicated k6 performance testing pipeline |
| `examples/k6-pipeline-example.groovy` | Complete CI/CD with integrated k6 testing |
| `examples/k6-multibranch-example.groovy` | Branch-specific performance testing strategies |
| `examples/k6-shared-library.groovy` | Reusable k6 functions for Jenkins shared libraries |
| `examples/runK6PerformanceTests.groovy` | Shared library function for k6 integration |

### Quick Start with k6

1. **Use the k6 Shared Library**:
   ```groovy
   @Library('k6-performance-lib') _
   
   pipeline {
       agent any
       stages {
           stage('Performance Testing') {
               steps {
                   script {
                       k6PerformanceTest([
                           testSuite: 'load',
                           targetUrl: 'https://your-app.com',
                           virtualUsers: 50,
                           duration: '5m'
                       ])
                   }
               }
           }
       }
   }
   ```

2. **Branch-Specific Testing**:
   ```groovy
   stage('Performance Testing') {
       when {
           anyOf {
               branch 'main'
               branch 'develop'
           }
       }
       steps {
           script {
               def testStrategy = env.BRANCH_NAME == 'main' ? 'production' : 'comprehensive'
               runK6PerformanceTests(testStrategy)
           }
       }
   }
   ```

### Performance Testing Strategies

- **Main Branch**: Light production-safe testing (20 VUs, 3 minutes)
- **Develop Branch**: Comprehensive testing (100 VUs, 10 minutes)
- **Feature Branches**: Quick validation testing (25 VUs, 3 minutes)
- **Release Branches**: Standard testing for release validation

## 📖 Setup Instructions

### Manual Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd learn-container/modules/module-7-jenkins
   ```

2. **Environment Preparation**
   ```bash
   # Create required directories
   mkdir -p {jenkins_home,sonarqube_data,nexus_data,registry_data}
   
   # Set permissions
   chmod 755 jenkins_home sonarqube_data nexus_data registry_data
   ```

3. **Start Services**
   ```bash
   docker-compose -f examples/docker-compose.jenkins.yml up -d
   ```

4. **Configure Jenkins**
   - Access Jenkins at http://localhost:8080
   - Install suggested plugins
   - Create admin user
   - Configure system settings

### Automated Setup

Use the provided setup script for a complete automated installation:

```bash
cd scripts
./setup-jenkins.sh
```

The script will:
- Check prerequisites
- Create necessary directories
- Generate SSL certificates
- Configure Docker registry authentication
- Start all services
- Display access information

## 🔧 Pipeline Examples

### Simple Application

```groovy
@Library('jenkins-shared-library') _

pipeline([
    config: [
        appName: 'my-app',
        dockerRegistry: 'ghcr.io/myorg',
        notifications: [
            slack: [
                enabled: true,
                channel: '#ci-cd'
            ]
        ]
    ],
    stages: ['checkout', 'test', 'build', 'deploy']
])
```

### Microservice with Advanced Features

```groovy
@Library('jenkins-shared-library') _

pipeline([
    config: [
        appName: 'user-service',
        testing: [
            unit: true,
            integration: true,
            contract: true,
            performance: true
        ],
        security: [
            enableSonarQube: true,
            enableTrivyScan: true,
            enableOWASP: true
        ],
        deployment: [
            strategy: 'canary',
            environments: ['staging', 'production']
        ]
    ]
])
```

### Custom Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Test') {
            steps {
                script {
                    runTests([type: 'unit', coverage: true])
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    buildAndPushImage([
                        imageName: 'my-app',
                        registry: 'ghcr.io/myorg'
                    ])
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    deployToKubernetes([
                        appName: 'my-app',
                        namespace: 'production'
                    ])
                }
            }
        }
    }
}
```

## 📚 Shared Library

The Jenkins shared library provides reusable components:

### Core Functions

- **`buildAndPushImage`**: Docker image building and registry operations
- **`deployToKubernetes`**: Kubernetes deployment with multiple strategies
- **`runTests`**: Comprehensive testing framework
- **`notifySlack`**: Slack notifications and alerts
- **`Utils`**: Common utility functions

### Usage Examples

```groovy
// Build and push Docker image
buildAndPushImage([
    imageName: 'my-app',
    registry: 'ghcr.io/myorg',
    tags: ['latest', env.BUILD_NUMBER],
    buildArgs: ['VERSION': env.BUILD_NUMBER]
])

// Deploy to Kubernetes
deployToKubernetes([
    appName: 'my-app',
    namespace: 'production',
    strategy: 'blue-green',
    imageTag: env.BUILD_NUMBER
])

// Run tests
runTests([
    type: 'unit',
    parallel: true,
    coverage: true,
    timeout: 15
])

// Send Slack notification
notifySlack.success('#deployments', 'Deployment completed successfully!')
```

## 🔒 Security Features

### Code Quality & Security Scanning

1. **SonarQube Integration**
   - Code quality analysis
   - Security vulnerability detection
   - Technical debt tracking
   - Quality gates

2. **Container Security**
   - Trivy vulnerability scanning
   - Image signing with Cosign
   - SBOM generation
   - Registry security

3. **Dependency Scanning**
   - OWASP Dependency Check
   - License compliance
   - Vulnerability reporting

### Security Best Practices

- Secrets management with Jenkins credentials
- RBAC and access control
- Secure communication (HTTPS/TLS)
- Container image scanning
- Policy enforcement

## 📊 Monitoring & Observability

### Metrics Collection

- **Jenkins Metrics**: Build times, success rates, queue lengths
- **Application Metrics**: Custom metrics via Prometheus
- **Infrastructure Metrics**: Resource usage, performance

### Alerting

- **Slack Integration**: Real-time notifications
- **Email Alerts**: Critical failure notifications
- **PagerDuty**: Incident management (configurable)

### Dashboards

- Jenkins build dashboards
- Application performance monitoring
- Infrastructure health monitoring

## 🎯 Best Practices

### Pipeline Design

1. **Keep Pipelines Simple**: Use shared libraries for complex logic
2. **Fail Fast**: Run quick tests first
3. **Parallel Execution**: Utilize parallel stages for efficiency
4. **Resource Management**: Clean up after builds
5. **Error Handling**: Implement proper error handling and notifications

### Security

1. **Secrets Management**: Use Jenkins credentials store
2. **Least Privilege**: Minimal required permissions
3. **Regular Updates**: Keep Jenkins and plugins updated
4. **Audit Logging**: Enable comprehensive logging
5. **Network Security**: Use HTTPS and secure communications

### Performance

1. **Agent Management**: Use appropriate build agents
2. **Caching**: Implement build caching strategies
3. **Resource Limits**: Set appropriate timeouts and limits
4. **Monitoring**: Track pipeline performance metrics
5. **Optimization**: Regular pipeline performance reviews

## 🔧 Troubleshooting

### Common Issues

#### Jenkins Won't Start

```bash
# Check logs
docker-compose logs jenkins

# Check permissions
ls -la jenkins_home/

# Reset Jenkins
docker-compose down
sudo rm -rf jenkins_home/*
docker-compose up -d
```

#### Pipeline Failures

1. **Check Console Output**: Review build logs
2. **Verify Credentials**: Ensure all credentials are configured
3. **Test Connectivity**: Verify network access to external services
4. **Resource Issues**: Check available disk space and memory

#### Docker Issues

```bash
# Check Docker daemon
docker info

# Clean up resources
docker system prune -a

# Check registry connectivity
docker login ghcr.io
```

### Debug Mode

Enable debug logging in Jenkins:
1. Go to Manage Jenkins → System Log
2. Add new logger for your pipeline
3. Set log level to FINE or ALL

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Testing Changes

```bash
# Test pipeline syntax
jenkins-cli declarative-linter < Jenkinsfile

# Test shared library functions
# (Use Jenkins Pipeline Unit Testing Framework)

# Test Docker Compose setup
docker-compose -f examples/docker-compose.jenkins.yml config
```

### Code Standards

- Follow Jenkins Pipeline best practices
- Use meaningful variable names
- Add comprehensive comments
- Include error handling
- Write tests for shared library functions

## 📝 Additional Resources

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Jenkins Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [SonarQube Documentation](https://docs.sonarqube.org/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Next Module**: [Module 8: Advanced Topics](../module-8-advanced/README.md)

**Previous Module**: [Module 6: Security](../module-6-security/README.md)

## 🔑 Key Concepts

### Jenkins Fundamentals
- **Master/Controller**: Central Jenkins instance that manages builds
- **Agents/Nodes**: Machines that execute build jobs
- **Jobs**: Individual tasks or projects
- **Builds**: Execution instances of jobs
- **Workspaces**: Directories where builds are executed

### Pipeline Types
1. **Freestyle Projects**: Traditional job configuration
2. **Declarative Pipelines**: YAML-like syntax for pipeline as code
3. **Scripted Pipelines**: Groovy-based flexible pipeline scripts
4. **Multi-branch Pipelines**: Automatic pipeline creation for branches

### Advanced Features
- **Blue Ocean**: Modern UI for pipeline visualization
- **Pipeline Libraries**: Shared pipeline code
- **Parallel Execution**: Concurrent job execution
- **Matrix Builds**: Testing across multiple configurations

## 📝 Tutorial

### Step 1: Jenkins Setup with Docker

First, let's set up Jenkins using Docker Compose:

```yaml
# docker-compose.jenkins.yml
version: '3.8'

services:
  jenkins:
    image: jenkins/jenkins:lts-jdk11
    container_name: jenkins-master
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - ./jenkins/plugins.txt:/usr/share/jenkins/ref/plugins.txt
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false
      - JENKINS_ADMIN_ID=admin
      - JENKINS_ADMIN_PASSWORD=admin123
    networks:
      - jenkins-network

  jenkins-agent:
    image: jenkins/inbound-agent:latest
    container_name: jenkins-agent-1
    restart: unless-stopped
    environment:
      - JENKINS_URL=http://jenkins:8080
      - JENKINS_SECRET=${JENKINS_AGENT_SECRET}
      - JENKINS_AGENT_NAME=docker-agent-1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - jenkins-network
    depends_on:
      - jenkins

volumes:
  jenkins_home:

networks:
  jenkins-network:
    driver: bridge
```

### Step 2: Basic Declarative Pipeline

Create your first declarative pipeline:

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'ghcr.io'
        IMAGE_NAME = 'quote-app'
        KUBECONFIG = credentials('kubeconfig')
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('Build & Test') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npm run test -- --coverage'
                            sh 'npm run lint'
                        }
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'backend/test-results.xml'
                            publishCoverageGoberturaReport 'backend/coverage/cobertura-coverage.xml'
                        }
                    }
                }
                
                stage('Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npm run test -- --coverage --watchAll=false'
                            sh 'npm run build'
                        }
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'frontend/test-results.xml'
                        }
                    }
                }
            }
        }
        
        stage('Security Scan') {
            parallel {
                stage('Dependency Check') {
                    steps {
                        sh 'npm audit --audit-level=high'
                        sh 'docker run --rm -v $(pwd):/app owasp/dependency-check --scan /app --format XML --out /app/dependency-check-report.xml'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'dependency-check-report.xml', fingerprint: true
                        }
                    }
                }
                
                stage('Code Quality') {
                    steps {
                        script {
                            def scannerHome = tool 'SonarQubeScanner'
                            withSonarQubeEnv('SonarQube') {
                                sh "${scannerHome}/bin/sonar-scanner"
                            }
                        }
                    }
                }
            }
        }
        
        stage('Build Docker Images') {
            steps {
                script {
                    def backendImage = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${env.GIT_COMMIT_SHORT}", "./backend")
                    def frontendImage = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${env.GIT_COMMIT_SHORT}", "./frontend")
                    
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                        backendImage.push()
                        backendImage.push('latest')
                        frontendImage.push()
                        frontendImage.push('latest')
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    kubernetesDeploy(
                        configs: 'k8s/staging/*.yaml',
                        kubeconfigId: 'kubeconfig',
                        enableConfigSubstitution: true
                    )
                }
                
                // Health check
                sh '''
                    kubectl wait --for=condition=ready pod -l app=quote-app-backend -n staging --timeout=300s
                    kubectl wait --for=condition=ready pod -l app=quote-app-frontend -n staging --timeout=300s
                '''
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy',
                      submitterParameter: 'DEPLOYER'
                
                script {
                    kubernetesDeploy(
                        configs: 'k8s/production/*.yaml',
                        kubeconfigId: 'kubeconfig',
                        enableConfigSubstitution: true
                    )
                }
                
                // Production health check
                sh '''
                    kubectl wait --for=condition=ready pod -l app=quote-app-backend -n production --timeout=600s
                    kubectl wait --for=condition=ready pod -l app=quote-app-frontend -n production --timeout=600s
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                channel: '#deployments',
                color: 'good',
                message: "✅ Pipeline succeeded for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ Pipeline failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

### Step 3: Multi-Branch Pipeline Strategy

Configure a multi-branch pipeline for automatic branch handling:

```groovy
// Jenkinsfile.multibranch
pipeline {
    agent none
    
    environment {
        DOCKER_REGISTRY = 'ghcr.io'
        IMAGE_NAME = 'quote-app'
    }
    
    stages {
        stage('Branch Strategy') {
            parallel {
                stage('Feature Branch') {
                    when {
                        not { anyOf { branch 'main'; branch 'develop' } }
                    }
                    agent { label 'docker' }
                    steps {
                        echo "Building feature branch: ${env.BRANCH_NAME}"
                        sh 'npm ci && npm test'
                        sh 'docker build -t temp-image .'
                    }
                }
                
                stage('Development Branch') {
                    when { branch 'develop' }
                    agent { label 'docker' }
                    steps {
                        echo "Building and deploying to staging"
                        sh 'npm ci && npm test'
                        script {
                            def image = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:develop-${env.BUILD_NUMBER}")
                            docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                                image.push()
                            }
                        }
                        // Deploy to staging
                        sh 'kubectl apply -f k8s/staging/'
                    }
                }
                
                stage('Main Branch') {
                    when { branch 'main' }
                    agent { label 'docker' }
                    steps {
                        echo "Building and preparing for production"
                        sh 'npm ci && npm test'
                        script {
                            def image = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}")
                            docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                                image.push()
                                image.push('latest')
                            }
                        }
                        // Production deployment requires manual approval
                        input message: 'Deploy to production?', ok: 'Deploy'
                        sh 'kubectl apply -f k8s/production/'
                    }
                }
            }
        }
    }
}
```

### Step 4: Advanced Deployment Strategies

Implement Blue-Green deployment:

```groovy
// Jenkinsfile.bluegreen
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'DEPLOYMENT_STRATEGY',
            choices: ['blue-green', 'rolling', 'canary'],
            description: 'Choose deployment strategy'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip test execution'
        )
    }
    
    stages {
        stage('Blue-Green Deployment') {
            when {
                expression { params.DEPLOYMENT_STRATEGY == 'blue-green' }
            }
            steps {
                script {
                    // Determine current active environment
                    def currentEnv = sh(
                        script: 'kubectl get service quote-app-service -o jsonpath="{.spec.selector.version}"',
                        returnStdout: true
                    ).trim()
                    
                    def targetEnv = currentEnv == 'blue' ? 'green' : 'blue'
                    
                    echo "Current environment: ${currentEnv}"
                    echo "Deploying to: ${targetEnv}"
                    
                    // Deploy to target environment
                    sh """
                        sed 's/VERSION_PLACEHOLDER/${targetEnv}/g' k8s/blue-green-template.yaml > k8s/blue-green-${targetEnv}.yaml
                        kubectl apply -f k8s/blue-green-${targetEnv}.yaml
                    """
                    
                    // Wait for deployment to be ready
                    sh "kubectl wait --for=condition=ready pod -l app=quote-app,version=${targetEnv} --timeout=300s"
                    
                    // Run smoke tests on target environment
                    sh """
                        TARGET_URL=\$(kubectl get service quote-app-${targetEnv} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                        curl -f http://\${TARGET_URL}/health
                    """
                    
                    // Switch traffic to target environment
                    input message: "Switch traffic to ${targetEnv} environment?", ok: 'Switch'
                    
                    sh """
                        kubectl patch service quote-app-service -p '{"spec":{"selector":{"version":"${targetEnv}"}}}'
                    """
                    
                    echo "Traffic switched to ${targetEnv} environment"
                    
                    // Cleanup old environment after successful switch
                    sh "kubectl delete deployment quote-app-${currentEnv} || true"
                }
            }
        }
        
        stage('Canary Deployment') {
            when {
                expression { params.DEPLOYMENT_STRATEGY == 'canary' }
            }
            steps {
                script {
                    // Deploy canary version (10% traffic)
                    sh '''
                        kubectl apply -f k8s/canary-deployment.yaml
                        kubectl patch service quote-app-service -p '{"spec":{"selector":{"version":"canary"}}}'
                    '''
                    
                    // Monitor canary for 5 minutes
                    echo "Monitoring canary deployment..."
                    sleep(time: 300, unit: 'SECONDS')
                    
                    // Check metrics and decide
                    def canaryHealthy = sh(
                        script: 'kubectl get pods -l version=canary -o jsonpath="{.items[*].status.phase}" | grep -c Running',
                        returnStdout: true
                    ).trim().toInteger() > 0
                    
                    if (canaryHealthy) {
                        input message: 'Promote canary to full deployment?', ok: 'Promote'
                        
                        // Promote canary to full deployment
                        sh '''
                            kubectl scale deployment quote-app-canary --replicas=3
                            kubectl scale deployment quote-app-stable --replicas=0
                        '''
                    } else {
                        echo "Canary deployment failed, rolling back"
                        sh 'kubectl delete deployment quote-app-canary'
                    }
                }
            }
        }
    }
}
```

## 💪 Hands-On Challenges

### Challenge 1: Jenkins Setup and Configuration
**Objective**: Set up a complete Jenkins environment with agents

**Tasks**:
1. Deploy Jenkins using Docker Compose
2. Install required plugins (Blue Ocean, Kubernetes, Docker)
3. Configure Jenkins agents for distributed builds
4. Set up credentials for Docker registry and Kubernetes
5. Create a simple freestyle job

**Expected Outcome**: Fully functional Jenkins environment

### Challenge 2: Pipeline as Code
**Objective**: Create comprehensive declarative pipelines

**Tasks**:
1. Create a Jenkinsfile for the Quote application
2. Implement parallel stages for testing
3. Add security scanning and code quality checks
4. Configure artifact archiving and test reporting
5. Set up notifications for build status

**Expected Outcome**: Complete CI pipeline with quality gates

### Challenge 3: Multi-Branch Strategy
**Objective**: Implement automated branch-based deployments

**Tasks**:
1. Set up multi-branch pipeline
2. Configure different strategies for feature, develop, and main branches
3. Implement automatic staging deployment for develop branch
4. Add manual approval for production deployments
5. Set up branch protection and merge requirements

**Expected Outcome**: Automated branch-based CI/CD workflow

### Challenge 4: Advanced Deployment Patterns
**Objective**: Implement Blue-Green and Canary deployments

**Tasks**:
1. Create Blue-Green deployment pipeline
2. Implement traffic switching mechanism
3. Set up Canary deployment with monitoring
4. Add rollback capabilities
5. Configure deployment metrics and alerts

**Expected Outcome**: Production-ready deployment strategies

## ✅ Validation Steps

### 1. Verify Jenkins Installation
```bash
# Check Jenkins is running
docker ps | grep jenkins

# Access Jenkins UI
curl -I http://localhost:8080

# Check installed plugins
curl -s http://admin:admin123@localhost:8080/pluginManager/api/json?depth=1
```

### 2. Test Pipeline Execution
```bash
# Trigger pipeline via CLI
java -jar jenkins-cli.jar -s http://localhost:8080 -auth admin:admin123 build quote-app-pipeline

# Check build status
java -jar jenkins-cli.jar -s http://localhost:8080 -auth admin:admin123 get-build quote-app-pipeline 1
```

### 3. Validate Kubernetes Integration
```bash
# Check Kubernetes plugin configuration
kubectl get pods -n jenkins

# Verify deployments
kubectl get deployments -n staging
kubectl get deployments -n production
```

### 4. Test Blue-Green Deployment
```bash
# Check current active environment
kubectl get service quote-app-service -o jsonpath='{.spec.selector.version}'

# Verify both environments exist
kubectl get deployments -l app=quote-app
```

## 🔧 Troubleshooting

### Common Issues

**1. Jenkins Agent Connection Issues**
```bash
# Check agent logs
docker logs jenkins-agent-1

# Verify network connectivity
docker exec jenkins-agent-1 ping jenkins

# Check agent secret
echo $JENKINS_AGENT_SECRET
```

**2. Pipeline Permission Errors**
```bash
# Check Jenkins user permissions
kubectl auth can-i create deployments --as=system:serviceaccount:jenkins:jenkins

# Update service account permissions
kubectl apply -f jenkins-rbac.yaml
```

**3. Docker Build Failures**
```bash
# Check Docker daemon access
docker exec jenkins ls -la /var/run/docker.sock

# Verify Docker group membership
docker exec jenkins groups jenkins
```

**4. Kubernetes Deployment Issues**
```bash
# Check kubeconfig
kubectl config current-context

# Verify namespace exists
kubectl get namespace staging production

# Check resource quotas
kubectl describe quota -n staging
```

### Debug Commands
```bash
# Jenkins logs
docker logs jenkins-master

# Pipeline console output
curl -s http://admin:admin123@localhost:8080/job/quote-app-pipeline/1/consoleText

# Kubernetes events
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 📚 Additional Resources

### Jenkins Documentation
- [Jenkins User Documentation](https://www.jenkins.io/doc/)
- [Pipeline Syntax Reference](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Blue Ocean Documentation](https://www.jenkins.io/doc/book/blueocean/)

### Best Practices
- [Jenkins Security Best Practices](https://www.jenkins.io/doc/book/security/)
- [Pipeline Best Practices](https://www.jenkins.io/doc/book/pipeline/pipeline-best-practices/)
- [Scaling Jenkins](https://www.jenkins.io/doc/book/scaling/)

### Tools and Plugins
- [Jenkins Plugin Index](https://plugins.jenkins.io/)
- [Jenkins CLI](https://www.jenkins.io/doc/book/managing/cli/)
- [Jenkins Configuration as Code](https://github.com/jenkinsci/configuration-as-code-plugin)

## 🎯 Key Takeaways

1. **Pipeline as Code**: Version control your CI/CD pipelines
2. **Distributed Builds**: Use agents for scalable build execution
3. **Security First**: Implement security scanning and access controls
4. **Deployment Strategies**: Use advanced patterns for zero-downtime deployments
5. **Monitoring**: Track pipeline performance and deployment metrics

## 🚀 Next Steps

After completing this module:
1. Explore Jenkins X for Kubernetes-native CI/CD
2. Implement GitOps workflows with ArgoCD
3. Set up advanced monitoring and observability
4. Consider migrating to cloud-native CI/CD solutions

---

**Ready to master enterprise CI/CD?** Start with Challenge 1 and build your Jenkins expertise! 🚀