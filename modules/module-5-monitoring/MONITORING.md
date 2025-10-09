# Module 5: Monitoring with Prometheus & Grafana

## 📊 Complete Monitoring Documentation

This module provides a comprehensive monitoring solution for the Quote of the Day application using Prometheus, Grafana, AlertManager, and various exporters.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Exporters     │    │   Monitoring    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Backend   │ │    │ │Node Exporter│ │    │ │ Prometheus  │ │
│ │   Frontend  │ │────┤ │  cAdvisor   │ │────┤ │AlertManager │ │
│ │   Database  │ │    │ │Blackbox Exp.│ │    │ │   Grafana   │ │
│ │    Redis    │ │    │ │Postgres Exp.│ │    │ └─────────────┘ │
│ │    Nginx    │ │    │ │ Redis Exp.  │ │    └─────────────────┘
│ └─────────────┘ │    │ │ Nginx Exp.  │ │
└─────────────────┘    │ │Pushgateway  │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 2GB free disk space
- Ports 3000, 8080, 9090-9115 available

### 1. Setup Environment

```bash
# Navigate to the monitoring module
cd modules/module-5-monitoring

# Run the setup script
./scripts/setup-monitoring.sh
```

### 2. Start Monitoring Stack

```bash
# Start all monitoring services
./scripts/start-monitoring.sh

# Or start manually with Docker Compose
docker-compose up -d
```

### 3. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin/admin123 |
| Prometheus | http://localhost:9090 | - |
| AlertManager | http://localhost:9093 | - |
| Node Exporter | http://localhost:9100 | - |
| cAdvisor | http://localhost:8080 | - |
| Blackbox Exporter | http://localhost:9115 | - |

## 📁 Directory Structure

```
module-5-monitoring/
├── README.md                           # Module overview
├── MONITORING.md                       # This documentation
├── docker-compose.yml                  # Complete monitoring stack
├── .env                               # Environment variables
├── prometheus/
│   ├── prometheus.yml                 # Main Prometheus config
│   ├── alert-rules.yml               # Alerting rules
│   └── recording-rules.yml           # Recording rules
├── grafana/
│   ├── dashboards/
│   │   ├── application-overview.json  # App monitoring dashboard
│   │   ├── infrastructure-monitoring.json # Infrastructure dashboard
│   │   ├── database-monitoring.json   # Database dashboard
│   │   └── business-metrics.json     # Business metrics dashboard
│   └── provisioning/
│       ├── datasources/
│       │   └── prometheus.yml        # Datasource configuration
│       └── dashboards/
│           └── dashboards.yml        # Dashboard provisioning
├── alertmanager/
│   ├── alertmanager.yml              # AlertManager configuration
│   └── templates/
│       └── default.tmpl              # Alert templates
├── blackbox/
│   └── blackbox.yml                  # Blackbox exporter config
├── postgres-exporter/
│   └── queries.yaml                  # Custom PostgreSQL queries
├── scripts/
│   ├── setup-monitoring.sh           # Environment setup
│   ├── start-monitoring.sh           # Start monitoring stack
│   ├── backup-monitoring.sh          # Backup script
│   └── health-check.sh              # Health check script
├── data/                             # Persistent data (created at runtime)
├── logs/                             # Log files (created at runtime)
└── backups/                          # Backup files (created at runtime)
```

## 🔧 Configuration

### Prometheus Configuration

The main Prometheus configuration (`prometheus/prometheus.yml`) includes:

- **Global Settings**: Scrape and evaluation intervals
- **Rule Files**: Alert and recording rules
- **Alerting**: AlertManager integration
- **Scrape Configs**: All monitored targets

#### Key Scrape Targets

| Target | Port | Metrics |
|--------|------|---------|
| Prometheus | 9090 | Prometheus internal metrics |
| Quote Backend | 8000 | Application metrics |
| Quote Frontend | 3001 | Frontend metrics |
| PostgreSQL | 9187 | Database metrics |
| Redis | 9121 | Cache metrics |
| Nginx | 9113 | Web server metrics |
| Node Exporter | 9100 | System metrics |
| cAdvisor | 8080 | Container metrics |
| Blackbox | 9115 | Endpoint monitoring |

### Grafana Dashboards

#### 1. Application Overview Dashboard
- Request rate and response times
- Error rates and status codes
- Service availability
- Quote requests by category

#### 2. Infrastructure Monitoring Dashboard
- CPU, memory, and disk usage
- Network I/O and system load
- Container resource usage
- Service health status

#### 3. Database Monitoring Dashboard
- Connection counts and query performance
- Database size and growth
- Cache hit ratios
- Long-running queries

#### 4. Business Metrics Dashboard
- User registrations and active users
- Quote request patterns
- Revenue tracking
- Success rates

### AlertManager Configuration

The AlertManager (`alertmanager/alertmanager.yml`) provides:

- **Routing**: Alert routing based on severity and category
- **Receivers**: Email, Slack, and webhook notifications
- **Inhibition**: Suppression of redundant alerts
- **Templates**: Custom notification formats

#### Alert Categories

| Category | Severity | Notification |
|----------|----------|--------------|
| Critical | critical | Email + Slack + Webhook |
| Warning | warning | Email + Slack |
| Database | high | Email + Slack |
| Infrastructure | medium | Email |
| Application | medium | Slack |
| Business | low | Email |
| Security | critical | Email + Slack + Webhook |

## 📊 Monitoring Targets

### Application Metrics

```prometheus
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Infrastructure Metrics

```prometheus
# CPU usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage
(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100
```

### Database Metrics

```prometheus
# Active connections
pg_stat_database_numbackends

# Query rate
rate(pg_stat_database_xact_commit[5m]) + rate(pg_stat_database_xact_rollback[5m])

# Cache hit ratio
pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)
```

## 🚨 Alerting Rules

### Critical Alerts

- **ApplicationDown**: Service unavailable for 1 minute
- **DatabaseDown**: Database connection failed
- **HighErrorRate**: Error rate > 5% for 5 minutes
- **DiskSpaceLow**: Disk usage > 90%

### Warning Alerts

- **HighResponseTime**: 95th percentile > 1s for 10 minutes
- **HighCPUUsage**: CPU usage > 80% for 15 minutes
- **HighMemoryUsage**: Memory usage > 85% for 10 minutes
- **DatabaseConnectionsHigh**: Connections > 80% of max

### Business Alerts

- **LowQuoteRequests**: Quote requests < 10/hour for 1 hour
- **HighQuoteRequestFailures**: Quote request failures > 10% for 30 minutes

## 🔍 Troubleshooting

### Common Issues

#### 1. Services Not Starting

```bash
# Check Docker status
docker ps

# Check service logs
docker-compose logs [service-name]

# Check configuration syntax
docker-compose config
```

#### 2. Prometheus Not Scraping Targets

```bash
# Check Prometheus targets page
curl http://localhost:9090/targets

# Validate Prometheus config
docker exec prometheus promtool check config /etc/prometheus/prometheus.yml

# Check network connectivity
docker exec prometheus wget -qO- http://target:port/metrics
```

#### 3. Grafana Dashboard Issues

```bash
# Check Grafana logs
docker-compose logs grafana

# Verify datasource connection
curl -u admin:admin123 http://localhost:3000/api/datasources

# Check dashboard provisioning
docker exec grafana ls -la /etc/grafana/provisioning/dashboards/
```

#### 4. AlertManager Not Sending Alerts

```bash
# Check AlertManager status
curl http://localhost:9093/-/healthy

# Verify alert routing
curl http://localhost:9093/api/v1/alerts

# Check notification configuration
docker exec alertmanager amtool config show
```

### Health Checks

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check individual services
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3000/api/health # Grafana
curl http://localhost:9093/-/healthy  # AlertManager
```

### Performance Optimization

#### Prometheus Optimization

```yaml
# prometheus.yml
global:
  scrape_interval: 30s      # Increase for less frequent scraping
  evaluation_interval: 30s  # Increase for less frequent rule evaluation

# Storage optimization
storage:
  tsdb:
    retention.time: 15d     # Reduce retention period
    retention.size: 5GB     # Set size limit
```

#### Grafana Optimization

```yaml
# grafana.ini
[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/application-overview.json

[panels]
disable_sanitize_html = false
enable_alpha = false

[query_history]
enabled = false  # Disable if not needed
```

## 🔐 Security Considerations

### Authentication

- Change default Grafana credentials
- Enable HTTPS for production
- Use strong passwords for all services

### Network Security

```yaml
# docker-compose.yml
networks:
  monitoring:
    driver: bridge
    internal: true  # Isolate monitoring network
```

### Data Protection

- Regular backups of monitoring data
- Encrypt sensitive configuration
- Limit access to monitoring endpoints

## 📈 Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.yml
prometheus:
  deploy:
    replicas: 2
    placement:
      constraints:
        - node.role == manager
```

### Federation

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job=~"prometheus"}'
    static_configs:
      - targets:
        - 'prometheus-1:9090'
        - 'prometheus-2:9090'
```

## 🔄 Maintenance

### Regular Tasks

1. **Daily**
   - Check service health
   - Review critical alerts
   - Monitor disk usage

2. **Weekly**
   - Backup monitoring data
   - Review dashboard performance
   - Update alert thresholds

3. **Monthly**
   - Update Docker images
   - Review retention policies
   - Optimize queries

### Backup and Recovery

```bash
# Create backup
./scripts/backup-monitoring.sh

# Restore from backup
tar -xzf monitoring_backup_YYYYMMDD_HHMMSS.tar.gz
cp -r prometheus_YYYYMMDD_HHMMSS/* data/prometheus/
cp -r grafana_YYYYMMDD_HHMMSS/* data/grafana/
```

## 📚 Additional Resources

### Documentation Links

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

### Best Practices

- Monitor the monitors (meta-monitoring)
- Use recording rules for expensive queries
- Implement proper alert fatigue prevention
- Regular review and optimization of dashboards

### Community Resources

- [Prometheus Community](https://prometheus.io/community/)
- [Grafana Community](https://community.grafana.com/)
- [Awesome Prometheus](https://github.com/roaldnefs/awesome-prometheus)

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review service logs
3. Consult official documentation
4. Search community forums

---

**Note**: This monitoring setup is designed for development and testing. For production use, consider additional security measures, high availability configurations, and performance optimizations.