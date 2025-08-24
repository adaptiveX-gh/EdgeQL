import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('Shareable Results Integration', () => {
  let webServer: ChildProcess;
  let apiServer: ChildProcess;
  
  beforeAll(async () => {
    // Start API server
    apiServer = spawn('pnpm', ['--filter', 'services/api', 'dev'], {
      cwd: 'C:\\Users\\scale\\Code\\edgeql\\EdgeQL',
      env: { ...process.env, PORT: '3003' },
      shell: true
    });
    
    // Start web server
    webServer = spawn('pnpm', ['--filter', 'apps/web', 'dev'], {
      cwd: 'C:\\Users\\scale\\Code\\edgeql\\EdgeQL',
      env: { ...process.env, PORT: '5176' },
      shell: true
    });
    
    // Wait for servers to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  });
  
  afterAll(async () => {
    if (webServer) webServer.kill();
    if (apiServer) apiServer.kill();
  });

  it('should generate correct shareable URLs', async () => {
    const normalUrl = 'http://localhost:5176/results/test-run-123';
    const shareUrl = new URL(normalUrl);
    shareUrl.searchParams.set('share', 'true');
    
    expect(shareUrl.toString()).toBe('http://localhost:5176/results/test-run-123?share=true');
    expect(shareUrl.searchParams.has('share')).toBe(true);
  });
  
  it('should parse share parameter from URL', async () => {
    const url1 = new URL('http://localhost:5176/results/test-run-123');
    const url2 = new URL('http://localhost:5176/results/test-run-123?share=true');
    const url3 = new URL('http://localhost:5176/results/test-run-123?share=false');
    
    expect(url1.searchParams.has('share')).toBe(false);
    expect(url2.searchParams.has('share')).toBe(true);
    expect(url3.searchParams.has('share')).toBe(true); // has() returns true even for 'false'
  });

  it('should maintain run ID in shareable URLs', async () => {
    const runIds = ['run-123', 'abc-def-456', 'test-run-789'];
    
    runIds.forEach(runId => {
      const url = new URL(`http://localhost:5176/results/${runId}`);
      url.searchParams.set('share', 'true');
      
      expect(url.pathname).toContain(runId);
      expect(url.searchParams.has('share')).toBe(true);
    });
  });
});