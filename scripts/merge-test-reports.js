#!/usr/bin/env node
/**
 * Merge test reports from different test runners into a unified report
 * Combines Vitest, pytest, and other test results
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Parse Vitest JSON report
 */
function parseVitestReport(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const report = JSON.parse(content);
    
    return {
      framework: 'vitest',
      testResults: report.testResults || [],
      numTotalTests: report.numTotalTests || 0,
      numPassedTests: report.numPassedTests || 0,
      numFailedTests: report.numFailedTests || 0,
      numPendingTests: report.numPendingTests || 0,
      success: report.success || false,
      startTime: report.startTime,
      endTime: report.endTime,
      executionTime: report.endTime - report.startTime
    };
  } catch (error) {
    console.warn(`Failed to parse Vitest report: ${error.message}`);
    return null;
  }
}

/**
 * Parse pytest XML report
 */
function parsePytestReport(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    
    const xml2js = require('xml2js');
    const content = fs.readFileSync(filePath, 'utf8');
    
    return new Promise((resolve) => {
      xml2js.parseString(content, (err, result) => {
        if (err) {
          console.warn(`Failed to parse pytest XML: ${err.message}`);
          resolve(null);
          return;
        }
        
        const testsuite = result.testsuite || result.testsuites?.testsuite?.[0];
        if (!testsuite) {
          resolve(null);
          return;
        }
        
        const attrs = testsuite.$;
        resolve({
          framework: 'pytest',
          numTotalTests: parseInt(attrs.tests || 0),
          numPassedTests: parseInt(attrs.tests || 0) - parseInt(attrs.failures || 0) - parseInt(attrs.errors || 0),
          numFailedTests: parseInt(attrs.failures || 0) + parseInt(attrs.errors || 0),
          numPendingTests: parseInt(attrs.skipped || 0),
          success: (parseInt(attrs.failures || 0) + parseInt(attrs.errors || 0)) === 0,
          executionTime: parseFloat(attrs.time || 0) * 1000, // Convert to ms
          testResults: testsuite.testcase || []
        });
      });
    });
  } catch (error) {
    console.warn(`Failed to parse pytest report: ${error.message}`);
    return null;
  }
}

/**
 * Generate unified test report
 */
async function generateUnifiedReport() {
  console.log('🔍 Merging test reports...');
  
  const reports = [];
  
  // Parse Vitest reports
  const vitestReports = [
    'unit-test-results.json',
    'integration-test-results.json',
    'e2e-test-results.json'
  ];
  
  for (const reportFile of vitestReports) {
    const reportPath = path.join(REPORTS_DIR, reportFile);
    const report = parseVitestReport(reportPath);
    if (report) {
      report.category = reportFile.replace('-test-results.json', '');
      reports.push(report);
    }
  }
  
  // Parse pytest report
  const pytestReportPath = path.join(REPORTS_DIR, 'python-test-results.xml');
  const pytestReport = await parsePytestReport(pytestReportPath);
  if (pytestReport) {
    pytestReport.category = 'python';
    reports.push(pytestReport);
  }
  
  // Calculate totals
  const unified = {
    generatedAt: new Date().toISOString(),
    reports: reports.length,
    categories: reports.map(r => r.category),
    summary: {
      totalTests: reports.reduce((sum, r) => sum + r.numTotalTests, 0),
      passedTests: reports.reduce((sum, r) => sum + r.numPassedTests, 0),
      failedTests: reports.reduce((sum, r) => sum + r.numFailedTests, 0),
      pendingTests: reports.reduce((sum, r) => sum + r.numPendingTests, 0),
      totalExecutionTime: reports.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      overallSuccess: reports.every(r => r.success),
      successRate: reports.reduce((sum, r) => sum + r.numPassedTests, 0) / 
                   Math.max(1, reports.reduce((sum, r) => sum + r.numTotalTests, 0))
    },
    details: reports
  };
  
  // Write unified report
  const unifiedPath = path.join(REPORTS_DIR, 'unified-test-report.json');
  fs.writeFileSync(unifiedPath, JSON.stringify(unified, null, 2));
  
  // Generate HTML summary
  generateHTMLSummary(unified);
  
  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log(`Total Tests: ${unified.summary.totalTests}`);
  console.log(`✅ Passed: ${unified.summary.passedTests}`);
  console.log(`❌ Failed: ${unified.summary.failedTests}`);
  console.log(`⏭️ Skipped: ${unified.summary.pendingTests}`);
  console.log(`Success Rate: ${(unified.summary.successRate * 100).toFixed(1)}%`);
  console.log(`Execution Time: ${(unified.summary.totalExecutionTime / 1000).toFixed(2)}s`);
  console.log(`Overall Status: ${unified.summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\nBy Category:');
  reports.forEach(report => {
    console.log(`  ${report.category}: ${report.numPassedTests}/${report.numTotalTests} (${(report.numPassedTests/Math.max(1,report.numTotalTests)*100).toFixed(1)}%)`);
  });
  
  console.log(`\n📄 Reports saved to: ${REPORTS_DIR}/`);
  
  // Exit with appropriate code
  process.exit(unified.summary.overallSuccess ? 0 : 1);
}

/**
 * Generate HTML summary report
 */
function generateHTMLSummary(unified) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EdgeQL Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .success { color: #28a745; }
        .danger { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .category { background: #fff; border: 1px solid #e1e5e9; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .category-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .category-content { padding: 15px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status-pass { background: #d4edda; color: #155724; }
        .status-fail { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EdgeQL Test Report</h1>
        <p>Generated: ${unified.generatedAt}</p>
        <p>Status: <span class="status-badge ${unified.summary.overallSuccess ? 'status-pass' : 'status-fail'}">
            ${unified.summary.overallSuccess ? 'PASS' : 'FAIL'}
        </span></p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value info">${unified.summary.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value success">${unified.summary.passedTests}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value danger">${unified.summary.failedTests}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value warning">${unified.summary.pendingTests}</div>
            <div class="metric-label">Skipped</div>
        </div>
        <div class="metric">
            <div class="metric-value info">${(unified.summary.successRate * 100).toFixed(1)}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value info">${(unified.summary.totalExecutionTime / 1000).toFixed(2)}s</div>
            <div class="metric-label">Execution Time</div>
        </div>
    </div>
    
    <h2>Test Categories</h2>
    ${unified.details.map(report => `
    <div class="category">
        <div class="category-header">
            ${report.category.charAt(0).toUpperCase() + report.category.slice(1)} Tests
            <span class="status-badge ${report.success ? 'status-pass' : 'status-fail'}">
                ${report.success ? 'PASS' : 'FAIL'}
            </span>
        </div>
        <div class="category-content">
            <p><strong>Framework:</strong> ${report.framework}</p>
            <p><strong>Results:</strong> ${report.numPassedTests}/${report.numTotalTests} passed</p>
            <p><strong>Success Rate:</strong> ${(report.numPassedTests/Math.max(1,report.numTotalTests)*100).toFixed(1)}%</p>
            ${report.executionTime ? `<p><strong>Execution Time:</strong> ${(report.executionTime / 1000).toFixed(2)}s</p>` : ''}
        </div>
    </div>
    `).join('')}
    
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e5e9; color: #666; text-align: center;">
        EdgeQL ML Strategy & Backtesting Platform - Test Report
    </footer>
</body>
</html>
  `;
  
  const htmlPath = path.join(REPORTS_DIR, 'test-summary.html');
  fs.writeFileSync(htmlPath, html.trim());
}

// Check if xml2js is available, install if not
try {
  require('xml2js');
} catch (error) {
  console.log('Installing xml2js for XML parsing...');
  require('child_process').execSync('npm install xml2js', { stdio: 'inherit' });
}

// Run the report generation
generateUnifiedReport().catch(error => {
  console.error('Failed to generate unified report:', error);
  process.exit(1);
});