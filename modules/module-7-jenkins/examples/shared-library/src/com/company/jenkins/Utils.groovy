package com.company.jenkins

/**
 * Utility class for common Jenkins pipeline functions
 */
class Utils implements Serializable {
    
    def script
    
    Utils(script) {
        this.script = script
    }
    
    /**
     * Get current timestamp in ISO format
     */
    String getCurrentTimestamp() {
        return new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'")
    }
    
    /**
     * Get short Git commit hash
     */
    String getShortCommitHash() {
        try {
            return script.sh(
                script: "git rev-parse --short HEAD",
                returnStdout: true
            ).trim()
        } catch (Exception e) {
            return 'unknown'
        }
    }
    
    /**
     * Get Git branch name
     */
    String getBranchName() {
        return script.env.BRANCH_NAME ?: script.env.GIT_BRANCH ?: 'unknown'
    }
    
    /**
     * Check if current branch is main/master
     */
    boolean isMainBranch() {
        def branch = getBranchName()
        return branch == 'main' || branch == 'master' || branch == 'origin/main' || branch == 'origin/master'
    }
    
    /**
     * Check if current branch is a feature branch
     */
    boolean isFeatureBranch() {
        def branch = getBranchName()
        return branch.startsWith('feature/') || branch.startsWith('feat/')
    }
    
    /**
     * Check if current branch is a release branch
     */
    boolean isReleaseBranch() {
        def branch = getBranchName()
        return branch.startsWith('release/') || branch.startsWith('rel/')
    }
    
    /**
     * Check if current branch is a hotfix branch
     */
    boolean isHotfixBranch() {
        def branch = getBranchName()
        return branch.startsWith('hotfix/') || branch.startsWith('fix/')
    }
    
    /**
     * Generate semantic version based on branch and build number
     */
    String generateVersion() {
        def branch = getBranchName()
        def buildNumber = script.env.BUILD_NUMBER ?: '0'
        def shortHash = getShortCommitHash()
        
        if (isMainBranch()) {
            return "1.0.${buildNumber}"
        } else if (isReleaseBranch()) {
            def version = branch.replaceAll(/^release\//, '')
            return "${version}-rc.${buildNumber}"
        } else if (isHotfixBranch()) {
            def version = branch.replaceAll(/^hotfix\//, '')
            return "${version}-hotfix.${buildNumber}"
        } else {
            return "0.0.${buildNumber}-${shortHash}"
        }
    }
    
    /**
     * Get environment based on branch
     */
    String getEnvironmentFromBranch() {
        def branch = getBranchName()
        
        if (isMainBranch()) {
            return 'production'
        } else if (branch == 'develop' || branch == 'development') {
            return 'staging'
        } else if (isReleaseBranch()) {
            return 'pre-production'
        } else {
            return 'development'
        }
    }
    
    /**
     * Check if file exists
     */
    boolean fileExists(String filePath) {
        return script.fileExists(filePath)
    }
    
    /**
     * Read JSON file
     */
    Map readJsonFile(String filePath) {
        if (!fileExists(filePath)) {
            throw new Exception("File not found: ${filePath}")
        }
        return script.readJSON(file: filePath)
    }
    
    /**
     * Write JSON file
     */
    void writeJsonFile(String filePath, Map data) {
        script.writeJSON(file: filePath, json: data)
    }
    
    /**
     * Read YAML file
     */
    Map readYamlFile(String filePath) {
        if (!fileExists(filePath)) {
            throw new Exception("File not found: ${filePath}")
        }
        return script.readYaml(file: filePath)
    }
    
    /**
     * Write YAML file
     */
    void writeYamlFile(String filePath, Map data) {
        script.writeYaml(file: filePath, data: data)
    }
    
    /**
     * Execute shell command and return output
     */
    String executeCommand(String command, boolean returnStdout = true) {
        return script.sh(
            script: command,
            returnStdout: returnStdout
        ).trim()
    }
    
    /**
     * Execute shell command and return exit code
     */
    int executeCommandWithStatus(String command) {
        return script.sh(
            script: command,
            returnStatus: true
        )
    }
    
    /**
     * Retry a closure with exponential backoff
     */
    def retryWithBackoff(int maxRetries, int initialDelay = 1, Closure closure) {
        def attempt = 0
        def delay = initialDelay
        
        while (attempt < maxRetries) {
            try {
                return closure()
            } catch (Exception e) {
                attempt++
                if (attempt >= maxRetries) {
                    throw e
                }
                
                script.echo "Attempt ${attempt} failed: ${e.getMessage()}"
                script.echo "Retrying in ${delay} seconds..."
                script.sleep(delay)
                
                delay *= 2 // Exponential backoff
            }
        }
    }
    
    /**
     * Parse semantic version
     */
    Map parseVersion(String version) {
        def pattern = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?(?:\+([a-zA-Z0-9\-\.]+))?$/
        def matcher = version =~ pattern
        
        if (!matcher.matches()) {
            throw new Exception("Invalid semantic version: ${version}")
        }
        
        return [
            major: matcher[0][1] as Integer,
            minor: matcher[0][2] as Integer,
            patch: matcher[0][3] as Integer,
            prerelease: matcher[0][4],
            build: matcher[0][5]
        ]
    }
    
    /**
     * Compare semantic versions
     */
    int compareVersions(String version1, String version2) {
        def v1 = parseVersion(version1)
        def v2 = parseVersion(version2)
        
        // Compare major
        if (v1.major != v2.major) {
            return v1.major <=> v2.major
        }
        
        // Compare minor
        if (v1.minor != v2.minor) {
            return v1.minor <=> v2.minor
        }
        
        // Compare patch
        if (v1.patch != v2.patch) {
            return v1.patch <=> v2.patch
        }
        
        // Compare prerelease
        if (v1.prerelease && !v2.prerelease) {
            return -1
        } else if (!v1.prerelease && v2.prerelease) {
            return 1
        } else if (v1.prerelease && v2.prerelease) {
            return v1.prerelease <=> v2.prerelease
        }
        
        return 0
    }
    
    /**
     * Get Docker registry URL based on environment
     */
    String getDockerRegistry(String environment = null) {
        environment = environment ?: getEnvironmentFromBranch()
        
        switch (environment) {
            case 'production':
                return script.env.PROD_DOCKER_REGISTRY ?: 'ghcr.io'
            case 'staging':
                return script.env.STAGING_DOCKER_REGISTRY ?: 'ghcr.io'
            default:
                return script.env.DEV_DOCKER_REGISTRY ?: 'ghcr.io'
        }
    }
    
    /**
     * Get Kubernetes namespace based on environment
     */
    String getKubernetesNamespace(String appName, String environment = null) {
        environment = environment ?: getEnvironmentFromBranch()
        
        switch (environment) {
            case 'production':
                return "${appName}-prod"
            case 'staging':
                return "${appName}-staging"
            case 'pre-production':
                return "${appName}-preprod"
            default:
                return "${appName}-dev"
        }
    }
    
    /**
     * Generate build metadata
     */
    Map generateBuildMetadata() {
        return [
            buildNumber: script.env.BUILD_NUMBER,
            buildUrl: script.env.BUILD_URL,
            jobName: script.env.JOB_NAME,
            branch: getBranchName(),
            commit: script.env.GIT_COMMIT,
            shortCommit: getShortCommitHash(),
            timestamp: getCurrentTimestamp(),
            version: generateVersion(),
            environment: getEnvironmentFromBranch(),
            triggeredBy: getTriggerCause()
        ]
    }
    
    /**
     * Get build trigger cause
     */
    String getTriggerCause() {
        try {
            def causes = script.currentBuild.getBuildCauses()
            if (causes && causes.size() > 0) {
                def cause = causes[0]
                if (cause._class.contains('UserIdCause')) {
                    return "user:${cause.userId}"
                } else if (cause._class.contains('SCMTrigger')) {
                    return 'scm'
                } else if (cause._class.contains('TimerTrigger')) {
                    return 'timer'
                } else if (cause._class.contains('UpstreamCause')) {
                    return "upstream:${cause.upstreamProject}"
                }
            }
            return 'unknown'
        } catch (Exception e) {
            return 'unknown'
        }
    }
    
    /**
     * Validate required environment variables
     */
    void validateEnvironmentVariables(List<String> requiredVars) {
        def missingVars = []
        
        requiredVars.each { varName ->
            if (!script.env."${varName}") {
                missingVars.add(varName)
            }
        }
        
        if (missingVars.size() > 0) {
            throw new Exception("Missing required environment variables: ${missingVars.join(', ')}")
        }
    }
    
    /**
     * Create directory if it doesn't exist
     */
    void ensureDirectory(String dirPath) {
        script.sh "mkdir -p ${dirPath}"
    }
    
    /**
     * Archive build artifacts
     */
    void archiveArtifacts(String pattern, boolean allowEmpty = true) {
        script.archiveArtifacts(
            artifacts: pattern,
            allowEmptyArchive: allowEmpty,
            fingerprint: true
        )
    }
    
    /**
     * Send email notification
     */
    void sendEmail(String to, String subject, String body, String attachments = null) {
        def emailParams = [
            to: to,
            subject: subject,
            body: body,
            mimeType: 'text/html'
        ]
        
        if (attachments) {
            emailParams.attachmentsPattern = attachments
        }
        
        script.emailext(emailParams)
    }
    
    /**
     * Get changed files in current build
     */
    List<String> getChangedFiles() {
        def changedFiles = []
        
        try {
            def changeLogSets = script.currentBuild.changeSets
            changeLogSets.each { changeLogSet ->
                changeLogSet.each { change ->
                    change.affectedFiles.each { file ->
                        changedFiles.add(file.path)
                    }
                }
            }
        } catch (Exception e) {
            script.echo "Could not retrieve changed files: ${e.getMessage()}"
        }
        
        return changedFiles.unique()
    }
    
    /**
     * Check if specific files have changed
     */
    boolean hasChangesInPath(String pathPattern) {
        def changedFiles = getChangedFiles()
        return changedFiles.any { file ->
            file.matches(pathPattern)
        }
    }
    
    /**
     * Get build duration in human readable format
     */
    String getBuildDuration() {
        def duration = script.currentBuild.duration
        if (!duration) {
            return 'Unknown'
        }
        
        def seconds = duration / 1000
        def minutes = seconds / 60
        def hours = minutes / 60
        
        if (hours >= 1) {
            return "${Math.round(hours)}h ${Math.round(minutes % 60)}m"
        } else if (minutes >= 1) {
            return "${Math.round(minutes)}m ${Math.round(seconds % 60)}s"
        } else {
            return "${Math.round(seconds)}s"
        }
    }
    
    /**
     * Clean workspace
     */
    void cleanWorkspace() {
        script.cleanWs(
            cleanWhenAborted: true,
            cleanWhenFailure: true,
            cleanWhenNotBuilt: true,
            cleanWhenSuccess: true,
            cleanWhenUnstable: true,
            deleteDirs: true
        )
    }
}