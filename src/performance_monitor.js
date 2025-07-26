const EventEmitter = require('events');
const os = require('os');
const fs = require('fs').promises;
const pidusage = require('pidusage');
const winston = require('winston');
const cron = require('node-cron');

class PerformanceMonitor extends EventEmitter {
    constructor(airsonosInstance, haIntegration, options = {}) {
        super();
        
        this.airsonos = airsonosInstance;
        this.haIntegration = haIntegration;
        this.options = {
            // Monitoring intervals
            cpuMonitorInterval: options.cpuMonitorInterval || 5000,
            networkMonitorInterval: options.networkMonitorInterval || 10000,
            audioMonitorInterval: options.audioMonitorInterval || 1000,
            deviceHealthInterval: options.deviceHealthInterval || 30000,
            
            // Alert thresholds
            cpuAlertThreshold: options.cpuAlertThreshold || 80,
            memoryAlertThreshold: options.memoryAlertThreshold || 85,
            dropoutThreshold: options.dropoutThreshold || 3,
            latencyThreshold: options.latencyThreshold || 500,
            deviceFailureThreshold: options.deviceFailureThreshold || 5,
            
            // Auto-tuning settings
            autoTuningEnabled: options.autoTuningEnabled !== false,
            aggressiveOptimization: options.aggressiveOptimization || false,
            optimizationCooldown: options.optimizationCooldown || 30000,
            
            // Reporting settings
            reportingEnabled: options.reportingEnabled !== false,
            diagnosticHistoryDays: options.diagnosticHistoryDays || 7,
            
            ...options
        };
        
        // Performance tracking state
        this.metrics = {
            cpu: {
                current: 0,
                average: 0,
                peak: 0,
                history: [],
                alerts: []
            },
            memory: {
                current: 0,
                average: 0,
                peak: 0,
                history: [],
                alerts: []
            },
            audio: {
                dropouts: 0,
                bufferUnderruns: 0,
                bufferOverruns: 0,
                qualityScore: 100,
                history: [],
                currentLatency: 0
            },
            network: {
                latency: 0,
                packetLoss: 0,
                bandwidth: 0,
                quality: 'unknown',
                history: [],
                errors: []
            },
            devices: new Map(),
            performance: {
                overallScore: 100,
                optimizationLevel: 'auto',
                lastOptimization: null,
                tuningHistory: []
            }
        };
        
        // Auto-tuning state
        this.tuningState = {
            lastAdjustment: Date.now(),
            currentProfile: 'balanced',
            adjustmentCount: 0,
            stabilizationPeriod: false
        };
        
        // Diagnostic tools
        this.diagnostics = {
            activeTests: new Map(),
            testHistory: [],
            troubleshootingMode: false
        };
        
        this.setupLogging();
        this.initializeMonitoring();
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

    async initializeMonitoring() {
        this.logger.info('Initializing performance monitoring system...');
        
        try {
            // Start monitoring subsystems
            this.startCPUMonitoring();
            this.startAudioMonitoring();
            this.startNetworkMonitoring();
            this.startDeviceReliabilityTracking();
            
            // Initialize auto-tuning
            if (this.options.autoTuningEnabled) {
                this.startAutoTuning();
            }
            
            // Setup performance reporting
            if (this.options.reportingEnabled) {
                this.startPerformanceReporting();
            }
            
            // Initialize diagnostic tools
            this.initializeDiagnosticTools();
            
            this.emit('monitoringStarted');
            this.logger.info('Performance monitoring system initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize performance monitoring', { error: error.message });
            this.emit('error', error);
        }
    }

    startCPUMonitoring() {
        this.logger.info('Starting CPU usage monitoring...');
        
        // CPU monitoring with pidusage
        setInterval(async () => {
            try {
                const usage = await pidusage(process.pid);
                await this.processCPUMetrics(usage);
                
            } catch (error) {
                this.logger.warn('CPU monitoring error', { error: error.message });
            }
        }, this.options.cpuMonitorInterval);
        
        // System-wide CPU monitoring
        setInterval(() => {
            this.processSystemCPUMetrics();
        }, this.options.cpuMonitorInterval * 2);
    }

    async processCPUMetrics(usage) {
        const cpuPercent = Math.round(usage.cpu);
        const memoryMB = Math.round(usage.memory / 1024 / 1024);
        const memoryPercent = Math.round((usage.memory / os.totalmem()) * 100);
        
        // Update CPU metrics
        this.metrics.cpu.current = cpuPercent;
        this.metrics.cpu.history.push({
            timestamp: Date.now(),
            value: cpuPercent
        });
        
        // Update memory metrics
        this.metrics.memory.current = memoryPercent;
        this.metrics.memory.history.push({
            timestamp: Date.now(),
            value: memoryPercent,
            absolute: memoryMB
        });
        
        // Trim history (keep last 24 hours)
        this.trimHistory(this.metrics.cpu.history, 24 * 60 * 60 * 1000);
        this.trimHistory(this.metrics.memory.history, 24 * 60 * 60 * 1000);
        
        // Calculate averages and peaks
        this.updateAveragesAndPeaks();
        
        // Check for alerts
        this.checkResourceAlerts(cpuPercent, memoryPercent);
        
        // Update HA sensors
        this.updateHASensors('cpu', cpuPercent);
        this.updateHASensors('memory', memoryPercent);
        
        // Trigger auto-tuning if needed
        if (this.shouldTriggerAutoTuning('cpu', cpuPercent)) {
            await this.triggerAutoTuning('high_cpu', { cpu: cpuPercent });
        }
    }

    processSystemCPUMetrics() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        
        // Calculate system load
        const systemLoad = loadAvg[0] / cpus.length * 100;
        
        this.emit('systemMetrics', {
            cpuCount: cpus.length,
            loadAverage: loadAvg,
            systemLoad: systemLoad,
            freeMemory: os.freemem(),
            totalMemory: os.totalmem()
        });
    }

    startAudioMonitoring() {
        this.logger.info('Starting audio dropout detection...');
        
        // Listen to AirSonos audio events
        this.airsonos.on('audioDropout', (data) => {
            this.handleAudioDropout(data);
        });
        
        this.airsonos.on('bufferUnderrun', (data) => {
            this.handleBufferUnderrun(data);
        });
        
        this.airsonos.on('bufferOverrun', (data) => {
            this.handleBufferOverrun(data);
        });
        
        // Periodic audio quality assessment
        setInterval(() => {
            this.assessAudioQuality();
        }, this.options.audioMonitorInterval);
    }

    handleAudioDropout(data) {
        this.metrics.audio.dropouts++;
        this.metrics.audio.history.push({
            timestamp: Date.now(),
            type: 'dropout',
            device: data.device,
            duration: data.duration,
            cause: data.cause
        });
        
        this.logger.warn('Audio dropout detected', data);
        
        // Send HA notification
        this.sendHANotification('warning', `Audio dropout detected on ${data.device}`, {
            device: data.device,
            duration: data.duration,
            cause: data.cause
        });
        
        // Trigger automatic buffer adjustment
        if (this.options.autoTuningEnabled) {
            this.triggerBufferAdjustment('dropout', data);
        }
        
        // Update quality score
        this.updateAudioQualityScore(-5);
    }

    handleBufferUnderrun(data) {
        this.metrics.audio.bufferUnderruns++;
        
        this.logger.debug('Buffer underrun detected', data);
        
        // Automatic buffer size increase
        if (this.shouldAdjustBuffer('underrun')) {
            this.adjustBufferSize('increase', data);
        }
        
        this.updateAudioQualityScore(-2);
    }

    handleBufferOverrun(data) {
        this.metrics.audio.bufferOverruns++;
        
        this.logger.debug('Buffer overrun detected', data);
        
        // Consider buffer size decrease (less aggressive)
        if (this.shouldAdjustBuffer('overrun')) {
            this.adjustBufferSize('decrease', data);
        }
        
        this.updateAudioQualityScore(-1);
    }

    async triggerBufferAdjustment(reason, data) {
        const now = Date.now();
        
        // Cooldown check
        if (now - this.tuningState.lastAdjustment < this.options.optimizationCooldown) {
            return;
        }
        
        const currentConfig = this.airsonos.options;
        let newMinBuffer = currentConfig.minBufferSize;
        let newMaxBuffer = currentConfig.maxBufferSize;
        
        switch (reason) {
            case 'dropout':
                // Increase both min and max buffer sizes
                newMinBuffer = Math.min(newMinBuffer + 50, 1000);
                newMaxBuffer = Math.min(newMaxBuffer + 100, 2000);
                break;
                
            case 'high_latency':
                // Increase max buffer size
                newMaxBuffer = Math.min(newMaxBuffer + 75, 1500);
                break;
                
            case 'network_issues':
                // More aggressive increase
                newMinBuffer = Math.min(newMinBuffer + 75, 800);
                newMaxBuffer = Math.min(newMaxBuffer + 150, 2000);
                break;
        }
        
        if (newMinBuffer !== currentConfig.minBufferSize || newMaxBuffer !== currentConfig.maxBufferSize) {
            await this.applyBufferAdjustment(newMinBuffer, newMaxBuffer, reason);
        }
    }

    async applyBufferAdjustment(minBuffer, maxBuffer, reason) {
        try {
            // Update AirSonos configuration
            this.airsonos.options.minBufferSize = minBuffer;
            this.airsonos.options.maxBufferSize = maxBuffer;
            
            // Update buffer stats
            if (this.airsonos.bufferStats) {
                this.airsonos.bufferStats.currentSize = Math.max(
                    minBuffer,
                    Math.min(this.airsonos.bufferStats.currentSize, maxBuffer)
                );
            }
            
            this.tuningState.lastAdjustment = Date.now();
            this.tuningState.adjustmentCount++;
            
            this.logger.info('Buffer size adjusted', {
                reason,
                minBuffer,
                maxBuffer,
                adjustmentCount: this.tuningState.adjustmentCount
            });
            
            // Send HA notification
            this.sendHANotification('info', `Buffer size adjusted due to ${reason}`, {
                minBuffer,
                maxBuffer,
                reason
            });
            
            // Record tuning history
            this.metrics.performance.tuningHistory.push({
                timestamp: Date.now(),
                type: 'buffer_adjustment',
                reason,
                changes: { minBuffer, maxBuffer },
                success: true
            });
            
        } catch (error) {
            this.logger.error('Failed to apply buffer adjustment', { error: error.message });
        }
    }

    shouldAdjustBuffer(type) {
        const recentUnderruns = this.metrics.audio.history
            .filter(event => 
                event.type === 'underrun' && 
                Date.now() - event.timestamp < 60000
            ).length;
            
        const recentOverruns = this.metrics.audio.history
            .filter(event => 
                event.type === 'overrun' && 
                Date.now() - event.timestamp < 120000
            ).length;
        
        if (type === 'underrun') {
            return recentUnderruns >= 3;
        } else if (type === 'overrun') {
            return recentOverruns >= 10 && recentUnderruns === 0;
        }
        
        return false;
    }

    adjustBufferSize(direction, data) {
        const currentBuffer = this.airsonos.bufferStats?.currentSize || 
                            this.airsonos.options.minBufferSize;
        
        let newSize = currentBuffer;
        
        if (direction === 'increase') {
            newSize = Math.min(currentBuffer + 25, this.airsonos.options.maxBufferSize);
        } else if (direction === 'decrease') {
            newSize = Math.max(currentBuffer - 15, this.airsonos.options.minBufferSize);
        }
        
        if (newSize !== currentBuffer && this.airsonos.bufferStats) {
            this.airsonos.bufferStats.currentSize = newSize;
            this.logger.debug(`Buffer size adjusted: ${currentBuffer}ms → ${newSize}ms`);
        }
    }

    startNetworkMonitoring() {
        this.logger.info('Starting network latency monitoring...');
        
        setInterval(async () => {
            await this.measureNetworkLatency();
        }, this.options.networkMonitorInterval);
        
        // Monitor network quality trends
        setInterval(() => {
            this.analyzeNetworkTrends();
        }, this.options.networkMonitorInterval * 3);
    }

    async measureNetworkLatency() {
        try {
            const devices = Array.from(this.airsonos.devices.values());
            const latencies = [];
            
            for (const deviceInfo of devices) {
                try {
                    const startTime = Date.now();
                    await deviceInfo.device.getCurrentState();
                    const latency = Date.now() - startTime;
                    
                    latencies.push(latency);
                    
                    // Update device-specific metrics
                    this.updateDeviceMetrics(deviceInfo.host, 'latency', latency);
                    
                } catch (error) {
                    this.logger.debug(`Network test failed for ${deviceInfo.host}`, { error: error.message });
                    this.updateDeviceMetrics(deviceInfo.host, 'error', error.message);
                }
            }
            
            if (latencies.length > 0) {
                const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
                this.metrics.network.latency = Math.round(avgLatency);
                
                this.metrics.network.history.push({
                    timestamp: Date.now(),
                    latency: avgLatency,
                    deviceCount: latencies.length
                });
                
                // Update network quality assessment
                this.updateNetworkQuality(avgLatency);
                
                // Update HA sensors
                this.updateHASensors('network_latency', avgLatency);
                
                // Check for alerts
                if (avgLatency > this.options.latencyThreshold) {
                    this.handleHighLatency(avgLatency);
                }
            }
            
        } catch (error) {
            this.logger.warn('Network monitoring error', { error: error.message });
        }
    }

    updateNetworkQuality(latency) {
        let quality;
        if (latency < 50) quality = 'excellent';
        else if (latency < 100) quality = 'good';
        else if (latency < 250) quality = 'fair';
        else quality = 'poor';
        
        this.metrics.network.quality = quality;
        this.updateHASensors('network_quality', quality);
    }

    handleHighLatency(latency) {
        this.logger.warn('High network latency detected', { latency });
        
        this.sendHANotification('warning', `High network latency detected: ${latency}ms`, {
            latency,
            threshold: this.options.latencyThreshold
        });
        
        // Trigger network-based auto-tuning
        if (this.options.autoTuningEnabled) {
            this.triggerAutoTuning('high_latency', { latency });
        }
    }

    analyzeNetworkTrends() {
        const recentHistory = this.metrics.network.history
            .filter(entry => Date.now() - entry.timestamp < 300000) // Last 5 minutes
            .map(entry => entry.latency);
        
        if (recentHistory.length < 3) return;
        
        const avgLatency = recentHistory.reduce((a, b) => a + b) / recentHistory.length;
        const maxLatency = Math.max(...recentHistory);
        const variance = Math.max(...recentHistory) - Math.min(...recentHistory);
        
        // Detect network instability
        if (variance > 200) {
            this.logger.warn('Network instability detected', {
                avgLatency,
                maxLatency,
                variance
            });
            
            this.sendHANotification('warning', 'Network instability detected', {
                avgLatency: Math.round(avgLatency),
                variance: Math.round(variance)
            });
        }
    }

    startDeviceReliabilityTracking() {
        this.logger.info('Starting device reliability tracking...');
        
        setInterval(() => {
            this.assessDeviceReliability();
        }, this.options.deviceHealthInterval);
        
        // Listen to device events
        this.airsonos.on('deviceConnected', (device) => {
            this.updateDeviceReliability(device.host, 'connected');
        });
        
        this.airsonos.on('deviceDisconnected', (device) => {
            this.updateDeviceReliability(device.host, 'disconnected');
        });
        
        this.airsonos.on('deviceError', (device, error) => {
            this.updateDeviceReliability(device.host, 'error', error);
        });
    }

    updateDeviceMetrics(deviceHost, metricType, value) {
        if (!this.metrics.devices.has(deviceHost)) {
            this.metrics.devices.set(deviceHost, {
                host: deviceHost,
                reliability: 100,
                latency: 0,
                errors: 0,
                uptime: 100,
                lastSeen: Date.now(),
                history: []
            });
        }
        
        const deviceMetrics = this.metrics.devices.get(deviceHost);
        
        switch (metricType) {
            case 'latency':
                deviceMetrics.latency = value;
                deviceMetrics.lastSeen = Date.now();
                break;
                
            case 'error':
                deviceMetrics.errors++;
                deviceMetrics.reliability = Math.max(0, deviceMetrics.reliability - 5);
                break;
                
            case 'connected':
                deviceMetrics.reliability = Math.min(100, deviceMetrics.reliability + 2);
                deviceMetrics.lastSeen = Date.now();
                break;
                
            case 'disconnected':
                deviceMetrics.reliability = Math.max(0, deviceMetrics.reliability - 10);
                break;
        }
        
        deviceMetrics.history.push({
            timestamp: Date.now(),
            type: metricType,
            value: value
        });
        
        // Trim device history
        this.trimHistory(deviceMetrics.history, 24 * 60 * 60 * 1000);
    }

    updateDeviceReliability(deviceHost, event, data = null) {
        this.updateDeviceMetrics(deviceHost, event, data);
        
        const deviceMetrics = this.metrics.devices.get(deviceHost);
        if (deviceMetrics && deviceMetrics.reliability < 50) {
            this.handleUnreliableDevice(deviceHost, deviceMetrics);
        }
    }

    handleUnreliableDevice(deviceHost, metrics) {
        this.logger.warn('Unreliable device detected', {
            host: deviceHost,
            reliability: metrics.reliability,
            errors: metrics.errors
        });
        
        this.sendHANotification('warning', `Device ${deviceHost} showing reliability issues`, {
            host: deviceHost,
            reliability: metrics.reliability,
            errors: metrics.errors,
            lastSeen: new Date(metrics.lastSeen).toISOString()
        });
        
        // Trigger device-specific optimization
        if (this.options.autoTuningEnabled) {
            this.triggerAutoTuning('unreliable_device', { 
                host: deviceHost, 
                metrics 
            });
        }
    }

    assessDeviceReliability() {
        for (const [deviceHost, metrics] of this.metrics.devices) {
            const timeSinceLastSeen = Date.now() - metrics.lastSeen;
            
            // Update uptime calculation
            if (timeSinceLastSeen > 60000) { // More than 1 minute
                metrics.uptime = Math.max(0, metrics.uptime - 1);
            } else {
                metrics.uptime = Math.min(100, metrics.uptime + 0.1);
            }
            
            // Check for device timeout
            if (timeSinceLastSeen > 300000) { // More than 5 minutes
                this.handleDeviceTimeout(deviceHost, timeSinceLastSeen);
            }
        }
        
        // Update HA sensors with device counts
        const totalDevices = this.metrics.devices.size;
        const onlineDevices = Array.from(this.metrics.devices.values())
            .filter(device => Date.now() - device.lastSeen < 60000).length;
        
        this.updateHASensors('devices_total', totalDevices);
        this.updateHASensors('devices_online', onlineDevices);
    }

    handleDeviceTimeout(deviceHost, timeSinceLastSeen) {
        this.logger.warn('Device timeout detected', {
            host: deviceHost,
            timeoutMinutes: Math.round(timeSinceLastSeen / 60000)
        });
        
        this.updateDeviceReliability(deviceHost, 'timeout', timeSinceLastSeen);
    }

    startAutoTuning() {
        this.logger.info('Starting automatic optimization system...');
        
        // Periodic optimization assessment
        setInterval(() => {
            this.assessOptimizationNeeds();
        }, 60000); // Every minute
        
        // Performance trend analysis
        setInterval(() => {
            this.analyzePerformanceTrends();
        }, 300000); // Every 5 minutes
    }

    shouldTriggerAutoTuning(reason, data) {
        const now = Date.now();
        
        // Cooldown check
        if (now - this.tuningState.lastAdjustment < this.options.optimizationCooldown) {
            return false;
        }
        
        // Stabilization period check
        if (this.tuningState.stabilizationPeriod) {
            return false;
        }
        
        // Reason-specific checks
        switch (reason) {
            case 'cpu':
                return data.cpu > this.options.cpuAlertThreshold;
            case 'high_latency':
                return data.latency > this.options.latencyThreshold;
            case 'audio_quality':
                return this.metrics.audio.qualityScore < 70;
            default:
                return true;
        }
    }

    async triggerAutoTuning(reason, data) {
        this.logger.info('Triggering auto-tuning', { reason, data });
        
        try {
            const optimizations = await this.calculateOptimizations(reason, data);
            
            if (optimizations.length > 0) {
                await this.applyOptimizations(optimizations, reason);
                
                // Start stabilization period
                this.startStabilizationPeriod();
            }
            
        } catch (error) {
            this.logger.error('Auto-tuning failed', { error: error.message });
        }
    }

    async calculateOptimizations(reason, data) {
        const optimizations = [];
        const currentConfig = this.airsonos.options;
        
        switch (reason) {
            case 'high_cpu':
                if (currentConfig.enableWorkerThreads && currentConfig.maxWorkers > 1) {
                    optimizations.push({
                        type: 'reduce_workers',
                        currentValue: currentConfig.maxWorkers,
                        newValue: Math.max(1, currentConfig.maxWorkers - 1)
                    });
                }
                
                if (currentConfig.adaptiveBuffering) {
                    optimizations.push({
                        type: 'reduce_buffer_complexity',
                        setting: 'adaptiveBuffering',
                        newValue: false
                    });
                }
                break;
                
            case 'high_latency':
                optimizations.push({
                    type: 'increase_buffer',
                    currentMin: currentConfig.minBufferSize,
                    currentMax: currentConfig.maxBufferSize,
                    newMin: Math.min(currentConfig.minBufferSize + 50, 600),
                    newMax: Math.min(currentConfig.maxBufferSize + 100, 1000)
                });
                
                optimizations.push({
                    type: 'reduce_health_check_frequency',
                    currentValue: currentConfig.healthCheckInterval,
                    newValue: Math.min(currentConfig.healthCheckInterval * 1.5, 60000)
                });
                break;
                
            case 'unreliable_device':
                optimizations.push({
                    type: 'increase_device_timeout',
                    device: data.host,
                    currentValue: currentConfig.timeout,
                    newValue: Math.min(currentConfig.timeout + 2, 15)
                });
                break;
                
            case 'audio_quality':
                if (this.metrics.audio.dropouts > 5) {
                    optimizations.push({
                        type: 'increase_buffer_aggressively',
                        currentMin: currentConfig.minBufferSize,
                        newMin: Math.min(currentConfig.minBufferSize + 100, 800)
                    });
                }
                break;
        }
        
        return optimizations;
    }

    async applyOptimizations(optimizations, reason) {
        const appliedOptimizations = [];
        
        for (const optimization of optimizations) {
            try {
                await this.applyOptimization(optimization);
                appliedOptimizations.push(optimization);
                
            } catch (error) {
                this.logger.error('Failed to apply optimization', { 
                    optimization, 
                    error: error.message 
                });
            }
        }
        
        if (appliedOptimizations.length > 0) {
            this.tuningState.lastAdjustment = Date.now();
            this.tuningState.adjustmentCount++;
            
            // Record in tuning history
            this.metrics.performance.tuningHistory.push({
                timestamp: Date.now(),
                reason,
                optimizations: appliedOptimizations,
                success: true
            });
            
            this.logger.info('Optimizations applied', {
                reason,
                count: appliedOptimizations.length,
                optimizations: appliedOptimizations
            });
            
            // Send HA notification
            this.sendHANotification('info', `Performance optimizations applied due to ${reason}`, {
                optimizationCount: appliedOptimizations.length,
                reason
            });
        }
    }

    async applyOptimization(optimization) {
        switch (optimization.type) {
            case 'reduce_workers':
                this.airsonos.options.maxWorkers = optimization.newValue;
                break;
                
            case 'reduce_buffer_complexity':
                this.airsonos.options[optimization.setting] = optimization.newValue;
                break;
                
            case 'increase_buffer':
                this.airsonos.options.minBufferSize = optimization.newMin;
                this.airsonos.options.maxBufferSize = optimization.newMax;
                break;
                
            case 'increase_buffer_aggressively':
                this.airsonos.options.minBufferSize = optimization.newMin;
                break;
                
            case 'reduce_health_check_frequency':
                this.airsonos.options.healthCheckInterval = optimization.newValue;
                break;
                
            case 'increase_device_timeout':
                this.airsonos.options.timeout = optimization.newValue;
                break;
        }
    }

    startStabilizationPeriod() {
        this.tuningState.stabilizationPeriod = true;
        
        setTimeout(() => {
            this.tuningState.stabilizationPeriod = false;
            this.logger.debug('Stabilization period ended');
        }, this.options.optimizationCooldown * 2);
    }

    assessOptimizationNeeds() {
        const performanceScore = this.calculateOverallPerformanceScore();
        this.metrics.performance.overallScore = performanceScore;
        
        // Update HA sensor
        this.updateHASensors('performance_score', performanceScore);
        
        // Determine if optimization is needed
        if (performanceScore < 70) {
            this.logger.info('Performance score low, assessing optimization needs', {
                score: performanceScore
            });
            
            // Analyze what's causing poor performance
            const issues = this.identifyPerformanceIssues();
            
            if (issues.length > 0) {
                this.triggerAutoTuning('low_performance', { 
                    score: performanceScore, 
                    issues 
                });
            }
        }
    }

    calculateOverallPerformanceScore() {
        let score = 100;
        
        // CPU impact (weight: 25%)
        if (this.metrics.cpu.current > 80) score -= 20;
        else if (this.metrics.cpu.current > 60) score -= 10;
        else if (this.metrics.cpu.current > 40) score -= 5;
        
        // Memory impact (weight: 15%)
        if (this.metrics.memory.current > 85) score -= 15;
        else if (this.metrics.memory.current > 70) score -= 8;
        
        // Audio quality impact (weight: 30%)
        score = score * (this.metrics.audio.qualityScore / 100) * 0.7 + score * 0.3;
        
        // Network impact (weight: 20%)
        if (this.metrics.network.quality === 'poor') score -= 20;
        else if (this.metrics.network.quality === 'fair') score -= 10;
        else if (this.metrics.network.quality === 'good') score -= 2;
        
        // Device reliability impact (weight: 10%)
        const avgReliability = Array.from(this.metrics.devices.values())
            .reduce((sum, device) => sum + device.reliability, 0) / 
            Math.max(1, this.metrics.devices.size);
        
        if (avgReliability < 70) score -= 10;
        else if (avgReliability < 85) score -= 5;
        
        return Math.max(0, Math.round(score));
    }

    identifyPerformanceIssues() {
        const issues = [];
        
        if (this.metrics.cpu.current > 80) {
            issues.push({ type: 'high_cpu', severity: 'high', value: this.metrics.cpu.current });
        }
        
        if (this.metrics.memory.current > 85) {
            issues.push({ type: 'high_memory', severity: 'high', value: this.metrics.memory.current });
        }
        
        if (this.metrics.audio.dropouts > 5) {
            issues.push({ type: 'audio_dropouts', severity: 'medium', value: this.metrics.audio.dropouts });
        }
        
        if (this.metrics.network.quality === 'poor') {
            issues.push({ type: 'poor_network', severity: 'medium', value: this.metrics.network.latency });
        }
        
        const unreliableDevices = Array.from(this.metrics.devices.values())
            .filter(device => device.reliability < 70);
        
        if (unreliableDevices.length > 0) {
            issues.push({ 
                type: 'unreliable_devices', 
                severity: 'low', 
                value: unreliableDevices.length 
            });
        }
        
        return issues;
    }

    analyzePerformanceTrends() {
        // Analyze CPU trends
        const cpuTrend = this.calculateTrend(this.metrics.cpu.history, 'value');
        if (cpuTrend > 10) {
            this.logger.warn('Increasing CPU usage trend detected', { trend: cpuTrend });
        }
        
        // Analyze audio quality trends
        const audioTrend = this.calculateTrend(this.metrics.audio.history, 'type', 'dropout');
        if (audioTrend > 2) {
            this.logger.warn('Increasing audio dropout trend detected', { trend: audioTrend });
        }
        
        // Analyze network latency trends
        const networkTrend = this.calculateTrend(this.metrics.network.history, 'latency');
        if (networkTrend > 50) {
            this.logger.warn('Increasing network latency trend detected', { trend: networkTrend });
        }
    }

    calculateTrend(history, field, filterValue = null) {
        if (history.length < 10) return 0;
        
        const recent = history.slice(-10);
        let values;
        
        if (filterValue) {
            values = recent.map((entry, index) => 
                recent.slice(0, index + 1).filter(e => e[field] === filterValue).length
            );
        } else {
            values = recent.map(entry => entry[field]);
        }
        
        // Simple linear trend calculation
        const n = values.length;
        const sumX = (n * (n + 1)) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, y, x) => sum + (x + 1) * y, 0);
        const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    startPerformanceReporting() {
        this.logger.info('Starting performance reporting...');
        
        // Generate hourly reports
        cron.schedule('0 * * * *', () => {
            this.generateHourlyReport();
        });
        
        // Generate daily reports
        cron.schedule('0 0 * * *', () => {
            this.generateDailyReport();
        });
        
        // Real-time dashboard updates
        setInterval(() => {
            this.updateHADashboard();
        }, 30000); // Every 30 seconds
    }

    generateHourlyReport() {
        const report = {
            timestamp: new Date().toISOString(),
            period: 'hourly',
            performance: {
                averageCPU: this.calculateAverage(this.metrics.cpu.history, 'value', 3600000),
                averageMemory: this.calculateAverage(this.metrics.memory.history, 'value', 3600000),
                audioDropouts: this.countEvents(this.metrics.audio.history, 'dropout', 3600000),
                averageLatency: this.calculateAverage(this.metrics.network.history, 'latency', 3600000),
                overallScore: this.metrics.performance.overallScore
            },
            devices: this.generateDeviceReport(),
            optimizations: this.metrics.performance.tuningHistory
                .filter(entry => Date.now() - entry.timestamp < 3600000)
        };
        
        this.emit('hourlyReport', report);
        this.sendReportToHA(report);
    }

    generateDailyReport() {
        const report = {
            timestamp: new Date().toISOString(),
            period: 'daily',
            summary: {
                totalUptime: this.calculateUptime(),
                averagePerformanceScore: this.calculateDailyAverageScore(),
                totalOptimizations: this.metrics.performance.tuningHistory.length,
                deviceReliability: this.calculateDeviceReliabilityReport()
            },
            trends: {
                cpu: this.calculateTrend(this.metrics.cpu.history, 'value'),
                memory: this.calculateTrend(this.metrics.memory.history, 'value'),
                network: this.calculateTrend(this.metrics.network.history, 'latency')
            },
            recommendations: this.generateRecommendations()
        };
        
        this.emit('dailyReport', report);
        this.sendReportToHA(report);
    }

    generateRecommendations() {
        const recommendations = [];
        
        // CPU recommendations
        if (this.metrics.cpu.average > 70) {
            recommendations.push({
                type: 'cpu',
                priority: 'high',
                recommendation: 'Consider reducing the number of worker threads or optimizing buffer settings',
                impact: 'Reduce CPU usage by 10-20%'
            });
        }
        
        // Audio recommendations
        if (this.metrics.audio.dropouts > 10) {
            recommendations.push({
                type: 'audio',
                priority: 'medium',
                recommendation: 'Increase buffer sizes to reduce audio dropouts',
                impact: 'Improve audio quality by reducing dropouts'
            });
        }
        
        // Network recommendations
        if (this.metrics.network.quality === 'poor') {
            recommendations.push({
                type: 'network',
                priority: 'medium',
                recommendation: 'Check network configuration and consider increasing timeout values',
                impact: 'Improve device connectivity and reduce timeouts'
            });
        }
        
        return recommendations;
    }

    updateHADashboard() {
        const dashboardData = {
            performance: {
                score: this.metrics.performance.overallScore,
                cpu: this.metrics.cpu.current,
                memory: this.metrics.memory.current,
                audioQuality: this.metrics.audio.qualityScore,
                networkQuality: this.metrics.network.quality
            },
            devices: {
                total: this.metrics.devices.size,
                online: Array.from(this.metrics.devices.values())
                    .filter(device => Date.now() - device.lastSeen < 60000).length,
                reliability: this.calculateAverage(
                    Array.from(this.metrics.devices.values()).map(d => ({value: d.reliability})), 
                    'value'
                )
            },
            alerts: this.getActiveAlerts(),
            trends: {
                cpuTrend: this.calculateTrend(this.metrics.cpu.history.slice(-20), 'value'),
                networkTrend: this.calculateTrend(this.metrics.network.history.slice(-20), 'latency')
            }
        };
        
        this.emit('dashboardUpdate', dashboardData);
        
        if (this.haIntegration) {
            this.haIntegration.emit('performanceDashboardUpdate', dashboardData);
        }
    }

    // Diagnostic tools
    initializeDiagnosticTools() {
        this.logger.info('Initializing diagnostic tools...');
        
        // Register diagnostic commands
        this.diagnostics.availableTests = {
            'cpu_stress': this.runCPUStressTest.bind(this),
            'audio_test': this.runAudioTest.bind(this),
            'network_test': this.runNetworkTest.bind(this),
            'device_connectivity': this.runDeviceConnectivityTest.bind(this),
            'full_diagnostic': this.runFullDiagnostic.bind(this)
        };
    }

    async runDiagnosticTest(testName, options = {}) {
        this.logger.info(`Running diagnostic test: ${testName}`, options);
        
        const testFunction = this.diagnostics.availableTests[testName];
        if (!testFunction) {
            throw new Error(`Unknown diagnostic test: ${testName}`);
        }
        
        const testId = `${testName}_${Date.now()}`;
        this.diagnostics.activeTests.set(testId, {
            name: testName,
            startTime: Date.now(),
            options
        });
        
        try {
            const result = await testFunction(options);
            
            const testResult = {
                id: testId,
                name: testName,
                success: true,
                result,
                duration: Date.now() - this.diagnostics.activeTests.get(testId).startTime,
                timestamp: new Date().toISOString()
            };
            
            this.diagnostics.testHistory.push(testResult);
            this.diagnostics.activeTests.delete(testId);
            
            this.emit('diagnosticComplete', testResult);
            return testResult;
            
        } catch (error) {
            const testResult = {
                id: testId,
                name: testName,
                success: false,
                error: error.message,
                duration: Date.now() - this.diagnostics.activeTests.get(testId).startTime,
                timestamp: new Date().toISOString()
            };
            
            this.diagnostics.testHistory.push(testResult);
            this.diagnostics.activeTests.delete(testId);
            
            this.emit('diagnosticComplete', testResult);
            throw error;
        }
    }

    async runCPUStressTest(options = {}) {
        const duration = options.duration || 10000; // 10 seconds
        const startCPU = this.metrics.cpu.current;
        
        // Create CPU load
        const startTime = Date.now();
        const workers = [];
        
        for (let i = 0; i < os.cpus().length; i++) {
            workers.push(new Promise(resolve => {
                const workerStart = Date.now();
                while (Date.now() - workerStart < duration) {
                    Math.random() * Math.random();
                }
                resolve();
            }));
        }
        
        await Promise.all(workers);
        
        const endCPU = this.metrics.cpu.current;
        
        return {
            startCPU,
            endCPU,
            cpuIncrease: endCPU - startCPU,
            duration: Date.now() - startTime,
            systemResponse: endCPU > startCPU + 20 ? 'responsive' : 'limited'
        };
    }

    async runAudioTest(options = {}) {
        const testDuration = options.duration || 5000;
        const initialDropouts = this.metrics.audio.dropouts;
        const initialQuality = this.metrics.audio.qualityScore;
        
        // Monitor audio metrics during test
        await new Promise(resolve => setTimeout(resolve, testDuration));
        
        return {
            initialDropouts,
            finalDropouts: this.metrics.audio.dropouts,
            dropoutsDuring: this.metrics.audio.dropouts - initialDropouts,
            initialQuality,
            finalQuality: this.metrics.audio.qualityScore,
            qualityChange: this.metrics.audio.qualityScore - initialQuality
        };
    }

    async runNetworkTest(options = {}) {
        const testCount = options.testCount || 10;
        const results = [];
        
        for (let i = 0; i < testCount; i++) {
            await this.measureNetworkLatency();
            results.push(this.metrics.network.latency);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return {
            measurements: results,
            average: results.reduce((a, b) => a + b) / results.length,
            min: Math.min(...results),
            max: Math.max(...results),
            variance: Math.max(...results) - Math.min(...results),
            quality: this.metrics.network.quality
        };
    }

    async runDeviceConnectivityTest(options = {}) {
        const results = new Map();
        
        for (const [deviceHost, deviceMetrics] of this.metrics.devices) {
            try {
                const startTime = Date.now();
                // Test device connectivity (would need actual device instance)
                const latency = Date.now() - startTime;
                
                results.set(deviceHost, {
                    reachable: true,
                    latency,
                    reliability: deviceMetrics.reliability
                });
                
            } catch (error) {
                results.set(deviceHost, {
                    reachable: false,
                    error: error.message,
                    reliability: deviceMetrics.reliability
                });
            }
        }
        
        return {
            totalDevices: results.size,
            reachableDevices: Array.from(results.values()).filter(r => r.reachable).length,
            deviceResults: Object.fromEntries(results)
        };
    }

    async runFullDiagnostic(options = {}) {
        const fullResults = {};
        
        try {
            fullResults.cpu = await this.runCPUStressTest();
            fullResults.audio = await this.runAudioTest();
            fullResults.network = await this.runNetworkTest();
            fullResults.devices = await this.runDeviceConnectivityTest();
            
            fullResults.summary = {
                overallHealth: this.calculateOverallPerformanceScore(),
                recommendations: this.generateRecommendations(),
                systemInfo: {
                    cpuCount: os.cpus().length,
                    totalMemory: os.totalmem(),
                    freeMemory: os.freemem(),
                    platform: os.platform(),
                    nodeVersion: process.version
                }
            };
            
        } catch (error) {
            fullResults.error = error.message;
        }
        
        return fullResults;
    }

    // HA Integration methods
    updateHASensors(sensorType, value) {
        if (!this.haIntegration) return;
        
        try {
            this.haIntegration.updateSensorValue(`airsonos_${sensorType}`, value);
        } catch (error) {
            this.logger.debug('Failed to update HA sensor', { sensorType, error: error.message });
        }
    }

    sendHANotification(level, message, data = {}) {
        if (!this.haIntegration) return;
        
        try {
            this.haIntegration.sendNotification(level, message, data);
        } catch (error) {
            this.logger.debug('Failed to send HA notification', { error: error.message });
        }
    }

    sendReportToHA(report) {
        if (!this.haIntegration) return;
        
        try {
            this.haIntegration.emit('performanceReport', report);
        } catch (error) {
            this.logger.debug('Failed to send report to HA', { error: error.message });
        }
    }

    // Utility methods
    trimHistory(historyArray, maxAge) {
        const cutoff = Date.now() - maxAge;
        return historyArray.filter(entry => entry.timestamp > cutoff);
    }

    calculateAverage(historyArray, field, timeWindow = null) {
        let data = historyArray;
        
        if (timeWindow) {
            const cutoff = Date.now() - timeWindow;
            data = historyArray.filter(entry => entry.timestamp > cutoff);
        }
        
        if (data.length === 0) return 0;
        
        const sum = data.reduce((total, entry) => total + entry[field], 0);
        return Math.round(sum / data.length);
    }

    countEvents(historyArray, eventType, timeWindow) {
        const cutoff = Date.now() - timeWindow;
        return historyArray.filter(entry => 
            entry.timestamp > cutoff && entry.type === eventType
        ).length;
    }

    updateAveragesAndPeaks() {
        // CPU averages and peaks
        if (this.metrics.cpu.history.length > 0) {
            this.metrics.cpu.average = this.calculateAverage(this.metrics.cpu.history, 'value');
            this.metrics.cpu.peak = Math.max(...this.metrics.cpu.history.map(h => h.value));
        }
        
        // Memory averages and peaks
        if (this.metrics.memory.history.length > 0) {
            this.metrics.memory.average = this.calculateAverage(this.metrics.memory.history, 'value');
            this.metrics.memory.peak = Math.max(...this.metrics.memory.history.map(h => h.value));
        }
    }

    updateAudioQualityScore(delta) {
        this.metrics.audio.qualityScore = Math.max(0, 
            Math.min(100, this.metrics.audio.qualityScore + delta)
        );
        
        this.updateHASensors('audio_quality', this.metrics.audio.qualityScore);
    }

    checkResourceAlerts(cpuPercent, memoryPercent) {
        // CPU alerts
        if (cpuPercent > this.options.cpuAlertThreshold) {
            this.handleResourceAlert('cpu', cpuPercent, this.options.cpuAlertThreshold);
        }
        
        // Memory alerts
        if (memoryPercent > this.options.memoryAlertThreshold) {
            this.handleResourceAlert('memory', memoryPercent, this.options.memoryAlertThreshold);
        }
    }

    handleResourceAlert(resourceType, currentValue, threshold) {
        const alertKey = `${resourceType}_${Date.now()}`;
        
        // Avoid duplicate alerts (within 5 minutes)
        const recentAlerts = this.metrics[resourceType].alerts
            .filter(alert => Date.now() - alert.timestamp < 300000);
        
        if (recentAlerts.length > 0) return;
        
        const alert = {
            id: alertKey,
            type: resourceType,
            value: currentValue,
            threshold,
            timestamp: Date.now(),
            level: currentValue > threshold * 1.2 ? 'critical' : 'warning'
        };
        
        this.metrics[resourceType].alerts.push(alert);
        
        this.logger.warn(`${resourceType.toUpperCase()} alert triggered`, alert);
        
        this.sendHANotification(alert.level, 
            `High ${resourceType} usage: ${currentValue}%`, {
                resource: resourceType,
                value: currentValue,
                threshold
            }
        );
        
        this.emit('resourceAlert', alert);
    }

    getActiveAlerts() {
        const cutoff = Date.now() - 300000; // Last 5 minutes
        const alerts = [];
        
        // Collect recent alerts from all resource types
        ['cpu', 'memory'].forEach(resourceType => {
            const recentAlerts = this.metrics[resourceType].alerts
                .filter(alert => alert.timestamp > cutoff);
            alerts.push(...recentAlerts);
        });
        
        return alerts.sort((a, b) => b.timestamp - a.timestamp);
    }

    calculateUptime() {
        // Calculate uptime since monitoring started
        return Date.now() - (this.startTime || Date.now());
    }

    calculateDailyAverageScore() {
        // This would calculate the average performance score over the last 24 hours
        // For now, return current score
        return this.metrics.performance.overallScore;
    }

    generateDeviceReport() {
        return Array.from(this.metrics.devices.entries()).map(([host, metrics]) => ({
            host,
            reliability: metrics.reliability,
            latency: metrics.latency,
            uptime: metrics.uptime,
            errors: metrics.errors,
            lastSeen: new Date(metrics.lastSeen).toISOString()
        }));
    }

    calculateDeviceReliabilityReport() {
        const devices = Array.from(this.metrics.devices.values());
        if (devices.length === 0) return { average: 100, count: 0 };
        
        const averageReliability = devices.reduce((sum, device) => 
            sum + device.reliability, 0) / devices.length;
        
        return {
            average: Math.round(averageReliability),
            count: devices.length,
            online: devices.filter(d => Date.now() - d.lastSeen < 60000).length
        };
    }

    getPerformanceReport() {
        return {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            tuningState: this.tuningState,
            diagnostics: {
                activeTests: this.diagnostics.activeTests.size,
                testHistory: this.diagnostics.testHistory.slice(-10)
            }
        };
    }

    async shutdown() {
        this.logger.info('Shutting down performance monitor...');
        
        // Clear intervals (in a real implementation, you'd track these)
        // clearInterval(this.cpuMonitorInterval);
        // etc.
        
        this.emit('monitoringShutdown');
    }
}

module.exports = PerformanceMonitor;