const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const EventEmitter = require('events');
const WebSocket = require('ws');

// Mock Home Assistant WebSocket
jest.mock('ws');

// Import modules to test
const HAIntegration = require('../src/ha_integration');
const OptimizedAirSonos = require('../src/optimized_airsonos');

describe('Home Assistant Integration Tests', () => {
    let haIntegration;
    let mockAirSonos;
    let mockWebSocketServer;
    let mockWebSocketClient;

    beforeEach(() => {
        // Mock WebSocket Server
        mockWebSocketServer = {
            on: jest.fn(),
            clients: new Set(),
            broadcast: jest.fn(),
            close: jest.fn()
        };
        
        // Mock WebSocket Client
        mockWebSocketClient = {
            readyState: WebSocket.OPEN,
            send: jest.fn(),
            on: jest.fn(),
            close: jest.fn()
        };
        
        WebSocket.Server.mockImplementation(() => mockWebSocketServer);
        
        // Create mock AirSonos instance
        mockAirSonos = new EventEmitter();
        mockAirSonos.options = {
            timeout: 5,
            verbose: false,
            port: 5000
        };
        mockAirSonos.metrics = {
            cpu: { current: 15 },
            memory: { current: 65 },
            audio: { qualityScore: 95, dropouts: 0 },
            devices: new Map()
        };
        mockAirSonos.devices = new Map();
        mockAirSonos.performance = {
            totalRequests: 100,
            successfulRequests: 98,
            averageResponseTime: 45
        };

        haIntegration = new HAIntegration(mockAirSonos, {
            websocketPort: 8099,
            enableDashboard: true,
            enableNotifications: true
        });
    });

    afterEach(() => {
        if (haIntegration) {
            haIntegration.shutdown();
        }
        jest.clearAllMocks();
    });

    describe('Sensor Management', () => {
        test('should initialize all required sensors', () => {
            haIntegration.initializeSensors();
            
            const expectedSensors = [
                'airsonos_cpu_usage',
                'airsonos_memory_usage',
                'airsonos_active_streams',
                'airsonos_connected_devices',
                'airsonos_packets_processed',
                'airsonos_network_errors',
                'airsonos_buffer_health',
                'airsonos_service_uptime'
            ];
            
            for (const sensorName of expectedSensors) {
                expect(haIntegration.sensors.has(sensorName)).toBe(true);
            }
        });

        test('should update sensor values correctly', () => {
            haIntegration.initializeSensors();
            
            haIntegration.updateSensorValue('airsonos_cpu_usage', 25.5);
            const sensor = haIntegration.sensors.get('airsonos_cpu_usage');
            
            expect(sensor.state).toBe(25.5);
            expect(sensor.lastUpdated).toBeCloseTo(Date.now(), -2);
        });

        test('should validate sensor values before updating', () => {
            haIntegration.initializeSensors();
            
            // Test invalid CPU value (over 100%)
            haIntegration.updateSensorValue('airsonos_cpu_usage', 150);
            const cpuSensor = haIntegration.sensors.get('airsonos_cpu_usage');
            
            expect(cpuSensor.state).toBe(100); // Should be clamped to 100
        });

        test('should publish sensor states to Home Assistant', () => {
            haIntegration.initializeSensors();
            
            const publishSpy = jest.spyOn(haIntegration, 'publishSensorStates');
            haIntegration.updateSensorValue('airsonos_cpu_usage', 20);
            
            expect(publishSpy).toHaveBeenCalled();
        });

        test('should handle sensor update errors gracefully', () => {
            haIntegration.initializeSensors();
            
            // Mock a sensor that throws an error
            const errorSensor = haIntegration.sensors.get('airsonos_cpu_usage');
            jest.spyOn(errorSensor, 'setState').mockImplementation(() => {
                throw new Error('Sensor update failed');
            });
            
            expect(() => {
                haIntegration.updateSensorValue('airsonos_cpu_usage', 30);
            }).not.toThrow();
        });
    });

    describe('Service Registration', () => {
        test('should register all required services', () => {
            haIntegration.registerServices();
            
            const expectedServices = [
                'restart',
                'scan_devices',
                'configure_device',
                'update_buffer_settings',
                'toggle_worker_threads',
                'update_health_monitoring',
                'reset_statistics',
                'get_device_info',
                'force_device_reconnect',
                'update_audio_settings',
                'generate_report',
                'set_debug_mode'
            ];
            
            for (const serviceName of expectedServices) {
                expect(haIntegration.services.has(serviceName)).toBe(true);
            }
        });

        test('should execute restart service correctly', async () => {
            haIntegration.registerServices();
            
            const restartSpy = jest.spyOn(mockAirSonos, 'restart').mockResolvedValue(true);
            
            const result = await haIntegration.executeService('restart', { force: false });
            
            expect(restartSpy).toHaveBeenCalledWith({ force: false });
            expect(result.success).toBe(true);
        });

        test('should execute scan_devices service correctly', async () => {
            haIntegration.registerServices();
            
            const scanSpy = jest.spyOn(mockAirSonos, 'scanForDevices').mockResolvedValue([
                { host: '192.168.1.100', name: 'Living Room' }
            ]);
            
            const result = await haIntegration.executeService('scan_devices', { timeout: 15 });
            
            expect(scanSpy).toHaveBeenCalledWith({ timeout: 15 });
            expect(result.success).toBe(true);
            expect(result.devices).toHaveLength(1);
        });

        test('should validate service parameters', async () => {
            haIntegration.registerServices();
            
            // Test invalid timeout value
            const result = await haIntegration.executeService('scan_devices', { timeout: -5 });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid parameter');
        });

        test('should handle service execution errors', async () => {
            haIntegration.registerServices();
            
            jest.spyOn(mockAirSonos, 'restart').mockRejectedValue(new Error('Service failed'));
            
            const result = await haIntegration.executeService('restart', {});
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Service failed');
        });
    });

    describe('WebSocket Communication', () => {
        test('should establish WebSocket server', () => {
            haIntegration.initializeWebSocket();
            
            expect(WebSocket.Server).toHaveBeenCalledWith({ port: 8099 });
            expect(mockWebSocketServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });

        test('should handle WebSocket client connections', () => {
            haIntegration.initializeWebSocket();
            
            // Simulate client connection
            const connectionHandler = mockWebSocketServer.on.mock.calls.find(
                call => call[0] === 'connection'
            )[1];
            
            connectionHandler(mockWebSocketClient);
            
            expect(haIntegration.wsClients.has(mockWebSocketClient)).toBe(true);
        });

        test('should broadcast performance updates', () => {
            haIntegration.initializeWebSocket();
            haIntegration.wsClients.add(mockWebSocketClient);
            
            const performanceData = {
                cpu: 20,
                memory: 70,
                audioQuality: 90
            };
            
            haIntegration.broadcastPerformanceUpdate(performanceData);
            
            expect(mockWebSocketClient.send).toHaveBeenCalledWith(
                expect.stringContaining('performance_update')
            );
        });

        test('should handle WebSocket client disconnections', () => {
            haIntegration.initializeWebSocket();
            haIntegration.wsClients.add(mockWebSocketClient);
            
            // Simulate client disconnection
            const disconnectHandler = mockWebSocketClient.on.mock.calls.find(
                call => call[0] === 'close'
            )[1];
            
            disconnectHandler();
            
            expect(haIntegration.wsClients.has(mockWebSocketClient)).toBe(false);
        });

        test('should handle WebSocket message parsing errors', () => {
            haIntegration.initializeWebSocket();
            
            const messageHandler = mockWebSocketClient.on.mock.calls.find(
                call => call[0] === 'message'
            )[1];
            
            // Send invalid JSON
            expect(() => {
                messageHandler('invalid json');
            }).not.toThrow();
        });
    });

    describe('Dashboard Generation', () => {
        test('should generate complete dashboard configuration', () => {
            haIntegration.generateDashboard();
            
            const dashboardConfig = haIntegration.getDashboardConfig();
            
            expect(dashboardConfig.title).toBe('AirSonos Optimized');
            expect(dashboardConfig.cards).toBeInstanceOf(Array);
            expect(dashboardConfig.cards.length).toBeGreaterThan(0);
        });

        test('should include all sensor cards in dashboard', () => {
            haIntegration.initializeSensors();
            haIntegration.generateDashboard();
            
            const dashboardConfig = haIntegration.getDashboardConfig();
            const entityCards = dashboardConfig.cards.filter(card => card.type === 'entities');
            
            expect(entityCards.length).toBeGreaterThan(0);
        });

        test('should create performance gauge card', () => {
            haIntegration.generateDashboard();
            
            const dashboardConfig = haIntegration.getDashboardConfig();
            const gaugeCard = dashboardConfig.cards.find(card => card.type === 'gauge');
            
            expect(gaugeCard).toBeDefined();
            expect(gaugeCard.entity).toContain('performance_score');
        });

        test('should update dashboard when configuration changes', () => {
            haIntegration.generateDashboard();
            const originalConfig = haIntegration.getDashboardConfig();
            
            // Change configuration
            haIntegration.options.enableDashboard = false;
            haIntegration.generateDashboard();
            const newConfig = haIntegration.getDashboardConfig();
            
            expect(newConfig).not.toEqual(originalConfig);
        });
    });

    describe('Notification System', () => {
        test('should send notifications for different severity levels', () => {
            const notificationSpy = jest.spyOn(haIntegration, 'sendHANotification');
            
            haIntegration.sendNotification('info', 'Test info message');
            haIntegration.sendNotification('warning', 'Test warning message');
            haIntegration.sendNotification('error', 'Test error message');
            
            expect(notificationSpy).toHaveBeenCalledTimes(3);
        });

        test('should format notification payloads correctly', () => {
            const sendSpy = jest.spyOn(haIntegration, 'sendHANotification');
            
            haIntegration.sendNotification('warning', 'High CPU usage detected', {
                cpu: 85,
                device: '192.168.1.100'
            });
            
            const notification = sendSpy.mock.calls[0][0];
            expect(notification.title).toContain('AirSonos');
            expect(notification.message).toBe('High CPU usage detected');
            expect(notification.data.cpu).toBe(85);
        });

        test('should respect notification level settings', () => {
            haIntegration.options.notificationLevel = 'error';
            
            const sendSpy = jest.spyOn(haIntegration, 'sendHANotification');
            
            haIntegration.sendNotification('info', 'Info message');
            haIntegration.sendNotification('warning', 'Warning message');
            haIntegration.sendNotification('error', 'Error message');
            
            // Only error should be sent
            expect(sendSpy).toHaveBeenCalledTimes(1);
        });

        test('should throttle repeated notifications', () => {
            const sendSpy = jest.spyOn(haIntegration, 'sendHANotification');
            
            // Send same notification multiple times quickly
            for (let i = 0; i < 5; i++) {
                haIntegration.sendNotification('warning', 'Repeated warning');
            }
            
            // Should be throttled to prevent spam
            expect(sendSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Real-time Event Handling', () => {
        test('should handle AirSonos device events', () => {
            haIntegration.setupEventHandlers();
            
            const broadcastSpy = jest.spyOn(haIntegration, 'broadcastEvent');
            
            mockAirSonos.emit('device_connected', {
                host: '192.168.1.100',
                name: 'Living Room'
            });
            
            expect(broadcastSpy).toHaveBeenCalledWith('device_event', {
                event: 'connected',
                device: '192.168.1.100',
                name: 'Living Room'
            });
        });

        test('should handle audio quality events', () => {
            haIntegration.setupEventHandlers();
            
            const updateSpy = jest.spyOn(haIntegration, 'updateSensorValue');
            
            mockAirSonos.emit('audio_quality_change', {
                qualityScore: 85,
                dropouts: 2
            });
            
            expect(updateSpy).toHaveBeenCalledWith('airsonos_buffer_health', 'fair');
        });

        test('should handle performance metric updates', () => {
            haIntegration.setupEventHandlers();
            
            const updateSpy = jest.spyOn(haIntegration, 'updateSensorValue');
            
            mockAirSonos.emit('performance_update', {
                cpu: 30,
                memory: 75,
                activeStreams: 2
            });
            
            expect(updateSpy).toHaveBeenCalledWith('airsonos_cpu_usage', 30);
            expect(updateSpy).toHaveBeenCalledWith('airsonos_memory_usage', 75);
            expect(updateSpy).toHaveBeenCalledWith('airsonos_active_streams', 2);
        });

        test('should handle error events gracefully', () => {
            haIntegration.setupEventHandlers();
            
            const notificationSpy = jest.spyOn(haIntegration, 'sendNotification');
            
            mockAirSonos.emit('error', new Error('Test error'));
            
            expect(notificationSpy).toHaveBeenCalledWith(
                'error',
                expect.stringContaining('Test error')
            );
        });
    });

    describe('Configuration Validation', () => {
        test('should validate integration configuration', () => {
            const validConfig = {
                websocketPort: 8099,
                enableDashboard: true,
                enableNotifications: true,
                notificationLevel: 'warning',
                updateInterval: 30
            };
            
            const isValid = haIntegration.validateConfiguration(validConfig);
            expect(isValid).toBe(true);
        });

        test('should reject invalid configuration', () => {
            const invalidConfig = {
                websocketPort: 80, // Invalid: below 1024
                enableDashboard: 'yes', // Invalid: should be boolean
                updateInterval: 2 // Invalid: too low
            };
            
            const isValid = haIntegration.validateConfiguration(invalidConfig);
            expect(isValid).toBe(false);
        });

        test('should apply configuration defaults', () => {
            const partialConfig = {
                enableDashboard: false
            };
            
            const fullConfig = haIntegration.applyConfigurationDefaults(partialConfig);
            
            expect(fullConfig.websocketPort).toBe(8099);
            expect(fullConfig.enableNotifications).toBe(true);
            expect(fullConfig.updateInterval).toBe(30);
        });
    });

    describe('Health Check Integration', () => {
        test('should perform health checks and update HA', () => {
            const updateSpy = jest.spyOn(haIntegration, 'updateSensorValue');
            
            haIntegration.performHealthCheck();
            
            expect(updateSpy).toHaveBeenCalledWith(
                'airsonos_service_status',
                expect.any(Boolean)
            );
        });

        test('should calculate service uptime correctly', () => {
            haIntegration.serviceStartTime = Date.now() - 3600000; // 1 hour ago
            
            const uptime = haIntegration.calculateUptime();
            expect(uptime).toBeCloseTo(3600, -1); // Allow some variance
        });

        test('should report service health status', () => {
            mockAirSonos.isHealthy = () => true;
            
            const healthStatus = haIntegration.getServiceHealth();
            
            expect(healthStatus.status).toBe('healthy');
            expect(healthStatus.uptime).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle WebSocket server startup failures', () => {
            WebSocket.Server.mockImplementation(() => {
                throw new Error('Port already in use');
            });
            
            expect(() => {
                haIntegration.initializeWebSocket();
            }).not.toThrow();
            
            expect(haIntegration.wsServer).toBeNull();
        });

        test('should recover from sensor update failures', () => {
            haIntegration.initializeSensors();
            
            // Mock sensor that always fails
            const sensor = haIntegration.sensors.get('airsonos_cpu_usage');
            jest.spyOn(sensor, 'setState').mockImplementation(() => {
                throw new Error('Sensor failed');
            });
            
            // Should not throw and should continue operating
            expect(() => {
                haIntegration.updateAllSensors();
            }).not.toThrow();
        });

        test('should handle HA connection losses gracefully', () => {
            haIntegration.haConnected = true;
            
            haIntegration.handleHAConnectionLoss();
            
            expect(haIntegration.haConnected).toBe(false);
            expect(haIntegration.reconnectAttempts).toBe(0);
        });

        test('should attempt automatic reconnection to HA', async () => {
            haIntegration.haConnected = false;
            
            const reconnectSpy = jest.spyOn(haIntegration, 'attemptHAReconnection');
            
            await haIntegration.checkAndReconnect();
            
            expect(reconnectSpy).toHaveBeenCalled();
        });
    });

    describe('Performance Optimization', () => {
        test('should batch sensor updates efficiently', () => {
            haIntegration.initializeSensors();
            
            const publishSpy = jest.spyOn(haIntegration, 'publishSensorStates');
            
            // Update multiple sensors
            haIntegration.updateSensorValue('airsonos_cpu_usage', 25);
            haIntegration.updateSensorValue('airsonos_memory_usage', 70);
            haIntegration.updateSensorValue('airsonos_active_streams', 2);
            
            // Should batch the updates
            expect(publishSpy).toHaveBeenCalledTimes(1);
        });

        test('should limit WebSocket message frequency', () => {
            haIntegration.initializeWebSocket();
            haIntegration.wsClients.add(mockWebSocketClient);
            
            // Send many rapid updates
            for (let i = 0; i < 10; i++) {
                haIntegration.broadcastPerformanceUpdate({ cpu: i * 10 });
            }
            
            // Should be throttled
            expect(mockWebSocketClient.send.mock.calls.length).toBeLessThan(10);
        });

        test('should cleanup resources on shutdown', () => {
            haIntegration.initializeWebSocket();
            haIntegration.wsClients.add(mockWebSocketClient);
            
            haIntegration.shutdown();
            
            expect(mockWebSocketServer.close).toHaveBeenCalled();
            expect(haIntegration.wsClients.size).toBe(0);
        });
    });
});

// Helper functions for testing
function createMockHAClient() {
    return {
        connected: true,
        publish: jest.fn(),
        subscribe: jest.fn(),
        disconnect: jest.fn(),
        on: jest.fn()
    };
}

function createMockDashboardCard(type, entity) {
    return {
        type: type,
        entity: entity,
        title: `Test ${type} Card`,
        config: {}
    };
}

// Export test utilities
module.exports = {
    createMockHAClient,
    createMockDashboardCard
};