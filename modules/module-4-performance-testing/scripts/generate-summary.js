#!/usr/bin/env node

/**
 * k6 Summary Report Generator
 * Generates summary reports from multiple k6 test results
 */

const fs = require('fs');
const path = require('path');

// Check command line arguments
if (process.argv.length < 4) {
    console.error('Usage: node generate-summary.js <results-directory> <output-html-file>');
    process.exit(1);
}

const resultsDir = process.argv[2];
const outputFile = process.argv[3];

// Check if results directory exists
if (!fs.existsSync(resultsDir)) {
    console.error(`❌ Results directory not found: ${resultsDir}`);
    process.exit(1);
}

console.log(`📊 Generating summary from: ${resultsDir}`);
console.log(`📄 Output file: ${outputFile}`);

try {
    // Find all JSON result files
    const jsonFiles = fs.readdirSync(resultsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(resultsDir, file));

    if (jsonFiles.length === 0) {
        console.log('⚠️  No JSON result files found');
        process.exit(0);
    }

    console.log(`📁 Found ${jsonFiles.length} result files`);

    // Process all result files
    const allResults = [];
    
    jsonFiles.forEach(file => {
        try {
            const result = processResultFile(file);
            if (result) {
                allResults.push(result);
            }
        } catch (error) {
            console.warn(`⚠️  Failed to process ${file}: ${error.message}`);
        }
    });

    if (allResults.length === 0) {
        console.log('⚠️  No valid results to process');
        process.exit(0);
    }

    // Generate summary HTML
    const summaryHTML = generateSummaryHTML(allResults);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write summary report
    fs.writeFileSync(outputFile, summaryHTML);
    
    console.log('✅ Summary report generated successfully');
    console.log(`📊 Processed ${allResults.length} test results`);

} catch (error) {
    console.error('❌ Error generating summary:', error.message);
    process.exit(1);
}

function processResultFile(filePath) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const lines = rawData.trim().split('\n');
    
    let testData = {
        fileName: path.basename(filePath),
        filePath: filePath,
        timestamp: fs.statSync(filePath).mtime,
        metrics: {},
        testInfo: {}
    };

    // Extract test info from filename
    const fileNameParts = path.basename(filePath, '.json').split('_');
    if (fileNameParts.length >= 3) {
        testData.testInfo = {
            testType: fileNameParts[0],
            environment: fileNameParts[1],
            timestamp: fileNameParts[2]
        };
    }

    // Process k6 JSON output
    lines.forEach(line => {
        try {
            const data = JSON.parse(line);
            if (data.type === 'Metric') {
                testData.metrics[data.data.name] = data.data;
            }
        } catch (e) {
            // Skip invalid JSON lines
        }
    });

    // Calculate summary metrics
    const summary = calculateTestSummary(testData);
    testData.summary = summary;

    return testData;
}

function calculateTestSummary(testData) {
    const summary = {
        totalRequests: 0,
        failedRequests: 0,
        failureRate: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestRate: 0,
        testDuration: 0,
        iterations: 0,
        vus: 0,
        dataReceived: 0,
        dataSent: 0,
        checksPass: 0,
        checksFail: 0,
        status: 'unknown'
    };

    // Extract metrics
    if (testData.metrics.http_reqs) {
        summary.totalRequests = testData.metrics.http_reqs.values.count || 0;
        summary.requestRate = testData.metrics.http_reqs.values.rate || 0;
    }

    if (testData.metrics.http_req_failed) {
        summary.failedRequests = testData.metrics.http_req_failed.values.passes || 0;
        summary.failureRate = summary.totalRequests > 0 ? 
            ((summary.failedRequests / summary.totalRequests) * 100) : 0;
    }

    if (testData.metrics.http_req_duration) {
        const duration = testData.metrics.http_req_duration.values;
        summary.avgResponseTime = duration.avg || 0;
        summary.p95ResponseTime = duration['p(95)'] || 0;
        summary.p99ResponseTime = duration['p(99)'] || 0;
    }

    if (testData.metrics.iterations) {
        summary.iterations = testData.metrics.iterations.values.count || 0;
    }

    if (testData.metrics.vus) {
        summary.vus = testData.metrics.vus.values.value || 0;
    }

    if (testData.metrics.data_received) {
        summary.dataReceived = testData.metrics.data_received.values.count || 0;
    }

    if (testData.metrics.data_sent) {
        summary.dataSent = testData.metrics.data_sent.values.count || 0;
    }

    if (testData.metrics.checks) {
        summary.checksPass = testData.metrics.checks.values.passes || 0;
        summary.checksFail = testData.metrics.checks.values.fails || 0;
    }

    // Determine overall status
    if (summary.failureRate > 5) {
        summary.status = 'failed';
    } else if (summary.failureRate > 1 || summary.avgResponseTime > 1000) {
        summary.status = 'warning';
    } else {
        summary.status = 'passed';
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

function generateSummaryHTML(results) {
    const timestamp = new Date().toISOString();
    
    // Sort results by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Calculate overall statistics
    const totalTests = results.length;
    const passedTests = results.filter(r => r.summary.status === 'passed').length;
    const warningTests = results.filter(r => r.summary.status === 'warning').length;
    const failedTests = results.filter(r => r.summary.status === 'failed').length;
    
    const totalRequests = results.reduce((sum, r) => sum + r.summary.totalRequests, 0);
    const totalFailures = results.reduce((sum, r) => sum + r.summary.failedRequests, 0);
    const avgFailureRate = totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(2) : 0;
    
    const avgResponseTime = results.length > 0 ? 
        (results.reduce((sum, r) => sum + r.summary.avgResponseTime, 0) / results.length).toFixed(2) : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>k6 Performance Testing Summary</title>
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
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 3em;
            margin-bottom: 15px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .overview-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .overview-card h3 {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
        }
        
        .overview-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .overview-value.success {
            color: #27ae60;
        }
        
        .overview-value.warning {
            color: #f39c12;
        }
        
        .overview-value.error {
            color: #e74c3c;
        }
        
        .section {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #eee;
            font-size: 1.8em;
        }
        
        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }
        
        .test-card {
            border: 1px solid #eee;
            border-radius: 10px;
            padding: 20px;
            background: #fafafa;
        }
        
        .test-card.passed {
            border-left: 5px solid #27ae60;
        }
        
        .test-card.warning {
            border-left: 5px solid #f39c12;
        }
        
        .test-card.failed {
            border-left: 5px solid #e74c3c;
        }
        
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .test-title {
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .test-status {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .test-status.passed {
            background: #d4edda;
            color: #155724;
        }
        
        .test-status.warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .test-status.failed {
            background: #f8d7da;
            color: #721c24;
        }
        
        .test-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 0.9em;
        }
        
        .metric-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }
        
        .metric-label {
            color: #666;
        }
        
        .metric-value {
            font-weight: bold;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        th, td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #555;
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
        
        .footer {
            text-align: center;
            color: #666;
            margin-top: 50px;
            padding: 30px;
        }
        
        .trend-section {
            margin-top: 30px;
        }
        
        .trend-chart {
            height: 300px;
            background: #f8f9fa;
            border: 2px dashed #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            border-radius: 10px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 k6 Performance Testing Summary</h1>
            <p>Comprehensive analysis of ${totalTests} test runs</p>
            <p><small>Generated on ${timestamp}</small></p>
        </div>
        
        <div class="overview-grid">
            <div class="overview-card">
                <h3>Total Tests</h3>
                <div class="overview-value">${totalTests}</div>
            </div>
            
            <div class="overview-card">
                <h3>Passed Tests</h3>
                <div class="overview-value success">${passedTests}</div>
            </div>
            
            <div class="overview-card">
                <h3>Warning Tests</h3>
                <div class="overview-value warning">${warningTests}</div>
            </div>
            
            <div class="overview-card">
                <h3>Failed Tests</h3>
                <div class="overview-value error">${failedTests}</div>
            </div>
            
            <div class="overview-card">
                <h3>Total Requests</h3>
                <div class="overview-value">${totalRequests.toLocaleString()}</div>
            </div>
            
            <div class="overview-card">
                <h3>Average Failure Rate</h3>
                <div class="overview-value ${avgFailureRate > 5 ? 'error' : avgFailureRate > 1 ? 'warning' : 'success'}">
                    ${avgFailureRate}%
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Test Results Overview</h2>
            <div class="test-grid">
                ${results.map(result => `
                    <div class="test-card ${result.summary.status}">
                        <div class="test-header">
                            <div class="test-title">
                                ${result.testInfo.testType || 'Unknown'} Test
                                <br><small>${result.testInfo.environment || 'Unknown Environment'}</small>
                            </div>
                            <div class="test-status ${result.summary.status}">
                                ${result.summary.status}
                            </div>
                        </div>
                        
                        <div class="test-metrics">
                            <div class="metric-item">
                                <span class="metric-label">Requests:</span>
                                <span class="metric-value">${result.summary.totalRequests.toLocaleString()}</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Failures:</span>
                                <span class="metric-value">${result.summary.failureRate.toFixed(2)}%</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Avg Response:</span>
                                <span class="metric-value">${result.summary.avgResponseTime.toFixed(2)}ms</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">P95 Response:</span>
                                <span class="metric-value">${result.summary.p95ResponseTime.toFixed(2)}ms</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Request Rate:</span>
                                <span class="metric-value">${result.summary.requestRate.toFixed(2)}/s</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Virtual Users:</span>
                                <span class="metric-value">${result.summary.vus}</span>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px; font-size: 0.8em; color: #666;">
                            <strong>File:</strong> ${result.fileName}<br>
                            <strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>📈 Performance Trends</h2>
            <div class="trend-chart">
                Performance Trend Chart
                <br><small>(Chart visualization would be implemented with a charting library)</small>
            </div>
            
            <h3>Key Insights:</h3>
            <ul style="margin-top: 20px; padding-left: 25px; line-height: 2;">
                <li><strong>Overall Success Rate:</strong> 
                    ${((passedTests / totalTests) * 100).toFixed(1)}% of tests passed successfully
                </li>
                <li><strong>Performance Consistency:</strong> 
                    Average response time across all tests: ${avgResponseTime}ms
                </li>
                <li><strong>Reliability:</strong> 
                    ${avgFailureRate}% average failure rate across ${totalRequests.toLocaleString()} total requests
                </li>
                <li><strong>Test Coverage:</strong> 
                    ${new Set(results.map(r => r.testInfo.testType)).size} different test types executed
                </li>
            </ul>
        </div>
        
        <div class="section">
            <h2>📋 Detailed Results Table</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Type</th>
                        <th>Environment</th>
                        <th>Status</th>
                        <th>Requests</th>
                        <th>Failure Rate</th>
                        <th>Avg Response</th>
                        <th>P95 Response</th>
                        <th>Request Rate</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr>
                            <td>${result.testInfo.testType || 'Unknown'}</td>
                            <td>${result.testInfo.environment || 'Unknown'}</td>
                            <td>
                                <span class="status-indicator status-${result.summary.status === 'passed' ? 'pass' : result.summary.status === 'warning' ? 'warning' : 'fail'}"></span>
                                ${result.summary.status}
                            </td>
                            <td>${result.summary.totalRequests.toLocaleString()}</td>
                            <td>${result.summary.failureRate.toFixed(2)}%</td>
                            <td>${result.summary.avgResponseTime.toFixed(2)}ms</td>
                            <td>${result.summary.p95ResponseTime.toFixed(2)}ms</td>
                            <td>${result.summary.requestRate.toFixed(2)}/s</td>
                            <td>${new Date(result.timestamp).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p><strong>k6 Performance Testing Suite</strong></p>
            <p>Comprehensive performance analysis and reporting</p>
            <p><small>For detailed analysis of individual tests, review the specific test reports</small></p>
        </div>
    </div>
</body>
</html>`;
}