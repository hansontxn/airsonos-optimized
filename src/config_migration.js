#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

class ConfigurationMigrator {
    constructor(options = {}) {
        this.options = {
            verbose: options.verbose || false,
            dryRun: options.dryRun || false,
            backupConfigs: options.backupConfigs !== false,
            outputPath: options.outputPath || '/data/airsonos_optimized_config.json',
            ...options
        };
        
        this.setupLogging();
        this.migrationMap = this.createMigrationMap();
        this.migrationResults = {
            success: false,
            migratedSettings: {},
            warnings: [],
            errors: [],
            backupPaths: []
        };
    }

    setupLogging() {
        this.logger = winston.createLogger({
            level: this.options.verbose ? 'debug' : 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    createMigrationMap() {
        return {
            // Legacy AirSonos configurations
            legacy: {
                configPaths: [
                    '/config/airsonos.json',
                    '/config/options.json', 
                    './config.json',
                    './airsonos.json',
                    process.env.HOME + '/.airsonos/config.json'
                ],
                packagePaths: [
                    './package.json',
                    '../package.json'
                ],
                settingsMap: {
                    'timeout': 'basic_settings.timeout',
                    'verbose': 'basic_settings.verbose',
                    'port': 'basic_settings.port',
                    'diagnostics': 'advanced_settings.debug_mode',
                    'devices': 'manual_devices'
                }
            },
            // Home Assistant add-on configurations
            hassio: {
                configPaths: [
                    '/data/options.json',
                    '/config/addons_config/airsonos.json'
                ],
                settingsMap: {
                    'timeout': 'basic_settings.timeout',
                    'verbose': 'basic_settings.verbose',
                    'discovery_timeout': 'basic_settings.discovery_timeout',
                    'max_devices': 'basic_settings.max_devices'
                }
            },
            // Docker configurations
            docker: {
                envVars: [
                    'AIRSONOS_TIMEOUT',
                    'AIRSONOS_VERBOSE',
                    'AIRSONOS_PORT',
                    'AIRSONOS_DEVICES'
                ],
                settingsMap: {
                    'AIRSONOS_TIMEOUT': 'basic_settings.timeout',
                    'AIRSONOS_VERBOSE': 'basic_settings.verbose',
                    'AIRSONOS_PORT': 'basic_settings.port',
                    'AIRSONOS_DEVICES': 'manual_devices'
                }
            }
        };
    }

    async migrateAllConfigurations() {
        this.logger.info('Starting comprehensive configuration migration...');
        
        if (this.options.dryRun) {
            this.logger.info('Running in DRY RUN mode - no files will be modified');
        }
        
        try {
            // Initialize with optimal defaults
            const migratedConfig = this.createDefaultOptimizedConfig();
            
            // Migrate from legacy AirSonos configurations
            await this.migrateLegacyConfigs(migratedConfig);
            
            // Migrate from Home Assistant add-on configurations
            await this.migrateHassioConfigs(migratedConfig);
            
            // Migrate from Docker environment variables
            await this.migrateDockerConfigs(migratedConfig);
            
            // Migrate from package.json configurations
            await this.migratePackageJsonConfigs(migratedConfig);
            
            // Validate and optimize the final configuration
            this.validateAndOptimizeConfig(migratedConfig);
            
            // Save the migrated configuration
            if (!this.options.dryRun) {
                await this.saveConfiguration(migratedConfig);
            }
            
            this.migrationResults.success = true;
            this.migrationResults.migratedSettings = migratedConfig;
            
            this.logger.info('Configuration migration completed successfully');
            this.printMigrationSummary();
            
            return this.migrationResults;
            
        } catch (error) {
            this.logger.error('Configuration migration failed', { error: error.message });
            this.migrationResults.errors.push(error.message);
            throw error;
        }
    }

    createDefaultOptimizedConfig() {
        return {
            version: '0.3.0',
            migrated: true,
            migration_timestamp: new Date().toISOString(),
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
                config_mode: 'auto',
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
                notification_level: 'info',
                update_interval: 30,
                websocket_port: 8099
            },
            advanced_settings: {
                debug_mode: false,
                performance_monitoring: true,
                custom_airplay_name: '',
                force_format: 'auto',
                experimental_features: false
            }
        };
    }

    async migrateLegacyConfigs(migratedConfig) {
        this.logger.info('Migrating legacy AirSonos configurations...');
        
        const { configPaths, settingsMap } = this.migrationMap.legacy;
        
        for (const configPath of configPaths) {
            try {
                const exists = await this.fileExists(configPath);
                if (exists) {
                    this.logger.info(`Found legacy config: ${configPath}`);
                    
                    const legacyConfig = await this.loadJsonFile(configPath);
                    if (legacyConfig) {
                        await this.applyLegacyMigration(legacyConfig, migratedConfig, settingsMap);
                        
                        if (this.options.backupConfigs) {
                            await this.backupConfigFile(configPath);
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Error processing legacy config ${configPath}`, { error: error.message });
                this.migrationResults.warnings.push(`Failed to process ${configPath}: ${error.message}`);
            }
        }
    }

    async applyLegacyMigration(legacyConfig, migratedConfig, settingsMap) {
        this.logger.debug('Applying legacy configuration migration...', legacyConfig);
        
        // Direct setting mappings
        for (const [legacyKey, modernPath] of Object.entries(settingsMap)) {
            if (legacyConfig.hasOwnProperty(legacyKey)) {
                const value = legacyConfig[legacyKey];
                this.setNestedValue(migratedConfig, modernPath, value);
                this.logger.debug(`Migrated ${legacyKey} -> ${modernPath}:`, value);
            }
        }
        
        // Special handling for devices array
        if (legacyConfig.devices && Array.isArray(legacyConfig.devices)) {
            legacyConfig.devices.forEach(device => {
                const normalizedDevice = this.normalizeDeviceConfig(device);
                if (normalizedDevice) {
                    migratedConfig.manual_devices.push(normalizedDevice);
                }
            });
        }
        
        // Handle deprecated settings with warnings
        this.handleDeprecatedSettings(legacyConfig);
    }

    normalizeDeviceConfig(device) {
        // Handle various legacy device configuration formats
        if (typeof device === 'string') {
            // Format: "192.168.1.100" or "192.168.1.100:1400"
            const [host, port] = device.split(':');
            return {
                name: `Legacy-${host}`,
                host: host,
                port: parseInt(port) || 1400,
                enabled: true
            };
        } else if (typeof device === 'object' && device.host) {
            // Format: { host: "192.168.1.100", port: 1400, name: "Living Room" }
            return {
                name: device.name || `Legacy-${device.host}`,
                host: device.host,
                port: device.port || 1400,
                enabled: device.enabled !== false
            };
        }
        
        this.logger.warn('Unrecognized device format:', device);
        return null;
    }

    handleDeprecatedSettings(legacyConfig) {
        const deprecatedSettings = [
            'controlTimeout',
            'serverName',
            'zones',
            'metadata',
            'preBuffer'
        ];
        
        deprecatedSettings.forEach(setting => {
            if (legacyConfig.hasOwnProperty(setting)) {
                this.migrationResults.warnings.push(
                    `Deprecated setting '${setting}' found - this setting is no longer used in the optimized version`
                );
            }
        });
    }

    async migrateHassioConfigs(migratedConfig) {
        this.logger.info('Migrating Home Assistant add-on configurations...');
        
        const { configPaths, settingsMap } = this.migrationMap.hassio;
        
        for (const configPath of configPaths) {
            try {
                const exists = await this.fileExists(configPath);
                if (exists) {
                    this.logger.info(`Found Home Assistant config: ${configPath}`);
                    
                    const hassioConfig = await this.loadJsonFile(configPath);
                    if (hassioConfig) {
                        this.applyDirectMappings(hassioConfig, migratedConfig, settingsMap);
                        
                        // Handle Home Assistant specific settings
                        this.migrateHassioSpecificSettings(hassioConfig, migratedConfig);
                        
                        if (this.options.backupConfigs) {
                            await this.backupConfigFile(configPath);
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Error processing Home Assistant config ${configPath}`, { error: error.message });
                this.migrationResults.warnings.push(`Failed to process ${configPath}: ${error.message}`);
            }
        }
    }

    migrateHassioSpecificSettings(hassioConfig, migratedConfig) {
        // Enable Home Assistant integration features
        migratedConfig.integration_settings.enable_dashboard = true;
        migratedConfig.integration_settings.enable_notifications = true;
        
        // Import add-on specific settings
        if (hassioConfig.ssl) {
            this.migrationResults.warnings.push('SSL setting found - SSL is now handled by Home Assistant Supervisor');
        }
        
        if (hassioConfig.certfile || hassioConfig.keyfile) {
            this.migrationResults.warnings.push('SSL certificate settings found - these are now managed by Home Assistant');
        }
        
        // Migrate watchdog settings
        if (hassioConfig.watchdog !== undefined) {
            migratedConfig.health_monitoring.adaptive_ping_interval = hassioConfig.watchdog;
        }
    }

    async migrateDockerConfigs(migratedConfig) {
        this.logger.info('Migrating Docker environment configurations...');
        
        const { envVars, settingsMap } = this.migrationMap.docker;
        
        for (const envVar of envVars) {
            if (process.env[envVar]) {
                this.logger.info(`Found Docker environment variable: ${envVar}`);
                
                const value = this.parseEnvironmentValue(process.env[envVar]);
                const modernPath = settingsMap[envVar];
                
                if (modernPath) {
                    this.setNestedValue(migratedConfig, modernPath, value);
                    this.logger.debug(`Migrated ${envVar} -> ${modernPath}:`, value);
                }
            }
        }
        
        // Handle Docker-specific device configuration
        if (process.env.AIRSONOS_DEVICES) {
            const devices = this.parseDockerDevices(process.env.AIRSONOS_DEVICES);
            devices.forEach(device => {
                if (device) {
                    migratedConfig.manual_devices.push(device);
                }
            });
        }
    }

    parseEnvironmentValue(value) {
        // Parse environment variables appropriately
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        if (/^\d+$/.test(value)) return parseInt(value);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        return value;
    }

    parseDockerDevices(deviceString) {
        // Parse comma-separated device list from environment variable
        // Format: "192.168.1.100:1400,192.168.1.101:1400" or "192.168.1.100,192.168.1.101"
        return deviceString.split(',').map(deviceStr => {
            const trimmed = deviceStr.trim();
            if (trimmed) {
                return this.normalizeDeviceConfig(trimmed);
            }
            return null;
        }).filter(Boolean);
    }

    async migratePackageJsonConfigs(migratedConfig) {
        this.logger.info('Migrating package.json configurations...');
        
        const { packagePaths } = this.migrationMap.legacy;
        
        for (const packagePath of packagePaths) {
            try {
                const exists = await this.fileExists(packagePath);
                if (exists) {
                    const packageJson = await this.loadJsonFile(packagePath);
                    
                    if (packageJson && packageJson.name === 'airsonos') {
                        this.logger.info(`Found AirSonos package.json: ${packagePath}`);
                        
                        // Migrate version and metadata
                        if (packageJson.version) {
                            migratedConfig.legacy_version = packageJson.version;
                        }
                        
                        // Check for custom scripts that might indicate configuration
                        if (packageJson.scripts) {
                            this.analyzePackageScripts(packageJson.scripts, migratedConfig);
                        }
                        
                        // Check for custom configuration in package.json
                        if (packageJson.airsonos) {
                            this.applyDirectMappings(
                                packageJson.airsonos, 
                                migratedConfig, 
                                this.migrationMap.legacy.settingsMap
                            );
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Error processing package.json ${packagePath}`, { error: error.message });
            }
        }
    }

    analyzePackageScripts(scripts, migratedConfig) {
        // Analyze npm scripts for configuration hints
        if (scripts.start) {
            const startScript = scripts.start;
            
            // Look for command line arguments in start script
            if (startScript.includes('--verbose')) {
                migratedConfig.basic_settings.verbose = true;
            }
            
            if (startScript.includes('--timeout')) {
                const timeoutMatch = startScript.match(/--timeout\s+(\d+)/);
                if (timeoutMatch) {
                    migratedConfig.basic_settings.timeout = parseInt(timeoutMatch[1]);
                }
            }
            
            if (startScript.includes('--diagnostics')) {
                migratedConfig.advanced_settings.debug_mode = true;
            }
        }
    }

    validateAndOptimizeConfig(migratedConfig) {
        this.logger.info('Validating and optimizing migrated configuration...');
        
        // Validate port numbers
        this.validatePort(migratedConfig.basic_settings, 'port');
        this.validatePort(migratedConfig.integration_settings, 'websocket_port');
        
        // Validate timeout values
        if (migratedConfig.basic_settings.timeout < 1 || migratedConfig.basic_settings.timeout > 60) {
            this.logger.warn('Invalid timeout value, resetting to default');
            migratedConfig.basic_settings.timeout = 5;
        }
        
        // Validate buffer sizes
        this.validateBufferSizes(migratedConfig.audio_settings);
        
        // Remove duplicate devices
        this.deduplicateDevices(migratedConfig);
        
        // Optimize based on device count
        this.optimizeForDeviceCount(migratedConfig);
        
        // Set migration metadata
        migratedConfig.migration_summary = {
            devices_migrated: migratedConfig.manual_devices.length,
            warnings: this.migrationResults.warnings.length,
            optimizations_applied: true
        };
    }

    validatePort(settings, portKey) {
        const port = settings[portKey];
        if (port < 1024 || port > 65535) {
            this.logger.warn(`Invalid ${portKey} ${port}, using default`);
            settings[portKey] = portKey === 'port' ? 5000 : 8099;
        }
    }

    validateBufferSizes(audioSettings) {
        if (audioSettings.min_buffer_size > audioSettings.max_buffer_size) {
            this.logger.warn('Invalid buffer size range, swapping values');
            [audioSettings.min_buffer_size, audioSettings.max_buffer_size] = 
            [audioSettings.max_buffer_size, audioSettings.min_buffer_size];
        }
        
        if (audioSettings.min_buffer_size < 50) audioSettings.min_buffer_size = 50;
        if (audioSettings.max_buffer_size > 2000) audioSettings.max_buffer_size = 2000;
    }

    deduplicateDevices(migratedConfig) {
        const seen = new Set();
        migratedConfig.manual_devices = migratedConfig.manual_devices.filter(device => {
            const key = `${device.host}:${device.port}`;
            if (seen.has(key)) {
                this.logger.debug(`Removing duplicate device: ${key}`);
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    optimizeForDeviceCount(migratedConfig) {
        const deviceCount = migratedConfig.manual_devices.length;
        
        if (deviceCount > 10) {
            // Many devices - optimize for scale
            migratedConfig.performance_settings.enable_worker_threads = true;
            migratedConfig.health_monitoring.health_check_interval = 45000;
            this.logger.info('Optimized configuration for large device count');
        } else if (deviceCount <= 2) {
            // Few devices - optimize for responsiveness
            migratedConfig.health_monitoring.health_check_interval = 15000;
            migratedConfig.health_monitoring.min_ping_interval = 3000;
            this.logger.info('Optimized configuration for small device count');
        }
    }

    async saveConfiguration(migratedConfig) {
        this.logger.info(`Saving migrated configuration to ${this.options.outputPath}...`);
        
        try {
            const outputDir = path.dirname(this.options.outputPath);
            await fs.mkdir(outputDir, { recursive: true });
            
            await fs.writeFile(
                this.options.outputPath,
                JSON.stringify(migratedConfig, null, 2),
                'utf8'
            );
            
            this.logger.info('Migration configuration saved successfully');
            
        } catch (error) {
            this.logger.error('Failed to save migrated configuration', { error: error.message });
            throw error;
        }
    }

    async backupConfigFile(configPath) {
        try {
            const backupPath = `${configPath}.backup.${Date.now()}`;
            await fs.copyFile(configPath, backupPath);
            this.migrationResults.backupPaths.push(backupPath);
            this.logger.info(`Backed up ${configPath} to ${backupPath}`);
        } catch (error) {
            this.logger.warn(`Failed to backup ${configPath}`, { error: error.message });
        }
    }

    printMigrationSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('           AIRSONOS MIGRATION SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`✅ Migration Status: ${this.migrationResults.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`📊 Devices Migrated: ${this.migrationResults.migratedSettings.manual_devices?.length || 0}`);
        console.log(`⚠️  Warnings: ${this.migrationResults.warnings.length}`);
        console.log(`❌ Errors: ${this.migrationResults.errors.length}`);
        console.log(`💾 Backups Created: ${this.migrationResults.backupPaths.length}`);
        
        if (this.migrationResults.warnings.length > 0) {
            console.log('\n📋 WARNINGS:');
            this.migrationResults.warnings.forEach((warning, i) => {
                console.log(`   ${i + 1}. ${warning}`);
            });
        }
        
        if (this.migrationResults.errors.length > 0) {
            console.log('\n❗ ERRORS:');
            this.migrationResults.errors.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }
        
        if (this.migrationResults.backupPaths.length > 0) {
            console.log('\n💾 BACKUP FILES:');
            this.migrationResults.backupPaths.forEach((backup, i) => {
                console.log(`   ${i + 1}. ${backup}`);
            });
        }
        
        console.log('\n🔧 NEXT STEPS:');
        console.log('   1. Review the migrated configuration');
        console.log('   2. Test the AirSonos optimized service');
        console.log('   3. Update any automation or scripts');
        console.log('   4. Remove old configuration files if desired');
        
        console.log('\n' + '='.repeat(60) + '\n');
    }

    // Utility methods
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async loadJsonFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            this.logger.warn(`Failed to load JSON file ${filePath}`, { error: error.message });
            return null;
        }
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    applyDirectMappings(source, target, mappings) {
        for (const [sourceKey, targetPath] of Object.entries(mappings)) {
            if (source.hasOwnProperty(sourceKey)) {
                this.setNestedValue(target, targetPath, source[sourceKey]);
                this.logger.debug(`Mapped ${sourceKey} -> ${targetPath}:`, source[sourceKey]);
            }
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        dryRun: args.includes('--dry-run') || args.includes('-d'),
        backupConfigs: !args.includes('--no-backup'),
        outputPath: '/data/airsonos_optimized_config.json'
    };
    
    // Parse output path if provided
    const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        options.outputPath = args[outputIndex + 1];
    }
    
    console.log('🔄 AirSonos Configuration Migration Tool');
    console.log('=========================================\n');
    
    try {
        const migrator = new ConfigurationMigrator(options);
        const results = await migrator.migrateAllConfigurations();
        
        process.exit(results.success ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run CLI if this script is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ConfigurationMigrator;