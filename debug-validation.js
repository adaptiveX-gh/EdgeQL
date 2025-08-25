// Debug validation issues

const code1 = `
  export function run(input) {
    return { processed: true, data: input };
  }
`;

console.log('Testing syntax validation fix:');
console.log('Code:', code1);

// Test the new approach
const codeWithoutExports = code1
  .replace(/export\s+/g, '')
  .replace(/import\s+.*?from\s+['"][^'"]*['"];?/g, '');

console.log('Code without exports:', codeWithoutExports);

try {
  new Function(codeWithoutExports);
  console.log('Fixed syntax check passed');
} catch (error) {
  console.log('Syntax error:', error.message);
}