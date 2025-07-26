const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');

// Import modules to benchmark
const OptimizedAirSonos = require('../src/optimized_airsonos');
const PerformanceMonitor = require('../src/performance_monitor');
const AutoConfigurationSystem = require('../src/auto_config');

describe('Performance Benchmark Suite', () => {
    let benchmarkResults = {};
    let performanceObserver;
    let airsonos;

    beforeEach(() => {
        benchmarkResults = {};
        
        // Setup performance observer
        performanceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
                benchmarkResults[entry.name] = {
                    duration: entry.duration,
                    startTime: entry.startTime,
                    endTime: entry.startTime + entry.duration
                };
            });
        });
        performanceObserver.observe({ entryTypes: ['measure'] });

        // Create test instance
        airsonos = new OptimizedAirSonos({
            timeout: 5,
            verbose: false,
            enableWorkerThreads: false // Disable for consistent testing
        });
    });

    afterEach(async () => {
        if (performanceObserver) {
            performanceObserver.disconnect();
        }
        
        if (airsonos) {
            await airsonos.stop();
        }

        // Save benchmark results
        await saveBenchmarkResults(benchmarkResults);
    });

    describe('Startup Performance', () => {
        test('should measure initialization time', async () => {
            performance.mark('init-start');
            
            const newAirSonos = new OptimizedAirSonos({
                timeout: 5,
                verbose: false
            });
            await newAirSonos.initialize();
            
            performance.mark('init-end');
            performance.measure('initialization', 'init-start', 'init-end');
            
            const result = benchmarkResults.initialization;
            expect(result.duration).toBeLessThan(5000); // Should initialize in under 5s
            
            await newAirSonos.stop();
        });

        test('should measure device discovery performance', async () => {
            performance.mark('discovery-start');
            
            const devices = await airsonos.discoverDevices({ timeout: 10000 });
            
            performance.mark('discovery-end');
            performance.measure('device-discovery', 'discovery-start', 'discovery-end');
            
            const result = benchmarkResults['device-discovery'];
            expect(result.duration).toBeLessThan(12000); // Should complete within timeout + buffer
        });

        test('should measure configuration loading time', async () => {
            const testConfig = {
                basic_settings: { timeout: 5, verbose: false },
                audio_settings: { adaptive_buffering: true },
                performance_settings: { enable_worker_threads: true }
            };

            performance.mark('config-start');
            
            airsonos.loadConfiguration(testConfig);
            
            performance.mark('config-end');
            performance.measure('configuration-loading', 'config-start', 'config-end');
            
            const result = benchmarkResults['configuration-loading'];
            expect(result.duration).toBeLessThan(100); // Should be very fast
        });
    });

    describe('Audio Processing Performance', () => {
        test('should benchmark audio buffer operations', async () => {
            const testBuffer = Buffer.alloc(4096, 0xAA); // 4KB test buffer
            const iterations = 1000;

            performance.mark('buffer-ops-start');
            
            for (let i = 0; i < iterations; i++) {
                airsonos.processAudioBuffer(testBuffer);
            }
            
            performance.mark('buffer-ops-end');
            performance.measure('audio-buffer-processing', 'buffer-ops-start', 'buffer-ops-end');
            
            const result = benchmarkResults['audio-buffer-processing'];
            const avgTimePerBuffer = result.duration / iterations;
            
            expect(avgTimePerBuffer).toBeLessThan(5); // Should process each buffer in under 5ms
        });

        test('should benchmark adaptive buffer adjustments', async () => {
            const adjustmentCount = 100;

            performance.mark('buffer-adjust-start');
            
            for (let i = 0; i < adjustmentCount; i++) {
                airsonos.bufferStats.underruns = 5; // Trigger adjustment
                airsonos.adjustBufferSize();
            }
            
            performance.mark('buffer-adjust-end');
            performance.measure('buffer-adjustments', 'buffer-adjust-start', 'buffer-adjust-end');
            
            const result = benchmarkResults['buffer-adjustments'];
            const avgAdjustmentTime = result.duration / adjustmentCount;
            
            expect(avgAdjustmentTime).toBeLessThan(1); // Should be very fast
        });

        test('should benchmark format detection performance', async () => {
            const mockAudioStreams = [
                { sampleRate: 44100, channels: 2, bitDepth: 16 },
                { sampleRate: 48000, channels: 2, bitDepth: 24 },
                { sampleRate: 96000, channels: 6, bitDepth: 32 }
            ];

            performance.mark('format-detection-start');
            
            for (const stream of mockAudioStreams) {
                for (let i = 0; i < 100; i++) {
                    airsonos.detectAudioFormat(stream);
                }
            }
            
            performance.mark('format-detection-end');
            performance.measure('format-detection', 'format-detection-start', 'format-detection-end');
            
            const result = benchmarkResults['format-detection'];
            expect(result.duration).toBeLessThan(1000); // Should complete quickly
        });
    });

    describe('Memory Performance', () => {
        test('should measure memory usage under load', async () => {
            const initialMemory = process.memoryUsage();
            
            // Simulate heavy load
            const largeBuffers = [];
            for (let i = 0; i < 100; i++) {
                largeBuffers.push(Buffer.alloc(1024 * 1024)); // 1MB buffers
                airsonos.processAudioBuffer(largeBuffers[i]);
            }
            
            const peakMemory = process.memoryUsage();
            
            // Cleanup
            largeBuffers.length = 0;
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            
            const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
            const memoryRecovered = peakMemory.heapUsed - finalMemory.heapUsed;
            
            expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024); // Should use less than 150MB
            expect(memoryRecovered / memoryIncrease).toBeGreaterThan(0.7); // Should recover 70%+ memory
        });

        test('should benchmark memory allocation patterns', async () => {
            const iterations = 1000;
            const allocations = [];

            performance.mark('memory-alloc-start');
            
            for (let i = 0; i < iterations; i++) {
                allocations.push({
                    buffer: Buffer.alloc(4096),
                    metadata: { size: 4096, timestamp: Date.now() },
                    processing: new Array(100).fill(Math.random())
                });
            }
            
            performance.mark('memory-alloc-end');
            performance.measure('memory-allocations', 'memory-alloc-start', 'memory-alloc-end');
            
            const result = benchmarkResults['memory-allocations'];
            expect(result.duration).toBeLessThan(1000); // Should allocate quickly
            
            // Cleanup
            allocations.length = 0;
        });
    });

    describe('Network Performance', () => {
        test('should benchmark device connection attempts', async () => {
            const mockDevices = [
                { host: '192.168.1.100', port: 1400 },
                { host: '192.168.1.101', port: 1400 },
                { host: '192.168.1.102', port: 1400 }
            ];

            performance.mark('connection-start');
            
            const connectionPromises = mockDevices.map(device => 
                airsonos.testDeviceConnection(device).catch(() => null) // Ignore failures
            );
            
            await Promise.allSettled(connectionPromises);
            
            performance.mark('connection-end');
            performance.measure('device-connections', 'connection-start', 'connection-end');
            
            const result = benchmarkResults['device-connections'];
            expect(result.duration).toBeLessThan(15000); // Should complete within 15s
        });

        test('should benchmark network latency calculations', async () => {
            const measurementCount = 50;
            const latencies = [];

            performance.mark('latency-start');
            
            for (let i = 0; i < measurementCount; i++) {
                const start = performance.now();
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // Simulate network delay
                const end = performance.now();
                latencies.push(end - start);
            }
            
            performance.mark('latency-end');
            performance.measure('latency-measurements', 'latency-start', 'latency-end');
            
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            expect(avgLatency).toBeLessThan(20); // Should average less than 20ms
        });
    });

    describe('CPU Performance', () => {
        test('should measure CPU-intensive operations', async () => {
            const iterations = 10000;

            performance.mark('cpu-intensive-start');
            
            // Simulate CPU-intensive audio processing
            for (let i = 0; i < iterations; i++) {
                const data = new Float32Array(1024);
                for (let j = 0; j < data.length; j++) {
                    data[j] = Math.sin(2 * Math.PI * j / data.length) * 0.5;
                }
                
                // Simulate audio effects
                for (let j = 0; j < data.length; j++) {
                    data[j] *= 0.8; // Volume adjustment
                    data[j] = Math.tanh(data[j] * 2); // Soft clipping
                }
            }
            
            performance.mark('cpu-intensive-end');
            performance.measure('cpu-intensive-processing', 'cpu-intensive-start', 'cpu-intensive-end');
            
            const result = benchmarkResults['cpu-intensive-processing'];
            expect(result.duration).toBeLessThan(5000); // Should complete in under 5s
        });

        test('should benchmark worker thread performance', async () => {
            if (!airsonos.supportsWorkerThreads()) {
                return; // Skip if worker threads not supported
            }

            const taskCount = 100;
            const tasks = Array.from({ length: taskCount }, (_, i) => ({
                id: i,
                data: Buffer.alloc(4096, i % 256)
            }));

            performance.mark('worker-threads-start');
            
            const results = await Promise.all(
                tasks.map(task => airsonos.processWithWorker(task))
            );
            
            performance.mark('worker-threads-end');
            performance.measure('worker-thread-processing', 'worker-threads-start', 'worker-threads-end');
            
            expect(results).toHaveLength(taskCount);
            
            const result = benchmarkResults['worker-thread-processing'];
            expect(result.duration).toBeLessThan(10000); // Should complete in under 10s
        });
    });

    describe('Monitoring Performance', () => {
        test('should benchmark performance monitor overhead', async () => {
            const monitor = new PerformanceMonitor(airsonos, null, {
                cpuMonitorInterval: 100,
                autoTuningEnabled: false // Disable to isolate monitoring overhead
            });

            const initialCPU = process.cpuUsage();
            const startTime = performance.now();
            
            // Run monitoring for 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const endTime = performance.now();
            const finalCPU = process.cpuUsage(initialCPU);
            
            monitor.shutdown();
            
            const cpuUsagePercent = (finalCPU.user + finalCPU.system) / ((endTime - startTime) * 1000);
            
            expect(cpuUsagePercent).toBeLessThan(0.05); // Should use less than 5% CPU for monitoring
        });

        test('should benchmark metric collection performance', async () => {
            const monitor = new PerformanceMonitor(airsonos);
            const metricCount = 1000;

            performance.mark('metrics-start');
            
            for (let i = 0; i < metricCount; i++) {
                monitor.recordMetric('test_metric', Math.random() * 100);
                monitor.recordMetric('another_metric', Math.random() * 50);
            }
            
            performance.mark('metrics-end');
            performance.measure('metric-collection', 'metrics-start', 'metrics-end');
            
            const result = benchmarkResults['metric-collection'];
            expect(result.duration).toBeLessThan(1000); // Should be very fast
            
            monitor.shutdown();
        });
    });

    describe('Configuration Performance', () => {
        test('should benchmark auto-configuration system', async () => {
            const autoConfig = new AutoConfigurationSystem({
                discoveryTimeout: 5000,
                verbose: false
            });

            performance.mark('auto-config-start');
            
            await autoConfig.runFullConfiguration();
            
            performance.mark('auto-config-end');
            performance.measure('auto-configuration', 'auto-config-start', 'auto-config-end');
            
            const result = benchmarkResults['auto-configuration'];
            expect(result.duration).toBeLessThan(30000); // Should complete in under 30s
        });

        test('should benchmark configuration validation', async () => {
            const testConfigurations = generateTestConfigurations(100);

            performance.mark('validation-start');
            
            for (const config of testConfigurations) {
                airsonos.validateConfiguration(config);
            }
            
            performance.mark('validation-end');
            performance.measure('configuration-validation', 'validation-start', 'validation-end');
            
            const result = benchmarkResults['configuration-validation'];
            expect(result.duration).toBeLessThan(500); // Should validate quickly
        });
    });

    describe('Load Testing', () => {
        test('should handle concurrent connections', async () => {
            const connectionCount = 50;
            const connections = [];

            performance.mark('concurrent-start');
            
            // Simulate concurrent connections
            for (let i = 0; i < connectionCount; i++) {
                connections.push(simulateConnection(airsonos, i));
            }
            
            await Promise.allSettled(connections);
            
            performance.mark('concurrent-end');
            performance.measure('concurrent-connections', 'concurrent-start', 'concurrent-end');
            
            const result = benchmarkResults['concurrent-connections'];
            expect(result.duration).toBeLessThan(15000); // Should handle load
        });

        test('should maintain performance under sustained load', async () => {
            const duration = 10000; // 10 seconds
            const startTime = performance.now();
            const measurements = [];

            while (performance.now() - startTime < duration) {
                const operationStart = performance.now();
                
                // Simulate typical operations
                airsonos.processAudioBuffer(Buffer.alloc(4096, 0xAA));
                airsonos.updateMetrics({ cpu: Math.random() * 100 });
                
                const operationEnd = performance.now();
                measurements.push(operationEnd - operationStart);
                
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
            }
            
            const avgOperationTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
            const maxOperationTime = Math.max(...measurements);
            
            expect(avgOperationTime).toBeLessThan(5); // Average should be fast
            expect(maxOperationTime).toBeLessThan(50); // Max should be reasonable
        });
    });

    describe('Comparison Benchmarks', () => {
        test('should compare optimized vs basic processing', async () => {
            const testData = Buffer.alloc(8192, 0xAA);
            const iterations = 1000;

            // Basic processing
            performance.mark('basic-start');
            for (let i = 0; i < iterations; i++) {
                basicAudioProcessing(testData);
            }
            performance.mark('basic-end');
            performance.measure('basic-processing', 'basic-start', 'basic-end');

            // Optimized processing
            performance.mark('optimized-start');
            for (let i = 0; i < iterations; i++) {
                airsonos.processAudioBuffer(testData);
            }
            performance.mark('optimized-end');
            performance.measure('optimized-processing', 'optimized-start', 'optimized-end');

            const basicTime = benchmarkResults['basic-processing'].duration;
            const optimizedTime = benchmarkResults['optimized-processing'].duration;
            const improvement = ((basicTime - optimizedTime) / basicTime) * 100;

            expect(improvement).toBeGreaterThan(0); // Should be faster than basic
        });
    });
});

// Helper functions
async function saveBenchmarkResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-results-${timestamp}.json`;
    const filepath = path.join(__dirname, 'benchmark-results', filename);
    
    try {
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        
        const report = {
            timestamp: new Date().toISOString(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                memory: os.totalmem(),
                nodeVersion: process.version
            },
            results: results,
            summary: generateSummary(results)
        };
        
        await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        console.log(`Benchmark results saved to: ${filepath}`);
    } catch (error) {
        console.warn('Failed to save benchmark results:', error.message);
    }
}

function generateSummary(results) {
    const summary = {
        totalTests: Object.keys(results).length,
        averageTime: 0,
        slowestOperation: null,
        fastestOperation: null
    };

    if (summary.totalTests === 0) return summary;

    const times = Object.values(results).map(r => r.duration);
    summary.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    const sortedEntries = Object.entries(results).sort((a, b) => a[1].duration - b[1].duration);
    summary.fastestOperation = { name: sortedEntries[0][0], time: sortedEntries[0][1].duration };
    summary.slowestOperation = { name: sortedEntries[sortedEntries.length - 1][0], time: sortedEntries[sortedEntries.length - 1][1].duration };

    return summary;
}

function generateTestConfigurations(count) {
    const configurations = [];
    
    for (let i = 0; i < count; i++) {
        configurations.push({
            basic_settings: {
                timeout: Math.floor(Math.random() * 60) + 1,
                verbose: Math.random() > 0.5,
                port: Math.floor(Math.random() * 60000) + 1024
            },
            audio_settings: {
                adaptive_buffering: Math.random() > 0.5,
                min_buffer_size: Math.floor(Math.random() * 500) + 50,
                max_buffer_size: Math.floor(Math.random() * 1500) + 500
            },
            performance_settings: {
                enable_worker_threads: Math.random() > 0.5,
                max_workers: Math.floor(Math.random() * 8),
                config_mode: ['auto', 'quality', 'efficiency'][Math.floor(Math.random() * 3)]
            }
        });
    }
    
    return configurations;
}

async function simulateConnection(airsonos, id) {
    const connectionData = {
        id: id,
        host: `192.168.1.${100 + (id % 50)}`,
        port: 1400
    };
    
    try {
        // Simulate connection process
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        airsonos.emit('device_connected', connectionData);
        
        // Simulate some audio processing
        for (let i = 0; i < 10; i++) {
            const buffer = Buffer.alloc(4096, id % 256);
            airsonos.processAudioBuffer(buffer);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { success: true, connection: connectionData };
    } catch (error) {
        return { success: false, error: error.message, connection: connectionData };
    }
}

function basicAudioProcessing(buffer) {
    // Simulate basic audio processing without optimizations
    const data = new Float32Array(buffer.length / 4);
    for (let i = 0; i < data.length; i++) {
        data[i] = (buffer.readInt32LE(i * 4) / 2147483647) * 0.8;
    }
    return data;
}

// Export benchmark utilities
module.exports = {
    saveBenchmarkResults,
    generateTestConfigurations,
    simulateConnection,
    generateSummary
};