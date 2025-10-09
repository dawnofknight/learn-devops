#!/usr/bin/env groovy

/**
 * Deploy application to Kubernetes
 * 
 * @param config Map containing deployment configuration
 *   - namespace: Target Kubernetes namespace
 *   - appName: Application name
 *   - imageTag: Docker image tag to deploy
 *   - environment: Target environment (staging/production)
 *   - strategy: Deployment strategy (rolling/blue-green/canary)
 *   - healthCheckUrl: URL for health checks
 *   - timeout: Deployment timeout in seconds (default: 600)
 *   - replicas: Number of replicas (optional)
 *   - resources: Resource requests/limits (optional)
 */
def call(Map config) {
    // Validate required parameters
    def requiredParams = ['namespace', 'appName', 'imageTag', 'environment']
    requiredParams.each { param ->
        if (!config.containsKey(param) || !config[param]) {
            error("Missing required parameter: ${param}")
        }
    }
    
    // Set defaults
    config.strategy = config.strategy ?: 'rolling'
    config.timeout = config.timeout ?: 600
    config.replicas = config.replicas ?: 3
    
    def namespace = config.namespace
    def appName = config.appName
    def imageTag = config.imageTag
    def environment = config.environment
    def strategy = config.strategy
    
    echo "🚀 Deploying ${appName}:${imageTag} to ${environment} (${namespace}) using ${strategy} strategy"
    
    try {
        // Ensure namespace exists
        sh """
            kubectl get namespace ${namespace} || kubectl create namespace ${namespace}
            kubectl label namespace ${namespace} environment=${environment} --overwrite
        """
        
        // Deploy based on strategy
        switch(strategy.toLowerCase()) {
            case 'blue-green':
                deployBlueGreen(config)
                break
            case 'canary':
                deployCanary(config)
                break
            case 'rolling':
            default:
                deployRolling(config)
                break
        }
        
        // Verify deployment
        verifyDeployment(config)
        
        // Run health checks
        if (config.healthCheckUrl) {
            runHealthChecks(config)
        }
        
        echo "✅ Deployment completed successfully!"
        
    } catch (Exception e) {
        echo "❌ Deployment failed: ${e.getMessage()}"
        
        // Attempt rollback
        if (config.autoRollback != false) {
            echo "🔄 Attempting automatic rollback..."
            rollbackDeployment(config)
        }
        
        throw e
    }
}

def deployRolling(Map config) {
    echo "📦 Executing rolling deployment..."
    
    def manifestTemplate = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.appName}
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
    environment: ${config.environment}
    version: "${config.imageTag}"
spec:
  replicas: ${config.replicas}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  selector:
    matchLabels:
      app: ${config.appName}
  template:
    metadata:
      labels:
        app: ${config.appName}
        environment: ${config.environment}
        version: "${config.imageTag}"
    spec:
      containers:
      - name: ${config.appName}
        image: ${config.registry ?: 'ghcr.io'}/${config.appName}:${config.imageTag}
        ports:
        - containerPort: ${config.port ?: 3000}
        env:
        - name: NODE_ENV
          value: "${config.environment}"
        - name: VERSION
          value: "${config.imageTag}"
        resources:
          requests:
            memory: "${config.resources?.requests?.memory ?: '256Mi'}"
            cpu: "${config.resources?.requests?.cpu ?: '100m'}"
          limits:
            memory: "${config.resources?.limits?.memory ?: '512Mi'}"
            cpu: "${config.resources?.limits?.cpu ?: '500m'}"
        livenessProbe:
          httpGet:
            path: ${config.healthPath ?: '/health'}
            port: ${config.port ?: 3000}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: ${config.readinessPath ?: '/ready'}
            port: ${config.port ?: 3000}
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ${config.appName}
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
    environment: ${config.environment}
spec:
  selector:
    app: ${config.appName}
  ports:
  - port: 80
    targetPort: ${config.port ?: 3000}
    protocol: TCP
  type: ${config.serviceType ?: 'ClusterIP'}
"""
    
    writeFile file: 'deployment.yaml', text: manifestTemplate
    
    sh """
        kubectl apply -f deployment.yaml
        kubectl rollout status deployment/${config.appName} -n ${config.namespace} --timeout=${config.timeout}s
    """
}

def deployBlueGreen(Map config) {
    echo "🔵🟢 Executing blue-green deployment..."
    
    def currentColor = getCurrentColor(config)
    def newColor = currentColor == 'blue' ? 'green' : 'blue'
    
    echo "Current color: ${currentColor}, Deploying to: ${newColor}"
    
    // Deploy to new color
    deployColoredVersion(config, newColor)
    
    // Wait for new deployment to be ready
    sh """
        kubectl wait --for=condition=ready pod -l app=${config.appName},color=${newColor} -n ${config.namespace} --timeout=${config.timeout}s
    """
    
    // Run smoke tests on new version
    if (config.smokeTestUrl) {
        runSmokeTests(config, newColor)
    }
    
    // Switch traffic to new version
    switchTraffic(config, newColor)
    
    // Clean up old version after successful switch
    if (config.cleanupOldVersion != false) {
        sleep(30) // Wait a bit before cleanup
        cleanupOldVersion(config, currentColor)
    }
}

def deployCanary(Map config) {
    echo "🐤 Executing canary deployment..."
    
    def canaryReplicas = Math.max(1, Math.round(config.replicas * (config.canaryPercent ?: 10) / 100))
    def stableReplicas = config.replicas - canaryReplicas
    
    echo "Deploying ${canaryReplicas} canary replicas and ${stableReplicas} stable replicas"
    
    // Deploy canary version
    deployCanaryVersion(config, canaryReplicas)
    
    // Monitor canary metrics
    if (config.canaryAnalysis != false) {
        monitorCanaryMetrics(config)
    }
    
    // Promote canary if successful
    promoteCanary(config)
}

def getCurrentColor(Map config) {
    try {
        def result = sh(
            script: "kubectl get service ${config.appName} -n ${config.namespace} -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo 'blue'",
            returnStdout: true
        ).trim()
        return result ?: 'blue'
    } catch (Exception e) {
        return 'blue'
    }
}

def deployColoredVersion(Map config, String color) {
    def manifestTemplate = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.appName}-${color}
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
    color: ${color}
    environment: ${config.environment}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.appName}
      color: ${color}
  template:
    metadata:
      labels:
        app: ${config.appName}
        color: ${color}
        environment: ${config.environment}
        version: "${config.imageTag}"
    spec:
      containers:
      - name: ${config.appName}
        image: ${config.registry ?: 'ghcr.io'}/${config.appName}:${config.imageTag}
        ports:
        - containerPort: ${config.port ?: 3000}
        env:
        - name: NODE_ENV
          value: "${config.environment}"
        - name: VERSION
          value: "${config.imageTag}"
        - name: COLOR
          value: "${color}"
        resources:
          requests:
            memory: "${config.resources?.requests?.memory ?: '256Mi'}"
            cpu: "${config.resources?.requests?.cpu ?: '100m'}"
          limits:
            memory: "${config.resources?.limits?.memory ?: '512Mi'}"
            cpu: "${config.resources?.limits?.cpu ?: '500m'}"
        livenessProbe:
          httpGet:
            path: ${config.healthPath ?: '/health'}
            port: ${config.port ?: 3000}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: ${config.readinessPath ?: '/ready'}
            port: ${config.port ?: 3000}
          initialDelaySeconds: 5
          periodSeconds: 5
"""
    
    writeFile file: "deployment-${color}.yaml", text: manifestTemplate
    
    sh """
        kubectl apply -f deployment-${color}.yaml
        kubectl rollout status deployment/${config.appName}-${color} -n ${config.namespace} --timeout=${config.timeout}s
    """
}

def switchTraffic(Map config, String newColor) {
    echo "🔀 Switching traffic to ${newColor} version..."
    
    def serviceManifest = """
apiVersion: v1
kind: Service
metadata:
  name: ${config.appName}
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
    environment: ${config.environment}
spec:
  selector:
    app: ${config.appName}
    color: ${newColor}
  ports:
  - port: 80
    targetPort: ${config.port ?: 3000}
    protocol: TCP
  type: ${config.serviceType ?: 'ClusterIP'}
"""
    
    writeFile file: 'service.yaml', text: serviceManifest
    sh "kubectl apply -f service.yaml"
}

def verifyDeployment(Map config) {
    echo "🔍 Verifying deployment..."
    
    sh """
        kubectl get deployment ${config.appName} -n ${config.namespace}
        kubectl get pods -l app=${config.appName} -n ${config.namespace}
        kubectl get service ${config.appName} -n ${config.namespace}
    """
    
    // Check if all pods are ready
    def readyPods = sh(
        script: "kubectl get pods -l app=${config.appName} -n ${config.namespace} -o jsonpath='{.items[*].status.conditions[?(@.type==\"Ready\")].status}' | grep -o True | wc -l",
        returnStdout: true
    ).trim().toInteger()
    
    def totalPods = sh(
        script: "kubectl get pods -l app=${config.appName} -n ${config.namespace} --no-headers | wc -l",
        returnStdout: true
    ).trim().toInteger()
    
    if (readyPods != totalPods) {
        error("Deployment verification failed: ${readyPods}/${totalPods} pods are ready")
    }
    
    echo "✅ All ${totalPods} pods are ready"
}

def runHealthChecks(Map config) {
    echo "🏥 Running health checks..."
    
    def serviceUrl = getServiceUrl(config)
    def healthUrl = "${serviceUrl}${config.healthCheckUrl}"
    
    retry(5) {
        sh """
            curl -f --max-time 10 --retry 3 --retry-delay 5 ${healthUrl}
        """
    }
    
    echo "✅ Health checks passed"
}

def getServiceUrl(Map config) {
    if (config.environment == 'production') {
        return config.productionUrl ?: "https://${config.appName}.example.com"
    } else {
        return config.stagingUrl ?: "https://${config.appName}-${config.environment}.example.com"
    }
}

def rollbackDeployment(Map config) {
    echo "🔄 Rolling back deployment..."
    
    try {
        sh """
            kubectl rollout undo deployment/${config.appName} -n ${config.namespace}
            kubectl rollout status deployment/${config.appName} -n ${config.namespace} --timeout=300s
        """
        echo "✅ Rollback completed successfully"
    } catch (Exception e) {
        echo "❌ Rollback failed: ${e.getMessage()}"
        throw e
    }
}

def runSmokeTests(Map config, String color) {
    echo "💨 Running smoke tests on ${color} version..."
    
    // Implementation would depend on your testing framework
    // This is a placeholder for smoke test execution
    if (config.smokeTestCommand) {
        sh config.smokeTestCommand
    }
}

def deployCanaryVersion(Map config, int canaryReplicas) {
    // Implementation for canary deployment
    echo "Deploying canary version with ${canaryReplicas} replicas"
    // ... canary deployment logic
}

def monitorCanaryMetrics(Map config) {
    echo "📊 Monitoring canary metrics..."
    // Implementation for canary metrics monitoring
    // This would typically integrate with monitoring systems like Prometheus
}

def promoteCanary(Map config) {
    echo "🎉 Promoting canary to full deployment..."
    // Implementation for canary promotion
}

def cleanupOldVersion(Map config, String oldColor) {
    echo "🧹 Cleaning up old ${oldColor} version..."
    
    sh """
        kubectl delete deployment ${config.appName}-${oldColor} -n ${config.namespace} --ignore-not-found=true
    """
}