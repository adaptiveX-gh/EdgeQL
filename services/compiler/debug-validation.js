import { validateFromString } from './dist/index.js';

// Test simple validation
const dslContent = `
pipeline:
  - id: "valid_node"
    type: "IndicatorNode"
    params:
      indicator: "SMA"
      period: 10
`;

console.log('Testing DSL validation...');
const report = validateFromString(dslContent);

console.log('Report:', JSON.stringify(report, null, 2));
console.log('Valid:', report.valid);
console.log('Errors:', report.errors.length);
console.log('Error messages:', report.errors.map(e => e.message));