#!/usr/bin/env node

/**
 * k6 Results Processor
 * Processes k6 JSON output and generates HTML reports
 */

const fs = require('fs');
const path = require('path');

// Check command line arguments
if (process.argv.length < 4) {
    console.error('Usage: node process-results.js <input-json-file> <output-html-file>');
    process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

// Check if input file exists
if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
}

console.log(`📊 Processing k6 results from: ${inputFile}`);
console.log(`📄 Generating HTML report: ${outputFile}`);

try {
    // Read and parse k6 JSON output
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const lines = rawData.trim().split('\n');
    
    let testData = {
        metrics: {},
        checks: {},
        thresholds: {},
        testInfo: {},
        iterations: [],
        errors: []
    };

    // Process each line of k6 JSON output
    lines.forEach(line => {
        try {
            const data = JSON.parse(line);
            
            if (data.type === 'Metric') {
                testData.metrics[data.data.name] = data.data;
            } else if (data.type === 'Point') {
                // Collect iteration data for detailed analysis
                if (data.metric === 'iteration_duration') {
                    testData.iterations.push({
                        timestamp: data.data.time,
                        duration: data.data.value,
                        tags: data.data.tags
                    });
                }
                
                // Collect error information
                if (data.metric === 'http_req_failed' && data.data.value === 1) {
                    testData.errors.push({
                        timestamp: data.data.time,
                        tags: data.data.tags
                    });
                }
            }
        } catch (e) {
            // Skip invalid JSON lines
        }
    });

    // Calculate summary statistics
    const summary = calculateSummary(testData);
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(summary, testData);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write HTML report
    fs.writeFileSync(outputFile, htmlReport);
    
    console.log('✅ HTML report generated successfully');
    console.log(`📊 Test Summary:`);
    console.log(`   - Total Requests: ${summary.totalRequests}`);
    console.log(`   - Failed Requests: ${summary.failedRequests} (${summary.failureRate}%)`);
    console.log(`   - Average Response Time: ${summary.avgResponseTime}ms`);
    console.log(`   - 95th Percentile: ${summary.p95ResponseTime}ms`);
    console.log(`   - Total Duration: ${summary.testDuration}s`);

} catch (error) {
    console.error('❌ Error processing results:', error.message);
    process.exit(1);
}

function calculateSummary(testData) {
    const summary = {
        totalRequests: 0,
        failedRequests: 0,
        failureRate: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        testDuration: 0,
        requestRate: 0,
        dataReceived: 0,
        dataSent: 0,
        iterations: 0,
        vus: 0,
        checksPass: 0,
        checksFail: 0
    };

    // Extract metrics
    if (testData.metrics.http_reqs) {
        summary.totalRequests = testData.metrics.http_reqs.values.count || 0;
        summary.requestRate = testData.metrics.http_reqs.values.rate || 0;
    }

    if (testData.metrics.http_req_failed) {
        summary.failedRequests = testData.metrics.http_req_failed.values.passes || 0;
        summary.failureRate = summary.totalRequests > 0 ? 
            ((summary.failedRequests / summary.totalRequests) * 100).toFixed(2) : 0;
    }

    if (testData.metrics.http_req_duration) {
        const duration = testData.metrics.http_req_duration.values;
        summary.avgResponseTime = duration.avg ? duration.avg.toFixed(2) : 0;
        summary.p95ResponseTime = duration['p(95)'] ? duration['p(95)'].toFixed(2) : 0;
        summary.p99ResponseTime = duration['p(99)'] ? duration['p(99)'].toFixed(2) : 0;
        summary.minResponseTime = duration.min ? duration.min.toFixed(2) : 0;
        summary.maxResponseTime = duration.max ? duration.max.toFixed(2) : 0;
    }

    if (testData.metrics.data_received) {
        summary.dataReceived = formatBytes(testData.metrics.data_received.values.count || 0);
    }

    if (testData.metrics.data_sent) {
        summary.dataSent = formatBytes(testData.metrics.data_sent.values.count || 0);
    }

    if (testData.metrics.iterations) {
        summary.iterations = testData.metrics.iterations.values.count || 0;
    }

    if (testData.metrics.vus) {
        summary.vus = testData.metrics.vus.values.value || 0;
    }

    if (testData.metrics.checks) {
        summary.checksPass = testData.metrics.checks.values.passes || 0;
        summary.checksFail = testData.metrics.checks.values.fails || 0;
    }

    // Calculate test duration from iterations
    if (testData.iterations.length > 0) {
        const timestamps = testData.iterations.map(i => new Date(i.timestamp).getTime());
        const startTime = Math.min(...timestamps);
        const endTime = Math.max(...timestamps);
        summary.testDuration = ((endTime - startTime) / 1000).toFixed(2);
    }

    return summary;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateHTMLReport(summary, testData) {
    const timestamp = new Date().toISOString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>k6 Performance Test Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .metric-card h3 {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        
        .metric-value {
            font-size: 2.2em;
            font-weight: bold;
            color: #333;
        }
        
        .metric-value.success {
            color: #27ae60;
        }
        
        .metric-value.warning {
            color: #f39c12;
        }
        
        .metric-value.error {
            color: #e74c3c;
        }
        
        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-pass {
            background-color: #27ae60;
        }
        
        .status-fail {
            background-color: #e74c3c;
        }
        
        .status-warning {
            background-color: #f39c12;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #555;
        }
        
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding: 20px;
        }
        
        .chart-placeholder {
            height: 200px;
            background: #f8f9fa;
            border: 2px dashed #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 k6 Performance Test Report</h1>
            <p>Generated on ${timestamp}</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total Requests</h3>
                <div class="metric-value">${summary.totalRequests.toLocaleString()}</div>
            </div>
            
            <div class="metric-card">
                <h3>Failed Requests</h3>
                <div class="metric-value ${summary.failureRate > 5 ? 'error' : summary.failureRate > 1 ? 'warning' : 'success'}">
                    ${summary.failedRequests.toLocaleString()} (${summary.failureRate}%)
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Average Response Time</h3>
                <div class="metric-value ${summary.avgResponseTime > 1000 ? 'error' : summary.avgResponseTime > 500 ? 'warning' : 'success'}">
                    ${summary.avgResponseTime}ms
                </div>
            </div>
            
            <div class="metric-card">
                <h3>95th Percentile</h3>
                <div class="metric-value ${summary.p95ResponseTime > 2000 ? 'error' : summary.p95ResponseTime > 1000 ? 'warning' : 'success'}">
                    ${summary.p95ResponseTime}ms
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Request Rate</h3>
                <div class="metric-value">${summary.requestRate.toFixed(2)}/s</div>
            </div>
            
            <div class="metric-card">
                <h3>Test Duration</h3>
                <div class="metric-value">${summary.testDuration}s</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 Detailed Metrics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Iterations</td>
                        <td>${summary.iterations.toLocaleString()}</td>
                        <td><span class="status-indicator status-pass"></span>Complete</td>
                    </tr>
                    <tr>
                        <td>Virtual Users (Peak)</td>
                        <td>${summary.vus}</td>
                        <td><span class="status-indicator status-pass"></span>Active</td>
                    </tr>
                    <tr>
                        <td>Data Received</td>
                        <td>${summary.dataReceived}</td>
                        <td><span class="status-indicator status-pass"></span>Complete</td>
                    </tr>
                    <tr>
                        <td>Data Sent</td>
                        <td>${summary.dataSent}</td>
                        <td><span class="status-indicator status-pass"></span>Complete</td>
                    </tr>
                    <tr>
                        <td>Min Response Time</td>
                        <td>${summary.minResponseTime}ms</td>
                        <td><span class="status-indicator status-pass"></span>Good</td>
                    </tr>
                    <tr>
                        <td>Max Response Time</td>
                        <td>${summary.maxResponseTime}ms</td>
                        <td><span class="status-indicator ${summary.maxResponseTime > 5000 ? 'status-fail' : summary.maxResponseTime > 2000 ? 'status-warning' : 'status-pass'}"></span>
                            ${summary.maxResponseTime > 5000 ? 'Poor' : summary.maxResponseTime > 2000 ? 'Fair' : 'Good'}
                        </td>
                    </tr>
                    <tr>
                        <td>99th Percentile</td>
                        <td>${summary.p99ResponseTime}ms</td>
                        <td><span class="status-indicator ${summary.p99ResponseTime > 3000 ? 'status-fail' : summary.p99ResponseTime > 1500 ? 'status-warning' : 'status-pass'}"></span>
                            ${summary.p99ResponseTime > 3000 ? 'Poor' : summary.p99ResponseTime > 1500 ? 'Fair' : 'Good'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>✅ Checks & Validations</h2>
            <table>
                <thead>
                    <tr>
                        <th>Check Type</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Success Rate</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>All Checks</td>
                        <td>${summary.checksPass.toLocaleString()}</td>
                        <td>${summary.checksFail.toLocaleString()}</td>
                        <td>
                            <span class="status-indicator ${summary.checksFail > 0 ? 'status-fail' : 'status-pass'}"></span>
                            ${summary.checksPass + summary.checksFail > 0 ? 
                                ((summary.checksPass / (summary.checksPass + summary.checksFail)) * 100).toFixed(2) : 0}%
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>📈 Performance Analysis</h2>
            <div class="chart-placeholder">
                Response Time Distribution Chart
                <br><small>(Chart visualization would be implemented with a charting library)</small>
            </div>
            
            <h3>Key Insights:</h3>
            <ul style="margin-top: 15px; padding-left: 20px;">
                <li><strong>Overall Performance:</strong> 
                    ${summary.failureRate < 1 ? '✅ Excellent' : summary.failureRate < 5 ? '⚠️ Good' : '❌ Needs Improvement'}
                    - ${summary.failureRate}% failure rate
                </li>
                <li><strong>Response Time:</strong> 
                    ${summary.avgResponseTime < 200 ? '✅ Excellent' : summary.avgResponseTime < 500 ? '⚠️ Good' : '❌ Slow'}
                    - Average ${summary.avgResponseTime}ms
                </li>
                <li><strong>Scalability:</strong> 
                    Successfully handled ${summary.totalRequests.toLocaleString()} requests with ${summary.vus} virtual users
                </li>
                <li><strong>Reliability:</strong> 
                    ${summary.checksPass + summary.checksFail > 0 ? 
                        `${((summary.checksPass / (summary.checksPass + summary.checksFail)) * 100).toFixed(1)}% of checks passed` : 
                        'No checks configured'}
                </li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Report generated by k6 Performance Testing Suite</p>
            <p><small>For more detailed analysis, review the raw JSON output and k6 logs</small></p>
        </div>
    </div>
</body>
</html>`;
}