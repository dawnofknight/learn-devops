FROM jenkins/jenkins:lts-jdk11

# Switch to root to install additional packages
USER root

# Install Docker CLI and other tools
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

# Install Helm
RUN curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list \
    && apt-get update \
    && apt-get install -y helm \
    && rm -rf /var/lib/apt/lists/*

# Switch back to jenkins user
USER jenkins

# Copy plugins list
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt

# Install plugins
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# Copy Jenkins configuration
COPY jenkins.yaml /var/jenkins_home/casc_configs/jenkins.yaml

# Copy init scripts
COPY init.groovy.d/ /usr/share/jenkins/ref/init.groovy.d/

# Set environment variables
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false -Dcasc.jenkins.config=/var/jenkins_home/casc_configs/jenkins.yaml"
ENV JENKINS_ADMIN_ID=admin
ENV JENKINS_ADMIN_PASSWORD=admin123

# Expose ports
EXPOSE 8080 50000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/login || exit 1