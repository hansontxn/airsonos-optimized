# Changelog

All notable changes to the AirSonos Optimized Home Assistant Add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2024-01-XX

### Added
- Home Assistant Add-on support with proper repository structure
- Web interface for monitoring and configuration
- Performance monitoring capabilities
- Adaptive buffering system
- Smart device discovery with manual configuration fallback
- Multi-architecture support (AMD64, ARM64, ARMv7)
- Comprehensive configuration schema
- Health checks and diagnostics
- Avahi integration for better device discovery

### Changed
- Restructured project for Home Assistant Add-on compatibility
- Optimized buffering algorithms for better performance
- Improved error handling and logging
- Enhanced device discovery mechanism
- Updated Docker configuration for Home Assistant Supervisor

### Fixed
- Connection stability issues
- Memory leaks in long-running sessions
- Device discovery timeout problems
- Audio synchronization issues

### Security
- Implemented proper privilege management
- Added AppArmor profile for container security
- Network access restrictions

## [0.2.6] - Previous Release

### Added
- Basic AirSonos functionality
- Device discovery
- Audio streaming capabilities

### Fixed
- Various stability improvements
- IP address handling fixes

---

## Configuration Changes

### Breaking Changes
- Configuration format updated for Home Assistant Add-on standards
- Environment variables renamed with `AIRSONOS_` prefix
- Port mappings changed to standard Home Assistant format

### Migration Guide
If upgrading from a previous version:

1. Update your configuration to use the new schema format
2. Review port mappings (default AirPlay port: 5000, Web interface: 8099)
3. Update any automation that relies on the old API endpoints
4. Check manual device configurations for proper format

## Upcoming Features

### Version 0.4.0 (Planned)
- Enhanced web interface with real-time monitoring
- Advanced audio quality settings
- Integration with Home Assistant entities
- Automatic device grouping
- Performance analytics dashboard

### Version 0.5.0 (Planned)
- Multi-room audio coordination
- Advanced scheduling features
- API integration for external control
- Enhanced diagnostics and troubleshooting tools