# AirSonos Optimized Home Assistant Add-on

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE)

High-performance AirPlay to Sonos bridge with adaptive buffering and intelligent optimization for Home Assistant.

## About

This add-on provides a seamless bridge between AirPlay devices and Sonos speakers, allowing you to stream audio from iOS devices, Macs, and other AirPlay-compatible devices directly to your Sonos system through Home Assistant.

## Features

- **High Performance**: Optimized buffering and connection management
- **Adaptive Buffering**: Automatically adjusts buffer sizes based on network conditions
- **Smart Device Discovery**: Automatic detection of Sonos devices with manual configuration fallback
- **Web Interface**: Built-in web interface for monitoring and configuration
- **Performance Monitoring**: Optional performance metrics and diagnostics
- **Multi-Architecture Support**: Works on AMD64, ARM64, and ARMv7 devices

## Installation

1. Add this repository to your Home Assistant add-on store:
   ```
   https://github.com/hansontxn/airsonos-optimized
   ```

2. Find "AirSonos Optimized" in the add-on store and click "Install"

3. Configure the add-on (see Configuration section below)

4. Start the add-on

## Configuration

### Basic Configuration

```yaml
verbose: false
timeout: 5
discovery_timeout: 30
enable_web_interface: true
web_port: 8099
airplay_port: 5000
```

### Advanced Configuration

```yaml
buffer_size: 256
max_connections: 10
enable_performance_monitoring: false
auto_discovery: true
manual_devices:
  - name: "Living Room Sonos"
    ip: "192.168.1.100"
    port: 1400
  - name: "Kitchen Sonos"
    ip: "192.168.1.101"
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `verbose` | bool | `false` | Enable verbose logging |
| `timeout` | int | `5` | Connection timeout in seconds (1-300) |
| `discovery_timeout` | int | `30` | Device discovery timeout in seconds (5-300) |
| `enable_diagnostics` | bool | `false` | Run diagnostics on startup |
| `enable_web_interface` | bool | `true` | Enable web interface |
| `web_port` | int | `8099` | Web interface port |
| `airplay_port` | int | `5000` | AirPlay service port |
| `buffer_size` | int | `256` | Audio buffer size in KB (64-2048) |
| `max_connections` | int | `10` | Maximum concurrent connections (1-50) |
| `enable_performance_monitoring` | bool | `false` | Enable performance monitoring |
| `auto_discovery` | bool | `true` | Enable automatic device discovery |
| `manual_devices` | list | `[]` | Manually configured Sonos devices |

## Usage

1. After starting the add-on, your Sonos speakers will appear as AirPlay targets on your iOS/macOS devices
2. Select a Sonos speaker from your device's AirPlay menu
3. Audio will stream through the bridge to your Sonos system
4. Access the web interface at `http://hassio.local:8099` for monitoring

## Network Requirements

- Home Assistant host and Sonos devices must be on the same network
- Multicast traffic must be allowed between devices
- Ports 5000 (AirPlay) and 8099 (Web Interface) must be accessible

## Troubleshooting

### Devices Not Appearing

1. Check that auto-discovery is enabled
2. Verify network connectivity between Home Assistant and Sonos devices
3. Try adding devices manually using the `manual_devices` configuration
4. Enable verbose logging for detailed diagnostic information

### Audio Issues

1. Adjust the `buffer_size` setting (try values between 128-512)
2. Reduce `max_connections` if experiencing instability
3. Check network bandwidth and stability
4. Enable performance monitoring to identify bottlenecks

### Performance Issues

1. Enable performance monitoring in the configuration
2. Monitor CPU and memory usage in Home Assistant
3. Adjust buffer sizes based on your network performance
4. Consider reducing the number of concurrent connections

## Web Interface

The built-in web interface provides:

- Real-time status of connected devices
- Performance metrics and statistics
- Device discovery status
- Configuration validation
- Diagnostic tools

Access it at: `http://[HOME_ASSISTANT_IP]:8099`

## Support

For issues and feature requests, please visit:
- [GitHub Issues](https://github.com/hansontxn/airsonos-optimized/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Based on the original AirSonos project
- Optimized for Home Assistant integration
- Community contributions and feedback

[releases-shield]: https://img.shields.io/github/release/hansontxn/airsonos-optimized.svg
[releases]: https://github.com/hansontxn/airsonos-optimized/releases
[license-shield]: https://img.shields.io/github/license/hansontxn/airsonos-optimized.svg