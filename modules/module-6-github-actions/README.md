# Module 6: CI/CD with GitHub Actions

**Duration**: 2-3 hours  
**Objective**: Implement automated CI/CD pipelines for continuous delivery using GitHub Actions

## 🎯 Learning Objectives

By the end of this module, you will:
- Understand GitHub Actions workflow fundamentals
- Implement automated testing and code quality checks
- Build and push Docker images to registries
- Deploy applications to multiple environments
- Set up security scanning and vulnerability assessment
- Configure automated rollback and deployment validation

## 🔑 Key Concepts

### GitHub Actions Fundamentals
- **Workflows**: Automated processes triggered by events
- **Jobs**: Groups of steps that execute on the same runner
- **Steps**: Individual tasks within a job
- **Actions**: Reusable units of code
- **Runners**: Servers that execute workflows

### CI/CD Pipeline Stages
1. **Continuous Integration (CI)**
   - Code checkout and setup
   - Dependency installation
   - Automated testing
   - Code quality checks
   - Security scanning

2. **Continuous Deployment (CD)**
   - Docker image building
   - Registry publishing
   - Multi-environment deployment
   - Health checks and validation

## 📝 Tutorial

### Step 1: Basic Workflow Setup

Create your first GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Run linting
      run: npm run lint
```

### Step 2: Docker Build and Push

Add Docker image building to your pipeline:

```yaml
# .github/workflows/docker-build.yml
name: Docker Build and Push

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### Step 3: Multi-Environment Deployment

Set up deployment to different environments:

```yaml
# .github/workflows/deploy.yml
name: Deploy Application

on:
  workflow_run:
    workflows: ["Docker Build and Push"]
    types:
      - completed
    branches: [ main ]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Deploy to Staging
      run: |
        echo "Deploying to staging environment..."
        # Add your staging deployment commands here
        
    - name: Run health checks
      run: |
        echo "Running health checks..."
        # Add health check commands here
        
  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    needs: deploy-staging
    if: ${{ github.ref == 'refs/heads/main' }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Deploy to Production
      run: |
        echo "Deploying to production environment..."
        # Add your production deployment commands here
        
    - name: Run smoke tests
      run: |
        echo "Running smoke tests..."
        # Add smoke test commands here
```

### Step 4: Security Scanning

Add security scanning to your pipeline:

```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly scan

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Run dependency vulnerability scan
      uses: actions/dependency-review-action@v4
      if: github.event_name == 'pull_request'
      
    - name: Run npm audit
      run: npm audit --audit-level=high
      
  code-scan:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
      
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v3
      with:
        languages: javascript
        
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3
      
  docker-scan:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Build Docker image
      run: docker build -t test-image .
      
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'test-image'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'
```

## 💪 Hands-On Challenges

### Challenge 1: Basic CI Pipeline
**Objective**: Set up a basic CI pipeline for the Quote of the Day application

**Tasks**:
1. Create a `.github/workflows/ci.yml` file
2. Configure the workflow to run on push and pull requests
3. Add steps for:
   - Code checkout
   - Node.js setup
   - Dependency installation
   - Running tests
   - Code linting

**Expected Outcome**: Every push and PR triggers automated testing

### Challenge 2: Docker Build Pipeline
**Objective**: Automate Docker image building and publishing

**Tasks**:
1. Create a Docker build workflow
2. Configure GitHub Container Registry
3. Add image tagging strategy
4. Implement build caching
5. Test the pipeline by pushing code

**Expected Outcome**: Docker images are automatically built and published

### Challenge 3: Multi-Environment Deployment
**Objective**: Set up deployment to staging and production

**Tasks**:
1. Create GitHub environments (staging, production)
2. Configure environment protection rules
3. Set up deployment workflow
4. Add approval requirements for production
5. Implement rollback mechanism

**Expected Outcome**: Automated deployment with proper approvals

### Challenge 4: Security Integration
**Objective**: Add comprehensive security scanning

**Tasks**:
1. Set up dependency vulnerability scanning
2. Configure CodeQL for static analysis
3. Add Docker image vulnerability scanning
4. Set up security alerts and notifications
5. Create security policy documentation

**Expected Outcome**: Automated security checks in every pipeline

## ✅ Validation Steps

### 1. Verify Workflow Execution
```bash
# Check workflow status
gh workflow list
gh run list --workflow=ci.yml

# View workflow logs
gh run view <run-id>
```

### 2. Test Docker Image
```bash
# Pull and test the built image
docker pull ghcr.io/your-username/your-repo:latest
docker run -p 3000:3000 ghcr.io/your-username/your-repo:latest
```

### 3. Validate Security Scans
```bash
# Check security alerts
gh api repos/:owner/:repo/security-advisories

# Review dependency alerts
gh api repos/:owner/:repo/dependabot/alerts
```

### 4. Test Deployment Process
```bash
# Trigger deployment
git tag v1.0.0
git push origin v1.0.0

# Monitor deployment
gh run list --workflow=deploy.yml
```

## 🔧 Troubleshooting

### Common Issues

**1. Workflow Not Triggering**
- Check workflow file syntax
- Verify branch names in triggers
- Ensure workflow file is in `.github/workflows/`

**2. Permission Errors**
- Check repository permissions
- Verify GITHUB_TOKEN permissions
- Review environment protection rules

**3. Docker Build Failures**
- Check Dockerfile syntax
- Verify build context
- Review build logs for errors

**4. Deployment Failures**
- Check environment variables
- Verify deployment scripts
- Review target environment status

### Debug Commands
```bash
# Enable debug logging
export ACTIONS_STEP_DEBUG=true
export ACTIONS_RUNNER_DEBUG=true

# Check workflow syntax
gh workflow view ci.yml

# Test workflow locally (using act)
act -j test
```

## 📚 Additional Resources

### GitHub Actions Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Marketplace Actions](https://github.com/marketplace?type=actions)

### Best Practices
- [Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Performance Optimization](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Monitoring and Logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)

### Tools and Integrations
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
- [GitHub CLI](https://cli.github.com/)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)

## 🎯 Key Takeaways

1. **Automation First**: Automate everything from testing to deployment
2. **Security by Design**: Integrate security scanning throughout the pipeline
3. **Environment Parity**: Maintain consistency across environments
4. **Fast Feedback**: Provide quick feedback to developers
5. **Observability**: Monitor and log all pipeline activities

## 🚀 Next Steps

After completing this module:
1. Explore advanced GitHub Actions features
2. Implement custom actions for your organization
3. Set up monitoring and alerting for pipelines
4. Move to Module 7 for enterprise CI/CD with Jenkins

---

**Ready to automate your development workflow?** Start with Challenge 1 and build your first CI pipeline! 🚀