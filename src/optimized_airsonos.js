const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const EventEmitter = require('events');
const NodeCache = require('node-cache');
const winston = require('winston');
const cron = require('node-cron');
const pidusage = require('pidusage');

// Original dependencies
const NodeTunes = require('nodetunes');
const Nicercast = require('nicercast');
const Sonos = require('sonos').Sonos;
const SonosDevice = require('sonos');

class OptimizedAirSonos extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Basic configuration
            timeout: options.timeout || 5,
            verbose: options.verbose || false,
            port: options.port || 5000,
            
            // Adaptive buffering (200-500ms)
            minBufferSize: options.minBufferSize || 200,
            maxBufferSize: options.maxBufferSize || 500,
            adaptiveBuffering: options.adaptiveBuffering !== false,
            
            // Worker thread configuration
            enableWorkerThreads: options.enableWorkerThreads !== false,
            maxWorkers: options.maxWorkers || Math.min(os.cpus().length, 4),
            
            // Network optimization
            networkBufferSize: options.networkBufferSize || 64 * 1024,
            backpressureThreshold: options.backpressureThreshold || 0.8,
            
            // Device configuration
            manualDevices: options.manualDevices || [],
            discoveryTimeout: options.discoveryTimeout || 10,
            maxDevices: options.maxDevices || 50,
            
            // Health monitoring
            healthCheckInterval: options.healthCheckInterval || 30000,
            adaptivePingInterval: options.adaptivePingInterval !== false,
            maxPingInterval: options.maxPingInterval || 60000,
            minPingInterval: options.minPingInterval || 5000,
            
            // Advanced options
            configMode: options.configMode || 'auto', // 'easy', 'advanced', 'auto'
            enableALAC: options.enableALAC !== false,
            smartFormatDetection: options.smartFormatDetection !== false,
            
            ...options
        };

        // Initialize components
        this.setupLogging();
        this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
        this.workers = new Map();
        this.devices = new Map();
        this.tunnels = new Map();
        this.audioProcessors = new Map();
        this.healthMetrics = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            startTime: Date.now(),
            packetsProcessed: 0,
            bufferUnderruns: 0,
            networkErrors: 0,
            deviceFailures: 0,
            avgLatency: 0,
            cpuUsage: 0,
            memoryUsage: 0
        };
        
        // Adaptive buffering state
        this.bufferStats = {
            currentSize: this.options.minBufferSize,
            underruns: 0,
            overruns: 0,
            lastAdjustment: Date.now(),
            adjustmentCooldown: 5000
        };
        
        this.setupAutoOptimization();
        this.startHealthMonitoring();
        this.startPerformanceMonitoring();
        
        this.logger.info('OptimizedAirSonos initialized', {
            cpuCores: os.cpus().length,
            maxWorkers: this.options.maxWorkers,
            bufferRange: `${this.options.minBufferSize}-${this.options.maxBufferSize}ms`,
            configMode: this.options.configMode
        });
    }

    setupLogging() {
        const logLevel = this.options.verbose ? 'debug' : 'info';
        
        this.logger = winston.createLogger({
            level: logLevel,
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

    setupAutoOptimization() {
        if (this.options.configMode === 'auto') {
            this.detectOptimalSettings();
        }
    }

    detectOptimalSettings() {
        const cpuCount = os.cpus().length;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUsageRatio = (totalMemory - freeMemory) / totalMemory;
        
        // Adjust worker count based on CPU and memory
        if (memoryUsageRatio > 0.8) {
            this.options.maxWorkers = Math.max(1, Math.floor(cpuCount / 2));
        } else if (memoryUsageRatio < 0.5) {
            this.options.maxWorkers = Math.min(cpuCount, 6);
        }
        
        // Adjust buffer sizes based on available memory
        if (totalMemory < 512 * 1024 * 1024) { // < 512MB
            this.options.minBufferSize = 150;
            this.options.maxBufferSize = 300;
        } else if (totalMemory > 2 * 1024 * 1024 * 1024) { // > 2GB
            this.options.minBufferSize = 250;
            this.options.maxBufferSize = 750;
        }
        
        this.logger.info('Auto-optimization complete', {
            cpuCount,
            totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
            memoryUsageRatio: Math.round(memoryUsageRatio * 100),
            adjustedWorkers: this.options.maxWorkers,
            bufferRange: `${this.options.minBufferSize}-${this.options.maxBufferSize}ms`
        });
    }

    async start() {
        try {
            this.logger.info('Starting OptimizedAirSonos service...');
            
            // Initialize worker pool if enabled
            if (this.options.enableWorkerThreads) {
                await this.initializeWorkerPool();
            }
            
            // Start device discovery
            const devices = await this.discoverDevices();
            
            // Setup tunnels for each device
            const tunnels = await this.setupTunnels(devices);
            
            this.emit('started', { devices, tunnels });
            
            this.logger.info(`Service started successfully with ${tunnels.length} tunnels`);
            return tunnels;
            
        } catch (error) {
            this.logger.error('Failed to start service', { error: error.message, stack: error.stack });
            this.emit('error', error);
            throw error;
        }
    }

    async initializeWorkerPool() {
        this.logger.info(`Initializing worker pool with ${this.options.maxWorkers} workers`);
        
        for (let i = 0; i < this.options.maxWorkers; i++) {
            try {
                const worker = new Worker(__filename, {
                    workerData: {
                        workerId: i,
                        options: this.options
                    }
                });
                
                worker.on('message', (message) => this.handleWorkerMessage(i, message));
                worker.on('error', (error) => this.handleWorkerError(i, error));
                worker.on('exit', (code) => this.handleWorkerExit(i, code));
                
                this.workers.set(i, {
                    worker,
                    busy: false,
                    tasksCompleted: 0,
                    lastUsed: Date.now()
                });
                
            } catch (error) {
                this.logger.error(`Failed to create worker ${i}`, { error: error.message });
            }
        }
    }

    async discoverDevices() {
        this.logger.info('Starting device discovery...');
        const discoveredDevices = [];
        
        try {
            // Manual devices first
            if (this.options.manualDevices.length > 0) {
                this.logger.info(`Configuring ${this.options.manualDevices.length} manual devices`);
                
                for (const deviceConfig of this.options.manualDevices) {
                    try {
                        const device = await this.connectToDevice(deviceConfig);
                        discoveredDevices.push(device);
                    } catch (error) {
                        this.logger.warn(`Failed to connect to manual device ${deviceConfig.host}:${deviceConfig.port}`, {
                            error: error.message
                        });
                    }
                }
            }
            
            // Smart discovery fallback
            if (discoveredDevices.length === 0) {
                this.logger.info('No manual devices available, starting smart discovery...');
                const autoDiscovered = await this.smartDeviceDiscovery();
                discoveredDevices.push(...autoDiscovered);
            }
            
            this.logger.info(`Discovery complete: found ${discoveredDevices.length} devices`);
            return discoveredDevices.slice(0, this.options.maxDevices);
            
        } catch (error) {
            this.logger.error('Device discovery failed', { error: error.message });
            throw error;
        }
    }

    async smartDeviceDiscovery() {
        return new Promise((resolve, reject) => {
            const devices = [];
            const timeout = setTimeout(() => {
                this.logger.info(`Discovery timeout reached, found ${devices.length} devices`);
                resolve(devices);
            }, this.options.discoveryTimeout * 1000);
            
            try {
                SonosDevice.search((device, model) => {
                    if (devices.length >= this.options.maxDevices) {
                        clearTimeout(timeout);
                        resolve(devices);
                        return;
                    }
                    
                    this.logger.debug('Found Sonos device', {
                        host: device.host,
                        port: device.port,
                        model: model
                    });
                    
                    devices.push({
                        device: new Sonos(device.host, device.port),
                        host: device.host,
                        port: device.port,
                        model: model,
                        discovered: true
                    });
                });
                
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    async connectToDevice(config) {
        const device = new Sonos(config.host, config.port);
        
        // Test connection
        await device.getCurrentState();
        
        return {
            device: device,
            host: config.host,
            port: config.port,
            name: config.name || `Sonos-${config.host}`,
            discovered: false
        };
    }

    async setupTunnels(devices) {
        const tunnels = [];
        
        for (const deviceInfo of devices) {
            try {
                const tunnel = await this.createOptimizedTunnel(deviceInfo);
                tunnels.push(tunnel);
                this.tunnels.set(deviceInfo.host, tunnel);
                
            } catch (error) {
                this.logger.error(`Failed to create tunnel for ${deviceInfo.host}`, {
                    error: error.message
                });
                this.performanceMetrics.deviceFailures++;
            }
        }
        
        return tunnels;
    }

    async createOptimizedTunnel(deviceInfo) {
        const airplayServer = new NodeTunes({
            serverName: `AirSonos-${deviceInfo.host}`,
            verbose: this.options.verbose,
            port: 0, // Auto-assign port
            controlTimeout: this.options.timeout
        });
        
        // Get device name
        let deviceName;
        try {
            const zones = await deviceInfo.device.getZoneAttrs();
            deviceName = zones.CurrentZoneName || `Sonos-${deviceInfo.host}`;
        } catch (error) {
            deviceName = `Sonos-${deviceInfo.host}`;
        }
        
        const tunnel = {
            device: deviceInfo.device,
            deviceName: deviceName,
            server: airplayServer,
            host: deviceInfo.host,
            port: deviceInfo.port,
            nicercast: null,
            audioProcessor: null,
            stats: {
                packetsProcessed: 0,
                errors: 0,
                lastActivity: Date.now(),
                bufferHealth: 'good'
            }
        };
        
        // Setup audio processing
        await this.setupAudioProcessing(tunnel);
        
        // Setup health monitoring for this tunnel
        this.setupTunnelHealthMonitoring(tunnel);
        
        return tunnel;
    }

    async setupAudioProcessing(tunnel) {
        const server = tunnel.server;
        
        server.on('clientConnected', (audioStream) => {
            this.logger.info(`Client connected to ${tunnel.deviceName}`);
            
            try {
                // Smart format detection
                const formatInfo = this.detectAudioFormat(audioStream);
                this.logger.debug('Audio format detected', formatInfo);
                
                // Create optimized audio processor
                const processor = this.createAudioProcessor(tunnel, audioStream, formatInfo);
                tunnel.audioProcessor = processor;
                
                // Setup Nicercast with optimizations
                const nicercast = new Nicercast(audioStream, {
                    networkBufferSize: this.options.networkBufferSize,
                    backpressureThreshold: this.options.backpressureThreshold
                });
                
                tunnel.nicercast = nicercast;
                
                // Connect to Sonos with adaptive buffering
                this.connectToSonos(tunnel, nicercast);
                
            } catch (error) {
                this.logger.error(`Audio setup failed for ${tunnel.deviceName}`, {
                    error: error.message
                });
                tunnel.stats.errors++;
            }
        });
        
        server.on('clientDisconnected', () => {
            this.logger.info(`Client disconnected from ${tunnel.deviceName}`);
            this.cleanupAudioProcessing(tunnel);
        });
        
        server.on('error', (error) => {
            this.logger.error(`Server error for ${tunnel.deviceName}`, {
                error: error.message
            });
            tunnel.stats.errors++;
            this.performanceMetrics.networkErrors++;
        });
    }

    detectAudioFormat(audioStream) {
        // Smart format detection implementation
        const formatInfo = {
            codec: 'pcm',
            sampleRate: 44100,
            channels: 2,
            bitDepth: 16,
            supportALAC: this.options.enableALAC
        };
        
        if (this.options.smartFormatDetection) {
            // Enhanced format detection logic would go here
            // For now, return default PCM format
        }
        
        return formatInfo;
    }

    createAudioProcessor(tunnel, audioStream, formatInfo) {
        if (this.options.enableWorkerThreads && this.workers.size > 0) {
            return this.createWorkerAudioProcessor(tunnel, audioStream, formatInfo);
        } else {
            return this.createMainThreadAudioProcessor(tunnel, audioStream, formatInfo);
        }
    }

    createWorkerAudioProcessor(tunnel, audioStream, formatInfo) {
        // Find available worker
        let selectedWorker = null;
        let minLoad = Infinity;
        
        for (const [workerId, workerInfo] of this.workers) {
            if (!workerInfo.busy && workerInfo.tasksCompleted < minLoad) {
                minLoad = workerInfo.tasksCompleted;
                selectedWorker = { workerId, workerInfo };
            }
        }
        
        if (!selectedWorker) {
            this.logger.warn('No available workers, falling back to main thread');
            return this.createMainThreadAudioProcessor(tunnel, audioStream, formatInfo);
        }
        
        const { workerId, workerInfo } = selectedWorker;
        workerInfo.busy = true;
        workerInfo.lastUsed = Date.now();
        
        const processor = {
            type: 'worker',
            workerId: workerId,
            formatInfo: formatInfo,
            bufferSize: this.bufferStats.currentSize,
            processAudio: (chunk) => {
                return this.processAudioInWorker(workerId, chunk, formatInfo);
            }
        };
        
        this.audioProcessors.set(tunnel.host, processor);
        return processor;
    }

    createMainThreadAudioProcessor(tunnel, audioStream, formatInfo) {
        const processor = {
            type: 'main',
            formatInfo: formatInfo,
            bufferSize: this.bufferStats.currentSize,
            buffer: [],
            processAudio: (chunk) => {
                return this.processAudioInMainThread(chunk, formatInfo);
            }
        };
        
        this.audioProcessors.set(tunnel.host, processor);
        return processor;
    }

    async processAudioInWorker(workerId, chunk, formatInfo) {
        return new Promise((resolve, reject) => {
            const workerInfo = this.workers.get(workerId);
            if (!workerInfo) {
                reject(new Error(`Worker ${workerId} not found`));
                return;
            }
            
            const messageId = Date.now() + Math.random();
            
            const timeout = setTimeout(() => {
                reject(new Error('Worker processing timeout'));
            }, 1000);
            
            const cleanup = () => {
                clearTimeout(timeout);
                workerInfo.worker.removeAllListeners(`response-${messageId}`);
            };
            
            workerInfo.worker.once(`response-${messageId}`, (result) => {
                cleanup();
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result.data);
                }
            });
            
            workerInfo.worker.postMessage({
                type: 'processAudio',
                id: messageId,
                chunk: chunk,
                formatInfo: formatInfo,
                bufferSize: this.bufferStats.currentSize
            });
        });
    }

    processAudioInMainThread(chunk, formatInfo) {
        // Main thread audio processing with adaptive buffering
        try {
            this.performanceMetrics.packetsProcessed++;
            
            // Apply adaptive buffering
            if (this.options.adaptiveBuffering) {
                this.adjustBufferSize();
            }
            
            // Process audio chunk (placeholder for actual processing)
            const processedChunk = this.applyAudioOptimizations(chunk, formatInfo);
            
            return processedChunk;
            
        } catch (error) {
            this.logger.error('Audio processing error', { error: error.message });
            throw error;
        }
    }

    applyAudioOptimizations(chunk, formatInfo) {
        // Apply various audio optimizations
        let processedChunk = chunk;
        
        // ALAC processing if enabled and supported
        if (this.options.enableALAC && formatInfo.supportALAC) {
            // ALAC processing would go here
        }
        
        // Other audio optimizations
        // - Noise reduction
        // - Dynamic range compression
        // - Sample rate conversion if needed
        
        return processedChunk;
    }

    adjustBufferSize() {
        const now = Date.now();
        if (now - this.bufferStats.lastAdjustment < this.bufferStats.adjustmentCooldown) {
            return;
        }
        
        const { underruns, overruns, currentSize } = this.bufferStats;
        let newSize = currentSize;
        
        if (underruns > 3) {
            // Increase buffer size
            newSize = Math.min(this.options.maxBufferSize, currentSize + 50);
            this.bufferStats.underruns = 0;
            this.logger.debug('Increasing buffer size due to underruns', {
                oldSize: currentSize,
                newSize: newSize
            });
        } else if (overruns > 5 && currentSize > this.options.minBufferSize) {
            // Decrease buffer size
            newSize = Math.max(this.options.minBufferSize, currentSize - 25);
            this.bufferStats.overruns = 0;
            this.logger.debug('Decreasing buffer size due to overruns', {
                oldSize: currentSize,
                newSize: newSize
            });
        }
        
        if (newSize !== currentSize) {
            this.bufferStats.currentSize = newSize;
            this.bufferStats.lastAdjustment = now;
            
            // Update all active processors
            for (const processor of this.audioProcessors.values()) {
                processor.bufferSize = newSize;
            }
        }
    }

    async connectToSonos(tunnel, nicercast) {
        try {
            const device = tunnel.device;
            
            // Setup backpressure handling
            nicercast.on('backpressure', () => {
                this.handleBackpressure(tunnel);
            });
            
            // Start streaming to Sonos
            const streamUrl = `http://${nicercast.ip}:${nicercast.port}`;
            
            await device.play({
                uri: streamUrl,
                metadata: this.generateMetadata(tunnel.deviceName)
            });
            
            tunnel.stats.lastActivity = Date.now();
            this.logger.info(`Streaming started for ${tunnel.deviceName}`, {
                streamUrl: streamUrl
            });
            
        } catch (error) {
            this.logger.error(`Failed to connect to Sonos ${tunnel.deviceName}`, {
                error: error.message
            });
            throw error;
        }
    }

    handleBackpressure(tunnel) {
        this.logger.warn(`Backpressure detected for ${tunnel.deviceName}`);
        
        // Adaptive response to backpressure
        if (this.options.adaptiveBuffering) {
            this.bufferStats.overruns++;
        }
        
        // Temporary quality reduction or other mitigation strategies
        tunnel.stats.bufferHealth = 'degraded';
        
        setTimeout(() => {
            tunnel.stats.bufferHealth = 'good';
        }, 5000);
    }

    generateMetadata(deviceName) {
        return `
            <DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" 
                       xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" 
                       xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
                <item id="1" parentID="0" restricted="1">
                    <dc:title>AirPlay Stream</dc:title>
                    <dc:creator>AirSonos Optimized</dc:creator>
                    <upnp:class>object.item.audioItem.musicTrack</upnp:class>
                    <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON65031_</desc>
                </item>
            </DIDL-Lite>
        `;
    }

    setupTunnelHealthMonitoring(tunnel) {
        const baseInterval = this.options.healthCheckInterval;
        let currentInterval = baseInterval;
        
        const healthCheck = async () => {
            try {
                const startTime = Date.now();
                const state = await tunnel.device.getCurrentState();
                const latency = Date.now() - startTime;
                
                // Update health metrics
                const metrics = this.healthMetrics.get(tunnel.host) || {
                    lastCheck: Date.now(),
                    latency: latency,
                    consecutiveFailures: 0,
                    avgLatency: latency,
                    checks: 1
                };
                
                metrics.lastCheck = Date.now();
                metrics.latency = latency;
                metrics.consecutiveFailures = 0;
                metrics.avgLatency = (metrics.avgLatency * metrics.checks + latency) / (metrics.checks + 1);
                metrics.checks++;
                
                this.healthMetrics.set(tunnel.host, metrics);
                
                // Adaptive ping interval
                if (this.options.adaptivePingInterval) {
                    if (latency < 100) {
                        currentInterval = Math.min(this.options.maxPingInterval, currentInterval * 1.2);
                    } else if (latency > 500) {
                        currentInterval = Math.max(this.options.minPingInterval, currentInterval * 0.8);
                    }
                }
                
                tunnel.stats.lastActivity = Date.now();
                
            } catch (error) {
                this.logger.warn(`Health check failed for ${tunnel.deviceName}`, {
                    error: error.message
                });
                
                const metrics = this.healthMetrics.get(tunnel.host) || { consecutiveFailures: 0 };
                metrics.consecutiveFailures++;
                metrics.lastCheck = Date.now();
                this.healthMetrics.set(tunnel.host, metrics);
                
                if (metrics.consecutiveFailures > 3) {
                    this.logger.error(`Device ${tunnel.deviceName} appears unhealthy, attempting recovery`);
                    await this.attemptDeviceRecovery(tunnel);
                }
            }
            
            setTimeout(healthCheck, currentInterval);
        };
        
        // Start health monitoring
        setTimeout(healthCheck, Math.random() * 5000); // Stagger initial checks
    }

    async attemptDeviceRecovery(tunnel) {
        try {
            this.logger.info(`Attempting recovery for ${tunnel.deviceName}`);
            
            // Cleanup existing connections
            this.cleanupAudioProcessing(tunnel);
            
            // Wait a bit before reconnecting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test basic connectivity
            await tunnel.device.getCurrentState();
            
            // Reset health metrics
            const metrics = this.healthMetrics.get(tunnel.host);
            if (metrics) {
                metrics.consecutiveFailures = 0;
            }
            
            this.logger.info(`Recovery successful for ${tunnel.deviceName}`);
            
        } catch (error) {
            this.logger.error(`Recovery failed for ${tunnel.deviceName}`, {
                error: error.message
            });
            this.performanceMetrics.deviceFailures++;
        }
    }

    startHealthMonitoring() {
        this.logger.info('Starting system health monitoring');
        
        // System health check every 30 seconds
        cron.schedule('*/30 * * * * *', () => {
            this.performSystemHealthCheck();
        });
    }

    async performSystemHealthCheck() {
        try {
            const usage = await pidusage(process.pid);
            
            this.performanceMetrics.cpuUsage = usage.cpu;
            this.performanceMetrics.memoryUsage = usage.memory;
            
            const healthStatus = {
                uptime: Date.now() - this.performanceMetrics.startTime,
                cpuUsage: usage.cpu,
                memoryUsage: usage.memory,
                activeTunnels: this.tunnels.size,
                activeWorkers: this.workers.size,
                packetsProcessed: this.performanceMetrics.packetsProcessed,
                errors: this.performanceMetrics.networkErrors + this.performanceMetrics.deviceFailures,
                bufferHealth: this.bufferStats
            };
            
            this.emit('healthUpdate', healthStatus);
            
            // Log health warnings
            if (usage.cpu > 80) {
                this.logger.warn('High CPU usage detected', { cpu: usage.cpu });
            }
            
            if (usage.memory > 500 * 1024 * 1024) { // > 500MB
                this.logger.warn('High memory usage detected', { 
                    memoryMB: Math.round(usage.memory / 1024 / 1024) 
                });
            }
            
        } catch (error) {
            this.logger.error('Health check failed', { error: error.message });
        }
    }

    startPerformanceMonitoring() {
        // Performance metrics every 60 seconds
        cron.schedule('0 * * * * *', () => {
            this.logPerformanceMetrics();
        });
    }

    logPerformanceMetrics() {
        const metrics = {
            ...this.performanceMetrics,
            uptime: Date.now() - this.performanceMetrics.startTime,
            tunnelsActive: this.tunnels.size,
            workersActive: this.workers.size,
            cacheHitRate: this.cache.getStats(),
            bufferStats: this.bufferStats
        };
        
        this.logger.info('Performance metrics', metrics);
        this.emit('performanceUpdate', metrics);
    }

    cleanupAudioProcessing(tunnel) {
        if (tunnel.nicercast) {
            try {
                tunnel.nicercast.stop();
            } catch (error) {
                this.logger.warn('Error stopping nicercast', { error: error.message });
            }
            tunnel.nicercast = null;
        }
        
        if (tunnel.audioProcessor) {
            const processor = tunnel.audioProcessor;
            
            if (processor.type === 'worker') {
                const workerInfo = this.workers.get(processor.workerId);
                if (workerInfo) {
                    workerInfo.busy = false;
                }
            }
            
            this.audioProcessors.delete(tunnel.host);
            tunnel.audioProcessor = null;
        }
    }

    handleWorkerMessage(workerId, message) {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) return;
        
        switch (message.type) {
            case 'taskComplete':
                workerInfo.busy = false;
                workerInfo.tasksCompleted++;
                break;
                
            case 'error':
                this.logger.error(`Worker ${workerId} error`, { error: message.error });
                workerInfo.busy = false;
                break;
                
            default:
                this.logger.debug(`Unknown message from worker ${workerId}`, message);
        }
    }

    handleWorkerError(workerId, error) {
        this.logger.error(`Worker ${workerId} error`, { error: error.message });
        this.restartWorker(workerId);
    }

    handleWorkerExit(workerId, code) {
        this.logger.warn(`Worker ${workerId} exited with code ${code}`);
        if (code !== 0) {
            this.restartWorker(workerId);
        }
    }

    async restartWorker(workerId) {
        try {
            const oldWorker = this.workers.get(workerId);
            if (oldWorker) {
                oldWorker.worker.terminate();
            }
            
            const worker = new Worker(__filename, {
                workerData: {
                    workerId: workerId,
                    options: this.options
                }
            });
            
            worker.on('message', (message) => this.handleWorkerMessage(workerId, message));
            worker.on('error', (error) => this.handleWorkerError(workerId, error));
            worker.on('exit', (code) => this.handleWorkerExit(workerId, code));
            
            this.workers.set(workerId, {
                worker,
                busy: false,
                tasksCompleted: 0,
                lastUsed: Date.now()
            });
            
            this.logger.info(`Worker ${workerId} restarted successfully`);
            
        } catch (error) {
            this.logger.error(`Failed to restart worker ${workerId}`, { error: error.message });
        }
    }

    async stop() {
        this.logger.info('Stopping OptimizedAirSonos service...');
        
        // Cleanup all tunnels
        for (const tunnel of this.tunnels.values()) {
            this.cleanupAudioProcessing(tunnel);
            if (tunnel.server) {
                tunnel.server.stop();
            }
        }
        
        // Terminate all workers
        for (const workerInfo of this.workers.values()) {
            await workerInfo.worker.terminate();
        }
        
        this.tunnels.clear();
        this.workers.clear();
        this.audioProcessors.clear();
        this.healthMetrics.clear();
        
        this.emit('stopped');
        this.logger.info('Service stopped successfully');
    }

    getStats() {
        return {
            performance: this.performanceMetrics,
            bufferStats: this.bufferStats,
            tunnels: Array.from(this.tunnels.values()).map(tunnel => ({
                deviceName: tunnel.deviceName,
                host: tunnel.host,
                stats: tunnel.stats
            })),
            workers: Array.from(this.workers.entries()).map(([id, info]) => ({
                id,
                busy: info.busy,
                tasksCompleted: info.tasksCompleted,
                lastUsed: info.lastUsed
            })),
            health: Array.from(this.healthMetrics.entries()).map(([host, metrics]) => ({
                host,
                ...metrics
            }))
        };
    }
}

// Worker thread code
if (!isMainThread) {
    const { workerId, options } = workerData;
    
    parentPort.on('message', (message) => {
        switch (message.type) {
            case 'processAudio':
                try {
                    // Audio processing in worker thread
                    const processedChunk = processAudioChunk(message.chunk, message.formatInfo, message.bufferSize);
                    
                    parentPort.postMessage({
                        type: `response-${message.id}`,
                        data: processedChunk
                    });
                    
                } catch (error) {
                    parentPort.postMessage({
                        type: `response-${message.id}`,
                        error: error.message
                    });
                }
                break;
        }
    });
    
    function processAudioChunk(chunk, formatInfo, bufferSize) {
        // Worker thread audio processing logic
        // This would include more sophisticated processing
        return chunk; // Placeholder
    }
}

module.exports = OptimizedAirSonos;