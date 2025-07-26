#!/usr/bin/env node

/**
 * Installation Verification Script for AirSonos Optimized
 * 
 * This script verifies that AirSonos Optimized is properly installed and configured,
 * performs health checks, and validates the system requirements.
 * 
 * Usage:
 *   node scripts/verify_installation.js [options]
 *   npm run verify
 *   npm run verify:full
 * 
 * Options:
 *   --full                 Perform comprehensive verification including device tests
 *   --quick               Quick verification (dependencies and basic config only)
 *   --config <file>       Verify specific configuration file
 *   --network             Test network connectivity and discovery
 *   --performance         Run performance benchmarks
 *   --verbose             Enable verbose output
 *   --json                Output results in JSON format
 *   --fix                 Attempt to fix common issues automatically
 *   --help                Show help message
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class InstallationVerifier {
    constructor(options = {}) {
        this.options = {
            full: options.full || false,
            quick: options.quick || false,
            network: options.network || false,
            performance: options.performance || false,
            verbose: options.verbose || false,
            json: options.json || false,
            fix: options.fix || false,
            configFile: options.configFile || null,
            ...options
        };
        
        this.projectRoot = path.join(__dirname, '..');
        this.results = {
            overall: 'unknown',
            timestamp: new Date().toISOString(),
            system: {},
            dependencies: {},
            configuration: {},
            network: {},
            performance: {},
            issues: [],
            recommendations: [],
            fixes: []
        };
    }

    async verify() {
        try {
            this.log('🔍 Starting AirSonos Optimized installation verification...');
            
            // System requirements check
            await this.checkSystemRequirements();
            
            // Dependencies check
            await this.checkDependencies();
            
            // File structure check
            await this.checkFileStructure();
            
            // Configuration check
            await this.checkConfiguration();
            
            // Permissions check
            await this.checkPermissions();
            
            // Network tests (if requested)
            if (this.options.network || this.options.full) {
                await this.checkNetwork();
            }
            
            // Performance tests (if requested)
            if (this.options.performance || this.options.full) {
                await this.runPerformanceTests();
            }
            
            // Service health check
            await this.checkServiceHealth();
            
            // Apply fixes if requested
            if (this.options.fix && this.results.fixes.length > 0) {
                await this.applyFixes();
            }
            
            // Generate final assessment
            this.generateAssessment();
            
            // Output results
            this.outputResults();
            
        } catch (error) {
            this.addIssue('critical', 'Verification failed', error.message);
            this.results.overall = 'failed';
            this.outputResults();
            process.exit(1);
        }
    }

    async checkSystemRequirements() {
        this.log('🖥️  Checking system requirements...');
        
        // Node.js version
        const nodeVersion = process.version;
        const requiredNodeVersion = '16.0.0';
        
        this.results.system.nodeVersion = nodeVersion;
        this.results.system.platform = process.platform;
        this.results.system.arch = process.arch;
        this.results.system.cpus = os.cpus().length;
        this.results.system.memory = Math.round(os.totalmem() / 1024 / 1024 / 1024); // GB
        
        if (this.compareVersions(nodeVersion.slice(1), requiredNodeVersion) < 0) {
            this.addIssue('critical', 'Node.js version too old', 
                `Required: ${requiredNodeVersion}+, Found: ${nodeVersion}`);
        } else {
            this.log(`✓ Node.js version: ${nodeVersion}`);
        }
        
        // Memory check
        if (this.results.system.memory < 1) {
            this.addIssue('warning', 'Low memory', 
                `Recommended: 2GB+, Available: ${this.results.system.memory}GB`);
        }
        
        // Platform support
        const supportedPlatforms = ['linux', 'darwin', 'win32'];
        if (!supportedPlatforms.includes(process.platform)) {
            this.addIssue('warning', 'Unsupported platform', 
                `Platform ${process.platform} may not be fully supported`);
        }
        
        this.log(`✓ System: ${process.platform} ${process.arch}, ${this.results.system.cpus} CPUs, ${this.results.system.memory}GB RAM`);
    }

    async checkDependencies() {
        this.log('📦 Checking dependencies...');
        
        try {
            // Check package.json exists
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            this.results.dependencies.packageJson = {
                name: packageJson.name,
                version: packageJson.version,
                dependencies: Object.keys(packageJson.dependencies || {}).length,
                devDependencies: Object.keys(packageJson.devDependencies || {}).length
            };
            
            // Check node_modules exists
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            try {
                await fs.access(nodeModulesPath);
                this.results.dependencies.nodeModulesExists = true;
                this.log('✓ node_modules directory found');
            } catch (error) {
                this.results.dependencies.nodeModulesExists = false;
                this.addIssue('critical', 'Missing dependencies', 
                    'node_modules directory not found. Run: npm install');
                return;
            }
            
            // Check critical dependencies
            const criticalDeps = [
                'express',
                'winston',
                'ws',
                'node-cache',
                'pidusage',
                'nodetunes',
                'sonos'
            ];
            
            this.results.dependencies.critical = {};
            
            for (const dep of criticalDeps) {
                try {
                    const depPath = path.join(nodeModulesPath, dep);
                    await fs.access(depPath);
                    this.results.dependencies.critical[dep] = true;
                    this.log(`✓ ${dep}`);
                } catch (error) {
                    this.results.dependencies.critical[dep] = false;
                    this.addIssue('critical', 'Missing dependency', 
                        `Required dependency '${dep}' not found`);
                }
            }
            
            // Check for security vulnerabilities
            if (!this.options.quick) {
                try {
                    const auditResult = execSync('npm audit --json', { 
                        cwd: this.projectRoot, 
                        stdio: 'pipe' 
                    });
                    const audit = JSON.parse(auditResult.toString());
                    
                    this.results.dependencies.vulnerabilities = {
                        total: audit.metadata?.vulnerabilities?.total || 0,
                        high: audit.metadata?.vulnerabilities?.high || 0,
                        critical: audit.metadata?.vulnerabilities?.critical || 0
                    };
                    
                    if (audit.metadata?.vulnerabilities?.critical > 0) {
                        this.addIssue('critical', 'Security vulnerabilities', 
                            `${audit.metadata.vulnerabilities.critical} critical vulnerabilities found`);
                    } else if (audit.metadata?.vulnerabilities?.high > 0) {
                        this.addIssue('warning', 'Security vulnerabilities', 
                            `${audit.metadata.vulnerabilities.high} high-severity vulnerabilities found`);
                    }
                } catch (error) {
                    this.results.dependencies.vulnerabilities = { error: error.message };
                }
            }
            
        } catch (error) {
            this.addIssue('critical', 'Package configuration error', error.message);
        }
    }

    async checkFileStructure() {
        this.log('📁 Checking file structure...');
        
        const requiredFiles = [
            'package.json',
            'config.yaml',
            'README.md',
            'CHANGELOG.md',
            'run.sh',
            'lib/index.js',
            'config/options.json',
            'config/services.yaml',
            'translations/en.json'
        ];
        
        const optionalFiles = [
            'DOCS.md',
            'apparmor.txt',
            'lib/health-check.js',
            'scripts/validate_config.js'
        ];
        
        this.results.configuration.files = {
            required: {},
            optional: {},
            missing: [],
            extra: []
        };
        
        // Check required files
        for (const file of requiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            try {
                const stats = await fs.stat(filePath);
                this.results.configuration.files.required[file] = {
                    exists: true,
                    size: stats.size,
                    modified: stats.mtime
                };
                this.log(`✓ ${file}`);
            } catch (error) {
                this.results.configuration.files.required[file] = { exists: false };
                this.results.configuration.files.missing.push(file);
                this.addIssue('critical', 'Missing required file', `${file} not found`);
            }
        }
        
        // Check optional files
        for (const file of optionalFiles) {
            const filePath = path.join(this.projectRoot, file);
            try {
                const stats = await fs.stat(filePath);
                this.results.configuration.files.optional[file] = {
                    exists: true,
                    size: stats.size,
                    modified: stats.mtime
                };
                this.log(`✓ ${file} (optional)`);
            } catch (error) {
                this.results.configuration.files.optional[file] = { exists: false };
            }
        }
        
        // Check executable permissions on run.sh
        try {
            const runShPath = path.join(this.projectRoot, 'run.sh');
            const stats = await fs.stat(runShPath);
            
            if (process.platform !== 'win32') {
                const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
                if (!isExecutable) {
                    this.addIssue('warning', 'File permissions', 'run.sh is not executable');
                    this.addFix('Make run.sh executable', `chmod +x ${runShPath}`);
                }
            }
        } catch (error) {
            // File doesn't exist, already reported above
        }
    }

    async checkConfiguration() {
        this.log('⚙️  Checking configuration...');
        
        try {
            // Check config.yaml
            const configPath = path.join(this.projectRoot, 'config.yaml');
            const yaml = require('js-yaml');
            const config = yaml.load(await fs.readFile(configPath, 'utf8'));
            
            this.results.configuration.config = {
                name: config.name,
                version: config.version,
                slug: config.slug,
                description: config.description,
                valid: true
            };
            
            // Validate required fields
            const requiredFields = ['name', 'version', 'slug', 'description', 'arch', 'startup'];
            for (const field of requiredFields) {
                if (!config[field]) {
                    this.addIssue('critical', 'Invalid configuration', 
                        `Missing required field '${field}' in config.yaml`);
                    this.results.configuration.config.valid = false;
                }
            }
            
            // Check options.json
            const optionsPath = path.join(this.projectRoot, 'config/options.json');
            const options = JSON.parse(await fs.readFile(optionsPath, 'utf8'));
            
            this.results.configuration.options = {
                hasSchema: !!options.schema,
                fieldCount: Object.keys(options.schema || {}).length,
                valid: true
            };
            
            if (!options.schema) {
                this.addIssue('warning', 'Configuration schema missing', 
                    'options.json should include a schema definition');
                this.results.configuration.options.valid = false;
            }
            
            // Validate specific configuration file if provided
            if (this.options.configFile) {
                await this.validateSpecificConfig(this.options.configFile);
            }
            
            this.log('✓ Configuration files are valid');
            
        } catch (error) {
            this.addIssue('critical', 'Configuration error', error.message);
            this.results.configuration.valid = false;
        }
    }

    async validateSpecificConfig(configFile) {
        try {
            const configPath = path.resolve(configFile);
            
            // Use the validate_config.js script if available
            const validateScript = path.join(this.projectRoot, 'scripts/validate_config.js');
            
            try {
                await fs.access(validateScript);
                
                const result = execSync(`node "${validateScript}" "${configPath}"`, {
                    stdio: 'pipe',
                    encoding: 'utf8'
                });
                
                this.results.configuration.userConfig = {
                    path: configPath,
                    valid: true,
                    message: result
                };
                
                this.log(`✓ User configuration is valid: ${configFile}`);
                
            } catch (error) {
                this.results.configuration.userConfig = {
                    path: configPath,
                    valid: false,
                    error: error.message
                };
                
                this.addIssue('warning', 'Invalid user configuration', 
                    `Configuration file ${configFile} has issues: ${error.message}`);
            }
            
        } catch (error) {
            this.addIssue('warning', 'Configuration validation failed', error.message);
        }
    }

    async checkPermissions() {
        this.log('🔐 Checking permissions...');
        
        const portsToCheck = [5000, 8099];
        this.results.network.ports = {};
        
        for (const port of portsToCheck) {
            try {
                const net = require('net');
                const server = net.createServer();
                
                await new Promise((resolve, reject) => {
                    server.listen(port, '127.0.0.1', () => {
                        server.close();
                        this.results.network.ports[port] = 'available';
                        this.log(`✓ Port ${port} is available`);
                        resolve();
                    });
                    
                    server.on('error', (error) => {
                        this.results.network.ports[port] = 'in_use';
                        if (error.code === 'EACCES') {
                            this.addIssue('critical', 'Permission denied', 
                                `Cannot bind to port ${port}. May need elevated privileges.`);
                        } else if (error.code === 'EADDRINUSE') {
                            this.addIssue('warning', 'Port in use', 
                                `Port ${port} is already in use`);
                        }
                        reject(error);
                    });
                });
            } catch (error) {
                // Port check failed, already handled above
            }
        }
        
        // Check file write permissions
        try {
            const testFile = path.join(this.projectRoot, '.write-test');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            this.results.configuration.writeAccess = true;
            this.log('✓ File write permissions OK');
        } catch (error) {
            this.results.configuration.writeAccess = false;
            this.addIssue('critical', 'File permissions', 
                'Cannot write to project directory. Check permissions.');
        }
    }

    async checkNetwork() {
        this.log('🌐 Testing network connectivity...');
        
        this.results.network.connectivity = {};
        
        // Test internet connectivity
        try {
            const { execSync } = require('child_process');
            execSync('ping -c 1 8.8.8.8', { stdio: 'pipe', timeout: 5000 });
            this.results.network.connectivity.internet = true;
            this.log('✓ Internet connectivity');
        } catch (error) {
            this.results.network.connectivity.internet = false;
            this.addIssue('warning', 'Network connectivity', 
                'No internet connectivity detected');
        }
        
        // Test local network
        try {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const localIPs = [];
            
            for (const iface of Object.values(interfaces)) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        localIPs.push(alias.address);
                    }
                }
            }
            
            this.results.network.interfaces = localIPs;
            this.results.network.connectivity.local = localIPs.length > 0;
            
            if (localIPs.length === 0) {
                this.addIssue('warning', 'Network configuration', 
                    'No local network interfaces found');
            } else {
                this.log(`✓ Local network interfaces: ${localIPs.join(', ')}`);
            }
        } catch (error) {
            this.addIssue('warning', 'Network detection failed', error.message);
        }
        
        // Test multicast support (important for Sonos discovery)
        try {
            const dgram = require('dgram');
            const socket = dgram.createSocket('udp4');
            
            await new Promise((resolve, reject) => {
                socket.bind(() => {
                    try {
                        socket.addMembership('239.255.255.250');
                        this.results.network.multicast = true;
                        this.log('✓ Multicast support available');
                        socket.close();
                        resolve();
                    } catch (error) {
                        this.results.network.multicast = false;
                        this.addIssue('warning', 'Multicast not supported', 
                            'Sonos device discovery may be limited');
                        socket.close();
                        resolve();
                    }
                });
            });
        } catch (error) {
            this.results.network.multicast = false;
            this.addIssue('warning', 'Multicast test failed', error.message);
        }
    }

    async runPerformanceTests() {
        this.log('🚀 Running performance tests...');
        
        // Basic startup time test
        const startTime = Date.now();
        try {
            // Test loading main module
            const mainPath = path.join(this.projectRoot, 'lib/index.js');
            require(mainPath);
            
            const loadTime = Date.now() - startTime;
            this.results.performance.moduleLoad = loadTime;
            
            if (loadTime > 5000) {
                this.addIssue('warning', 'Slow startup', 
                    `Module load time: ${loadTime}ms (expected <5000ms)`);
            } else {
                this.log(`✓ Module load time: ${loadTime}ms`);
            }
        } catch (error) {
            this.addIssue('critical', 'Module load failed', error.message);
        }
        
        // Memory usage test
        const memUsage = process.memoryUsage();
        this.results.performance.memory = {
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
        };
        
        if (this.results.performance.memory.rss > 200) {
            this.addIssue('warning', 'High memory usage', 
                `RSS: ${this.results.performance.memory.rss}MB (expected <200MB)`);
        }
        
        this.log(`✓ Memory usage: ${this.results.performance.memory.rss}MB RSS`);
    }

    async checkServiceHealth() {
        this.log('🏥 Checking service health...');
        
        try {
            // Check if health check script exists
            const healthCheckPath = path.join(this.projectRoot, 'lib/health-check.js');
            
            try {
                await fs.access(healthCheckPath);
                
                // Run health check
                const healthResult = execSync(`node "${healthCheckPath}"`, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    timeout: 10000
                });
                
                this.results.health = {
                    available: true,
                    status: 'healthy',
                    details: healthResult
                };
                
                this.log('✓ Health check passed');
                
            } catch (error) {
                this.results.health = {
                    available: true,
                    status: 'unhealthy',
                    error: error.message
                };
                
                this.addIssue('warning', 'Health check failed', error.message);
            }
            
        } catch (error) {
            this.results.health = {
                available: false,
                error: error.message
            };
            
            this.log('ℹ️  Health check script not available');
        }
    }

    async applyFixes() {
        this.log('🔧 Applying fixes...');
        
        for (const fix of this.results.fixes) {
            try {
                this.log(`Applying: ${fix.description}`);
                
                if (fix.command) {
                    execSync(fix.command, { stdio: 'pipe' });
                    this.log(`✓ ${fix.description}`);
                } else if (fix.action && typeof fix.action === 'function') {
                    await fix.action();
                    this.log(`✓ ${fix.description}`);
                }
            } catch (error) {
                this.log(`❌ Failed to apply fix: ${fix.description} - ${error.message}`);
            }
        }
    }

    generateAssessment() {
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
        const warningIssues = this.results.issues.filter(i => i.severity === 'warning').length;
        
        if (criticalIssues > 0) {
            this.results.overall = 'failed';
        } else if (warningIssues > 0) {
            this.results.overall = 'warning';
        } else {
            this.results.overall = 'passed';
        }
        
        // Generate recommendations
        if (this.results.system.memory < 2) {
            this.addRecommendation('Consider upgrading to at least 2GB RAM for optimal performance');
        }
        
        if (this.results.dependencies.vulnerabilities?.high > 0) {
            this.addRecommendation('Run "npm audit fix" to resolve security vulnerabilities');
        }
        
        if (!this.results.network.multicast) {
            this.addRecommendation('Enable multicast networking for better Sonos device discovery');
        }
        
        if (this.results.performance?.memory?.rss > 100) {
            this.addRecommendation('Monitor memory usage - consider reducing buffer sizes if needed');
        }
    }

    outputResults() {
        if (this.options.json) {
            console.log(JSON.stringify(this.results, null, 2));
            return;
        }
        
        console.log('\n📋 Installation Verification Report');
        console.log('=====================================');
        
        // Overall status
        const statusIcon = {
            'passed': '✅',
            'warning': '⚠️',
            'failed': '❌',
            'unknown': '❓'
        }[this.results.overall];
        
        console.log(`\nOverall Status: ${statusIcon} ${this.results.overall.toUpperCase()}`);
        
        // System info
        console.log(`\nSystem Information:`);
        console.log(`  Node.js: ${this.results.system.nodeVersion}`);
        console.log(`  Platform: ${this.results.system.platform} ${this.results.system.arch}`);
        console.log(`  CPUs: ${this.results.system.cpus}`);
        console.log(`  Memory: ${this.results.system.memory}GB`);
        
        // Issues
        if (this.results.issues.length > 0) {
            console.log(`\nIssues Found:`);
            for (const issue of this.results.issues) {
                const icon = issue.severity === 'critical' ? '❌' : '⚠️';
                console.log(`  ${icon} ${issue.category}: ${issue.message}`);
            }
        }
        
        // Recommendations
        if (this.results.recommendations.length > 0) {
            console.log(`\nRecommendations:`);
            for (const rec of this.results.recommendations) {
                console.log(`  💡 ${rec}`);
            }
        }
        
        // Dependencies
        if (this.results.dependencies.nodeModulesExists) {
            console.log(`\nDependencies: ✅ ${this.results.dependencies.packageJson.dependencies} installed`);
        }
        
        // Performance
        if (this.results.performance) {
            console.log(`\nPerformance:`);
            if (this.results.performance.moduleLoad) {
                console.log(`  Load time: ${this.results.performance.moduleLoad}ms`);
            }
            if (this.results.performance.memory) {
                console.log(`  Memory: ${this.results.performance.memory.rss}MB RSS`);
            }
        }
        
        console.log('\n=====================================');
        
        if (this.results.overall === 'passed') {
            console.log('🎉 AirSonos Optimized is properly installed and ready to use!');
        } else if (this.results.overall === 'warning') {
            console.log('⚠️  AirSonos Optimized is installed but has some issues that should be addressed.');
        } else {
            console.log('❌ AirSonos Optimized installation has critical issues that must be fixed.');
            process.exit(1);
        }
    }

    addIssue(severity, category, message) {
        this.results.issues.push({ severity, category, message });
    }

    addRecommendation(message) {
        this.results.recommendations.push(message);
    }

    addFix(description, command) {
        this.results.fixes.push({ description, command });
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 < part2) return -1;
            if (part1 > part2) return 1;
        }
        
        return 0;
    }

    log(message) {
        if (this.options.verbose || (!this.options.json && !message.startsWith('✓'))) {
            console.log(`[VERIFY] ${message}`);
        }
    }
}

// CLI interface
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--full':
                options.full = true;
                break;
            case '--quick':
                options.quick = true;
                break;
            case '--network':
                options.network = true;
                break;
            case '--performance':
                options.performance = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--json':
                options.json = true;
                break;
            case '--fix':
                options.fix = true;
                break;
            case '--config':
                options.configFile = args[++i];
                break;
            case '--help':
                showUsage();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('--')) {
                    console.warn(`Unknown option: ${arg}`);
                }
                break;
        }
    }
    
    return options;
}

function showUsage() {
    console.log(`
AirSonos Optimized Installation Verification

Usage: node scripts/verify_installation.js [options]

Options:
  --full                 Perform comprehensive verification including device tests
  --quick               Quick verification (dependencies and basic config only)
  --config <file>       Verify specific configuration file
  --network             Test network connectivity and discovery
  --performance         Run performance benchmarks
  --verbose             Enable verbose output
  --json                Output results in JSON format
  --fix                 Attempt to fix common issues automatically
  --help                Show this help message

Examples:
  node scripts/verify_installation.js                    # Basic verification
  node scripts/verify_installation.js --full             # Comprehensive check
  node scripts/verify_installation.js --config user.json # Verify user config
  node scripts/verify_installation.js --json > report.json # JSON output
`);
}

// Run if called directly
if (require.main === module) {
    const options = parseArgs();
    const verifier = new InstallationVerifier(options);
    verifier.verify();
}

module.exports = { InstallationVerifier };