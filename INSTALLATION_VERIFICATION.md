# Installation Verification Guide

This guide provides comprehensive commands and procedures to verify that AirSonos Optimized is properly installed and functioning correctly.

## 🚀 Quick Verification

### **One-Command Verification**
```bash
# Complete installation verification
npm run verify

# Or using the script directly
node scripts/verify_installation.js
```

### **Expected Output**
```
🔍 Starting AirSonos Optimized installation verification...
✅ Installation Complete!
Overall Status: ✅ PASSED
```

## 📋 Detailed Verification Commands

### **1. System Requirements Check**
```bash
# Check Node.js version (requires 16.0.0+)
node --version

# Check npm version
npm --version

# Check system information
node -p "process.platform, process.arch, os.cpus().length, Math.round(os.totalmem()/1024/1024/1024) + 'GB'" -e "const os = require('os')"
```

**Expected Results:**
- Node.js: v16.0.0 or higher
- npm: v8.0.0 or higher  
- Platform: linux, darwin, or win32
- Memory: 1GB+ (2GB+ recommended)

### **2. File Structure Validation**
```bash
# Validate complete file structure
node scripts/validate_structure.js

# Strict HACS validation
node scripts/validate_structure.js --strict

# With automatic fixes
node scripts/validate_structure.js --fix --verbose
```

**Expected Output:**
```
📋 AirSonos Optimized Structure Validation Report
Overall Status: ✅ PASSED
Completion: 100%
```

### **3. Dependencies Verification**
```bash
# Check if all dependencies are installed
npm list --depth=0

# Security audit
npm audit

# Check for missing dependencies
npm install --dry-run
```

**Critical Dependencies to Verify:**
- express (^4.18.2)
- winston (^3.8.2)
- ws (^8.14.0)
- node-cache (^5.1.2)
- pidusage (^3.0.2)

### **4. Configuration Validation**
```bash
# Validate main configuration
./scripts/validate_config.js config.yaml

# Validate Home Assistant options
./scripts/validate_config.js config/options.json --format json

# Test configuration with device checking
./scripts/validate_config.js config.yaml --check-devices --verbose

# Validate specific user configuration
./scripts/validate_config.js /path/to/user/config.json
```

**Expected Output:**
```
✅ Configuration is valid
Summary:
  Errors: 0
  Warnings: 0
```

### **5. Build System Verification**
```bash
# Test build process
npm run build

# Clean build
npm run build:clean

# Verify compiled output exists
ls -la lib/
ls -la lib/src/
```

**Expected Files in lib/:**
- index.js (main entry point)
- src/ directory with compiled files
- package.json (production version)
- config.yaml

### **6. Test Suite Verification**
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:compatibility

# Run tests with coverage
npm run test:coverage

# Run full test automation
./scripts/run_tests.sh --ci all
```

**Expected Results:**
```
✅ All tests passed successfully!
Tests Run: 4
Passed: 4
Failed: 0
Pass Rate: 100%
```

### **7. Network & Permissions Check**
```bash
# Check port availability
netstat -tulpn | grep :5000
netstat -tulpn | grep :8099

# Test network connectivity (if devices available)
node scripts/verify_installation.js --network

# Check file permissions (Unix systems)
ls -la run.sh
ls -la scripts/*.js
```

**Expected Results:**
- Ports 5000 and 8099 available or note if in use
- Scripts have executable permissions (rwxr-xr-x)

### **8. Service Health Check**
```bash
# Run health check
npm run health-check

# Or directly
node lib/health-check.js

# Monitor mode
npm run monitor
```

### **9. Performance Verification**
```bash
# Run performance benchmarks
npm run test:performance

# Memory usage test
node scripts/verify_installation.js --performance

# Startup time test
time npm start &
sleep 5
pkill -f airsonos
```

**Performance Targets:**
- Startup time: <15 seconds
- Memory usage: <100MB baseline
- CPU usage: <15% average

## 🛠️ Troubleshooting Verification Issues

### **Common Issues and Solutions**

#### **1. Node.js Version Too Old**
```bash
# Error: Node.js version too old
# Solution: Update Node.js
nvm install 18
nvm use 18
# Or download from nodejs.org
```

#### **2. Missing Dependencies**
```bash
# Error: Cannot find module 'xyz'
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### **3. Permission Denied**
```bash
# Error: Permission denied on scripts
# Solution: Fix permissions
chmod +x run.sh
chmod +x scripts/*.js
chmod +x scripts/*.sh
```

#### **4. Port Already in Use**
```bash
# Error: Port 5000 already in use
# Solution: Change port or stop conflicting service
export AIRSONOS_PORT=5001
# Or kill process using port
lsof -ti:5000 | xargs kill -9
```

#### **5. Configuration Invalid**
```bash
# Error: Configuration validation failed
# Solution: Fix configuration
./scripts/validate_config.js config.yaml --fix
# Or restore default
cp config/options.json.default config/options.json
```

### **Verbose Verification**
```bash
# Run verification with detailed output
node scripts/verify_installation.js --verbose --full

# Debug mode
DEBUG=* npm run verify

# JSON output for parsing
node scripts/verify_installation.js --json > verification-report.json
```

## 🏠 Home Assistant Specific Verification

### **1. Add-on Installation Check**
```bash
# Verify add-on files structure
ls -la /config/addons/airsonos-optimized/

# Check add-on configuration
cat /config/addons/airsonos-optimized/config.yaml

# Verify options schema
cat /config/addons/airsonos-optimized/config/options.json
```

### **2. Home Assistant Integration Test**
```bash
# Test HA integration
npm run test:integration

# Check service registration
curl -X GET http://localhost:8123/api/services | grep airsonos

# Test WebSocket connection
wscat -c ws://localhost:8099
```

### **3. Dashboard Verification**
```bash
# Check dashboard configuration
cat data/dashboard_config.json

# Verify translations
cat translations/en.json
```

## 🤖 Automated CI/CD Verification

### **GitHub Actions Verification**
```bash
# Run the same checks as CI/CD
.github/workflows/hacs.yaml

# Local CI simulation
act -j validate  # Requires 'act' tool
```

### **HACS Validation**
```bash
# HACS specific validation
node scripts/validate_structure.js --strict --format json

# Check HACS metadata
cat hacs.json  # If present
```

## 📊 Verification Report Generation

### **Generate Complete Report**
```bash
# Comprehensive verification report
node scripts/verify_installation.js --full --json > verification-report.json

# Human-readable report
node scripts/verify_installation.js --full --verbose > verification-report.txt

# Structure validation report
node scripts/validate_structure.js --output structure-report.txt
```

### **Report Contents**
- System information
- Dependency status
- File structure validation
- Configuration validation
- Test results
- Performance metrics
- Security audit results

## ✅ Success Criteria

### **Installation is verified when:**

1. **✅ System Requirements Met**
   - Node.js 16.0.0+
   - npm 8.0.0+
   - 1GB+ RAM available

2. **✅ All Files Present**
   - Required files exist
   - Executable permissions set
   - Configuration files valid

3. **✅ Dependencies Installed**
   - All npm packages installed
   - No security vulnerabilities
   - Compatible versions

4. **✅ Tests Pass**
   - Unit tests: 100% pass
   - Integration tests: Pass
   - Performance tests: Meet targets

5. **✅ Configuration Valid**
   - YAML/JSON syntax correct
   - Required fields present
   - Values within valid ranges

6. **✅ Network Ready**
   - Required ports available
   - Network permissions correct
   - Connectivity functional

## 🆘 Support Commands

### **Get Help**
```bash
# Show available commands
npm run

# Get script help
node scripts/verify_installation.js --help
./scripts/validate_config.js --help
node scripts/validate_structure.js --help

# Check documentation
cat README.md
cat DOCS.md
```

### **Create Support Bundle**
```bash
# Generate support information
{
  echo "=== System Information ==="
  node --version
  npm --version
  uname -a
  
  echo -e "\n=== Verification Report ==="
  node scripts/verify_installation.js --json
  
  echo -e "\n=== Structure Validation ==="
  node scripts/validate_structure.js --format json
  
  echo -e "\n=== Configuration Status ==="
  ./scripts/validate_config.js config.yaml
  
  echo -e "\n=== Test Results ==="
  npm test 2>&1 || true
  
} > support-bundle.txt

echo "Support bundle created: support-bundle.txt"
```

## 📞 Getting Help

If verification fails:

1. **Check the troubleshooting section above**
2. **Review the logs and error messages**
3. **Create a support bundle**
4. **Open an issue**: https://github.com/HansonTan/airsonos-optimized/issues
5. **Include**:
   - Verification report
   - System information
   - Error messages
   - Steps to reproduce

---

**🎯 Installation verification ensures AirSonos Optimized is ready for reliable operation with Home Assistant.**

*Generated with Claude Code - Co-Authored-By: Claude <noreply@anthropic.com>*