#!/usr/bin/env node

/**
 * Post-Installation Script for AirSonos Optimized
 * 
 * This script runs after npm install to set up the environment,
 * validate the installation, and perform initial configuration.
 * 
 * Usage:
 *   node scripts/post_install.js [options]
 *   (automatically run by npm postinstall)
 * 
 * Options:
 *   --skip-setup         Skip initial setup wizard
 *   --skip-validation    Skip installation validation
 *   --force              Force setup even if already configured
 *   --quiet              Minimal output
 *   --verbose            Detailed output
 *   --help               Show help message
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class PostInstaller {
    constructor(options = {}) {
        this.options = {
            skipSetup: options.skipSetup || false,
            skipValidation: options.skipValidation || false,
            force: options.force || false,
            quiet: options.quiet || false,
            verbose: options.verbose || false,
            ...options
        };
        
        this.projectRoot = path.join(__dirname, '..');
        this.setupComplete = false;
    }

    async run() {
        try {
            if (!this.options.quiet) {
                this.showWelcome();
            }
            
            // Check if this is a fresh installation
            const isFirstInstall = await this.checkFirstInstall();
            
            // Set up file permissions
            await this.setupPermissions();
            
            // Validate installation
            if (!this.options.skipValidation) {
                await this.validateInstallation();
            }
            
            // Run initial setup for first-time installations
            if (isFirstInstall && !this.options.skipSetup) {
                await this.runInitialSetup();
            }
            
            // Create default configuration if none exists
            await this.ensureDefaultConfiguration();
            
            // Set up development environment if needed
            await this.setupDevelopmentEnvironment();
            
            // Display completion message
            if (!this.options.quiet) {
                this.showCompletionMessage();
            }
            
        } catch (error) {
            console.error(`❌ Post-installation failed: ${error.message}`);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    showWelcome() {
        console.log(`
🎵 AirSonos Optimized v0.3.0
================================

High-performance AirPlay to Sonos bridge with Home Assistant integration.

Setting up your installation...
`);
    }

    async checkFirstInstall() {
        try {
            // Check for marker file that indicates previous installation
            const markerPath = path.join(this.projectRoot, '.installed');
            await fs.access(markerPath);
            return false; // Not first install
        } catch (error) {
            // Marker doesn't exist, this is first install
            const markerContent = {
                installed: new Date().toISOString(),
                version: '0.3.0',
                platform: process.platform,
                arch: process.arch
            };
            
            await fs.writeFile(
                path.join(this.projectRoot, '.installed'),
                JSON.stringify(markerContent, null, 2)
            );
            
            this.log('First installation detected');
            return true;
        }
    }

    async setupPermissions() {
        this.log('Setting up file permissions...');
        
        if (process.platform === 'win32') {
            // Windows doesn't use Unix permissions
            return;
        }
        
        const executableFiles = [
            'run.sh',
            'scripts/validate_config.js',
            'scripts/verify_installation.js',
            'scripts/cleanup.js',
            'scripts/run_tests.sh'
        ];
        
        for (const file of executableFiles) {
            try {
                const filePath = path.join(this.projectRoot, file);
                await fs.access(filePath);
                
                // Make file executable
                execSync(`chmod +x "${filePath}"`, { stdio: 'pipe' });
                this.log(`✓ Made executable: ${file}`);
            } catch (error) {
                // File doesn't exist, skip
            }
        }
    }

    async validateInstallation() {
        this.log('Validating installation...');
        
        try {
            // Use the verification script if available
            const verifyScript = path.join(this.projectRoot, 'scripts/verify_installation.js');
            
            try {
                await fs.access(verifyScript);
                
                const result = execSync(`node "${verifyScript}" --quick --json`, {
                    stdio: 'pipe',
                    encoding: 'utf8'
                });
                
                const verification = JSON.parse(result);
                
                if (verification.overall === 'passed') {
                    this.log('✅ Installation validation passed');
                } else if (verification.overall === 'warning') {
                    this.log('⚠️  Installation validation passed with warnings');
                    if (this.options.verbose) {
                        verification.issues.forEach(issue => {
                            console.warn(`  Warning: ${issue.message}`);
                        });
                    }
                } else {
                    throw new Error('Installation validation failed');
                }
                
            } catch (error) {
                this.warn('Could not run full validation, performing basic checks');
                await this.basicValidation();
            }
            
        } catch (error) {
            throw new Error(`Installation validation failed: ${error.message}`);
        }
    }

    async basicValidation() {
        // Check Node.js version
        const nodeVersion = process.version;
        const requiredVersion = '16.0.0';
        
        if (this.compareVersions(nodeVersion.slice(1), requiredVersion) < 0) {
            throw new Error(`Node.js ${requiredVersion}+ required, found ${nodeVersion}`);
        }
        
        // Check required files
        const requiredFiles = [
            'package.json',
            'config.yaml',
            'config/options.json'
        ];
        
        for (const file of requiredFiles) {
            try {
                await fs.access(path.join(this.projectRoot, file));
            } catch (error) {
                throw new Error(`Missing required file: ${file}`);
            }
        }
        
        this.log('✓ Basic validation passed');
    }

    async runInitialSetup() {
        this.log('Running initial setup...');
        
        // Create data directories
        await this.createDataDirectories();
        
        // Generate default configuration
        await this.generateDefaultConfiguration();
        
        // Set up logging
        await this.setupLogging();
        
        // Display setup information
        await this.displaySetupInfo();
        
        this.setupComplete = true;
        this.log('✅ Initial setup completed');
    }

    async createDataDirectories() {
        const directories = [
            'data',
            'logs',
            'backups',
            'tmp'
        ];
        
        for (const dir of directories) {
            const dirPath = path.join(this.projectRoot, dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
                this.log(`✓ Created directory: ${dir}`);
            } catch (error) {
                this.warn(`Failed to create directory ${dir}: ${error.message}`);
            }
        }
    }

    async generateDefaultConfiguration() {
        const configPath = path.join(this.projectRoot, 'data/airsonos_optimized_config.json');
        
        try {
            // Check if config already exists
            await fs.access(configPath);
            this.log('Configuration file already exists');
            return;
        } catch (error) {
            // Config doesn't exist, create default
        }
        
        const defaultConfig = {
            basic_settings: {
                timeout: 5,
                verbose: false,
                port: 5000,
                discovery_timeout: 10,
                max_devices: 50
            },
            audio_settings: {
                adaptive_buffering: true,
                min_buffer_size: 200,
                max_buffer_size: 500,
                enable_alac: true,
                smart_format_detection: true
            },
            performance_settings: {
                enable_worker_threads: true,
                max_workers: 0, // Auto-detect
                config_mode: "auto",
                network_buffer_size: 64,
                backpressure_threshold: 0.8
            },
            health_monitoring: {
                health_check_interval: 30000,
                adaptive_ping_interval: true,
                min_ping_interval: 5000,
                max_ping_interval: 60000
            },
            manual_devices: [],
            integration_settings: {
                enable_dashboard: true,
                enable_notifications: true,
                notification_level: "info",
                update_interval: 30,
                websocket_port: 8099
            },
            advanced_settings: {
                debug_mode: false,
                performance_monitoring: true,
                custom_airplay_name: "",
                force_format: "auto",
                experimental_features: false
            }
        };
        
        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
        this.log('✓ Created default configuration');
    }

    async setupLogging() {
        const logDir = path.join(this.projectRoot, 'logs');
        
        // Create log configuration
        const logConfig = {
            level: 'info',
            format: 'combined',
            outputs: [
                {
                    type: 'file',
                    filename: path.join(logDir, 'airsonos.log'),
                    maxSize: '10MB',
                    maxFiles: 5
                },
                {
                    type: 'console',
                    level: 'info'
                }
            ]
        };
        
        await fs.writeFile(
            path.join(this.projectRoot, 'data/logging_config.json'),
            JSON.stringify(logConfig, null, 2)
        );
        
        this.log('✓ Set up logging configuration');
    }

    async ensureDefaultConfiguration() {
        // Ensure Home Assistant addon configuration exists
        const haConfigPath = path.join(this.projectRoot, 'config/options.json');
        
        try {
            await fs.access(haConfigPath);
        } catch (error) {
            this.warn('Home Assistant options.json not found, creating default');
            
            const defaultOptions = {
                schema: {
                    timeout: "int(1,60)?",
                    verbose: "bool?",
                    port: "port?",
                    devices: "str?",
                    enable_worker_threads: "bool?",
                    adaptive_buffering: "bool?",
                    min_buffer_size: "int(50,1000)?",
                    max_buffer_size: "int(100,2000)?",
                    config_mode: "list(auto|easy|advanced)?",
                    enable_dashboard: "bool?",
                    enable_notifications: "bool?",
                    notification_level: "list(info|warning|error)?",
                    websocket_port: "port?",
                    debug_mode: "bool?",
                    performance_monitoring: "bool?"
                }
            };
            
            await fs.mkdir(path.dirname(haConfigPath), { recursive: true });
            await fs.writeFile(haConfigPath, JSON.stringify(defaultOptions, null, 2));
        }
    }

    async setupDevelopmentEnvironment() {
        // Check if this is a development environment
        const isDev = process.env.NODE_ENV === 'development' || 
                     await this.checkDevEnvironment();
        
        if (!isDev) {
            return;
        }
        
        this.log('Setting up development environment...');
        
        // Create development configuration
        const devConfigPath = path.join(this.projectRoot, '.env.development');
        
        if (!await this.fileExists(devConfigPath)) {
            const devConfig = `# Development Environment Configuration
NODE_ENV=development
AIRSONOS_DEBUG=true
AIRSONOS_VERBOSE=true
AIRSONOS_PORT=5001
AIRSONOS_WEBSOCKET_PORT=8098
AIRSONOS_PERFORMANCE_MONITORING=true
`;
            
            await fs.writeFile(devConfigPath, devConfig);
            this.log('✓ Created development configuration');
        }
        
        // Set up Git hooks if .git directory exists
        if (await this.fileExists(path.join(this.projectRoot, '.git'))) {
            await this.setupGitHooks();
        }
    }

    async setupGitHooks() {
        const hookDir = path.join(this.projectRoot, '.git/hooks');
        
        try {
            // Create pre-commit hook for testing
            const preCommitHook = `#!/bin/bash
echo "Running pre-commit checks..."
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed. Please fix errors before committing."
    exit 1
fi

npm run test:unit
if [ $? -ne 0 ]; then
    echo "Unit tests failed. Please fix tests before committing."
    exit 1
fi
`;
            
            const hookPath = path.join(hookDir, 'pre-commit');
            await fs.writeFile(hookPath, preCommitHook);
            
            if (process.platform !== 'win32') {
                execSync(`chmod +x "${hookPath}"`, { stdio: 'pipe' });
            }
            
            this.log('✓ Set up Git pre-commit hook');
        } catch (error) {
            this.warn(`Failed to set up Git hooks: ${error.message}`);
        }
    }

    async displaySetupInfo() {
        if (this.options.quiet) {
            return;
        }
        
        console.log(`
📋 Setup Information:
====================

Configuration: data/airsonos_optimized_config.json
Logs:         logs/airsonos.log
Data:         data/

Quick Start:
  npm start                    # Start AirSonos Optimized
  npm run verify              # Verify installation
  npm run validate:config     # Validate configuration
  npm test                    # Run tests

Home Assistant:
  Add this addon to your Home Assistant instance
  Configure via the addon UI
  Monitor via the generated dashboard

Documentation:
  README.md     # Quick start guide
  DOCS.md       # Technical documentation
  CHANGELOG.md  # Version history
`);
    }

    showCompletionMessage() {
        if (this.setupComplete) {
            console.log(`
🎉 Installation Complete!
========================

AirSonos Optimized is ready to use. Next steps:

1. Review and adjust configuration in data/airsonos_optimized_config.json
2. Run 'npm start' to start the service
3. Check 'npm run verify' to validate everything is working
4. Visit the documentation for advanced configuration

For Home Assistant users:
- Install this addon through HACS or manually
- Configure via the addon UI
- Enable dashboard and notifications for monitoring

Need help? Check the documentation or create an issue:
https://github.com/HansonTan/airsonos-optimized/issues
`);
        } else {
            console.log(`
✅ Post-installation completed successfully!

AirSonos Optimized is ready to use.
Run 'npm start' to begin streaming AirPlay to Sonos.
`);
        }
    }

    async checkDevEnvironment() {
        // Check for development indicators
        const devIndicators = [
            '.git',
            'test',
            '.eslintrc.js',
            'jest.config.js'
        ];
        
        for (const indicator of devIndicators) {
            if (await this.fileExists(path.join(this.projectRoot, indicator))) {
                return true;
            }
        }
        
        return false;
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
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
        if (!this.options.quiet) {
            console.log(`[SETUP] ${message}`);
        }
    }

    warn(message) {
        if (!this.options.quiet) {
            console.warn(`[SETUP WARN] ${message}`);
        }
    }
}

// CLI interface
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (const arg of args) {
        switch (arg) {
            case '--skip-setup':
                options.skipSetup = true;
                break;
            case '--skip-validation':
                options.skipValidation = true;
                break;
            case '--force':
                options.force = true;
                break;
            case '--quiet':
                options.quiet = true;
                break;
            case '--verbose':
                options.verbose = true;
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
AirSonos Optimized Post-Installation Script

Usage: node scripts/post_install.js [options]

Options:
  --skip-setup         Skip initial setup wizard
  --skip-validation    Skip installation validation
  --force              Force setup even if already configured
  --quiet              Minimal output
  --verbose            Detailed output
  --help               Show this help message

This script is automatically run after 'npm install' to set up
AirSonos Optimized for first use.
`);
}

// Run if called directly
if (require.main === module) {
    const options = parseArgs();
    const installer = new PostInstaller(options);
    installer.run();
}

module.exports = { PostInstaller };