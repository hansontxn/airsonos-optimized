const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const net = require('net');
const http = require('http');
const dgram = require('dgram');
const EventEmitter = require('events');

// Import modules to test
const OptimizedAirSonos = require('../src/optimized_airsonos');
const AutoConfigurationSystem = require('../src/auto_config');

describe('Device Compatibility Testing Suite', () => {
    let autoConfig;
    let mockDevices;
    let testResults;

    beforeEach(() => {
        autoConfig = new AutoConfigurationSystem({
            discoveryTimeout: 5000,
            verbose: false
        });
        
        mockDevices = [];
        testResults = {
            devices: [],
            summary: {
                total: 0,
                compatible: 0,
                incompatible: 0,
                issues: []
            }
        };
    });

    afterEach(() => {
        // Cleanup mock devices
        mockDevices.forEach(device => {
            if (device.server) {
                device.server.close();
            }
        });
        mockDevices = [];
    });

    describe('Sonos Device Detection', () => {
        test('should detect standard Sonos devices', async () => {
            const mockSonosDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockSonosDevice);

            const devices = await autoConfig.testDeviceCompatibility(['192.168.1.100:1400']);
            
            expect(devices).toHaveLength(1);
            expect(devices[0].compatible).toBe(true);
            expect(devices[0].deviceType).toBe('sonos');
        });

        test('should identify Sonos device models', async () => {
            const deviceModels = [
                { ip: '192.168.1.100', model: 'Sonos Play:1' },
                { ip: '192.168.1.101', model: 'Sonos Play:5' },
                { ip: '192.168.1.102', model: 'Sonos Beam' },
                { ip: '192.168.1.103', model: 'Sonos One' },
                { ip: '192.168.1.104', model: 'Sonos Arc' }
            ];

            for (const device of deviceModels) {
                const mockDevice = createMockSonosDevice(device.ip, 1400, device.model);
                mockDevices.push(mockDevice);
            }

            const testTargets = deviceModels.map(d => `${d.ip}:1400`);
            const results = await autoConfig.testDeviceCompatibility(testTargets);

            for (let i = 0; i < results.length; i++) {
                expect(results[i].model).toBe(deviceModels[i].model);
                expect(results[i].compatible).toBe(true);
            }
        });

        test('should handle non-Sonos devices gracefully', async () => {
            const mockGenericDevice = createMockGenericDevice('192.168.1.200', 1400);
            mockDevices.push(mockGenericDevice);

            const devices = await autoConfig.testDeviceCompatibility(['192.168.1.200:1400']);
            
            expect(devices).toHaveLength(1);
            expect(devices[0].compatible).toBe(false);
            expect(devices[0].issues).toContain('not_sonos_device');
        });
    });

    describe('Network Connectivity Tests', () => {
        test('should test basic TCP connectivity', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const connectivity = await autoConfig.testTCPConnectivity('192.168.1.100', 1400);
            
            expect(connectivity.reachable).toBe(true);
            expect(connectivity.responseTime).toBeLessThan(1000);
        });

        test('should handle connection timeouts', async () => {
            // Test non-existent device
            const connectivity = await autoConfig.testTCPConnectivity('192.168.1.199', 1400, 1000);
            
            expect(connectivity.reachable).toBe(false);
            expect(connectivity.error).toBeDefined();
        });

        test('should test HTTP endpoint availability', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const httpTest = await autoConfig.testHTTPEndpoint('192.168.1.100', 1400, '/xml/device_description.xml');
            
            expect(httpTest.accessible).toBe(true);
            expect(httpTest.statusCode).toBe(200);
        });

        test('should measure network latency accurately', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const latencyResults = [];
            for (let i = 0; i < 10; i++) {
                const result = await autoConfig.measureLatency('192.168.1.100', 1400);
                latencyResults.push(result.latency);
            }

            const avgLatency = latencyResults.reduce((a, b) => a + b, 0) / latencyResults.length;
            expect(avgLatency).toBeLessThan(100); // Should be fast for local network
            expect(Math.max(...latencyResults)).toBeLessThan(500); // No excessive spikes
        });
    });

    describe('Audio Format Compatibility', () => {
        test('should test PCM format support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const formatSupport = await autoConfig.testAudioFormatSupport('192.168.1.100', 1400);
            
            expect(formatSupport.pcm).toBe(true);
            expect(formatSupport.supportedFormats).toContain('audio/pcm');
        });

        test('should test ALAC format support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400, 'Sonos Play:5');
            mockDevice.supportedFormats = ['audio/pcm', 'audio/alac'];
            mockDevices.push(mockDevice);

            const formatSupport = await autoConfig.testAudioFormatSupport('192.168.1.100', 1400);
            
            expect(formatSupport.alac).toBe(true);
            expect(formatSupport.supportedFormats).toContain('audio/alac');
        });

        test('should test sample rate compatibility', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const sampleRates = [44100, 48000, 88200, 96000];
            const results = await autoConfig.testSampleRateSupport('192.168.1.100', 1400, sampleRates);
            
            expect(results.supported).toContain(44100);
            expect(results.supported).toContain(48000);
            expect(results.maxSampleRate).toBeGreaterThanOrEqual(48000);
        });

        test('should test bit depth support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const bitDepths = [16, 24, 32];
            const results = await autoConfig.testBitDepthSupport('192.168.1.100', 1400, bitDepths);
            
            expect(results.supported).toContain(16);
            expect(results.maxBitDepth).toBeGreaterThanOrEqual(16);
        });
    });

    describe('Device Capability Testing', () => {
        test('should test volume control capability', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const volumeTest = await autoConfig.testVolumeControl('192.168.1.100', 1400);
            
            expect(volumeTest.supported).toBe(true);
            expect(volumeTest.currentVolume).toBeGreaterThanOrEqual(0);
            expect(volumeTest.currentVolume).toBeLessThanOrEqual(100);
        });

        test('should test playback control capability', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const playbackTest = await autoConfig.testPlaybackControls('192.168.1.100', 1400);
            
            expect(playbackTest.play).toBe(true);
            expect(playbackTest.pause).toBe(true);
            expect(playbackTest.stop).toBe(true);
        });

        test('should test grouping capability', async () => {
            const mockDevice1 = createMockSonosDevice('192.168.1.100', 1400);
            const mockDevice2 = createMockSonosDevice('192.168.1.101', 1400);
            mockDevices.push(mockDevice1, mockDevice2);

            const groupingTest = await autoConfig.testGroupingCapability(['192.168.1.100:1400', '192.168.1.101:1400']);
            
            expect(groupingTest.supported).toBe(true);
            expect(groupingTest.maxGroupSize).toBeGreaterThan(1);
        });

        test('should test metadata support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const metadataTest = await autoConfig.testMetadataSupport('192.168.1.100', 1400);
            
            expect(metadataTest.trackInfo).toBe(true);
            expect(metadataTest.albumArt).toBe(true);
            expect(metadataTest.supportedFields).toContain('title');
            expect(metadataTest.supportedFields).toContain('artist');
        });
    });

    describe('Performance Compatibility', () => {
        test('should test device response times', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const responseTest = await autoConfig.testDeviceResponseTimes('192.168.1.100', 1400);
            
            expect(responseTest.avgResponseTime).toBeLessThan(500);
            expect(responseTest.maxResponseTime).toBeLessThan(2000);
            expect(responseTest.timeoutRate).toBeLessThan(0.05); // Less than 5% timeouts
        });

        test('should test concurrent connection handling', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevice.maxConnections = 5;
            mockDevices.push(mockDevice);

            const concurrencyTest = await autoConfig.testConcurrentConnections('192.168.1.100', 1400, 10);
            
            expect(concurrencyTest.maxConcurrentConnections).toBeGreaterThan(0);
            expect(concurrencyTest.connectionFailures).toBeDefined();
        });

        test('should test buffer size optimization', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const bufferSizes = [200, 300, 400, 500, 600];
            const bufferTest = await autoConfig.testOptimalBufferSize('192.168.1.100', 1400, bufferSizes);
            
            expect(bufferTest.optimalSize).toBeGreaterThan(0);
            expect(bufferTest.dropoutRates).toBeDefined();
            expect(Object.keys(bufferTest.dropoutRates)).toHaveLength(bufferSizes.length);
        });
    });

    describe('Firmware and Protocol Testing', () => {
        test('should detect device firmware version', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevice.firmwareVersion = '12.2.8';
            mockDevices.push(mockDevice);

            const firmwareInfo = await autoConfig.detectFirmwareVersion('192.168.1.100', 1400);
            
            expect(firmwareInfo.version).toBe('12.2.8');
            expect(firmwareInfo.compatible).toBe(true);
        });

        test('should test UPnP protocol support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const upnpTest = await autoConfig.testUPnPSupport('192.168.1.100', 1400);
            
            expect(upnpTest.supported).toBe(true);
            expect(upnpTest.services).toContain('MediaRenderer');
            expect(upnpTest.services).toContain('AVTransport');
        });

        test('should test SOAP action support', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const soapActions = ['Play', 'Pause', 'SetVolume', 'GetPositionInfo'];
            const soapTest = await autoConfig.testSOAPActions('192.168.1.100', 1400, soapActions);
            
            for (const action of soapActions) {
                expect(soapTest.supported[action]).toBe(true);
            }
        });
    });

    describe('Network Environment Testing', () => {
        test('should test multicast support', async () => {
            const multicastTest = await autoConfig.testMulticastSupport();
            
            expect(multicastTest.supported).toBeDefined();
            expect(multicastTest.interfaces).toBeInstanceOf(Array);
        });

        test('should test SSDP discovery', async () => {
            const ssdpTest = await autoConfig.testSSDPDiscovery(5000);
            
            expect(ssdpTest.devicesFound).toBeGreaterThanOrEqual(0);
            expect(ssdpTest.responseTime).toBeLessThan(6000);
        });

        test('should test mDNS resolution', async () => {
            const mdnsTest = await autoConfig.testMDNSResolution('_sonos._tcp.local', 5000);
            
            expect(mdnsTest.resolved).toBeDefined();
            expect(mdnsTest.services).toBeInstanceOf(Array);
        });

        test('should test network quality metrics', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const qualityTest = await autoConfig.testNetworkQuality('192.168.1.100', 1400);
            
            expect(qualityTest.bandwidth).toBeGreaterThan(0);
            expect(qualityTest.jitter).toBeLessThan(50);
            expect(qualityTest.packetLoss).toBeLessThan(0.01); // Less than 1%
        });
    });

    describe('Comprehensive Device Reports', () => {
        test('should generate complete compatibility report', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400, 'Sonos Play:5');
            mockDevices.push(mockDevice);

            const report = await autoConfig.generateCompatibilityReport(['192.168.1.100:1400']);
            
            expect(report.devices).toHaveLength(1);
            expect(report.devices[0]).toHaveProperty('connectivity');
            expect(report.devices[0]).toHaveProperty('audioSupport');
            expect(report.devices[0]).toHaveProperty('capabilities');
            expect(report.devices[0]).toHaveProperty('performance');
            expect(report.summary).toHaveProperty('compatible');
            expect(report.summary).toHaveProperty('issues');
        });

        test('should identify common compatibility issues', async () => {
            // Create devices with various issues
            const devices = [
                createMockSonosDevice('192.168.1.100', 1400), // Normal device
                createMockGenericDevice('192.168.1.200', 1400), // Non-Sonos device
                createMockSonosDevice('192.168.1.101', 1401), // Non-standard port
            ];
            
            // Add latency to one device
            devices[2].responseDelay = 2000;
            
            mockDevices.push(...devices);

            const report = await autoConfig.generateCompatibilityReport([
                '192.168.1.100:1400',
                '192.168.1.200:1400',
                '192.168.1.101:1401'
            ]);
            
            expect(report.summary.issues.length).toBeGreaterThan(0);
            expect(report.summary.compatible).toBeLessThan(report.summary.total);
        });

        test('should provide optimization recommendations', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevice.responseDelay = 500; // Slow response
            mockDevices.push(mockDevice);

            const report = await autoConfig.generateCompatibilityReport(['192.168.1.100:1400']);
            
            expect(report.recommendations).toBeInstanceOf(Array);
            expect(report.recommendations.length).toBeGreaterThan(0);
        });

        test('should save compatibility test results', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const report = await autoConfig.generateCompatibilityReport(['192.168.1.100:1400']);
            const saved = await autoConfig.saveCompatibilityReport(report, '/tmp/compatibility-test.json');
            
            expect(saved).toBe(true);
        });
    });

    describe('Automated Test Suite', () => {
        test('should run complete automated test suite', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const testSuite = await autoConfig.runAutomatedTestSuite(['192.168.1.100:1400'], {
                includePerformanceTests: true,
                includeNetworkTests: true,
                includeAudioTests: true
            });
            
            expect(testSuite.passed).toBeGreaterThan(0);
            expect(testSuite.total).toBeGreaterThan(testSuite.passed);
            expect(testSuite.results).toBeInstanceOf(Array);
        });

        test('should support test filtering', async () => {
            const mockDevice = createMockSonosDevice('192.168.1.100', 1400);
            mockDevices.push(mockDevice);

            const testSuite = await autoConfig.runAutomatedTestSuite(['192.168.1.100:1400'], {
                includePerformanceTests: false,
                includeNetworkTests: true,
                includeAudioTests: false
            });
            
            const networkTests = testSuite.results.filter(r => r.category === 'network');
            const performanceTests = testSuite.results.filter(r => r.category === 'performance');
            
            expect(networkTests.length).toBeGreaterThan(0);
            expect(performanceTests.length).toBe(0);
        });
    });
});

// Helper functions to create mock devices
function createMockSonosDevice(ip, port, model = 'Sonos Play:1') {
    const device = {
        ip: ip,
        port: port,
        model: model,
        firmwareVersion: '12.2.8',
        supportedFormats: ['audio/pcm', 'audio/wav'],
        responseDelay: 50,
        maxConnections: 10,
        server: null
    };

    // Create mock HTTP server
    device.server = http.createServer((req, res) => {
        setTimeout(() => {
            if (req.url === '/xml/device_description.xml') {
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end(`<?xml version="1.0"?>
                    <root xmlns="urn:schemas-upnp-org:device-1-0">
                        <device>
                            <deviceType>urn:schemas-sonos-com:device:ZonePlayer:1</deviceType>
                            <modelName>${model}</modelName>
                            <modelNumber>S1</modelNumber>
                            <softwareVersion>${device.firmwareVersion}</softwareVersion>
                        </device>
                    </root>`);
            } else if (req.url.startsWith('/MediaRenderer/')) {
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end('<?xml version="1.0"?><soap:Envelope><soap:Body><u:PlayResponse></u:PlayResponse></soap:Body></soap:Envelope>');
            } else {
                res.writeHead(404);
                res.end();
            }
        }, device.responseDelay);
    });

    device.server.listen(port, ip);
    
    return device;
}

function createMockGenericDevice(ip, port) {
    const device = {
        ip: ip,
        port: port,
        model: 'Generic Device',
        responseDelay: 100,
        server: null
    };

    // Create mock HTTP server that doesn't respond like Sonos
    device.server = http.createServer((req, res) => {
        setTimeout(() => {
            res.writeHead(404);
            res.end('Not Found');
        }, device.responseDelay);
    });

    device.server.listen(port, ip);
    
    return device;
}

// Export test utilities
module.exports = {
    createMockSonosDevice,
    createMockGenericDevice
};