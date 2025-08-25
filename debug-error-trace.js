// Override console.error to capture stack traces for "registry is not defined"
const originalError = console.error;

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('registry is not defined')) {
    console.log('🔍 FOUND REGISTRY ERROR!');
    console.log('Stack trace:', new Error().stack);
    console.log('Arguments:', args);
  }
  return originalError.apply(console, args);
};

// Override Error constructor to catch "registry is not defined"
const OriginalError = Error;
global.Error = function(message, ...args) {
  if (typeof message === 'string' && message.includes('registry is not defined')) {
    console.log('🔍 ERROR CONSTRUCTOR - Registry error caught!');
    console.log('Message:', message);
    console.log('Stack trace:', new Error().stack);
  }
  return new OriginalError(message, ...args);
};

console.log('🔍 Error debugging enabled - will catch "registry is not defined" errors');