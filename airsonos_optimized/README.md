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
timeout: 5
verbose: false
port: 5000
discovery_timeout: 10
max_devices: 50
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | int | `5` | Connection timeout in seconds (1-300) |
| `verbose` | bool | `false` | Enable verbose logging |
| `port` | int | `5000` | AirPlay service port |
| `discovery_timeout` | int | `10` | Device discovery timeout in seconds (1-60) |
| `max_devices` | int | `50` | Maximum devices to discover (1-100) |

## Usage

1. After starting the add-on, your Sonos speakers will appear as AirPlay targets on your iOS/macOS devices
2. Select a Sonos speaker from your device's AirPlay menu
3. Audio will stream through the bridge to your Sonos system

## Network Requirements

- Home Assistant host and Sonos devices must be on the same network
- Multicast traffic must be allowed between devices
- Port 5000 must be accessible for AirPlay service

## Troubleshooting

### Devices Not Appearing

1. Check that auto-discovery is enabled
2. Verify network connectivity between Home Assistant and Sonos devices
3. Enable verbose logging for detailed diagnostic information

### Audio Issues

1. Check network bandwidth and stability
2. Verify Sonos devices are powered on and connected

## Support

For issues and feature requests, please visit:
- [GitHub Issues](https://github.com/hansontxn/airsonos-optimized/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

[releases-shield]: https://img.shields.io/github/release/hansontxn/airsonos-optimized.svg
[releases]: https://github.com/hansontxn/airsonos-optimized/releases
[license-shield]: https://img.shields.io/github/license/hansontxn/airsonos-optimized.svg