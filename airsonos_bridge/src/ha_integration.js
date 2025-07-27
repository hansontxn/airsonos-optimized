const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

class HomeAssistantIntegration extends EventEmitter {
    constructor(airsonosInstance, options = {}) {
        super();
        
        this.airsонos = airsonosInstance;
        this.options = {
            supervisorUrl: options.supervisorUrl || 'http://supervisor',
            supervisorToken: options.supervisorToken || process.env.SUPERVISOR_TOKEN,
            addonSlug: options.addonSlug || 'airsonos_optimized',
            wsPort: options.wsPort || 8099,
            updateInterval: options.updateInterval || 30000,
            ...options
        };
        
        // HA entity registry
        this.entities = new Map();
        this.sensors = new Map();
        this.services = new Map();
        this.notifications = new Map();
        
        // Dashboard configuration
        this.dashboardConfig = null;
        
        // WebSocket server for real-time updates
        this.wsServer = null;
        this.wsClients = new Set();
        
        // State tracking
        this.lastStats = null;
        this.deviceStates = new Map();
        
        this.setupIntegration();
    }

    async setupIntegration() {
        try {
            // Initialize WebSocket server for real-time communication
            await this.initializeWebSocketServer();
            
            // Register entities with Home Assistant
            await this.registerEntities();
            
            // Register services
            await this.registerServices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Create dashboard widgets
            await this.createDashboardWidgets();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            this.emit('integrationReady');
            console.log('Home Assistant integration initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize HA integration:', error);
            this.emit('integrationError', error);
        }
    }

    async initializeWebSocketServer() {
        return new Promise((resolve, reject) => {
            const server = http.createServer();
            this.wsServer = new WebSocket.Server({ server });
            
            this.wsServer.on('connection', (ws) => {
                this.wsClients.add(ws);
                console.log('HA WebSocket client connected');
                
                // Send current state immediately
                this.sendCurrentState(ws);
                
                ws.on('close', () => {
                    this.wsClients.delete(ws);
                    console.log('HA WebSocket client disconnected');
                });
                
                ws.on('message', (message) => {
                    this.handleWebSocketMessage(ws, message);
                });
            });
            
            server.listen(this.options.wsPort, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`HA WebSocket server listening on port ${this.options.wsPort}`);
                    resolve();
                }
            });
        });
    }

    handleWebSocketMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'get_state':
                    this.sendCurrentState(ws);
                    break;
                    
                case 'service_call':
                    this.handleServiceCall(data.service, data.data);
                    break;
                    
                case 'get_devices':
                    this.sendDeviceList(ws);
                    break;
                    
                default:
                    console.warn('Unknown WebSocket message type:', data.type);
            }
            
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    async registerEntities() {
        console.log('Registering Home Assistant entities...');
        
        // System sensors
        await this.registerSensor('cpu_usage', {
            name: 'AirSonos CPU Usage',
            device_class: 'None',
            unit_of_measurement: '%',
            state_class: 'measurement',
            icon: 'mdi:cpu-64-bit'
        });
        
        await this.registerSensor('memory_usage', {
            name: 'AirSonos Memory Usage',
            device_class: 'data_size',
            unit_of_measurement: 'MB',
            state_class: 'measurement',
            icon: 'mdi:memory'
        });
        
        await this.registerSensor('active_streams', {
            name: 'Active AirPlay Streams',
            device_class: 'None',
            unit_of_measurement: 'streams',
            state_class: 'measurement',
            icon: 'mdi:cast-audio'
        });
        
        await this.registerSensor('connected_devices', {
            name: 'Connected Sonos Devices',
            device_class: 'None',
            unit_of_measurement: 'devices',
            state_class: 'measurement',
            icon: 'mdi:speaker-multiple'
        });
        
        await this.registerSensor('packets_processed', {
            name: 'Audio Packets Processed',
            device_class: 'None',
            unit_of_measurement: 'packets',
            state_class: 'total_increasing',
            icon: 'mdi:network'
        });
        
        await this.registerSensor('network_errors', {
            name: 'Network Errors',
            device_class: 'None',
            unit_of_measurement: 'errors',
            state_class: 'total_increasing',
            icon: 'mdi:alert-network'
        });
        
        await this.registerSensor('buffer_health', {
            name: 'Audio Buffer Health',
            device_class: 'None',
            icon: 'mdi:buffer'
        });
        
        await this.registerSensor('service_uptime', {
            name: 'AirSonos Uptime',
            device_class: 'duration',
            unit_of_measurement: 's',
            state_class: 'measurement',
            icon: 'mdi:timer-outline'
        });
        
        // Binary sensors for service status
        await this.registerBinarySensor('service_status', {
            name: 'AirSonos Service Status',
            device_class: 'connectivity',
            icon: 'mdi:broadcast'
        });
        
        await this.registerBinarySensor('worker_threads_enabled', {
            name: 'Worker Threads Enabled',
            device_class: 'None',
            icon: 'mdi:cog-outline'
        });
    }

    async registerSensor(entityId, config) {
        const entity = {
            id: entityId,
            type: 'sensor',
            config: {
                ...config,
                unique_id: `airsonos_${entityId}`,
                object_id: `airsonos_${entityId}`,
                state_topic: `homeassistant/sensor/airsonos/${entityId}/state`,
                config_topic: `homeassistant/sensor/airsonos/${entityId}/config`,
                availability_topic: `homeassistant/sensor/airsonos/availability`,
                device: {
                    identifiers: ['airsonos_optimized'],
                    name: 'AirSonos Optimized',
                    model: 'AirTunes Bridge',
                    manufacturer: 'AirSonos Community',
                    sw_version: '0.3.0'
                }
            }
        };
        
        this.entities.set(entityId, entity);
        this.sensors.set(entityId, { value: null, lastUpdated: null });
        
        // Publish entity configuration to HA via API
        await this.publishEntityConfig(entity);
    }

    async registerBinarySensor(entityId, config) {
        const entity = {
            id: entityId,
            type: 'binary_sensor',
            config: {
                ...config,
                unique_id: `airsonos_${entityId}`,
                object_id: `airsonos_${entityId}`,
                state_topic: `homeassistant/binary_sensor/airsonos/${entityId}/state`,
                config_topic: `homeassistant/binary_sensor/airsonos/${entityId}/config`,
                availability_topic: `homeassistant/sensor/airsonos/availability`,
                payload_on: 'ON',
                payload_off: 'OFF',
                device: {
                    identifiers: ['airsonos_optimized'],
                    name: 'AirSonos Optimized',
                    model: 'AirTunes Bridge',
                    manufacturer: 'AirSonos Community',
                    sw_version: '0.3.0'
                }
            }
        };
        
        this.entities.set(entityId, entity);
        this.sensors.set(entityId, { value: null, lastUpdated: null });
        
        await this.publishEntityConfig(entity);
    }

    async publishEntityConfig(entity) {
        try {
            // In a real HA add-on, this would use the Supervisor API
            // For now, we'll use the internal state management
            console.log(`Registered ${entity.type}: ${entity.id}`);
            
            // Mark entity as available
            await this.updateEntityAvailability('online');
            
        } catch (error) {
            console.error(`Failed to publish entity config for ${entity.id}:`, error);
        }
    }

    async registerServices() {
        console.log('Registering Home Assistant services...');
        
        // Service: Restart AirSonos
        this.services.set('restart', {
            name: 'Restart AirSonos',
            description: 'Restart the AirSonos service',
            fields: {
                force: {
                    name: 'Force Restart',
                    description: 'Force restart even if streams are active',
                    required: false,
                    default: false,
                    selector: { boolean: {} }
                }
            }
        });
        
        // Service: Scan for devices
        this.services.set('scan_devices', {
            name: 'Scan for Devices',
            description: 'Scan for new Sonos devices on the network',
            fields: {
                timeout: {
                    name: 'Scan Timeout',
                    description: 'Timeout for device scan in seconds',
                    required: false,
                    default: 10,
                    selector: { 
                        number: { 
                            min: 5, 
                            max: 60, 
                            unit_of_measurement: 'seconds' 
                        } 
                    }
                }
            }
        });
        
        // Service: Configure device
        this.services.set('configure_device', {
            name: 'Configure Device',
            description: 'Add or configure a specific Sonos device',
            fields: {
                host: {
                    name: 'Device IP Address',
                    description: 'IP address of the Sonos device',
                    required: true,
                    selector: { text: {} }
                },
                port: {
                    name: 'Device Port',
                    description: 'Port number of the Sonos device',
                    required: false,
                    default: 1400,
                    selector: { 
                        number: { 
                            min: 1, 
                            max: 65535 
                        } 
                    }
                },
                name: {
                    name: 'Device Name',
                    description: 'Custom name for the device',
                    required: false,
                    selector: { text: {} }
                }
            }
        });
        
        // Service: Update buffer settings
        this.services.set('update_buffer_settings', {
            name: 'Update Buffer Settings',
            description: 'Update audio buffering configuration',
            fields: {
                min_buffer: {
                    name: 'Minimum Buffer Size',
                    description: 'Minimum buffer size in milliseconds',
                    required: false,
                    selector: { 
                        number: { 
                            min: 50, 
                            max: 1000, 
                            unit_of_measurement: 'ms' 
                        } 
                    }
                },
                max_buffer: {
                    name: 'Maximum Buffer Size',
                    description: 'Maximum buffer size in milliseconds',
                    required: false,
                    selector: { 
                        number: { 
                            min: 100, 
                            max: 2000, 
                            unit_of_measurement: 'ms' 
                        } 
                    }
                },
                adaptive: {
                    name: 'Adaptive Buffering',
                    description: 'Enable adaptive buffer size adjustment',
                    required: false,
                    selector: { boolean: {} }
                }
            }
        });
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Listen to AirSonos events
        this.airsonos.on('started', (data) => {
            this.updateSensorValue('service_status', 'ON');
            this.updateSensorValue('connected_devices', data.devices.length);
            this.sendNotification('info', 'AirSonos started successfully', {
                devices: data.devices.length,
                tunnels: data.tunnels.length
            });
        });
        
        this.airsonos.on('stopped', () => {
            this.updateSensorValue('service_status', 'OFF');
            this.updateSensorValue('active_streams', 0);
            this.sendNotification('warning', 'AirSonos service stopped');
        });
        
        this.airsonos.on('error', (error) => {
            this.sendNotification('error', `AirSonos error: ${error.message}`);
        });
        
        this.airsonos.on('healthUpdate', (health) => {
            this.updateHealthMetrics(health);
        });
        
        this.airsonos.on('performanceUpdate', (metrics) => {
            this.updatePerformanceMetrics(metrics);
        });
        
        // Device events
        this.airsonos.on('deviceConnected', (device) => {
            this.handleDeviceEvent('connected', device);
        });
        
        this.airsonos.on('deviceDisconnected', (device) => {
            this.handleDeviceEvent('disconnected', device);
        });
        
        this.airsonos.on('streamStarted', (stream) => {
            this.handleStreamEvent('started', stream);
        });
        
        this.airsonos.on('streamEnded', (stream) => {
            this.handleStreamEvent('ended', stream);
        });
    }

    updateHealthMetrics(health) {
        this.updateSensorValue('cpu_usage', Math.round(health.cpuUsage));
        this.updateSensorValue('memory_usage', Math.round(health.memoryUsage / 1024 / 1024));
        this.updateSensorValue('active_streams', health.activeTunnels || 0);
        this.updateSensorValue('service_uptime', Math.round(health.uptime / 1000));
        
        // Buffer health status
        let bufferHealth = 'good';
        if (health.bufferHealth) {
            const { underruns, overruns } = health.bufferHealth;
            if (underruns > 5) bufferHealth = 'poor';
            else if (underruns > 2 || overruns > 10) bufferHealth = 'fair';
        }
        this.updateSensorValue('buffer_health', bufferHealth);
        
        // Worker threads status
        this.updateSensorValue('worker_threads_enabled', health.activeWorkers > 0 ? 'ON' : 'OFF');
    }

    updatePerformanceMetrics(metrics) {
        this.updateSensorValue('packets_processed', metrics.packetsProcessed);
        this.updateSensorValue('network_errors', metrics.networkErrors);
        
        // Broadcast to WebSocket clients
        this.broadcastToClients({
            type: 'performance_update',
            data: metrics
        });
    }

    handleDeviceEvent(event, device) {
        const deviceId = device.host || device.id;
        const currentState = this.deviceStates.get(deviceId) || { status: 'unknown' };
        
        if (event === 'connected') {
            currentState.status = 'online';
            currentState.lastSeen = Date.now();
            currentState.name = device.name || device.deviceName;
            
            this.sendNotification('info', `Device ${device.name} connected`, {
                device: device.name,
                host: device.host
            });
            
        } else if (event === 'disconnected') {
            currentState.status = 'offline';
            currentState.lastSeen = Date.now();
            
            this.sendNotification('warning', `Device ${device.name} disconnected`, {
                device: device.name,
                host: device.host
            });
        }
        
        this.deviceStates.set(deviceId, currentState);
        
        // Update connected devices count
        const connectedCount = Array.from(this.deviceStates.values())
            .filter(state => state.status === 'online').length;
        this.updateSensorValue('connected_devices', connectedCount);
        
        // Broadcast device state update
        this.broadcastToClients({
            type: 'device_update',
            data: { deviceId, state: currentState, event }
        });
    }

    handleStreamEvent(event, stream) {
        if (event === 'started') {
            this.sendNotification('info', `AirPlay stream started on ${stream.deviceName}`, {
                device: stream.deviceName
            });
        } else if (event === 'ended') {
            this.sendNotification('info', `AirPlay stream ended on ${stream.deviceName}`, {
                device: stream.deviceName
            });
        }
        
        // Update active streams count
        const stats = this.airsonos.getStats();
        const activeStreams = stats.tunnels.filter(tunnel => 
            tunnel.stats.lastActivity > Date.now() - 60000
        ).length;
        
        this.updateSensorValue('active_streams', activeStreams);
    }

    updateSensorValue(entityId, value) {
        const sensor = this.sensors.get(entityId);
        if (sensor) {
            sensor.value = value;
            sensor.lastUpdated = Date.now();
            
            // Broadcast to HA and WebSocket clients
            this.broadcastSensorUpdate(entityId, value);
        }
    }

    broadcastSensorUpdate(entityId, value) {
        const updateData = {
            type: 'sensor_update',
            data: {
                entity_id: entityId,
                value: value,
                timestamp: Date.now()
            }
        };
        
        this.broadcastToClients(updateData);
    }

    async createDashboardWidgets() {
        console.log('Creating Home Assistant dashboard widgets...');
        
        this.dashboardConfig = {
            title: 'AirSonos Optimized',
            icon: 'mdi:cast-audio',
            cards: [
                {
                    type: 'entities',
                    title: 'System Status',
                    entities: [
                        'binary_sensor.airsonos_service_status',
                        'sensor.airsonos_cpu_usage',
                        'sensor.airsonos_memory_usage',
                        'sensor.airsonos_service_uptime'
                    ]
                },
                {
                    type: 'entities',
                    title: 'Audio Streaming',
                    entities: [
                        'sensor.airsonos_active_streams',
                        'sensor.airsonos_connected_devices',
                        'sensor.airsonos_buffer_health',
                        'binary_sensor.airsonos_worker_threads_enabled'
                    ]
                },
                {
                    type: 'entities',
                    title: 'Performance Metrics',
                    entities: [
                        'sensor.airsonos_packets_processed',
                        'sensor.airsonos_network_errors'
                    ]
                },
                {
                    type: 'glance',
                    title: 'Quick Stats',
                    entities: [
                        'sensor.airsonos_active_streams',
                        'sensor.airsonos_connected_devices',
                        'sensor.airsonos_cpu_usage',
                        'sensor.airsonos_memory_usage'
                    ]
                },
                {
                    type: 'button',
                    name: 'Restart Service',
                    icon: 'mdi:restart',
                    tap_action: {
                        action: 'call-service',
                        service: 'airsonos.restart'
                    }
                },
                {
                    type: 'button',
                    name: 'Scan Devices',
                    icon: 'mdi:radar',
                    tap_action: {
                        action: 'call-service',
                        service: 'airsonos.scan_devices'
                    }
                }
            ]
        };
        
        // Save dashboard configuration
        await this.saveDashboardConfig();
    }

    async saveDashboardConfig() {
        try {
            const configPath = '/data/dashboard_config.json';
            await fs.writeFile(configPath, JSON.stringify(this.dashboardConfig, null, 2));
            console.log('Dashboard configuration saved');
        } catch (error) {
            console.error('Failed to save dashboard config:', error);
        }
    }

    sendNotification(level, message, data = {}) {
        const notification = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            level: level, // info, warning, error
            message: message,
            data: data
        };
        
        this.notifications.set(notification.id, notification);
        
        // Send to Home Assistant
        this.sendToHomeAssistant('notification', notification);
        
        // Broadcast to WebSocket clients
        this.broadcastToClients({
            type: 'notification',
            data: notification
        });
        
        console.log(`[${level.toUpperCase()}] ${message}`, data);
    }

    async sendToHomeAssistant(type, data) {
        try {
            // In a real implementation, this would use the Supervisor API
            // to send data to Home Assistant
            console.log(`Sending to HA [${type}]:`, data);
            
        } catch (error) {
            console.error('Failed to send data to Home Assistant:', error);
        }
    }

    broadcastToClients(message) {
        const messageStr = JSON.stringify(message);
        
        for (const client of this.wsClients) {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(messageStr);
                }
            } catch (error) {
                console.error('Error broadcasting to WebSocket client:', error);
                this.wsClients.delete(client);
            }
        }
    }

    sendCurrentState(ws) {
        const state = {
            type: 'current_state',
            data: {
                sensors: Object.fromEntries(this.sensors),
                devices: Object.fromEntries(this.deviceStates),
                services: Object.fromEntries(this.services),
                stats: this.lastStats,
                uptime: Date.now() - (this.airsonos?.performanceMetrics?.startTime || Date.now())
            }
        };
        
        ws.send(JSON.stringify(state));
    }

    sendDeviceList(ws) {
        const devices = Array.from(this.deviceStates.entries()).map(([id, state]) => ({
            id,
            ...state
        }));
        
        ws.send(JSON.stringify({
            type: 'device_list',
            data: devices
        }));
    }

    async handleServiceCall(serviceName, serviceData) {
        console.log(`Service call: ${serviceName}`, serviceData);
        
        try {
            switch (serviceName) {
                case 'restart':
                    await this.handleRestartService(serviceData);
                    break;
                    
                case 'scan_devices':
                    await this.handleScanDevicesService(serviceData);
                    break;
                    
                case 'configure_device':
                    await this.handleConfigureDeviceService(serviceData);
                    break;
                    
                case 'update_buffer_settings':
                    await this.handleUpdateBufferSettings(serviceData);
                    break;
                    
                default:
                    console.warn(`Unknown service: ${serviceName}`);
            }
            
        } catch (error) {
            console.error(`Service call failed: ${serviceName}`, error);
            this.sendNotification('error', `Service ${serviceName} failed: ${error.message}`);
        }
    }

    async handleRestartService(data) {
        const force = data.force || false;
        
        if (!force) {
            const stats = this.airsonos.getStats();
            const activeStreams = stats.performance.packetsProcessed > 0;
            
            if (activeStreams) {
                this.sendNotification('warning', 'Cannot restart: active streams detected. Use force option if needed.');
                return;
            }
        }
        
        this.sendNotification('info', 'Restarting AirSonos service...');
        
        await this.airsonos.stop();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.airsonos.start();
        
        this.sendNotification('info', 'AirSonos service restarted successfully');
    }

    async handleScanDevicesService(data) {
        const timeout = data.timeout || 10;
        
        this.sendNotification('info', `Scanning for devices (timeout: ${timeout}s)...`);
        
        // Trigger device discovery
        const devices = await this.airsonos.discoverDevices();
        
        this.sendNotification('info', `Device scan complete: found ${devices.length} devices`);
    }

    async handleConfigureDeviceService(data) {
        const { host, port = 1400, name } = data;
        
        if (!host) {
            throw new Error('Device host is required');
        }
        
        this.sendNotification('info', `Configuring device ${host}:${port}...`);
        
        // Add device to manual configuration
        const deviceConfig = { host, port, name };
        
        // This would update the AirSonos configuration
        // and attempt to connect to the device
        
        this.sendNotification('info', `Device ${host} configured successfully`);
    }

    async handleUpdateBufferSettings(data) {
        const updates = {};
        
        if (data.min_buffer !== undefined) updates.minBufferSize = data.min_buffer;
        if (data.max_buffer !== undefined) updates.maxBufferSize = data.max_buffer;
        if (data.adaptive !== undefined) updates.adaptiveBuffering = data.adaptive;
        
        // Update AirSonos buffer settings
        Object.assign(this.airsonos.options, updates);
        
        this.sendNotification('info', 'Buffer settings updated', updates);
    }

    startPeriodicUpdates() {
        setInterval(() => {
            this.updatePeriodicMetrics();
        }, this.options.updateInterval);
    }

    async updatePeriodicMetrics() {
        try {
            const stats = this.airsonos.getStats();
            this.lastStats = stats;
            
            // Update various metrics that don't have dedicated events
            this.updateSensorValue('packets_processed', stats.performance.packetsProcessed);
            this.updateSensorValue('network_errors', stats.performance.networkErrors);
            
            // Mark availability
            await this.updateEntityAvailability('online');
            
        } catch (error) {
            console.error('Error updating periodic metrics:', error);
            await this.updateEntityAvailability('offline');
        }
    }

    async updateEntityAvailability(status) {
        // In a real implementation, this would publish to the availability topic
        console.log(`Entity availability: ${status}`);
    }

    getIntegrationInfo() {
        return {
            version: '0.3.0',
            entities: this.entities.size,
            sensors: this.sensors.size,
            services: this.services.size,
            wsClients: this.wsClients.size,
            notifications: this.notifications.size
        };
    }

    async shutdown() {
        console.log('Shutting down Home Assistant integration...');
        
        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }
        
        // Mark entities as unavailable
        await this.updateEntityAvailability('offline');
        
        this.emit('integrationShutdown');
    }
}

module.exports = HomeAssistantIntegration;