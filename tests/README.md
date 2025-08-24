# EdgeQL Test Suite Documentation

## Overview

This directory contains the comprehensive test suite for the EdgeQL ML Strategy & Backtesting Platform. The test suite follows Test-Driven Development (TDD) principles and provides extensive coverage across all system components.

## Test Structure

```
tests/
├── config/                    # Test configurations
│   ├── vitest.config.ts      # Vitest configuration
│   ├── vitest.setup.ts       # Global test setup
│   └── pytest.ini           # Python test configuration
├── helpers/                   # Test utilities and fixtures
│   ├── fixtures.ts           # Test data and DSL examples
│   └── mocks.ts              # Mock implementations
├── integration/               # Integration tests
│   ├── e2e-pipeline.test.ts  # End-to-end pipeline tests
│   ├── api-integration.test.ts # API integration tests
│   └── executor-sandbox-integration.test.ts # Existing
└── unit/                     # Unit tests (service-specific)
```

## Test Categories

### 1. Unit Tests
- **Location**: `services/*/src/tests/`
- **Purpose**: Test individual functions, classes, and modules in isolation
- **Framework**: Vitest for TypeScript/JavaScript, pytest for Python
- **Coverage Target**: >90%

### 2. Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test component interactions and service integration
- **Coverage**: API endpoints, service communication, data flow

### 3. End-to-End Tests
- **Location**: `tests/integration/e2e-*.test.ts`
- **Purpose**: Test complete user workflows and system behavior
- **Scenarios**: Pipeline compilation → execution → results

### 4. API Tests
- **Location**: `tests/integration/api-*.test.ts` and `services/api/src/tests/`
- **Purpose**: Test REST API endpoints, request/response validation
- **Coverage**: All API routes, error handling, security

## Test Frameworks and Tools

### TypeScript/JavaScript Testing
- **Primary Framework**: Vitest
- **Additional Tools**:
  - Supertest for API testing
  - Custom matchers and utilities
  - Coverage with V8 provider

### Python Testing
- **Primary Framework**: pytest
- **Additional Tools**:
  - unittest for structure compatibility
  - Coverage.py for coverage reporting
  - Custom fixtures for ML data

### Test Utilities
- **Fixtures**: Comprehensive test data including DSL strategies, mock responses
- **Mocks**: Service mocks, Docker container mocks, external API mocks
- **Helpers**: Performance testing, concurrent testing, data generation

## Running Tests

### All Tests
```bash
# Run complete test suite
pnpm test

# Run all tests including E2E
pnpm test:all

# Run tests with coverage
pnpm test:coverage

# CI/CD pipeline tests
pnpm test:ci
```

### Specific Test Categories
```bash
# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# End-to-end tests only
pnpm test:e2e

# API tests only
pnpm test:api

# Python tests only
pnpm test:python
```

### Watch Mode
```bash
# Watch TypeScript/JavaScript tests
pnpm test:unit:watch

# Watch specific service tests
pnpm api:test:watch
pnpm compiler:test:watch
pnpm executor:test:watch

# Watch Python tests
pnpm test:python:watch
```

### Individual Services
```bash
# API service tests
pnpm api:test

# Compiler service tests
pnpm compiler:test

# Executor service tests
pnpm executor:test

# Web app tests
pnpm web:test
```

## Test Data and Fixtures

### DSL Fixtures
The test suite includes comprehensive DSL strategy examples:
- Simple Moving Average
- Moving Average Crossover
- RSI Strategy  
- Complex Multi-Indicator Strategy
- Invalid DSL examples for error testing

### Mock Data
- Sample OHLCV datasets
- Mock pipeline execution results
- Mock API responses
- Performance test datasets

### Test Utilities
- UUID generation and validation
- Timestamp utilities
- Performance measurement helpers
- Concurrent execution utilities

## Coverage Requirements

### Overall Coverage Targets
- **Unit Tests**: >90% line coverage
- **Integration Tests**: >80% scenario coverage
- **API Tests**: 100% endpoint coverage
- **Python Nodes**: >85% line coverage

### Coverage Reports
```bash
# Generate coverage reports
pnpm test:coverage

# Open HTML coverage report
pnpm reports:open

# Clean and regenerate reports
pnpm reports:clean && pnpm test:coverage
```

## Test Best Practices

### TDD Approach
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests green

### Test Structure
```typescript
describe('Component/Feature', () => {
  describe('specific functionality', () => {
    it('should behavior under condition', () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toMatchExpected();
    });
  });
});
```

### Test Naming
- Use descriptive test names that explain the scenario
- Include the expected behavior in the test name
- Group related tests in describe blocks

### Error Testing
- Test all error conditions and edge cases
- Verify error messages and types
- Test error recovery scenarios

### Performance Testing
- Include performance tests for critical paths
- Set reasonable timeout expectations
- Test concurrent execution scenarios

## Continuous Integration

### Pre-commit Hooks
- Lint check (TypeScript and Python)
- Unit test execution
- Type checking
- Format validation

### CI Pipeline
```bash
# Full CI test suite
pnpm test:ci
```

The CI pipeline includes:
1. Dependency installation
2. Lint checks
3. Type checking
4. Unit tests
5. Integration tests
6. Coverage reporting
7. Test report generation

### Test Reports
All test runs generate structured reports:
- **JUnit XML**: For CI/CD integration
- **JSON**: For programmatic processing
- **HTML**: For human-readable results
- **Coverage**: Line and branch coverage reports

## Debugging Tests

### Debug Configuration
```bash
# Enable debug output
DEBUG_TESTS=true pnpm test:unit

# Run specific test file
pnpm test:unit path/to/specific.test.ts

# Run tests with verbose output
pnpm test:unit --reporter=verbose
```

### Common Issues
1. **Timeout Errors**: Increase timeout in test configuration
2. **Mock Issues**: Verify mock setup in beforeEach hooks
3. **Async Issues**: Ensure proper await/async handling
4. **Docker Issues**: Verify Docker daemon is running for integration tests

## Contributing to Tests

### Adding New Tests
1. Follow existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add appropriate fixtures and mocks
4. Ensure proper cleanup in afterEach hooks
5. Document complex test scenarios

### Test Requirements for New Features
- Unit tests for all new functions/classes
- Integration tests for new service interactions
- API tests for new endpoints
- Error handling tests for all failure modes
- Performance tests for critical paths

### Review Checklist
- [ ] Tests follow TDD principles
- [ ] Comprehensive edge case coverage
- [ ] Proper mock usage
- [ ] Clean test data setup/teardown
- [ ] Performance considerations
- [ ] Documentation updates

## Performance Benchmarks

### Test Execution Times
- Unit tests: <5 seconds total
- Integration tests: <30 seconds total
- End-to-end tests: <60 seconds total
- Complete suite: <2 minutes total

### Memory Usage
- Maximum memory usage per test: 100MB
- Test cleanup verification
- Memory leak detection in long-running tests

## Future Enhancements

### Planned Test Improvements
1. **Visual Regression Tests**: For UI components
2. **Load Testing**: High-throughput pipeline execution
3. **Security Testing**: Penetration testing automation
4. **Chaos Testing**: System resilience validation
5. **Contract Testing**: Service API contract verification

### Test Automation
- Automatic test generation for new DSL nodes
- Property-based testing for mathematical calculations
- Fuzzing tests for robust error handling