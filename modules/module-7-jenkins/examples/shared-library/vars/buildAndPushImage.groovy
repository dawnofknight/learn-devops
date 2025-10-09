#!/usr/bin/env groovy

/**
 * Build and push Docker image
 * 
 * @param config Map containing build configuration
 *   - appName: Application name (required)
 *   - imageTag: Docker image tag (required)
 *   - dockerfile: Path to Dockerfile (default: 'Dockerfile')
 *   - context: Build context path (default: '.')
 *   - registry: Docker registry URL (default: 'ghcr.io')
 *   - registryCredentials: Jenkins credentials ID for registry
 *   - buildArgs: Map of build arguments
 *   - platforms: Target platforms for multi-arch builds
 *   - cacheFrom: Cache source for Docker builds
 *   - cacheTo: Cache destination for Docker builds
 *   - labels: Map of labels to add to the image
 *   - push: Whether to push the image (default: true)
 *   - scan: Whether to scan the image for vulnerabilities (default: true)
 */
def call(Map config) {
    // Validate required parameters
    def requiredParams = ['appName', 'imageTag']
    requiredParams.each { param ->
        if (!config.containsKey(param) || !config[param]) {
            error("Missing required parameter: ${param}")
        }
    }
    
    // Set defaults
    config.dockerfile = config.dockerfile ?: 'Dockerfile'
    config.context = config.context ?: '.'
    config.registry = config.registry ?: 'ghcr.io'
    config.push = config.push != false
    config.scan = config.scan != false
    
    def appName = config.appName
    def imageTag = config.imageTag
    def fullImageName = "${config.registry}/${appName}:${imageTag}"
    def latestImageName = "${config.registry}/${appName}:latest"
    
    echo "🐳 Building Docker image: ${fullImageName}"
    
    try {
        // Prepare build context
        prepareBuildContext(config)
        
        // Build the image
        buildImage(config, fullImageName)
        
        // Tag as latest if this is a main branch build
        if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
            tagAsLatest(fullImageName, latestImageName)
        }
        
        // Scan image for vulnerabilities
        if (config.scan) {
            scanImage(fullImageName)
        }
        
        // Push image to registry
        if (config.push) {
            pushImage(config, fullImageName, latestImageName)
        }
        
        // Clean up local images to save space
        cleanupLocalImages(fullImageName, latestImageName)
        
        echo "✅ Docker image build and push completed successfully!"
        
        return [
            imageName: fullImageName,
            imageTag: imageTag,
            registry: config.registry,
            digest: getImageDigest(fullImageName)
        ]
        
    } catch (Exception e) {
        echo "❌ Docker build failed: ${e.getMessage()}"
        
        // Clean up on failure
        cleanupOnFailure(fullImageName, latestImageName)
        
        throw e
    }
}

def prepareBuildContext(Map config) {
    echo "📁 Preparing build context..."
    
    // Create .dockerignore if it doesn't exist
    if (!fileExists('.dockerignore')) {
        def dockerignoreContent = """
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.nyc_output
coverage
.coverage
.pytest_cache
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env
pip-log.txt
pip-delete-this-directory.txt
.tox
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.DS_Store
.vscode
.idea
*.swp
*.swo
*~
"""
        writeFile file: '.dockerignore', text: dockerignoreContent
        echo "📝 Created .dockerignore file"
    }
    
    // Validate Dockerfile exists
    if (!fileExists(config.dockerfile)) {
        error("Dockerfile not found: ${config.dockerfile}")
    }
    
    echo "✅ Build context prepared"
}

def buildImage(Map config, String fullImageName) {
    echo "🔨 Building Docker image..."
    
    def buildCommand = "docker build"
    
    // Add build arguments
    if (config.buildArgs) {
        config.buildArgs.each { key, value ->
            buildCommand += " --build-arg ${key}='${value}'"
        }
    }
    
    // Add default build arguments
    buildCommand += " --build-arg BUILD_DATE='${new Date().format('yyyy-MM-dd HH:mm:ss')}'"
    buildCommand += " --build-arg VCS_REF='${env.GIT_COMMIT ?: 'unknown'}'"
    buildCommand += " --build-arg VERSION='${config.imageTag}'"
    
    // Add labels
    def defaultLabels = [
        'org.opencontainers.image.title': config.appName,
        'org.opencontainers.image.version': config.imageTag,
        'org.opencontainers.image.created': new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'"),
        'org.opencontainers.image.revision': env.GIT_COMMIT ?: 'unknown',
        'org.opencontainers.image.source': env.GIT_URL ?: 'unknown',
        'org.opencontainers.image.url': env.BUILD_URL ?: 'unknown',
        'org.opencontainers.image.vendor': 'CI/CD Pipeline',
        'jenkins.build.number': env.BUILD_NUMBER ?: 'unknown',
        'jenkins.build.url': env.BUILD_URL ?: 'unknown'
    ]
    
    def allLabels = defaultLabels + (config.labels ?: [:])
    allLabels.each { key, value ->
        buildCommand += " --label '${key}=${value}'"
    }
    
    // Add cache options
    if (config.cacheFrom) {
        buildCommand += " --cache-from ${config.cacheFrom}"
    }
    
    if (config.cacheTo) {
        buildCommand += " --cache-to ${config.cacheTo}"
    }
    
    // Add platforms for multi-arch builds
    if (config.platforms) {
        buildCommand += " --platform ${config.platforms}"
    }
    
    // Add dockerfile and context
    buildCommand += " -f ${config.dockerfile}"
    buildCommand += " -t ${fullImageName}"
    buildCommand += " ${config.context}"
    
    echo "Executing: ${buildCommand}"
    
    def buildResult = sh(
        script: buildCommand,
        returnStatus: true
    )
    
    if (buildResult != 0) {
        error("Docker build failed with exit code: ${buildResult}")
    }
    
    echo "✅ Docker image built successfully"
}

def tagAsLatest(String fullImageName, String latestImageName) {
    echo "🏷️ Tagging image as latest..."
    
    sh "docker tag ${fullImageName} ${latestImageName}"
    
    echo "✅ Image tagged as latest"
}

def scanImage(String imageName) {
    echo "🔍 Scanning image for vulnerabilities..."
    
    try {
        // Use Trivy for vulnerability scanning
        sh """
            # Install Trivy if not available
            if ! command -v trivy &> /dev/null; then
                echo "Installing Trivy..."
                curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
            fi
            
            # Scan the image
            trivy image --exit-code 0 --severity HIGH,CRITICAL --format json --output trivy-report.json ${imageName}
            trivy image --exit-code 1 --severity CRITICAL ${imageName}
        """
        
        // Archive the scan results
        archiveArtifacts artifacts: 'trivy-report.json', allowEmptyArchive: true
        
        echo "✅ Image security scan completed"
        
    } catch (Exception e) {
        echo "⚠️ Image security scan found critical vulnerabilities"
        
        // Don't fail the build for security issues in non-production environments
        if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
            throw e
        } else {
            echo "🚨 Security issues found but continuing build for non-production branch"
        }
    }
}

def pushImage(Map config, String fullImageName, String latestImageName) {
    echo "📤 Pushing image to registry..."
    
    if (config.registryCredentials) {
        withCredentials([usernamePassword(
            credentialsId: config.registryCredentials,
            usernameVariable: 'REGISTRY_USER',
            passwordVariable: 'REGISTRY_PASS'
        )]) {
            sh """
                echo \$REGISTRY_PASS | docker login ${config.registry} -u \$REGISTRY_USER --password-stdin
            """
        }
    }
    
    // Push the tagged image
    sh "docker push ${fullImageName}"
    
    // Push latest tag if this is main branch
    if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
        sh "docker push ${latestImageName}"
        echo "✅ Pushed both ${fullImageName} and ${latestImageName}"
    } else {
        echo "✅ Pushed ${fullImageName}"
    }
    
    // Logout from registry
    if (config.registryCredentials) {
        sh "docker logout ${config.registry}"
    }
}

def getImageDigest(String imageName) {
    try {
        def digest = sh(
            script: "docker inspect --format='{{index .RepoDigests 0}}' ${imageName} | cut -d'@' -f2",
            returnStdout: true
        ).trim()
        return digest
    } catch (Exception e) {
        echo "⚠️ Could not retrieve image digest: ${e.getMessage()}"
        return null
    }
}

def cleanupLocalImages(String fullImageName, String latestImageName) {
    echo "🧹 Cleaning up local images..."
    
    try {
        sh """
            docker rmi ${fullImageName} || true
            if [ "${env.BRANCH_NAME}" = "main" ] || [ "${env.BRANCH_NAME}" = "master" ]; then
                docker rmi ${latestImageName} || true
            fi
            docker system prune -f || true
        """
        echo "✅ Local images cleaned up"
    } catch (Exception e) {
        echo "⚠️ Failed to clean up local images: ${e.getMessage()}"
    }
}

def cleanupOnFailure(String fullImageName, String latestImageName) {
    echo "🧹 Cleaning up after build failure..."
    
    try {
        sh """
            docker rmi ${fullImageName} || true
            docker rmi ${latestImageName} || true
            docker system prune -f || true
        """
    } catch (Exception e) {
        echo "⚠️ Failed to clean up after failure: ${e.getMessage()}"
    }
}

/**
 * Build multi-architecture image using buildx
 */
def buildMultiArch(Map config) {
    echo "🏗️ Building multi-architecture image..."
    
    def platforms = config.platforms ?: 'linux/amd64,linux/arm64'
    def fullImageName = "${config.registry}/${config.appName}:${config.imageTag}"
    
    sh """
        # Create and use buildx builder
        docker buildx create --name multiarch-builder --use || docker buildx use multiarch-builder
        
        # Build and push multi-arch image
        docker buildx build \\
            --platform ${platforms} \\
            --tag ${fullImageName} \\
            --push \\
            -f ${config.dockerfile} \\
            ${config.context}
    """
    
    echo "✅ Multi-architecture image built and pushed"
}

/**
 * Get image size information
 */
def getImageInfo(String imageName) {
    try {
        def size = sh(
            script: "docker images ${imageName} --format 'table {{.Size}}' | tail -n 1",
            returnStdout: true
        ).trim()
        
        def layers = sh(
            script: "docker history ${imageName} --format 'table {{.Size}}' | wc -l",
            returnStdout: true
        ).trim().toInteger() - 1
        
        return [
            size: size,
            layers: layers
        ]
    } catch (Exception e) {
        echo "⚠️ Could not retrieve image info: ${e.getMessage()}"
        return [size: 'unknown', layers: 0]
    }
}