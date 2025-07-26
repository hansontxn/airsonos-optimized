#!/usr/bin/env node

/**
 * Configuration Validation Tool for AirSonos Optimized
 * 
 * This script provides comprehensive validation for AirSonos configuration files,
 * supporting multiple input formats and providing detailed error reporting.
 * 
 * Usage:
 *   node scripts/validate_config.js [options] <config-file>
 *   node scripts/validate_config.js --help
 * 
 * Options:
 *   --format <format>    Specify config format (auto|json|yaml|env)
 *   --schema <file>      Use custom validation schema
 *   --fix               Attempt to auto-fix common issues
 *   --output <file>     Output validated config to file
 *   --verbose           Enable verbose output
 *   --strict            Enable strict validation mode
 *   --check-devices     Test device connectivity
 *   --dry-run          Don't save changes, just report
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Default configuration schema
const DEFAULT_SCHEMA = {
    type: 'object',
    properties: {
        basic_settings: {
            type: 'object',
            properties: {
                timeout: { type: 'integer', minimum: 1, maximum: 60 },
                verbose: { type: 'boolean' },
                port: { type: 'integer', minimum: 1024, maximum: 65535 },
                discovery_timeout: { type: 'integer', minimum: 5, maximum: 60 },
                max_devices: { type: 'integer', minimum: 1, maximum: 100 }
            },
            additionalProperties: false
        },
        audio_settings: {
            type: 'object',
            properties: {
                adaptive_buffering: { type: 'boolean' },
                min_buffer_size: { type: 'integer', minimum: 50, maximum: 1000 },
                max_buffer_size: { type: 'integer', minimum: 100, maximum: 2000 },
                enable_alac: { type: 'boolean' },
                smart_format_detection: { type: 'boolean' }
            },
            additionalProperties: false
        },
        performance_settings: {
            type: 'object',
            properties: {
                enable_worker_threads: { type: 'boolean' },
                max_workers: { type: 'integer', minimum: 0, maximum: 16 },
                config_mode: { type: 'string', enum: ['auto', 'easy', 'advanced', 'quality', 'efficiency'] },
                network_buffer_size: { type: 'integer', minimum: 16, maximum: 512 },
                backpressure_threshold: { type: 'number', minimum: 0.1, maximum: 1.0 }
            },
            additionalProperties: false
        },
        health_monitoring: {
            type: 'object',
            properties: {
                health_check_interval: { type: 'integer', minimum: 5000, maximum: 300000 },
                adaptive_ping_interval: { type: 'boolean' },
                min_ping_interval: { type: 'integer', minimum: 1000, maximum: 30000 },
                max_ping_interval: { type: 'integer', minimum: 10000, maximum: 300000 }
            },
            additionalProperties: false
        },
        manual_devices: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    host: { type: 'string', format: 'ipv4' },
                    port: { type: 'integer', minimum: 1, maximum: 65535 },
                    enabled: { type: 'boolean' }
                },
                required: ['host'],
                additionalProperties: false
            }
        },
        integration_settings: {
            type: 'object',
            properties: {
                enable_dashboard: { type: 'boolean' },
                enable_notifications: { type: 'boolean' },
                notification_level: { type: 'string', enum: ['info', 'warning', 'error'] },
                update_interval: { type: 'integer', minimum: 5, maximum: 300 },
                websocket_port: { type: 'integer', minimum: 1024, maximum: 65535 }
            },
            additionalProperties: false
        },
        advanced_settings: {
            type: 'object',
            properties: {
                debug_mode: { type: 'boolean' },
                performance_monitoring: { type: 'boolean' },
                custom_airplay_name: { type: 'string', maxLength: 50 },
                force_format: { type: 'string', enum: ['auto', 'pcm', 'alac', 'aac'] },
                experimental_features: { type: 'boolean' }
            },
            additionalProperties: false
        }
    },
    additionalProperties: false
};

class ConfigValidator {
    constructor(options = {}) {
        this.options = {
            verbose: options.verbose || false,
            strict: options.strict || false,
            fix: options.fix || false,
            dryRun: options.dryRun || false,
            checkDevices: options.checkDevices || false,
            ...options
        };
        
        this.ajv = new Ajv({ allErrors: true, verbose: true });
        addFormats(this.ajv);
        
        this.schema = options.schema || DEFAULT_SCHEMA;
        this.validate = this.ajv.compile(this.schema);
        
        this.results = {
            valid: false,
            errors: [],
            warnings: [],
            fixes: [],
            deviceTests: []
        };
    }

    async validateFile(configPath, format = 'auto') {
        try {
            this.log(`Validating configuration file: ${configPath}`);
            
            // Check file exists and is readable
            await this.checkFileAccess(configPath);
            
            // Detect format if auto
            if (format === 'auto') {
                format = this.detectFormat(configPath);
            }
            
            // Load configuration
            const config = await this.loadConfig(configPath, format);
            
            // Validate configuration
            await this.validateConfiguration(config);
            
            // Test device connectivity if requested
            if (this.options.checkDevices && config.manual_devices) {
                await this.testDeviceConnectivity(config.manual_devices);
            }
            
            // Apply fixes if requested
            if (this.options.fix && this.results.fixes.length > 0) {
                await this.applyFixes(config, configPath, format);
            }
            
            return this.results;
            
        } catch (error) {
            this.results.valid = false;
            this.results.errors.push({
                type: 'file_error',
                message: error.message,
                severity: 'error'
            });
            return this.results;
        }
    }

    async checkFileAccess(configPath) {
        try {
            const stats = await fs.stat(configPath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${configPath}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Configuration file not found: ${configPath}`);
            } else if (error.code === 'EACCES') {
                throw new Error(`Permission denied reading file: ${configPath}`);
            }
            throw error;
        }
    }

    detectFormat(configPath) {
        const ext = path.extname(configPath).toLowerCase();
        
        switch (ext) {
            case '.json':
                return 'json';
            case '.yaml':
            case '.yml':
                return 'yaml';
            case '.env':
                return 'env';
            default:
                // Try to detect from content
                return 'json'; // Default to JSON
        }
    }

    async loadConfig(configPath, format) {
        const content = await fs.readFile(configPath, 'utf8');
        
        switch (format) {
            case 'json':
                return this.parseJSON(content, configPath);
            case 'yaml':
                return this.parseYAML(content, configPath);
            case 'env':
                return this.parseEnv(content, configPath);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    parseJSON(content, configPath) {
        try {
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Invalid JSON in ${configPath}: ${error.message}`);
        }
    }

    parseYAML(content, configPath) {
        try {
            return yaml.load(content);
        } catch (error) {
            throw new Error(`Invalid YAML in ${configPath}: ${error.message}`);
        }
    }

    parseEnv(content, configPath) {
        const config = {};
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    this.setNestedValue(config, this.mapEnvKey(key.trim()), this.parseEnvValue(value));
                }
            }
        }
        
        return config;
    }

    mapEnvKey(envKey) {
        const mapping = {
            'AIRSONOS_TIMEOUT': 'basic_settings.timeout',
            'AIRSONOS_VERBOSE': 'basic_settings.verbose',
            'AIRSONOS_PORT': 'basic_settings.port',
            'AIRSONOS_WORKER_THREADS': 'performance_settings.enable_worker_threads',
            'AIRSONOS_MAX_WORKERS': 'performance_settings.max_workers',
            'AIRSONOS_DEBUG': 'advanced_settings.debug_mode'
        };
        
        return mapping[envKey] || envKey.toLowerCase().replace('airsonos_', '');
    }

    parseEnvValue(value) {
        // Remove quotes
        value = value.replace(/^["']|["']$/g, '');
        
        // Parse boolean
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Parse number
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        
        return value;
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    async validateConfiguration(config) {
        this.log('Validating configuration against schema...');
        
        // Schema validation
        const valid = this.validate(config);
        
        if (!valid) {
            this.results.valid = false;
            this.validate.errors.forEach(error => {
                this.results.errors.push({
                    type: 'schema_error',
                    path: error.instancePath,
                    message: error.message,
                    data: error.data,
                    severity: 'error'
                });
            });
        } else {
            this.results.valid = true;
        }
        
        // Custom validation rules
        await this.validateCustomRules(config);
        
        // Check for common issues
        this.checkCommonIssues(config);
        
        // Generate recommendations
        this.generateRecommendations(config);
    }

    async validateCustomRules(config) {
        // Validate buffer size relationships
        if (config.audio_settings) {
            const audio = config.audio_settings;
            if (audio.min_buffer_size && audio.max_buffer_size && 
                audio.min_buffer_size >= audio.max_buffer_size) {
                this.results.errors.push({
                    type: 'logical_error',
                    path: 'audio_settings',
                    message: 'min_buffer_size must be less than max_buffer_size',
                    severity: 'error'
                });
                
                if (this.options.fix) {
                    this.results.fixes.push({
                        type: 'buffer_size_fix',
                        description: 'Swap min and max buffer sizes',
                        action: () => {
                            const temp = audio.min_buffer_size;
                            audio.min_buffer_size = audio.max_buffer_size;
                            audio.max_buffer_size = temp;
                        }
                    });
                }
            }
        }
        
        // Validate ping interval relationships
        if (config.health_monitoring) {
            const health = config.health_monitoring;
            if (health.min_ping_interval && health.max_ping_interval &&
                health.min_ping_interval >= health.max_ping_interval) {
                this.results.errors.push({
                    type: 'logical_error',
                    path: 'health_monitoring',
                    message: 'min_ping_interval must be less than max_ping_interval',
                    severity: 'error'
                });
            }
        }
        
        // Validate port conflicts
        const ports = [];
        if (config.basic_settings?.port) ports.push(config.basic_settings.port);
        if (config.integration_settings?.websocket_port) ports.push(config.integration_settings.websocket_port);
        
        const duplicatePorts = ports.filter((port, index) => ports.indexOf(port) !== index);
        if (duplicatePorts.length > 0) {
            this.results.errors.push({
                type: 'port_conflict',
                message: `Port conflict detected: ${duplicatePorts.join(', ')}`,
                severity: 'error'
            });
        }
        
        // Validate device configurations
        if (config.manual_devices) {
            for (let i = 0; i < config.manual_devices.length; i++) {
                const device = config.manual_devices[i];
                await this.validateDevice(device, i);
            }
        }
    }

    async validateDevice(device, index) {
        const devicePath = `manual_devices[${index}]`;
        
        // Check for duplicate devices
        const duplicates = this.findDuplicateDevices(device, index);
        if (duplicates.length > 0) {
            this.results.warnings.push({
                type: 'duplicate_device',
                path: devicePath,
                message: `Duplicate device found at indices: ${duplicates.join(', ')}`,
                severity: 'warning'
            });
        }
        
        // Validate IP address format (basic check beyond schema)
        if (device.host && !this.isValidIP(device.host)) {
            this.results.errors.push({
                type: 'invalid_ip',
                path: `${devicePath}.host`,
                message: `Invalid IP address format: ${device.host}`,
                severity: 'error'
            });
        }
        
        // Check for common Sonos ports
        if (device.port && ![1400, 1401].includes(device.port)) {
            this.results.warnings.push({
                type: 'unusual_port',
                path: `${devicePath}.port`,
                message: `Unusual port for Sonos device: ${device.port} (typical: 1400, 1401)`,
                severity: 'warning'
            });
        }
    }

    findDuplicateDevices(device, currentIndex) {
        // This would need access to the full config - simplified for example
        return [];
    }

    isValidIP(ip) {
        const parts = ip.split('.');
        return parts.length === 4 && parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }

    checkCommonIssues(config) {
        // Check for overly aggressive settings
        if (config.health_monitoring?.health_check_interval && 
            config.health_monitoring.health_check_interval < 10000) {
            this.results.warnings.push({
                type: 'aggressive_monitoring',
                path: 'health_monitoring.health_check_interval',
                message: 'Very frequent health checks may impact performance',
                severity: 'warning'
            });
        }
        
        // Check for resource-intensive settings
        if (config.performance_settings?.max_workers && 
            config.performance_settings.max_workers > 8) {
            this.results.warnings.push({
                type: 'high_resource_usage',
                path: 'performance_settings.max_workers',
                message: 'High worker count may cause resource contention',
                severity: 'warning'
            });
        }
        
        // Check for missing recommended settings
        if (!config.audio_settings?.adaptive_buffering) {
            this.results.warnings.push({
                type: 'missing_optimization',
                message: 'Adaptive buffering is disabled - may impact audio quality',
                severity: 'info'
            });
        }
    }

    generateRecommendations(config) {
        const recommendations = [];
        
        // Performance recommendations
        if (config.performance_settings?.enable_worker_threads === false) {
            recommendations.push({
                type: 'performance',
                message: 'Enable worker threads for better performance on multi-core systems',
                suggestion: 'Set performance_settings.enable_worker_threads to true'
            });
        }
        
        // Monitoring recommendations
        if (!config.integration_settings?.enable_dashboard) {
            recommendations.push({
                type: 'monitoring',
                message: 'Enable dashboard for better system visibility',
                suggestion: 'Set integration_settings.enable_dashboard to true'
            });
        }
        
        // Device recommendations
        if (!config.manual_devices || config.manual_devices.length === 0) {
            recommendations.push({
                type: 'devices',
                message: 'No manual devices configured - discovery may be unreliable',
                suggestion: 'Add known Sonos devices to manual_devices array'
            });
        }
        
        this.results.recommendations = recommendations;
    }

    async testDeviceConnectivity(devices) {
        this.log('Testing device connectivity...');
        
        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            const result = await this.testSingleDevice(device, i);
            this.results.deviceTests.push(result);
        }
    }

    async testSingleDevice(device, index) {
        const devicePath = `manual_devices[${index}]`;
        const result = {
            device: device,
            path: devicePath,
            reachable: false,
            responseTime: null,
            error: null
        };
        
        try {
            const start = Date.now();
            
            // Simple TCP connection test
            await new Promise((resolve, reject) => {
                const net = require('net');
                const socket = new net.Socket();
                
                const timeout = setTimeout(() => {
                    socket.destroy();
                    reject(new Error('Connection timeout'));
                }, 5000);
                
                socket.connect(device.port || 1400, device.host, () => {
                    clearTimeout(timeout);
                    socket.destroy();
                    resolve();
                });
                
                socket.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            result.reachable = true;
            result.responseTime = Date.now() - start;
            
        } catch (error) {
            result.error = error.message;
            
            this.results.warnings.push({
                type: 'device_unreachable',
                path: devicePath,
                message: `Device unreachable: ${device.host}:${device.port || 1400} - ${error.message}`,
                severity: 'warning'
            });
        }
        
        return result;
    }

    async applyFixes(config, configPath, format) {
        if (this.options.dryRun) {
            this.log('Dry run mode - fixes would be applied but not saved');
            return;
        }
        
        this.log(`Applying ${this.results.fixes.length} fixes...`);
        
        for (const fix of this.results.fixes) {
            try {
                if (typeof fix.action === 'function') {
                    fix.action();
                    this.log(`Applied fix: ${fix.description}`);
                }
            } catch (error) {
                this.results.warnings.push({
                    type: 'fix_failed',
                    message: `Failed to apply fix "${fix.description}": ${error.message}`,
                    severity: 'warning'
                });
            }
        }
        
        // Save fixed configuration
        if (this.options.output) {
            await this.saveConfig(config, this.options.output, format);
        } else {
            await this.saveConfig(config, configPath, format);
        }
    }

    async saveConfig(config, filePath, format) {
        let content;
        
        switch (format) {
            case 'json':
                content = JSON.stringify(config, null, 2);
                break;
            case 'yaml':
                content = yaml.dump(config, { indent: 2 });
                break;
            default:
                throw new Error(`Cannot save in format: ${format}`);
        }
        
        await fs.writeFile(filePath, content, 'utf8');
        this.log(`Configuration saved to: ${filePath}`);
    }

    log(message) {
        if (this.options.verbose) {
            console.log(`[CONFIG-VALIDATOR] ${message}`);
        }
    }

    generateReport() {
        const report = {
            summary: {
                valid: this.results.valid,
                errors: this.results.errors.length,
                warnings: this.results.warnings.length,
                fixes: this.results.fixes.length,
                deviceTests: this.results.deviceTests.length
            },
            details: this.results
        };
        
        return report;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(getUsage());
        process.exit(0);
    }
    
    const options = parseArgs(args);
    const configFile = options._.pop();
    
    if (!configFile) {
        console.error('Error: Configuration file path is required');
        console.log(getUsage());
        process.exit(1);
    }
    
    try {
        const validator = new ConfigValidator(options);
        const results = await validator.validateFile(configFile, options.format);
        const report = validator.generateReport();
        
        // Output results
        console.log('\n=== Configuration Validation Report ===\n');
        
        if (report.summary.valid) {
            console.log('✅ Configuration is valid');
        } else {
            console.log('❌ Configuration has errors');
        }
        
        console.log(`\nSummary:`);
        console.log(`  Errors: ${report.summary.errors}`);
        console.log(`  Warnings: ${report.summary.warnings}`);
        console.log(`  Fixes applied: ${report.summary.fixes}`);
        console.log(`  Device tests: ${report.summary.deviceTests}`);
        
        // Show errors
        if (results.errors.length > 0) {
            console.log('\n❌ Errors:');
            results.errors.forEach(error => {
                console.log(`  • ${error.path || 'config'}: ${error.message}`);
            });
        }
        
        // Show warnings
        if (results.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            results.warnings.forEach(warning => {
                console.log(`  • ${warning.path || 'config'}: ${warning.message}`);
            });
        }
        
        // Show recommendations
        if (results.recommendations && results.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            results.recommendations.forEach(rec => {
                console.log(`  • ${rec.message}`);
                if (rec.suggestion) {
                    console.log(`    Suggestion: ${rec.suggestion}`);
                }
            });
        }
        
        // Show device test results
        if (results.deviceTests.length > 0) {
            console.log('\n🔗 Device Connectivity:');
            results.deviceTests.forEach(test => {
                const status = test.reachable ? '✅' : '❌';
                const time = test.responseTime ? ` (${test.responseTime}ms)` : '';
                console.log(`  ${status} ${test.device.host}:${test.device.port || 1400}${time}`);
                if (test.error) {
                    console.log(`      Error: ${test.error}`);
                }
            });
        }
        
        // Exit with appropriate code
        process.exit(results.errors.length > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(`\n❌ Validation failed: ${error.message}`);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

function parseArgs(args) {
    const options = { _: [] };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            
            if (nextArg && !nextArg.startsWith('--')) {
                options[key] = nextArg;
                i++; // Skip next arg
            } else {
                options[key] = true;
            }
        } else {
            options._.push(arg);
        }
    }
    
    return options;
}

function getUsage() {
    return `
Configuration Validation Tool for AirSonos Optimized

Usage:
  node scripts/validate_config.js [options] <config-file>

Options:
  --format <format>      Specify config format (auto|json|yaml|env)
  --schema <file>        Use custom validation schema
  --fix                  Attempt to auto-fix common issues
  --output <file>        Output validated config to file
  --verbose              Enable verbose output
  --strict               Enable strict validation mode
  --check-devices        Test device connectivity
  --dry-run             Don't save changes, just report
  --help, -h            Show this help message

Examples:
  node scripts/validate_config.js config.json
  node scripts/validate_config.js --check-devices --verbose config.yaml
  node scripts/validate_config.js --fix --output fixed_config.json config.json
  node scripts/validate_config.js --format env .env
`;
}

// Export for use as module
module.exports = { ConfigValidator };

// Run as CLI if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}