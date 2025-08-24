// EdgeQL Frontend Application
console.log('EdgeQL Frontend loaded');

// API base URLs  
const API_BASE = '/api';
const HEALTH_URL = 'http://localhost:3001/health'; // Health endpoint not under /api

// Test API connection
async function testAPI() {
  const statusEl = document.getElementById('status');
  const apiStatusEl = document.getElementById('api-status');
  
  try {
    statusEl.innerHTML = '<div class="loading loading-spinner loading-sm"></div> Testing connection...';
    
    const response = await fetch(HEALTH_URL);
    const data = await response.json();
    
    if (response.ok) {
      statusEl.innerHTML = '<div class="alert alert-success"><span>✅ API connection successful!</span></div>';
      apiStatusEl.textContent = 'Connected';
      loadDashboardData();
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    statusEl.innerHTML = `<div class="alert alert-error"><span>❌ Connection failed: ${error.message}</span></div>`;
    apiStatusEl.textContent = 'Disconnected';
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Load pipelines
    const pipelinesResponse = await fetch(`${API_BASE}/pipelines`);
    if (pipelinesResponse.ok) {
      const pipelines = await pipelinesResponse.json();
      document.getElementById('pipeline-count').textContent = pipelines.length;
    }
    
    // Load nodes
    const nodesResponse = await fetch(`${API_BASE}/nodes`);
    if (nodesResponse.ok) {
      const nodes = await nodesResponse.json();
      document.getElementById('node-count').textContent = nodes.length;
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

// Make testAPI available globally
window.testAPI = testAPI;

// Auto-test connection on load
document.addEventListener('DOMContentLoaded', () => {
  testAPI();
});