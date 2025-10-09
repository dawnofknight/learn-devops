# Module 5: Monitoring with Prometheus & Grafana

This module demonstrates how to implement comprehensive monitoring for containerized applications using Prometheus for metrics collection and Grafana for visualization and alerting.

## Overview

This module provides:
- **Prometheus** for metrics collection and storage
- **Grafana** for visualization and dashboards
- **AlertManager** for handling alerts
- **Node Exporter** for system metrics
- **cAdvisor** for container metrics
- Custom application metrics integration

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Prometheus    │───▶│     Grafana     │
│   (Metrics)     │    │   (Collection)  │    │ (Visualization) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  AlertManager   │    │   Dashboards    │
                       │   (Alerting)    │    │   & Reports     │
                       └─────────────────┘    └─────────────────┘
```

## Components

### 1. Prometheus Configuration
- **prometheus.yml**: Main Prometheus configuration
- **alert-rules.yml**: Alerting rules for various scenarios
- **Recording rules**: Pre-computed metrics for performance

### 2. Grafana Setup
- **Dashboards**: Pre-configured dashboards for application and infrastructure monitoring
- **Data Sources**: Automatic Prometheus integration
- **Alerting**: Grafana-native alerting with multiple notification channels

### 3. AlertManager
- **Routing**: Alert routing based on labels and severity
- **Notifications**: Email, Slack, webhook integrations
- **Silencing**: Temporary alert suppression

### 4. Exporters
- **Node Exporter**: System-level metrics (CPU, memory, disk, network)
- **cAdvisor**: Container-level metrics
- **Custom Exporters**: Application-specific metrics

## Quick Start

### Prerequisites
- Docker and Docker Compose
- At least 4GB RAM available
- Ports 3000 (Grafana), 9090 (Prometheus), 9093 (AlertManager) available

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f prometheus grafana
```

### 2. Access Services

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### 3. Import Dashboards

Dashboards are automatically provisioned, but you can also import manually:
1. Go to Grafana → Dashboards → Import
2. Upload JSON files from `grafana/dashboards/`

## Configuration Files

### Prometheus Configuration (`prometheus/prometheus.yml`)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert-rules.yml"
  - "recording-rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'quote-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
```

### Alert Rules (`prometheus/alert-rules.yml`)
```yaml
groups:
  - name: application.rules
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

## Monitoring Targets

### Application Metrics
- **HTTP Requests**: Request rate, duration, status codes
- **Database**: Connection pool, query performance
- **Business Metrics**: User registrations, quote requests
- **Custom Metrics**: Application-specific KPIs

### Infrastructure Metrics
- **System**: CPU, memory, disk, network usage
- **Containers**: Resource usage, restart counts
- **Docker**: Container states, image information

### Performance Metrics
- **Response Times**: P50, P95, P99 percentiles
- **Throughput**: Requests per second
- **Error Rates**: 4xx and 5xx error percentages
- **Availability**: Uptime and health check status

## Dashboards

### 1. Application Overview
- Request rate and response times
- Error rates and status code distribution
- Database performance metrics
- Business KPIs

### 2. Infrastructure Monitoring
- System resource utilization
- Container metrics
- Network and disk I/O
- Service discovery status

### 3. Performance Analysis
- Detailed performance breakdowns
- Comparative analysis over time
- Capacity planning metrics
- SLA compliance tracking

### 4. Alerting Dashboard
- Active alerts overview
- Alert history and trends
- Notification status
- Silenced alerts

## Alerting Rules

### Critical Alerts
- **Service Down**: Application unavailable
- **High Error Rate**: >5% error rate for 5 minutes
- **High Response Time**: >2s average response time
- **Database Issues**: Connection failures or slow queries

### Warning Alerts
- **High CPU Usage**: >80% for 10 minutes
- **High Memory Usage**: >85% for 10 minutes
- **Disk Space Low**: <10% free space
- **High Request Rate**: Unusual traffic patterns

### Info Alerts
- **New Deployment**: Application version changes
- **Configuration Changes**: Config updates
- **Maintenance Windows**: Scheduled maintenance

## Best Practices

### 1. Metric Naming
```
# Good
http_requests_total{method="GET", status="200"}
database_connections_active
business_user_registrations_total

# Avoid
requests
db_conn
users
```

### 2. Label Usage
- Use consistent label names across metrics
- Avoid high-cardinality labels
- Include relevant dimensions (method, status, endpoint)

### 3. Alert Design
- Set appropriate thresholds based on SLAs
- Use multiple severity levels
- Include actionable information in annotations
- Test alerts regularly

### 4. Dashboard Design
- Group related metrics together
- Use appropriate visualization types
- Include time range selectors
- Add documentation panels

## Troubleshooting

### Common Issues

1. **Prometheus not scraping targets**
   ```bash
   # Check target status
   curl http://localhost:9090/api/v1/targets
   
   # Verify network connectivity
   docker-compose exec prometheus wget -qO- http://app:3000/metrics
   ```

2. **Grafana dashboard not loading data**
   - Verify Prometheus data source configuration
   - Check query syntax in dashboard panels
   - Ensure time range is appropriate

3. **Alerts not firing**
   - Check alert rule syntax
   - Verify AlertManager configuration
   - Test notification channels

### Performance Optimization

1. **Prometheus Storage**
   ```yaml
   # Adjust retention and storage settings
   command:
     - '--storage.tsdb.retention.time=30d'
     - '--storage.tsdb.retention.size=10GB'
   ```

2. **Scrape Intervals**
   ```yaml
   # Balance between accuracy and performance
   global:
     scrape_interval: 30s  # Increase for less critical metrics
   ```

3. **Recording Rules**
   ```yaml
   # Pre-compute expensive queries
   - record: job:http_requests:rate5m
     expr: rate(http_requests_total[5m])
   ```

## Integration Examples

### 1. Node.js Application Metrics
```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

// Middleware to collect metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

### 2. Custom Business Metrics
```javascript
const userRegistrations = new prometheus.Counter({
  name: 'business_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source', 'plan']
});

const quoteRequests = new prometheus.Counter({
  name: 'business_quote_requests_total',
  help: 'Total number of quote requests',
  labelNames: ['category', 'source']
});

// Increment metrics in business logic
userRegistrations.labels('web', 'free').inc();
quoteRequests.labels('motivational', 'api').inc();
```

## Security Considerations

### 1. Access Control
- Enable authentication for Grafana
- Restrict Prometheus access to internal networks
- Use HTTPS in production environments

### 2. Data Privacy
- Avoid logging sensitive information in metrics
- Use label filtering to control data access
- Implement proper retention policies

### 3. Network Security
- Use internal Docker networks
- Configure firewall rules appropriately
- Monitor for unusual access patterns

## Scaling Considerations

### 1. High Availability
```yaml
# Multiple Prometheus instances
services:
  prometheus-1:
    image: prom/prometheus
    # ... configuration
  
  prometheus-2:
    image: prom/prometheus
    # ... configuration
```

### 2. Federation
```yaml
# Federated setup for multiple clusters
- job_name: 'federate'
  scrape_interval: 15s
  honor_labels: true
  metrics_path: '/federate'
  params:
    'match[]':
      - '{job=~"prometheus"}'
  static_configs:
    - targets:
      - 'prometheus-cluster-1:9090'
      - 'prometheus-cluster-2:9090'
```

### 3. Long-term Storage
- Configure remote storage for long-term retention
- Use recording rules to reduce storage requirements
- Implement data lifecycle policies

## Maintenance

### Regular Tasks
1. **Update configurations** as application changes
2. **Review and tune alerts** based on operational experience
3. **Clean up old dashboards** and unused metrics
4. **Monitor storage usage** and adjust retention policies
5. **Test disaster recovery** procedures

### Backup Strategy
```bash
# Backup Prometheus data
docker-compose exec prometheus tar -czf /backup/prometheus-$(date +%Y%m%d).tar.gz /prometheus

# Backup Grafana dashboards
docker-compose exec grafana tar -czf /backup/grafana-$(date +%Y%m%d).tar.gz /var/lib/grafana
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Monitoring Best Practices](https://prometheus.io/docs/practices/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Next Steps

After completing this module, you'll have:
- ✅ Comprehensive monitoring stack
- ✅ Application and infrastructure metrics
- ✅ Alerting and notification system
- ✅ Professional dashboards
- ✅ Performance monitoring capabilities

Continue to advanced topics:
- **Module 6**: Security and compliance monitoring
- **Module 7**: Log aggregation with ELK stack
- **Module 8**: Distributed tracing with Jaeger