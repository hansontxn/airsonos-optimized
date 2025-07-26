#!/usr/bin/with-contenv bashio

# ==============================================================================
# Home Assistant Community Add-on: AirSonos Optimized
# Starts the AirSonos service with optimizations
# ==============================================================================

declare timeout
declare verbose
declare port
declare discovery_timeout
declare max_devices

# Get configuration from Home Assistant
timeout=$(bashio::config 'timeout')
verbose=$(bashio::config 'verbose')
port=$(bashio::config 'port')
discovery_timeout=$(bashio::config 'discovery_timeout')
max_devices=$(bashio::config 'max_devices')

# Set environment variables
export TIMEOUT="${timeout}"
export VERBOSE="${verbose}"
export PORT="${port}"
export DISCOVERY_TIMEOUT="${discovery_timeout}"
export MAX_DEVICES="${max_devices}"
export NODE_ENV="production"

# Log configuration
bashio::log.info "Starting AirSonos Optimized..."
bashio::log.info "Timeout: ${timeout}s"
bashio::log.info "Verbose: ${verbose}"
bashio::log.info "Port: ${port}"
bashio::log.info "Discovery timeout: ${discovery_timeout}s"
bashio::log.info "Max devices: ${max_devices}"

# Start Avahi daemon for mDNS
if ! pgrep avahi-daemon > /dev/null; then
    bashio::log.info "Starting Avahi daemon..."
    /usr/sbin/avahi-daemon --daemonize --no-drop-root
fi

# Wait for Avahi to be ready
sleep 2

# Function to handle shutdown
shutdown_handler() {
    bashio::log.info "Shutting down AirSonos..."
    kill -TERM $AIRSONOS_PID
    wait $AIRSONOS_PID
    bashio::log.info "AirSonos stopped"
    exit 0
}

# Set up signal handlers
trap shutdown_handler SIGTERM SIGINT

# Change to app directory
cd /app

# Start performance monitoring in background if enabled
if bashio::config.true 'monitoring_enabled'; then
    bashio::log.info "Starting performance monitoring..."
    npm run monitor &
    MONITOR_PID=$!
fi

# Start the main application
bashio::log.info "Starting AirSonos service..."

# Build command line arguments
ARGS=""
if [ "${verbose}" = "true" ]; then
    ARGS="${ARGS} --verbose"
fi

if [ -n "${timeout}" ]; then
    ARGS="${ARGS} --timeout ${timeout}"
fi

# Start AirSonos
npm start ${ARGS} &
AIRSONOS_PID=$!

# Wait for the process to complete
wait $AIRSONOS_PID

# Clean up
if [ -n "${MONITOR_PID}" ]; then
    kill $MONITOR_PID 2>/dev/null || true
fi

bashio::log.info "AirSonos Optimized stopped"