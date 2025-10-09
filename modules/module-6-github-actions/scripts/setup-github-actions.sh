#!/bin/bash

# GitHub Actions Setup Script
# This script helps set up GitHub Actions workflows for your repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "This is not a Git repository. Please run this script from your project root."
        exit 1
    fi
    print_status "Git repository detected"
}

# Check if GitHub CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        print_warning "GitHub CLI (gh) is not installed. Some features will be limited."
        print_status "Install GitHub CLI: https://cli.github.com/"
        return 1
    fi
    print_status "GitHub CLI detected"
    return 0
}

# Create .github/workflows directory
create_workflows_dir() {
    print_header "Creating GitHub Actions directory structure"
    
    mkdir -p .github/workflows
    mkdir -p .github/ISSUE_TEMPLATE
    mkdir -p .github/PULL_REQUEST_TEMPLATE
    
    print_status "Created .github directory structure"
}

# Copy workflow files
copy_workflows() {
    print_header "Setting up GitHub Actions workflows"
    
    local module_path="modules/module-6-github-actions/.github/workflows"
    
    if [ -d "$module_path" ]; then
        cp "$module_path"/*.yml .github/workflows/
        print_status "Copied workflow files to .github/workflows/"
    else
        print_error "Module 6 workflow files not found. Please ensure you're running this from the project root."
        exit 1
    fi
}

# Create environment files
create_environment_files() {
    print_header "Creating environment configuration"
    
    # Create .env.example
    cat > .env.example << 'EOF'
# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quotedb
DB_USER=quoteuser
DB_PASSWORD=your_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# External APIs
QUOTE_API_KEY=your_quote_api_key_here

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
EOF

    print_status "Created .env.example file"
}

# Create GitHub issue templates
create_issue_templates() {
    print_header "Creating GitHub issue templates"
    
    # Bug report template
    cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. iOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
EOF

    # Feature request template
    cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
EOF

    print_status "Created GitHub issue templates"
}

# Create pull request template
create_pr_template() {
    print_header "Creating pull request template"
    
    cat > .github/PULL_REQUEST_TEMPLATE.md << 'EOF'
## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Security scan passed

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information that reviewers should know.
EOF

    print_status "Created pull request template"
}

# Set up repository secrets (if GitHub CLI is available)
setup_secrets() {
    if ! check_gh_cli; then
        print_warning "Skipping secrets setup - GitHub CLI not available"
        return
    fi
    
    print_header "Setting up repository secrets"
    
    echo "The following secrets need to be configured in your GitHub repository:"
    echo "1. SNYK_TOKEN - For security scanning"
    echo "2. SLACK_WEBHOOK_URL - For notifications"
    echo "3. SECURITY_SLACK_WEBHOOK - For security alerts"
    echo "4. AWS_ACCESS_KEY_ID - For AWS deployments"
    echo "5. AWS_SECRET_ACCESS_KEY - For AWS deployments"
    echo ""
    
    read -p "Would you like to set up secrets now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Setting up secrets..."
        echo "Note: You can also set these up manually in GitHub Settings > Secrets and variables > Actions"
        
        # Example of setting a secret (user would need to provide the value)
        read -p "Enter your Snyk token (or press Enter to skip): " snyk_token
        if [ ! -z "$snyk_token" ]; then
            gh secret set SNYK_TOKEN --body "$snyk_token"
            print_status "SNYK_TOKEN secret set"
        fi
        
        read -p "Enter your Slack webhook URL (or press Enter to skip): " slack_webhook
        if [ ! -z "$slack_webhook" ]; then
            gh secret set SLACK_WEBHOOK_URL --body "$slack_webhook"
            print_status "SLACK_WEBHOOK_URL secret set"
        fi
    fi
}

# Create GitHub environments
setup_environments() {
    if ! check_gh_cli; then
        print_warning "Skipping environments setup - GitHub CLI not available"
        return
    fi
    
    print_header "Setting up GitHub environments"
    
    echo "Creating staging and production environments..."
    
    # Note: Environment creation via CLI might require additional permissions
    echo "Environments should be created manually in GitHub Settings > Environments"
    echo "Create the following environments:"
    echo "1. staging - with automatic deployment"
    echo "2. production - with required reviewers"
}

# Main setup function
main() {
    print_header "GitHub Actions Setup for Cloud-Native Learning Path"
    echo "This script will set up GitHub Actions workflows for your repository."
    echo ""
    
    # Check prerequisites
    check_git_repo
    
    # Create directory structure
    create_workflows_dir
    
    # Copy workflow files
    copy_workflows
    
    # Create configuration files
    create_environment_files
    
    # Create GitHub templates
    create_issue_templates
    create_pr_template
    
    # Set up secrets and environments
    setup_secrets
    setup_environments
    
    print_header "Setup Complete!"
    echo ""
    print_status "GitHub Actions workflows have been set up successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review and customize the workflow files in .github/workflows/"
    echo "2. Set up repository secrets in GitHub Settings"
    echo "3. Create staging and production environments"
    echo "4. Push your changes to trigger the first workflow run"
    echo ""
    echo "For more information, see the README in modules/module-6-github-actions/"
}

# Run main function
main "$@"