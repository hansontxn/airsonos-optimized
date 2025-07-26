# Testing and Validation Instructions

This document provides comprehensive instructions for testing and validating the AirSonos Optimized system. It covers all test types, validation procedures, and troubleshooting guidelines.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Test Types](#test-types)
5. [Automated Testing](#automated-testing)
6. [Manual Testing](#manual-testing)
7. [Configuration Validation](#configuration-validation)
8. [Performance Benchmarking](#performance-benchmarking)
9. [Device Compatibility Testing](#device-compatibility-testing)
10. [Continuous Integration](#continuous-integration)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Overview

The AirSonos Optimized testing suite includes:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test Home Assistant integration and component interactions
- **Performance Benchmarks**: Measure system performance and optimization effectiveness
- **Device Compatibility Tests**: Verify compatibility with various Sonos devices
- **Configuration Validation**: Validate configuration files and settings
- **Automated Test Runner**: CI/CD compatible test automation

## Prerequisites

### System Requirements

- **Node.js**: Version 16, 18, or 20
- **npm**: Version 8 or higher
- **Memory**: At least 2GB available RAM for testing
- **Network**: Local network access for device testing
- **Permissions**: Ability to bind to test ports (5000-8099)

### Installation

```bash
# Clone the repository
git clone https://github.com/HansonTan/airsonos-optimized.git
cd airsonos-optimized

# Install dependencies
npm install

# Install development dependencies
npm install --save-dev jest eslint prettier

# Make scripts executable
chmod +x scripts/run_tests.sh
chmod +x scripts/validate_config.js
```

### Environment Setup

```bash
# Optional: Create test environment file
cat > .env.test << EOF
NODE_ENV=test
AIRSONOS_TIMEOUT=5
AIRSONOS_VERBOSE=false
AIRSONOS_PORT=5001
EOF

# Optional: Create test configuration
cp config/options.json test-config.json
```

---

## Quick Start

### Run All Tests

```bash
# Run complete test suite
./scripts/run_tests.sh

# Run with verbose output and coverage
./scripts/run_tests.sh --verbose --coverage

# Run in CI mode (non-interactive)
./scripts/run_tests.sh --ci
```

### Run Specific Test Types

```bash
# Unit tests only
./scripts/run_tests.sh unit

# Integration tests only
./scripts/run_tests.sh integration

# Performance benchmarks
./scripts/run_tests.sh performance

# Device compatibility tests
./scripts/run_tests.sh compatibility

# Configuration validation
./scripts/run_tests.sh validation
```

### Validate Configuration

```bash
# Validate a configuration file
./scripts/validate_config.js config.json

# Validate with device connectivity testing
./scripts/validate_config.js --check-devices --verbose config.json

# Auto-fix common issues
./scripts/validate_config.js --fix --output fixed-config.json config.json
```

---

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions and components in isolation.

**Location**: `test/unit_tests.js`

**Coverage**:
- OptimizedAirSonos core functions
- Adaptive buffer management
- Audio format detection
- Performance calculation
- Network optimization
- Device management
- Configuration validation
- Performance monitoring
- Auto-configuration system
- Configuration migration

**Manual Execution**:
```bash
# Run unit tests
npx jest test/unit_tests.js

# Run with coverage
npx jest test/unit_tests.js --coverage

# Run specific test suite
npx jest test/unit_tests.js --testNamePattern="Adaptive Buffer"

# Watch mode for development
npx jest test/unit_tests.js --watch
```

**Expected Results**:
- All tests should pass
- Code coverage should be >80%
- No memory leaks detected
- Performance within acceptable limits

### 2. Integration Tests

**Purpose**: Test Home Assistant integration and component interactions.

**Location**: `test/integration_tests.js`

**Coverage**:
- Home Assistant sensor management
- Service registration and execution
- WebSocket communication
- Dashboard generation
- Notification system
- Real-time event handling
- Configuration validation
- Health check integration
- Error handling and recovery

**Manual Execution**:
```bash
# Run integration tests
npx jest test/integration_tests.js

# Run with detailed output
npx jest test/integration_tests.js --verbose

# Test specific integration component
npx jest test/integration_tests.js --testNamePattern="WebSocket"
```

**Expected Results**:
- All integration points functional
- WebSocket connections stable
- HA services respond correctly
- Dashboard widgets generated
- Notifications delivered properly

### 3. Performance Benchmarks

**Purpose**: Measure system performance and optimization effectiveness.

**Location**: `test/performance_benchmark.js`

**Coverage**:
- Startup performance
- Audio processing performance
- Memory usage and management
- Network performance
- CPU performance and optimization
- Monitoring overhead
- Configuration performance
- Load testing
- Concurrent connection handling

**Manual Execution**:
```bash
# Run performance benchmarks
npx jest test/performance_benchmark.js --testTimeout=60000

# Run specific benchmark category
npx jest test/performance_benchmark.js --testNamePattern="Audio Processing"

# Run with system profiling
node --prof npx jest test/performance_benchmark.js
```

**Expected Results**:
- Startup time <15 seconds
- CPU usage <15% average
- Memory usage <100MB average
- Audio processing <5ms per buffer
- Network latency <100ms local
- All benchmarks within acceptable limits

**Benchmark Results Location**: `test/benchmark-results/`

### 4. Device Compatibility Tests

**Purpose**: Test compatibility with various Sonos devices and network configurations.

**Location**: `test/device_compatibility.js`

**Coverage**:
- Sonos device detection
- Network connectivity testing
- Audio format compatibility
- Device capability testing
- Performance compatibility
- Firmware and protocol testing
- Network environment testing
- Comprehensive device reports

**Manual Execution**:
```bash
# Run compatibility tests
npx jest test/device_compatibility.js

# Run with actual device testing (requires devices)
ENABLE_REAL_DEVICES=true npx jest test/device_compatibility.js

# Test specific device capabilities
npx jest test/device_compatibility.js --testNamePattern="Audio Format"
```

**Expected Results**:
- All mock devices detected correctly
- Network tests pass for reachable devices
- Audio format support correctly identified
- Device capabilities properly tested
- Compatibility reports generated

### 5. Configuration Validation

**Purpose**: Validate configuration files and settings across different formats.

**Tool**: `scripts/validate_config.js`

**Supported Formats**:
- JSON configuration files
- YAML configuration files
- Environment variable files
- Docker environment files

**Manual Execution**:
```bash
# Basic validation
./scripts/validate_config.js config.json

# Comprehensive validation with device testing
./scripts/validate_config.js --check-devices --verbose config.json

# Validate YAML configuration
./scripts/validate_config.js --format yaml config.yaml

# Validate environment file
./scripts/validate_config.js --format env .env

# Auto-fix issues
./scripts/validate_config.js --fix config.json

# Dry run (show fixes without applying)
./scripts/validate_config.js --fix --dry-run config.json

# Custom output location
./scripts/validate_config.js --fix --output validated-config.json config.json

# Strict validation mode
./scripts/validate_config.js --strict config.json
```

**Validation Checks**:
- Schema compliance
- Value range validation
- Logical consistency checks
- Port conflict detection
- Device configuration validation
- Network connectivity (optional)
- Common issue detection
- Security best practices

**Expected Results**:
- Valid configurations pass without errors
- Invalid configurations fail with specific error messages
- Warnings for potential issues
- Recommendations for optimization
- Device connectivity results (if enabled)

---

## Automated Testing

### Test Runner Script

The automated test runner (`scripts/run_tests.sh`) provides comprehensive testing capabilities:

**Features**:
- Multiple test type support
- Parallel execution option
- Code coverage generation
- Timeout management
- CI/CD integration
- Detailed reporting
- Environment configuration

**Usage Examples**:

```bash
# Complete test suite
./scripts/run_tests.sh all

# Parallel execution for faster testing
./scripts/run_tests.sh --parallel all

# CI mode with timeout
./scripts/run_tests.sh --ci --timeout 600 all

# Generate coverage report
./scripts/run_tests.sh --coverage --output ./test-results all

# Load custom environment
./scripts/run_tests.sh --env .env.test all

# Verbose output for debugging
./scripts/run_tests.sh --verbose --config test-config.json all
```

**Test Results**:
- Test logs: `test-results/*.log`
- Coverage report: `test-results/coverage/`
- Benchmark results: `test-results/benchmark-results/`
- Test report: `test-results/test-report.txt`

### CI/CD Integration

**GitHub Actions Integration**:

The test runner is designed to work with the existing GitHub Actions workflow in `.github/workflows/hacs.yaml`.

**Example CI Configuration**:

```yaml
- name: Run Test Suite
  run: |
    ./scripts/run_tests.sh --ci --coverage --timeout 900 all

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-results
    path: test-results/

- name: Upload Coverage Reports
  uses: codecov/codecov-action@v3
  with:
    files: ./test-results/coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
```

**Exit Codes**:
- `0`: All tests passed
- `1`: One or more tests failed
- `2`: Test setup/execution error

---

## Manual Testing

### Development Testing

**Watch Mode for Active Development**:
```bash
# Watch unit tests during development
npx jest test/unit_tests.js --watch

# Watch specific test file
npx jest test/integration_tests.js --watchAll

# Run tests when files change
npm run test:watch
```

**Debugging Tests**:
```bash
# Debug with Node.js inspector
node --inspect-brk node_modules/.bin/jest test/unit_tests.js --runInBand

# Debug specific test
npx jest test/unit_tests.js --testNamePattern="should adjust buffer size" --runInBand

# Enable verbose Jest output
npx jest test/unit_tests.js --verbose --no-cache
```

### Interactive Testing

**Live System Testing**:
```bash
# Start AirSonos in test mode
NODE_ENV=test npm start

# Test configuration changes
./scripts/validate_config.js --check-devices config.json

# Monitor performance in real-time
curl http://localhost:5000/api/metrics

# Test WebSocket connection
wscat -c ws://localhost:8099
```

**Device Discovery Testing**:
```bash
# Manual device discovery
node -e "
const autoConfig = require('./src/auto_config');
const ac = new autoConfig();
ac.discoverDevices().then(devices => {
  console.log('Found devices:', devices);
}).catch(console.error);
"
```

### Test Data Generation

**Generate Test Configurations**:
```bash
# Create test configurations
node -e "
const fs = require('fs');
const testConfigs = [
  { basic_settings: { timeout: 5, port: 5000 } },
  { audio_settings: { adaptive_buffering: true, min_buffer_size: 200 } }
];
testConfigs.forEach((config, i) => {
  fs.writeFileSync(\`test-config-\${i}.json\`, JSON.stringify(config, null, 2));
});
console.log('Test configurations generated');
"
```

**Mock Device Setup**:
```bash
# Start mock Sonos device server
node test/helpers/mock-sonos-server.js --port 1400 --devices 5
```

---

## Configuration Validation

### Validation Scenarios

**1. Valid Configuration Testing**:
```bash
# Test minimal valid configuration
cat > minimal-config.json << EOF
{
  "basic_settings": {
    "timeout": 5,
    "port": 5000
  }
}
EOF

./scripts/validate_config.js minimal-config.json
```

**2. Invalid Configuration Testing**:
```bash
# Test configuration with errors
cat > invalid-config.json << EOF
{
  "basic_settings": {
    "timeout": 65,
    "port": 80
  },
  "audio_settings": {
    "min_buffer_size": 600,
    "max_buffer_size": 300
  }
}
EOF

./scripts/validate_config.js invalid-config.json
```

**3. YAML Configuration Testing**:
```bash
# Test YAML configuration
cat > config-test.yaml << EOF
basic_settings:
  timeout: 5
  verbose: false
  port: 5000

audio_settings:
  adaptive_buffering: true
  min_buffer_size: 200
  max_buffer_size: 500

manual_devices:
  - host: "192.168.1.100"
    port: 1400
    name: "Living Room"
EOF

./scripts/validate_config.js --format yaml config-test.yaml
```

**4. Environment Variable Testing**:
```bash
# Test environment configuration
cat > test.env << EOF
AIRSONOS_TIMEOUT=5
AIRSONOS_VERBOSE=true
AIRSONOS_PORT=5000
AIRSONOS_WORKER_THREADS=true
AIRSONOS_MAX_WORKERS=4
EOF

./scripts/validate_config.js --format env test.env
```

### Validation Rules

**Schema Validation**:
- All required fields present
- Correct data types
- Value range constraints
- Enum value validation
- Format validation (IP addresses, etc.)

**Logical Validation**:
- Buffer size relationships (min < max)
- Port conflict detection
- Ping interval relationships
- Resource limit consistency

**Security Validation**:
- Port numbers >1024 (except standard Sonos ports)
- IP address format validation
- No sensitive information exposure

**Best Practice Validation**:
- Performance optimization recommendations
- Resource usage warnings
- Configuration completeness

---

## Performance Benchmarking

### Benchmark Categories

**1. Startup Performance**:
```bash
# Measure initialization time
npx jest test/performance_benchmark.js --testNamePattern="initialization"

# Expected: <5 seconds for full initialization
```

**2. Audio Processing Performance**:
```bash
# Test audio buffer processing
npx jest test/performance_benchmark.js --testNamePattern="audio.*processing"

# Expected: <5ms per 4KB buffer
```

**3. Memory Performance**:
```bash
# Test memory usage patterns
npx jest test/performance_benchmark.js --testNamePattern="memory"

# Expected: <100MB baseline, <150MB under load
```

**4. Network Performance**:
```bash
# Test network operations
npx jest test/performance_benchmark.js --testNamePattern="network"

# Expected: <100ms local latency, <15s device connections
```

**5. CPU Performance**:
```bash
# Test CPU-intensive operations
npx jest test/performance_benchmark.js --testNamePattern="cpu"

# Expected: <80% CPU usage, efficient worker utilization
```

### Benchmark Analysis

**Result Interpretation**:
- Duration measurements in milliseconds
- Memory usage in MB
- CPU usage as percentage
- Network latency in milliseconds
- Throughput in operations/second

**Performance Targets**:
```javascript
// Performance thresholds
const PERFORMANCE_TARGETS = {
  startup: { max: 5000 },           // 5 seconds
  audioProcessing: { max: 5 },     // 5ms per buffer
  memoryUsage: { max: 100 },       // 100MB baseline
  networkLatency: { max: 100 },    // 100ms local
  cpuUsage: { max: 80 }            // 80% maximum
};
```

**Benchmark Reports**:
- Results saved to `test/benchmark-results/`
- JSON format with timestamps
- System information included
- Trend analysis capabilities

---

## Device Compatibility Testing

### Test Scenarios

**1. Mock Device Testing**:
```bash
# Test with mock Sonos devices
npx jest test/device_compatibility.js --testNamePattern="mock"

# All mock tests should pass
```

**2. Real Device Testing** (Optional):
```bash
# Test with actual Sonos devices on network
ENABLE_REAL_DEVICES=true npx jest test/device_compatibility.js

# Requires actual Sonos devices on local network
```

**3. Network Environment Testing**:
```bash
# Test network capabilities
npx jest test/device_compatibility.js --testNamePattern="network"

# Tests multicast, SSDP, mDNS support
```

### Device Test Categories

**Connectivity Tests**:
- TCP port accessibility
- HTTP endpoint availability
- Response time measurement
- Connection stability

**Protocol Tests**:
- UPnP service discovery
- SOAP action support
- XML parsing capability
- Service availability

**Audio Format Tests**:
- PCM format support
- ALAC compatibility
- Sample rate support
- Bit depth capabilities

**Performance Tests**:
- Response time measurement
- Concurrent connection handling
- Buffer optimization
- Throughput testing

### Compatibility Reports

**Report Generation**:
```bash
# Generate comprehensive compatibility report
npx jest test/device_compatibility.js --testNamePattern="compatibility report"

# Report includes:
# - Device detection results
# - Connectivity test results
# - Audio format support
# - Performance metrics
# - Recommendations
```

**Report Format**:
```json
{
  "devices": [
    {
      "host": "192.168.1.100",
      "model": "Sonos Play:5",
      "compatible": true,
      "connectivity": { "reachable": true, "responseTime": 45 },
      "audioSupport": { "pcm": true, "alac": true },
      "capabilities": { "volumeControl": true, "grouping": true },
      "performance": { "avgResponseTime": 67, "reliability": 95 }
    }
  ],
  "summary": {
    "total": 1,
    "compatible": 1,
    "issues": []
  },
  "recommendations": [
    "Enable ALAC for high-quality audio"
  ]
}
```

---

## Continuous Integration

### GitHub Actions Integration

**Test Workflow**:
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run test suite
        run: ./scripts/run_tests.sh --ci --coverage all
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./test-results/coverage/lcov.info
```

### Local CI Simulation

**Simulate CI Environment**:
```bash
# Run tests in CI mode locally
CI=true ./scripts/run_tests.sh --ci --timeout 600 all

# Test with different Node.js versions (using nvm)
nvm use 16 && npm test
nvm use 18 && npm test
nvm use 20 && npm test

# Test clean installation
rm -rf node_modules package-lock.json
npm install
./scripts/run_tests.sh --ci all
```

### Pre-commit Testing

**Git Hooks Setup**:
```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit tests..."
./scripts/run_tests.sh --ci --timeout 300 unit
if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

---

## Troubleshooting

### Common Issues

**1. Test Timeout Issues**:
```bash
# Increase timeout for slow systems
./scripts/run_tests.sh --timeout 900 all

# Run specific slow tests individually
npx jest test/performance_benchmark.js --testTimeout=120000
```

**2. Port Conflicts**:
```bash
# Check for port conflicts
netstat -tulpn | grep :5000
netstat -tulpn | grep :8099

# Use alternative ports
AIRSONOS_PORT=5001 WEBSOCKET_PORT=8098 ./scripts/run_tests.sh
```

**3. Memory Issues**:
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 node_modules/.bin/jest

# Run tests sequentially to reduce memory usage
npx jest --runInBand --forceExit
```

**4. Permission Issues**:
```bash
# Ensure scripts are executable
chmod +x scripts/run_tests.sh
chmod +x scripts/validate_config.js

# Check file permissions
ls -la scripts/
ls -la test/
```

**5. Network Issues**:
```bash
# Skip device connectivity tests
./scripts/run_tests.sh unit integration performance

# Test network connectivity manually
ping 192.168.1.100
telnet 192.168.1.100 1400
```

### Debug Mode

**Enable Debug Output**:
```bash
# Enable verbose Jest output
DEBUG=* npx jest test/unit_tests.js

# Enable Node.js debug
NODE_DEBUG=* ./scripts/run_tests.sh unit

# Enable application debug mode
DEBUG_MODE=true ./scripts/run_tests.sh
```

**Log Analysis**:
```bash
# View detailed test logs
tail -f test-results/test-run.log

# View specific test output
cat test-results/unit-tests.log

# Search for errors in logs
grep -i error test-results/*.log
```

### Performance Issues

**Slow Test Diagnosis**:
```bash
# Profile test execution
node --prof npx jest test/performance_benchmark.js
node --prof-process isolate-*.log > profile.txt

# Identify slow tests
npx jest --listTests --verbose | grep performance

# Run tests with timing
time ./scripts/run_tests.sh unit
```

**Memory Leak Detection**:
```bash
# Run with memory monitoring
node --inspect --max-old-space-size=512 npx jest

# Force garbage collection
node --expose-gc npx jest test/unit_tests.js
```

### Environment Issues

**Node.js Version Issues**:
```bash
# Check Node.js version
node --version
npm --version

# Install compatible version
nvm install 18
nvm use 18
```

**Dependency Issues**:
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for vulnerabilities
npm audit
npm audit fix
```

---

## Best Practices

### Test Development

**1. Test Structure**:
- Use descriptive test names
- Group related tests in describe blocks
- Include setup and teardown procedures
- Mock external dependencies appropriately

**2. Test Isolation**:
- Each test should be independent
- Clean up resources after each test
- Use fresh instances for each test
- Avoid shared state between tests

**3. Test Coverage**:
- Aim for >80% code coverage
- Focus on critical paths
- Test error conditions
- Include edge cases

**4. Performance Testing**:
- Set realistic performance targets
- Test under various load conditions
- Monitor resource usage
- Compare against baselines

### Configuration Testing

**1. Validation Strategy**:
- Test both valid and invalid configurations
- Cover all configuration formats
- Test edge cases and boundary values
- Validate error messages

**2. Environment Testing**:
- Test in multiple environments
- Use representative test data
- Test configuration migration
- Validate default values

### CI/CD Integration

**1. Test Automation**:
- Run tests on every commit
- Use matrix testing for multiple environments
- Fail fast on critical issues
- Generate comprehensive reports

**2. Performance Monitoring**:
- Track performance trends
- Set performance budgets
- Alert on regressions
- Archive benchmark results

### Maintenance

**1. Regular Updates**:
- Update test dependencies regularly
- Review and update performance targets
- Maintain test documentation
- Clean up obsolete tests

**2. Test Quality**:
- Review test coverage regularly
- Refactor slow or flaky tests
- Update mocks when APIs change
- Maintain test data quality

---

## Additional Resources

### Documentation

- [Project README](../README.md)
- [Technical Documentation](../DOCS.md)
- [Configuration Reference](../DOCS.md#configuration-reference)
- [API Reference](../DOCS.md#api-reference)

### Tools and Libraries

- [Jest Testing Framework](https://jestjs.io/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [JSON Schema Validation](https://ajv.js.org/)

### Support

- [GitHub Issues](https://github.com/HansonTan/airsonos-optimized/issues)
- [GitHub Discussions](https://github.com/HansonTan/airsonos-optimized/discussions)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

*This document is part of the AirSonos Optimized testing suite. For questions or improvements, please create an issue or discussion on GitHub.*