#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on: AirSonos Optimized
# Runs the AirSonos Optimized service
# ==============================================================================

# Set up logging
bashio::log.info "Starting AirSonos Optimized..."

# Get configuration options
VERBOSE=$(bashio::config 'verbose')
TIMEOUT=$(bashio::config 'timeout')
DISCOVERY_TIMEOUT=$(bashio::config 'discovery_timeout')
ENABLE_DIAGNOSTICS=$(bashio::config 'enable_diagnostics')
ENABLE_WEB_INTERFACE=$(bashio::config 'enable_web_interface')
WEB_PORT=$(bashio::config 'web_port')
AIRPLAY_PORT=$(bashio::config 'airplay_port')
BUFFER_SIZE=$(bashio::config 'buffer_size')
MAX_CONNECTIONS=$(bashio::config 'max_connections')
ENABLE_PERFORMANCE_MONITORING=$(bashio::config 'enable_performance_monitoring')
AUTO_DISCOVERY=$(bashio::config 'auto_discovery')

# Log configuration
bashio::log.info "Configuration:"
bashio::log.info "  Verbose: ${VERBOSE}"
bashio::log.info "  Timeout: ${TIMEOUT}s"
bashio::log.info "  Discovery timeout: ${DISCOVERY_TIMEOUT}s"
bashio::log.info "  Web interface: ${ENABLE_WEB_INTERFACE} (port ${WEB_PORT})"
bashio::log.info "  AirPlay port: ${AIRPLAY_PORT}"
bashio::log.info "  Buffer size: ${BUFFER_SIZE}"
bashio::log.info "  Max connections: ${MAX_CONNECTIONS}"

# Set environment variables
export NODE_ENV=production
export AIRSONOS_VERBOSE="${VERBOSE}"
export AIRSONOS_TIMEOUT="${TIMEOUT}"
export AIRSONOS_DISCOVERY_TIMEOUT="${DISCOVERY_TIMEOUT}"
export AIRSONOS_WEB_INTERFACE="${ENABLE_WEB_INTERFACE}"
export AIRSONOS_WEB_PORT="${WEB_PORT}"
export AIRSONOS_AIRPLAY_PORT="${AIRPLAY_PORT}"
export AIRSONOS_BUFFER_SIZE="${BUFFER_SIZE}"
export AIRSONOS_MAX_CONNECTIONS="${MAX_CONNECTIONS}"
export AIRSONOS_PERFORMANCE_MONITORING="${ENABLE_PERFORMANCE_MONITORING}"
export AIRSONOS_AUTO_DISCOVERY="${AUTO_DISCOVERY}"

# Handle manual devices configuration
if bashio::config.has_value 'manual_devices'; then
    MANUAL_DEVICES=$(bashio::config 'manual_devices')
    export AIRSONOS_MANUAL_DEVICES="${MANUAL_DEVICES}"
    bashio::log.info "Manual devices configured: $(echo ${MANUAL_DEVICES} | jq length) device(s)"
fi

# Start Avahi daemon for device discovery
bashio::log.info "Starting Avahi daemon for device discovery..."
avahi-daemon --daemonize --no-chroot

# Wait for Avahi to be ready
sleep 2

# Start the application
bashio::log.info "Starting AirSonos Optimized service..."

# Build command line arguments
ARGS=""
if bashio::var.true "${VERBOSE}"; then
    ARGS="${ARGS} --verbose"
fi
ARGS="${ARGS} --timeout ${TIMEOUT}"

# Run diagnostics if enabled
if bashio::var.true "${ENABLE_DIAGNOSTICS}"; then
    bashio::log.info "Running diagnostics..."
    node /opt/airsonos/src/optimized_airsonos.js --diagnostics
fi

# Start the main service
exec node /opt/airsonos/src/optimized_airsonos.js ${ARGS}