const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const net = require('net');
const dgram = require('dgram');
const dns = require('dns').promises;
const { promisify } = require('util');
const winston = require('winston');

// Original dependencies for compatibility testing
const Sonos = require('sonos').Sonos;
const SonosDevice = require('sonos');

class AutoConfigurationSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            discoveryTimeout: options.discoveryTimeout || 30000,
            capabilityTestTimeout: options.capabilityTestTimeout || 10000,
            networkDiagnosticTimeout: options.networkDiagnosticTimeout || 5000,
            configPath: options.configPath || '/data/airsonos_config.json',
            legacyConfigPaths: options.legacyConfigPaths || [
                '/config/airsonos.json',
                '/data/options.json',
                './config.json',
                './package.json'
            ],
            verbose: options.verbose || false,
            ...options
        };
        
        // State tracking
        this.discoveredDevices = new Map();
        this.networkInfo = null;
        this.systemCapabilities = null;
        this.optimalConfig = null;
        this.setupWizardState = null;
        this.diagnosticResults = null;
        
        this.setupLogging();
        this.logger.info('Auto-configuration system initialized');
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

    async runFullAutoConfiguration() {
        this.logger.info('Starting full auto-configuration process...');
        
        try {
            // Step 1: System analysis
            this.emit('step', { step: 'system_analysis', progress: 10 });
            await this.analyzeSystemCapabilities();
            
            // Step 2: Network diagnostics
            this.emit('step', { step: 'network_diagnostics', progress: 20 });
            await this.runNetworkDiagnostics();
            
            // Step 3: Device discovery
            this.emit('step', { step: 'device_discovery', progress: 40 });
            await this.intelligentDeviceDiscovery();
            
            // Step 4: Capability testing
            this.emit('step', { step: 'capability_testing', progress: 60 });
            await this.testDeviceCapabilities();
            
            // Step 5: Configuration generation
            this.emit('step', { step: 'config_generation', progress: 80 });
            await this.generateOptimalConfiguration();
            
            // Step 6: Migration check
            this.emit('step', { step: 'migration_check', progress: 90 });
            await this.checkForLegacyConfiguration();
            
            // Step 7: Save configuration
            this.emit('step', { step: 'save_config', progress: 100 });
            await this.saveConfiguration();
            
            this.emit('completed', {
                config: this.optimalConfig,
                devices: Array.from(this.discoveredDevices.values()),
                diagnostics: this.diagnosticResults
            });
            
            this.logger.info('Auto-configuration completed successfully');
            return this.optimalConfig;
            
        } catch (error) {
            this.logger.error('Auto-configuration failed', { error: error.message });
            this.emit('error', error);
            throw error;
        }
    }

    async analyzeSystemCapabilities() {
        this.logger.info('Analyzing system capabilities...');
        
        const cpuCount = os.cpus().length;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const platform = os.platform();
        const arch = os.arch();
        const networkInterfaces = os.networkInterfaces();
        
        // Detect available network interfaces
        const availableInterfaces = Object.keys(networkInterfaces)
            .filter(name => !name.includes('lo') && !name.includes('docker'))
            .map(name => ({
                name,
                addresses: networkInterfaces[name]
                    .filter(addr => addr.family === 'IPv4' && !addr.internal)
                    .map(addr => addr.address)
            }))
            .filter(iface => iface.addresses.length > 0);
        
        // Check Node.js capabilities
        const nodeVersion = process.version;
        const supportsWorkerThreads = this.checkWorkerThreadSupport();
        const supportsAsyncHooks = this.checkAsyncHookSupport();
        
        this.systemCapabilities = {
            cpu: {
                count: cpuCount,
                model: os.cpus()[0]?.model || 'Unknown',
                recommendedWorkers: Math.min(cpuCount, 4)
            },
            memory: {
                total: totalMemory,
                free: freeMemory,
                usageRatio: (totalMemory - freeMemory) / totalMemory,
                recommendedBufferSize: this.calculateRecommendedBufferSize(totalMemory)
            },
            platform: {
                os: platform,
                arch: arch,
                nodeVersion: nodeVersion
            },
            network: {
                interfaces: availableInterfaces,
                primaryInterface: availableInterfaces[0] || null
            },
            features: {
                workerThreads: supportsWorkerThreads,
                asyncHooks: supportsAsyncHooks,
                experimental: nodeVersion.includes('v14') || nodeVersion.includes('v16')
            }
        };
        
        this.logger.info('System analysis complete', {
            cpuCount,
            memoryGB: Math.round(totalMemory / 1024 / 1024 / 1024),
            networkInterfaces: availableInterfaces.length,
            workerThreads: supportsWorkerThreads
        });
        
        this.emit('systemAnalysis', this.systemCapabilities);
    }

    checkWorkerThreadSupport() {
        try {
            require('worker_threads');
            return true;
        } catch (error) {
            return false;
        }
    }

    checkAsyncHookSupport() {
        try {
            require('async_hooks');
            return true;
        } catch (error) {
            return false;
        }
    }

    calculateRecommendedBufferSize(totalMemory) {
        const memoryGB = totalMemory / 1024 / 1024 / 1024;
        
        if (memoryGB < 0.5) {
            return { min: 100, max: 250 }; // Low memory
        } else if (memoryGB < 1) {
            return { min: 150, max: 350 }; // Medium memory
        } else if (memoryGB < 2) {
            return { min: 200, max: 500 }; // Good memory
        } else {
            return { min: 250, max: 750 }; // High memory
        }
    }

    async runNetworkDiagnostics() {
        this.logger.info('Running network diagnostics...');
        
        const diagnostics = {
            connectivity: {},
            performance: {},
            multicast: {},
            ports: {},
            dns: {}
        };
        
        try {
            // Test internet connectivity
            diagnostics.connectivity.internet = await this.testInternetConnectivity();
            
            // Test local network connectivity
            diagnostics.connectivity.localNetwork = await this.testLocalNetworkConnectivity();
            
            // Test multicast support (required for Sonos discovery)
            diagnostics.multicast.support = await this.testMulticastSupport();
            
            // Test port availability
            diagnostics.ports = await this.testPortAvailability([5000, 8099, 1400, 1401]);
            
            // Test DNS resolution
            diagnostics.dns = await this.testDNSResolution();
            
            // Network performance tests
            diagnostics.performance = await this.testNetworkPerformance();
            
        } catch (error) {
            this.logger.warn('Network diagnostic error', { error: error.message });
            diagnostics.error = error.message;
        }
        
        this.diagnosticResults = diagnostics;
        this.logger.info('Network diagnostics complete', diagnostics);
        this.emit('networkDiagnostics', diagnostics);
        
        return diagnostics;
    }

    async testInternetConnectivity() {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 3000);
            
            socket.connect(80, 'google.com', () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve(true);
            });
            
            socket.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    }

    async testLocalNetworkConnectivity() {
        try {
            const interfaces = os.networkInterfaces();
            const localIPs = Object.values(interfaces)
                .flat()
                .filter(addr => addr.family === 'IPv4' && !addr.internal)
                .map(addr => addr.address);
            
            return localIPs.length > 0;
        } catch (error) {
            return false;
        }
    }

    async testMulticastSupport() {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            
            socket.bind(() => {
                try {
                    socket.addMembership('239.255.255.250'); // SSDP multicast
                    socket.close();
                    resolve(true);
                } catch (error) {
                    socket.close();
                    resolve(false);
                }
            });
            
            socket.on('error', () => {
                resolve(false);
            });
            
            setTimeout(() => {
                socket.close();
                resolve(false);
            }, 2000);
        });
    }

    async testPortAvailability(ports) {
        const results = {};
        
        for (const port of ports) {
            results[port] = await this.isPortAvailable(port);
        }
        
        return results;
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
            
            server.on('error', () => resolve(false));
        });
    }

    async testDNSResolution() {
        try {
            await dns.lookup('google.com');
            await dns.lookup('apple.com');
            return { status: 'ok', latency: 'good' };
        } catch (error) {
            return { status: 'failed', error: error.message };
        }
    }

    async testNetworkPerformance() {
        const startTime = Date.now();
        
        try {
            await this.testInternetConnectivity();
            const latency = Date.now() - startTime;
            
            return {
                latency: latency,
                quality: latency < 100 ? 'excellent' : latency < 250 ? 'good' : 'poor'
            };
        } catch (error) {
            return {
                latency: -1,
                quality: 'unknown',
                error: error.message
            };
        }
    }

    async intelligentDeviceDiscovery() {
        this.logger.info('Starting intelligent device discovery...');
        
        const discoveredDevices = new Map();
        
        try {
            // Method 1: Standard Sonos discovery
            const standardDevices = await this.standardSonosDiscovery();
            standardDevices.forEach(device => {
                discoveredDevices.set(device.host, { ...device, discoveryMethod: 'standard' });
            });
            
            // Method 2: Network scanning (if standard discovery found few devices)
            if (discoveredDevices.size < 2) {
                this.logger.info('Standard discovery found few devices, trying network scan...');
                const scannedDevices = await this.networkScanDiscovery();
                scannedDevices.forEach(device => {
                    if (!discoveredDevices.has(device.host)) {
                        discoveredDevices.set(device.host, { ...device, discoveryMethod: 'scan' });
                    }
                });
            }
            
            // Method 3: SSDP discovery
            const ssdpDevices = await this.ssdpDiscovery();
            ssdpDevices.forEach(device => {
                if (!discoveredDevices.has(device.host)) {
                    discoveredDevices.set(device.host, { ...device, discoveryMethod: 'ssdp' });
                }
            });
            
            // Method 4: mDNS discovery
            const mdnsDevices = await this.mdnsDiscovery();
            mdnsDevices.forEach(device => {
                if (!discoveredDevices.has(device.host)) {
                    discoveredDevices.set(device.host, { ...device, discoveryMethod: 'mdns' });
                }
            });
            
        } catch (error) {
            this.logger.error('Device discovery error', { error: error.message });
        }
        
        this.discoveredDevices = discoveredDevices;
        
        this.logger.info(`Discovery complete: found ${discoveredDevices.size} devices`);
        this.emit('devicesDiscovered', Array.from(discoveredDevices.values()));
        
        return Array.from(discoveredDevices.values());
    }

    async standardSonosDiscovery() {
        return new Promise((resolve) => {
            const devices = [];
            const timeout = setTimeout(() => {
                resolve(devices);
            }, this.options.discoveryTimeout);
            
            try {
                SonosDevice.search((device, model) => {
                    devices.push({
                        host: device.host,
                        port: device.port || 1400,
                        model: model,
                        name: `Sonos-${device.host}`,
                        verified: true
                    });
                    
                    if (devices.length >= 20) {
                        clearTimeout(timeout);
                        resolve(devices);
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                this.logger.warn('Standard discovery failed', { error: error.message });
                resolve(devices);
            }
        });
    }

    async networkScanDiscovery() {
        this.logger.info('Starting network scan discovery...');
        
        const devices = [];
        const networkRanges = this.getNetworkRanges();
        
        for (const range of networkRanges) {
            const rangeDevices = await this.scanNetworkRange(range);
            devices.push(...rangeDevices);
        }
        
        return devices;
    }

    getNetworkRanges() {
        const interfaces = os.networkInterfaces();
        const ranges = [];
        
        Object.values(interfaces).flat().forEach(addr => {
            if (addr.family === 'IPv4' && !addr.internal) {
                const ip = addr.address;
                const netmask = addr.netmask;
                
                // Calculate network range (simplified for common cases)
                if (netmask === '255.255.255.0') {
                    const baseIP = ip.split('.').slice(0, 3).join('.');
                    ranges.push(`${baseIP}.1-254`);
                }
            }
        });
        
        return ranges.length > 0 ? ranges : ['192.168.1.1-254', '192.168.0.1-254'];
    }

    async scanNetworkRange(range) {
        const devices = [];
        const [start, end] = range.split('.').pop().split('-').map(Number);
        const baseIP = range.split('.').slice(0, 3).join('.');
        
        // Parallel scanning with limited concurrency
        const scanPromises = [];
        for (let i = start; i <= end; i += 10) {
            const batchPromises = [];
            for (let j = i; j < Math.min(i + 10, end + 1); j++) {
                const ip = `${baseIP}.${j}`;
                batchPromises.push(this.testSonosDevice(ip));
            }
            scanPromises.push(Promise.all(batchPromises));
        }
        
        const results = await Promise.all(scanPromises);
        results.flat().forEach(device => {
            if (device) devices.push(device);
        });
        
        return devices;
    }

    async testSonosDevice(ip) {
        try {
            const isOpen = await this.testTCPConnection(ip, 1400, 1000);
            if (!isOpen) return null;
            
            // Try to create a Sonos device and test basic functionality
            const device = new Sonos(ip, 1400);
            await device.getCurrentState();
            
            return {
                host: ip,
                port: 1400,
                name: `Sonos-${ip}`,
                verified: true
            };
        } catch (error) {
            return null;
        }
    }

    async testTCPConnection(host, port, timeout = 2000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, timeout);
            
            socket.connect(port, host, () => {
                clearTimeout(timer);
                socket.destroy();
                resolve(true);
            });
            
            socket.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }

    async ssdpDiscovery() {
        this.logger.info('Starting SSDP discovery...');
        
        return new Promise((resolve) => {
            const devices = [];
            const socket = dgram.createSocket('udp4');
            
            const ssdpMessage = Buffer.from([
                'M-SEARCH * HTTP/1.1',
                'HOST: 239.255.255.250:1900',
                'MAN: "ssdp:discover"',
                'ST: urn:schemas-upnp-org:device:ZonePlayer:1',
                'MX: 3',
                ''
            ].join('\r\n'));
            
            socket.on('message', (msg, rinfo) => {
                const response = msg.toString();
                if (response.includes('Sonos') || response.includes('ZonePlayer')) {
                    devices.push({
                        host: rinfo.address,
                        port: 1400,
                        name: `Sonos-${rinfo.address}`,
                        verified: false
                    });
                }
            });
            
            socket.bind(() => {
                socket.send(ssdpMessage, 1900, '239.255.255.250');
            });
            
            setTimeout(() => {
                socket.close();
                resolve(devices);
            }, 5000);
        });
    }

    async mdnsDiscovery() {
        this.logger.info('Starting mDNS discovery...');
        
        // Simplified mDNS discovery - in a real implementation,
        // you would use a proper mDNS library like 'mdns' or 'bonjour'
        try {
            const services = await dns.resolveTxt('_sonos._tcp.local');
            return services.map(service => ({
                host: service.address || 'unknown',
                port: service.port || 1400,
                name: service.name || 'Sonos Device',
                verified: false
            }));
        } catch (error) {
            this.logger.debug('mDNS discovery failed', { error: error.message });
            return [];
        }
    }

    async testDeviceCapabilities() {
        this.logger.info('Testing device capabilities...');
        
        const capabilityResults = new Map();
        
        for (const [host, deviceInfo] of this.discoveredDevices) {
            this.logger.debug(`Testing capabilities for ${host}...`);
            
            try {
                const capabilities = await this.testSingleDeviceCapabilities(deviceInfo);
                capabilityResults.set(host, capabilities);
                
                // Update device info with capabilities
                this.discoveredDevices.set(host, {
                    ...deviceInfo,
                    capabilities
                });
                
            } catch (error) {
                this.logger.warn(`Capability testing failed for ${host}`, { error: error.message });
                capabilityResults.set(host, { error: error.message });
            }
        }
        
        this.emit('capabilitiesTested', Object.fromEntries(capabilityResults));
        return capabilityResults;
    }

    async testSingleDeviceCapabilities(deviceInfo) {
        const device = new Sonos(deviceInfo.host, deviceInfo.port);
        const capabilities = {
            basic: {},
            audio: {},
            network: {},
            performance: {}
        };
        
        try {
            // Test basic connectivity and info
            const startTime = Date.now();
            const state = await device.getCurrentState();
            capabilities.basic.responseTime = Date.now() - startTime;
            capabilities.basic.currentState = state;
            capabilities.basic.connectivity = 'good';
            
            // Get device info
            try {
                const deviceDescription = await device.deviceDescription();
                capabilities.basic.model = deviceDescription.modelName;
                capabilities.basic.version = deviceDescription.softwareVersion;
                capabilities.basic.serialNumber = deviceDescription.serialNum;
            } catch (error) {
                this.logger.debug('Could not get device description', { error: error.message });
            }
            
            // Test audio format support
            capabilities.audio = await this.testAudioFormats(device);
            
            // Test network performance
            capabilities.network = await this.testNetworkCapabilities(device);
            
            // Test streaming performance
            capabilities.performance = await this.testStreamingPerformance(device);
            
        } catch (error) {
            capabilities.basic.connectivity = 'failed';
            capabilities.basic.error = error.message;
        }
        
        return capabilities;
    }

    async testAudioFormats(device) {
        const audioCapabilities = {
            pcm: false,
            alac: false,
            aac: false,
            mp3: false,
            formats: []
        };
        
        try {
            // Get supported formats from device (simplified)
            const zones = await device.getZoneAttrs();
            
            // Most modern Sonos devices support these formats
            audioCapabilities.pcm = true;
            audioCapabilities.mp3 = true;
            audioCapabilities.aac = true;
            
            // ALAC support depends on device model and firmware
            if (zones.CurrentZoneName) {
                audioCapabilities.alac = !zones.CurrentZoneName.includes('PLAY:1');
            }
            
            audioCapabilities.formats = ['pcm', 'mp3', 'aac'];
            if (audioCapabilities.alac) {
                audioCapabilities.formats.push('alac');
            }
            
        } catch (error) {
            this.logger.debug('Audio format testing failed', { error: error.message });
        }
        
        return audioCapabilities;
    }

    async testNetworkCapabilities(device) {
        const networkCapabilities = {
            bandwidth: 'unknown',
            latency: 0,
            stability: 'unknown'
        };
        
        try {
            // Test multiple quick requests to measure latency and stability
            const latencies = [];
            for (let i = 0; i < 3; i++) {
                const startTime = Date.now();
                await device.getCurrentState();
                latencies.push(Date.now() - startTime);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            networkCapabilities.latency = Math.round(latencies.reduce((a, b) => a + b) / latencies.length);
            
            const maxLatency = Math.max(...latencies);
            const minLatency = Math.min(...latencies);
            const variance = maxLatency - minLatency;
            
            if (variance < 50) {
                networkCapabilities.stability = 'excellent';
            } else if (variance < 100) {
                networkCapabilities.stability = 'good';
            } else {
                networkCapabilities.stability = 'poor';
            }
            
            if (networkCapabilities.latency < 50) {
                networkCapabilities.bandwidth = 'high';
            } else if (networkCapabilities.latency < 150) {
                networkCapabilities.bandwidth = 'medium';
            } else {
                networkCapabilities.bandwidth = 'low';
            }
            
        } catch (error) {
            this.logger.debug('Network capability testing failed', { error: error.message });
        }
        
        return networkCapabilities;
    }

    async testStreamingPerformance(device) {
        const performance = {
            concurrent: false,
            buffering: 'unknown',
            quality: 'unknown'
        };
        
        try {
            // Test if device can handle concurrent operations
            const promises = [
                device.getCurrentState(),
                device.getZoneAttrs(),
                device.getVolume()
            ];
            
            await Promise.all(promises);
            performance.concurrent = true;
            
            // Estimate buffering requirements based on response times
            const responseTime = await this.measureResponseTime(device);
            if (responseTime < 100) {
                performance.buffering = 'low';
                performance.quality = 'high';
            } else if (responseTime < 300) {
                performance.buffering = 'medium';
                performance.quality = 'medium';
            } else {
                performance.buffering = 'high';
                performance.quality = 'low';
            }
            
        } catch (error) {
            this.logger.debug('Streaming performance testing failed', { error: error.message });
        }
        
        return performance;
    }

    async measureResponseTime(device) {
        const startTime = Date.now();
        await device.getCurrentState();
        return Date.now() - startTime;
    }

    async generateOptimalConfiguration() {
        this.logger.info('Generating optimal configuration...');
        
        const config = {
            basic_settings: {},
            audio_settings: {},
            performance_settings: {},
            health_monitoring: {},
            manual_devices: [],
            integration_settings: {},
            advanced_settings: {}
        };
        
        // Basic settings based on system capabilities
        config.basic_settings = {
            timeout: this.calculateOptimalTimeout(),
            verbose: false,
            port: this.findAvailablePort([5000, 5001, 5002]),
            discovery_timeout: this.calculateDiscoveryTimeout(),
            max_devices: Math.min(this.discoveredDevices.size * 2, 50)
        };
        
        // Audio settings based on device capabilities
        config.audio_settings = {
            adaptive_buffering: true,
            ...this.systemCapabilities.memory.recommendedBufferSize,
            enable_alac: this.checkALACSupport(),
            smart_format_detection: true
        };
        
        // Performance settings based on system analysis
        config.performance_settings = {
            enable_worker_threads: this.systemCapabilities.features.workerThreads,
            max_workers: this.calculateOptimalWorkers(),
            config_mode: 'auto',
            network_buffer_size: this.calculateNetworkBufferSize(),
            backpressure_threshold: this.calculateBackpressureThreshold()
        };
        
        // Health monitoring based on network performance
        config.health_monitoring = {
            health_check_interval: this.calculateHealthCheckInterval(),
            adaptive_ping_interval: true,
            min_ping_interval: this.calculateMinPingInterval(),
            max_ping_interval: this.calculateMaxPingInterval()
        };
        
        // Manual devices from discovery
        config.manual_devices = Array.from(this.discoveredDevices.values())
            .filter(device => device.verified)
            .map(device => ({
                name: device.name,
                host: device.host,
                port: device.port,
                enabled: true
            }));
        
        // Integration settings
        config.integration_settings = {
            enable_dashboard: true,
            enable_notifications: true,
            notification_level: 'info',
            update_interval: 30,
            websocket_port: this.findAvailablePort([8099, 8098, 8097])
        };
        
        // Advanced settings based on system analysis
        config.advanced_settings = {
            debug_mode: false,
            performance_monitoring: true,
            custom_airplay_name: '',
            force_format: this.determineOptimalAudioFormat(),
            experimental_features: this.systemCapabilities.features.experimental
        };
        
        this.optimalConfig = config;
        
        this.logger.info('Optimal configuration generated', {
            devices: config.manual_devices.length,
            workerThreads: config.performance_settings.enable_worker_threads,
            bufferRange: `${config.audio_settings.min_buffer_size}-${config.audio_settings.max_buffer_size}ms`
        });
        
        this.emit('configurationGenerated', config);
        return config;
    }

    calculateOptimalTimeout() {
        if (this.diagnosticResults?.performance?.quality === 'excellent') return 3;
        if (this.diagnosticResults?.performance?.quality === 'good') return 5;
        return 8;
    }

    findAvailablePort(preferredPorts) {
        // In a real implementation, this would test port availability
        return preferredPorts[0];
    }

    calculateDiscoveryTimeout() {
        const deviceCount = this.discoveredDevices.size;
        if (deviceCount > 5) return 10;
        if (deviceCount > 2) return 15;
        return 20;
    }

    checkALACSupport() {
        const devices = Array.from(this.discoveredDevices.values());
        return devices.some(device => device.capabilities?.audio?.alac);
    }

    calculateOptimalWorkers() {
        if (!this.systemCapabilities.features.workerThreads) return 0;
        
        const recommended = this.systemCapabilities.cpu.recommendedWorkers;
        const memoryConstraint = this.systemCapabilities.memory.usageRatio > 0.8 ? 
            Math.max(1, Math.floor(recommended / 2)) : recommended;
        
        return Math.min(recommended, memoryConstraint);
    }

    calculateNetworkBufferSize() {
        const quality = this.diagnosticResults?.performance?.quality;
        if (quality === 'excellent') return 32;
        if (quality === 'good') return 64;
        return 128;
    }

    calculateBackpressureThreshold() {
        const quality = this.diagnosticResults?.performance?.quality;
        if (quality === 'excellent') return 0.9;
        if (quality === 'good') return 0.8;
        return 0.7;
    }

    calculateHealthCheckInterval() {
        const avgLatency = Array.from(this.discoveredDevices.values())
            .map(d => d.capabilities?.basic?.responseTime || 100)
            .reduce((a, b) => a + b, 0) / this.discoveredDevices.size;
        
        if (avgLatency < 50) return 45000;
        if (avgLatency < 150) return 30000;
        return 20000;
    }

    calculateMinPingInterval() {
        const networkQuality = this.diagnosticResults?.performance?.quality;
        if (networkQuality === 'excellent') return 10000;
        if (networkQuality === 'good') return 5000;
        return 3000;
    }

    calculateMaxPingInterval() {
        const networkQuality = this.diagnosticResults?.performance?.quality;
        if (networkQuality === 'excellent') return 120000;
        if (networkQuality === 'good') return 60000;
        return 30000;
    }

    determineOptimalAudioFormat() {
        const alacSupport = this.checkALACSupport();
        if (alacSupport) return 'alac';
        return 'auto';
    }

    async checkForLegacyConfiguration() {
        this.logger.info('Checking for legacy configuration...');
        
        for (const configPath of this.options.legacyConfigPaths) {
            try {
                const exists = await fs.access(configPath).then(() => true).catch(() => false);
                if (exists) {
                    this.logger.info(`Found legacy config at ${configPath}`);
                    const legacyConfig = await this.loadLegacyConfiguration(configPath);
                    if (legacyConfig) {
                        await this.migrateLegacyConfiguration(legacyConfig, configPath);
                        return true;
                    }
                }
            } catch (error) {
                this.logger.debug(`Error checking ${configPath}`, { error: error.message });
            }
        }
        
        return false;
    }

    async loadLegacyConfiguration(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            this.logger.warn(`Failed to load legacy config from ${configPath}`, { error: error.message });
            return null;
        }
    }

    async migrateLegacyConfiguration(legacyConfig, sourcePath) {
        this.logger.info(`Migrating legacy configuration from ${sourcePath}...`);
        
        // Merge legacy settings with optimal configuration
        if (legacyConfig.timeout) {
            this.optimalConfig.basic_settings.timeout = legacyConfig.timeout;
        }
        
        if (legacyConfig.verbose !== undefined) {
            this.optimalConfig.basic_settings.verbose = legacyConfig.verbose;
        }
        
        if (legacyConfig.port) {
            this.optimalConfig.basic_settings.port = legacyConfig.port;
        }
        
        // Migrate device configurations
        if (legacyConfig.devices && Array.isArray(legacyConfig.devices)) {
            legacyConfig.devices.forEach(device => {
                const existingDevice = this.optimalConfig.manual_devices.find(d => d.host === device.host);
                if (!existingDevice) {
                    this.optimalConfig.manual_devices.push({
                        name: device.name || `Legacy-${device.host}`,
                        host: device.host,
                        port: device.port || 1400,
                        enabled: true
                    });
                }
            });
        }
        
        // Create backup of original config
        const backupPath = `${sourcePath}.backup.${Date.now()}`;
        try {
            await fs.copyFile(sourcePath, backupPath);
            this.logger.info(`Legacy config backed up to ${backupPath}`);
        } catch (error) {
            this.logger.warn('Failed to backup legacy config', { error: error.message });
        }
        
        this.emit('legacyMigrated', { source: sourcePath, backup: backupPath });
    }

    async saveConfiguration() {
        this.logger.info(`Saving configuration to ${this.options.configPath}...`);
        
        try {
            const configDir = path.dirname(this.options.configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            const configData = {
                version: '0.3.0',
                generated: new Date().toISOString(),
                system: this.systemCapabilities,
                diagnostics: this.diagnosticResults,
                devices: Array.from(this.discoveredDevices.values()),
                config: this.optimalConfig
            };
            
            await fs.writeFile(
                this.options.configPath,
                JSON.stringify(configData, null, 2),
                'utf8'
            );
            
            this.logger.info('Configuration saved successfully');
            this.emit('configurationSaved', this.options.configPath);
            
        } catch (error) {
            this.logger.error('Failed to save configuration', { error: error.message });
            throw error;
        }
    }

    async runSetupWizard() {
        this.logger.info('Starting setup wizard...');
        
        this.setupWizardState = {
            currentStep: 'welcome',
            completed: false,
            userChoices: {}
        };
        
        const wizard = {
            steps: [
                {
                    id: 'welcome',
                    title: 'Welcome to AirSonos Optimized',
                    description: 'This wizard will help you set up AirSonos for optimal performance.',
                    type: 'info'
                },
                {
                    id: 'system_check',
                    title: 'System Check',
                    description: 'Analyzing your system capabilities...',
                    type: 'progress',
                    action: () => this.analyzeSystemCapabilities()
                },
                {
                    id: 'network_test',
                    title: 'Network Diagnostics',
                    description: 'Testing network connectivity and performance...',
                    type: 'progress',
                    action: () => this.runNetworkDiagnostics()
                },
                {
                    id: 'device_discovery',
                    title: 'Device Discovery',
                    description: 'Searching for Sonos devices on your network...',
                    type: 'progress',
                    action: () => this.intelligentDeviceDiscovery()
                },
                {
                    id: 'device_selection',
                    title: 'Device Selection',
                    description: 'Choose which devices to configure',
                    type: 'selection',
                    options: () => Array.from(this.discoveredDevices.values())
                },
                {
                    id: 'performance_mode',
                    title: 'Performance Mode',
                    description: 'Choose your performance preferences',
                    type: 'choice',
                    choices: [
                        { id: 'auto', name: 'Auto-optimize', description: 'Let the system choose optimal settings' },
                        { id: 'quality', name: 'High Quality', description: 'Prioritize audio quality over efficiency' },
                        { id: 'efficiency', name: 'High Efficiency', description: 'Prioritize low resource usage' },
                        { id: 'custom', name: 'Custom', description: 'I want to configure settings manually' }
                    ]
                },
                {
                    id: 'final_config',
                    title: 'Configuration Review',
                    description: 'Review your configuration before applying',
                    type: 'review'
                },
                {
                    id: 'complete',
                    title: 'Setup Complete',
                    description: 'AirSonos has been configured successfully!',
                    type: 'complete'
                }
            ]
        };
        
        this.emit('wizardStarted', wizard);
        return wizard;
    }

    async getTroubleshootingReport() {
        this.logger.info('Generating troubleshooting report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            system: this.systemCapabilities,
            network: this.diagnosticResults,
            devices: Array.from(this.discoveredDevices.values()),
            configuration: this.optimalConfig,
            recommendations: [],
            issues: []
        };
        
        // Analyze for common issues
        this.analyzeCommonIssues(report);
        
        // Generate recommendations
        this.generateRecommendations(report);
        
        this.emit('troubleshootingReport', report);
        return report;
    }

    analyzeCommonIssues(report) {
        // Network issues
        if (!this.diagnosticResults?.connectivity?.internet) {
            report.issues.push({
                severity: 'high',
                category: 'network',
                issue: 'No internet connectivity detected',
                solution: 'Check your internet connection and network settings'
            });
        }
        
        if (!this.diagnosticResults?.multicast?.support) {
            report.issues.push({
                severity: 'medium',
                category: 'network',
                issue: 'Multicast not supported',
                solution: 'Device discovery may be limited. Consider manual device configuration.'
            });
        }
        
        // System issues
        if (this.systemCapabilities?.memory?.usageRatio > 0.9) {
            report.issues.push({
                severity: 'medium',
                category: 'system',
                issue: 'High memory usage detected',
                solution: 'Consider reducing buffer sizes or disabling worker threads'
            });
        }
        
        // Device issues
        if (this.discoveredDevices.size === 0) {
            report.issues.push({
                severity: 'high',
                category: 'devices',
                issue: 'No Sonos devices found',
                solution: 'Ensure Sonos devices are powered on and connected to the same network'
            });
        }
    }

    generateRecommendations(report) {
        // Performance recommendations
        if (this.systemCapabilities?.cpu?.count >= 4) {
            report.recommendations.push({
                category: 'performance',
                recommendation: 'Enable worker threads for better audio processing performance',
                impact: 'high'
            });
        }
        
        // Network recommendations
        if (this.diagnosticResults?.performance?.quality === 'poor') {
            report.recommendations.push({
                category: 'network',
                recommendation: 'Increase buffer sizes to compensate for poor network performance',
                impact: 'medium'
            });
        }
        
        // Audio recommendations
        if (this.checkALACSupport()) {
            report.recommendations.push({
                category: 'audio',
                recommendation: 'Enable ALAC support for better audio quality',
                impact: 'low'
            });
        }
    }
}

module.exports = AutoConfigurationSystem;