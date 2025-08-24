import '@testing-library/jest-dom';

// Mock SvelteKit runtime modules
global.fetch = vi.fn();

// Mock browser globals
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost/'
  },
  writable: true
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve())
  }
});