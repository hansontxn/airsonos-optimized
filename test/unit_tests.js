const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const os = require('os');
const EventEmitter = require('events');

// Mock dependencies
jest.mock('pidusage', () => jest.fn());
jest.mock('winston', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
        colorize: jest.fn(),
        simple: jest.fn()
    },
    transports: {
        Console: jest.fn()
    }
}));
jest.mock('node-cache');
jest.mock('node-cron');

// Import modules to test
const OptimizedAirSonos = require('../src/optimized_airsonos');
const PerformanceMonitor = require('../src/performance_monitor');
const AutoConfigurationSystem = require('../src/auto_config');
const ConfigurationMigrator = require('../src/config_migration');

describe('OptimizedAirSonos Core Functions', () => {
    let airsonos;
    
    beforeEach(() => {
        airsonos = new OptimizedAirSonos({
            timeout: 5,
            verbose: false,
            enableWorkerThreads: false // Disable for testing
        });
    });

    afterEach(() => {
        if (airsonos) {
            airsonos.removeAllListeners();
        }
    });

    describe('Adaptive Buffer Management', () => {
        test('should initialize with default buffer sizes', () => {
            expect(airsonos.options.minBufferSize).toBe(200);
            expect(airsonos.options.maxBufferSize).toBe(500);
            expect(airsonos.options.adaptiveBuffering).toBe(true);
        });

        test('should adjust buffer size on underrun', () => {
            const initialSize = airsonos.bufferStats.currentSize;
            
            // Simulate buffer underrun
            airsonos.bufferStats.underruns = 4; // Above threshold
            airsonos.adjustBufferSize();
            
            expect(airsonos.bufferStats.currentSize).toBeGreaterThan(initialSize);
        });

        test('should adjust buffer size on overrun', () => {
            airsonos.bufferStats.currentSize = 400;
            airsonos.bufferStats.overruns = 11; // Above threshold
            airsonos.bufferStats.underruns = 0;
            
            const initialSize = airsonos.bufferStats.currentSize;
            airsonos.adjustBufferSize();
            
            expect(airsonos.bufferStats.currentSize).toBeLessThan(initialSize);
        });

        test('should respect buffer size limits', () => {
            airsonos.bufferStats.currentSize = airsonos.options.maxBufferSize;
            airsonos.bufferStats.underruns = 5;
            
            airsonos.adjustBufferSize();
            
            expect(airsonos.bufferStats.currentSize).toBeLessThanOrEqual(airsonos.options.maxBufferSize);
        });

        test('should apply cooldown period between adjustments', () => {
            const now = Date.now();
            airsonos.bufferStats.lastAdjustment = now - 1000; // 1 second ago
            airsonos.bufferStats.adjustmentCooldown = 5000; // 5 second cooldown
            
            const initialSize = airsonos.bufferStats.currentSize;
            airsonos.bufferStats.underruns = 5;
            airsonos.adjustBufferSize();
            
            // Should not adjust during cooldown
            expect(airsonos.bufferStats.currentSize).toBe(initialSize);
        });
    });

    describe('Audio Format Detection', () => {
        test('should detect PCM format by default', () => {
            const mockAudioStream = {
                sampleRate: 44100,
                channels: 2,
                bitDepth: 16
            };
            
            const format = airsonos.detectAudioFormat(mockAudioStream);
            
            expect(format.codec).toBe('pcm');
            expect(format.sampleRate).toBe(44100);
            expect(format.channels).toBe(2);
            expect(format.bitDepth).toBe(16);
        });

        test('should prefer ALAC for high-quality sources when enabled', () => {
            airsonos.options.enableALAC = true;
            airsonos.options.smartFormatDetection = true;
            
            const mockAudioStream = {
                sampleRate: 48000,
                channels: 2,
                bitDepth: 24
            };
            
            // Mock ALAC support check
            jest.spyOn(airsonos, 'checkALACSupport').mockReturnValue(true);
            
            const format = airsonos.detectAudioFormat(mockAudioStream);
            
            expect(format.supportALAC).toBe(true);
        });
    });

    describe('Performance Calculation', () => {
        test('should calculate optimal worker count based on CPU cores', () => {
            const mockCpuCount = 8;
            jest.spyOn(os, 'cpus').mockReturnValue(new Array(mockCpuCount));
            
            airsonos.systemCapabilities = {
                memory: { usageRatio: 0.5 },
                features: { workerThreads: true }
            };
            
            const workerCount = airsonos.calculateOptimalWorkers();
            
            expect(workerCount).toBeLessThanOrEqual(4); // Should cap at 4
            expect(workerCount).toBeGreaterThan(0);
        });

        test('should reduce workers on high memory usage', () => {
            const mockCpuCount = 8;
            jest.spyOn(os, 'cpus').mockReturnValue(new Array(mockCpuCount));
            
            airsonos.systemCapabilities = {
                memory: { usageRatio: 0.9 }, // High memory usage
                features: { workerThreads: true }
            };
            
            const workerCount = airsonos.calculateOptimalWorkers();
            
            expect(workerCount).toBeLessThanOrEqual(mockCpuCount / 2);
        });

        test('should return 0 workers when worker threads not supported', () => {
            airsonos.systemCapabilities = {
                features: { workerThreads: false }
            };
            
            const workerCount = airsonos.calculateOptimalWorkers();
            
            expect(workerCount).toBe(0);
        });
    });

    describe('Network Optimization', () => {
        test('should calculate network buffer size based on quality', () => {
            airsonos.diagnosticResults = {
                performance: { quality: 'excellent' }
            };
            
            const bufferSize = airsonos.calculateNetworkBufferSize();
            expect(bufferSize).toBe(32);
        });

        test('should increase buffer size for poor network quality', () => {
            airsonos.diagnosticResults = {
                performance: { quality: 'poor' }
            };
            
            const bufferSize = airsonos.calculateNetworkBufferSize();
            expect(bufferSize).toBe(128);
        });

        test('should adjust backpressure threshold based on network quality', () => {
            airsonos.diagnosticResults = {
                performance: { quality: 'excellent' }
            };
            
            const threshold = airsonos.calculateBackpressureThreshold();
            expect(threshold).toBe(0.9);
        });
    });

    describe('Device Management', () => {
        test('should normalize device configuration from string format', () => {
            const deviceString = "192.168.1.100:1400";
            const normalized = airsonos.normalizeDeviceConfig(deviceString);
            
            expect(normalized).toEqual({
                name: "Legacy-192.168.1.100",
                host: "192.168.1.100",
                port: 1400,
                enabled: true
            });
        });

        test('should normalize device configuration from object format', () => {
            const deviceObject = {
                host: "192.168.1.100",
                port: 1400,
                name: "Living Room",
                enabled: true
            };
            
            const normalized = airsonos.normalizeDeviceConfig(deviceObject);
            
            expect(normalized).toEqual(deviceObject);
        });

        test('should handle invalid device configuration', () => {
            const invalidDevice = { invalid: "config" };
            const normalized = airsonos.normalizeDeviceConfig(invalidDevice);
            
            expect(normalized).toBeNull();
        });
    });

    describe('Configuration Validation', () => {
        test('should validate timeout values', () => {
            const config = { basic_settings: { timeout: 65 } }; // Invalid: > 60
            airsonos.validateAndOptimizeConfig(config);
            
            expect(config.basic_settings.timeout).toBe(5); // Should reset to default
        });

        test('should validate buffer size ranges', () => {
            const config = {
                audio_settings: {
                    min_buffer_size: 600,
                    max_buffer_size: 300 // Invalid: min > max
                }
            };
            
            airsonos.validateBufferSizes(config.audio_settings);
            
            expect(config.audio_settings.min_buffer_size).toBeLessThanOrEqual(
                config.audio_settings.max_buffer_size
            );
        });

        test('should validate port numbers', () => {
            const settings = { port: 80 }; // Invalid: < 1024
            airsonos.validatePort(settings, 'port');
            
            expect(settings.port).toBe(5000); // Should reset to default
        });
    });
});

describe('Performance Monitor Functions', () => {
    let performanceMonitor;
    let mockAirSonos;
    let mockHAIntegration;

    beforeEach(() => {
        mockAirSonos = new EventEmitter();
        mockAirSonos.options = {
            minBufferSize: 200,
            maxBufferSize: 500,
            timeout: 5
        };
        mockAirSonos.bufferStats = {
            currentSize: 200,
            underruns: 0,
            overruns: 0
        };
        mockAirSonos.devices = new Map();
        
        mockHAIntegration = {
            updateSensorValue: jest.fn(),
            sendNotification: jest.fn(),
            emit: jest.fn()
        };
        
        performanceMonitor = new PerformanceMonitor(mockAirSonos, mockHAIntegration, {
            cpuMonitorInterval: 100, // Fast for testing
            autoTuningEnabled: true
        });
    });

    afterEach(() => {
        if (performanceMonitor) {
            performanceMonitor.shutdown();
        }
    });

    describe('CPU Monitoring', () => {
        test('should update CPU metrics', async () => {
            const mockUsage = { cpu: 50, memory: 100 * 1024 * 1024 };
            require('pidusage').mockResolvedValue(mockUsage);
            
            await performanceMonitor.processCPUMetrics(mockUsage);
            
            expect(performanceMonitor.metrics.cpu.current).toBe(50);
            expect(performanceMonitor.metrics.memory.current).toBeGreaterThan(0);
        });

        test('should trigger alert on high CPU usage', async () => {
            const mockUsage = { cpu: 85, memory: 100 * 1024 * 1024 };
            require('pidusage').mockResolvedValue(mockUsage);
            
            await performanceMonitor.processCPUMetrics(mockUsage);
            
            expect(mockHAIntegration.sendNotification).toHaveBeenCalledWith(
                'warning',
                expect.stringContaining('High CPU usage'),
                expect.any(Object)
            );
        });

        test('should trigger auto-tuning on high CPU', async () => {
            const mockUsage = { cpu: 85, memory: 100 * 1024 * 1024 };
            require('pidusage').mockResolvedValue(mockUsage);
            
            const triggerSpy = jest.spyOn(performanceMonitor, 'triggerAutoTuning');
            
            await performanceMonitor.processCPUMetrics(mockUsage);
            
            expect(triggerSpy).toHaveBeenCalledWith('high_cpu', { cpu: 85 });
        });
    });

    describe('Audio Monitoring', () => {
        test('should handle audio dropout events', () => {
            const dropoutData = {
                device: 'test-device',
                duration: 100,
                cause: 'network_latency'
            };
            
            performanceMonitor.handleAudioDropout(dropoutData);
            
            expect(performanceMonitor.metrics.audio.dropouts).toBe(1);
            expect(performanceMonitor.metrics.audio.qualityScore).toBeLessThan(100);
        });

        test('should trigger buffer adjustment on dropout', () => {
            const triggerSpy = jest.spyOn(performanceMonitor, 'triggerBufferAdjustment');
            
            const dropoutData = {
                device: 'test-device',
                duration: 100,
                cause: 'network_latency'
            };
            
            performanceMonitor.handleAudioDropout(dropoutData);
            
            expect(triggerSpy).toHaveBeenCalledWith('dropout', dropoutData);
        });

        test('should handle buffer underruns', () => {
            const underrunData = { device: 'test-device' };
            
            performanceMonitor.handleBufferUnderrun(underrunData);
            
            expect(performanceMonitor.metrics.audio.bufferUnderruns).toBe(1);
        });

        test('should update audio quality score correctly', () => {
            const initialScore = performanceMonitor.metrics.audio.qualityScore;
            
            performanceMonitor.updateAudioQualityScore(-10);
            
            expect(performanceMonitor.metrics.audio.qualityScore).toBe(initialScore - 10);
            expect(mockHAIntegration.updateSensorValue).toHaveBeenCalledWith(
                'audio_quality',
                initialScore - 10
            );
        });
    });

    describe('Auto-tuning Logic', () => {
        test('should calculate optimizations for high CPU', async () => {
            const optimizations = await performanceMonitor.calculateOptimizations('high_cpu', { cpu: 85 });
            
            expect(optimizations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: expect.stringMatching(/reduce_workers|reduce_buffer_complexity/)
                    })
                ])
            );
        });

        test('should apply buffer increase optimization', async () => {
            const optimization = {
                type: 'increase_buffer',
                currentMin: 200,
                currentMax: 500,
                newMin: 250,
                newMax: 600
            };
            
            await performanceMonitor.applyOptimization(optimization);
            
            expect(mockAirSonos.options.minBufferSize).toBe(250);
            expect(mockAirSonos.options.maxBufferSize).toBe(600);
        });

        test('should respect cooldown period for auto-tuning', () => {
            performanceMonitor.tuningState.lastAdjustment = Date.now() - 1000; // 1 second ago
            
            const shouldTrigger = performanceMonitor.shouldTriggerAutoTuning('high_cpu', { cpu: 85 });
            
            expect(shouldTrigger).toBe(false); // Should be in cooldown
        });
    });

    describe('Performance Scoring', () => {
        test('should calculate overall performance score', () => {
            performanceMonitor.metrics.cpu.current = 20;
            performanceMonitor.metrics.memory.current = 30;
            performanceMonitor.metrics.audio.qualityScore = 95;
            performanceMonitor.metrics.network.quality = 'excellent';
            
            // Mock device metrics
            performanceMonitor.metrics.devices.set('test-device', { reliability: 90 });
            
            const score = performanceMonitor.calculateOverallPerformanceScore();
            
            expect(score).toBeGreaterThan(80);
            expect(score).toBeLessThanOrEqual(100);
        });

        test('should identify performance issues', () => {
            performanceMonitor.metrics.cpu.current = 85;
            performanceMonitor.metrics.memory.current = 90;
            performanceMonitor.metrics.audio.dropouts = 6;
            
            const issues = performanceMonitor.identifyPerformanceIssues();
            
            expect(issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'high_cpu', severity: 'high' }),
                    expect.objectContaining({ type: 'high_memory', severity: 'high' }),
                    expect.objectContaining({ type: 'audio_dropouts', severity: 'medium' })
                ])
            );
        });
    });

    describe('Device Reliability', () => {
        test('should update device metrics', () => {
            performanceMonitor.updateDeviceMetrics('192.168.1.100', 'latency', 50);
            
            const deviceMetrics = performanceMonitor.metrics.devices.get('192.168.1.100');
            expect(deviceMetrics.latency).toBe(50);
            expect(deviceMetrics.lastSeen).toBeCloseTo(Date.now(), -2);
        });

        test('should decrease reliability on errors', () => {
            performanceMonitor.updateDeviceMetrics('192.168.1.100', 'connected', null);
            const initialReliability = performanceMonitor.metrics.devices.get('192.168.1.100').reliability;
            
            performanceMonitor.updateDeviceMetrics('192.168.1.100', 'error', 'Connection failed');
            
            const newReliability = performanceMonitor.metrics.devices.get('192.168.1.100').reliability;
            expect(newReliability).toBeLessThan(initialReliability);
        });

        test('should trigger unreliable device handling', () => {
            const handleSpy = jest.spyOn(performanceMonitor, 'handleUnreliableDevice');
            
            // Set low reliability
            performanceMonitor.metrics.devices.set('192.168.1.100', {
                reliability: 40,
                errors: 5,
                lastSeen: Date.now()
            });
            
            performanceMonitor.updateDeviceReliability('192.168.1.100', 'error', 'Test error');
            
            expect(handleSpy).toHaveBeenCalled();
        });
    });
});

describe('Auto-Configuration System Functions', () => {
    let autoConfig;

    beforeEach(() => {
        autoConfig = new AutoConfigurationSystem({
            discoveryTimeout: 1000, // Fast for testing
            verbose: false
        });
    });

    describe('System Analysis', () => {
        test('should analyze system capabilities', async () => {
            jest.spyOn(os, 'cpus').mockReturnValue(new Array(4));
            jest.spyOn(os, 'totalmem').mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
            jest.spyOn(os, 'freemem').mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB free
            
            await autoConfig.analyzeSystemCapabilities();
            
            expect(autoConfig.systemCapabilities.cpu.count).toBe(4);
            expect(autoConfig.systemCapabilities.memory.total).toBe(8 * 1024 * 1024 * 1024);
            expect(autoConfig.systemCapabilities.features.workerThreads).toBeDefined();
        });

        test('should calculate recommended buffer sizes based on memory', () => {
            const bufferSize = autoConfig.calculateRecommendedBufferSize(512 * 1024 * 1024); // 512MB
            
            expect(bufferSize.min).toBeGreaterThanOrEqual(100);
            expect(bufferSize.max).toBeGreaterThan(bufferSize.min);
        });

        test('should detect worker thread support', () => {
            const supported = autoConfig.checkWorkerThreadSupport();
            expect(typeof supported).toBe('boolean');
        });
    });

    describe('Device Discovery', () => {
        test('should handle empty device discovery', async () => {
            // Mock empty discovery results
            jest.spyOn(autoConfig, 'standardSonosDiscovery').mockResolvedValue([]);
            jest.spyOn(autoConfig, 'networkScanDiscovery').mockResolvedValue([]);
            jest.spyOn(autoConfig, 'ssdpDiscovery').mockResolvedValue([]);
            jest.spyOn(autoConfig, 'mdnsDiscovery').mockResolvedValue([]);
            
            const devices = await autoConfig.intelligentDeviceDiscovery();
            
            expect(Array.isArray(devices)).toBe(true);
            expect(devices.length).toBe(0);
        });

        test('should merge devices from multiple discovery methods', async () => {
            const standardDevices = [{ host: '192.168.1.100', port: 1400 }];
            const ssdpDevices = [{ host: '192.168.1.101', port: 1400 }];
            
            jest.spyOn(autoConfig, 'standardSonosDiscovery').mockResolvedValue(standardDevices);
            jest.spyOn(autoConfig, 'networkScanDiscovery').mockResolvedValue([]);
            jest.spyOn(autoConfig, 'ssdpDiscovery').mockResolvedValue(ssdpDevices);
            jest.spyOn(autoConfig, 'mdnsDiscovery').mockResolvedValue([]);
            
            const devices = await autoConfig.intelligentDeviceDiscovery();
            
            expect(devices.length).toBe(2);
            expect(devices[0].discoveryMethod).toBe('standard');
            expect(devices[1].discoveryMethod).toBe('ssdp');
        });

        test('should normalize device configuration correctly', () => {
            const deviceString = "192.168.1.100:1400";
            const normalized = autoConfig.normalizeDeviceConfig(deviceString);
            
            expect(normalized).toEqual({
                name: "Legacy-192.168.1.100",
                host: "192.168.1.100",
                port: 1400,
                enabled: true
            });
        });
    });

    describe('Network Diagnostics', () => {
        test('should run network diagnostics', async () => {
            jest.spyOn(autoConfig, 'testInternetConnectivity').mockResolvedValue(true);
            jest.spyOn(autoConfig, 'testLocalNetworkConnectivity').mockResolvedValue(true);
            jest.spyOn(autoConfig, 'testMulticastSupport').mockResolvedValue(true);
            jest.spyOn(autoConfig, 'testPortAvailability').mockResolvedValue({ 5000: true, 8099: true });
            jest.spyOn(autoConfig, 'testDNSResolution').mockResolvedValue({ status: 'ok' });
            jest.spyOn(autoConfig, 'testNetworkPerformance').mockResolvedValue({ latency: 50, quality: 'good' });
            
            const diagnostics = await autoConfig.runNetworkDiagnostics();
            
            expect(diagnostics.connectivity.internet).toBe(true);
            expect(diagnostics.multicast.support).toBe(true);
            expect(diagnostics.ports[5000]).toBe(true);
            expect(diagnostics.dns.status).toBe('ok');
        });

        test('should handle network diagnostic failures gracefully', async () => {
            jest.spyOn(autoConfig, 'testInternetConnectivity').mockRejectedValue(new Error('Network error'));
            
            const diagnostics = await autoConfig.runNetworkDiagnostics();
            
            expect(diagnostics.error).toBeDefined();
        });
    });

    describe('Configuration Generation', () => {
        test('should generate optimal configuration', async () => {
            // Set up mock system capabilities
            autoConfig.systemCapabilities = {
                cpu: { recommendedWorkers: 2 },
                memory: { recommendedBufferSize: { min: 200, max: 500 } },
                features: { workerThreads: true }
            };
            autoConfig.discoveredDevices = new Map([
                ['192.168.1.100', { host: '192.168.1.100', verified: true, name: 'Test Device' }]
            ]);
            autoConfig.diagnosticResults = { performance: { quality: 'good' } };
            
            await autoConfig.generateOptimalConfiguration();
            
            expect(autoConfig.optimalConfig).toBeDefined();
            expect(autoConfig.optimalConfig.basic_settings.timeout).toBeGreaterThan(0);
            expect(autoConfig.optimalConfig.performance_settings.enable_worker_threads).toBe(true);
            expect(autoConfig.optimalConfig.manual_devices.length).toBe(1);
        });

        test('should optimize for device count', () => {
            const config = {
                manual_devices: new Array(15).fill().map((_, i) => ({ host: `192.168.1.${100 + i}` })),
                performance_settings: {},
                health_monitoring: {}
            };
            
            autoConfig.optimizeForDeviceCount(config);
            
            expect(config.performance_settings.enable_worker_threads).toBe(true);
            expect(config.health_monitoring.health_check_interval).toBeGreaterThan(30000);
        });
    });
});

describe('Configuration Migration Functions', () => {
    let migrator;

    beforeEach(() => {
        migrator = new ConfigurationMigrator({
            dryRun: true,
            verbose: false
        });
    });

    describe('Legacy Configuration Migration', () => {
        test('should apply legacy migration mappings', () => {
            const legacyConfig = {
                timeout: 10,
                verbose: true,
                port: 6000,
                devices: ['192.168.1.100:1400', '192.168.1.101:1400']
            };
            
            const migratedConfig = migrator.createDefaultOptimizedConfig();
            const settingsMap = migrator.migrationMap.legacy.settingsMap;
            
            migrator.applyLegacyMigration(legacyConfig, migratedConfig, settingsMap);
            
            expect(migratedConfig.basic_settings.timeout).toBe(10);
            expect(migratedConfig.basic_settings.verbose).toBe(true);
            expect(migratedConfig.basic_settings.port).toBe(6000);
            expect(migratedConfig.manual_devices.length).toBe(2);
        });

        test('should normalize device configurations during migration', () => {
            const deviceString = "192.168.1.100:1400";
            const normalized = migrator.normalizeDeviceConfig(deviceString);
            
            expect(normalized.host).toBe("192.168.1.100");
            expect(normalized.port).toBe(1400);
            expect(normalized.enabled).toBe(true);
        });

        test('should handle deprecated settings with warnings', () => {
            const legacyConfig = {
                controlTimeout: 5000,
                serverName: "OldAirSonos",
                zones: ["zone1", "zone2"]
            };
            
            const initialWarningCount = migrator.migrationResults.warnings.length;
            migrator.handleDeprecatedSettings(legacyConfig);
            
            expect(migrator.migrationResults.warnings.length).toBeGreaterThan(initialWarningCount);
        });
    });

    describe('Environment Variable Migration', () => {
        test('should parse environment values correctly', () => {
            expect(migrator.parseEnvironmentValue('true')).toBe(true);
            expect(migrator.parseEnvironmentValue('false')).toBe(false);
            expect(migrator.parseEnvironmentValue('123')).toBe(123);
            expect(migrator.parseEnvironmentValue('12.34')).toBe(12.34);
            expect(migrator.parseEnvironmentValue('string')).toBe('string');
        });

        test('should parse Docker device strings', () => {
            const deviceString = "192.168.1.100:1400,192.168.1.101:1400";
            const devices = migrator.parseDockerDevices(deviceString);
            
            expect(devices.length).toBe(2);
            expect(devices[0].host).toBe("192.168.1.100");
            expect(devices[1].host).toBe("192.168.1.101");
        });
    });

    describe('Configuration Validation', () => {
        test('should validate port numbers', () => {
            const settings = { port: 80 }; // Invalid: < 1024
            migrator.validatePort(settings, 'port');
            
            expect(settings.port).toBe(5000); // Should reset to default
        });

        test('should validate buffer sizes', () => {
            const audioSettings = {
                min_buffer_size: 600,
                max_buffer_size: 300 // Invalid: min > max
            };
            
            migrator.validateBufferSizes(audioSettings);
            
            expect(audioSettings.min_buffer_size).toBeLessThanOrEqual(audioSettings.max_buffer_size);
        });

        test('should deduplicate devices', () => {
            const config = {
                manual_devices: [
                    { host: '192.168.1.100', port: 1400 },
                    { host: '192.168.1.100', port: 1400 }, // Duplicate
                    { host: '192.168.1.101', port: 1400 }
                ]
            };
            
            migrator.deduplicateDevices(config);
            
            expect(config.manual_devices.length).toBe(2);
        });
    });

    describe('Utility Functions', () => {
        test('should set nested values correctly', () => {
            const obj = {};
            migrator.setNestedValue(obj, 'level1.level2.key', 'value');
            
            expect(obj.level1.level2.key).toBe('value');
        });

        test('should apply direct mappings', () => {
            const source = { oldKey: 'value', anotherKey: 'value2' };
            const target = {};
            const mappings = { 
                oldKey: 'newPath.key',
                anotherKey: 'simple'
            };
            
            migrator.applyDirectMappings(source, target, mappings);
            
            expect(target.newPath.key).toBe('value');
            expect(target.simple).toBe('value2');
        });
    });
});

// Mock helper functions for testing
function createMockAudioStream() {
    return {
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
        on: jest.fn(),
        pipe: jest.fn(),
        read: jest.fn(),
        write: jest.fn()
    };
}

function createMockSonosDevice() {
    return {
        host: '192.168.1.100',
        port: 1400,
        getCurrentState: jest.fn().mockResolvedValue('PLAYING'),
        getZoneAttrs: jest.fn().mockResolvedValue({ CurrentZoneName: 'Test Room' }),
        getVolume: jest.fn().mockResolvedValue(50),
        play: jest.fn().mockResolvedValue(true)
    };
}

function createMockWorker() {
    return {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
    };
}

// Export test utilities for use in other test files
module.exports = {
    createMockAudioStream,
    createMockSonosDevice,
    createMockWorker
};