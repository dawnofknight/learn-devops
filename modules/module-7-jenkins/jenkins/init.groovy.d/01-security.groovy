#!groovy

import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstance()

// Disable CLI over remoting
instance.getDescriptor("jenkins.CLI").get().setEnabled(false)

// Enable Agent to Master Access Control
instance.getInjector().getInstance(AdminWhitelistRule.class).setMasterKillSwitch(false)

// Disable usage statistics
instance.setNoUsageStatistics(true)

// Set number of executors
instance.setNumExecutors(2)

// Configure security realm if not already configured
if (!(instance.getSecurityRealm() instanceof HudsonPrivateSecurityRealm)) {
    println "Configuring security realm..."
    
    def hudsonRealm = new HudsonPrivateSecurityRealm(false)
    instance.setSecurityRealm(hudsonRealm)
    
    // Create admin user if it doesn't exist
    def adminUsername = System.getenv('JENKINS_ADMIN_ID') ?: 'admin'
    def adminPassword = System.getenv('JENKINS_ADMIN_PASSWORD') ?: 'admin123'
    
    if (!hudsonRealm.getAllUsers().find { it.getId() == adminUsername }) {
        hudsonRealm.createAccount(adminUsername, adminPassword)
        println "Admin user created: ${adminUsername}"
    }
}

// Configure authorization strategy
if (!(instance.getAuthorizationStrategy() instanceof GlobalMatrixAuthorizationStrategy)) {
    println "Configuring authorization strategy..."
    
    def strategy = new GlobalMatrixAuthorizationStrategy()
    
    // Grant admin permissions to admin user
    def adminUsername = System.getenv('JENKINS_ADMIN_ID') ?: 'admin'
    strategy.add(Jenkins.ADMINISTER, adminUsername)
    
    // Grant read permissions to authenticated users
    strategy.add(Jenkins.READ, "authenticated")
    strategy.add(Item.READ, "authenticated")
    strategy.add(Item.BUILD, "authenticated")
    strategy.add(Item.CANCEL, "authenticated")
    strategy.add(Item.WORKSPACE, "authenticated")
    strategy.add(View.READ, "authenticated")
    
    instance.setAuthorizationStrategy(strategy)
}

// Configure CSRF protection
instance.setCrumbIssuer(new DefaultCrumbIssuer(true))

// Save configuration
instance.save()

println "Security configuration completed successfully!"