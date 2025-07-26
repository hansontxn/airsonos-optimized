#!/bin/bash

# Automated Testing Script for AirSonos Optimized CI/CD
# 
# This script provides comprehensive testing capabilities for the AirSonos Optimized
# project, including unit tests, integration tests, performance benchmarks, 
# device compatibility tests, and configuration validation.
#
# Usage:
#   ./scripts/run_tests.sh [options] [test-type]
#
# Test Types:
#   unit          - Run unit tests only
#   integration   - Run integration tests only
#   performance   - Run performance benchmarks
#   compatibility - Run device compatibility tests
#   validation    - Run configuration validation tests
#   all           - Run all tests (default)
#
# Options:
#   --verbose, -v        Enable verbose output
#   --coverage, -c       Generate code coverage report
#   --parallel, -p       Run tests in parallel where possible
#   --timeout <seconds>  Set test timeout (default: 300)
#   --output <dir>       Output directory for test results
#   --env <file>         Load environment variables from file
#   --config <file>      Use specific configuration file for tests
#   --ci                 CI mode (non-interactive, exit on failure)
#   --help, -h           Show this help message

set -euo pipefail

# Default configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_DIR="${PROJECT_DIR}/test"
OUTPUT_DIR="${PROJECT_DIR}/test-results"
LOG_FILE="${OUTPUT_DIR}/test-run.log"

# Default options
VERBOSE=false
COVERAGE=false
PARALLEL=false
TIMEOUT=300
CI_MODE=false
TEST_TYPE="all"
CONFIG_FILE=""
ENV_FILE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "PASS")  echo -e "${GREEN}[PASS]${NC} $message" ;;
        "FAIL")  echo -e "${RED}[FAIL]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "SKIP")  echo -e "${YELLOW}[SKIP]${NC} $message" ;;
    esac
}

# Function to log messages
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" >> "$LOG_FILE"
    if [[ "$VERBOSE" == "true" ]]; then
        echo "$message"
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
Automated Testing Script for AirSonos Optimized

Usage: $0 [options] [test-type]

Test Types:
  unit          Run unit tests only
  integration   Run integration tests only  
  performance   Run performance benchmarks
  compatibility Run device compatibility tests
  validation    Run configuration validation tests
  all           Run all tests (default)

Options:
  --verbose, -v        Enable verbose output
  --coverage, -c       Generate code coverage report
  --parallel, -p       Run tests in parallel where possible
  --timeout <seconds>  Set test timeout (default: 300)
  --output <dir>       Output directory for test results
  --env <file>         Load environment variables from file
  --config <file>      Use specific configuration file for tests
  --ci                 CI mode (non-interactive, exit on failure)
  --help, -h           Show this help message

Examples:
  $0                              # Run all tests
  $0 unit                         # Run unit tests only
  $0 --coverage --verbose all     # Run all tests with coverage and verbose output
  $0 --ci --timeout 600 all       # Run all tests in CI mode with 10min timeout

EOF
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --coverage|-c)
                COVERAGE=true
                shift
                ;;
            --parallel|-p)
                PARALLEL=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --env)
                ENV_FILE="$2"
                shift 2
                ;;
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --ci)
                CI_MODE=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            unit|integration|performance|compatibility|validation|all)
                TEST_TYPE="$1"
                shift
                ;;
            *)
                print_status "FAIL" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to setup test environment
setup_environment() {
    print_status "INFO" "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Initialize log file
    echo "Test run started at $(date)" > "$LOG_FILE"
    
    # Load environment file if specified
    if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
        print_status "INFO" "Loading environment from $ENV_FILE"
        set -o allexport
        source "$ENV_FILE"
        set +o allexport
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_status "FAIL" "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version)
    print_status "INFO" "Node.js version: $node_version"
    
    # Check npm and install dependencies if needed
    if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
        print_status "INFO" "Installing dependencies..."
        cd "$PROJECT_DIR"
        npm install --silent
    fi
    
    # Verify test files exist
    for test_file in unit_tests.js integration_tests.js performance_benchmark.js device_compatibility.js; do
        if [[ ! -f "$TEST_DIR/$test_file" ]]; then
            print_status "WARN" "Test file not found: $test_file"
        fi
    done
    
    log "Environment setup completed"
}

# Function to run unit tests
run_unit_tests() {
    print_status "INFO" "Running unit tests..."
    local start_time=$(date +%s)
    
    cd "$PROJECT_DIR"
    
    local jest_args="test/unit_tests.js --verbose"
    if [[ "$COVERAGE" == "true" ]]; then
        jest_args="$jest_args --coverage --coverageDirectory=$OUTPUT_DIR/coverage"
    fi
    
    if timeout "${TIMEOUT}s" npx jest $jest_args > "$OUTPUT_DIR/unit-tests.log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "PASS" "Unit tests completed in ${duration}s"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "FAIL" "Unit tests failed after ${duration}s"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        
        if [[ "$VERBOSE" == "true" || "$CI_MODE" == "true" ]]; then
            cat "$OUTPUT_DIR/unit-tests.log"
        fi
        
        if [[ "$CI_MODE" == "true" ]]; then
            exit 1
        fi
    fi
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Unit tests completed with status: $([ $((TESTS_FAILED)) -eq 0 ] && echo "PASS" || echo "FAIL")"
}

# Function to run integration tests
run_integration_tests() {
    print_status "INFO" "Running integration tests..."
    local start_time=$(date +%s)
    
    cd "$PROJECT_DIR"
    
    if timeout "${TIMEOUT}s" npx jest test/integration_tests.js --verbose > "$OUTPUT_DIR/integration-tests.log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "PASS" "Integration tests completed in ${duration}s"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "FAIL" "Integration tests failed after ${duration}s"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        
        if [[ "$VERBOSE" == "true" || "$CI_MODE" == "true" ]]; then
            cat "$OUTPUT_DIR/integration-tests.log"
        fi
        
        if [[ "$CI_MODE" == "true" ]]; then
            exit 1
        fi
    fi
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Integration tests completed with status: $([ $((TESTS_FAILED)) -eq 0 ] && echo "PASS" || echo "FAIL")"
}

# Function to run performance benchmarks
run_performance_tests() {
    print_status "INFO" "Running performance benchmarks..."
    local start_time=$(date +%s)
    
    cd "$PROJECT_DIR"
    
    # Run performance tests with longer timeout
    local perf_timeout=$((TIMEOUT * 2))
    
    if timeout "${perf_timeout}s" npx jest test/performance_benchmark.js --verbose --testTimeout=60000 > "$OUTPUT_DIR/performance-tests.log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "PASS" "Performance benchmarks completed in ${duration}s"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Look for benchmark results
        if [[ -d "$TEST_DIR/benchmark-results" ]]; then
            cp -r "$TEST_DIR/benchmark-results" "$OUTPUT_DIR/"
            print_status "INFO" "Benchmark results copied to output directory"
        fi
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "FAIL" "Performance benchmarks failed after ${duration}s"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        
        if [[ "$VERBOSE" == "true" || "$CI_MODE" == "true" ]]; then
            cat "$OUTPUT_DIR/performance-tests.log"
        fi
        
        if [[ "$CI_MODE" == "true" ]]; then
            exit 1
        fi
    fi
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Performance tests completed with status: $([ $((TESTS_FAILED)) -eq 0 ] && echo "PASS" || echo "FAIL")"
}

# Function to run device compatibility tests
run_compatibility_tests() {
    print_status "INFO" "Running device compatibility tests..."
    local start_time=$(date +%s)
    
    cd "$PROJECT_DIR"
    
    if timeout "${TIMEOUT}s" npx jest test/device_compatibility.js --verbose > "$OUTPUT_DIR/compatibility-tests.log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "PASS" "Compatibility tests completed in ${duration}s"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "FAIL" "Compatibility tests failed after ${duration}s"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        
        if [[ "$VERBOSE" == "true" || "$CI_MODE" == "true" ]]; then
            cat "$OUTPUT_DIR/compatibility-tests.log"
        fi
        
        if [[ "$CI_MODE" == "true" ]]; then
            exit 1
        fi
    fi
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Compatibility tests completed with status: $([ $((TESTS_FAILED)) -eq 0 ] && echo "PASS" || echo "FAIL")"
}

# Function to run configuration validation tests
run_validation_tests() {
    print_status "INFO" "Running configuration validation tests..."
    local start_time=$(date +%s)
    
    # Test the validation script itself
    if [[ -f "$SCRIPT_DIR/validate_config.js" ]]; then
        cd "$PROJECT_DIR"
        
        # Create test configuration files
        local test_config_dir="$OUTPUT_DIR/test-configs"
        mkdir -p "$test_config_dir"
        
        # Valid configuration
        cat > "$test_config_dir/valid.json" << EOF
{
  "basic_settings": {
    "timeout": 5,
    "verbose": false,
    "port": 5000
  },
  "audio_settings": {
    "adaptive_buffering": true,
    "min_buffer_size": 200,
    "max_buffer_size": 500
  }
}
EOF
        
        # Invalid configuration
        cat > "$test_config_dir/invalid.json" << EOF
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
        
        local validation_passed=true
        
        # Test valid configuration
        if node "$SCRIPT_DIR/validate_config.js" --verbose "$test_config_dir/valid.json" > "$OUTPUT_DIR/validation-valid.log" 2>&1; then
            log "Valid configuration test passed"
        else
            print_status "FAIL" "Valid configuration was incorrectly flagged as invalid"
            validation_passed=false
        fi
        
        # Test invalid configuration (should fail)
        if ! node "$SCRIPT_DIR/validate_config.js" --verbose "$test_config_dir/invalid.json" > "$OUTPUT_DIR/validation-invalid.log" 2>&1; then
            log "Invalid configuration test passed (correctly failed)"
        else
            print_status "FAIL" "Invalid configuration was incorrectly flagged as valid"
            validation_passed=false
        fi
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$validation_passed" == "true" ]]; then
            print_status "PASS" "Configuration validation tests completed in ${duration}s"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_status "FAIL" "Configuration validation tests failed after ${duration}s"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            
            if [[ "$CI_MODE" == "true" ]]; then
                exit 1
            fi
        fi
    else
        print_status "SKIP" "Configuration validation script not found"
    fi
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log "Validation tests completed"
}

# Function to run linting and formatting checks
run_lint_checks() {
    print_status "INFO" "Running code quality checks..."
    local start_time=$(date +%s)
    
    cd "$PROJECT_DIR"
    
    local lint_passed=true
    
    # Check if ESLint is available
    if command -v npx eslint &> /dev/null; then
        if npx eslint --ext .js src/ test/ > "$OUTPUT_DIR/eslint.log" 2>&1; then
            log "ESLint passed"
        else
            print_status "WARN" "ESLint found issues"
            lint_passed=false
            
            if [[ "$VERBOSE" == "true" ]]; then
                cat "$OUTPUT_DIR/eslint.log"
            fi
        fi
    else
        print_status "SKIP" "ESLint not available"
    fi
    
    # Check if Prettier is available
    if command -v npx prettier &> /dev/null; then
        if npx prettier --check "src/**/*.js" "test/**/*.js" > "$OUTPUT_DIR/prettier.log" 2>&1; then
            log "Prettier check passed"
        else
            print_status "WARN" "Prettier found formatting issues"
            lint_passed=false
            
            if [[ "$VERBOSE" == "true" ]]; then
                cat "$OUTPUT_DIR/prettier.log"
            fi
        fi
    else
        print_status "SKIP" "Prettier not available"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$lint_passed" == "true" ]]; then
        print_status "PASS" "Code quality checks completed in ${duration}s"
    else
        print_status "WARN" "Code quality checks found issues (${duration}s)"
    fi
    
    log "Lint checks completed"
}

# Function to generate test report
generate_report() {
    print_status "INFO" "Generating test report..."
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    local pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    
    local report_file="$OUTPUT_DIR/test-report.txt"
    
    cat > "$report_file" << EOF
======================================
AirSonos Optimized Test Report
======================================

Test Run: $(date)
Duration: ${total_duration}s
Test Type: $TEST_TYPE

Results Summary:
  Tests Run: $TESTS_RUN
  Passed: $TESTS_PASSED
  Failed: $TESTS_FAILED
  Pass Rate: ${pass_rate}%

Configuration:
  Verbose: $VERBOSE
  Coverage: $COVERAGE
  Parallel: $PARALLEL
  Timeout: ${TIMEOUT}s
  CI Mode: $CI_MODE

Output Directory: $OUTPUT_DIR

$(if [[ "$COVERAGE" == "true" && -d "$OUTPUT_DIR/coverage" ]]; then
    echo "Coverage Report: $OUTPUT_DIR/coverage/index.html"
fi)

Log Files:
$(find "$OUTPUT_DIR" -name "*.log" -type f | sed 's/^/  /')

$(if [[ $TESTS_FAILED -gt 0 ]]; then
    echo "❌ Some tests failed. Check the log files for details."
else
    echo "✅ All tests passed successfully!"
fi)

======================================
EOF
    
    print_status "INFO" "Test report saved to: $report_file"
    
    # Display summary
    echo
    echo "======================================"
    echo "Test Summary"
    echo "======================================"
    echo "Tests Run: $TESTS_RUN"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Duration: ${total_duration}s"
    echo "Pass Rate: ${pass_rate}%"
    echo "======================================"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        print_status "FAIL" "Some tests failed"
        return 1
    else
        print_status "PASS" "All tests passed"
        return 0
    fi
}

# Main execution function
main() {
    parse_args "$@"
    
    echo "🧪 AirSonos Optimized Test Runner"
    echo "=================================="
    echo
    
    setup_environment
    
    case "$TEST_TYPE" in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "compatibility")
            run_compatibility_tests
            ;;
        "validation")
            run_validation_tests
            ;;
        "all")
            run_lint_checks
            
            if [[ "$PARALLEL" == "true" ]]; then
                print_status "INFO" "Running tests in parallel..."
                
                # Run tests in background
                run_unit_tests &
                local unit_pid=$!
                
                run_integration_tests &
                local integration_pid=$!
                
                run_compatibility_tests &
                local compatibility_pid=$!
                
                # Wait for all background jobs
                wait $unit_pid
                wait $integration_pid
                wait $compatibility_pid
                
                # Run sequential tests
                run_performance_tests
                run_validation_tests
            else
                run_unit_tests
                run_integration_tests
                run_performance_tests
                run_compatibility_tests
                run_validation_tests
            fi
            ;;
        *)
            print_status "FAIL" "Unknown test type: $TEST_TYPE"
            show_usage
            exit 1
            ;;
    esac
    
    generate_report
    local report_status=$?
    
    if [[ "$CI_MODE" == "true" ]]; then
        exit $report_status
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi