# Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Performance Optimization System](#performance-optimization-system)
3. [Home Assistant Integration](#home-assistant-integration)
4. [Auto-Configuration System](#auto-configuration-system)
5. [Performance Monitoring](#performance-monitoring)
6. [API Reference](#api-reference)
7. [Configuration Reference](#configuration-reference)
8. [Development Guide](#development-guide)
9. [Troubleshooting](#troubleshooting)
10. [Migration Guide](#migration-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AirSonos Optimized                      │
├─────────────────────────────────────────────────────────────┤
│  Home Assistant Integration Layer                           │
│  ├─ Sensor Management      ├─ Service Registration         │
│  ├─ Dashboard Generation   ├─ Notification System          │
│  └─ WebSocket Communication                                 │
├─────────────────────────────────────────────────────────────┤
│  Performance Monitoring & Auto-Tuning                      │
│  ├─ CPU/Memory Monitoring  ├─ Audio Dropout Detection      │
│  ├─ Network Latency Track  ├─ Device Reliability Scoring   │
│  └─ Automatic Optimization                                  │
├─────────────────────────────────────────────────────────────┤
│  Optimized AirSonos Engine                                  │
│  ├─ Adaptive Buffering     ├─ Worker Thread Processing     │
│  ├─ Smart Format Detection ├─ Network Optimization         │
│  └─ Device Management                                       │
├─────────────────────────────────────────────────────────────┤
│  Auto-Configuration System                                  │
│  ├─ Device Discovery       ├─ Capability Testing           │
│  ├─ System Analysis        ├─ Configuration Migration      │
│  └─ Setup Wizard                                            │
├─────────────────────────────────────────────────────────────┤
│  Foundation Layer                                           │
│  ├─ NodeTunes (AirPlay)    ├─ node-sonos (Sonos API)      │
│  ├─ Nicercast (Streaming)  ├─ Express (Web Server)         │
│  └─ Winston (Logging)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
AirPlay Client → NodeTunes → Worker Thread → Audio Processor
                                    ↓
Performance Monitor ← Adaptive Buffer ← Nicercast → Sonos Device
        ↓                              ↓
Home Assistant ← WebSocket ← Metrics Collector
```

---

## Performance Optimization System

### Adaptive Audio Buffering

The adaptive buffering system dynamically adjusts buffer sizes based on real-time performance metrics:

```javascript
class AdaptiveBufferManager {
    constructor(options) {
        this.minBufferSize = options.minBufferSize || 200; // ms
        this.maxBufferSize = options.maxBufferSize || 500; // ms
        this.currentSize = this.minBufferSize;
        this.adjustmentCooldown = 5000; // ms
        this.underrunThreshold = 3;
        this.overrunThreshold = 10;
    }

    adjustBuffer(event, data) {
        switch (event) {
            case 'underrun':
                if (this.recentUnderruns >= this.underrunThreshold) {
                    this.increaseBuffer(50);
                }
                break;
            case 'overrun':
                if (this.recentOverruns >= this.overrunThreshold) {
                    this.decreaseBuffer(25);
                }
                break;
            case 'dropout':
                this.increaseBuffer(100); // Aggressive increase
                break;
        }
    }
}
```

#### Buffer Adjustment Logic

1. **Underrun Detection**: Increases buffer by 50ms when 3+ underruns occur within 60 seconds
2. **Overrun Management**: Decreases buffer by 25ms when 10+ overruns occur with no underruns
3. **Dropout Response**: Aggressive 100ms increase for audio dropouts
4. **Cooldown Period**: 5-second minimum between adjustments
5. **Boundary Enforcement**: Stays within configured min/max limits

### Worker Thread Processing

Multi-threaded audio processing distributes CPU load across available cores:

```javascript
class WorkerThreadManager {
    constructor(maxWorkers = os.cpus().length) {
        this.maxWorkers = Math.min(maxWorkers, 4); // Cap at 4 for efficiency
        this.workers = new Map();
        this.taskQueue = [];
        this.roundRobinIndex = 0;
    }

    async processAudio(audioChunk, formatInfo) {
        const worker = this.selectOptimalWorker();
        return await this.delegateToWorker(worker, audioChunk, formatInfo);
    }

    selectOptimalWorker() {
        // Round-robin with load balancing
        const availableWorkers = Array.from(this.workers.values())
            .filter(w => !w.busy)
            .sort((a, b) => a.tasksCompleted - b.tasksCompleted);
        
        return availableWorkers[0] || this.workers.values().next().value;
    }
}
```

#### Worker Thread Benefits

- **CPU Utilization**: Distributes audio processing across multiple cores
- **Latency Reduction**: Parallel processing reduces overall latency
- **Fault Isolation**: Worker failures don't crash main process
- **Load Balancing**: Intelligent task distribution based on worker load

### Smart Format Detection

Automatic audio format optimization for best quality and performance:

```javascript
class AudioFormatDetector {
    detectFormat(audioStream) {
        const analysis = {
            sampleRate: this.detectSampleRate(audioStream),
            channels: this.detectChannels(audioStream),
            bitDepth: this.detectBitDepth(audioStream),
            codec: this.detectCodec(audioStream)
        };

        return this.selectOptimalFormat(analysis);
    }

    selectOptimalFormat(analysis) {
        // Prefer ALAC for high-quality sources
        if (analysis.bitDepth >= 16 && this.deviceSupportsALAC()) {
            return { codec: 'alac', ...analysis };
        }
        
        // Fall back to PCM for compatibility
        return { codec: 'pcm', ...analysis };
    }
}
```

#### Format Selection Priority

1. **ALAC**: For high-quality sources with device support
2. **PCM**: Universal compatibility fallback
3. **AAC**: For bandwidth-constrained environments
4. **MP3**: Legacy device support

---

## Home Assistant Integration

### Sensor System

The integration creates 8 sensors for comprehensive monitoring:

```yaml
# System Performance Sensors
sensor.airsonos_cpu_usage:
  state_class: measurement
  unit_of_measurement: "%"
  device_class: None

sensor.airsonos_memory_usage:
  state_class: measurement  
  unit_of_measurement: "MB"
  device_class: data_size

# Audio Quality Sensors
sensor.airsonos_active_streams:
  state_class: measurement
  unit_of_measurement: "streams"

sensor.airsonos_buffer_health:
  state: "good|fair|poor"
  icon: "mdi:buffer"

# Network Performance Sensors
sensor.airsonos_network_latency:
  state_class: measurement
  unit_of_measurement: "ms"

sensor.airsonos_network_errors:
  state_class: total_increasing
  unit_of_measurement: "errors"

# Service Status Sensors
binary_sensor.airsonos_service_status:
  device_class: connectivity
  payload_on: "ON"
  payload_off: "OFF"

sensor.airsonos_service_uptime:
  state_class: measurement
  unit_of_measurement: "s"
  device_class: duration
```

### Service Definitions

Twelve services provide complete system control:

```yaml
# Core Services
airsonos.restart:
  description: "Restart the AirSonos service"
  fields:
    force:
      description: "Force restart ignoring active streams"
      default: false

airsonos.scan_devices:
  description: "Scan for new Sonos devices"
  fields:
    timeout:
      description: "Scan timeout in seconds"
      default: 10

# Configuration Services  
airsonos.configure_device:
  description: "Add or configure a Sonos device"
  fields:
    host: { required: true }
    port: { default: 1400 }
    name: { required: false }

airsonos.update_buffer_settings:
  description: "Update audio buffer configuration"
  fields:
    min_buffer: { selector: { number: { min: 50, max: 1000 } } }
    max_buffer: { selector: { number: { min: 100, max: 2000 } } }
    adaptive: { selector: { boolean: {} } }

# Diagnostic Services
airsonos.generate_report:
  description: "Generate comprehensive diagnostic report"
  fields:
    include_logs: { default: true }
    include_performance: { default: true }
```

### WebSocket Communication

Real-time data streaming for live dashboard updates:

```javascript
class WebSocketManager {
    constructor(port = 8099) {
        this.server = new WebSocket.Server({ port });
        this.clients = new Set();
        this.setupEventHandlers();
    }

    broadcast(messageType, data) {
        const message = JSON.stringify({
            type: messageType,
            timestamp: Date.now(),
            data: data
        });

        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    // Broadcast performance updates every 30 seconds
    startPerformanceUpdates() {
        setInterval(() => {
            this.broadcast('performance_update', this.getPerformanceData());
        }, 30000);
    }
}
```

### Dashboard Auto-Generation

Automatic creation of Home Assistant dashboard widgets:

```javascript
const dashboardConfig = {
    title: "AirSonos Optimized",
    cards: [
        {
            type: "entities",
            title: "System Status",
            entities: [
                "binary_sensor.airsonos_service_status",
                "sensor.airsonos_cpu_usage", 
                "sensor.airsonos_memory_usage",
                "sensor.airsonos_service_uptime"
            ]
        },
        {
            type: "gauge",
            title: "Performance Score",
            entity: "sensor.airsonos_performance_score",
            min: 0,
            max: 100,
            severity: {
                green: 80,
                yellow: 60,
                red: 0
            }
        }
    ]
};
```

---

## Auto-Configuration System

### Device Discovery Methods

Four-tier discovery system for maximum compatibility:

```javascript
class DeviceDiscovery {
    async discoverDevices() {
        const devices = new Map();
        
        // Method 1: Standard Sonos discovery
        const standardDevices = await this.standardSonosDiscovery();
        this.mergeDevices(devices, standardDevices, 'standard');
        
        // Method 2: Network scanning (if few devices found)
        if (devices.size < 2) {
            const scannedDevices = await this.networkScanDiscovery();
            this.mergeDevices(devices, scannedDevices, 'scan');
        }
        
        // Method 3: SSDP discovery
        const ssdpDevices = await this.ssdpDiscovery();
        this.mergeDevices(devices, ssdpDevices, 'ssdp');
        
        // Method 4: mDNS discovery
        const mdnsDevices = await this.mdnsDiscovery();
        this.mergeDevices(devices, mdnsDevices, 'mdns');
        
        return Array.from(devices.values());
    }
}
```

#### Discovery Method Priority

1. **Standard Discovery**: Native Sonos API discovery
2. **Network Scanning**: Direct IP range scanning for Sonos ports
3. **SSDP Discovery**: UPnP service discovery protocol
4. **mDNS Discovery**: Multicast DNS service discovery

### System Capability Analysis

Comprehensive system analysis for optimal configuration:

```javascript
class SystemAnalyzer {
    async analyzeSystem() {
        return {
            cpu: {
                cores: os.cpus().length,
                model: os.cpus()[0].model,
                recommendedWorkers: this.calculateOptimalWorkers()
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                recommendedBufferSize: this.calculateBufferSize()
            },
            network: {
                interfaces: this.getNetworkInterfaces(),
                quality: await this.assessNetworkQuality()
            },
            features: {
                workerThreads: this.supportsWorkerThreads(),
                nodeVersion: process.version
            }
        };
    }

    calculateOptimalWorkers() {
        const cores = os.cpus().length;
        const memoryGB = os.totalmem() / (1024 ** 3);
        
        // Conservative approach for limited memory systems
        if (memoryGB < 1) return 1;
        if (memoryGB < 2) return Math.min(2, cores);
        
        return Math.min(4, cores); // Cap at 4 for efficiency
    }
}
```

### Configuration Migration

Seamless migration from existing AirSonos installations:

```javascript
class ConfigurationMigrator {
    async migrateConfiguration() {
        const legacySources = [
            '/config/airsonos.json',
            '/data/options.json',
            './package.json',
            ...process.env // Environment variables
        ];

        const migratedConfig = this.createDefaultConfig();
        
        for (const source of legacySources) {
            try {
                const legacy = await this.loadLegacyConfig(source);
                this.applyMigration(legacy, migratedConfig);
            } catch (error) {
                this.logger.debug(`No legacy config at ${source}`);
            }
        }

        return this.validateAndOptimize(migratedConfig);
    }

    applyMigration(legacyConfig, modernConfig) {
        const mappings = {
            'timeout': 'basic_settings.timeout',
            'verbose': 'basic_settings.verbose', 
            'devices': 'manual_devices',
            'port': 'basic_settings.port'
        };

        for (const [legacy, modern] of Object.entries(mappings)) {
            if (legacyConfig[legacy] !== undefined) {
                this.setNestedValue(modernConfig, modern, legacyConfig[legacy]);
            }
        }
    }
}
```

---

## Performance Monitoring

### Real-time Metrics Collection

Continuous monitoring with configurable intervals:

```javascript
class PerformanceCollector {
    constructor(intervals = {}) {
        this.intervals = {
            cpu: intervals.cpu || 5000,
            network: intervals.network || 10000,
            audio: intervals.audio || 1000,
            devices: intervals.devices || 30000
        };
        
        this.metrics = {
            cpu: new CircularBuffer(288), // 24 hours at 5s intervals
            memory: new CircularBuffer(288),
            network: new CircularBuffer(144), // 24 hours at 10s intervals
            audio: new CircularBuffer(3600) // 1 hour at 1s intervals
        };
    }

    startCollection() {
        // CPU and Memory monitoring
        setInterval(async () => {
            const usage = await pidusage(process.pid);
            this.metrics.cpu.push({
                timestamp: Date.now(),
                value: usage.cpu,
                memory: usage.memory
            });
        }, this.intervals.cpu);

        // Network latency monitoring
        setInterval(async () => {
            const latency = await this.measureNetworkLatency();
            this.metrics.network.push({
                timestamp: Date.now(),
                latency: latency,
                quality: this.assessNetworkQuality(latency)
            });
        }, this.intervals.network);
    }
}
```

### Automated Performance Tuning

Intelligent optimization based on performance trends:

```javascript
class AutoTuner {
    constructor(thresholds = {}) {
        this.thresholds = {
            cpuAlert: thresholds.cpuAlert || 80,
            memoryAlert: thresholds.memoryAlert || 85,
            latencyAlert: thresholds.latencyAlert || 500,
            dropoutAlert: thresholds.dropoutAlert || 3
        };
        
        this.tuningHistory = [];
        this.cooldownPeriod = 30000; // 30 seconds
        this.lastAdjustment = 0;
    }

    async performAutoTuning(metrics) {
        if (Date.now() - this.lastAdjustment < this.cooldownPeriod) {
            return; // Still in cooldown period
        }

        const optimizations = this.calculateOptimizations(metrics);
        
        if (optimizations.length > 0) {
            await this.applyOptimizations(optimizations);
            this.lastAdjustment = Date.now();
        }
    }

    calculateOptimizations(metrics) {
        const optimizations = [];

        // High CPU usage optimization
        if (metrics.cpu.current > this.thresholds.cpuAlert) {
            optimizations.push({
                type: 'reduce_workers',
                reason: 'high_cpu',
                action: () => this.reduceWorkerCount()
            });
        }

        // Audio dropout optimization
        if (metrics.audio.dropouts > this.thresholds.dropoutAlert) {
            optimizations.push({
                type: 'increase_buffer',
                reason: 'audio_dropouts',
                action: () => this.increaseBufferSize(100)
            });
        }

        return optimizations;
    }
}
```

### Health Scoring Algorithm

Comprehensive health assessment with weighted factors:

```javascript
class HealthScorer {
    calculateOverallScore(metrics) {
        const weights = {
            cpu: 0.25,
            memory: 0.15,
            audio: 0.30,
            network: 0.20,
            devices: 0.10
        };

        const scores = {
            cpu: this.scoreCPU(metrics.cpu),
            memory: this.scoreMemory(metrics.memory),
            audio: this.scoreAudio(metrics.audio),
            network: this.scoreNetwork(metrics.network),
            devices: this.scoreDevices(metrics.devices)
        };

        let totalScore = 0;
        for (const [component, weight] of Object.entries(weights)) {
            totalScore += scores[component] * weight;
        }

        return Math.round(totalScore);
    }

    scoreCPU(cpuMetrics) {
        const current = cpuMetrics.current;
        if (current <= 40) return 100;
        if (current <= 60) return 85;
        if (current <= 80) return 70;
        return Math.max(0, 100 - (current - 80) * 2);
    }

    scoreAudio(audioMetrics) {
        let score = 100;
        score -= audioMetrics.dropouts * 10; // -10 per dropout
        score -= audioMetrics.underruns * 2;  // -2 per underrun
        score -= audioMetrics.overruns * 1;   // -1 per overrun
        return Math.max(0, score);
    }
}
```

---

## API Reference

### REST API Endpoints

The service exposes a REST API for external integration:

```javascript
// GET /api/status - Get current service status
{
    "status": "running",
    "uptime": 3600000,
    "version": "0.3.0",
    "devices": 3,
    "activeStreams": 1
}

// GET /api/metrics - Get performance metrics
{
    "cpu": {
        "current": 12.5,
        "average": 15.2,
        "peak": 28.1
    },
    "memory": {
        "current": 65.8,
        "total": 512000000
    },
    "audio": {
        "qualityScore": 95,
        "dropouts": 0,
        "activeStreams": 1
    }
}

// POST /api/devices/scan - Trigger device scan
{
    "timeout": 10
}

// PUT /api/config/buffer - Update buffer settings
{
    "minSize": 250,
    "maxSize": 600,
    "adaptive": true
}
```

### WebSocket Events

Real-time event streaming for live monitoring:

```javascript
// Connection: ws://localhost:8099

// Outbound Events (Server → Client)
{
    "type": "performance_update",
    "timestamp": 1640995200000,
    "data": {
        "cpu": 12.5,
        "memory": 65.8,
        "audioQuality": 95
    }
}

{
    "type": "device_event", 
    "timestamp": 1640995200000,
    "data": {
        "event": "connected",
        "device": "192.168.1.100",
        "name": "Living Room Sonos"
    }
}

// Inbound Commands (Client → Server)
{
    "type": "get_status"
}

{
    "type": "service_call",
    "service": "restart",
    "data": { "force": false }
}
```

### Home Assistant Service Calls

Comprehensive service interface for HA automation:

```yaml
# Service: airsonos.restart
service: airsonos.restart
data:
  force: false  # Optional: force restart ignoring active streams

# Service: airsonos.update_buffer_settings  
service: airsonos.update_buffer_settings
data:
  min_buffer: 250    # Optional: minimum buffer size (ms)
  max_buffer: 600    # Optional: maximum buffer size (ms)
  adaptive: true     # Optional: enable adaptive buffering

# Service: airsonos.configure_device
service: airsonos.configure_device
data:
  host: "192.168.1.100"  # Required: device IP address
  port: 1400             # Optional: device port (default 1400)
  name: "Living Room"    # Optional: custom device name

# Service: airsonos.generate_report
service: airsonos.generate_report
data:
  include_logs: true        # Optional: include log entries
  include_performance: true # Optional: include performance data
```

---

## Configuration Reference

### Complete Configuration Schema

```yaml
# Basic Settings
basic_settings:
  timeout: 5                    # Connection timeout (1-60 seconds)
  verbose: false               # Enable debug logging
  port: 5000                   # AirPlay service port (1024-65535)
  discovery_timeout: 10        # Device discovery timeout (5-60 seconds)
  max_devices: 50              # Maximum devices to manage (1-100)

# Audio Processing Settings
audio_settings:
  adaptive_buffering: true     # Enable adaptive buffer sizing
  min_buffer_size: 200        # Minimum buffer size (50-1000ms)
  max_buffer_size: 500        # Maximum buffer size (100-2000ms)
  enable_alac: true           # Enable Apple Lossless Audio Codec
  smart_format_detection: true # Auto-detect optimal audio formats

# Performance Settings
performance_settings:
  enable_worker_threads: true  # Use worker threads for audio processing
  max_workers: 0              # Maximum worker threads (0 = auto-detect)
  config_mode: "auto"         # Configuration mode: auto|easy|advanced
  network_buffer_size: 64     # Network buffer size (16-512 KB)
  backpressure_threshold: 0.8 # Backpressure threshold (0.1-1.0)

# Health Monitoring Settings
health_monitoring:
  health_check_interval: 30000     # Health check interval (5000-300000ms)
  adaptive_ping_interval: true     # Adaptive ping frequency
  min_ping_interval: 5000         # Minimum ping interval (1000-30000ms)
  max_ping_interval: 60000        # Maximum ping interval (10000-300000ms)

# Manual Device Configuration
manual_devices:
  - name: "Living Room Sonos"      # Custom device name
    host: "192.168.1.100"         # Device IP address (required)
    port: 1400                    # Device port (default 1400)
    enabled: true                 # Enable this device (default true)

# Home Assistant Integration Settings
integration_settings:
  enable_dashboard: true          # Auto-create dashboard widgets
  enable_notifications: true     # Send HA notifications
  notification_level: "info"     # Notification level: info|warning|error
  update_interval: 30            # HA sensor update interval (5-300 seconds)
  websocket_port: 8099           # WebSocket port for real-time updates

# Advanced Settings
advanced_settings:
  debug_mode: false              # Enable extensive debug logging
  performance_monitoring: true   # Enable performance monitoring
  custom_airplay_name: ""       # Custom AirPlay service name
  force_format: "auto"          # Force audio format: auto|pcm|alac|aac
  experimental_features: false  # Enable experimental features
```

### Environment Variable Configuration

Alternative configuration via environment variables:

```bash
# Basic Settings
AIRSONOS_TIMEOUT=5
AIRSONOS_VERBOSE=false
AIRSONOS_PORT=5000

# Performance Settings  
AIRSONOS_WORKER_THREADS=true
AIRSONOS_MAX_WORKERS=4
AIRSONOS_CONFIG_MODE=auto

# Device Configuration
AIRSONOS_DEVICES="192.168.1.100:1400,192.168.1.101:1400"

# Advanced Settings
AIRSONOS_DEBUG=false
AIRSONOS_MONITORING=true
```

---

## Development Guide

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/HansonTan/airsonos-optimized.git
cd airsonos-optimized

# Install dependencies
npm install

# Install development dependencies
npm install --save-dev jest eslint prettier

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
airsonos-optimized/
├── src/                          # Source code
│   ├── optimized_airsonos.js    # Main optimized engine
│   ├── ha_integration.js        # Home Assistant integration
│   ├── auto_config.js           # Auto-configuration system
│   ├── performance_monitor.js   # Performance monitoring
│   └── config_migration.js      # Configuration migration
├── lib/                          # Legacy compatibility
│   ├── index.js                 # Main entry point
│   ├── original_index.js        # Original backup
│   └── airsonos.js              # Core AirSonos class
├── config/                       # Configuration files
│   ├── options.json             # HA configuration schema
│   └── services.yaml            # HA service definitions
├── translations/                 # UI translations
│   └── en.json                  # English translations
├── docs/                        # Documentation
├── tests/                       # Test suite
└── .github/                     # GitHub Actions workflows
```

### Testing Framework

```javascript
// Test example: src/tests/performance_monitor.test.js
const PerformanceMonitor = require('../src/performance_monitor');

describe('PerformanceMonitor', () => {
    test('should initialize with default options', () => {
        const monitor = new PerformanceMonitor();
        expect(monitor.options.cpuMonitorInterval).toBe(5000);
    });

    test('should detect high CPU usage', async () => {
        const monitor = new PerformanceMonitor();
        const mockUsage = { cpu: 85 };
        
        const alerts = monitor.checkResourceAlerts(mockUsage);
        expect(alerts).toContain('high_cpu');
    });
});

// Run tests
npm test
```

### Contributing Guidelines

1. **Code Style**: Follow ESLint configuration
2. **Testing**: Write tests for new features
3. **Documentation**: Update docs for API changes
4. **Commits**: Use conventional commit messages
5. **Pull Requests**: Include description and test results

### Building Custom Features

```javascript
// Example: Custom audio processor
class CustomAudioProcessor {
    constructor(options) {
        this.options = options;
    }

    process(audioChunk) {
        // Custom audio processing logic
        return this.applyCustomEffects(audioChunk);
    }

    applyCustomEffects(chunk) {
        // Implementation details
        return chunk;
    }
}

// Register with main engine
airsonos.registerAudioProcessor('custom', CustomAudioProcessor);
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: No Devices Discovered

**Symptoms**: 
- Service starts but no Sonos devices found
- Device discovery times out

**Diagnosis**:
```bash
# Check network connectivity
ping 192.168.1.100  # Replace with device IP

# Test Sonos port connectivity
telnet 192.168.1.100 1400

# Check multicast support
curl -X GET http://192.168.1.100:1400/xml/device_description.xml
```

**Solutions**:
1. **Network Configuration**:
   ```yaml
   # Enable manual device configuration
   manual_devices:
     - host: "192.168.1.100"
       port: 1400
       name: "Living Room Sonos"
   ```

2. **Firewall Settings**:
   - Open ports 1400, 1401, 5000
   - Enable multicast (IGMP) on network

3. **Discovery Method**:
   ```yaml
   # Increase discovery timeout
   discovery_timeout: 30
   ```

#### Issue: Audio Dropouts

**Symptoms**:
- Intermittent audio interruptions
- Poor audio quality

**Diagnosis**:
```javascript
// Check buffer health via API
GET /api/metrics
{
    "audio": {
        "dropouts": 5,
        "bufferHealth": "poor",
        "qualityScore": 65
    }
}
```

**Solutions**:
1. **Increase Buffer Sizes**:
   ```yaml
   audio_settings:
     min_buffer_size: 300
     max_buffer_size: 750
     adaptive_buffering: true
   ```

2. **Network Optimization**:
   ```yaml
   performance_settings:
     network_buffer_size: 128
     backpressure_threshold: 0.7
   ```

3. **Reduce Processing Load**:
   ```yaml
   performance_settings:
     max_workers: 2
     config_mode: "efficiency"
   ```

#### Issue: High CPU Usage

**Symptoms**:
- System becomes unresponsive
- CPU usage above 80%

**Diagnosis**:
```bash
# Check process CPU usage
top -p $(pgrep -f airsonos)

# Monitor via HA sensor
sensor.airsonos_cpu_usage
```

**Solutions**:
1. **Reduce Worker Threads**:
   ```yaml
   performance_settings:
     max_workers: 1
     enable_worker_threads: false
   ```

2. **Disable Features**:
   ```yaml
   audio_settings:
     adaptive_buffering: false
     smart_format_detection: false
   ```

3. **Lower Monitoring Frequency**:
   ```yaml
   health_monitoring:
     health_check_interval: 60000
   integration_settings:
     update_interval: 60
   ```

#### Issue: Integration Not Working

**Symptoms**:
- No sensors in Home Assistant
- Services not available

**Diagnosis**:
```bash
# Check WebSocket connection
netstat -an | grep 8099

# Verify HA integration logs
tail -f /config/home-assistant.log | grep airsonos
```

**Solutions**:
1. **Restart Integration**:
   ```yaml
   service: airsonos.restart
   ```

2. **Check Port Availability**:
   ```yaml
   integration_settings:
     websocket_port: 8098  # Try different port
   ```

3. **Verify Configuration**:
   ```yaml
   integration_settings:
     enable_dashboard: true
     enable_notifications: true
   ```

### Performance Debugging

#### Enable Verbose Logging

```yaml
# Enable detailed logging
verbose: true
debug_mode: true

# Advanced logging levels
advanced_settings:
  log_level: "debug"
  log_components: ["audio", "network", "devices"]
```

#### Diagnostic Commands

```bash
# Generate diagnostic report
curl -X POST http://localhost:5000/api/diagnostics/report

# Run performance tests
curl -X POST http://localhost:5000/api/diagnostics/performance

# Check system health
curl -X GET http://localhost:5000/api/health
```

#### Performance Profiling

```javascript
// Enable Node.js profiling
node --prof src/index.js

// Generate flame graph
node --prof-process isolate-*.log > processed.txt

// Memory usage analysis
node --inspect src/index.js
```

---

## Migration Guide

### From Original AirSonos

#### Automatic Migration

The optimized version includes automatic migration:

```bash
# Run migration tool
node src/config_migration.js --verbose

# Dry run (no changes)
node src/config_migration.js --dry-run

# Custom output location
node src/config_migration.js --output /custom/path.json
```

#### Manual Migration Steps

1. **Backup Existing Configuration**:
   ```bash
   cp /config/airsonos.json /config/airsonos.json.backup
   ```

2. **Install Optimized Version**:
   - Follow HACS installation instructions
   - Keep original version running during migration

3. **Configure Device Mapping**:
   ```yaml
   # Map existing devices
   manual_devices:
     - name: "Living Room"       # From original config
       host: "192.168.1.100"    # From original config
       port: 1400
       enabled: true
   ```

4. **Performance Settings**:
   ```yaml
   # Start with conservative settings
   performance_settings:
     enable_worker_threads: true
     max_workers: 2
     config_mode: "auto"
   ```

5. **Test and Optimize**:
   - Start optimized version
   - Monitor performance dashboard
   - Adjust settings based on metrics

#### Configuration Mapping

| Original AirSonos | Optimized Version | Notes |
|------------------|-------------------|-------|
| `timeout` | `basic_settings.timeout` | Direct mapping |
| `verbose` | `basic_settings.verbose` | Direct mapping |
| `port` | `basic_settings.port` | Direct mapping |
| `devices` array | `manual_devices` | Enhanced with metadata |
| Command line args | `advanced_settings` | Migrated to config |

### From Docker Installation

#### Environment Variable Migration

```bash
# Original Docker environment
AIRSONOS_TIMEOUT=5
AIRSONOS_VERBOSE=true
AIRSONOS_DEVICES="192.168.1.100,192.168.1.101"

# Equivalent optimized configuration
```

```yaml
basic_settings:
  timeout: 5
  verbose: true
manual_devices:
  - host: "192.168.1.100"
    port: 1400
  - host: "192.168.1.101" 
    port: 1400
```

#### Migration Steps

1. **Export Current Environment**:
   ```bash
   docker exec airsonos env | grep AIRSONOS_ > airsonos.env
   ```

2. **Run Migration Tool**:
   ```bash
   node src/config_migration.js --env-file airsonos.env
   ```

3. **Install as HA Add-on**:
   - Follow HACS installation
   - Import generated configuration

### Rollback Procedure

If migration issues occur:

1. **Stop Optimized Version**:
   ```bash
   # Via Home Assistant
   Settings → Add-ons → AirSonos Optimized → Stop
   ```

2. **Restore Original Configuration**:
   ```bash
   cp /config/airsonos.json.backup /config/airsonos.json
   ```

3. **Restart Original AirSonos**:
   ```bash
   # Restore from backup or Docker
   ```

4. **Report Issues**:
   - Create GitHub issue with migration logs
   - Include system information and configuration

---

This comprehensive documentation covers all aspects of the AirSonos Optimized system. For additional support, consult the [README](README.md) or open an issue on [GitHub](https://github.com/HansonTan/airsonos-optimized/issues).