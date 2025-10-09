#!/usr/bin/env groovy

/**
 * Send Slack notification
 * 
 * @param config Map containing notification configuration
 *   - channel: Slack channel (required)
 *   - message: Custom message (optional)
 *   - status: Build status (SUCCESS, FAILURE, UNSTABLE, ABORTED)
 *   - color: Message color (good, warning, danger, or hex color)
 *   - title: Message title (optional)
 *   - fields: Additional fields to include
 *   - includeChanges: Include git changes (default: true)
 *   - includeTests: Include test results (default: true)
 *   - mentionOnFailure: Mention users/groups on failure
 *   - threadTs: Thread timestamp for replies
 */
def call(Map config) {
    // Validate required parameters
    if (!config.channel) {
        error("Missing required parameter: channel")
    }
    
    // Set defaults
    config.status = config.status ?: currentBuild.currentResult
    config.includeChanges = config.includeChanges != false
    config.includeTests = config.includeTests != false
    
    def status = config.status
    def color = determineColor(config.color, status)
    def emoji = determineEmoji(status)
    
    echo "📢 Sending Slack notification to ${config.channel} (Status: ${status})"
    
    try {
        def message = buildMessage(config, status, emoji)
        def attachments = buildAttachments(config, status, color)
        
        // Send the notification
        slackSend(
            channel: config.channel,
            color: color,
            message: message,
            attachments: attachments,
            teamDomain: config.teamDomain,
            token: config.token,
            botUser: config.botUser ?: true,
            failOnError: config.failOnError ?: false,
            timestamp: config.threadTs
        )
        
        echo "✅ Slack notification sent successfully"
        
    } catch (Exception e) {
        echo "❌ Failed to send Slack notification: ${e.getMessage()}"
        
        // Don't fail the build if notification fails
        if (config.failOnError) {
            throw e
        }
    }
}

def buildMessage(Map config, String status, String emoji) {
    def message = config.message
    
    if (!message) {
        def jobName = env.JOB_NAME ?: 'Unknown Job'
        def buildNumber = env.BUILD_NUMBER ?: 'Unknown'
        def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'Unknown'
        
        message = "${emoji} *${jobName}* - Build #${buildNumber}"
        
        if (branch != 'Unknown') {
            message += " (${branch})"
        }
        
        message += " - ${status}"
        
        // Add mention on failure
        if (status == 'FAILURE' && config.mentionOnFailure) {
            def mentions = config.mentionOnFailure instanceof List ? 
                config.mentionOnFailure.join(' ') : config.mentionOnFailure
            message = "${mentions} ${message}"
        }
    }
    
    return message
}

def buildAttachments(Map config, String status, String color) {
    def attachments = []
    
    // Main attachment with build details
    def mainAttachment = [
        color: color,
        fields: []
    ]
    
    // Add title if provided
    if (config.title) {
        mainAttachment.title = config.title
        mainAttachment.title_link = env.BUILD_URL
    }
    
    // Add basic build information
    addBasicFields(mainAttachment, status)
    
    // Add git changes if requested
    if (config.includeChanges) {
        addGitChanges(mainAttachment)
    }
    
    // Add test results if requested
    if (config.includeTests) {
        addTestResults(mainAttachment)
    }
    
    // Add custom fields
    if (config.fields) {
        config.fields.each { field ->
            mainAttachment.fields.add(field)
        }
    }
    
    // Add deployment information if available
    addDeploymentInfo(mainAttachment)
    
    // Add actions/buttons
    addActions(mainAttachment)
    
    attachments.add(mainAttachment)
    
    return attachments
}

def addBasicFields(Map attachment, String status) {
    def fields = attachment.fields
    
    // Job information
    fields.add([
        title: "Job",
        value: env.JOB_NAME ?: 'Unknown',
        short: true
    ])
    
    fields.add([
        title: "Build",
        value: "<${env.BUILD_URL}|#${env.BUILD_NUMBER}>",
        short: true
    ])
    
    // Branch information
    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'Unknown'
    if (branch != 'Unknown') {
        fields.add([
            title: "Branch",
            value: branch,
            short: true
        ])
    }
    
    // Duration
    def duration = currentBuild.durationString?.replace(' and counting', '') ?: 'Unknown'
    fields.add([
        title: "Duration",
        value: duration,
        short: true
    ])
    
    // Triggered by
    def triggeredBy = getTriggerCause()
    if (triggeredBy) {
        fields.add([
            title: "Triggered by",
            value: triggeredBy,
            short: true
        ])
    }
    
    // Status details
    if (status == 'FAILURE') {
        def failureReason = getFailureReason()
        if (failureReason) {
            fields.add([
                title: "Failure Reason",
                value: failureReason,
                short: false
            ])
        }
    }
}

def addGitChanges(Map attachment) {
    try {
        def changes = getGitChanges()
        if (changes) {
            attachment.fields.add([
                title: "Recent Changes",
                value: changes,
                short: false
            ])
        }
    } catch (Exception e) {
        echo "⚠️ Could not retrieve git changes: ${e.getMessage()}"
    }
}

def addTestResults(Map attachment) {
    try {
        def testResults = getTestResults()
        if (testResults) {
            attachment.fields.add([
                title: "Test Results",
                value: testResults,
                short: false
            ])
        }
    } catch (Exception e) {
        echo "⚠️ Could not retrieve test results: ${e.getMessage()}"
    }
}

def addDeploymentInfo(Map attachment) {
    // Add deployment information if environment variables are set
    if (env.DEPLOY_ENVIRONMENT) {
        attachment.fields.add([
            title: "Environment",
            value: env.DEPLOY_ENVIRONMENT,
            short: true
        ])
    }
    
    if (env.DEPLOY_VERSION) {
        attachment.fields.add([
            title: "Version",
            value: env.DEPLOY_VERSION,
            short: true
        ])
    }
    
    if (env.DEPLOY_URL) {
        attachment.fields.add([
            title: "Deployment URL",
            value: "<${env.DEPLOY_URL}|View Application>",
            short: false
        ])
    }
}

def addActions(Map attachment) {
    def actions = []
    
    // Add console log action
    actions.add([
        type: "button",
        text: "View Console",
        url: "${env.BUILD_URL}console"
    ])
    
    // Add changes action if available
    if (env.CHANGE_URL) {
        actions.add([
            type: "button",
            text: "View Changes",
            url: env.CHANGE_URL
        ])
    }
    
    // Add restart action for failed builds
    if (currentBuild.currentResult == 'FAILURE') {
        actions.add([
            type: "button",
            text: "Restart Build",
            url: "${env.BUILD_URL}rebuild"
        ])
    }
    
    if (actions.size() > 0) {
        attachment.actions = actions
    }
}

def determineColor(String customColor, String status) {
    if (customColor) {
        return customColor
    }
    
    switch (status) {
        case 'SUCCESS':
            return 'good'
        case 'FAILURE':
            return 'danger'
        case 'UNSTABLE':
            return 'warning'
        case 'ABORTED':
            return '#808080'
        default:
            return '#439FE0'
    }
}

def determineEmoji(String status) {
    switch (status) {
        case 'SUCCESS':
            return ':white_check_mark:'
        case 'FAILURE':
            return ':x:'
        case 'UNSTABLE':
            return ':warning:'
        case 'ABORTED':
            return ':stop_sign:'
        default:
            return ':information_source:'
    }
}

def getTriggerCause() {
    try {
        def causes = currentBuild.getBuildCauses()
        if (causes) {
            def cause = causes[0]
            if (cause._class.contains('UserIdCause')) {
                return "User: ${cause.userId}"
            } else if (cause._class.contains('SCMTrigger')) {
                return "SCM Change"
            } else if (cause._class.contains('TimerTrigger')) {
                return "Timer"
            } else if (cause._class.contains('UpstreamCause')) {
                return "Upstream: ${cause.upstreamProject} #${cause.upstreamBuild}"
            }
        }
        return null
    } catch (Exception e) {
        return null
    }
}

def getFailureReason() {
    try {
        def description = currentBuild.description
        if (description) {
            return description
        }
        
        // Try to get failure reason from build result
        def result = currentBuild.rawBuild.getResult()
        if (result) {
            return result.toString()
        }
        
        return null
    } catch (Exception e) {
        return null
    }
}

def getGitChanges() {
    try {
        def changes = []
        def changeLogSets = currentBuild.changeSets
        
        changeLogSets.each { changeLogSet ->
            changeLogSet.each { change ->
                def author = change.author?.displayName ?: 'Unknown'
                def message = change.msg?.take(100) ?: 'No message'
                if (change.msg?.length() > 100) {
                    message += '...'
                }
                changes.add("• ${message} - _${author}_")
            }
        }
        
        if (changes.size() > 5) {
            def remaining = changes.size() - 5
            changes = changes.take(5)
            changes.add("_... and ${remaining} more changes_")
        }
        
        return changes.size() > 0 ? changes.join('\n') : null
    } catch (Exception e) {
        return null
    }
}

def getTestResults() {
    try {
        def testResults = []
        
        // Try to get JUnit test results
        def testResultAction = currentBuild.rawBuild.getAction(hudson.tasks.junit.TestResultAction.class)
        if (testResultAction) {
            def result = testResultAction.getResult()
            def total = result.getTotalCount()
            def failed = result.getFailCount()
            def skipped = result.getSkipCount()
            def passed = total - failed - skipped
            
            testResults.add("✅ Passed: ${passed}")
            if (failed > 0) {
                testResults.add("❌ Failed: ${failed}")
            }
            if (skipped > 0) {
                testResults.add("⏭️ Skipped: ${skipped}")
            }
            testResults.add("📊 Total: ${total}")
        }
        
        return testResults.size() > 0 ? testResults.join(' | ') : null
    } catch (Exception e) {
        return null
    }
}

/**
 * Send a simple success notification
 */
def success(String channel, String message = null) {
    call([
        channel: channel,
        message: message,
        status: 'SUCCESS'
    ])
}

/**
 * Send a simple failure notification
 */
def failure(String channel, String message = null, String mentionOnFailure = null) {
    call([
        channel: channel,
        message: message,
        status: 'FAILURE',
        mentionOnFailure: mentionOnFailure
    ])
}

/**
 * Send a deployment notification
 */
def deployment(String channel, String environment, String version, String url = null) {
    def message = ":rocket: Deployment to *${environment}* completed successfully!"
    
    def fields = [
        [title: "Environment", value: environment, short: true],
        [title: "Version", value: version, short: true]
    ]
    
    if (url) {
        fields.add([title: "URL", value: "<${url}|View Application>", short: false])
    }
    
    call([
        channel: channel,
        message: message,
        status: 'SUCCESS',
        fields: fields
    ])
}

/**
 * Send a thread reply
 */
def reply(String channel, String threadTs, String message) {
    call([
        channel: channel,
        message: message,
        threadTs: threadTs
    ])
}